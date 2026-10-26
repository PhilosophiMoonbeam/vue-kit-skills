# Vue core: state, effects, and rendering

Read for local reactive state, watcher timing, lifecycle ownership, or a rendering bottleneck. Target: **Vue 3.5.44**, stable Virtual DOM runtime. Composition API with `<script setup lang="ts">` is the default; preserve incumbent Options API/JSX where a narrow change does not require migration. Component contracts belong in [components](components.md), reusable effects in [composables](composables.md), version exclusions in [migration](migration.md).

## Choose state by its mutation contract

| Requirement | Choice | Important boundary |
| --- | --- | --- |
| Primitive or replaceable object with nested mutations | `ref()` | Script uses `.value`; object values become deeply reactive. |
| Cohesive object mutated in place | `reactive()` | Keep the proxy identity; replacing a local variable does not reconnect existing consumers. |
| Opaque SDK/class instance or externally owned immutable snapshot | `shallowRef()` | Only `.value` tracking; replace the root to notify consumers. Existing reactive values remain reactive. |
| Root properties reactive, nested values deliberately unmanaged | `shallowReactive()` | Nested mutations do not notify; avoid embedding it inside a deep reactive tree. |
| Derived value | `computed()` | Pure synchronous getter; do not fetch, mutate source state, or emit inside it. |
| Read-only consumer surface | `readonly()` or getter-only `computed()` | Read-only is not a cloned snapshot. Original owner can still mutate source state. |

