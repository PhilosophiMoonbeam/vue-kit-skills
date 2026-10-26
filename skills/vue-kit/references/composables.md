# Composables: reactive inputs, ownership, and current results

Read when extracting stateful behavior, accepting values/refs/getters, adapting external state, or preventing stale asynchronous writes. Target: **Vue 3.5.44**. `MaybeRefOrGetter`, `toValue`, and getter normalization with `toRef` are stable since 3.3; `onWatcherCleanup` is 3.5+. See [core Vue](core-vue.md) for tracking/scheduling and [components](components.md) for public component contracts.

## Define the contract before extracting

1. Use a plain function for stateless calculation. Use a composable for cohesive stateful behavior, including a single-use workflow whose ownership becomes clearer when extracted.
2. Identify input semantics: reactive read, initial snapshot, writable state, callback, or external service. Do not use one ambiguous union for all five.
3. Create per-call state inside the function. Share an instance only through an explicit provider/store with an appropriate lifetime; mutable module singletons can leak across SSR requests.
4. Return a plain object of consumer-facing refs/computed values and actions. Destructuring that object keeps its refs; returning `.value` snapshots does not. Returning a reactive object is valid when documented, but consumers must not destructure its primitive properties as though they were refs.
5. Co-locate listeners, timers, subscriptions, pending work, and disposal. A coordinator composes focused capabilities rather than hiding unrelated implementations behind one broad facade.
6. Use an options object for cohesive optional configuration when positional flags become ambiguous; document defaults and whether each option is live or snapshotted. Do not bundle unrelated services solely to shorten the parameter list.

These are architectural recommendations. Vue's guarantees concern dependency tracking and effect scopes, not a compulsory file layout or mandatory composable for every small handler.

## Normalize only where reactivity is collected

| Input contract | Type / normalization | Semantics |
| --- | --- | --- |
| Read current plain/ref/computed/getter value | `MaybeRefOrGetter<T>` + `toValue(source)` | Functions are invoked as getters. Read inside computed/watch source/watchEffect. |
| Read a getter as a ref | `toRef(() => props.count)` | Readonly getter ref; not writable state. |
| Link an existing object's property | `toRef(state, 'count')` | Writes target that property; readonly props remain readonly. |
| Mutate caller-owned state | Explicit writable `Ref<T>` or explicit getter/setter contract | Passing a plain value cannot create two-way linkage back to the caller. |
| Callback/predicate/comparator value | Function type, or clearly documented `Ref<FunctionType>` + `unref` | Do not feed an actual callback to `toValue`: it will invoke it. |
| Initial default only | Plain `T`, copied once | Say “initial”; later changes deliberately do not sync. |

