# Vue components and public contracts

Read when designing or changing an SFC, wrapper, slot API, scoped dependency, directive, or async subtree. Target: **Vue 3.5.44**. Stable APIs unless explicitly marked experimental. Use [core Vue](core-vue.md) for reactivity and lifecycle, [composables](composables.md) for reusable effects, [accessibility](accessibility.md) for interaction semantics, and [migration](migration.md) for incumbent Options API/JSX.

## Decide the smallest meaningful contract

| Need | Prefer | Boundary |
| --- | --- | --- |
| Parent supplies data | Typed props | Child does not own or mutate the input. |
| Child reports an occurrence | Typed emits | Component events do not bubble through component ancestors. |
| Parent and child edit the same value | `defineModel()` | A prop plus `update:*` event, not shared ownership of arbitrary state. |
| Parent controls rendering/content | Named/scoped slots | Parent owns slot lexical scope; child explicitly supplies slot props. |
| Descendants share a scoped service/state owner | Typed provide/inject | Nearest provider wins; not an untracked global singleton. |
| Focus/scroll/reset imperative capability | Small `defineExpose()` surface | Do not expose an entire controller or rely on a child's internals. |
| DOM-specific low-level behavior | Custom directive | Components/composables own broader stateful workflows. |

Keep a cohesive local feature together. Extract a substantial responsibility when its state, lifecycle, or contract becomes independently understandable; reuse is not required. File length and a fixed number of props are review signals, not architectural laws. Prefer explicit ownership over pass-through wrapper chains.

## SFC and TypeScript boundaries

- Default to `<script setup lang="ts">`, followed by template and local scoped styles where needed. Top-level bindings/imports are template-visible; setup executes per instance. Ordinary module code executes on import and is shared.
- `defineProps`, `defineEmits`, `defineModel`, `defineSlots`, `defineExpose`, `defineOptions`, and `withDefaults` are **SFC compiler macros**: no imports, no calls from ordinary `.ts` composables. Declare one props contract and one emits contract per component. Choose a type declaration **or** runtime declaration, not both on the same macro.
- Props/emits declarations and `defineOptions` are hoisted: they cannot close over arbitrary setup-local values; imported bindings are allowed. `defineModel` hoists its prop options (`default`, `required`, validation), but inline `get`/`set` transformers remain in setup and may close over instance-local bindings, as the modifier example below does. `defineExpose` likewise uses instance bindings; do not apply a blanket hoisting rule to every macro argument.
- Type-based props generate limited runtime declarations via AST analysis, not a complete schema validator. Imported types work; a conditional type for an individual property can work, but a conditional type for the entire props object is unsupported. Validate untrusted I/O at its application boundary.
- In **3.5**, direct destructuring of `defineProps()` stays reactive for compiler-rewritten accesses in the same `<script setup>` block. Passing `count` passes a value: use `watch(() => count, ...)` or a getter input to a composable. This does not transform arbitrary destructuring, object rest results, or a later copy of the value into live refs.
- Props-rest bindings are not refs, but are not ordinary spread snapshots either: `const { label, ...rest } = defineProps<Props>()` compiles `rest` to getter-backed access to the remaining props. Read `rest.count` in an effect or pass `() => rest.count`; copying/destructuring that value later still takes a snapshot. Nested destructure patterns are unsupported.
- Native destructure defaults evaluate per instance; mutable defaults need no factory there. `withDefaults(defineProps<Props>(), { items: () => [] })` remains supported; its object/array defaults need factories.
- Generic SFCs use `generic="T extends ..."` and typed props/slots/emits. For a generic component's exposed instance, `InstanceType` is insufficient; use language-tool inference or the documented `ComponentExposed` helper after checking that helper's installed version. Do not add a type-helper dependency solely for a simple nongeneric component.
- Top-level `await` compiles to async setup and preserves instance context across that await. In plain Vue, it requires a Suspense boundary; it is not ordinary synchronous setup. Prefer explicit loading state when an experimental boundary is unwanted.

