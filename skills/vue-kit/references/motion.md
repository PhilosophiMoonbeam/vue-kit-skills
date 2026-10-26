# Motion: ownership, lifecycle, and reduced movement

Read for transitions, list movement, gestures, exit retention, layout animation, or scroll-linked decoration. Inspect the existing engine and component-library transitions first; do not migrate an incumbent animation system for a narrow change. See [accessibility](accessibility.md) for focus/overlay contracts, [components](components.md) for component identity, [debugging and SSR](debugging-ssr.md) for hydration, and [testing](testing.md) for test ownership.

## Baseline and selection

Target Vue **3.5.44**, Composition API and TypeScript. Registry metadata and published declarations inspected: **motion-v 2.8.0** and **@vueuse/motion 3.0.3**, both stable ESM packages with Vue `>=3.0.0` peers. This is API evidence, not an exercised compatibility matrix. `motion-v` additionally peers on `@vueuse/core >=10.0.0`; VueUse Motion depends on VueUse `^13.0.0`. Inspect the lockfile rather than assuming every VueUse package resolves to the application's version. [Motion package](https://unpkg.com/motion-v@2.8.0/package.json), [VueUse Motion package](https://unpkg.com/@vueuse/motion@3.0.3/package.json).

**Exact-graph selection restriction:** `motion-v@2.8.0` + `@vueuse/core@15.0.0` + Vue **3.5.44** is **not supported under full declaration checking** in the researched Vue-tsc **3.3.13** / TypeScript **5.9.3** consumer (`skipLibCheck: false`). Core 15 satisfies Motion's declared `>=10` peer, but `use-in-view.d.ts` imports `MaybeRef` from core, which does not export it in this graph (TS2459). Motion also globally extends Vue's `HTMLAttributes` with its `Options`, whose gesture `onDrag` conflicts with Vue's native event signature. These are concrete package declaration defects, not missing optional browser ambient names. [Exact view import](https://unpkg.com/motion-v@2.8.0/dist/es/utils/use-in-view.d.ts), [global HTML augmentation](https://unpkg.com/motion-v@2.8.0/dist/es/types/instance.d.ts), [Motion drag signature](https://unpkg.com/motion-v@2.8.0/dist/es/features/gestures/drag/types.d.ts).

Passing native consumers in a project that **already** uses `skipLibCheck: true` does not repair those declarations. **Never flip that flag, suppress declarations, or patch dependencies to adopt this offering.** Choose Vue/CSS when the incumbent full-declaration gate rejects the graph. The native Motion recipes below are bounded incumbent options **only where the existing dependency graph and compiler gate accept them**, not blanket native-type certification or permission to weaken that gate. Retain VueUse Motion only under its own incumbent ownership and accepted graph; it is not an automatic substitute solely because another engine's declarations fail.

| Need | Prefer | Boundary |
|---|---|---|
| Color, opacity, focus/hover decoration | CSS transition | No animation dependency; target properties explicitly, not `transition: all`. |
| One entering/leaving DOM root | Vue `Transition` + CSS | Supports `v-if`, `v-show`, keyed component replacement; one root only. |
| Insert/remove/reorder a keyed list | Vue `TransitionGroup` + CSS | Unique stable keys; move class; no `mode`. |
| Springs, coordinated variants, drag, retained exits, measured/shared layout, motion values | `motion-v` only where the existing graph/compiler gate accepts it | The exact core-15 graph fails full declaration checking; do not weaken the gate to adopt it. Use Vue APIs, not React hooks/JSX. |
| Existing VueUse Motion directives/presets or imperative Popmotion integration | `@vueuse/motion` | Keep the incumbent engine; its variants and timing units differ from Motion for Vue. |
| Vuetify/headless overlay already owns its transition | That component's transition API | Do not add another presence engine around its owned DOM. |

**Architectural rule:** one engine per owned element, especially per `transform`, opacity, and lifetime. Do not combine CSS transform transitions, Vue list FLIP, `motion-v layout`, and VueUse Motion on the same element. Separate wrappers only for genuinely separate responsibilities. Neither animation engine supplies dialog semantics, focus trapping, authorization, loading state, or business completion.

## Invariants before animation

1. Render meaningful static content immediately. No hidden page shell, `opacity: 0` article waiting for hydration/IntersectionObserver, or `display: none` content waiting for an entrance callback. Prefer no `appear`, `:initial="false"`, or an initially visible variant. Decorative accents may animate independently.
2. Commit application state when the operation actually succeeds, not when animation finishes. Never invent a percentage, delay success until a tween ends, or animate an unknown network operation toward 100%. A scroll-position indicator is not reading completion or request progress.
3. Support `prefers-reduced-motion` **and changes while mounted**. Remove translation, zoom, parallax, repeated motion, staggering, and smooth scrolling when reduced; use immediate state changes or a short non-spatial alternative. Duration reduction alone does not remove a large spatial movement.
4. Preserve keyboard focus before hiding/removing focused content. Exit-retained DOM must not remain focusable or actionable after logical removal: move focus to a persistent control, disable interaction, and use `inert` where appropriate. Opacity zero alone is neither hidden nor unfocusable.
5. Keys identify data, not positions: use `item.id`, never index, random values, or timestamps generated during rendering. Preserve the same key across sorting; changing a key intentionally remounts and resets local state.
6. Cancel superseded animations and subscriptions. Unmount cleanup is not enough for rapid retargeting, preference changes, cached/deactivated views, or asynchronous sequences. Never leave a timer or `requestAnimationFrame` loop running offscreen.

[WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) is **AAA** and covers non-essential interaction-triggered movement. [WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) separately covers qualifying automatically moving content; provide pause/stop/hide rather than treating reduced motion as a universal conformance exemption. The [`prefers-reduced-motion` media feature](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion) is specified in Media Queries Level 5 (Working Draft); the media feature is usable without adopting the rest of that draft.

## Native Vue: default for simple effects

Complete `Disclosure.vue`; only Vue 3.5 is needed. The initial panel is visible without an entrance animation. Closing restores focus before `v-show` hides the panel; `inert` and `aria-hidden` apply during the leave interval. CSS preference changes also remove an in-progress transition.

```vue
<script setup lang="ts">
import { ref, useId, useTemplateRef } from 'vue'

const open = ref(true)
const panelId = useId()
const trigger = useTemplateRef<HTMLButtonElement>('trigger')

function close() {
  trigger.value?.focus()
  open.value = false
}

function toggle() {
  if (open.value) close()
  else open.value = true
}
</script>

<template>
  <button ref="trigger" type="button" :aria-expanded="open"
    :aria-controls="panelId" @click="toggle">
    Shipping details
  </button>
  <Transition name="details">
    <section v-show="open" :id="panelId" :inert="!open" :aria-hidden="!open">
      <p>Delivery estimates are confirmed before checkout.</p>
      <button type="button" @click="close">Close details</button>
    </section>
  </Transition>
</template>

<style scoped>
.details-enter-active,
.details-leave-active { transition: opacity 140ms ease-out; }
.details-enter-from,
.details-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .details-enter-active,
  .details-leave-active { transition: none; }
}
</style>
```

