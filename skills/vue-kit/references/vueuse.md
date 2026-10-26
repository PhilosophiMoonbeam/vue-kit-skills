# VueUse: reactive browser capabilities

Read when a feature needs browser events, storage, sensors, async task state, renderless wrappers, or reactive math. This reference owns `@vueuse/core`, `@vueuse/shared`, `@vueuse/components`, and `@vueuse/math`. Third-party wrappers belong to [integrations](vueuse-integrations.md); animation engines belong to [motion](motion.md). Read [composables](composables.md) for ownership and [SSR debugging](debugging-ssr.md) for request isolation.

## Version and import boundary

Verified baseline: **15.0.0** for all four packages, **Vue 3.5.44**. Each package declares Vue `^3.5.0`, Node `>=22`, and ESM. The peer range alone is not a compatibility test; the exercised scopes are recorded below. Keep VueUse package versions aligned. Core depends on and re-exports shared; components depends on core/shared; math depends on shared, not core. Install only the packages used:

```sh
bun add --exact @vueuse/core@15.0.0
bun add --exact @vueuse/components@15.0.0 @vueuse/math@15.0.0
```

Import composables from `@vueuse/core`; use `@vueuse/shared` directly in a shared-only package that declares it as a dependency. Import wrapper components/directives from `@vueuse/components`, math from `@vueuse/math`. No VueUse `app.use()` registration is required for named imports. ESM and engine boundaries come from the [published core manifest](https://registry.npmjs.org/@vueuse/core/15.0.0), [components manifest](https://registry.npmjs.org/@vueuse/components/15.0.0), [shared manifest](https://registry.npmjs.org/@vueuse/shared/15.0.0), and [math manifest](https://registry.npmjs.org/@vueuse/math/15.0.0).

### Authoring globals and reproducible typing scope

The exercised authoring profile uses **TypeScript 5.9.3**, **vue-tsc 3.3.13**, **`@types/web-bluetooth 0.0.21`**, and **`temporal-spec 1.0.1`**. Core's published declarations reference Bluetooth and global `Temporal` types, even when the selected consumer does not invoke those APIs. Use the real packages, not handwritten ambient replacements:

```sh
bun add --dev --exact typescript@5.9.3 vue-tsc@3.3.13 @types/web-bluetooth@0.0.21 temporal-spec@1.0.1
```

With `moduleResolution: "Bundler"`, include `"@types/web-bluetooth"` and `"temporal-spec/global"` in `compilerOptions.types`, preserving other entries the app actually needs. An explicit `types: []` excludes automatic package globals; installing the packages alone does not override that restriction. This does not disable normal typing of imported modules. Alternatively, load `temporal-spec/global` from an included declaration-only `.d.ts` file, not a runtime entry. [TypeScript global selection](https://www.typescriptlang.org/tsconfig/types.html), [Bluetooth declarations](https://unpkg.com/@types/web-bluetooth@0.0.21/index.d.ts), [Temporal globals](https://unpkg.com/temporal-spec@1.0.1/global.d.ts).

Keep `strict: true` and `vueCompilerOptions.strictTemplates: true`. Record `vue-tsc --noEmit -p tsconfig.declarations.json` with `skipLibCheck: false` separately from `vue-tsc --noEmit -p tsconfig.consumer.json` with `skipLibCheck: true`; the latter checks bounded source/template consumers, not declaration internals. Render components such as `UseMouse` additionally require **`@vueuse/components@15.0.0`**; installing core does not provide that import. Neither ambient package grants Bluetooth support/permission nor installs a Temporal runtime polyfill. A feature that actually uses either capability still needs its real runtime prerequisites. [Core manifest](https://unpkg.com/@vueuse/core@15.0.0/package.json), [components manifest](https://registry.npmjs.org/@vueuse/components/15.0.0), [declaration-checking boundary](https://www.typescriptlang.org/tsconfig/skipLibCheck.html).

## Choose the smallest owner

These are architectural recommendations, not upstream requirements.

| Need | Default | Material boundary |
| --- | --- | --- |
| Boolean toggle, pure derived value, pausable watch | Vue `ref`, `computed`, Vue 3.5 `watch` handle | Do not add a utility merely to rename two lines. `computedEager` and `watchPausable` are deprecated. |
| DOM event, intersection/resize observer, pointer/media capability | Core composable in the DOM owner | Inspect support refs, target lifetime, and stop/dispose contract. |
| One component-owned request | `useFetch`, or native fetch plus a scoped watcher | No shared cache, deduplication, invalidation, or server hydration ownership. |
| Arbitrary promise task | `useAsyncState` with a function | State tracking is not transport cancellation. |
| Shared server resource | [TanStack Query](tanstack-query.md) or incumbent [Colada](pinia-colada.md) | Query owns freshness, keys, invalidation, and cache; VueUse can supply reactive inputs. |
| Small persisted preference | `useStorage`/`useLocalStorage`/`useSessionStorage` | Browser storage is neither a secure credential vault nor an SSR state-transfer mechanism. |
| Shared UI capability | Scoped injection, or `createSharedComposable` | No request-private module singleton on SSR. |
| One simple calculation | Vue `computed` | Math wrappers are useful for repeated reactive projections/clamping, not mandatory. |
| Template-local capability | Components/directives | They do not supply accessible widget semantics. |

## Reactive inputs and disposal

Read the selected signature rather than assuming every option is reactive. `MaybeRef<T>` accepts a plain value/ref; `MaybeRefOrGetter<T>` also accepts a getter. Pass `() => props.id`, not `props.id`, when an API must track prop changes. Normalize getters with Vue `toValue` **inside** a computed/watch effect; evaluating once captures a snapshot. Functions that represent callbacks must not be indiscriminately normalized with `toValue`.

Call lifecycle-bound composables synchronously in setup or an explicitly owned effect scope. `useEventListener` watches reactive targets, detaches the old target on replacement, returns a stop function, and stops with its owning scope. A null template ref is normal before mount and after `v-if` removal. Outside setup, create an `effectScope`, construct utilities inside `scope.run`, and call `scope.stop` when the service ends. Do not assume every promise, debounce timer, or HTTP request participates in scope cleanup: check its implementation. [Event listener contract](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useEventListener/index.ts).

Never evaluate `window`, `document`, `navigator`, or `localStorage` at module initialization in universal code. Use default-target overloads, template refs, or mount-time access. Where a composable exposes `window`/`document`/`navigator` configuration, inject the correct browser realm rather than changing global objects. Options vary by function. An `isSupported` flag describes that function's checked capability, not all prerequisites of the feature.

### Runnable SFC: owned listener, debounce, and media query

This component needs only Vue and core. Typing schedules a local preview, not an HTTP request. Removing the input through `v-if` would detach its listener. `cancel()` clears pending debounce work; it does not cancel a function already running.

```vue
<script setup lang="ts">
import { onScopeDispose, ref, useTemplateRef } from 'vue'
import { useDebounceFn, useEventListener, useMediaQuery } from '@vueuse/core'

const input = useTemplateRef<HTMLInputElement>('input')
const draft = ref('')
const preview = ref('')
const compact = useMediaQuery('(max-width: 600px)', { ssrWidth: 1024 })
const updatePreview = useDebounceFn((value: string) => {
  preview.value = value.trim()
}, 250, { maxWait: 1000 })

useEventListener(input, 'input', () => {
  void updatePreview(draft.value)
})
onScopeDispose(updatePreview.cancel)
</script>

<template>
  <label>Preview text <input ref="input" v-model="draft" /></label>
  <p aria-live="polite">{{ preview || 'No preview text' }}</p>
  <p>Layout preference: {{ compact ? 'compact' : 'wide' }}</p>
</template>
```

For layout alone, prefer CSS media queries. `ssrWidth` supplies a deterministic width for width-query evaluation until browser support becomes available; it is not detection of the client's actual server-side viewport, nor an emulator for every media feature. Use the same server/client assumed width, or ancestor `provideSSRWidth`, when conditionally rendered width-dependent markup must hydrate consistently. Reduced-motion/color-scheme queries need their own SSR presentation decision. [Media query implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useMediaQuery/index.ts).

### Debounce, throttle, and timers

- `useDebounceFn(fn, ms, { maxWait, rejectOnCancel })` returns a promise-returning callable with `cancel`, `flush`, and readonly `isPending`. Cancellation resolves a pending call by default; `rejectOnCancel: true` requires a rejection handler. Neither mode aborts an already-started request. Cancel explicitly at scope disposal when a delayed callback must not outlive its owner.
- **v15 changes `useThrottleFn` to leading and trailing by default**: `useThrottleFn(fn, 200, false, true)` explicitly preserves leading-only behavior. Its public return type is a promise-returning function, not the debounce function's cancelable interface. Do not invent `.cancel()`/`.flush()` on it. Use a scoped active flag if an unavoidable trailing callback must not commit after disposal, or choose a utility with explicit cancellation. [Exact filters](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/shared/utils/filters.ts).
- `eventFilter: debounceFilter(...)` or `throttleFilter(...)` can limit updates at a composable that declares `ConfigurableEventFilter`. This changes observation cadence; it does not authorize dropping business operations such as saves.
- Prefer `useIntervalFn`/`useTimeoutFn` for controllable timers. For core APIs declaring `ConfigurableScheduler`, v15 removed deprecated timer options in favor of `scheduler`; do not mechanically remove `immediate` from unrelated APIs such as `useFetch`. Use the selected API's types. [v15 breaking changes](https://github.com/vueuse/vueuse/releases/tag/v15.0.0).
- `until(source).toBe(value, { timeout, throwOnTimeout: true })` is useful for bounded reactive waiting; `whenever` runs on truthy values. A timeout is not cancellation of whatever operation produces that value.

## `useFetch`: local request lifecycle, not a query cache

`useFetch(url, requestInit?, options?)` accepts a URL ref/getter. It runs immediately by default; `refetch` defaults to false. Changing a reactive URL does not itself reissue a request unless `refetch: true`. A ref payload can also be watched with refetch enabled; do not assume every nested option/getter has the same watching behavior.

Choose `.get().json<T>()`, `.text()`, or another body parser when constructing the request, before it starts. The JSON generic is a static type assertion, not runtime schema validation. `execute()` starts/refetches, aborting the previous request where supported; `abort()` requests cancellation. `canAbort`, `aborted`, `isFetching`, `isFinished`, `statusCode`, `response`, `data`, and `error` describe the local request. HTTP non-success responses are treated as errors. Fetch/response-processing failures are captured by default; `execute(true)` rejects them, so callers must catch it. Preparation failures can still reject even with the default flag, as explained below. Do not `await` an idle `immediate: false` shell before ever executing it: its thenable waits for completion.

**The v15 fetch promise chain guards response/data/error commits and its final loading update against a newer execute.** Preparation has a separate cancellation edge below; this is not a universal latest-execution guarantee. Response/error hooks and callbacks can still run for superseded requests. Keep irreversible actions out of those hooks, or apply application-specific identity checks there. No automatic scope-abort is installed in the v15 implementation; register it when the request must end with the owner. [Tagged implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useFetch/index.ts).

### Runnable SFC: manual fetch without an external service

A `data:` URL makes this an executable browser example rather than a fabricated API. Editing the message only changes the next request URL. A real backend would replace the URL, with its response/authentication contract defined separately.

```vue
<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import { useFetch } from '@vueuse/core'

const message = ref('Hello from a local payload')
const { data, error, isFetching, execute, abort, canAbort } = useFetch(
  () => `data:application/json,${encodeURIComponent(JSON.stringify({ message: message.value }))}`,
  { immediate: false, refetch: false },
).json<{ message: string }>()

onScopeDispose(abort)
</script>

<template>
  <form @submit.prevent="execute()">
    <label>Message <input v-model="message" /></label>
    <button type="submit" :disabled="isFetching">Load payload</button>
    <button type="button" :disabled="!canAbort" @click="abort()">Cancel</button>
  </form>
  <p v-if="isFetching" role="status">Loading</p>
  <p v-if="error" role="alert">{{ String(error) }}</p>
  <p v-if="data">{{ data.message }}</p>
</template>
```

Use `createFetch({ baseUrl, fetchOptions, options })` to share request policy. **`fetchOptions` is top-level**, beside `options`, not inside it. `beforeFetch` may alter request context or call `cancel`; `afterFetch` transforms parsed data; `onFetchError` transforms error context. These hooks return context patches. `updateDataOnError` is false by default. Construct authenticated factories per app/request, or read current credentials at execution: never close over one SSR user's credentials in a process-global factory. An absolute caller URL bypasses `baseUrl`; do not attach private authorization to arbitrary caller-controlled destinations.

Keep request preparation and hooks non-throwing or handle their actual rejection boundary. In published v15, payload serialization and awaited `beforeFetch` run before the fetch promise's catch/finally chain; a failure there rejects `execute()` and can leave `isFetching` true. Use the hook's `cancel()` for an intentional skip rather than throwing. Failures from `afterFetch` enter the fetch error path, but a throwing `onFetchError` rejects instead of finishing normal error publication. Do not mistake the default flag for a catch-all failure guarantee. [Pinned preparation and promise chain](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useFetch/index.ts).

Preparation cancellation also bypasses the latest-execution loading guard. If older execution A resumes from `beforeFetch` with `cancel()` set after B starts, A's skip branch sets `isFetching` false and `isFinished` true while B remains pending. Even a synchronous hook is awaited. Serialize this controller's executions through their settled promises when preparation can skip; do not use its loading flag alone as an overlap lock. Use the existing query owner for keyed concurrency. [Pinned skip branch](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useFetch/index.ts#L465-L481).

Nuxt's auto-imported `useFetch` has a different contract, SSR payload integration, and request behavior. Import explicitly from `@vueuse/core` only when deliberately choosing the VueUse API; see [data architecture](architecture-data.md).

## `useAsyncState`: promise state versus cancellation

Use a function for repeatable executions. Passing an already-created promise starts that work before VueUse can control its timing; `immediate: false` cannot undo that. Defaults: `immediate: true`, `shallow: true`, `resetOnExecute: true`, `throwError: false`. `execute(delay, ...args)` reserves its first argument for a delay; prefer `executeImmediate(...args)` when forwarding task arguments. Read `state`, `isLoading`, `isReady`, and `error` rather than assuming initial data proves success.

The v15 execution counter protects the latest state/error/loading commits. It does not cancel earlier work, prevent stale `onSuccess`/`onError` callbacks, or dispose a transport. A non-abortable operation still runs after the owner ends. [Exact implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useAsyncState/index.ts).

Supply an **async task function**, not a plain function that can throw before returning its promise. Published v15 invokes the task before entering its internal `try`: a synchronous throw bypasses its error/finally updates and can leave `isLoading` true. Also supply a non-throwing `onError` when the owner must handle/report failure locally; its default is `globalThis.reportError` when available, otherwise a no-op. `throwError: false` alone does not suppress that reporting.

When cancellation must also prohibit publication after input invalidation or owner disposal, an AbortController around `useAsyncState` alone is insufficient: its execution counter changes only when another execute starts. A canceled task can still resolve, and stopping the scope does not invalidate that counter. Use the existing query owner for shared resources; for a local URL-bound read, an ordinary scoped watcher provides the required publication boundary without a catch-all task wrapper.

Complete **client-mounted** SFC against an application-supplied public text URL (`null` means no request). It renders escaped text, not HTML. Every URL change after mount clears the previous identity's display, cancels the previous transport, and invalidates its success/error/finally commits; unmount does the same even if the transport ignores abort:

```vue
<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue'

const props = defineProps<{ url: string | null }>()
const text = shallowRef<string>()
const error = shallowRef<unknown>()
const pending = ref(false)

onMounted(() => {
  watch(() => props.url, async (url, _previous, onCleanup) => {
    let current = true
    const controller = new AbortController()
    onCleanup(() => {
      current = false
      controller.abort()
    })
    text.value = undefined
    error.value = undefined
    pending.value = url !== null
    if (url === null) return
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.text()
      if (current) text.value = body
    } catch (cause) {
      if (current) error.value = cause
    } finally {
      if (current) pending.value = false
    }
  }, { immediate: true, flush: 'sync' })
})
</script>

<template>
  <p v-if="pending" role="status">Loading text</p>
  <p v-if="error" role="alert">{{ String(error) }}</p>
  <pre v-if="text !== undefined">{{ text }}</pre>
</template>
```

The synchronous flush invalidates the old request as soon as the URL changes, before queued promise continuations can publish. The synchronous mounted hook creates a component-owned watcher; it does not run during SSR, so server and initial hydration render empty state without starting a server request. An immediate setup-time watcher would run during SSR even with `flush: 'sync'`. This is not a keyed cache or SSR prefetch integration. Do not attach private headers to arbitrary caller-controlled URLs. [Vue watcher cleanup](https://vuejs.org/guide/essentials/watchers.html#side-effect-cleanup), [SSR watcher implementation](https://github.com/vuejs/core/blob/v3.5.44/packages/runtime-core/src/apiWatch.ts), [v15 execution counter](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useAsyncState/index.ts).

## Storage and serialization

`useStorage(key, defaults, storage?, options?)` chooses a serializer from the default value; `useLocalStorage` and `useSessionStorage` choose browser stores. Core can return defaults without storage on the server. For browser-persisted values that affect initial markup, set `initOnMounted: true` so server and initial hydration both use defaults. This delays reading, not all possible storage access: storage selection itself may still encounter browser restrictions. Supply `onError` and explain whether failed persistence leaves a session-only preference. [Storage implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useStorage/index.ts).

Runnable SFC; a nullable default needs an explicit serializer:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { StorageSerializers, useLocalStorage } from '@vueuse/core'

const persistenceError = ref('')
const nickname = useLocalStorage<string | null>('vue-kit:nickname', null, {
  serializer: StorageSerializers.string,
  initOnMounted: true,
  onError: (cause: unknown) => {
    persistenceError.value = cause instanceof Error ? cause.message : String(cause)
  },
})
</script>

<template>
  <label>Nickname <input v-model="nickname" /></label>
  <button type="button" @click="nickname = null">Remove stored nickname</button>
  <p v-if="persistenceError" role="alert">Persistence failed: {{ persistenceError }}</p>
</template>
```

- Setting the removable ref to `null` removes the key; a future read can restore/write defaults depending on `writeDefaults`. This is not storage of a JSON null.
- `mergeDefaults: true` is a **shallow object merge**, not validation, deep schema migration, or array merging. A custom merge function owns real schema evolution. Existing stored values are untrusted input.
- Object serialization uses JSON. Dates, Maps, and Sets need the appropriate `StorageSerializers` entry or a custom `{ read, write }` codec; nested classes/prototypes and cycles do not become safe automatically.
- Browser storage can throw for access, quota, or serialization; it is origin-scoped, synchronous, and readable by page scripts. Keep secrets out. Storage events/same-document synchronization are not transactional consistency.
- Reactive keys select different storage records; use a deliberate user-specific namespace and clear it on logout if the product requires it. Never reuse server-global mutable default objects for request-private data.
- In Nuxt, explicitly import VueUse `useStorage`; framework auto-imports may refer to a server storage API with the same name.

## Shared utilities and SSR ownership

`createGlobalState` creates one lazy state in a detached scope **per factory closure**, not per Vue app or SSR request. A factory exported once from a server module can leak state between requests; component unmount does not dispose that detached scope. Avoid it for user/request state. A factory created per request can be isolated, but prefer request-owned provide/inject or the application's established state layer.

`createSharedComposable` shares one client instance until the last scoped subscriber leaves, then stops its scope and discards state. On the server it returns the original composable: calls are independent, not magically request-shared. That cannot repair a singleton already captured inside the original function. Arguments from the first client subscriber initialize the shared instance; later consumers do not get independent argument-specific instances. Unscoped consumers cannot release their subscription automatically. `createInjectionState` is useful when a real ancestor owns shared state; require the provider rather than silently creating a disconnected fallback. [Global implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/shared/createGlobalState/index.ts), [shared implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/shared/createSharedComposable/index.ts).

Other shared utilities need the same ownership discipline: `syncRef` couples writable refs and may need transforms when types differ; `refManualReset` provides explicit resettable state; `computedWithControl` deliberately narrows invalidation. Do not replace normal derived computed state with bidirectional synchronization or manually-triggered invalidation without a concrete requirement.

### Shared reactivity: preserve the source of truth

The [published shared declarations](https://cdn.jsdelivr.net/npm/@vueuse/shared@15.0.0/dist/index.d.ts) and [implementation](https://cdn.jsdelivr.net/npm/@vueuse/shared@15.0.0/dist/index.js) define these incumbent contracts. Prefer ordinary Vue computed/ref when these extra semantics are unnecessary.

| Requirement | Usable contract and failure boundary |
| --- | --- |
| Fallback/reset | `refDefault(source, fallback)` substitutes only nullish reads; writes reach the source. `refManualReset(defaultValue)` is shallow and `.reset()` re-evaluates a default getter; it does not clone an object default. `refAutoReset(defaultValue, ms)` schedules a reset after writes; it is not a durable expiry policy. |
| Delayed projection | `refDebounced(source, ms, { maxWait })` exposes a readonly delayed value; `refThrottled(source, delay, trailing, leading)` samples a ref and returns the original source when delay is nonpositive. Do not bind an editable field to a readonly delayed projection. |
| Explicit invalidation | `computedWithControl(source, getter)` tracks the declared source rather than all getter reads; `.trigger()` invalidates manually. Use only when omitted dependencies are intentionally stale. |
| Controlled writes | `refWithControl(initial, { onBeforeChange, onChanged })` can veto writes by returning false. `.peek()`/`.untrackedGet()` bypass tracking; `.lay()`/`.silentSet()` bypass notifications. These escape hatches can leave rendered dependents stale. |
| Coupled refs | `syncRef(left, right, { direction, transform, flush, immediate })` defaults to synchronous, immediate, bidirectional sync; provide directional transforms for different types and keep the returned stop handle. `syncRefs(source, targets)` is one-way and returns a watch handle. Prefer computed for a derivation, not a second writable authority. |
| Object views | `toReactive(refOfObject)` follows replacement through a proxy; `reactiveComputed(getter)` provides an object-shaped computed view. `reactivePick`/`reactiveOmit` create live subsets, not detached snapshots or access-control boundaries. |
| Ref conversion | VueUse `toRefs(refOfObject, { replaceRef: true })` replaces the object with a copy on property assignment; false mutates it in place. Its extended behavior differs from Vue's `toRefs`; import deliberately. Vue `toRef`/`toValue` suffice for normal getter normalization. |
| Adapt a pure function | `reactify(fn)` returns computed results and unwraps getters by default; `{ computedGetter: false }` passes getter functions through as values. `reactifyObject` applies that to selected function members. Neither is an async task controller. |
| Reactive collections | `useArrayMap`/`Filter`/`Find`/`FindIndex`/`FindLast`/`Every`/`Some`/`Join`/`Reduce` are computed projections; pass a ref/getter list rather than an evaluated snapshot. `useArrayDifference` supports key/comparator and symmetric mode; `useArrayUnique` supports a comparator. `useArrayIncludes` supports a comparator, but **15.0.0 does not recognize a `fromIndex`-only options object**: its option detector checks the misspelled `formIndex`. For an offset-only lookup, use an ordinary computed with `list.value.slice(fromIndex).includes(value)` rather than relying on that option shape. Compare stable identities explicitly for object collections and supply a reduce initial value for empty lists. [Pinned includes implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/shared/useArrayIncludes/index.ts). |
| Generic library helpers | `createRef(value, deep?)` is shallow unless deep is true; `extendRef` attaches properties (ref extensions unwrap by default); `makeDestructurable(object, tuple)` supports both consumer forms. These are facade ergonomics, not additional ownership. `isDefined` excludes null/undefined, not invalid domain values. |

### Watch workflows: filtering, echo suppression, and bounded waiting

Watch utilities forward Vue watch options, but their **return shapes and timing differ**. In a delayed debounced/throttled callback, use its passed `onCleanup` argument, not `onWatcherCleanup()`: the timer does not restore Vue's active watcher. Even bound cleanup cannot retroactively handle an invalidation/stop that occurred before that delayed callback started. If a side effect must end with its owner, use an explicitly cancelable `useDebounceFn` with scope cancellation and an active-owner guard, or a synchronous scoped watcher that owns its timer and cleanup; do not start new owned work from an already-queued filtered callback after stop. Filtering does not cancel a request already started. [Filter scheduling](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/shared/utils/filters.ts), [watch wrapper](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/shared/watchWithFilter/index.ts), [Vue active/bound cleanup](https://github.com/vuejs/core/blob/v3.5.44/packages/reactivity/src/watch.ts).

| Need | Contract |
| --- | --- |
| Ordinary watch | Prefer Vue `{ deep, immediate, once }` and native pause/resume; `watchDeep`, `watchImmediate`, and `watchOnce` are equivalent convenience imports. Deep watching does not provide a cloned old object. |
| Debounced/throttled observation | `watchDebounced(source, cb, { debounce, maxWait, ...watchOptions })`; `watchThrottled(source, cb, { throttle, leading, trailing, ...watchOptions })`. These return watch handles, not the cancelable debounce callable. Do not assume stopping the watcher cancels a filter's already-queued callback. |
| One gate across effects | `pausableFilter(extendFilter?, { initialState: 'paused' })` returns `{ eventFilter, isActive, pause, resume }`; pass its filter to `watchWithFilter` or an API declaring `eventFilter`. Pausing drops invocations rather than replaying a backlog. `createFilterWrapper(filter, fn)` adapts a raw filter; only a cancelable filter supplies cancel/flush/pending controls. |
| Apply remote state without an echo | `watchIgnorable(source, cb)` returns `{ stop, ignoreUpdates, ignorePrevAsyncUpdates }`. Put synchronous assignments inside `ignoreUpdates`; do not put an async operation there and expect later assignments to be ignored. The second method discards queued updates for asynchronous flush and is a no-op for `flush: 'sync'`. |
| Manual refresh plus watch | `watchTriggerable(source, cb)` adds `trigger()` to the ignorable interface. Manual triggering returns the callback result and supplies undefined old value(s); it is not a remembered previous observation. |
| Bounded subscriptions | `watchAtMost(source, cb, { count: limit })` returns `{ stop, pause, resume, count }`, where returned count is a tally. The implementation stops on nextTick after reaching the limit: do not use it as an exact synchronous quota/security gate. |
| Array membership | `watchArray(source, (list, old, added, removed, onCleanup) => ...)` diffs by identity with duplicate accounting. Use `{ deep: true }` if in-place array mutation must trigger it; immediate mode reports all initial items as added. Reordering existing identities is not an addition/removal. |
| Wait for state | `until(source).toBe`, `.toMatch`, `.changed`, `.changedTimes`, and array `.toContains` create one-shot watches; `.not` negates a condition. For a changing toBe comparand, pass a **ref/computed**, not a getter: despite the broad published type, v15 runtime watches both sides only when the comparand is a ref and otherwise compares the function itself. Set a timeout and `throwOnTimeout: true` when timeout must reject; otherwise timeout can resolve without the condition succeeding. Racing the promise does not itself stop the losing watch or producer. |
| Truthy transitions | `whenever(source, cb, { once: true })` observes truthy values only. It is not a generic event queue or a replacement for a guard that must inspect falsy transitions. |

Runnable setup-time composable: applying a received value does not echo it to the application-owned `publish` callback. Transport and error presentation belong to that callback's owner; this contract is synchronous.

```ts
import { ref } from 'vue'
import { watchIgnorable } from '@vueuse/core'

export function useMirroredText(initial: string, publish: (text: string) => void) {
  const text = ref(initial)
  const { ignoreUpdates, stop } = watchIgnorable(text, publish, { flush: 'sync' })
  function receive(value: string) {
    ignoreUpdates(() => { text.value = value })
  }
  return { text, receive, stop }
}
```

### Timers, formatting, and non-reactive helpers

- `useIntervalFn(cb, interval = 1000, { immediate: true, immediateCallback: false })` returns `{ isActive, pause, resume }`; changing a reactive interval re-arms an active client timer. `immediateCallback` invokes the callback on every resume, not just construction. `useInterval(..., { controls: true })` returns `{ counter, reset, isActive, pause, resume }`.
- `useTimeoutFn(cb, delay, { immediate, immediateCallback })` returns `{ isPending, start, stop }`; `start(...args)` replaces the pending timer and forwards arguments. It reads the delay when starting, not continuously. `useTimeout(delay, { controls: true })` returns `{ ready, isPending, start, stop }`.
- Automatic timer startup is client-guarded and scope disposal clears timers. **Explicit `resume()`/`start()` are not server-guarded in v15**; do not call them during SSR. `useTimeoutFn` can initially report pending on the server without a scheduled timer. This corrects the overly broad claim that these APIs are always server no-ops. [Interval source](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/shared/useIntervalFn/index.ts), [timeout source](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/shared/useTimeoutFn/index.ts).
- `useCounter(initial, { min, max })` clamps inc/dec/set/reset and returns the new number; reset can change its future reset baseline. `useToggle(initial)` returns `[state, toggle]`, but passing an existing ref returns only the function. Use `@click="toggle()"`, not a direct event handler that passes a MouseEvent as the value.
- `useToNumber(value, { method: 'parseFloat' | 'parseInt' | custom, radix, nanToZero })` converts; parsing prefixes is not numeric input validation. `useToString` is a computed string conversion. `useLastChanged(source, { initialValue, ...watchOptions })` records a timestamp, not an audit trail.
- `useDateFormat(date, 'YYYY-MM-DD [at] HH:mm:ss', { locales, customMeridiem })` is a reactive token formatter; `formatDate` and `normalizeDate` are non-reactive. Brackets quote literals; timezone-less inputs parse as local time. Its options do **not** provide a `timeZone`: `locales` selects localized names, not a zone. Use a stable initial string for SSR or the application's timezone-aware formatter when a fixed zone is required; this formatter does not make a clock deterministic. [Pinned formatter and options](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/shared/useDateFormat/index.ts).
- `createSingletonPromise(factory)` shares one promise until awaited `.reset()`; it is not retry policy or a keyed cache. `promiseTimeout(ms, true)` rejects on timeout but does not abort work. `clamp`, inclusive-integer `rand`, `now`/`timestamp`, `objectPick`/`objectOmit`/`objectEntries`, `toArray`, `hasOwn`, `containsProp`, `isDef`/`notNullish`, `identity`/`invoke`, `get`/`set`, and `hyphenate`/`camelize` are ordinary helpers: they do not create reactive derivations or validate untrusted objects. `assert` only warns; do not use it to enforce invariants. `increaseWithUnit` does string arithmetic; `pxValue` assumes 16px/rem, not the actual browser root font size.

For library-owned effects, `tryOnScopeDispose` returns whether registration succeeded; false means the caller still needs explicit disposal. Outside components `tryOnMounted`/`tryOnBeforeMount` may execute immediately (or nextTick with their sync option false); `tryOnUnmounted`/`tryOnBeforeUnmount` do nothing there. They are not a substitute for an owned scope. `createDisposableDirective` scopes effects created in its mounted hook until unmount. `createEventHook<T>()` exposes `on/off/trigger/clear`; `on` returns `{ off }` and auto-unsubscribes in a scope, while `trigger` awaits all listeners and can reject.

### Injected state without a silent fallback

`createInjectionState(factory, { injectionKey?, defaultValue? })` returns provider/consumer functions. Without a default, the consumer can return undefined; enforce required ancestry explicitly. `provideLocal`/`injectLocal` permit same-component access in addition to descendant injection. A bare effect scope supplies only its local lookup ownership; it does not create a Vue component ancestry for standard provide/inject.

Runnable TypeScript module, called from component setup; each provider owns a separate counter:

```ts
import { readonly, ref } from 'vue'
import { createInjectionState } from '@vueuse/core'

const [provideCounter, injectCounter] = createInjectionState((initial: number) => {
  const count = ref(initial)
  return { count: readonly(count), increment: () => { count.value++ } }
})

export const useProvideCounter = provideCounter
export function useCounterState() {
  const state = injectCounter()
  if (!state)
    throw new Error('useCounterState requires an ancestor useProvideCounter')
  return state
}
```

## Browser and interop workflow selection

The [v15 core declarations](https://cdn.jsdelivr.net/npm/@vueuse/core@15.0.0/dist/index.d.ts) define the input/return options; the following decision boundaries are authored guidance. Keep the capability with its DOM/service owner and route state with the installed router.

| Workflow | Choice and usable boundary |
| --- | --- |
| Undo/redo and drafts | `useManualRefHistory` commits explicitly; `useRefHistory` watches; debounced/throttled variants change commit cadence. Set capacity, inspect undo/redo availability, and choose a clone/serialization strategy for mutable objects. `useCloned` creates a draft (JSON clone by default), not a merge/conflict policy; custom cloning must preserve the domain's types. |
| Async derivation | `computedAsync(evaluate, initial, { lazy, evaluating, shallow, flush, onError })` tracks synchronous reads before the first await. Defaults are non-lazy, shallow, sync; errors go to reportError when available unless handled. Register `onCancel(() => controller.abort())` inside evaluate before awaiting to cancel invalidated work; latest-result guarding does not suppress its external side effects. Use `useAsyncState` for imperative execution instead. [Implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/computedAsync/index.ts). |
| Async pipelines and caches | `useAsyncQueue` sequences dependent promise tasks with per-task state; decide stop-on-error and handle rejection rather than treating it as transport cancellation. `useMemoize`/`useCached` can retain derived results; define keys, invalidation, and memory lifetime. They do not supply server-resource freshness or request isolation. |
| Scroll and pagination | `useScroll` exposes positions, directions, arrived state, and measurement; `useInfiniteScroll` adds load-distance and a `canLoadMore` guard—stop when exhausted and serialize loading. `useOffsetPagination({ total, page, pageSize })` derives bounds; omitting total gives unbounded pagination without isLastPage. `useVirtualList` needs an actual bounded container and accurate item dimensions; use its container/wrapper props and `scrollTo(index, options)`, and see [virtualization](virtualization.md). |
| Geometry and observation | `useElementSize` measures a chosen box; `useElementBounding` tracks viewport-relative bounds. `useResizeObserver`/`useMutationObserver`/`useIntersectionObserver` provide native callback entries and stop controls; do not read size before a target exists or mutate observed size in an unbounded feedback loop. `useElementVisibility(..., { controls: true })` returns state plus controls; once mode stops after visibility. `useCurrentElement`/`useParentElement` infer render structure; explicit refs are safer with fragments/Teleport. |
| Mouse, pointer, touch | `useMouse`/`useMouseInElement`, `usePointer`, `useMousePressed`, hover, swipe/pointer-swipe, draggable, and parallax differ in coordinate/gesture semantics. Choose viewport/page/element coordinates explicitly, configure drag handles/bounds, and supply keyboard alternatives. `onLongPress` is not the only way to invoke an action. v15 handles pointercancel; do not retain a second application dragging flag after cancellation. |
| Keyboard and focus | Prefer native local key handlers; `onKeyStroke` filters keys/events/targets and `useMagicKeys` derives key state. Exclude editable targets where shortcuts must not intercept typing; `useKeyModifier` is modifier state, not authorization. `useFocus` controls a target and `useFocusWithin` tracks descendants; active-element/selection/removal utilities observe DOM, not a complete accessible widget. |
| Viewport, preferences, theme | `useWindowSize`/scroll/focus, document visibility, page-leave, `useMediaQuery`/`useBreakpoints`, preferred language/contrast/dark/reduced-motion/transparency and device-pixel ratio describe browser state. Gate expensive work on visibility/idle where appropriate. Use CSS for presentation-only breakpoints and [Vuetify theme](vuetify-theme.md) as the single app theme owner; do not let useDark/useColorMode independently fight it. SSR width applies to supported width consumers, not arbitrary geometry/sensors. |
| Connectivity and streams | `useOnline`/`useNetwork` report browser connectivity hints, not backend reachability. `useEventSource` is SSE (receive-only); choose named events and JSON validation. `useWebSocket` returns status/data/open/close/send; autoReconnect is off by default, autoClose is on, and buffered send is on by default. Specify retry/buffer/protocol policy; heartbeat messages must match the server contract. v15 drops superseded socket messages, not all callbacks. A stream does not automatically update a query cache. [WebSocket source](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useWebSocket/index.ts). |
| Cross-context messages | `useBroadcastChannel` shares structured-cloneable messages across same-origin contexts; version and validate payloads and close with the owner. `useEventBus` is in-process subscription, not durable/cross-tab delivery; `computedInject` derives from injected state rather than finding arbitrary global state. |
| Clipboard, sharing, pickers | Clipboard/text or ClipboardItems, `useShare`, eye-dropper, fullscreen, pointer-lock, file dialog/file-system access, notification, vibration, and wake-lock are capability/permission/user-activation dependent. Invoke commands from real user actions, handle rejection/cancellation, and show a non-capability alternative. `usePermission` state/query cannot grant a permission; `useSupported` is a feature check, not permission success. |
| Media and sensors | Geolocation, battery, device motion/orientation, Bluetooth, gamepad, speech recognition/synthesis, media device lists, user/display media, and media controls expose browser-specific capabilities. Request permission only for the task, render denied/unavailable/error states, stop streams/watchers/utterances when ownership ends, and never use absence as a fabricated measurement. Device-motion permission requests can require user activation; recognition confidence is not transcript correctness. |
| Files, images, object URLs | `useDropZone`/file pickers provide files, not trusted MIME/content validation. `useImage` preloads with loading/error state; `useObjectUrl` owns URL creation/revocation for Blob/MediaSource; do not persist ephemeral object URLs. `useBase64` encodes data, not encryption. Keep file-size/content/trust policy in the application. |
| URL and document side effects | Browser location/URLSearchParams are not a substitute for router-owned query state. `useTitle`/favicon/text-direction, CSS vars/support/style tags, script tags, textarea autosize, and screen-safe-area utilities change specific document/element properties. Assign one owner, remove injected resources when required, and do not load untrusted script/style URLs. Use [head management](i18n-head.md) for SSR document metadata. |
| Animation and clocks | `useAnimate` wraps Web Animations; `useRafFn` supplies pause/resume cadence; `useTransition` animates numeric state, not DOM layout. Prefer reduced-motion-aware presentation; use `transition`/`easing`, not deprecated executeTransition/transition-option names. Now/timestamp/countdown/time-ago APIs need an explicit SSR clock/presentation policy; Intl time-ago formatting is not a timer or a timezone parser. |
| Workers and diagnostics | `useWebWorker` owns messaging/termination; `useWebWorkerFn` needs a serializable function with explicitly supplied dependencies—closures and DOM objects do not cross workers. Fps/memory/performance observers diagnose a browser, not production guarantees; scope sampling and avoid unsupported metrics. |
| Component coordination | Prefer Vue 3.5 defineModel for authored two-way props; incumbent `useVModel`/`useVModels` bridge props/emits and passive sync options, not permission to mutate props. `createReusableTemplate` reuses local slot markup, not component state ownership; `createTemplatePromise`/`useConfirmDialog` need every accept/cancel/unmount path settled. `useTemplateRefsList` is for repeated refs, not the removed templateRef. `useMounted` tracks mount; stepper/cycle-list/sorted/previous utilities derive navigation/list state, not a router or state machine validation policy. |

`useStorageAsync` is the async-adapter variant, not synchronous browser storage with an awaited durable transaction; define codec/error and initial-render policy. `useTimeoutPoll` sequences promise-aware polling; pause/stop the owner, and do not replace a query layer's freshness/refetch ownership with a second poller.

## Renderless components and directives

Choose a composable when the component already owns its state/target. A wrapper is useful when the capability is local to a slot; a directive is useful for an element-local side effect. Named exports work in `<script setup>` without global registration. The family is not uniformly DOM-free: `UseMouse` renders its slot, while `OnClickOutside` renders a target element (`div` by default, configurable with `as`). Inspect wrapper DOM before relying on grid, table, or accessibility structure. [Component guide](https://vueuse.org/guide/components), [OnClickOutside implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/onClickOutside/component.ts).

Runnable SFC; this is a non-modal disclosure, not a complete modal/dialog:

```vue
<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { UseMouse, vOnClickOutside } from '@vueuse/components'

const open = ref(false)
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
function close() {
  open.value = false
}
</script>

<template>
  <button ref="trigger" type="button" :aria-expanded="open" @click="open = !open">
    Toggle pointer details
  </button>
  <section v-if="open" v-on-click-outside="[close, { ignore: [trigger] }]" @keydown.esc="close">
    <UseMouse v-slot="{ x, y }">
      <p>Pointer: {{ x }}, {{ y }}</p>
    </UseMouse>
    <button type="button" @click="close">Close pointer details</button>
  </section>
</template>
```

For `OnClickOutside`, configure `:options` and handle `@trigger`, rather than inventing a handler prop. The directive accepts a handler or `[handler, options]`; `vElementSize` instead uses `[handler, initialSize, options]`, and `vScrollLock` takes a boolean. Do not extrapolate one binding tuple to every directive. `vOnKeyStroke` defaults to its bound element (an explicit options target can override it); prefer native `@keydown` for a simple local key handler. Wrapper cleanup is tied to unmount, but it does not implement focus restoration, inert background, accessible names, or keyboard alternatives. Use an established dialog component for modal behavior; see [accessibility](accessibility.md). Deprecated `VOnClickOutside`/`VOnLongPress` aliases should become `vOnClickOutside`/`vOnLongPress`.

### Wrapper contracts beyond the common example

Wrapper props/slots are defined by the [15.0.0 declarations](https://cdn.jsdelivr.net/npm/@vueuse/components@15.0.0/dist/index.d.ts); DOM and forwarded options by the [published runtime](https://cdn.jsdelivr.net/npm/@vueuse/components@15.0.0/dist/index.js). Most slots expose reactively unwrapped results; `UseDeviceMotion` is an exception and passes the composable's refs unchanged (for example, `acceleration.value?.x`). Choose the matching workflow above before choosing its wrapper.

| Template-local task | Wrapper contract and exception |
| --- | --- |
| Outside click/press | `OnClickOutside`/`OnLongPress` render an `as` element (default div), accept `options`, and emit trigger; long-press slot also receives press state. They are targets, not portal-aware dialog systems; add ignored triggers/regions explicitly. |
| Position and geometry | `UseDraggable` renders a target and exposes x/y/style/isDragging; apply style deliberately. `storageKey` enables position persistence and `storageType` selects local/session. `UseElementBounding` exposes rectangle/update; `UseElementSize` accepts initial width/height and box; `UseElementVisibility` exposes controls plus isVisible (its controls mode is forced). These wrappers render an `as` target. |
| Fullscreen/pointer capture | `UseFullscreen`, `UseMouseInElement`, `UseMousePressed`, and `UsePointerLock` render target elements. Fullscreen commands remain permission/activation dependent; mouse-in-element exposes element coordinates/isOutside, mouse-pressed exposes pressed/x/y/sourceType, pointer-lock exposes lock/unlock/support/locked state. These do not add keyboard alternatives. |
| Images | `UseImage` accepts image options and exposes loading/error state to its default slot. Loading/error slots take precedence. With no default slot, it renders an img (or as) carrying its props. Supply alt and a real failure presentation; preloading alone is not accessible image markup. |
| Virtual rows | `UseVirtualList` requires list and options, renders its own container/wrapper divs, defaults height to 300px, slots each `{ index, data }`, and exposes scrollTo through its component ref. Match actual row height to itemHeight; as is not its element customization API. |
| Theme/preference slots | `UseDark` exposes `{ isDark, toggleDark }`, `UseColorMode` exposes `{ mode, system, store }`. PreferredColorScheme/Contrast/Dark/Languages/ReducedMotion/ReducedTransparency wrappers expose named colorScheme/contrast/prefersDark/languages/motion/transparency. They are pure slots; keep one theme owner and deterministic SSR markup. |
| Scalar browser state | `UseActiveElement`, `UseDocumentVisibility`, `UseOnline`, `UsePageLeave`, `UseWindowFocus`, and `UseDevicePixelRatio` wrap scalar returns under element/visibility/isOnline/isLeft/focused/pixelRatio. `UseBrowserLocation`, `UseWindowSize`, `UseMouse`, and `UseNetwork` expose their full result. All are pure slots; window-size initial dimensions are assumptions, not client measurements. |
| Capability/sensor slots | `UseBattery`, `UseClipboard`, `UseDeviceMotion`, `UseDeviceOrientation`, `UseDevicesList`, `UseEyeDropper`, and `UseGeolocation` expose the matching capability's return, with that wrapper's declared options (not every core overload). Render support/permission/error states and explicit activation controls. Wrapping does not grant permission. |
| Idle | Pure-slot `UseIdle` requires timeout and exposes idle/lastActive/reset. For pointer events use the explicitly targeted core composable below. |
| Clock slots | `UseNow`, `UseTimeAgo` (required time), and `UseTimestamp` force controls mode and accept scheduler for timing; removed interval/immediate timing props do not reappear through a wrapper. |
| Ephemeral URL | `UseObjectUrl` passes the **URL string itself** to its slot, only when nonempty. |

### Directive payloads and lifecycle

Most directives bind a handler or `[handler, options]` at mount; replacing that tuple later is **not** a general reactive-options contract. Keep handler closures current, pass specifically reactive options only where supported, or remount the target. Unmount disposes scoped effects; it does not undo an application action already started by a handler. The excluded adapters below are not selection choices.

| Directive | Handler/binding contract |
| --- | --- |
| `vOnClickOutside` | Pointer/focus event depending on options; `.bubble` selects bubble phase unless capture is explicitly overridden. Ignore the opening trigger when necessary. |
| `vOnKeyStroke` | KeyboardEvent; argument is a key or comma-separated keys, **case-sensitive native key names** (e.g. Escape, not a fabricated lowercase alias). Options can set eventName/dedupe/target. |
| `vOnLongPress` | PointerEvent; with a function binding, directive modifiers become long-press modifiers; tuple mode uses its own options. Provide another action path. |
| `vElementHover` | Boolean hovered state. |
| `vElementSize` | `{ width, height }`; optional tuple is `[handler, initialSize, options]`, with an immediate initial callback. |
| `vElementVisibility` | Boolean by default; `{ controls: true }` changes the payload to full state including isVisible. |
| `vInfiniteScroll` | Unwrapped scroll state; configure canLoadMore and avoid an exhausted-list load loop. |
| `vIntersectionObserver` | Native `(entries, observer)` callback, with root/rootMargin/threshold options. |
| `vMouseInElement` | Reactive mouse-in-element state **without stop**. |
| `vResizeObserver` | Native `(entries, observer)` callback and box/window options. |
| `vScroll` | Full scroll state on both scrolling and scroll-end; custom options onScroll/onStop still run. Avoid counting the same business action twice. |

### Excluded v15 adapters: migrate, do not work around them

These exclusions are **15.0.0 source findings**, not a blanket rejection of VueUse or proof about a later release. Do not install a dependency patch, substitute a global, or keep the broken adapter behind a client-only boundary.

| Excluded offering | Exact failure and supported replacement |
| --- | --- |
| `useElementOverflow`, `UseElementOverflow`, `vElementOverflow` | The core return object references undeclared `stop`: constructing it throws on ordinary Node SSR, while a browser can resolve `window.stop` instead of observer disposal. All three surfaces inherit that implementation. Own overflow comparison with `useResizeObserver`/`useMutationObserver`, an initial mount measurement, and the owning scope's cleanup; the complete component below does this. |
| `vScrollLock` | One module-level `state`/`isMounted` closure is shared across bindings; updating the second element can toggle the first, and remount cannot initialize a fresh lock. Use one `useScrollLock` for each distinct, stable target, never multiple lock owners for the same body/element. Established dialog systems should retain their own lock manager. |
| `UsePointer` | `target="self"` passes a null ref that is never attached to a DOM node. Remove the wrapper and call `usePointer({ target: elementRef })`; targeting selects event origin, **not element-relative coordinate conversion**. |
| `UseOffsetPagination` | The published setup evaluates `total` once and applies a falsy-total fallback, turning **zero into unbounded pagination**; spreading scalar props also captures their setup values. Do not confuse a newly mounted controller with a reactive update of the original one. Use core `useOffsetPagination` with reactive total/pageSize and an owner-writable page ref. |
| `vElementBounding` | Creates the core measurement before installing a non-immediate watcher. A synchronous initial measurement can be missed forever if geometry stays unchanged. Do not require a later resize or schedule an adapter workaround: consume `useElementBounding` refs directly. For a notification, watch those refs with `{ immediate: true }`; the initial zero state means “not measured,” not a real size. |
| `UseScreenSafeArea` | Its declared `as` prop is absent from runtime props, so the advertised root customization does not work. Own the native semantic element and use CSS `env(safe-area-inset-top, 0px)` (and the other sides), or core `useScreenSafeArea()` refs when script actually needs the values. Do not accept a div merely to preserve this wrapper. [Pinned adapter](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useScreenSafeArea/component.ts). |

Primary evidence: [overflow core](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useElementOverflow/index.ts), [overflow component](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useElementOverflow/component.ts), [pointer component](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/usePointer/component.ts), [pagination component](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useOffsetPagination/component.ts), [bounding directive](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useElementBounding/directive.ts), [scroll-lock directive](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useScrollLock/directive.ts). The [published components runtime](https://cdn.jsdelivr.net/npm/@vueuse/components@15.0.0/dist/index.js) and [published core runtime](https://cdn.jsdelivr.net/npm/@vueuse/core@15.0.0/dist/index.js) are the release artifacts, not latest-branch documentation.

### Runnable SFC: owned pointer, lock, geometry, and overflow

Mount independent copies to give each scrollable panel its own pointer listener and lock. Keep the panel stable for this owner's lifetime. The component owns overflow measurement, not a replacement library facade: resize observes the panel and its immediate HTML children; mutation observes content/style changes and retargets resize observation after child replacement.

```vue
<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef } from 'vue'
import { useElementBounding, useMutationObserver, usePointer, useResizeObserver, useScrollLock } from '@vueuse/core'

const panel = useTemplateRef<HTMLElement>('panel')
const { x, y } = usePointer({ target: panel })
const locked = useScrollLock(panel)
const { width } = useElementBounding(panel)
const isXOverflowed = shallowRef(false)
const isYOverflowed = shallowRef(false)
const childrenRevision = shallowRef(0)
const resizeTargets = computed(() => {
  void childrenRevision.value
  const element = panel.value
  return element
    ? [element, ...Array.from(element.children).filter((child): child is HTMLElement => child instanceof HTMLElement)]
    : []
})
function measureOverflow() {
  const element = panel.value
  isXOverflowed.value = !!element && element.scrollWidth > element.clientWidth
  isYOverflowed.value = !!element && element.scrollHeight > element.clientHeight
}
useResizeObserver(resizeTargets, measureOverflow)
useMutationObserver(panel, () => {
  childrenRevision.value++
  measureOverflow()
}, { childList: true, subtree: true, characterData: true, attributes: true })
onMounted(measureOverflow)
</script>

<template>
  <label><input v-model="locked" type="checkbox" /> Lock this panel's scrolling</label>
  <p>Panel width: {{ width }} px. Last pointer: {{ x }}, {{ y }}</p>
  <p>Overflow: horizontal {{ isXOverflowed }}, vertical {{ isYOverflowed }}</p>
  <div ref="panel" class="panel"
    tabindex="0" role="region" aria-label="Scrollable pointer area">
    <div class="content">Move the pointer here; resize or scroll this panel.</div>
  </div>
</template>

<style scoped>
.panel { width: 20rem; max-width: 100%; height: 10rem; overflow: auto; resize: horizontal; }
.content { min-height: 20rem; }
</style>
```

Pointer coordinates remain viewport coordinates; the explicit target controls which element's events update them. Initial SSR markup uses defaults without reading DOM. Measurement starts on mount/observer delivery. The `instanceof HTMLElement` check executes only after a panel exists in the browser; keep this component in its normal document realm. Core observers/listeners stop with the scope, and core scroll-lock disposal restores the stable owned target. Test actual unmount (`isConnected === false`) before asserting the detached element's restored inline overflow: a renderer failure that leaves the element connected is not a cleanup failure. This is not a reference-counted body-lock manager or an accessible dialog.

### Runnable SFC: reactive bounded pagination without the adapter

The parent supplies a finite nonnegative integer `total` and positive integer `pageSize`; those are application data contracts, not a guessed backend. Local `page` is this component's writable navigation owner. Prop updates remain live through getters; a zero total has one empty logical page, never an infinite page count. This example does not fetch data or infer that a page number is a server cache key.

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import { useOffsetPagination } from '@vueuse/core'

const props = defineProps<{ total: number; pageSize: number }>()
const page = shallowRef(1)
const { currentPage, pageCount, isFirstPage, isLastPage, prev, next } = useOffsetPagination({
  total: () => props.total,
  pageSize: () => props.pageSize,
  page,
})
</script>

<template>
  <p v-if="props.total === 0">No records</p>
  <p v-else>Page {{ currentPage }} of {{ pageCount }}</p>
  <button type="button" :disabled="isFirstPage" @click="prev">Previous page</button>
  <button type="button" :disabled="isLastPage" @click="next">Next page</button>
</template>
```

Core accepts a getter for `total`/`pageSize`, but `page` is **`MaybeRef<number>`**, not a getter. For controlled pagination use an owner-writable model ref rather than mutating readonly props. Core clamps page count to at least one, including an empty total; assert empty UI and disabled navigation separately. [Pinned core signature/implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useOffsetPagination/index.ts).

## Reactive math

`@vueuse/math@15.0.0` accepts numbers, refs, and **getters** through `MaybeRefOrGetter`, not refs alone. Most results are readonly computed refs. `useClamp` also has a writable form: a mutable ref (or plain number wrapped internally) produces a writable computed; both reading and writing it clamp and can mutate the underlying source. A getter/readonly input produces a pure readonly computed. Use that form when deriving from props. [Published types](https://cdn.jsdelivr.net/npm/@vueuse/math@15.0.0/dist/index.d.ts), [clamp implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/math/useClamp/index.ts).

Runnable TypeScript module:

```ts
import { computed, ref } from 'vue'
import { useAverage, useClamp, usePrecision, useProjection, useSum } from '@vueuse/math'

export function createMetrics() {
  const level = ref(25)
  const bounded = useClamp(level, 0, 100)
  const progress = useProjection(bounded, [0, 100], [0, 1])
  const percentage = usePrecision(() => progress.value * 100, 1)
  const samples = ref<number[]>([])
  const total = useSum(samples)
  const average = useAverage(samples)
  const mean = computed(() => samples.value.length ? average.value : null)
  return { level, bounded, progress, percentage, samples, total, mean }
}
```

Call `createMetrics()` inside setup or the request-owned state factory; exporting the factory does not create shared mutable state. Math edge cases:

- Aggregates accept an array/getter/ref or numeric rest inputs. `useAverage([])` yields `NaN`; empty min/max yield positive/negative infinity. Decide the domain's empty-state meaning before rendering.
- `useAbs`, `useCeil`, `useFloor`, `useRound`, `useTrunc`, and `useMath` mirror numeric operations, not input validation. `NaN`, infinities, and floating-point behavior still matter. Use a callable Math key, not a constant such as `PI`.
- Projection extrapolates; it does not clamp. Guard a zero-width input domain. `createProjection` reuses reactive numeric domains; `createGenericProjection` requires a custom projector for non-number domains.
- `usePrecision` returns a numeric computed ref and supports `math: 'round' | 'ceil' | 'floor'`; its value is not arbitrary-precision money arithmetic or localized display formatting.
- Use `logicAnd`/`logicOr`/`logicNot` rather than deprecated `and`/`or`/`not`, but a simple Vue computed boolean expression is often clearer.

## v15 migration and specialized browser APIs

Replace removed VueUse `templateRef` with Vue 3.5 `useTemplateRef`. Replace deprecated `computedEager` with native computed and `watchPausable` with native watch handles. Preserve incumbent behavior by explicitly selecting throttle edges and converting only APIs whose timer options were removed. `useEventSource` now handles unnamed `message` events through both handler paths; remove application-level duplicate delivery assumptions. `deepRefs` remains true in relevant configurable core APIs in v15; set it explicitly when relying on the shape rather than anticipating the next major. [Release](https://github.com/vueuse/vueuse/releases/tag/v15.0.0).

### Specialized v15 APIs and pinned defects

- **`useWebMCP`** registers an experimental document.modelContext tool. Name/description/inputSchema/annotations/enabled are reactive and changes re-register it; scope disposal aborts the registration signal. `isSupported` checks callable registerTool, `isRegistered` tracks registration, and error reports registration failures such as policy denial. Execute/formatOutput failures become isError responses and invoke onError; the error ref is not the execution-error channel. A schema/TypeScript generic is not application authorization or runtime validation: validate mutation arguments and permissions in the actual operation. [Exact source](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useWebMCP/index.ts).
- **`useTemporalNow`** throws if neither native Temporal nor an explicit temporal implementation exists. It returns `{ now, timezone, calendar, isActive, pause, resume, ...helpers }`, defaults timezone UTC/calendar gregory, and accepts scheduler. Change timezone/calendar refs to refresh now. `format(options)` is on the **returned controller**, not `now.value.format`; ZonedDateTime uses toLocaleString. toTimezone/toCalendar/add/subtract return converted values rather than mutating now. Use a deliberate SSR clock strategy; a non-running server scheduler still constructs a current timestamp. [Exact source](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useTemporalNow/index.ts).
- **`useLiveAnnouncer({ idPrefix, window })`** returns announce(message, mode?, timeout?), polite, and assertive; the timeout clears a message, not an announcement completion signal. It creates status/alert live regions, replaces text on nextTick, and reference-counts cleanup for a shared prefix. Call after body exists, choose unique prefixes for independent owners/realms, and avoid also announcing the same status through visible aria-live markup. [Exact source](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/core/useLiveAnnouncer/index.ts).
- **`useElementOverflow` and its adapters are excluded at 15.0.0.** See [excluded adapters](#excluded-v15-adapters-migrate-do-not-work-around-them) for the undeclared-stop SSR/disposal defect and the directly owned observer replacement. Client-only mounting does not repair its returned cleanup contract.

Runnable setup-time composable exposing only an existing local count; absence of WebMCP is represented by its support state, not a fabricated backend:

```ts
import type { Ref } from 'vue'
import { useWebMCP } from '@vueuse/core'

export function useCountTool(count: Readonly<Ref<number>>) {
  return useWebMCP({
    name: 'read-visible-count',
    description: 'Read the count currently displayed by this view',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', additionalProperties: false },
    execute: () => ({ count: count.value }),
  })
}
```

For incumbent migrations, replace controlledComputed/controlledRef with computedWithControl/refWithControl; createReactiveFn with reactify; autoResetRef/debouncedRef/throttledRef with refAutoReset/refDebounced/refThrottled; debouncedWatch/ignorableWatch/throttledWatch with watchDebounced/watchIgnorable/watchThrottled. The old useDebounce/useThrottle names mean delayed refs, not function wrappers. Use Vue's native MaybeRef/MaybeRefOrGetter types, not old VueUse aliases; correct the deprecated UseTimoutReturn spelling to UseTimeoutReturn. `breakpointsVuetify` is a deprecated **Vuetify 2** alias, not the Vuetify 4 breakpoint contract; take current app breakpoints from its UI owner. The four packages' **13.0.0 manifests already declare Vue `^3.5.0` and ESM entry points**; do not attribute that peer floor to v14. Core's [12.8.2 exports](https://registry.npmjs.org/@vueuse/core/12.8.2) still included CJS, while its [13.0.0 manifest](https://registry.npmjs.org/@vueuse/core/13.0.0) exposes ESM. The v15 manifests above raise Node to 22. Inspect public package exports instead of importing implementation file paths.

The scheduler migration applies to countdown, now, timestamp, timeAgo/timeAgoIntl, temporalNow, elementByPoint, memory, vibrate, and WebSocket heartbeat options. Supply `scheduler: cb => useIntervalFn(cb, 1000)` for a one-second pausable cadence, or useRafFn for frame cadence; create it inside the owning scope. It does **not** remove immediate/immediateCallback from the shared interval/timeout functions or immediate/refetch from HTTP APIs. `onStartTyping(callback, { document, isTypedCharValid, isFocusedElementEditable })` is for starting an input workflow from non-editable focus; preserve editable-target and character filtering rather than globally stealing typing.

When an upgrade changes behavior, compare these documented fixes before adding a workaround:

- **15.0.0:** ResizeObserver skips non-Element/comment targets; WebSocket drops superseded messages; pointer state/long-press cancellation resets correctly; Bluetooth deduplicates disconnect listeners and reconnects on mount; custom useCloned functions gained correct typing. Tree-shaking annotation fixes are bundler improvements, not proof that every import has zero runtime cost. [Release](https://github.com/vueuse/vueuse/releases/tag/v15.0.0).
- **14.4.0, included in 15:** fetch ignores stale abort errors after a successful refetch; explicit socket close sets CLOSED; virtual-list range follows changed item size and scrollTo accepts behavior/block/inline; element-size initial measurements honor box; style tags tolerate shared IDs; event-bus cleanup uses public scope disposal; draggable/pointer-swipe handle pointercancel. Debounce gained flush/isPending, speech recognition gained confidence, and onStartTyping gained the filtering options above. Do not reintroduce obsolete manual state workarounds without a current reproduction. [Release](https://github.com/vueuse/vueuse/releases/tag/v14.4.0).

## Verification boundary

The current isolated core consumer matrix passed **full reachable declarations** (`skipLibCheck: false`), the separate **bounded strict source/template profile** (`skipLibCheck: true`), and the **CPU/custom-renderer/Node SSR lifecycle smoke** with the exact Vue/VueUse/compiler/ambient package set above. This is scoped evidence for the retained extracted consumers and lifecycle assertions, not all VueUse APIs, a different dependency tree, browser geometry, permissions, hydration, or GPU behavior. The original missing-components/missing-globals profile remains a failed historical profile; these prerequisites explain the corrected result rather than concealing it.

Registry metadata and v15 source define the broader API boundaries. Historical scoped records report extraction of the owned panel and reactive-pagination SFCs: strict application-source checks, production Chromium pointer/geometry/mutation/bordered-overflow, independent lock/unmount/remount, reactive totals/page size and empty bounds. They also report Node SSR default-markup checks and the excluded overflow core/component exception, plus isolated browser negatives for the named adapters; see [verification](../assets/verification.json) for those records' original source scopes. These observations were not re-executed in this source audit and do not certify today's edited bytes, all utilities, full declarations, or hydration. Verify target replacement, debounce teardown, request races, storage denial/malformed content, SSR agreement and empty math inputs in the consuming app; use [testing](testing.md).

## Sources

- [VueUse v15 release and breaking changes](https://github.com/vueuse/vueuse/releases/tag/v15.0.0).
- [Official configuration](https://vueuse.org/guide/config), [best practices](https://vueuse.org/guide/best-practice), and [components](https://vueuse.org/guide/components).
- [Versioned core sources](https://github.com/vueuse/vueuse/tree/v15.0.0/packages/core), [shared sources](https://github.com/vueuse/vueuse/tree/v15.0.0/packages/shared), and [math sources](https://github.com/vueuse/vueuse/tree/v15.0.0/packages/math); use these over moving documentation when release behavior differs.
- [Vue composable input normalization](https://vuejs.org/guide/reusability/composables.html#accepting-reactive-state) and [SSR cross-request state pollution](https://vuejs.org/guide/scaling-up/ssr.html#cross-request-state-pollution).