`toValue()` does not create a reactive effect. Calling it once outside an effect captures a value. `toRef(value)` returns an existing ref unchanged, wraps a plain value, or creates a readonly getter ref; it does not make a plain caller variable writable by reference. A `MaybeRef<T>` convenience input can support a local editable copy, but is not a promise that every accepted value writes back to the caller. [Normalization APIs](https://vuejs.org/api/reactivity-utilities.html#tovalue).

Complete pure-derived module:

```ts
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export function useClamped(
  source: MaybeRefOrGetter<number>,
  minimum: MaybeRefOrGetter<number>,
  maximum: MaybeRefOrGetter<number>,
) {
  return computed(() => {
    const lower = toValue(minimum)
    const upper = toValue(maximum)
    return Math.min(upper, Math.max(lower, toValue(source)))
  })
}
```

Contract: caller supplies `minimum <= maximum`; this is a mathematical derivation, not input validation. For destructured props, pass `() => count`, not `count`. Getter inputs must be pure; computed/watch may call them repeatedly. Use `watch(() => toValue(source), ...)` for explicit dependencies or normalize during the synchronous part of `watchEffect`; reads after `await` are not collected by watchEffect.

## Async results must belong to the current input

Cancellation is necessary resource cleanup, but not sufficient proof of freshness: a loader may ignore abort, or an old promise may settle after the source changes but before a batched watcher reruns. Check both the run's active flag and the **current normalized input** immediately before every success/error commit. Mask obsolete state during that pre-flush gap as well.

Complete `useLatestTask.ts`. This is a **local latest-result primitive**, not a cache, retry layer, SSR payload manager, or mutation executor. The injected loader is an application-owned contract that returns a real result; it is not claimed implemented by this module. Its `key` must encode every reactive dependency affecting the result. Calls occur in an active component/effect scope.

```ts
import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'

export type TaskState<T> =
  | { readonly key: string; readonly status: 'pending' }
  | { readonly key: string; readonly status: 'success'; readonly data: T }
  | { readonly key: string; readonly status: 'error'; readonly error: unknown }

export function useLatestTask<T>(
  source: MaybeRefOrGetter<string>,
  load: (key: string, signal: AbortSignal) => Promise<T>,
) {
  const state = shallowRef<TaskState<T>>({
    key: toValue(source),
    status: 'pending',
  })

  const stop = watch(() => toValue(source), async (key, _previous, onCleanup) => {
    const controller = new AbortController()
    let active = true
    onCleanup(() => {
      active = false
      controller.abort()
    })
    const isCurrent = () => active && toValue(source) === key
    state.value = { key, status: 'pending' }
    try {
      const data = await load(key, controller.signal)
      if (isCurrent()) state.value = { key, status: 'success', data }
    } catch (error: unknown) {
      if (isCurrent()) state.value = { key, status: 'error', error }
    }
  }, { immediate: true })

  const current = computed<TaskState<T>>(() => {
    const key = toValue(source)
    return state.value.key === key ? state.value : { key, status: 'pending' }
  })
  return { current, stop }
}
```

Why the pieces matter:

- `onCleanup` is registered before awaiting the loader. Invalidation/stop aborts and makes all later completions from that run ineligible, even if the loader ignores its signal.
- Comparing the live key prevents an old completion from committing during Vue's default batched-watcher delay. `current` prevents a previous key's success/error from being exposed as the new key's state during that same gap.
- Cleanup's active flag distinguishes two different runs for the same key, such as `A → B → A` across flushes. Intermediate changes batched away do not create requests. This is “latest watched input,” not an audit of every mutation.
- Pending/success/error are one atomic tagged snapshot; an old `finally` cannot clear a newer loading flag. Errors from invalidated runs are intentionally discarded; current loader failures remain visible, including a current abort failure not caused by this composable's cleanup.
- `shallowRef` is intentional here: results are externally owned snapshots. Consumers must not mutate nested `data` and expect Vue to observe it. The returned computed protects assignment to `.value`, not deep runtime immutability of arbitrary `T`.
- Stopping disposes work but is not a reload API. If cache identity, background refetch, retries, deduplication, pagination, or SSR data transfer is required, use the incumbent [TanStack Query](tanstack-query.md), [Pinia Colada](pinia-colada.md), or framework data layer rather than expanding this primitive silently.

In an SSR component, start this primitive after mount rather than using it for server data. Vue 3.5.44 immediately stops an eager default-flush watcher created during server setup; it does not await that callback's promise. Here that cleanup aborts the run and prevents its result from committing. Use `onServerPrefetch` with request-owned data transfer or the framework data layer for server-rendered results. [Pinned SSR watcher branch](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiWatch.ts).

## DOM effects: create on the client, follow target replacement

Complete `useClickCount.ts`. Called synchronously during component setup, it watches a possibly-null template target only after mount, removes the listener before moving to another target, and disposes at scope termination.

```ts
import {
  onMounted, onScopeDispose, readonly, ref, toValue, watch,
  type MaybeRefOrGetter, type WatchStopHandle,
} from 'vue'

export function useClickCount(target: MaybeRefOrGetter<HTMLElement | null>) {
  const count = ref(0)
  let stop: WatchStopHandle | undefined
  let disposed = false
  const increment = () => { count.value++ }

  onMounted(() => {
    if (disposed) return
    stop = watch(() => toValue(target), (element, _old, onCleanup) => {
      if (!element) return
      element.addEventListener('click', increment)
      onCleanup(() => element.removeEventListener('click', increment))
    }, { immediate: true, flush: 'post' })
  })
  onScopeDispose(() => { disposed = true; stop?.() })
  return { count: readonly(count) }
}
```

Contextual consumer: import `useTemplateRef` from Vue and `useClickCount` from this module, create `const button = useTemplateRef<HTMLButtonElement>('button')`, call `useClickCount(button)`, and render `<button ref="button">Count clicks</button>`. Avoid evaluating `window`/`document` in module scope or server setup. A `typeof window` guard does not make request-global mutable state safe. KeepAlive deactivation does not dispose a scope; explicitly suspend active-only listeners/timers via activation hooks when that is the contract.

The disposal flag also covers an enclosing effect scope stopped **before** mount: stopping that scope does not unregister the component's pending mounted hook. Without the guard, that hook would later create a watcher/listener after its intended owner had ended.

## Ownership beyond components

- Synchronously created setup effects stop automatically on component unmount. Non-Vue resources still require cleanup. Use `onScopeDispose` for a scope-oriented composable; use mount/unmount hooks when resources are specifically tied to rendered DOM.
- `effectScope()` owns watch/watchEffect effects created synchronously in `run()`. A detached scope (`effectScope(true)`) is independent; its creator must stop it. Async continuations do not automatically remain inside a prior `scope.run`. In **3.5.44**, retained computed refs are not disposed/frozen by scope stop; a later read can still evaluate their pure getter. Scope disposal must terminate side effects and resources, not rely on making derived values unreadable. [Pinned scope](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/effectScope.ts), [computed implementation](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/computed.ts).
- Do not suppress missing-scope warnings to conceal a lifetime bug. For utilities usable outside setup, accept explicit disposal ownership or return a disposer and document when it must run.
- Do not create a watcher in every event handler or timer tick. Create one watcher synchronously and gate it on readiness; otherwise stop each dynamically created watcher.
- `onWatcherCleanup` can be used by nested synchronous helpers within a watcher. It does not replace `onScopeDispose`, nor can it be registered after `await`. Prefer whichever explicit cleanup API matches the resource's real owner.

Complete explicit-owner module; no DOM/component hooks and no module-scope effects:

```ts
import { computed, effectScope, onScopeDispose, ref } from 'vue'

export function createTickCounter(periodMs: number) {
  const scope = effectScope(true)
  const counter = scope.run(() => {
    const ticks = ref(0)
    const doubled = computed(() => ticks.value * 2)
    const timer = setInterval(() => { ticks.value++ }, periodMs)
    onScopeDispose(() => clearInterval(timer))
    return { ticks: computed(() => ticks.value), doubled }
  })
  if (!counter) throw new Error('Counter scope was inactive')
  return { ...counter, dispose: () => scope.stop() }
}
```

Contract: a positive timer interval supplied by the application; creator calls `dispose()` at its actual lifetime boundary, including server request completion if used there. Do not call this merely to get a static computed value.

## External-state boundary

For a foreign store/SDK, keep its own semantics outside Vue's proxy graph. Define an application-owned adapter contract: `getSnapshot(): T`, `subscribe(listener: (snapshot: T) => void): () => void`. Store the current immutable snapshot in `shallowRef`, replace it on notifications, and register the unsubscribe with the owner scope. Determine from the actual store whether subscribing supplies an initial snapshot and whether a change can occur between reading/subscribing; do not assume every store has React-style subscription semantics.

Use `markRaw` for specific instances that must retain raw identity; do not mark all domain data raw. `triggerRef` is an explicit notification escape hatch for an integration that mutates its shallow value in place, not a general solution for missing dependency tracking. Prefer one adapter over scattering raw SDK objects and manual triggers across templates. [External state guidance](https://vuejs.org/guide/extras/reactivity-in-depth.html#integration-with-external-state-systems).

### Custom refs: control notification without losing ownership

Use `customRef` only when a ref-shaped integration needs explicit tracking/notification timing. Call `track()` in `get` and `trigger()` when the observable value actually commits. Do not return a fresh object from every getter: parent/child reference comparisons can then disagree with the custom ref's notification schedule. [Advanced reactivity](https://vuejs.org/api/reactivity-advanced.html#customref).

Complete module: a **local** debounced string ref. Assignment schedules the displayed value; there is no network request or implicit caller writeback. Call in an active scope with a nonnegative delay; scope disposal cancels any pending commit.

```ts
import { customRef, onScopeDispose } from 'vue'

export function useDebouncedText(initial = '', delayMs = 250) {
  let value = initial
  let timer: ReturnType<typeof setTimeout> | undefined
  const text = customRef<string>((track, trigger) => ({
    get() { track(); return value },
    set(next) {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (value !== next) {
          value = next
          trigger()
        }
      }, delayMs)
    },
  }))
  onScopeDispose(() => clearTimeout(timer))
  return text
}
```

For debouncing an existing reactive input instead, watch `() => toValue(source)`, keep a separate output ref, and clear the timer in watcher cleanup; do not claim assignment to the output updates a plain input. A debounced display model deliberately lags assignment, so do not substitute it for an immediate canonical form value without that UX contract.

### Numeric animation is derived display state

Complete browser-owned module: finite `source` values, a positive fixed duration, and a live reduced-motion boolean supplied by the application. Call during component setup. It preserves SSR's initial value, starts frames only after mount, cancels the old run on input change and cancels work at scope disposal. This linear interpolation is an authored implementation, not an upstream easing-library guarantee.

```ts
import {
  onMounted, onScopeDispose, readonly, ref, toValue, watch,
  type MaybeRefOrGetter, type WatchStopHandle,
} from 'vue'

export function useTweenedNumber(
  source: MaybeRefOrGetter<number>,
  reducedMotion: MaybeRefOrGetter<boolean>,
  durationMs = 300,
) {
  const displayed = ref(toValue(source))
  let stop: WatchStopHandle | undefined
  let disposed = false
  onMounted(() => {
    if (disposed) return
    stop = watch(
      [() => toValue(source), () => toValue(reducedMotion)],
      ([target, reduce], _old, onCleanup) => {
        if (reduce) { displayed.value = target; return }
        let active = true
        let frame = 0
        onCleanup(() => {
          active = false
          cancelAnimationFrame(frame)
        })
        const from = displayed.value
        let start: number | undefined
        function step(now: number) {
          if (!active) return
          if (toValue(source) !== target || toValue(reducedMotion) !== reduce) {
            frame = requestAnimationFrame(step)
            return
          }
          start ??= now
          const fraction = Math.min(1, (now - start) / durationMs)
          displayed.value = fraction === 1
            ? target
            : (from < 0) === (target < 0)
              ? from + (target - from) * fraction
              : from * (1 - fraction) + target * fraction
          if (fraction < 1) frame = requestAnimationFrame(step)
        }
        frame = requestAnimationFrame(step)
      },
      { immediate: true },
    )
  })
  onScopeDispose(() => { disposed = true; stop?.() })
  return readonly(displayed)
}
```

Render the returned display ref, not a duplicate domain field; changes restart from the last displayed value. The first frame's timestamp establishes the baseline: do not subtract an earlier `performance.now()` sample from a frame timestamp that can represent an earlier point in that frame. Same-sign endpoints use a bounded difference; opposite-sign endpoints use weighted terms so subtracting two finite extremes cannot overflow. Completion assigns the exact target. Use an installed animation library when its interpolation capabilities are needed, but kill its prior tween in the same watcher cleanup contract. Numbers outside JavaScript's safe precision are not made exact by tweening. See [animation-frame timestamp semantics](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame#timestamp), [component animation decisions](components.md#transition-and-persistent-element-animation-contracts), and [motion](motion.md).

Each frame also checks the live inputs before committing, so a frame queued before a batched watcher reruns cannot write an obsolete target or ignore a newly enabled reduced-motion preference. Cleanup marks that run inactive as well as cancelling its queued frame. The disposal flag prevents a pending mounted hook from starting frames after its enclosing scope has already stopped. Intermediate input changes batched away do not create separate runs.

## Nuxt and server boundaries

Plain Vue has no built-in auto-imported `useFetch`, `useAsyncData`, `$fetch`, `useState`, server API routes, or file-based pages. Those are framework/application contracts. The modules above explicitly import Vue; the local async primitive does not claim Nuxt SSR deduplication or hydration transfer. In an incumbent Nuxt app, inspect its exact Nuxt version and use the installed framework's request/data lifecycle; do not introduce a parallel generic fetch composable for SSR page data. See [SSR/debugging](debugging-ssr.md), [architecture/data](architecture-data.md), and [Nuxt data ownership](nuxt.md#data-payload-and-cancellation).

## Verification boundary

All TypeScript fences are complete modules with application-owned contracts stated above; the DOM consumer is explicitly contextual. They have not been claimed executed here. Verify value/ref/getter inputs, prop changes, callback-valued inputs, repeated mount/unmount, target replacement, and explicit disposal. For async behavior, use a controllable loader to resolve/reject old work after new work, ignore abort deliberately, change the input before the watcher flushes, change `A → B → A`, and stop while pending. Confirm no obsolete success/error/loading state is exposed. [Testing](testing.md) owns test mechanics.

## Sources

- [Vue 3.5.44 reactive declarations](https://unpkg.com/@vue/reactivity@3.5.44/dist/reactivity.d.ts), [reactivity utilities](https://vuejs.org/api/reactivity-utilities.html), [type utilities](https://vuejs.org/api/utility-types.html).
- [Official composable conventions and side effects](https://vuejs.org/guide/reusability/composables.html), [watcher cleanup and scheduling](https://vuejs.org/guide/essentials/watchers.html).
- [Effect scopes and shallow boundaries](https://vuejs.org/api/reactivity-advanced.html), [external state integration](https://vuejs.org/guide/extras/reactivity-in-depth.html#integration-with-external-state-systems).
- [Vue 3.5.44 watcher invalidation and stop cleanup](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/watch.ts), [value/ref/getter normalization](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/ref.ts).
- [Vue 3.5.44 mounted-hook instance ownership](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiLifecycle.ts), [effect-scope disposal](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/effectScope.ts), [SSR watcher handling](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiWatch.ts).
- [Custom refs](https://vuejs.org/api/reactivity-advanced.html#customref), [Vue animation techniques](https://vuejs.org/guide/extras/animation.html), [animation frame scheduling](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).