These are **3.5 compiler boundaries**, not Vue 3.6/Vapor rules. [SFC macro reference](https://vuejs.org/api/sfc-script-setup.html).

### Generic list without erasing the item type

Complete `ChoiceList.vue`: callers supply stable IDs, a scoped rendering slot,
and a selection payload preserving the full generic item type. It does not own a
second selection store or assume every item can be keyed by its array index.

```vue
<script setup lang="ts" generic="T extends { id: string | number }">
defineProps<{ items: readonly T[] }>()
const emit = defineEmits<{ select: [item: T] }>()
defineSlots<{
  default(props: { item: T; index: number }): unknown
  empty(): unknown
}>()
</script>

<template>
  <ul v-if="items.length">
    <li v-for="(item, index) in items" :key="item.id">
      <button type="button" @click="emit('select', item)">
        <slot :item="item" :index="index">{{ item.id }}</slot>
      </button>
    </li>
  </ul>
  <p v-else><slot name="empty">No choices</slot></p>
</template>
```

The default slot must supply noninteractive button-label content; do not nest
links/buttons inside it. Parent tooling infers `T` from `items`; the documented
`@vue-generic` template comment can supply an explicit type when inference is
insufficient. Type-only contracts do not validate incoming JSON. Use the
application's real boundary decoder before populating `items`.

## Props, events, model, slots, and attrs in one focused control

Complete `TitleInput.vue`. It exposes a text model, reports a deliberate commit, lets a parent customize help, and forwards undeclared native attributes/listeners to the actual input rather than the wrapper.

```vue
<script setup lang="ts">
import { useId, useTemplateRef } from 'vue'

defineOptions({ inheritAttrs: false })
const { label = 'Title', disabled = false } = defineProps<{
  label?: string
  disabled?: boolean
}>()
const [title, modifiers] = defineModel<string, 'trim'>({
  required: true,
  set(value) { return modifiers.trim ? value.trim() : value },
})
const emit = defineEmits<{ commit: [title: string] }>()
defineSlots<{ help(props: { length: number }): unknown }>()
const id = useId()
const helpId = `${id}-help`
const input = useTemplateRef<HTMLInputElement>('input')
function focus() { input.value?.focus() }
function commit() { emit('commit', title.value) }
defineExpose({ focus })
</script>

<template>
  <div class="title-input">
    <label :for="id">{{ label }}</label>
    <input
      v-bind="$attrs"
      :id="id"
      ref="input"
      v-model="title"
      :disabled="disabled"
      :aria-describedby="helpId"
      @keydown.enter.prevent="commit"
    />
    <p :id="helpId">
      <slot name="help" :length="title.length">{{ title.length }} characters</slot>
    </p>
  </div>
</template>
```

Complete consumer `TitleEditor.vue`, colocated with `TitleInput.vue`:

```vue
<script setup lang="ts">
import { ref, useTemplateRef, type InputHTMLAttributes } from 'vue'
import TitleInput from './TitleInput.vue'

const title = ref('Release notes')
const committedTitle = ref<string | null>(null)
const field = useTemplateRef<InstanceType<typeof TitleInput>>('field')
const titleAttrs: Pick<InputHTMLAttributes, 'autocomplete' | 'class' | 'style'> = {
  autocomplete: 'off',
}
function commit(value: string) { committedTitle.value = value }
</script>

<template>
  <TitleInput ref="field" v-model.trim="title" v-bind="titleAttrs" @commit="commit">
    <template #help="{ length }">{{ length }} characters. Press Enter to commit locally.</template>
  </TitleInput>
  <button type="button" @click="field?.focus()">Focus title</button>
  <p v-if="committedTitle !== null">Locally committed: {{ committedTitle }}</p>
</template>
```

The `titleAttrs` bag checks native input attributes against Vue's `InputHTMLAttributes`; its optional `class`/`style` keys overlap the component's accepted native attributes under strict template checking. This does not widen `TitleInput`'s declared props or accept arbitrary component properties: the wrapper still forwards these undeclared attributes through `$attrs` to the actual input. The wrapper deliberately owns its generated `id` and `aria-describedby`; later bindings override conflicting entries in `$attrs`. If callers must own these, declare and compose explicit props instead. This example commits only in memory, not to a server.

### Contract edge cases

- Props are shallow readonly: nested objects can still be mutated technically, but doing so silently changes parent state. Emit an action or replacement unless tight intentional ownership is documented. `ref(props.initialValue)` is an initial copy, not a live mirror; use a computed for a live view or an explicit draft/reset contract for editing.
- Declared emits consume matching listeners; undeclared listeners remain fallthrough attrs. Declaring `click` means `@click` listens to the component's emitted event, not automatically the native root click. Do not emit and forward the same listener accidentally.
- Named models use `defineModel<string>('title', { required: true })` with `v-model:title`. Initialize the parent and require the controlled model; a child default can desynchronize an undefined parent. Mutating a nested property of an object model does not itself assign the model ref or emit `update:*`; replace the object or expose explicit actions.
- `required: true` removes `undefined` from the model ref's inferred type and declares a required prop; it does **not** initialize an undefined parent or enforce a runtime schema. For a controlled input, require a model **and** initialize the parent's value, as above. Without both a model prop and its update listener, the model helper can update locally; do not describe `defineModel` as guaranteed parent ownership in an uncontrolled use.
- A model modifier is a flag, not automatic arbitrary normalization: implement supported flags in `get`/`set` and type their names (`'trim'` above). The setter transforms child assignments/emitted updates; it does not rewrite every parent-supplied prop. Normalize parent initialization at its owner when that invariant is required.
- `defineSlots` types slot names/props; its return type currently does not validate rendered content. Render `<slot>` in the template; do not eagerly invoke a slot in setup to cache reactive output. Slot presence (`$slots.help`) is not a guarantee of nonempty visible content.
- Render optional layout wrappers with `v-if="$slots.header"` at render time and give optional slots meaningful fallback content. Do not snapshot `!!useSlots().header` in setup: the parent may change its slots. A renderless component is appropriate when the consumer needs slot-driven rendering; choose a composable for behavior without a rendering contract.
- Single-root components inherit undeclared attrs automatically, merging `class`, `style`, and listeners. Multi-root components need an explicit target. `inheritAttrs: false` lets a wrapper choose the actual target.
- `useAttrs()` always exposes current attrs but is **not reactive**: do not watch it or assume a cached computed will update from it. Use props for reactive dependencies; read attrs during render or an appropriate post-update side effect. [Fallthrough semantics](https://vuejs.org/guide/components/attrs.html).
- Attribute names retain spelling: read `attrs['data-testid']`/`attrs['aria-label']`; listener keys are `attrs.onClick`/`attrs['onUpdate:modelValue']`. Values are `unknown`, and a listener may be an array; do not snapshot/cast it once then call it forever. Prefer `v-bind="$attrs"` at the actual DOM target. If a wrapper intercepts an event, explicitly decide whether to forward it or declare/emit it, and prevent a second automatic native invocation.
- Template refs start as `null`, can return to `null` under `v-if`, and are not available before mounting. Vue 3.5 `useTemplateRef('key')` returns a readonly shallow ref matching that key. The key passed to the function is fixed for that call; dynamic template `:ref` values may match it, but passing a ref/getter as the API key is unsupported. Ref-array order under `v-for` is not a data-order guarantee; use keyed callback refs when identity matters.
- Keep literal ref keys free of unrelated setup bindings. With `ref="accent"` and `useTemplateRef('accent')`, a controller also named `accent` can make inline compilation emit `ref: accent` instead of the template key, crashing the renderer. Name it `accentMotion`; use a distinct DOM-ref binding/key such as `accentElement`. An intentional ref/callback binding is different from an unrelated controller object.
- `<script setup>` instances are closed by default. Call `defineExpose` before any await and expose a narrow imperative API. Standard non-generic instances can use `InstanceType`; do not assume every component exposes an HTMLElement.

## Typed scoped dependencies

Complete `counter-context.ts`; call provider/consumer functions synchronously from component setup. The symbol is shared, the state is **per provider invocation**, and missing required providers fail rather than silently creating disconnected state.

```ts
import { inject, provide, readonly, ref, type InjectionKey, type Ref } from 'vue'

interface CounterContext {
  count: Readonly<Ref<number>>
  increment: () => void
}
const counterKey: InjectionKey<CounterContext> = Symbol('counter')

export function provideCounter(initial = 0): CounterContext {
  const count = ref(initial)
  const context: CounterContext = {
    count: readonly(count),
    increment() { count.value++ },
  }
  provide(counterKey, context)
  return context
}

export function useCounter(): CounterContext {
  const context = inject(counterKey)
  if (!context) throw new Error('Counter provider is required')
  return context
}
```

Contextual integration: an ancestor calls `provideCounter()` and a descendant calls `const { count, increment } = useCounter()`, importing from the module above. A component cannot inject its own newly provided value through ancestor lookup; use the value returned by `provideCounter()` in that provider.

Injection does not create reactivity by itself; provide refs/reactive objects/computed values. Composition `inject()` preserves a supplied ref; it does **not** universally unwrap it. Keep writes in provider actions; readonly state protects the consumer contract. An app plugin may use `app.provide()` for app-scoped services; SSR must create request-specific mutable state. [Provide/inject](https://vuejs.org/guide/components/provide-inject.html).

## Async components and built-in boundaries

| Feature | Use | Edge cases |
| --- | --- | --- |
| `defineAsyncComponent` | Load a noncritical component when rendered | Loader returns a component promise. Default loading delay is 200ms; timeout defaults to infinity. Choose timeout from actual UX requirements, not an arbitrary mandatory value. |
| `<Suspense>` — **experimental** | Coordinate async setup/async components in one subtree | Not a fetch cache or generic watcher loading indicator; has no built-in error slot. |
| `<KeepAlive>` | Preserve selected dynamic component instances | Cache is not persistence; effects are not automatically paused merely because the view is inactive. |
| `<Teleport>` | Move DOM outside clipping/stacking ancestors | Logical component ancestry, component-emitted events, and injection remain unchanged; native events follow the relocated DOM ancestry. Does not implement dialog accessibility. |
| `<Transition>` / `<TransitionGroup>` | Enter/leave or keyed list movement | Preserve stable keys and reduced-motion behavior; see [motion](motion.md). |

Contextual async-module example: this assumes an existing application-owned `ReportPanel.vue`. All helpers and loading/error components are defined; the lazy module is the integration seam, not a provided runnable file.

```ts
import { defineAsyncComponent, defineComponent, h } from 'vue'

const Loading = defineComponent({
  setup: () => () => h('p', { role: 'status' }, 'Loading report…'),
})
const LoadError = defineComponent({
  setup: () => () => h('p', { role: 'alert' }, 'The report component could not load.'),
})
export const AsyncReport = defineAsyncComponent({
  loader: () => import('./ReportPanel.vue'),
  loadingComponent: Loading,
  errorComponent: LoadError,
  delay: 200,
  timeout: 15000,
})
```

- Async wrappers pass props/slots through. Under a parent Suspense, async components are suspensible by default: Suspense controls loading, bypassing the wrapper's `loadingComponent`, `delay`, and `timeout`. In **3.5.44**, the loader-rejection path still reports the error and renders a configured `errorComponent`; this is not a built-in Suspense error slot. Set `suspensible: false` only when the wrapper should own its loading/timing behavior. [Pinned runtime branch](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiAsyncComponent.ts).
- Suspense default/fallback slots each have one immediate child. After resolving, it reenters pending when the default root is replaced, not whenever deeper async work starts. `timeout` controls fallback on reversion; `pending`/`resolve`/`fallback` describe boundary transitions. Use ancestor `onErrorCaptured` for errors. Nested `suspensible` delegates async dependency handling to the parent boundary.
- When all wrappers are needed, the official composition is `RouterView` scoped slot → `Transition` → `KeepAlive` → `Suspense` → dynamic component. Omit unneeded wrappers. Router lazy-imported route components do not themselves trigger Suspense. [Official Suspense status and nesting](https://vuejs.org/guide/built-ins/suspense.html).
- KeepAlive `include`/`exclude` match component names (SFC filenames infer names); `max` bounds an LRU cache. Keys distinguish cached instances and can grow the cache. Use `onActivated`/`onDeactivated` for active-only listeners/polling and retain final disposal. Do not assume unmount cleanup runs on tab deactivation. [KeepAlive](https://vuejs.org/guide/built-ins/keep-alive.html).
- Cached freshness is application policy: on activation compare the current resource/account key and invalidate/refetch its data cache as required, without discarding an unrelated local draft. Changing a component key creates another cache entry, **not** eviction of the old entry. Restrict `include`/`exclude`, bound changing-key cardinality with `max`, or remount the KeepAlive boundary when the entire cache must be cleared (for example at logout). There is no supported per-entry cache-manipulation API; do not reach into instance internals.
- Teleport targets must exist on mount. **3.5** `defer` permits a target rendered later in the **same** mount/update tick, not a second later. Multiple teleports append in mount order. `disabled` switches to inline placement. Choose a dedicated SSR target and follow [SSR/debugging](debugging-ssr.md); DOM movement is not a focus trap. [Teleport timing](https://vuejs.org/guide/built-ins/teleport.html#deferred-teleport).
- **3.5 SSR only:** `defineAsyncComponent({ hydrate })` supports imported `hydrateOnIdle`, `hydrateOnVisible`, `hydrateOnMediaQuery`, and `hydrateOnInteraction`. These defer hydration of server-rendered markup, not ordinary SPA mount. Interaction hydration replays the triggering event. Defer only where delayed interactivity is acceptable; omission is not inherently wrong. [Lazy hydration](https://vuejs.org/guide/components/async.html#lazy-hydration).

### Transition and persistent-element animation contracts

| Situation | Contract |
| --- | --- |
| One entering/leaving element, `v-if`, `v-show`, or dynamic view | `<Transition name="fade">` has one child; a child component needs one element root. Use `mode="out-in"` only for sequential swaps. A changing key explicitly requests replacement; Vue 3 already distinguishes `v-if` branches, so do not copy Vue-2-only “same-tag branches always need keys” advice. |
| Keyed list addition/removal/reorder | `<TransitionGroup name="list" tag="ul">` with stable keyed direct children. It has no default wrapper and no `mode`. `.list-move` animates position changes; a leaving item may need `position: absolute` inside a positioned container so other items can move. |
| Persistent DOM feedback (shake, pulse, highlight) | Toggle a class with `:class`; use `animationend.self`/`animationcancel.self` to clear transient animation state, or a cancellable owned timer. Repeated `true` assignment does not restart CSS animation; deliberately remove/re-add on a later rendered tick or use a library replay API. Never rely on an end event for business correctness; reduced-motion rules can remove animation entirely. |
| Input/scroll/progress/theme-driven interpolation | Bind camelCase styles/CSS custom properties to state and use CSS transitions for interpolation. Prefer transform/opacity where suitable; width/height/color are valid but can cost layout/paint. A scroll-following effect may need immediate transforms rather than a lagging CSS transition; own passive listeners and cancel any scheduled frame at disposal. |
| Numeric tween / JavaScript stagger | Watch the target, animate a separate display value, cancel the prior tween on invalidation and at unmount, and keep canonical domain state unchanged. For staggered enter hooks, pass `data-index`, derive a bounded delay, and call `done` once after the actual animation; cancel delayed starts/animations in cancellation/disposal paths. |

Named transitions use `*-enter-from/active/to` and `*-leave-from/active/to`. Vue detects CSS completion on the root; set `type="animation"` or `"transition"` when both apply, or an explicit `duration` including nested delay+duration. JavaScript-only hooks use `:css="false"` and own completion via `(element, done)`. `appear` opts into initial-render animation. None of these guarantees GPU acceleration or a frame rate. Honor `prefers-reduced-motion`; [motion](motion.md) owns animation-library contracts. [Vue transitions](https://vuejs.org/guide/built-ins/transition.html), [list transitions](https://vuejs.org/guide/built-ins/transition-group.html), [other animation techniques](https://vuejs.org/guide/extras/animation.html).

Complete state-driven SFC: a labeled progress control remains mounted; CSS interpolates the visual value without another JavaScript timer.

```vue
<script setup lang="ts">
import { ref, useId } from 'vue'
const id = useId()
const progress = ref(25)
</script>

<template>
  <label :for="id">Demonstration progress: {{ progress }}%</label>
  <input :id="id" v-model.number="progress" type="range" min="0" max="100" />
  <div class="track" aria-hidden="true">
    <div class="fill" :style="{ transform: `scaleX(${progress / 100})` }" />
  </div>
</template>

<style scoped>
.track { height: 0.5rem; background: #ddd; }
.fill {
  height: 100%; background: #2459ad; transform-origin: left;
  transition: transform 150ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .fill { transition: none; }
}
</style>
```

## Rendering, directives, plugins, and custom elements

Prefer templates; render functions are useful for truly programmatic structures. `setup()` returns a render **function**, not a single frozen render result. Create unique vnodes per tree position; pass component slots as functions. Use `h`, `mergeProps`, `withModifiers`, and `withDirectives` rather than depending on internal vnode fields. JSX is an incumbent integration described in [migration](migration.md#incumbent-jsx-and-render-functions).

A directive should own low-level DOM behavior only. Complete SFC using hook-object directive form so autofocus runs on mount, not on every update:

```vue
<script setup lang="ts">
import { useId, type ObjectDirective } from 'vue'
const id = useId()
const vFocus: ObjectDirective<HTMLInputElement> = {
  mounted(element) { element.focus() },
}
</script>

<template>
  <label :for="id">Search</label>
  <input :id="id" v-focus type="search" />
</template>
```

Only apply autofocus where user flow calls for it. Function directive shorthand runs on both mounted **and updated**; it is not mount-only. Directives on multi-root components are unsupported and root changes make single-root usage fragile. Keep directive bindings readonly; store per-element resources in a `WeakMap`, disconnect/remove them on unmount. Client directive hooks do not run during SSR; implement `getSSRProps` when equivalent server attributes are needed, or prefer declarative bindings. [Custom directives](https://vuejs.org/guide/reusability/custom-directives.html).

For a value-bearing directive, use `ObjectDirective<HTMLElement, Value>` or `satisfies Directive<HTMLElement, Value>` so `binding.value` is checked. Local script-setup `vFocus` needs no global declaration. For an app-registered directive, augment Vue's `GlobalDirectives` with its `vName` type in an included module file (`import 'vue'` or `export {}`); this describes registration, it does not register the directive at runtime. `GlobalDirectives` is exported in **3.5.44**. Consult the [directive typing example](https://vuejs.org/guide/typescript/composition-api.html#typing-global-custom-directives).

Plugins expose `install(app, options)` (or an install function) and are installed via `app.use()`. Prefer typed `app.provide` services over unexplained global properties; type-augment `ComponentCustomProperties` only when an incumbent global API requires it. Installation is per app, not a reason to keep mutable request state at module scope. See [architecture](architecture.md) and [setup/tooling](setup-tooling.md).

Complete app-scoped plugin module, with typed options and a required consumer. The caller supplies a real `format` operation; no external service or global mutable instance is fabricated.

```ts
import { inject, type InjectionKey, type Plugin } from 'vue'

export interface LabelService { format(value: string): string }
interface LabelOptions { service: LabelService }
const labelKey: InjectionKey<LabelService> = Symbol('labels')
export const labelPlugin: Plugin<[LabelOptions]> = {
  install(app, { service }) {
    app.provide(labelKey, service)
  },
}
export function useLabels(): LabelService {
  const service = inject(labelKey)
  if (!service) throw new Error('Label plugin is required')
  return service
}
```

Contextual bootstrap: `app.use(labelPlugin, { service: { format: value => value.trim() } })` before mount; call `useLabels()` in descendant setup. `app.use` deduplicates by plugin identity **per app**; a fresh plugin object is a different identity. Register components/directives with `app.component`/`app.directive` only when app-wide registration is intended. For plugin-owned resources in 3.5, register their disposer with `app.onUnmount`; SSR request completion also needs explicit ownership rather than assuming app unmount runs after `renderToString`. `app.runWithContext(() => inject(key))` permits **synchronous** app-context injection outside a component (3.3+); it does not create a component/effect lifetime or preserve context across arbitrary awaits. [Application API](https://vuejs.org/api/application.html).

For web-component interoperability, `defineCustomElement()` is separate from ordinary app mounting. Vue 3.5 supports `configureApp`, `shadowRoot: false`, style `nonce`, `useHost()`, and `useShadowRoot()` for custom elements. Configure `compilerOptions.isCustomElement` in the SFC build when consuming native custom elements so Vue does not try to resolve them as Vue components. Use an explicit attribute/property/event contract; do not assume native custom elements consume Vue slots/models identically. [Custom elements](https://vuejs.org/guide/extras/web-components.html).

## Verification boundary

The input SFC pair, generic list, progress SFC, context/plugin modules and directive SFC are complete definitions. Async and provider-consumer/bootstrap wiring explicitly marked contextual require the stated app files/placement. Historical compiler/type observations are in the [verification record](../assets/verification.json) under their original source scopes; this source audit did not rerun them, and they do not certify today's edited bytes or every runtime outcome. An implementation should verify parent-driven updates, emitted payloads, generic slot inference, model modifiers, forwarded listeners/labels, null refs, missing providers, async error/fallback behavior, cached-view deactivation, reduced motion and overlay focus. See [testing](testing.md).

## Sources

- [Vue 3.5.44 package declarations](https://unpkg.com/vue@3.5.44/dist/vue.d.ts), [SFC macros](https://vuejs.org/api/sfc-script-setup.html), [Composition helpers](https://vuejs.org/api/composition-api-helpers.html).
- [Props](https://vuejs.org/guide/components/props.html), [events](https://vuejs.org/guide/components/events.html), [component models](https://vuejs.org/guide/components/v-model.html), [slots](https://vuejs.org/guide/components/slots.html), [attrs](https://vuejs.org/guide/components/attrs.html), [provide/inject](https://vuejs.org/guide/components/provide-inject.html).
- [Vue 3.5.44 props-destructure transform](https://github.com/vuejs/core/blob/v3.5.44/packages/compiler-sfc/src/script/definePropsDestructure.ts), [props-rest getter helper](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiSetupHelpers.ts), [model compiler option separation](https://github.com/vuejs/core/blob/v3.5.44/packages/compiler-sfc/src/script/defineModel.ts), [model runtime](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/helpers/useModel.ts), [template-ref runtime](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/helpers/useTemplateRef.ts).
- [Async components](https://vuejs.org/guide/components/async.html), [Suspense](https://vuejs.org/guide/built-ins/suspense.html), [KeepAlive](https://vuejs.org/guide/built-ins/keep-alive.html), [Teleport](https://vuejs.org/guide/built-ins/teleport.html).
- [Render functions](https://vuejs.org/guide/extras/render-function.html), [directives](https://vuejs.org/guide/reusability/custom-directives.html), [plugins](https://vuejs.org/guide/reusability/plugins.html), [web components](https://vuejs.org/guide/extras/web-components.html).
- [Transitions](https://vuejs.org/guide/built-ins/transition.html), [TransitionGroup](https://vuejs.org/guide/built-ins/transition-group.html), [animation techniques](https://vuejs.org/guide/extras/animation.html), [app/plugin lifecycle](https://vuejs.org/api/application.html), [pinned runtime contracts](https://unpkg.com/@vue/runtime-core@3.5.44/dist/runtime-core.d.ts).