`Transition` is built in; it does not need registration. `name="details"` generates the six `details-enter/leave-from/active/to` classes. Use `mode="out-in"` only for mutually exclusive replacement where waiting is acceptable, not for a list. Nested CSS delays may require an explicit Vue `duration` **in milliseconds**; keep it synchronized with CSS. For JavaScript hooks use `:css="false"`, call `done()` on every completion/cancellation path, and implement `@enter-cancelled` / `@leave-cancelled` when applicable. A returned cleanup function from `watch()` is **not** Vue watcher cleanup; use its `onCleanup` callback. [Vue Transition](https://vuejs.org/guide/built-ins/transition.html).

For lists, the following is a **contextual template/CSS fragment**: the owner supplies `rows: { id: number; title: string }[]`, performs mutations, and relocates focus before deleting an interactive row. Do not also use a motion engine on these `li` elements.

```vue
<template>
  <TransitionGroup tag="ul" name="rows" class="rows">
    <li v-for="row in rows" :key="row.id">{{ row.title }}</li>
  </TransitionGroup>
</template>
<style scoped>
.rows { position: relative; }
.rows-move,
.rows-enter-active,
.rows-leave-active { transition: transform 160ms ease-out, opacity 160ms ease-out; }
.rows-enter-from,
.rows-leave-to { opacity: 0; transform: translateY(6px); }
.rows-leave-active { position: absolute; }
@media (prefers-reduced-motion: reduce) {
  .rows-move, .rows-enter-active, .rows-leave-active { transition: none; }
  .rows-enter-from, .rows-leave-to { transform: none; }
}
</style>
```

`position: absolute` removes leaving rows from flow so moves can be calculated; preserve row width if its content would otherwise reflow. A semantic `tag="ul"` avoids invalid wrappers. Native movement is unsuitable for recycled virtual rows unless the virtualizer explicitly supports it. [Vue TransitionGroup](https://vuejs.org/guide/built-ins/transition-group.html), [virtualization](virtualization.md).

## Motion for Vue: `motion-v` 2.8.0

Install only if selected: `bun add --exact motion-v@2.8.0` and satisfy its VueUse peer. Import `motion`, `AnimatePresence`, `MotionConfig`, and composables from **`motion-v`**, not `framer-motion`, `motion/react`, or `@vueuse/motion`. The root re-exports the engine's DOM utilities, including `animate` and `stagger`; this does not make React APIs Vue APIs. [Exact exports](https://unpkg.com/motion-v@2.8.0/dist/es/index.d.ts).

| Concern | Vue API and constraint |
|---|---|
| Native elements | `<motion.div>`, `<motion.button>`, SVG tags; dynamic `<Motion as="section">`. Arbitrary SFC wrapping with `motion.create(Component)` is excluded from the 2.8.0 strict-TypeScript recipes; see the diagnostic below. |
| State/variants | `:animate="target"` or variant label; `:variants="states"`; dynamic variant functions receive `:custom="value"`; labels propagate to descendants unless overridden. |
| Timing | `:transition="{ type: 'tween', duration: 0.18 }"` uses **seconds**. Springs use `stiffness`/`damping`/`mass`, or duration/bounce; avoid mixing those control models. |
| Gestures | `whileHover`, `whilePress`, `whileFocus`, `whileDrag`, `whileInView`; e.g. `:whilePress="{ scale: 0.98 }"`. Not React's `whileTap`. |
| Logic/events | Native `@click` for a semantic button action; `@hoverStart`, `@pressStart`, `@pressCancel` for gesture lifecycle. Do not dispatch the same action from both click and press. |
| Viewport | `:inViewOptions="{ once: true, amount: 0.25 }"`, not React's `viewport` prop; `useInView(elementRef)` returns a Vue ref. Keep required content visible outside these triggers. |
| Presence | Keep `AnimatePresence` mounted; conditional/keyed **direct children** own `exit`. Default `sync`; `wait` supports a single child; `popLayout` needs a positioned parent. |
| Layout | `layout`, `layout="position"`, `layoutId`; change layout via class/`:style`, not simultaneous width/height targets in `animate`. Use `LayoutGroup` for coordinated siblings. |
| Drag/reorder | `drag="x"`, `dragConstraints`, `dragMomentum`; `Reorder.Group v-model:values` with `Reorder.Item :value` for simple reorder. Always provide button/keyboard alternatives; drag does not define application ordering policy. |
| Fast values | `useMotionValue`, `useSpring`, `useTransform`, `useMotionTemplate`; bind MotionValues directly in `:style`. They are not Vue refs; use `.get()`/`.set()`, not `.value`. |

Exact [props](https://unpkg.com/motion-v@2.8.0/dist/es/components/motion/props.d.ts), [gestures](https://motion.dev/docs/vue-gestures), [variants](https://motion.dev/docs/vue-animation), [transitions](https://motion.dev/docs/vue-transitions).

### Presence, variants, stable identity, and layout

Complete `MotionList.vue`. Content is visible on first render and on restoration. Only persistent buttons are interactive, so removing a row cannot strand focus in retained exit DOM. State and count update immediately, independently of visual completion.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion-v'

const initialRows = [
  { id: 1, title: 'Review delivery details' },
  { id: 2, title: 'Check contact information' },
  { id: 3, title: 'Confirm the order' },
]
const rows = ref([...initialRows])
const reduced = useReducedMotion()
const transition = computed(() => ({
  type: 'tween' as const,
  duration: reduced.value ? 0 : 0.16,
}))
const rowVariants = { present: { opacity: 1 }, removed: { opacity: 0 } }
</script>

<template>
  <MotionConfig reducedMotion="user">
    <motion.button type="button"
      :whileHover="{ scale: reduced ? 1 : 1.02 }"
      :whilePress="{ scale: reduced ? 1 : 0.98 }"
      :transition="transition" @click="rows = [...rows].reverse()">
      Reverse order
    </motion.button>
    <button type="button" :disabled="rows.length === 0"
      @click="rows = rows.slice(0, -1)">Remove last step</button>
    <button type="button" @click="rows = [...initialRows]">Restore steps</button>
    <p role="status">{{ rows.length }} steps in this local list.</p>
    <ul v-if="reduced" class="steps">
      <li v-for="row in rows" :key="row.id">{{ row.title }}</li>
    </ul>
    <ul v-else class="steps">
      <AnimatePresence :initial="false" mode="popLayout">
        <motion.li v-for="row in rows" :key="row.id"
          :initial="false" :variants="rowVariants"
          animate="present" exit="removed"
          layout="position" :transition="transition">
          {{ row.title }}
        </motion.li>
      </AnimatePresence>
    </ul>
  </MotionConfig>
</template>

<style scoped>
.steps { position: relative; }
button:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
</style>
```

`MotionConfig` defaults to **`reducedMotion="never"`**. Set `"user"` for transform/layout reduction; opacity/color remain enabled. In **2.8.0**, the published component/directive bridge passes `reducedMotionConfig` but does **not** forward the engine's `skipAnimations` constructor option; the public config type alone does not establish that behavior. `useAnimate` separately reads `skipAnimations` when creating scoped animations. Do not rely on either setting to retroactively stop running effects. This list swaps only its noninteractive animated subtree for static rows on a live preference change; the controls and application state remain mounted. Stop manual controls explicitly as below. [MotionConfig](https://motion.dev/docs/vue-motion-config), [configuration types](https://unpkg.com/motion-v@2.8.0/dist/es/components/motion-config/types.d.ts), [published state bridge](https://unpkg.com/motion-v@2.8.0/dist/es/state/motion-state.mjs), [engine configuration](https://unpkg.com/motion-dom@14.3.0/dist/es/render/VisualElement.mjs), [scoped animation](https://unpkg.com/motion-v@2.8.0/dist/es/animation/hooks/use-animate.mjs).

**Preference ownership in 2.8.0:** `useReducedMotion()` directly wraps VueUse's reactive media query; it does **not** read a parent `MotionConfig`. Conversely, the pinned engine copies `prefersReducedMotion.current` into each visual element's `shouldReduceMotion` during `mount()`, rather than subscribing that field to subsequent preference changes. A root `"user"` policy is therefore a useful initial baseline, **not a live interruption/retargeting contract** for an already-mounted element. Own live handling in the component: use the hook, stop imperative controls, and replace only noninteractive decoration with state-correct static DOM (as the list/directive examples do). Preserve controls/focus and business state outside that branch. Avoid remounting an entire interactive widget solely to refresh the engine's snapshot. [Exact Vue hook](https://unpkg.com/motion-v@2.8.0/dist/es/animation/hooks/use-reduced-motion.mjs), [pinned engine mount](https://unpkg.com/motion-dom@14.3.0/dist/es/render/VisualElement.mjs).

For shared layout, namespace `layoutId` per repeated widget, or use a scoped `LayoutGroup id`. Give scrollable measured ancestors `layoutScroll`, fixed ancestors `layoutRoot`, and set `borderRadius`/`boxShadow` inline for scale correction. `layout="position"` avoids stretching text/images during size changes; SVG layout animation is not supported. [Layout documentation](https://motion.dev/docs/vue-layout-animations).

Advanced coordination remains explicit: `AnimatePresence :custom="direction"` supplies data to dynamic exit variants after the child has logically left; `anchorX="right"` changes `popLayout` anchoring; `@exitComplete` signals **visual** removal only. `LayoutGroup` supports `inherit="id"`/`"group"` as well as boolean inheritance, and its slot exposes `renderKey`/`forceRender`; `useLayoutGroup().forceRender()` is the incumbent manual coordination route when a participating sibling would not otherwise update. Do not key business components by a changing render counter just to trigger motion. `layoutDependency` can limit measurements to a meaningful dependency; omitting it is safer than a stale token that hides real layout changes. `crossfade` controls shared-layout fading, not semantic visibility. [Presence types](https://unpkg.com/motion-v@2.8.0/dist/es/components/animate-presence/types.d.ts), [group contract](https://unpkg.com/motion-v@2.8.0/dist/es/components/use-layout-group.d.ts), [slot contract](https://unpkg.com/motion-v@2.8.0/dist/es/components/LayoutGroup.d.ts).

For optional staggered **decoration**, use `delayChildren: stagger(0.04)` (import `stagger` from `motion-v`) or dynamic `custom` variants, and remove delay under reduced motion. Do not copy deprecated `staggerChildren`/`staggerDirection`, or delay required content by its list index. `AnimatePresence` retains exiting elements but does not manage their focus, semantics, or side effects; `mode="wait"` is not a loading-state coordinator. [Presence](https://motion.dev/docs/vue-animate-presence).

### Custom nodes, directives, and feature ownership

**Excluded at 2.8.0: arbitrary SFC `motion.create(Component)` wrapping in strict TypeScript.** The published overload constrains its argument to Vue's default `DefineComponent`; the strict Vue 3.5.44 consumer rejected both a required-prop SFC and a prop-free slotted SFC, including a `ComputedOptions` index-signature incompatibility. Removing required props is not a fix. Do not cast, suppress the error, alter dependency declarations, or invent a forwarding shim. Keep the custom component intact and move animation ownership to a native `motion.span`/`motion.div` only when that element is semantically valid; otherwise retain the component's existing transition API. This exclusion does not remove the working native Motion API. [Exact factory declaration](https://unpkg.com/motion-v@2.8.0/dist/es/components/motion/utils.d.ts).

The supported native owner binds its own attributes and typed style object directly, for example `:style="{ display: 'inline-block' }"` on `motion.span`, with targets and lifecycle owned by the enclosing setup. Do not pass CSS strings where Motion's style declaration requires an object. Keep persistent controls outside any reduced-motion decoration branch, as in the complete directive example below.

For migration/diagnosis only, the **runtime** finds a wrapped component's node through the wrapper proxy's `$el`, skipping text/comment siblings. An exposed nested ref does not redirect measurement, and a fragment is not a multi-root measurement contract. Runtime discovery and attribute forwarding do not prove strict factory type compatibility. [Root resolution](https://unpkg.com/motion-v@2.8.0/dist/es/components/motion/use-motion-state.mjs), [element selection](https://unpkg.com/motion-v@2.8.0/dist/es/components/hooks/use-motion-elm.mjs).

For hooks needing `Ref<HTMLElement | null>`, use a `useTemplateRef<HTMLElement>` on a native measured ancestor; never type a component ref as an HTMLElement merely to satisfy a signature. The published `useDomRef()` unwraps `$el`, but its **2.8.0 declaration returns `Ref<any, any>`**, so it does not establish a typed component-to-element contract or repair the factory's SFC constraint. [Runtime helper](https://unpkg.com/motion-v@2.8.0/dist/es/utils/use-dom-ref.mjs), [exact declaration](https://unpkg.com/motion-v@2.8.0/dist/es/utils/use-dom-ref.d.ts).

The **motion-v** directive is a genuine alternative to wrapper components. Complete `DirectiveAccent.vue`; its `vDeliveryAccent` local binding registers `v-delivery-accent` without a global plugin, distinguishing it from VueUse Motion's `v-motion`. Keep Motion for Vue options in the directive binding: VueUse Motion 3.0.3 globally augments native `HTMLAttributes.initial` as `Variant`, which rejects Motion for Vue's supported `false` when passed as a native `:initial` prop in a mixed-engine application. A live reduced preference replaces only the decorative node with a static counterpart, disposing the old directive without remounting the control. Changing only `transition.duration` does not retarget an unchanged animation target. [Engine target comparison](https://unpkg.com/motion-dom@14.3.0/dist/es/render/utils/animation-state.mjs).

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { createMotionDirective, domAnimation, useReducedMotion } from 'motion-v'

const vDeliveryAccent = createMotionDirective(domAnimation)
const emphasized = ref(false)
const reduced = useReducedMotion()
</script>

<template>
  <button type="button" :aria-pressed="emphasized"
    @click="emphasized = !emphasized">Emphasize delivery information</button>
  <span v-if="reduced" :style="{ opacity: emphasized ? 1 : 0.5 }" aria-hidden="true">—</span>
  <span v-else v-delivery-accent="{
    initial: false,
    animate: { opacity: emphasized ? 1 : 0.5 },
    transition: { duration: 0.16 },
  }" aria-hidden="true">—</span>
  <p>Delivery information remains readable.</p>
</template>
```

`createMotionDirective(bundle?, defaults?)` merges user options over defaults, then VNode props over the binding object. `createPresetDirective(options, bundle?)` bakes in defaults; its local variable `vAccent` makes `v-accent`, or register it with `app.directive('accent', directive)`. Global `MotionPlugin` uses `{ presets: { accent: options } }` and registers **`v-accent`**, not VueUse's `v-motion-accent`. The ready-made `vMotion` loads `domMax`; choose `domAnimation` only when drag/layout are unnecessary. In **2.8.0** the directive updates options on Vue updates, participates in presence/config/layout context, cleans up on removal, and provides `getSSRProps`; do not import VueUse Motion's different lifecycle assumptions. [Exact directive implementation](https://unpkg.com/motion-v@2.8.0/dist/es/directive/index.mjs).

For component-based splitting, use `LazyMotion` with `m`, not full `motion`; `features` accepts a bundle, promise, or loader such as `() => import('motion-v').then(module => module.domMax)`. The root package resolver is a separate incumbent auto-registration route: import the default `MotionResolver` from `motion-v/resolver`, then include `MotionResolver()` in the existing `unplugin-vue-components` `resolvers` array. Do not register a second competing resolver or assume the resolver installs global directives. [Resolver declaration](https://unpkg.com/motion-v@2.8.0/dist/resolver/index.d.mts).

### Drag, reorder, and explicit application ordering

For bounded dragging, bind an ancestor template ref as `:dragConstraints="frame"` and give it a real measured box; numeric constraints are offsets such as `{ left: 0, right: 120 }`. Set `drag="x"`/`"y"`, `dragElastic`, and `:dragMomentum="false"` deliberately. A separate handle uses `const controls = useDragControls()`, `@pointerdown="controls.start($event)"`, and a target with `:dragListener="false" :dragControls="controls"`. Give the handle appropriate `touch-action` (`none` for free dragging, `pan-y` for horizontal dragging alongside vertical scrolling), and retain keyboard/button equivalents. Call `controls.cancel()` for interrupted gestures; `controls.stop()` stops an active gesture. These are pointer mechanics, not persisted order or authorization. [Exact controls](https://unpkg.com/motion-v@2.8.0/dist/es/features/gestures/drag/use-drag-controls.d.ts).

Complete `ReorderSteps.vue`: primitive values and stable keys keep the pointer and button paths on the same local order. The selector and move buttons stay mounted outside the visual list. A live reduced preference cancels dragging before replacing that drag/layout subtree with static rows, without stranding keyboard focus in replaced controls.

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type HTMLAttributes } from 'vue'
import { Reorder, useDragControls, useReducedMotion } from 'motion-v'

const listAttrs = { 'aria-label': 'Steps' } satisfies Pick<HTMLAttributes, 'aria-label'>

const items = ref(['Review', 'Confirm', 'Submit'])
const selected = ref('Review')
const selectedIndex = computed(() => items.value.indexOf(selected.value))
const reduced = useReducedMotion()
const dragControls = useDragControls()
watch(reduced, (reduce) => {
  if (reduce) dragControls.cancel()
}, { flush: 'sync' })
onBeforeUnmount(() => dragControls.cancel())

function updateFromDrag(next: string[]) {
  if (!reduced.value) items.value = next
}

function move(delta: number) {
  const item = selected.value
  const from = selectedIndex.value
  const to = from + delta
  if (from < 0 || to < 0 || to >= items.value.length) return
  const next = [...items.value]
  next.splice(from, 1)
  next.splice(to, 0, item)
  items.value = next
}
</script>

<template>
  <label>Step to move
    <select v-model="selected">
      <option v-for="item in items" :key="item" :value="item">{{ item }}</option>
    </select>
  </label>
  <button type="button" :disabled="selectedIndex <= 0"
    :aria-label="`Move ${selected} earlier`" @click="move(-1)">Earlier</button>
  <button type="button" :disabled="selectedIndex >= items.length - 1"
    :aria-label="`Move ${selected} later`" @click="move(1)">Later</button>
  <ol v-if="reduced" v-bind="listAttrs">
    <li v-for="item in items" :key="item">{{ item }}</li>
  </ol>
  <Reorder.Group v-else :values="items" @update:values="updateFromDrag"
    axis="y" as="ol" v-bind="listAttrs">
    <Reorder.Item v-for="item in items" :key="item" :value="item"
      as="li" drag="y" :dragControls="dragControls" :dragMomentum="false"
      :style="{ position: 'relative' }">
      {{ item }}
    </Reorder.Item>
  </Reorder.Group>
</template>
```

In **2.8.0**, `Reorder.Group` declares `as: AsTag` and motion/reorder props, but does **not** intersect the selected tag's native HTML attributes into its public props; `as="ol"` alone does not make a direct `aria-label` type-check under `strictTemplates`. The narrow `listAttrs` object is checked against Vue's `HTMLAttributes` with `satisfies Pick<…>` and bound to **both** branches. At runtime, Group explicitly merges `useAttrs()` into its `Motion` child; Motion preserves those attributes when rendering the selected native tag. This is a checked native-attribute fallthrough boundary, not a new Group prop, a cast, or permission to forward arbitrary attributes through custom components. Keep `values`/`update:values` and each Item's `value`, `as`, `drag`, `dragControls`, `dragMomentum`, and motion `style` on their declared contracts. [Group declaration](https://unpkg.com/motion-v@2.8.0/dist/es/components/reorder/index.d.ts), [AsTag](https://unpkg.com/motion-v@2.8.0/dist/es/types/common.d.ts), [Group forwarding](https://unpkg.com/motion-v@2.8.0/dist/es/components/reorder/Group.vue_vue_type_script_setup_true_lang.mjs), [Motion attribute handling](https://unpkg.com/motion-v@2.8.0/dist/es/components/motion/use-motion-state.mjs), [native rendering](https://unpkg.com/motion-v@2.8.0/dist/es/components/motion/utils.mjs), [Vue HTML/ARIA declarations](https://unpkg.com/@vue/runtime-dom@3.5.44/dist/runtime-dom.d.ts).

`values` must contain the same values supplied to `Item :value`; recreating object values independently breaks identity. `axis="xy"` is supported in 2.8.0, not just historical one-dimensional lists. Add `layoutScroll` to scrollable measured containers and `position: relative` to items for their drag stacking order. Reorder is not a multi-container/virtualized drag-and-drop policy engine: use explicit application operations for such requirements rather than treating visual crossing as committed server state. [Reorder types](https://unpkg.com/motion-v@2.8.0/dist/es/components/reorder/index.d.ts), [guide](https://motion.dev/docs/vue-reorder).

### Motion-value graphs, SVG, and incumbent controllers

Keep fast signals out of Vue render state. The following is a **contextual setup fragment**; bind `x`, `opacity`, and `filter` to a decorative motion element's `:style`, and call `x.set(value)` from its real input owner.

```ts
import { useMotionValue, useSpring, useTransform, useMotionTemplate } from 'motion-v'

const x = useMotionValue(0)
const smoothX = useSpring(x, { stiffness: 300, damping: 30 })
const { opacity, scale } = useTransform(smoothX, [0, 100], {
  opacity: [0.5, 1],
  scale: [0.95, 1],
})
const filter = useMotionTemplate`drop-shadow(${smoothX}px 2px 2px #0003)`
```

Bind `smoothX` instead of `x` if translation should follow the spring; `scale` is another available output. `useTransform` also accepts a transformer, an array of inputs plus transformer, or `() => source.get() * 2`; ranges must be monotonic, equal-length, and type/format compatible. Clamping defaults to true; `{ clamp: false }` deliberately extrapolates. `useComputed`/`useCombineMotionValues` are incumbent computed-graph helpers, not Vue refs; prefer `useTransform` unless a custom combined graph requires them. Springs can follow a source MotionValue or hold an independently set numeric/string value. Stop active movement and jump the presentation to its correct non-spatial state under reduced preference; a spring is not an exemption. [Transform overloads](https://unpkg.com/motion-v@2.8.0/dist/es/value/use-transform.d.ts), [spring implementation](https://unpkg.com/motion-v@2.8.0/dist/es/value/use-spring.mjs).

For a changing readout, import `RowValue` and use `<RowValue :value="value" />` with a MotionValue; do not copy its value into a Vue ref every frame. **2.8.0 writes `textContent` on changes**, not the old source skill's claimed `innerHTML`; normal business/status text should still be derived from application state, not animated numbers. `useVelocity(value)` derives numeric velocity; `useTime()` supplies an elapsed-time signal. `useAnimationFrame((elapsed, delta) => ...)` has no public stop handle in 2.8.0: mount it only in a small browser-owned effect component and unmount that owner when paused/reduced/offscreen; checking a flag in its callback does not stop its scheduled loop. `usePageInView()` can gate nonessential work when the page is hidden, while `useInView` gates a specific element. [Readout implementation](https://unpkg.com/motion-v@2.8.0/dist/es/components/RowValue.vue_vue_type_script_setup_true_lang.mjs), [frame lifecycle](https://unpkg.com/motion-v@2.8.0/dist/es/utils/use-animation-frame.mjs).

For incumbent prop-driven orchestration, `useAnimationControls()` returns `start(targetOrLabel)`, `set(targetOrLabel)`, and `stop()`; bind that controller to each owned component's `:animate`. Start only after mount, stop before retarget/disposal, and guard awaited sequences as with `useAnimate`. Migrate deprecated `animationControls()` to this hook, not a React hook. Prefer `useAnimate` for selector-scoped timelines; use parent variants for declarative child coordination. MotionConfig can supply a default `transition`, `inViewOptions`, `skipAnimations`, and CSP `nonce`; its nonce is not permission to bypass an application's style policy. [Controller declaration](https://unpkg.com/motion-v@2.8.0/dist/es/animation/hooks/use-animation-controls.d.ts).

SVG transforms and attributes are different channels: use `attrX`, `attrY`, `attrScale` for corresponding SVG attributes rather than confusing them with CSS `x`/`y`/`scale`. Animate `pathLength` for a normalized stroke reveal, not a replacement for required text; keep labels/static state visible. For curved **positional** motion import `arc` and use `:transition="{ path: arc({ rotate: 90 }) }"` with an `x`/`y` target; this `path` option is not an SVG `d` morph. Disable this nonessential trajectory when reduced. [Exact target/path types](https://unpkg.com/motion-v@2.8.0/dist/es/types/state.d.ts).

### Imperative animation: scope, interrupt, stop

Complete `PulseAccent.vue`. The accent is decorative and initially visible; the text never waits for the animation. Repeated presses cancel the previous effect; reducing motion immediately stops and restores the accent. Use Vue's watcher cleanup rather than React `useEffect` or a returned cleanup from `watch`.

```vue
<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useAnimate, useReducedMotion } from 'motion-v'

const [scope, animate] = useAnimate()
const reduced = useReducedMotion()
let active: ReturnType<typeof animate> | undefined

function cancel() {
  active?.stop()
  active = undefined
  if (scope.value instanceof HTMLElement) scope.value.style.opacity = '1'
}

function pulse() {
  cancel()
  if (reduced.value || !scope.value) return
  active = animate(scope.value, { opacity: [1, 0.45, 1] }, { duration: 0.3 })
}

watch(reduced, cancel, { flush: 'sync' })
onBeforeUnmount(cancel)
</script>

<template>
  <p>Contact details stay available while the accent changes.</p>
  <span ref="scope" class="accent" aria-hidden="true"></span>
  <button type="button" @click="pulse">Highlight accent</button>
  <button type="button" @click="cancel">Stop highlight</button>
</template>

<style scoped>
.accent { display: inline-block; width: 1rem; height: 1rem; background: currentColor; }
</style>
```

`useAnimate()` returns `[scope, animate]`; bind `ref="scope"`, access `scope.value` in Vue, and scope selectors beneath it. It automatically stops its animations on component unmount. Raw exported `animate()` has no component ownership: retain controls and stop them yourself. A stopped awaited sequence must not be relied upon to settle or continue: use a generation/disposal guard before later steps or state writes. `stop()` is not a business cancellation API. [useAnimate](https://motion.dev/docs/vue-use-animate), [exact implementation](https://unpkg.com/motion-v@2.8.0/dist/es/animation/hooks/use-animate.mjs).

### Scroll: separate decoration from content

Complete `ScrollAccent.vue` and its decorative child `ScrollDecoration.vue`. The document remains static and readable. Reduced motion unmounts the **subscription owner**, not merely its rendered span, so the scroll listener and transformed-value subscriptions stop while the content stays mounted.

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useReducedMotion } from 'motion-v'
import ScrollDecoration from './ScrollDecoration.vue'

const target = useTemplateRef<HTMLElement>('target')
const reduced = useReducedMotion()
</script>

<template>
  <section ref="target">
    <h2>Delivery information</h2>
    <p>Review the confirmed estimate before placing your order.</p>
    <ScrollDecoration v-if="!reduced && target" :target="target" />
  </section>
</template>

```

```vue
<!-- ScrollDecoration.vue -->
<script setup lang="ts">
import { motion, useScroll, useTransform } from 'motion-v'

const props = defineProps<{ target: HTMLElement }>()
const { scrollYProgress } = useScroll(() => ({
  target: props.target,
  offset: ['start end', 'end start'],
}))
const x = useTransform(scrollYProgress, [0, 1], [-12, 12])
</script>

<template>
  <motion.span class="accent" aria-hidden="true" :style="{ x }" />
</template>
<style scoped>
.accent { display: block; width: 3rem; height: 0.25rem; background: currentColor; }
</style>
```

`useScroll()` returns `scrollX`, `scrollY` (pixels) and `scrollXProgress`, `scrollYProgress` (normalized between configured intersections). `container` is the scrolling element; `target` is the measured element. Vue refs are accepted. Native ScrollTimeline acceleration is capability-dependent, not a guarantee for every offset/browser. Bind MotionValues to motion styles instead of rerendering Vue on every scroll tick. `useMotionValueEvent(value, 'change', callback)` handles unsubscription on unmount; retain its returned unsubscribe if you need an earlier stop. Scroll composables belong in setup, not repeatedly in event handlers. [useScroll](https://motion.dev/docs/vue-use-scroll), [2.8.0 declarations](https://unpkg.com/motion-v@2.8.0/dist/es/value/use-scroll.d.ts).

In **2.8.0**, `useScroll` owns its listener through a setup-time `watchEffect` cleanup, while `useTransform` releases its subscriptions on component unmount. Hiding only their consumer does not stop that work. Keep both hooks in the conditional decoration owner; do not recreate them inside a preference watcher or substitute a detached effect scope for the component lifecycle. [Scroll cleanup](https://unpkg.com/motion-v@2.8.0/dist/es/value/use-scroll.mjs), [transform subscription cleanup](https://unpkg.com/motion-v@2.8.0/dist/es/value/use-combine-values.mjs).

For a large motion surface, `LazyMotion` + `m` components loads a chosen feature bundle: `domAnimation` for basic animation/gestures/presence, `domMax` for layout/drag too. Use `strict` to catch accidentally importing full `motion` components into that subtree; measure the actual application bundle rather than promising fixed kilobytes. [LazyMotion](https://motion.dev/docs/vue-lazymotion).

## VueUse Motion: `@vueuse/motion` 3.0.3

Install only if selected: `bun add --exact @vueuse/motion@3.0.3`. Its engine is **Popmotion 11**, not Motion for Vue or WAAPI. Timing numbers are **milliseconds**, despite seconds wording in some copied declaration comments: `duration: 180` is 180ms, not `0.18`. [Official timing documentation](https://motion.vueuse.org/features/transition-properties/), [exact runtime](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs).

**Keep, do not duplicate:** retaining 3.0.3 for an existing Popmotion controller/preset integration is deliberate, not an instruction to install it beside Motion for Vue for ordinary reveals. Its different control/lifecycle API is a real incumbent migration boundary; package overlap or its older VueUse dependency alone is not evidence of incompatibility with Vue 3.5.44. New simple effects still default to native Vue/CSS, while Motion for Vue owns newly required layout/presence/drag features. Migrate an owned element end-to-end if its actual requirements change; do not translate only timing numbers while leaving both engines' directives or transforms attached. No recommendation here depends on a declaration-only promise, global registry fallback, or dependency patch.

### Directive plugin versus component-owned composable

The directive requires registration. The following is a **contextual application-entry fragment** (`app` is the application's existing Vue App):

```ts
import { MotionPlugin } from '@vueuse/motion'
app.use(MotionPlugin, { excludePresets: true })
```

This registers `v-motion` and global `Motion`/`MotionGroup`; omit `excludePresets` to register preset directives too. Plugin custom presets use `{ directives: { 'accent-hover': variants } }`, not Motion for Vue's `{ presets: ... }`. Never install both packages' global `MotionPlugin` directives under the same `v-motion` name. Alias local imports if both engines legitimately exist in different areas.

| Surface | Use and limitations |
|---|---|
| `v-motion` | Static template config, e.g. `:initial="{ opacity: 1, scale: 1 }" :hovered="{ scale: 1.02 }"`; no entrance-hidden required content. Presets use kebab-case directive names. |
| `MotionComponent` imported locally as `Motion` | `<Motion is="p" ...>`; preset names are camelCase, e.g. `slideVisibleLeft`. Do not import a nonexistent named `Motion` export. |
| `MotionGroupComponent` / global `MotionGroup` | Applies configuration to child elements; renderless unless given `is`. **Not** Vue TransitionGroup, a list FLIP engine, or automatic exit retention. |
| `useMotion(target, variants, options?)` | Component-owned imperative control; no plugin required. Prefer for reactive application-driven variants, exact interruption, and explicit disposal. |

Variants: `initial`, `enter`, `leave`, `visible`, `visibleOnce`, `hovered`, `focused`, `tapped`, plus custom keys. `visible` restores `initial` after viewport exit; `visibleOnce` does not replay on each entry. In **3.0.3**, overlapping event targets merge in the runtime order **hovered < tapped < focused**; do not rely on older prose claiming tap wins over focus. `variant.value = 'selected'` changes the selected label; `apply('selected')` animates without changing it; `set('selected')` jumps; unknown labels throw. `stop()` stops active values; it is not an instruction to revert to `initial`. [Exact event merge order (`registerEventListeners`)](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs), [variants](https://motion.vueuse.org/features/variants/), [useMotion](https://motion.vueuse.org/api/use-motion/), [components](https://motion.vueuse.org/features/components/).

**Reactive contract correction:** 3.0.3 accepts `MaybeRef` variants but its state/control implementation captures `unref(variants)` once. Replacing a ref/computed variants object is not a reliable reactive-update strategy. Retain a reactive object and replace/select known variant entries, or explicitly watch application inputs and `stop()` + `set()`/`apply()` object targets. Its directive has no `updated` or `unmounted` hook in the published implementation; do not assume rebinding props reconfigures an existing instance or that directive removal automatically runs `leave`. For deterministic disposal in dynamic branches, put `useMotion` in a child component whose lifetime matches the element. [Published implementation](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs).

Complete `SelectedAccent.vue`. This demonstrates the explicit watcher strategy: the input's real selected state changes immediately, while only a decorative underline scales. Reduced preference immediately stops the effect and shows a nonmoving, state-correct underline. No plugin, global registry, animation promise, or hidden content is needed.

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { useMotion, useReducedMotion } from '@vueuse/motion'

const selected = ref(false)
const labelId = useId()
const target = useTemplateRef<HTMLElement>('accent')
const reduced = useReducedMotion()
const accentMotion = useMotion(target, { initial: { scaleX: 1, opacity: 0.35 } }, {
  lifeCycleHooks: false,
  syncVariants: false,
  visibilityHooks: false,
  eventListeners: false,
})

watch([target, selected, reduced], ([element, isSelected, reduce]) => {
  if (!element) return
  accentMotion.stop()
  const state = { scaleX: isSelected ? 1 : 0.6, opacity: isSelected ? 1 : 0.35 }
  if (reduce) accentMotion.set({ ...state, scaleX: 1 })
  else void accentMotion.apply({ ...state, transition: { type: 'tween', duration: 160 } })
}, { immediate: true, flush: 'post' })

onBeforeUnmount(() => accentMotion.stop())
</script>

<template>
  <label :id="labelId">
    <input v-model="selected" type="checkbox" /> Select delivery reminder
  </label>
  <span ref="accent" class="accent" aria-hidden="true"></span>
  <p :aria-labelledby="labelId">{{ selected ? 'Selected' : 'Not selected' }}</p>
</template>

<style scoped>
.accent {
  display: block;
  width: 8rem;
  height: 0.2rem;
  background: currentColor;
  transform-origin: left center;
}
</style>
```

**Template-ref naming invariant:** the string key `ref="accent"` must not also name a non-ref setup binding. In an inline-compiled SFC, `const accent = useMotion(...)` made that native ref resolve to the controller object instead of the intended template-ref key, causing a renderer failure. Keep the controller named `accentMotion` and the DOM target registered through `useTemplateRef('accent')`. This is an application naming defect, not evidence that nested VueUse packages create another Vue runtime. [Pinned compiler ref-binding resolution](https://github.com/vuejs/core/blob/v3.5.44/packages/compiler-core/src/transforms/transformElement.ts).

`useMotion` assembles element properties, transitions, variants, and optional features. Component-owned values register unmount cleanup; the example also stops in `onBeforeUnmount` and before every retarget. For manual `apply()` sequences, stopping a transition is not a guarantee its promise resolves: avoid post-await state commits without a current-generation guard. Direct `set()` is the reliable immediate reduced-motion path. `useSpring(motionProperties, options)` is the lower-level Popmotion alternative; its `set()` animates and `stop()` cancels—do not confuse that `set()` with `useMotion().set()`. [Controls](https://motion.vueuse.org/api/use-motion-controls/), [spring](https://motion.vueuse.org/api/use-spring/).

`leave` is **not automatic**. To delegate Vue removal to VueUse Motion, use native `<Transition :css="false">` with an owner-defined leave hook calling `instance.leave(done)`. Define a leave variant, handle cancellation, call `done` on the immediate/reduced path, and stop on owner disposal. This is one lifecycle coordinator plus one animation engine, not two engines competing for styles. Prefer native CSS if those hooks add no required capability. Do not use the global `useMotions()` registry for component-private ownership; entries appear after directive creation and names collide across repeated instances. [Motion instance](https://motion.vueuse.org/features/motion-instance/).

### VueUse transitions, presets, and low-level interop

Declare a visible, complete `initial` for every property that later variants change; otherwise hover/viewport reversal has no defined baseline. Numbers acquire property units (`y: 100` is pixels, `rotate: 90` is degrees). Transforms compose into one CSS transform; do not also write that transform from Vue/CSS. Colors and CSS style properties use the style binder. Although the types list SVG `pathLength`/`pathOffset`/`pathSpacing`, **3.0.3 has no dedicated SVG stroke/attribute renderer**: its binder writes ordinary `element.style[key]`. For SVG reveals use explicit SVG attributes/CSS `stroke-dasharray`/`stroke-dashoffset` with an application-owned measured length, or Motion for Vue's SVG renderer; do not assume those typed keys normalize a path automatically. Arrays are keyframes; `[null, 0.7, 1]` starts from the current value. [Variant declarations](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.d.mts), [exact binder/runtime](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs).

| Requirement | 3.0.3 contract |
|---|---|
| Predictable timing | Put `transition` in the variant. Default opacity/color tween is 300ms; transform properties commonly spring; keyframe arrays default to 800ms. Explicitly select a type rather than relying on property defaults. |
| Spring | Use `type: 'spring'` with `stiffness`/`damping`/`mass` and optional `restSpeed`/`restDelta`/`velocity`, **or** duration/bounce, not both models together. |
| Tween/keyframes | `type: 'tween'` or `'keyframes'`, `duration`, `ease` (named/function/cubic-bezier), and `times` for keyframe placement. Keep times aligned with the keyframe count. |
| Per-property behavior | `transition: { default: { type: 'tween', duration: 160 }, opacity: { duration: 120 }, y: { type: 'spring', stiffness: 300, damping: 30 } }`; a key-specific transition replaces the fallback, so make each override sufficient. |
| Delay/repeat | `delay` and `repeatDelay` are milliseconds; `repeat` is a count and `repeatType` is `'loop'`, `'reverse'`, or `'mirror'`. `Infinity` needs a pause/stop contract; remove repeated/staggered movement for reduced preference. |
| Immediate state | Prefer `instance.set(target)`; `type: false` also jumps. Do not await `apply` with `transition.immediate`: the runtime's immediate push skips the per-property completion callback. |
| Inertia | `type: 'inertia'`, `power`, `timeConstant`, `modifyTarget`, `min`/`max` require actual numeric velocity/bounds. The inertia path does not wire the same completion callback as tween/spring; do not use its `apply()` promise as a business/removal barrier. |
| Shorthand `:delay`/`:duration` | Applies only to declared `enter`, `visible`, `visibleOnce`, not leave/hover/focus/tap. Directives require numeric props; components parse numeric strings too. |

The promises above describe the published implementation, not exercised browser results. In particular, a stop/immediate/inertia path can leave a completion-dependent leave hook waiting indefinitely. Prefer a direct state-correct `set` plus the Vue removal callback for immediate/reduced/cancelled paths. `isAnimating` is animation bookkeeping, not loading or transaction state. [Transition documentation](https://motion.vueuse.org/features/transition-properties/), [controls/runtime](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs).

Presets are reusable **variant objects**, not a separate engine. The 30 built-ins are `fade`/`pop` with `Visible`/`VisibleOnce` forms, and `roll`/`slide` with `Left`/`Right`/`Top`/`Bottom` directions and corresponding visibility forms. Exact naming order matters: `slideVisibleOnceLeft` maps to `v-motion-slide-visible-once-left`; it is not `slideLeftVisibleOnce`. Import a preset object to extend it, or pass its exact camelCase name as a component `preset`. They start hidden/moved: adapt `initial` to visible content and bypass the spatial preset under reduced preference rather than blindly applying it to an article. Component config priority is explicit variant props, then preset, then `variants`, with shorthand timing applied afterward. Unknown component presets warn only in development; a typo is not a runtime fallback. [Exact presets/component resolution](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs).

For incumbent Popmotion-level integrations, build only the missing layer:

| Existing integration | Keep this ownership boundary |
|---|---|
| Direct numeric spring | `useMotionProperties(target, { x: 0 })` supplies reactive `motionProperties`; pass that object to `useSpring`, then call its `set({ x: 80 })` to animate and `stop('x')` to cancel. For reduced preference, stop then assign the final `motionProperties.x` directly; spring `set` is **not** an immediate jump. The runtime does not bind an element from a spring option named `target`; bind through `useMotionProperties`, not that declaration-only shortcut. |
| Custom variants/controller | `useMotionVariants(variants)` gives the selected label and computed state; `useMotionControls(motionProperties, variants)` supplies `apply`/`set`/`stop`/`leave`. The controls alone do not watch the selected label: add an explicit watcher or use `useMotion` instead. Keep one stable variants object. |
| Custom transition bridge | `useMotionTransitions().push(key, value, targetProperties, transition, completion?)` updates a property of its target object; it is not itself an element/style binder. Retain `stop(keys?)` and dispose it before ownership ends; do not also let another controller drive the same keys. |
| Raw style/transform binding | `useElementStyle(target)` and `useElementTransform(target)` return reactive property states that write to one element. `reactiveStyle(props)` / `reactiveTransform(props, false)` instead return state plus serialized style/transform for explicit binding; the second argument disables default hardware promotion. Avoid duplicate transform serialization/forced layers. |
| Existing manual feature assembly | `useMotionFeatures(instance, options)` installs lifecycle/variant/visibility/event watchers. An omitted options object enables all four; a **partial supplied object does not merge true defaults**. Set all desired flags explicitly, once in setup, never repeatedly in a watcher. |

These composables belong to the owning setup/effect scope. `useMotion` assembles the same layers and is safer unless a real interop boundary requires fewer of them. `useMotionProperties` can rebind a target ref, but that is not a guarantee that every lifecycle trigger replays correctly; keep dynamically created elements in small lifetime-matched owners. Low-level transform parsing reads inline transforms, not a complete computed-style/matrix decomposition. The exported `isMotionInstance` guard checks that `target` is a ref; a controller constructed with a raw element can therefore fail that guard. Do not use it as proof of DOM lifetime or authorization. [Low-level implementation and exports](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs), [declarations](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.d.mts).

For a genuine shared directive registry, use `const motions = useMotions()` and access `motions[name]` only inside a later mounted/event path; do not destructure absent entries during setup. Give each mounted instance a unique stable name and do not let two Vue apps/repeated widgets share it accidentally: the published registry is module-global, not app-isolated, and the directive does not delete entries on unmount. Options API's `this.$motions` is declared in types but **the 3.0.3 plugin does not assign it**; use the composable from setup rather than relying on a declaration-only property. Use component-owned `useMotion` for deterministic private cleanup. [Plugin/registry runtime](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs).

### Nuxt registration and SSR diagnosis

Choose **one** integration below; these are complete minimal `nuxt.config.ts` exports for an existing Nuxt project, not SPA entry files. They establish module options, not a tested Nuxt-version matrix.

```ts
export default {
  modules: ['motion-v/nuxt'],
  motionV: {
    components: true,
    utilities: true,
    prefix: 'Fx',
    directives: true,
    presets: { accent: { initial: { opacity: 1 }, animate: { opacity: 0.8 } } },
  },
}
```

Motion for Vue's prefix applies to component auto-registration (`FxMotion`, `FxAnimatePresence`, etc.), **not** utility imports or the `v-motion` directive. `directives` defaults false; a custom preset registers its own exact directive name (`v-accent`) even without enabling global `v-motion`. Presets are JSON-serialized into the generated plugin: keep them serializable, not functions/MotionValues; use explicit local imports/factories for dynamic variants. The 2.8.0 module does not add `build.transpile` entries; copying a historical transpile workaround is not a default setup step. [Exact module](https://unpkg.com/motion-v@2.8.0/dist/nuxt/index.mjs).

```ts
export default {
  modules: ['@vueuse/motion/nuxt'],
  motion: {
    excludePresets: true,
    directives: {
      accent: { initial: { opacity: 1 }, hovered: { opacity: 0.8 } },
    },
  },
}
```

VueUse Motion merges these options into `runtimeConfig.public.motion`, installs its plugin, auto-imports composables, registers `Motion`/`MotionGroup`, and adds its own transpilation entries (`defu`, motion, VueUse core/shared). Custom `accent` becomes `v-motion-accent` and component `preset="accent"`. Runtime config is public/serializable: put no secrets, DOM nodes, or callbacks there. It supplies no component/utility prefix option; a second engine needs explicit local imports and disabled conflicting auto-registration, not the Motion for Vue `prefix` copied into this module. [Exact module](https://unpkg.com/@vueuse/motion@3.0.3/dist/nuxt/module.mjs).

SSR troubleshooting, in order:

1. Confirm which engine registered the directive/component and compare server **inline styles** with the client initial state. Motion for Vue's components/directive resolve initial styles server-side; VueUse Motion serializes its initial variant only. Neither can read the client's motion preference during ordinary SSR.
2. VueUse Motion accepts an object `v-motion="{ initial, enter }"` or separate `:initial`/`:enter` props, but **do not mix the two configuration forms when SSR matters**. In 3.0.3 the client lets VNode variant props override the binding object, while `getSSRProps` picks `binding.value || node.props`; a binding string/object can hide a separate `initial` prop from server serialization. Preset `initial` also wins `defu` defaults server-side. Choose a component or make both paths' initial state identical rather than masking hydration mismatch.
3. Components attach initial styles directly to VNodes and can be preferable in MDC/Markdown. In development only, VueUse Motion's components replay initial/trigger variants on updates; distinguish this replay from production behavior before diagnosing reactive configuration.
4. Viewport/event/enter variants need JavaScript. Keep SSR initial content visible even if hydration never occurs; client-only decoration is not a reason to hide required server-rendered content. Test no-JavaScript output and live preference separately.

[VueUse SSR implementation](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs), [SSR documentation](https://motion.vueuse.org/getting-started/nuxt/), [Motion for Vue directive SSR](https://unpkg.com/motion-v@2.8.0/dist/es/directive/index.mjs).

## Version differences, SSR, and integration hazards

- `motion-v` **2.8.0** replaces the older 2.4.4 baseline; its release synchronizes the engine to 14.3.0 and fixes drag/pan integration. Use `whileFocus`/`whileHover`/`whilePress`/`whileInView`, not older shorthand recipes. The 2.8.0 `InViewProps` declaration still includes **deprecated `inView`**, so do not describe every shorthand as removed; the supported component props use `while*`. Likewise, `reduceMotion` is deprecated in favor of `reducedMotion`. Keep engine-coupled dependencies in the lockfile; do not independently substitute an arbitrary Framer Motion release. [2.8.0 release](https://github.com/motiondivision/motion-vue/releases/tag/v2.8.0), [exact viewport declaration](https://unpkg.com/motion-v@2.8.0/dist/es/features/gestures/in-view/types.d.ts), [v2 migration](https://github.com/motiondivision/motion-vue/releases/tag/v2.0.0).
- VueUse Motion **3.0.3** is the pinned inspected release; v3 dropped CommonJS and moved to VueUse 13 dependencies. Both selected packages are ESM-only: migrate an incumbent `require()` consumer to ESM or asynchronous `import()`, not a nonexistent CJS subpath. VueUse Motion's `@nuxt/kit ^3.13.0` dependency is optional, not proof of universal Nuxt-version compatibility. Do not use its nightly channel as a stable baseline. For Nuxt missing-`defu`/externalized-type errors on older v3 releases, 3.0.3 explicitly fixes both; inspect the resolved package/version before adding application aliases. [Package](https://unpkg.com/@vueuse/motion@3.0.3/package.json), [3.0.0 release](https://github.com/vueuse/motion/releases/tag/v3.0.0), [3.0.3 fixes](https://github.com/vueuse/motion/releases/tag/v3.0.3).
- Nuxt entrypoints are distinct: `motion-v/nuxt` and `@vueuse/motion/nuxt`. Nuxt module configuration is **not** SPA `app.use` setup. Motion for Vue uses `motionV` module options; VueUse Motion uses `motion` options. Do not enable colliding auto-imports/components/directives from both without explicit namespacing. Verify the installed Nuxt/module release before integration.
- SSR cannot know the browser's motion preference by default. Keep server/client initial content consistent and visible; attach browser listeners through setup composables/lifecycle, never read `window` at module evaluation. VueUse Motion components/directives serialize the **initial** variant; an initial opacity of zero can permanently hide content without JavaScript. Its components can be preferable for SSR/MDC styling, but do not make a hidden initial variant accessible. [VueUse Motion SSR](https://motion.vueuse.org/getting-started/nuxt/).
- `KeepAlive` deactivation is not unmount: stop custom loops/subscriptions/imperative animation on `onDeactivated` and restart only required work on `onActivated`. Motion for Vue restored cached-component exits/enters in **2.4.2**; that old regression is not a reason to remove presence in the 2.8.0 baseline. Do not assume exit retention solves route focus or cached-view lifetime. [Historical fix](https://github.com/motiondivision/motion-vue/releases/tag/v2.4.2); see [routing](routing.md).
- Prefer transform/opacity for small effects; avoid layout reads interleaved with style writes, perpetual idle animation, forced GPU layers, and animating every virtualized row. Library transforms create stacking/containing contexts; inspect fixed overlays, clipping, and hit targets rather than blindly raising `z-index`.

For incumbent presence/debug tooling, the v2 discovery attribute (historically `data-ap`) is not arbitrary application metadata: `motionGlobalConfig.motionAttribute` controls both presence discovery and visual-element hierarchy. Preserve it through DOM wrappers; change it only once, before mounting any participating tree, if an integration truly requires another attribute. `mountedStates` and inject/provide helpers expose implementation/context plumbing, not an independent animation ownership layer; use public MotionConfig/LayoutGroup/variant providers rather than writing state-map entries or fabricating contexts. Root `delayInMs` is a deliberately millisecond-named engine utility even though motion-v transition durations are seconds; never convert every number mechanically during a migration. [Discovery configuration](https://unpkg.com/motion-v@2.8.0/dist/es/config.d.ts), [exports](https://unpkg.com/motion-v@2.8.0/dist/es/index.d.ts).

## Verification boundary and acceptance checks

Complete SFCs target Vue 3.5 with their named selected dependency. The [verification record](../assets/verification.json) defines executed compiler/type scopes, not a universal motion/browser/accessibility pass. The list/plugin-entry and motion-value setup fragments are explicitly contextual, not standalone applications; the Nuxt configs require an existing Nuxt project.

The recorded isolated production consumers exercised native Motion attributes/transform, live reduced-motion decoration ownership, its config-only mount-time limitation, and the exact retained Popmotion selected-state/reduced-preference SFC. The recorded controller/template-ref collision crashed production mounting; renaming the controller fixed it. Those application-source checks used the existing `skipLibCheck: true` profile; a separate recorded compiler confirmed the excluded SFC factory and full-declaration failures. These are historical observations, not fresh execution during source review. None of this certifies all recipes, SSR hydration, gesture accessibility or every engine patch.

Application-source typechecking is not complete dependency-declaration compatibility: apply the [exact-graph restriction](#baseline-and-selection) before selecting native Motion APIs. The separate full-declaration consumer also reported missing ambient Bluetooth/Temporal/HTMLWebViewElement names. Those are **ambient coverage requirements**, distinct from Motion's concrete wrong-module `MaybeRef` import and `HTMLAttributes.onDrag` conflict; adding ambient declarations cannot fix the import/signature defects. SFC `motion.create` remains excluded independently by its TS2769 factory constraint. Report each gate's actual scope rather than calling an application build with library checking skipped a full declaration pass.

The integration owner should exercise: static/SSR content with JavaScript unavailable; initial and live reduced preference; rapid repeated activation and stop; unmount during animation; focus before/after removal; touch and keyboard activation; stable identity after sort/reset; layout inside scrolled/fixed ancestors; and no stale async sequence writing after disposal. Assert real business/DOM state rather than waiting a fixed animation duration. Inspect that no duplicate transition engine or global directive owns the same element. These are proposed checks, not reported passes.

## Sources

- Vue: [Transition](https://vuejs.org/guide/built-ins/transition.html), [TransitionGroup](https://vuejs.org/guide/built-ins/transition-group.html).
- Motion for Vue: [2.8.0 package](https://unpkg.com/motion-v@2.8.0/package.json), [exports](https://unpkg.com/motion-v@2.8.0/dist/es/index.d.ts), [motion props](https://unpkg.com/motion-v@2.8.0/dist/es/components/motion/props.d.ts), [documentation](https://motion.dev/docs/vue), [release](https://github.com/motiondivision/motion-vue/releases/tag/v2.8.0).
- VueUse Motion: [3.0.3 package](https://unpkg.com/@vueuse/motion@3.0.3/package.json), [declarations](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.d.mts), [runtime](https://unpkg.com/@vueuse/motion@3.0.3/dist/index.mjs), [documentation](https://motion.vueuse.org/).
- W3C: [animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), [pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), [reduced-motion media feature](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion).