`ref(0)` is valid, idiomatic Vue. There is **no official universal performance rule** requiring `shallowRef()` for numbers, strings, or booleans. Shallow APIs are an explicit ownership/performance trade-off, not a blanket replacement. [Core API](https://vuejs.org/api/reactivity-core.html#ref); [advanced API](https://vuejs.org/api/reactivity-advanced.html#shallowref).

Complete SFC: retain source state; derive a filtered view without changing the original collection.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

interface Task { id: number; title: string; done: boolean }
const tasks = ref<Task[]>([
  { id: 1, title: 'Read the component contract', done: false },
  { id: 2, title: 'Define state ownership', done: true },
])
const hideCompleted = ref(false)
const visibleTasks = computed(() =>
  hideCompleted.value ? tasks.value.filter(task => !task.done) : tasks.value,
)
const remaining = computed(() => tasks.value.filter(task => !task.done).length)
</script>

<template>
  <label><input v-model="hideCompleted" type="checkbox" /> Hide completed</label>
  <p>{{ remaining }} remaining</p>
  <ul>
    <li v-for="task in visibleTasks" :key="task.id">
      <label><input v-model="task.done" type="checkbox" /> {{ task.title }}</label>
    </li>
  </ul>
</template>
```

### Tracking and identity edge cases

- Destructuring a primitive property from `reactive()` makes a snapshot. Use `toRef(state, 'count')`, `toRefs(state)`, or a getter. Destructuring an object property retains that object's proxy, but loses connection to later replacement of the parent property.
- Vue 3.5 reactive `defineProps()` destructure is a **compiler exception**, not general JavaScript destructuring behavior. See [components](components.md#sfc-and-typescript-boundaries).
- Reactive object properties unwrap refs; reactive array elements and `Map` entries do not. In script, use `.value` for those ref entries. Template unwrapping is primarily for top-level render-context refs; do not rely on arbitrary nested unwrapping.
- Proxy identity differs from the original object. Work through the proxy; do not keep `toRaw()` references as a parallel mutable store. `markRaw()` opts out only at its marked root; nested raw/proxy mixtures can still have identity hazards.
- `.sort()` and `.reverse()` mutate arrays. Copy first inside a computed getter when sorting a source array; derived results themselves are not a second source of truth.
- A computed caches by reactive dependencies, not wall-clock time. `computed(() => Date.now())` is not a clock; use an owned timer only when the product needs one.
- A writable `computed({ get, set })` is an adapter to existing source state, not another storage location. Type the setter input and keep normalization in that setter/action; do not mutate a getter-only computed or its derived array.
- Let `ref`/`computed` infer ordinary values; use `ref<User | null>(null)` for an absent asynchronous value and explicit result interfaces at public boundaries. A `reactive()` result unwraps nested refs, so its result type need not equal its input generic. Prefer an annotated source/interface plus inference over asserting a proxy is an arbitrary application type.

## Select an effect, then its schedule

| Need | API / schedule | Avoid |
| --- | --- | --- |
| Value derived from reactive inputs | `computed()` | Watcher-maintained duplicate state. |
| Side effect with explicit dependencies | `watch(refOrGetter, callback)` | `watch(state.count, ...)`, which passes a number. |
| Side effect whose synchronous reads are its dependencies | `watchEffect()` | Assuming reads after the first `await` are tracked. |
| DOM read after the owning component updates | `watch(..., { flush: 'post' })` / `watchPostEffect()` | Reading pre-update DOM in a default watcher. |
| DOM read after one specific mutation | `await nextTick()` | Treating `onUpdated()` as tied to a particular state field. |
| Immediate low-volume invalidation | `flush: 'sync'` / `watchSyncEffect()` | Sync watchers on arrays or sources changed repeatedly; no batching. |

`watch` is lazy unless `immediate: true`; default-flush `watchEffect` runs immediately. `watchEffect(..., { flush: 'post' })` / `watchPostEffect` defer even their first run until post-render. An `immediate: true` **watch callback** still runs immediately, including with `flush: 'post'`; that schedule governs later invalidations. Default watcher callbacks run after parent updates and before the owner's DOM updates. Sources may be refs, getters, reactive objects, or arrays of sources. Reads inside a `watch` callback are not additional tracked sources. [Watcher guide](https://vuejs.org/guide/essentials/watchers.html); [3.5.44 scheduling](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiWatch.ts).

Watch getters track the reactive reads used to produce their result, but the callback normally runs only when that result changes (`Object.is` comparison), not on every dependency mutation. Use an array of sources when each input change matters independently; a getter returning a fresh array/object creates a different result on each reevaluation. Deep traversal and direct reactive sources have their own trigger rules; none supplies an automatic historical snapshot.

- Directly watching a reactive object is implicitly deep. A getter returning that object tracks replacement unless `deep` is requested.
- In **3.5**, `deep` accepts a maximum traversal depth number. `deep: true` traverses nested properties; do not use it to compensate for an incorrectly chosen source. On nested mutation, old and new values can be the same proxy, not before/after snapshots.
- For an array ref, replacement is observed by default; `deep: 1` observes replacement and array mutations in 3.5 without traversing fields inside each entry. Watch a projection when the actual dependency is narrower.
- Watch handles are callable stop functions with `pause()`, `resume()`, and `stop()`. Pausing does not dispose a resource; use stop/cleanup for ownership termination. `once: true` (3.4+) stops after its single invocation; `immediate` also invokes the callback, so do not assume it means “initial run plus one change.”

### Cleanup and effect ownership

Register watchers synchronously during setup so Vue stops them on unmount. A watcher created later in a timer or arbitrary promise callback is not automatically component-owned. Prefer a synchronous watcher with a condition; otherwise retain and stop its handle explicitly. `effectScope()` captures watch/watchEffect effects created synchronously inside `scope.run()`; `onScopeDispose()` belongs to that active scope, not necessarily a component. Stopping a scope does not freeze retained computed refs: their pure getters can still evaluate when read. See [composables](composables.md#ownership-beyond-components).

`onWatcherCleanup()` is available in **3.5** and must run synchronously in the watcher/effect callback, before any `await`. The callback's `onCleanup` parameter is bound to its watcher and is not subject to that synchronous API restriction; nevertheless register resource cleanup before starting/awaiting work to avoid invalidation gaps. Registration after that watcher has already stopped cannot retroactively run its stop cleanup. A delayed/filtered callback is not the watcher's synchronous execution context; see [VueUse watch workflows](vueuse.md#watch-workflows-filtering-echo-suppression-and-bounded-waiting). Abort plus current-input protection is demonstrated in [composables](composables.md#async-results-must-belong-to-the-current-input). [Bound cleanup and stop implementation](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/watch.ts).

Complete SFC: measure current content only when its specific dependency changes.

```vue
<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'

const expanded = ref(false)
const panel = useTemplateRef<HTMLElement>('panel')
const height = ref(0)
watch(expanded, () => {
  height.value = panel.value?.getBoundingClientRect().height ?? 0
}, { flush: 'post' })
</script>

<template>
  <button type="button" :aria-expanded="expanded" @click="expanded = !expanded">
    Toggle details
  </button>
  <div ref="panel"><p v-if="expanded">Details are now visible.</p></div>
  <output>Measured height: {{ height }}px</output>
</template>
```

## Lifecycle guarantees, not timing folklore

| Hook | Actual contract |
| --- | --- |
| `onBeforeMount` / `onMounted` | Before DOM creation / after own DOM insertion and synchronous children mount. Async children and Suspense descendants are not guaranteed mounted. |
| `onBeforeUpdate` / `onUpdated` | Before / after this component's DOM update. Multiple mutations can be batched into one update. Parent `onUpdated` follows child `onUpdated`. |
| `onBeforeUnmount` / `onUnmounted` | Instance still usable / children unmounted and setup-owned effects stopped. Release manually created timers, connections, and listeners. |
| `onActivated` / `onDeactivated` | Cached-tree activation/deactivation, including initial mount/final unmount. See KeepAlive in [components](components.md#async-components-and-built-in-boundaries). |
| `onErrorCaptured` | Descendant errors; render an alternative subtree, not the same failing content. Return `false` only when deliberately stopping further propagation/reporting. |
| `onServerPrefetch` | Server render awaits the registered promise; coordinate transferred data to avoid duplicate client work. See [SSR/debugging](debugging-ssr.md). |

Register lifecycle hooks synchronously during setup. DOM lifecycle hooks do not run during SSR. Browser globals belong in client-only execution, not module initialization or server setup.

Synchronous registration can occur inside an ordinary helper called from setup; it need not be lexically in the SFC. Arbitrary async continuations lose that active instance/scope. The compiler restores instance context for top-level `<script setup>` await, an explicit exception rather than permission to call lifecycle/injection helpers after any await; see [SFC boundaries](components.md#sfc-and-typescript-boundaries).

**Do not mutate component state in `onUpdated()`.** A source example that writes a “last synced” ref inside `updated` conflicts with the official infinite-loop warning. Use an explicit event/action, a targeted watcher, or `nextTick` after the relevant mutation instead. `onUpdated` is appropriate for unavoidable post-render synchronization, including reading latest non-reactive attrs; it is not a universal persistence trigger. There is no framework guarantee of 60fps. [Official lifecycle contract](https://vuejs.org/api/composition-api-lifecycle.html#onupdated).

## Render declaratively and optimize with evidence

- Use stable primitive identity keys for reorderable stateful lists. Put a group key on `<template v-for>` when grouping multiple nodes. `v-if` has higher precedence than `v-for`; filter with a computed or place the condition outside the loop.
- `v-if` creates/destroys the subtree; `v-show` always renders and toggles CSS display, retaining its state and effects. Choose using lifecycle requirements and measured toggle/initial-render costs, not “always prefer v-show.”
- Interpolation escapes text. Never compile untrusted templates; never pass untrusted HTML to `v-html`. HTML injection requires an explicit, audited sanitization policy; Vue does not provide a sanitizer.
- Scoped SFC CSS adds selectors; it is not Shadow DOM isolation. Keep tokens/resets global, use local classes for component styling, and use `:deep()`/`:slotted()` deliberately rather than reaching through library internals.
- First measure load or update time in the relevant production-like interaction. Use browser profiling, Vue DevTools, and development `app.config.performance` markers; record the scenario, dataset, and before/after evidence. Do not infer an app improvement from a release benchmark.
- For update hotspots, keep child props stable, avoid unnecessary fresh-object computed results, and virtualize large lists via [virtualization](virtualization.md). Since 3.4, computed consumers need not rerun when the computed value stays unchanged; returning a fresh object defeats reference stability. If manually reusing the previous result, evaluate all dependencies before the equality decision.
- `v-once` intentionally freezes a subtree after initial rendering. `v-memo` skips updates based on a complete dependency tuple; an omitted dependency can leave stale UI. Use only after profiling, not for correctness or as a default on lists.
- `shallowRef`/`shallowReactive` can reduce proxy overhead in large immutable structures, but require a different update contract. Removing a few component boundaries has no established meaningful gain; review abstraction cost only in measured hot repeated paths.
- Lazy load noncritical components/routes when bundle evidence supports it; route lazy loading is not `defineAsyncComponent`. See [routing](routing.md) and [setup/tooling](setup-tooling.md).

### Memoization is a complete dependency contract

`v-memo` takes a fixed-length array compared with the previous render; `[]` intentionally freezes like `v-once`. For list items, place `v-memo` on the **same element** as `v-for`, not a descendant. Include every parent-rendered value/prop whose change must update that subtree, including locale, permissions, and object replacement when relevant. It does not disable a child's independently scheduled reactive effects. The source rule “never memoize a child with local state” is too broad; stale parent-provided props/listeners are the actual contract risk. [Directive semantics](https://vuejs.org/api/built-in-directives.html#v-memo).

Contextual template fragment: `items` is an immutable array of `{ id: number; title: string }`; `selectedId` is a reactive selection. Replacing an item changes its tuple identity; selection changes only invalidate the old/new selected rows.

```html
<ul>
  <li v-for="item in items" :key="item.id" v-memo="[item, item.id === selectedId]">
    {{ item.title }} <span v-if="item.id === selectedId">Selected</span>
  </li>
</ul>
```

If items mutate in place, include `item.title` too or remove memoization. Static template content already receives compiler optimizations; do not add `v-once` mechanically. Count repeated component instances with DevTools and record update cost before flattening behavior-bearing rows. Neither “100 rows” nor a component-count multiplier establishes a memory or FPS guarantee. Virtualization needs a bounded scroll viewport, stable row IDs and an estimated/measured size; it trades DOM count for focus, accessibility, search/print and SSR considerations. [Virtualization](virtualization.md) owns library-specific fixed/variable-height implementations.

## Trace tracking before changing state architecture

1. Identify the stale read or unexpected render and its owner. Check `.value`, proxy replacement/destructure, shallow nested writes, readonly props, and watch source selection before adding deep traversal or force updates.
2. In development, use `onRenderTracked` to inspect render reads and `onRenderTriggered` to inspect invalidations. Debugger events expose `target`, `key`, operation `type`, and old/new values where applicable; collection iteration can be the dependency rather than one field. These component hooks do not run in SSR.
3. For a suspected derivation/effect, pass `onTrack`/`onTrigger` to `computed`'s debug-options argument or watcher options. Break/filter by the relevant target/key; do not log entire sensitive state graphs. These options are development-only. Computed debug options are disabled during SSR component setup; watcher debug options are not categorically SSR-disabled and can run for a watcher that executes there. [3.5.44 watcher branch](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/watch.ts), [computed branch](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiComputed.ts).
4. Distinguish dependency invalidation from actual DOM updates: batching, computed stability, and memoization can skip work. Check the interaction in a production-like profile after correctness is restored; do not ship debug hooks as performance instrumentation.

Complete diagnostic SFC (development inspection, no claimed production telemetry):

```vue
<script setup lang="ts">
import { computed, onRenderTriggered, ref } from 'vue'
const count = ref(0)
const doubled = computed(() => count.value * 2, {
  onTrack(event) {
    if (event.key === 'value') console.debug('Computed dependency', event.type, event.key)
  },
})
onRenderTriggered(event => console.debug('Render invalidated', event.type, event.key))
</script>

<template>
  <button type="button" @click="count++">{{ count }}; double {{ doubled }}</button>
</template>
```

For shared state, first choose its lifetime: local component, nearest scoped provider, app store, or server cache. A per-call composable does not share state; a module singleton shares across every importer, including SSR requests. Use readonly views/actions for provider-owned invariants. [State](state.md) owns Pinia setup/Options stores, `storeToRefs`, grouped patches/reset, subscriptions/plugins, persistence and isolated store testing; [composables](composables.md) owns explicit effect lifetimes. Pinia is not automatically request-safe without a per-request installed instance.

## Verification boundary

The Vue fences are complete SFCs; the memoized HTML fence is explicitly a contextual template fragment. Mounting requires the host application's Vue toolchain. These are authored patterns, not claimed executed tests. For an implementation, verify nested mutation versus replacement, list reorder identity, memo dependencies, watcher batching, scope teardown, SSR browser-global safety, and the actual user interaction before calling a performance change successful. Testing workflow: [testing](testing.md).

## Sources

- [Vue 3.5.44 registry metadata](https://registry.npmjs.org/vue/3.5.44) and [pinned reactive declarations](https://unpkg.com/@vue/reactivity@3.5.44/dist/reactivity.d.ts).
- [Reactivity core](https://vuejs.org/api/reactivity-core.html), [advanced reactivity](https://vuejs.org/api/reactivity-advanced.html), [watchers](https://vuejs.org/guide/essentials/watchers.html).
- [Vue 3.5.44 ref implementation](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/ref.ts), [watch source/comparison/cleanup implementation](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/watch.ts).
- [Lifecycle API](https://vuejs.org/api/composition-api-lifecycle.html), [performance guide](https://vuejs.org/guide/best-practices/performance.html), [security](https://vuejs.org/guide/best-practices/security.html).
- [Built-in memo directives](https://vuejs.org/api/built-in-directives.html#v-memo), [reactivity debugging](https://vuejs.org/guide/extras/reactivity-in-depth.html#reactivity-debugging), [TypeScript Composition API](https://vuejs.org/guide/typescript/composition-api.html).
