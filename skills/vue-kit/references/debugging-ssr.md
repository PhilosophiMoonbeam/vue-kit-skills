# Causal Vue diagnostics, async failures and SSR

Read when Vue throws, warns, stops updating, renders the wrong subtree, leaks resources or fails hydration. This is a decision workflow, not a catalogue of warning suppressions. It covers Vue **3.5.44** and matching **@vue/compiler-sfc 3.5.44 / @vue/server-renderer 3.5.44**. Composition API with `<script setup lang="ts">` is the default; preserve an incumbent Options API or JSX boundary rather than rewriting it during diagnosis. Testing examples use the exact setup in [testing](testing.md): VTU **2.5.1**, Vitest **5.0.5**, jsdom **30.1.3**. Nuxt-specific notes describe **Nuxt 4.6.2**, not standalone Vue APIs. `<Suspense>` remains **experimental** in Vue 3.5; lazy-hydration strategies and `useTemplateRef` are 3.5+ APIs. [Vue async components](https://vuejs.org/guide/components/async), [Suspense status](https://vuejs.org/guide/built-ins/suspense).

For any Nuxt application task, [Nuxt](nuxt.md) owns the host lifecycle; use this reference for diagnosis, not a replacement bootstrap. Add [Nuxt integrations](nuxt-integrations.md) only when the failure involves the selected Pinia, Colada or Vuetify setup. The standalone renderer/hydrator fixtures below are not Nuxt entrypoints or proof of Nuxt request isolation.

## Start at the first divergent boundary

1. **Preserve evidence.** Record the reported action, route, initial data, exact warning/error and stack, runtime/package versions, server/client phase, and expected user-visible outcome. A reported failure is evidence; do not rerun merely to confirm it. Remove credentials and personal data from shared traces.
2. **Classify the earliest failure.** Compilation/import failure → tree A. State is wrong or stale → tree B. State is correct but DOM/interaction is wrong → tree C. Late work/errors/leaks → tree D. Initial server HTML differs from client → tree E.
3. **Follow one causal chain.** Input → owning state → derived value/effect → component props/slots → rendered DOM → browser behavior. Identify where the actual value first differs; do not add `nextTick`, deep watchers or random keys everywhere.
4. **Reduce while preserving the cause.** Keep the relevant plugin, renderer, route and asynchronous boundary. Removing the real overlay, provider or SSR phase can remove the defect instead of explaining it.
5. **Fix ownership or contract, then protect behavior.** Prefer a focused regression using public inputs/output. A smaller console log is not success. Verification needs authorization; clearly distinguish observed evidence, upstream guarantees and proposed checks. Examples here are proposed fixtures, not claimed passing executions.

## Tree A — compilation, resolution or application setup fails

**Does it fail before setup runs?** Inspect the first compiler/module error and its source location, not the cascade of missing-component warnings.

| Evidence / next discriminating question | Cause to inspect | Corrective direction |
| --- | --- | --- |
| Macro refers to a local value; macro declared inside a function | `defineProps` / `defineEmits` are compiler macros with top-level/hoisting restrictions | Use a top-level macro; use imported values where allowed. Do not combine runtime and type-only declarations in one macro call. |
| Complex imported props type cannot be resolved | Runtime props generation is AST-based, not arbitrary TypeScript evaluation | Simplify the public props type; supported imported types do not imply support for a conditional type describing the entire props object. Keep runtime validators explicit when needed. |
| Runtime named export inside `<script setup>` | Setup scope is component-instance scope, not a normal runtime export module | Move shared runtime exports to a normal module or an appropriate normal `<script>` block; keep setup bindings local. Type-only named exports are a separate compiler-supported case. |
| Template expression, directive argument or slot syntax fails | Templates accept expressions, not arbitrary statements; dynamic arguments have expression/HTML syntax constraints | Move statements into script; use computed argument names and valid slot syntax. `v-slot` belongs on components or `<template>`, not a native element. |
| `v-else` ignored; variable from a loop undefined in `v-if` | `v-else(-if)` must immediately follow the conditional branch; `v-if` has higher priority than `v-for` | Filter with a computed value or move condition/loop onto separate nodes. `v-show` needs a real element, not `<template>`. |
| Works as SFC but breaks in an in-DOM template | Browser parses HTML before Vue: lowercasing, self-closing tags, table nesting corrections | Use SFC/precompiled templates; for retained DOM templates use explicit closing tags, kebab-case attributes and valid HTML nesting. |
| Component resolves as an HTML tag or the wrong component | Registration scope, import/name collision, self-reference shadowed by an import | Import locally in the actual consumer. Local registration is not transitive. Alias conflicting imports. For render functions use component objects or `resolveComponent` in setup/render context. |
| Runtime-only build complains about missing compiler | A dependency supplies template strings at runtime | Precompile SFCs/render functions or deliberately use the compiler build; do not assume Vite's SFC plugin compiles arbitrary runtime strings. |
| Tool works in dev but not build/SSR | Different entry, alias, environment conditional, compiler/runtime duplication or unsupported Node engine | Compare actual resolved package tree and config. Keep Vue/compiler/server-renderer on matching releases. Inspect SSR externalization and browser-only imports before changing bundler options. |
| `require.context` fails in Vite | Webpack-specific module discovery copied into a Vite app | Use Vite's `import.meta.glob` with literal patterns and deliberate eager/lazy handling; verify generated names match consumers. See [tooling](setup-tooling.md). |

Then ask **was the application configured before mounting?** Register plugins, provides, global components and error/warn handlers on the app before `app.mount`. `mount()` returns the component public instance, not the app; keep the app variable if later access is needed. Installing the same plugin object twice does not run it twice. An augmentation of `ComponentCustomProperties` gives TypeScript a declaration, not a runtime value. Put module augmentations in a module (with an import/export), preserve the original module declarations, and separately install the plugin. Prefer typed provide/inject for setup consumers over invisible global properties. [Application API](https://vuejs.org/api/application), [script setup restrictions](https://vuejs.org/api/sfc-script-setup), [TypeScript Composition API](https://vuejs.org/guide/typescript/composition-api).

For type-only failures, separate a real runtime contract from tooling disagreement. An absent Boolean prop is normally cast to `false`; use an explicit `default: undefined` when absence must remain distinguishable. Type DOM handlers as `Event`/the actual event type and narrow `event.target` before accessing input-specific fields. Keep template refs nullable through mount/removal; for component refs expose and type the intended public interface instead of casting to `any`. Prefer inference for `reactive()` because its deep ref unwrapping can differ from a supplied generic type. A union expression needs valid narrowing, not a cast that hides a reachable null branch. Compare the same Vue language-tools/TypeScript configuration in editor and command line; an editor warning disappearing is not proof the runtime changed.

### A1. Resolve syntax and registration without replacing the toolchain

- Dynamic directive arguments must evaluate to a **string or `null`** (`null` removes the binding); move spaces/quotes/complex expressions into a computed name. In-DOM HTML lowercases attribute names, including dynamic-argument identifiers.
- In a retained in-DOM table, use a valid native position such as `<tr is="vue:row-view">`; `vue:` distinguishes Vue replacement from native customized built-ins. Use explicit closing tags and kebab-case component/prop names. Text inside `<script type="text/x-template">` is raw script text, not ordinary parsed child markup; do not apply a blanket browser-reparenting claim to that container. Never compile untrusted template text.
- An SFC named `TreeNode.vue` can reference `<TreeNode>` recursively; an imported binding with that name wins, so alias the import. Keep a terminating data/conditional boundary. Ordinary local registration wins over app-global registration in that consumer; avoid ambiguous library names rather than casing tricks.
- A normal `<script>` may contain named exports; **`<script setup>` may not contain module exports**. Prefer separate modules for reusable utilities; a normal script can hold module-level exports alongside setup. For plugin augmentations, ensure the declaration file is included by `tsconfig`, contains an import or `export {}`, and that the runtime plugin installs its value before consumers mount.
- Interpolation/binding values are expressions, but `v-on` supports inline handlers/statements; do not ban event assignments. `v-show` has no `v-else` pairing; use inverse visibility conditions or a real `v-if`/`v-else` branch.

[Dynamic arguments](https://vuejs.org/guide/essentials/template-syntax#dynamic-arguments), [in-DOM parsing](https://vuejs.org/guide/essentials/component-basics#in-dom-template-parsing-caveats), [normal/setup script](https://vuejs.org/api/sfc-script-setup#usage-alongside-normal-script), [event handlers](https://vuejs.org/guide/essentials/event-handling#inline-handlers).

For an incumbent plugin's global property, audit the runtime key and installation order for collisions; a component's own property has priority over `app.config.globalProperties`. Setup has no component `this`: prefer the plugin's public typed injection/composable rather than internal-instance lookup. Retain a documented `$`-prefixed Options API/template property when it is a real incumbent contract, and supply both surfaces only when the plugin intentionally supports both. Type augmentation alone implements neither surface.

In `<script setup lang="ts">`, template `(value as SpecificType)` assertions are valid when an external invariant actually establishes that type; a discriminant, `typeof`, guard or computed projection is safer for a genuinely variable union. Do not cast away a reachable null/alternate variant. For a single DOM ref use `const input = useTemplateRef<HTMLInputElement>('title-input')` with template `ref="title-input"`; argument and template string must match, while the variable name need not. Language tools can infer static ref types, but the value remains nullable before mount/after removal.

## Tree B — state is stale, unexpectedly shared or recursively updating

### B1. Did the consumer actually read a reactive source?

| Observation | Next check | Repair the real dependency |
| --- | --- | --- |
| A ref shows its wrapper or never changes | Script access versus template unwrapping | Use `.value` in script. Template unwrapping is not recursive magic: refs in reactive arrays/Maps need explicit `.value`; expression-level top-level unwrapping differs from nested objects. |
| A destructured primitive stops tracking | Was it copied from `reactive`, store state or props? | Retain property access/getters or `toRefs`/store-specific refs. Vue 3.5 compiler-reactive destructured props work in the same compiled setup scope; passing a destructured value still passes a value, not a getter. |
| Watcher does not fire | Was `watch(state.count, ...)` passed a number? Was only a nested field mutated? | Watch a getter/ref or the intended object. Use deliberate depth, not `deep: true` as a universal fix. Vue 3.5 supports numeric `deep`. |
| Async `watchEffect` misses a dependency | Was the reactive read after the first `await`? | Read dependencies synchronously or use explicit `watch` sources. A promise continuation does not extend dependency tracking. |
| A composable input never refreshes | Was a getter/ref normalized once outside an effect? | Normalize with `toValue` inside the owning watch/effect, or watch the getter/ref directly. See [composables](composables.md). |
| Parent updates but injected child does not | Was a snapshot primitive provided? Is the consumer below the right provider? | Provide the intended ref/reactive object under the same typed key; injection does not make an ordinary value reactive. Use a factory for independently owned mutable default objects. |
| State crosses instances or SSR users | Was mutable state/default created at module scope? | Move it to the intended component/app/request factory. `withDefaults` array/object defaults need factories; Vue 3.5 destructure defaults are per-instance expressions. See [state](state.md). |
| Raw and reactive objects compare unequal | Does identity cross a proxy boundary? | Compare stable domain IDs. Use `markRaw`/`shallowRef` for deliberately nonreactive third-party instances, not as a blanket warning silencer. Do not store component definitions in deep-reactive containers unnecessarily. |

### B2. Is the derived state pure and the effect bounded?

- A computed getter must derive from reactive reads, not fetch, mutate state, emit or manipulate DOM. Conditional dependencies are valid: only dependencies read during its last evaluation are tracked. A clock read such as `Date.now()` is not reactive by itself.
- A computed value is derived output. Do not mutate its returned object/array as if it owned source state. `sort` and `reverse` mutate their receiver; derive a new sequence when the source order must remain unchanged. Do not add parameters to a computed getter; use a function or a computed lookup depending on the contract.
- A watcher seeing equal old/new objects after a nested mutation is not proof it failed: both arguments can be the same reactive object. Observe a meaningful primitive projection, immutable replacement or application-owned snapshot if a diff is required.
- Multiple writes in one tick are normally batched. Do not demand a render for every intermediate write. `flush: 'sync'` removes batching and can be expensive; it is not a general reactivity repair. Use a post-flush watcher for DOM reads after the owner's patch.
- A render/template function, computed getter, watcher or `onUpdated` hook that writes what it reads can create recursive updates. Remove that feedback loop; do not catch the recursion warning. Do not mutate component state from `onUpdated` to force another render.
- Unexpected extra work: first inspect stable primitive props, fresh object/function props and computed objects returned with new identity. Only then profile or use development-only `onRenderTracked` / `onRenderTriggered` or computed `onTrack` / `onTrigger`. These hooks are diagnostics, not production monitoring and not SSR hooks. A trigger is not evidence that a DOM mutation happened.

Composition setup runs once per component instance, not once per render like a React function component. Keep state persistent in refs; do not rebuild it to emulate a render closure or apply React hook dependency arrays. [Watchers](https://vuejs.org/guide/essentials/watchers), [reactivity in depth](https://vuejs.org/guide/extras/reactivity-in-depth), [lifecycle diagnostics](https://vuejs.org/api/composition-api-lifecycle).

### B3. Trace invisible ownership and unnecessary updates

1. For a missing/wrong injection, locate the **same exported key object**, then walk from the consumer toward ancestors: the nearest matching provider shadows farther providers; app-level provide is the fallback scope. Two `Symbol('selection')` calls are not the same key. Document provider, lifetime, readonly state and mutation actions next to a descriptive `InjectionKey`. A required missing provider should fail clearly, not create a second store.
2. For an intentionally optional object default, use `inject(key, () => ({ items: [] }), true)`; the third argument makes it a factory. A fresh inline object literal per setup call is already distinct: the actual sharing hazard is a reused module-level/default object. Factories also avoid constructing unused expensive defaults. Injected refs remain refs in script; Options API providers can expose `computed(() => this.value)` to retain reactivity.
3. A composable may intentionally inject a dependency, mutate owned state or manage DOM effects. Name it `use…`, document effects/cleanup, and return a plain object of refs/actions for destructuring consumers. Do not ban injection/DOM work categorically or assume the name supplies setup context. Plain `let` setup bindings are not reactive. Mutable reactive state is valid; immutable replacement is useful at an explicit boundary, not universally required.
4. Conditional composable calls during synchronous setup are not subject to React's hook-order rule; ensure each effect has the correct owner. Top-level SFC await restoration does not restore context in arbitrary promise callbacks. `defineExpose` still precedes await because parent ref publication is a separate timing contract, not because the compiler fails to restore all instance context.
5. A conditional computed tracks its evaluated branch. Change the branch condition to exercise other dependencies; do not read every branch just to manufacture subscriptions. A computed returning a function caches that function, not arbitrary calls by argument. A writable computed translates assignments into source changes; returned objects are **not automatically deeply readonly**.
6. Temporarily use `onRenderTracked`/`onRenderTriggered`, or `onTrack`/`onTrigger` on `computed`, `watch` or `watchEffect`. Inspect debugger-event `target`, `key`, operation `type` and old/new values at a breakpoint. Do not serialize sensitive/cyclic targets or mutate them from callbacks. Remove instrumentation after localization; it is not production/SSR observability.
7. Reduce row input from shared `activeId` to `:active="row.id === activeId"` if the row only needs that boolean. For computed object stability, fully compute/read dependencies **before** comparing with the prior result and reusing its identity. Do not deep-compare large objects each render without evidence of a gain.
8. `markRaw` opts out only its root: nested objects later inserted into reactive graphs may acquire proxies. Use `toRaw` temporarily, not as a second persistent mutable identity. Stable IDs suit business comparisons; comparing the same stable proxy is valid. Renders/default watchers batch synchronous writes, not state assignment itself: an explicit computed read between writes can observe an intermediate value.

[Injection lookup/defaults](https://vuejs.org/guide/components/provide-inject), [composable conventions](https://vuejs.org/guide/reusability/composables), [computed stability](https://vuejs.org/guide/best-practices/performance#computed-stability), [raw/proxy hazards](https://vuejs.org/api/reactivity-advanced#markraw), [debugger events](https://vuejs.org/guide/extras/reactivity-in-depth#reactivity-debugging).

## Tree C — state is correct, rendered behavior is wrong

### C1. Follow the component's public contract

| Visible failure | Discriminating check | Corrective direction |
| --- | --- | --- |
| Child prop or loop item undefined | Was the value passed explicitly? Does the child prop name match? | `v-for` does not implicitly pass the item to a component. Guard nullable data before accessing its fields, not after the failing expression. |
| Parent and child `v-model` disagree | Was only a nested object mutated? Was a child-only default created while the parent starts undefined? | Emit replacement/model updates intentionally. `defineModel` default values can desynchronize an undefined parent. See [forms](forms.md). |
| Native click stops or fires twice | Is `click` declared in emits? Does the child emit and also fall through a native listener? | A declared component event listens to the component emission, not automatically to its native root. Declare the contract and forward/emit exactly once; do not remove event declarations to mask the defect. |
| Wrapper label/class/listener lands on outer container or disappears | Single root versus fragment? `inheritAttrs`? Explicit binding order? | Use `defineOptions({ inheritAttrs: false })` and bind `$attrs` to the intended element. Multi-root components need explicit forwarding. Class/style and event merging differ from ordinary attribute overwrite. |
| Explicit attribute is overwritten or two handlers run | Compare `v-bind` placement and listener merging | Decide which side owns the attribute; do not forward the same listener twice. Consumed props and declared emits are not ordinary fallthrough attrs. `useAttrs` is current but not a reactive watch source. |
| Slot reads undefined child state | Is the slot expression owned by the parent or supplied slot props? | Slots use the parent's lexical scope; child state must be passed as named slot props. `name` selects a slot and is not an ordinary forwarded slot prop. |
| Named/scoped content missing in a wrapper | Is explicit `#default` needed? Were all relevant slot functions forwarded? | Preserve slot names and scoped arguments deliberately; do not assume forwarding the default slot forwards named slots. In render functions pass slots as functions. |
| Render function is static or repeats a vnode incorrectly | Is `h()` called in the returned render closure? Are vnode objects reused? | Import `h` from Vue 3, read reactive values inside render, create unique vnodes per rendered position. Avoid vnode internals. |

For forms, distinguish Vue model state from HTML attributes. `v-model` treats JavaScript state as authoritative; textarea interpolation is not its model. A number modifier can still yield an empty string or an unparseable string; do not coerce an empty required field into zero. IME composition intentionally delays normal model updates; use actual composition/browser evidence before overriding it. Initial select state should correspond to an option; a disabled empty option makes the unselected state explicit. Checkbox `true-value`/`false-value` is a Vue model contract, not native form serialization. Modifier order matters (`prevent`/`self`), `.passive` cannot cancel default behavior, `.exact` controls extra system modifiers, and keyup system modifiers depend on which key remains pressed. See [forms](forms.md) for ownership, [components](components.md) for attrs/slots.

#### C1a. Discriminate native input and listener failures

| Contract | Concrete repair and regression boundary |
| --- | --- |
| Declared emits | Type payloads; a runtime emits validator returning `false` warns but does **not** block delivery. Omitting an emits declaration does not universally warn: inspect the actual declaration/message. Component events do not bubble through arbitrary ancestors. Undeclared re-emitted native click plus root fallthrough can deliver twice. |
| Merged native handlers | `stopPropagation()` stops DOM propagation, not another merged handler on the **same element**. Control forwarding/emission instead. With `inheritAttrs: false`, bind `$attrs` before an explicit attribute when the explicit value must win; class/style/listeners merge differently from ordinary overwrite. |
| Modifier order | `@click.prevent.self` cancels default even for a child-originated click; `@click.self.prevent` rejects that child click first. Exercise element and child. Never combine `.passive.prevent`. |
| Precise shortcuts | `@keydown.ctrl.enter.exact` rejects Alt/Shift/Meta additions; `@click.exact` requires no system modifiers. `@keyup.ctrl.enter` requires Ctrl still held when Enter is released. Prefer keydown if that matches the shortcut; account for repeat/IME and editable controls. Exercise key press **and release** order in a browser. |
| Native serialization | Unchecked checkboxes are absent from `FormData`; `false-value` does not submit a value. For exactly one of two native values use radios, or deliberately construct a payload from model state. Do not add a same-name hidden field without defining duplicate-key handling. |
| Numeric input | `.number` uses `parseFloat`: a parseable prefix can become a number, a nonparseable string stays a string, and cleared input stays `''`; it is not `valueAsNumber`. Validate grammar/range at submission. `type="number"` applies conversion automatically, but browser sanitization still affects observed values. |
| Select/textarea/IME | Initialize model state, not HTML defaults. Use `<textarea v-model="text">`. For an empty select use model `''` with `<option disabled value="">Choose…</option>` to avoid iOS's first-option change trap. If composition-time drafts are required, use `:value` plus an `input` listener deliberately and separate draft updates from committed validation/submission; otherwise preserve composition deferral. |
| Object `defineModel` | Nested mutation may change the parent's shared reactive object **without** emitting `update:modelValue`; lack of an event does not prove unchanged parent state. Assign a replacement including the changed nested path for an event-driven model; initialize the authoritative value in the parent. Do not emit a child default on mount to disguise an undefined-parent contract. |

[Events/validation](https://vuejs.org/guide/components/events), [fallthrough](https://vuejs.org/guide/components/attrs), [modifiers](https://vuejs.org/guide/essentials/event-handling), [native forms](https://vuejs.org/guide/essentials/forms).

### C2. Separate identity, DOM availability and style ancestry

1. **Wrong row retains focus/state after reorder?** Use a stable unique primitive key describing domain identity, not position. Put the key on the actual repeated node or keyed `<template>`. Range loops start at one. Preserve the source order when computing filtered/reversed views.
2. **Ref is null?** Distinguish before mount, `v-if` removal and unresolved async content. KeepAlive deactivation retains a cached instance; it does **not** itself promise to clear its template refs. Null-check refs and synchronize with the actual owner's mount/activation state. `onMounted` includes synchronous children, not every async descendant. `v-show` hides an existing element; `v-if` removes it.
3. **Parent cannot access child setup bindings?** `<script setup>` is private by default. Prefer props/events; expose only a necessary imperative public API with `defineExpose` **before** an await. Do not expose private state solely for tests.
4. **Loop ref points to the wrong item?** Vue **supports `useTemplateRef` inside `v-for` in 3.5+**, but its ref array **does not guarantee source-array order**. Neither stable keys nor a `nextTick` establishes index equivalence. Associate elements by domain ID using function refs or explicit data attributes; delete entries when the callback receives null. Do not switch to the old array-ref API expecting an ordering guarantee. [Official ref contract](https://vuejs.org/guide/essentials/template-refs#refs-inside-v-for).
5. **Teleport content missing?** Confirm the target exists when Teleport resolves it. Vue 3.5 `defer` can resolve a later target in the **same mount/update tick**, not an element arriving arbitrarily later. Separate logical ownership from physical DOM ancestry. Inspect the dedicated target and connected DOM, not only the local wrapper.
6. **CSS missing?** Scoped CSS works by adding scope attributes to owned elements. Teleport does not generally strip those attributes; ancestor selectors and inherited CSS variables can fail after the physical move. Inspect the actual selector, scope attribute, inheritance and stylesheet loading before widening styles globally. `:deep` crosses component scoping, not a missing DOM ancestor. Child roots, slotted content (`:slotted`) and `v-html` content have different ownership. Dynamic utility-class strings may be absent from a utility CSS compiler's output; map to complete static classes rather than blaming Vue rendering. [Scoped CSS](https://vuejs.org/api/sfc-css-features), [Teleport](https://vuejs.org/guide/built-ins/teleport).

Inspect exact selectors before disabling scoping: `.frame :deep(.child-part)` targets child internals; `.frame :deep(.rich-text)` can target trusted/sanitized `v-html` descendants; `:slotted(.item)` targets consumer slot content. A child's root can receive both parent and child scope attributes. Teleported `.dialog` can retain its scope attribute while `.page .dialog` no longer matches. For dynamic colors use CSS custom properties/inline values or complete static utility-class tokens; a string like `` `bg-${color}-500` `` does not generate all possible classes. Check the incumbent Tailwind release before prescribing version-specific safelist syntax.

Loose top-level slot content normally supplies default content. When mixing named and scoped default slots, use explicit `<template #default="slotProps">` alongside `<template #footer>`. Forward names and scoped arguments; a transparent render wrapper can pass received slots as `h(Child, props, slots)`. Use `resolveComponent` during setup/render for registered string names, and `resolveDynamicComponent` for dynamic resolution. Limit vnode inspection to documented `type`, `props`, `children`, `key`; use template refs for DOM, not `el`, `component` or patch flags. [Slots](https://vuejs.org/guide/components/slots), [render functions](https://vuejs.org/guide/extras/render-function).

### Complete identity-based focus regression

This fixture has no ref-array positional assumption. It demonstrates focus selection, not a complete editable-list product. The test uses real attached DOM; layout/tab-order still need a browser.

```vue
<!-- src/IdentityFocus.vue -->
<script setup lang="ts">
import { nextTick, ref, useId, type ComponentPublicInstance } from 'vue'

const prefix = useId()
const rows = ref([
  { id: 'alpha', title: 'Alpha' },
  { id: 'beta', title: 'Beta' },
])
const inputs = new Map<string, HTMLInputElement>()

function setInput(id: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLInputElement) inputs.set(id, element)
  else inputs.delete(id)
}

async function focusAlpha() {
  await nextTick()
  inputs.get('alpha')?.focus()
}
</script>

<template>
  <button @click="rows = [...rows].reverse()">Reverse order</button>
  <button @click="focusAlpha">Focus Alpha</button>
  <div v-for="row in rows" :key="row.id">
    <label :for="`${prefix}-${row.id}`">{{ row.title }}</label>
    <input
      :id="`${prefix}-${row.id}`"
      :ref="element => setInput(row.id, element)"
      :data-row-id="row.id"
      :value="row.title"
    />
  </div>
</template>
```

```ts
// src/IdentityFocus.spec.ts
import { disableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { expect, test } from 'vitest'
import IdentityFocus from './IdentityFocus.vue'

disableAutoUnmount()

test('focus follows Alpha identity after reversing the visible rows', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const wrapper = mount(IdentityFocus, { attachTo: host })
  try {
    await wrapper.get('button:first-of-type').trigger('click')
    expect(wrapper.findAll('label').map(label => label.text())).toEqual(['Beta', 'Alpha'])
    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('input[data-row-id="alpha"]').element)
  } finally {
    wrapper.unmount()
    host.remove()
  }
})
```

This isolated test file disables the shared setup's auto-unmount because its `finally` owns wrapper/host cleanup; otherwise VTU 2.5.1 attempts a second unmount. It checks DOM order and focus, not the internal Map or callback invocation order. Another identity-safe implementation can preserve the same consumer contract. See [teardown ownership](testing.md#minimal-deterministic-unit-setup).

### C3. Motion and caching change lifetime

If a transition never completes, inspect CSS detection and JavaScript completion ownership. With `:css="false"`, call the supplied `done` callback when the animation finishes; cancel owned animation work on interruption. If CSS transitions and animations coexist, specify the intended `type`; nested animations may require explicit duration accounting for delay. A reused node may need a meaningful key to transition between distinct content, but adding a random key destroys state rather than fixing identity.

For `TransitionGroup`, children need stable keys; Vue 3 has no default wrapping element. Move transitions require transformable elements; ordinary inline elements do not behave like block/inline-block boxes for FLIP. Removing a leaving item from normal flow can permit remaining items to move, but confirm positioning and container geometry in a browser. Scoped CSS on a reusable transition wrapper must target the actual rendered descendants, not a fictional wrapper DOM node. See [motion](motion.md).

For `KeepAlive`, deactivation is not unmount. Pause visibility-bound subscriptions/animations on deactivation, resume once on activation, and release on final unmount. Inspect route depth, cache include/exclude, component names and key identity before diagnosing a double mount as a Vue bug. Router readiness can explain first-render animation; await initial navigation when that is the intended transition contract. `onUnmounted` is not a timer for the end of every CSS animation: state removal, transition leave completion, cancellation and cached deactivation are different events. Do not assume every rapid swap runs the same hook path. See [routing](routing.md).

#### C3a. Separate a cache from a leak

Record instance identity, route depth/key and mounted/activated/deactivated/unmounted events for an affected navigation. Retaining cached instances is expected; activations are not mounts. KeepAlive caches the rendered component from the RouterView slot, not RouterView infrastructure. Compare stable leaf keys with query/fullPath keys that intentionally create separate cache entries. Set `max` for the bounded working set and inspect eviction/final cleanup; do not flatten routes or add initialization guards just to hide duplicate ownership.

For an async-ref reactivation failure, wait for the loader and activation patch, null-check the public ref, and exercise activate → deactivate → reactivate using the same definition/key. The 3.5.44 wrapper forwards its ref to the resolved inner vnode; an old issue link does not prove every current combination is broken. Prefer props/events or a shared capability if no imperative API is needed. For retained memory, compare heap snapshots after repeated navigation **and eviction/unmount**, inspect retaining paths/external listeners, and distinguish intended cache/transition retention from abandoned instances. These are proposed diagnostics, not a claim of a known unfixed 3.5.44 leak.

For TransitionGroup lag, profile scripting/layout/style on representative hardware; reduce animated rows or skip bulk-operation motion, and [virtualize](virtualization.md) genuinely large lists. A historical Vue 2 issue/arbitrary 100-row cutoff proves neither a Vue 3.5 defect nor a CSS-framework cause. Move classes need a transform transition; use `tag="ul"` for a required semantic/layout wrapper, transformable children, and a positioned containing block for absolute leaving items. Nested duration includes the deepest relevant delay plus duration. `content-visibility` does not replace measuring animated geometry.

Rapid replacement does not make unmount cleanup generally unreliable. Separate leave completion/cancellation from scope disposal; use `onBeforeUnmount` for cleanup needing live DOM, `onUnmounted`/scope cleanup for resource release, and deactivation for visibility-bound pause. A JavaScript transition hook accepting `done` owns completion: omitting it can leave the transition pending; `:css="false"` alone does not require a synchronous hook to accept a callback. [KeepAlive](https://vuejs.org/guide/built-ins/keep-alive), [RouterView slot](https://router.vuejs.org/guide/advanced/router-view-slot), [TransitionGroup](https://vuejs.org/guide/built-ins/transition-group), [3.5.44 async ref forwarding](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiAsyncComponent.ts).

The 3.5.44 renderer calls before-unmount hooks, stops the component effect scope and queues unmounted hooks independently of a transition's visual completion; its transition implementation uses callback arity to decide explicit completion ownership. These source-level facts do not exclude every possible reproduction-specific bug. [Exact unmount path](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/renderer.ts), [exact transition hooks](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/components/BaseTransition.ts).

## Tree D — async failures, warnings and resource leaks

### D1. Who owns the work and the error?

- Register lifecycle hooks, provide/inject and scope-bound composables synchronously during setup. Arbitrary async callbacks do not inherit setup context. The SFC compiler preserves context around **top-level `await` in `<script setup>`**; this exception does not make all async functions safe places to register hooks.
- Synchronously created setup watchers stop with the component. A watcher created later in a timer/async callback may need explicit disposal. Track one owner for each timer, event listener, observer, subscription, request and third-party instance. Cleanup belongs to that owner; recreating a component must not duplicate resources.
- For overlapping requests, invalidate stale work. Register `onWatcherCleanup` synchronously before awaiting (Vue 3.5+) or use the watch callback's `onCleanup` argument with the correct lifetime. Abort only when the adapter supports it and prevent stale completion from publishing even if cancellation is advisory. A canceled old request must not overwrite the current error/loading state. See [remote-data ownership](architecture-data.md) and [composables](composables.md).
- `defineAsyncComponent` loading delay, timeout, loader rejection and render failure are separate cases. Under a parent Suspense, the boundary controls pending state; a suspensible wrapper skips its own `loadingComponent`, `delay` and `timeout` machinery. In **3.5.44**, its rejection path still reports the loader error and can render its configured `errorComponent`; that is not a built-in Suspense error slot or a catch for arbitrary descendant failures. Set `suspensible: false` only when the wrapper should own client pending UI. A route loader `() => import(...)` is a different API. [Exact wrapper branches](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiAsyncComponent.ts#L183-L201).
- Suspense coordinates pending content; it has no built-in error slot/handler. Capture descendant async/setup/render failures in a parent `onErrorCaptured` boundary and show a replacement subtree. Do not render the same throwing content in the fallback loop. A failed dynamic chunk can be a deployment/CDN/version-skew problem; inspect the actual request/status/MIME and build manifest before changing Vue timing.

#### D1a. Make loader recovery terminate

Keep a stable `defineAsyncComponent` definition outside render closures. Configure `loadingComponent`, `errorComponent`, `delay` (default 200 ms) and a product-appropriate `timeout` when the wrapper owns pending UI. `errorComponent` receives an `error` prop; timeout displays an error but is **not cancellation** of the import. Assert loading before settling the loader and failure after rejection; do not catch an unavailable required feature and return an unrelated component.

The callback is `onError(error, retry, fail, attempts)`, with attempts starting at **1**. Every recovery decision must eventually call `retry()` or `fail()`; calling neither leaves the promise pending, including during SSR. Bound retries to an identified transient failure; a missing deployed chunk/MIME mismatch needs deployment diagnosis, not infinite retries. Parent Suspense governs pending UI for a suspensible wrapper; SSR awaits its loader even with `suspensible: false`. Client delay/timeout timers are not an SSR deadline: enforce server-request deadlines in the actual renderer/transport owner. [Exact 3.5.44 implementation](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiAsyncComponent.ts), [async options](https://vuejs.org/guide/components/async#loading-and-error-states).

### D2. Preserve diagnostics while offering usable recovery

Vue's `onErrorCaptured` handles descendant render/setup/watch/lifecycle/event/directive/transition errors. It does not catch every detached promise, browser error, request rejection or hydration warning. Catch an expected service failure where its user-visible state is owned. An app-level `app.config.errorHandler` receives otherwise propagated Vue errors; production `info` may be an error code. `app.config.warnHandler` is a development diagnostic hook, not a fix and not a production warning monitor. [Error propagation](https://vuejs.org/api/composition-api-lifecycle#onerrorcaptured), [application handlers](https://vuejs.org/api/application#app-config-errorhandler).

Complete reusable boundary (`src/ErrorBoundary.vue`); no external reporting service is invented. It permits normal propagation to an app handler because it does not return `false`.

```vue
<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'

const failed = ref(false)
const generation = ref(0)

onErrorCaptured(() => {
  failed.value = true
})

function retry() {
  generation.value += 1
  failed.value = false
}
</script>

<template>
  <section v-if="failed" aria-label="Unavailable section">
    <p role="alert">This section could not be displayed.</p>
    <button type="button" @click="retry">Try this section again</button>
  </section>
  <div v-else :key="generation"><slot /></div>
</template>
```

The retry remounts this section; it does not guarantee a failed transport will recover or preserve unsaved child state. Adopt that behavior only when appropriate. Returning `false` from `onErrorCaptured` deliberately stops propagation to further boundaries and `app.config.errorHandler`; do so only when the error has actually been handled under an explicit reporting policy. Never return `false` just to quiet a test.

This is a **client recovery boundary**, not a server response policy. In 3.5.44, `onErrorCaptured` also registers during SSR, but changing `failed` after a descendant fails does not restart an already-rendering parent to produce its fallback HTML. The standalone request owner must handle renderer rejection/reported errors and choose the HTTP status/body; a logged error or resolved HTML string is not proof of a successful response. Exercise the actual failing server route and its first client render separately; in Nuxt retain the framework's error-page/response handling. [Exact lifecycle registration](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiLifecycle.ts), [exact server rendering path](https://github.com/vuejs/core/blob/v3.5.44/packages/server-renderer/src/render.ts).

For warnings, retain the full message/component trace and fix the broken contract: missing injection, prop mismatch, undeclared event, non-prop attrs, invalid child or duplicate key. A narrowly scoped warning assertion can document a known integration limitation; a global `console.warn`/`console.error` no-op or blank app handler conceals unrelated defects. Clear temporary diagnostic hooks after localization; do not mutate state from tracking/trigger callbacks.

## Tree E — SSR, hydration or first-load-only failure

### E1. Establish which renderer owns the page

- **SPA:** `createApp` mounts client-rendered DOM. A static Vite preview of an SPA is not an SSR test.
- **Standalone Vue SSR:** create fresh app/router/store/query state **per request**, render with `renderToString`, safely transfer only intended public state, then instantiate the matching client app with `createSSRApp` and hydrate the same initial state. Standalone Vue does not provide `<ClientOnly>`, Nuxt payloads, Nitro, auto-imported composables or route middleware.
- **Nuxt 4.6.2:** follow [Nuxt's host and request/data ownership](nuxt.md) rather than adding a second manual `createSSRApp`/router or copying standalone factories. For selected SDK/module setup use [Nuxt integrations](nuxt-integrations.md); for hydration/head use the [core host contract](nuxt.md#ssr-hydration-and-head). `<ClientOnly>` is a Nuxt component; its default slot is tree-shaken from the server build and its CSS may not be inlined initially. Use it for intentionally client-only content, not as blanket hydration repair. [Nuxt ClientOnly](https://nuxt.com/docs/4.x/api/components/client-only).

SSR setup does run; mounted/updated/unmounted hooks do not run on the server. Browser-only imports can fail **before** an `onMounted` guard executes: move the import itself behind the appropriate client boundary when needed. Do not start server timers in setup expecting unmount cleanup. For SSR data use the framework's request-aware path or Vue's `onServerPrefetch` in a deliberately designed standalone renderer. A shared mutable module singleton can leak one user's state into another request; resetting it between requests is not safe under concurrency. See [state](state.md), [head/localization](i18n-head.md) and [remote-data architecture](architecture-data.md).

Keep server-only modules (`fs`, database clients, private environment secrets) out of client bundles as carefully as browser-only modules out of server execution. `typeof window` can guard a read, but different first-render markup still needs a hydration contract; use the incumbent framework's client/server entry conventions rather than copying obsolete Nuxt `process.client` examples into standalone Vue. Installing Pinia alone does not create request isolation: instantiate it per request and hydrate only that request's public state.

### E2. Compare three things, not only two

Capture the **server HTML**, the **browser-parsed DOM before hydration**, and the **first client render inputs**. A mismatch can arise from parsing before Vue executes. Follow this order:

| First difference | Likely cause | Corrective direction and verification |
| --- | --- | --- |
| HTML changes during parsing | Invalid nesting, implicit table elements, duplicate IDs | Produce valid HTML. A string snapshot alone cannot expose parser correction; inspect parsed DOM in a browser. |
| First client data differs | Random values, current time, timezone/locale, storage/theme/media state, unsynchronized request data | Transfer a stable initial value/seed or render a deterministic initial state and enhance after mount. Use `useId` for matching app-local IDs, not independent random IDs. |
| Server contains another user's state | App/store/cache at module scope; unsafe response caching | Create request-local instances and scoped cache keys. Test concurrent distinguishable users, not only sequential renders. |
| Only teleported subtree differs | Target markup missing, target location/order wrong | Insert `ssrContext.teleports[target]` into a dedicated target in the server shell. Avoid SSR teleport to `body`; it contains unrelated server content. |
| Async subtree differs | Different payload, loader/manifest skew, incompatible pending/resolved shape | Align transferred data and chunks. Suspense is not a universal hydration repair; adding more boundaries does not guarantee correctness. |
| Only a directive-owned attribute differs | DOM-only directive with no server representation | Supply appropriate `getSSRProps` or defer a truly client-only enhancement; do not assume a mounted hook runs during SSR. |
| Initial HTML matches but interaction fails | Client script failed, hydration not yet scheduled, listener/async chunk failure | Inspect script/network errors and actual hydration strategy. Lazy hydration delays activation; it is not absent SSR. |

Vue attempts to recover from many mismatches by adjusting DOM; that can discard nodes and cost work. Recovery is not evidence the original contract is correct. Hydration diagnostics may be warnings, not exceptions: matching an error message in `onErrorCaptured` and returning `false` is not a reliable repair. `data-allow-mismatch` (3.5+) is only for a narrowly understood unavoidable difference; it does not fix request-state leakage, target placement, invalid HTML or missing events. Prefer matching initial output. [SSR guide](https://vuejs.org/guide/scaling-up/ssr#hydration-mismatch), [SSR mismatch attribute](https://vuejs.org/api/ssr#data-allow-mismatch).

### Complete renderer-and-hydration regression fixture

Add the matching renderer when adopting this fixture:

```sh
bun add --dev --exact @vue/server-renderer@3.5.44
```

`src/hydration.spec.ts` below uses render functions so it does not depend on a runtime template compiler. The factory owns a separate state per app. Server output is inserted only as trusted local fixture output; this is **not** a production serialization or HTTP-server implementation.

```ts
import { renderToString } from '@vue/server-renderer'
import { DOMWrapper } from '@vue/test-utils'
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { expect, test, vi } from 'vitest'

function createCounterApp(initial: number) {
  return createSSRApp(defineComponent({
    setup() {
      const count = ref(initial)
      return () => h('button', {
        type: 'button',
        onClick: () => { count.value += 1 },
      }, `Count: ${count.value}`)
    },
  }))
}

test('matching server state hydrates without replacing the button and becomes interactive', async () => {
  const serverApp = createCounterApp(2)
  const html = await renderToString(serverApp)
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const originalButton = host.querySelector('button')
  const clientApp = createCounterApp(2)
  const warn = vi.spyOn(console, 'warn')
  const error = vi.spyOn(console, 'error')
  let mounted = false
  try {
    clientApp.mount(host)
    mounted = true
    expect(host.querySelector('button')).toBe(originalButton)
    const dom = new DOMWrapper(host)
    expect(dom.get('button').text()).toBe('Count: 2')
    await dom.get('button').trigger('click')
    expect(dom.get('button').text()).toBe('Count: 3')
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  } finally {
    if (mounted) clientApp.unmount()
    host.remove()
    warn.mockRestore()
    error.mockRestore()
  }
})

test('independent server apps do not share initial user state', async () => {
  const [first, second] = await Promise.all([
    renderToString(createCounterApp(1)),
    renderToString(createCounterApp(9)),
  ])
  expect(first).toContain('Count: 1')
  expect(first).not.toContain('Count: 9')
  expect(second).toContain('Count: 9')
  expect(second).not.toContain('Count: 1')
})
```

The spies preserve console behavior; the assertions fail on unexpected diagnostics instead of suppressing them. This fixture checks a deterministic local renderer/hydrator pair and request-local factory shape. It does **not** verify a real HTTP response, secure payload serialization, production manifests, Suspense streaming, Teleport injection, Nuxt request isolation or cross-browser parsing. Those require targeted integration/browser tests against the actual SSR server. In production, use the framework's safe state serializer: blindly interpolating `JSON.stringify(userData)` into a script tag can introduce script-breaking/XSS payloads.

The two counter renders contain no controlled asynchronous data boundary. `Promise.all` starts both renders but does not establish that request-specific work actually interleaved. To protect a production request-isolation regression, hold two distinguishable users' real data dependencies pending, overlap their requests, release them in reverse order, and assert each response/payload and hydrated UI contains only its own authorized state. Include request-aware stores, service clients and response caches that the application actually uses.

### Teleport and lazy hydration boundaries

For standalone SSR Teleport, `renderToString(app, context)` places teleported HTML in `context.teleports`, not the main app HTML. An explicit server shell must insert each approved target's markup at the correct dedicated container; use request-local context and do not infer target contents from the client. If the content truly need not be server-rendered, a mounted-state condition can intentionally delay it on both the initial server and initial client render. That changes time-to-content and accessibility; it is a product decision, not equivalent SSR support.

Vue 3.5 async-component hydration strategies (`hydrateOnIdle`, `hydrateOnVisible`, `hydrateOnMediaQuery`, `hydrateOnInteraction`) control **when existing server HTML becomes interactive**. Import a strategy deliberately and exercise the triggering condition in a browser; an interaction-triggered event is replayed after hydration. DOM presence alone does not prove hydration, and waiting only for network idle does not prove an idle/visibility boundary activated. See [async component hydration](https://vuejs.org/guide/components/async#lazy-hydration).

## Evidence to deliver after a fix

Report the reproduced or user-reported failure separately from your inference about its cause. Name the changed ownership/contract, the regression boundary and exact checks actually run. List meaningful unexercised boundaries: browser focus/layout, async cancellation, server request isolation, hydration/streaming, deployment chunk behavior. Do not claim a fix from static source inspection alone; do not claim a browser result from jsdom or an SSR result from client-only mount. See [testing](testing.md) for runnable command setup and deterministic component/browser fixtures.

## Sources

- [Vue template refs](https://vuejs.org/guide/essentials/template-refs#refs-inside-v-for), [watchers](https://vuejs.org/guide/essentials/watchers), [reactivity in depth](https://vuejs.org/guide/extras/reactivity-in-depth), [lifecycle/error propagation](https://vuejs.org/api/composition-api-lifecycle).
- [Application configuration](https://vuejs.org/api/application), [SFC script setup](https://vuejs.org/api/sfc-script-setup), [scoped CSS](https://vuejs.org/api/sfc-css-features), [TypeScript Composition API](https://vuejs.org/guide/typescript/composition-api).
- [Vue async components and hydration strategies](https://vuejs.org/guide/components/async), [experimental Suspense](https://vuejs.org/guide/built-ins/suspense), [Teleport](https://vuejs.org/guide/built-ins/teleport), [SSR and teleport context](https://vuejs.org/guide/scaling-up/ssr), [SSR API](https://vuejs.org/api/ssr).
- [Nuxt ClientOnly](https://nuxt.com/docs/4.x/api/components/client-only) — framework-specific boundary, not a core Vue component.
- Exact-release metadata: [Vue 3.5.44](https://registry.npmjs.org/vue/3.5.44), [compiler 3.5.44](https://registry.npmjs.org/@vue%2fcompiler-sfc/3.5.44), [renderer 3.5.44](https://registry.npmjs.org/@vue%2fserver-renderer/3.5.44), [Nuxt 4.6.2](https://registry.npmjs.org/nuxt/4.6.2). Testing package evidence and setup are in [testing](testing.md).
