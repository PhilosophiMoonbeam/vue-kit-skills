# TanStack Vue Query: remote-state ownership

Read for `@tanstack/vue-query` queries, mutations, pagination, cancellation, cache identity, or SSR. Inspect the existing client, key factories, transport, authentication boundary, and SSR integration before adding another cache.

For Nuxt, [Nuxt core](nuxt.md#data-payload-and-cancellation) owns native request/data payloads; [Nuxt integrations](nuxt-integrations.md) explains when to select an optional query owner. Retain a working TanStack cache when appropriate, but its Nuxt request-local plugin/payload integration requires its own exact-version design. The standalone installation/custom-renderer helpers below are not a Nuxt module recipe; this guide does not certify a TanStack Nuxt adapter or require switching to Colada.

**Verified baseline:** `@tanstack/vue-query` **5.104.5**, with `@tanstack/query-core` **5.104.5**, on Vue **3.5.44**. The Vue peer range is `^2.6.0 || ^3.3.0`; this reference targets Vue 3 only. Exact [package metadata](https://registry.npmjs.org/@tanstack/vue-query/5.104.5) and [shipped implementation](https://unpkg.com/@tanstack/vue-query@5.104.5/src/queryClient.ts) take precedence over older v5 examples.

## Choose one query-cache owner

| Requirement | TanStack Vue Query | Pinia Colada |
| --- | --- | --- |
| Existing TanStack Query app or cross-framework query conventions | Keep this client and key model. | Do not add a parallel cache for the same resources. |
| Vue/Pinia-native data layer in an existing Pinia app | Supported; Pinia is not required. | Compare [Pinia Colada](pinia-colada.md), including its grouped state, plugin order, and serialization. |
| Local forms, UI preferences, unsaved drafts | Not the owner. | Not the owner. Use component state or [application stores](state.md). |
| Remote results shared by several views | Cache once; derive views from query data. | Same ownership rule; do not mirror canonical query results into application stores. |

Architecture recommendations in this reference are application design choices, not consistency guarantees supplied by a cache. Read [data architecture](architecture-data.md) for ownership and [SSR debugging](debugging-ssr.md) for rendering boundaries.

## Install and scope the client

Complete **standalone Vue** installation helper; call it once before mounting the application. These freshness values are explicit example policy, not upstream defaults. Do not call this helper from Nuxt to create a second framework/data root.

```ts
import type { App } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

export function installQueries(app: App): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 300_000 },
    },
  })
  app.use(VueQueryPlugin, { queryClient: client })
  return client
}
```

- Browser: one client per app/session boundary, not one per component or composable call. `useQueryClient()` retrieves the injected client.
- SSR: create a fresh client for **every request**. Never export a server singleton containing authenticated results.
- Call query composables synchronously in setup or an owned effect scope. An injection context alone does not dispose their watchers. For one-shot loaders/guards, prefer the explicit client.
- Multiple clients require deliberate provider selection: `queryClientKey` identifies a provided client, `useQueryClient(key)` retrieves it, and composables can receive the selected client as their second argument. Do not silently split a resource across clients.
- In **5.104.5**, imperative loading uses `client.query(options)` and `client.infiniteQuery(options)`. Both return promises and reject on failure. `fetchQuery`, `prefetchQuery`, `fetchInfiniteQuery`, `prefetchInfiniteQuery`, and `ensureQueryData` remain deprecated aliases; do not establish new usage. A getter returned by `queryOptions(() => options)` must be invoked for one-shot client calls, but passed uninvoked to `useQuery` for tracking. [Exact client API](https://unpkg.com/@tanstack/vue-query@5.104.5/src/queryClient.ts)
- Migrating imperative semantics: replace `fetchQuery` / `fetchInfiniteQuery` with `query` / `infiniteQuery`; former prefetch calls need an explicit application error policy because the replacement promises reject. For `ensureQueryData` / `ensureInfiniteQueryData`'s cache-first behavior, use `query({ ...options, staleTime: 'static' })` / `infiniteQuery({ ...options, staleTime: 'static' })`. Imperative `select` transforms the returned value without changing the underlying cached payload. Do not carry an old prefetch's swallowed-error assumption into a required loader.

## Reactive identity and request contracts

1. Include **every response-changing input** in the key: resource, tenant, authenticated subject/auth epoch when relevant, ID, filters, search, sort, projection/includes, locale, page/cursor and page size. Use stable serializable values; array position matters. Normalize filters once and use the same normalized snapshot for the key and request.
2. Keep reactive inputs reactive. In an object passed once, `queryKey: ['task', id]` tracks a ref; `['task', id.value]` captures a snapshot. A getter entry or a whole-options getter also tracks dependencies. Pass props as getters/computed refs, not a captured primitive.
3. Every option can accept refs; **only `queryKey` and `enabled` resolve getter values as reactive values**. A function in `select`, `staleTime`, or `queryFn` can be that option's actual callback. Use a whole-options getter when several option values need a consistent snapshot. [Vue reactivity](https://tanstack.com/query/latest/docs/framework/vue/reactivity)
4. A query function returns data or throws/rejects. It must not return `undefined` as successful query data. Pass its `signal` to the transport and any child requests. Do not catch failures and return an empty list: that changes failure into a cached success.
5. Read request identity from the query context's resolved key or capture immutable values while building options. Do not read a changing route again after an `await` and write its result under an older key.
6. `enabled` is a reactive scheduling control, **not authorization and not cache eviction**. A disabled query can expose existing cached data. Its `refetch()` is an imperative operation; `skipToken` disables the query function itself and cannot be used as a manual-refetch function. Guard invalid service inputs too.
7. Imperative client calls unwrap reactive arguments **at call time**, not as subscriptions. In this release, `getQueryData(keyArray)` does not resolve getter entries in that array; use concrete keys from an options factory. Getters in a `queryKey` property of a filter/options object are resolved. [Pinned distinction](https://unpkg.com/@tanstack/vue-query@5.104.5/src/queryClient.ts)

### Local, in-memory pagination and mutation

Complete SFC after plugin installation. It owns one local dataset for one mounted demo instance, has no backend, persistence, authentication, artificial latency, or network claim. For multiple consuming components, put the service/dataset at app scope instead of creating competing services for identical cache keys. `networkMode: 'always'` is intentional **only because this example is in memory**.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

type Task = { id: number; tenant: string; title: string; done: boolean }
type Filter = 'all' | 'open'
type TaskPage = {
  tenant: string
  filter: Filter
  items: Task[]
  hasMore: boolean
}
type Rename = { tenant: string; id: number; title: string }

const records: Task[] = [
  { id: 1, tenant: 'A', title: 'Read query keys', done: false },
  { id: 2, tenant: 'A', title: 'Review cancellation', done: true },
  { id: 3, tenant: 'B', title: 'Review tenant isolation', done: false },
]
const tenant = ref('A')
const filter = ref<Filter>('all')
const page = ref(1)

async function listTasks(
  owner: string, selected: Filter, currentPage: number, signal: AbortSignal,
): Promise<TaskPage> {
  signal.throwIfAborted()
  await Promise.resolve()
  signal.throwIfAborted()
  const matching = records.filter((task) =>
    task.tenant === owner && (selected === 'all' || !task.done))
  return {
    tenant: owner,
    filter: selected,
    items: matching.slice(currentPage - 1, currentPage).map((task) => ({ ...task })),
    hasMore: currentPage < matching.length,
  }
}

const { data, error, isLoading, isFetching, isPlaceholderData } = useQuery(() => {
  const owner = tenant.value
  const selected = filter.value
  const currentPage = page.value
  return {
    queryKey: ['memory-tasks', owner, { filter: selected, page: currentPage }],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      listTasks(owner, selected, currentPage, signal),
    enabled: () => tenant.value.length > 0,
    networkMode: 'always' as const,
    staleTime: 30_000,
    placeholderData: (previous: TaskPage | undefined) =>
      previous?.tenant === owner && previous.filter === selected ? previous : undefined,
  }
})

const client = useQueryClient()
const { mutate, isPending: saving, error: saveError } = useMutation({
  networkMode: 'always',
  mutationFn: async (input: Rename): Promise<Task> => {
    const task = records.find((item) => item.tenant === input.tenant && item.id === input.id)
    if (!task) throw new Error('Task no longer exists in this local dataset')
    task.title = input.title
    return { ...task }
  },
  onSuccess: (_saved, input) =>
    client.invalidateQueries({ queryKey: ['memory-tasks', input.tenant] }),
})
</script>

<template>
  <section>
    <h1>Local query example</h1>
    <label>Tenant <select v-model="tenant" @change="page = 1">
      <option>A</option><option>B</option>
    </select></label>
    <label>Filter <select v-model="filter" @change="page = 1">
      <option value="all">All</option><option value="open">Open</option>
    </select></label>
    <p v-if="isLoading" role="status">Loading page</p>
    <p v-else-if="isFetching" role="status">Refreshing page</p>
    <p v-if="isPlaceholderData">Showing the previous page while the next page loads.</p>
    <p v-if="error" role="alert">{{ error.message }}</p>
    <p v-if="saveError" role="alert">{{ saveError.message }}</p>
    <ul v-if="data">
      <li v-for="task in data.items" :key="task.id">
        {{ task.title }}
        <button type="button" :disabled="saving || isPlaceholderData"
          @click="mutate({ tenant: task.tenant, id: task.id, title: task.title + '!' })">
          Append exclamation mark locally
        </button>
      </li>
    </ul>
    <p v-if="data && data.items.length === 0">No matching tasks.</p>
    <button type="button" :disabled="page === 1" @click="page--">Previous</button>
    <span>Requested page {{ page }}</span>
    <button type="button" :disabled="isPlaceholderData || !data?.hasMore" @click="page++">
      Next
    </button>
  </section>
</template>
```

The placeholder guard is deliberate: keeping a prior page within the same tenant/filter can be useful; carrying tenant A's results into tenant B's loading view is not acceptable. `keepPreviousData` is the upstream shorthand for unrestricted previous-data placeholders, not an isolation policy. `initialData` seeds the cache; `placeholderData` supplies observer-only display data, reports success, and must not be treated as authoritative results for the requested page. Use `isPlaceholderData` to qualify counts, actions, and navigation. [Pagination](https://tanstack.com/query/latest/docs/framework/vue/guides/paginated-queries)

For infinite loading use `useInfiniteQuery`, `initialPageParam`, `getNextPageParam`, `fetchNextPage`, `hasNextPage`, and `isFetchingNextPage`. Keep tenant/filter/sort in the key, but keep the evolving page parameter in `pageParam`, not the key. Cache shape is `{ pages, pageParams }`; preserve both when editing it, do not share its key with an ordinary query, and guard repeated intersection callbacks with `hasNextPage` and loading state. Bound retained pages with `maxPages` when needed. [Infinite queries](https://tanstack.com/query/latest/docs/framework/vue/guides/infinite-queries)

## Freshness, retention, and errors

| Concern | Contract |
| --- | --- |
| `staleTime` | How long data is fresh. Staleness permits applicable mount/focus/reconnect refetches; it is not a polling timer or deletion time. Default is `0`. |
| `gcTime` | Retention after a query becomes inactive. Browser default is five minutes; server default is `Infinity`. It does not make data fresh. |
| Status versus fetch status | `status` is `pending / error / success`; `fetchStatus` is `fetching / paused / idle`. A disabled or offline query can be pending without loading; a background refetch can run while data remains available. |
| Vue result fields | State fields are refs: `data.value`, `error.value`, `isPending.value` in script. Destructure to top-level bindings for template unwrapping; methods are ordinary functions. `useQueries` returns a ref containing the result array. Do not copy React hook destructuring assumptions or mutate query data with `v-model`. |
| Query callbacks | v5 queries do not have per-query `onSuccess/onError/onSettled`. Derive data with `computed`/`select`; use a scoped watcher for a real UI side effect or cache-level hooks for global policy. Mutations still have lifecycle hooks. |
| Retry/network policy | Queries retry by default in the browser; mutations default to no retry. Both default to `networkMode: 'online'`, not `'offlineFirst'`. Choose retry from the operation's error/idempotency contract, not to hide authorization or validation failures. |
| Failed refetch | Cached data can coexist with an error. Keep useful content visible with an explicit refresh-error indication when appropriate. Cancellation is not an empty successful response. |

[Important defaults](https://tanstack.com/query/latest/docs/framework/vue/guides/important-defaults), [network modes](https://tanstack.com/query/latest/docs/framework/vue/guides/network-mode).

`fetch()` resolves for HTTP 4xx/5xx. The following complete transport helper accepts an application-owned runtime decoder; supplying a real authorized URL and decoder is the application's responsibility, not an implemented backend in this reference.

```ts
export async function fetchDecoded<T>(
  url: URL, signal: AbortSignal, decode: (body: unknown) => T,
): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body: unknown = await response.json()
  return decode(body)
}
```

Do not expose raw server error bodies, tokens, or private request metadata in UI errors. Query cancellation only stops network work when the transport consumes the signal; it does not cancel a server-side write already accepted. [Cancellation](https://tanstack.com/query/latest/docs/framework/vue/guides/query-cancellation)

Unmount is not unconditional transport cancellation. In **5.104.5**, removing the last observer cancels/reverts the retryer if the query function consumed `signal`, **or if the query is both pending and fetch-paused**, even without signal consumption. Otherwise it stops retries but allows the current operation to finish/cache. Reading the context's `signal` activates the cache's consumption branch; the transport must still honor that signal to stop its own work. Explicit `client.cancelQueries()` is a separate cache command. [Pinned `removeObserver`](https://unpkg.com/@tanstack/query-core@5.104.5/src/query.ts)

## Coordinating queries and large results

For a variable number of independent requests, use `useQueries({ queries: () => optionsArray, combine })`, not a loop that creates composables inside a watcher. The getter tracks membership and order; without `combine`, the returned **ref** contains results in input order. Deduplicate identical keys before mapping results back to repeated UI rows. Its `placeholderData` callback receives no previous-query argument. Wrap a spread plus an inline `select` in `queryOptions({ ...options, select })` to preserve inference. [Pinned implementation](https://unpkg.com/@tanstack/vue-query@5.104.5/src/useQueries.ts)

Complete scoped composable against an application-owned service. `scope` is a non-secret representation partition covering tenant/principal/auth epoch as required; `null` means no readable identity. The service must honor the captured partition, not reread a later session after awaiting work. All consumers of one key must agree on that service contract. Results remain partial rather than failing as one batch:

```ts
import { type Ref } from 'vue'
import { queryOptions, useQueries } from '@tanstack/vue-query'

export interface Project { id: string; name: string }
export interface ProjectReader {
  get(scope: string, id: string, signal: AbortSignal): Promise<Project>
}

export function useProjects(
  scope: Readonly<Ref<string | null>>,
  ids: Readonly<Ref<readonly string[]>>,
  service: ProjectReader,
) {
  return useQueries({
    shallow: true,
    queries: () => {
      const owner = scope.value
      if (owner === null) return []
      return [...new Set(ids.value)].map((id) => queryOptions({
        queryKey: ['projects', owner, id] as const,
        queryFn: ({ signal }) => service.get(owner, id, signal),
        staleTime: 30_000,
      }))
    },
    combine: (results) => ({
      projects: results.flatMap((result) => result.data ? [result.data] : []),
      errors: results.flatMap((result) => result.error ? [result.error] : []),
      pending: results.some((result) => result.isPending),
    }),
  })
}
```

- Dependent requests: derive the child's key and `enabled` from the parent's resolved ID; do not mount a new composable when the parent finishes. For type-safe absence use a whole-options getter switching `queryFn` between a real function and `skipToken`, as below. `refetch()` cannot execute `skipToken`.
- `select` transforms one observer's view, not the canonical cached payload. It reruns when source data or the function identity changes. Use stable pure selectors; put reactive selector dependencies in a whole-options getter or a computed view, not an untracked closure. `initialData` initializes cache state once rather than remaining a reactive source; pair older seed data with `initialDataUpdatedAt`.
- `shallow: true` on query/mutation options or `useQueries` avoids deep result proxies for large immutable payloads. Replace roots through cache APIs; nested mutation is not a reactive update contract. It does not disable core structural-sharing traversal, bound request fan-out, or virtualize rendering. `queryOptions`, `infiniteQueryOptions`, and `mutationOptions` share typed definitions; their getter forms preserve reactive options, not durable mutation variables.
- `usePrefetchQuery` / `usePrefetchInfiniteQuery` return `void` and prefetch within an owned reactive scope only when **no cached state exists**. An existing error/pending entry suppresses this path too. For an explicit freshness-aware retry/loader use `client.query` / `client.infiniteQuery`, handle rejection, and resolve option getters at the call site. These imperative calls default to no retries unless configured and do not accept observer-only scheduling such as `enabled`. [Prefetch source](https://unpkg.com/@tanstack/vue-query@5.104.5/src/usePrefetchQuery.ts), [core client](https://unpkg.com/@tanstack/query-core@5.104.5/src/queryClient.ts)
- `suspense()` fetches stale data or resolves fresh data; it waits while disabled and only rejects a fetch failure when `throwOnError` requests it. For async setup, call all composables before awaiting it, provide a Vue `<Suspense>` fallback and an explicit error policy. `onServerPrefetch(suspense)` is a separate SSR choice, not automatic server fetching.

Complete adaptable lookup wrapper: callers can pass literal/ref/getter inputs. Resolve both the representation partition and ID **inside** the tracked whole-options getter; the transport captures them and consumes the abort signal. A null partition or absent ID has no executable query function; cached data still requires the private-identity retirement procedure below.

```ts
import { toValue, type MaybeRefOrGetter } from 'vue'
import { queryOptions, skipToken, useQuery } from '@tanstack/vue-query'

export interface Account { id: string; displayName: string }
export interface AccountReader {
  get(scope: string, id: string, signal: AbortSignal): Promise<Account>
}

export function useAccount(
  scope: MaybeRefOrGetter<string | null>,
  id: MaybeRefOrGetter<string | undefined>, service: AccountReader,
) {
  const options = queryOptions(() => {
    const owner = toValue(scope)
    const currentId = toValue(id)
    return {
      queryKey: ['accounts', owner, currentId] as const,
      queryFn: owner === null || currentId === undefined
        ? skipToken
        : ({ signal }: { signal: AbortSignal }) => service.get(owner, currentId, signal),
    }
  })
  return useQuery(options)
}
```

Prefer inference from the service and tagged options. When explicit types are necessary, query generics distinguish function data, error, selected view data, and key; mutation generics distinguish data, error, variables, and the `onMutate` result. That result is the third argument to `onError` and the **fourth** to `onSettled`; do not copy a source summary that calls it the third argument to both. Callback context is a separate final argument in this release. [Pinned mutation declarations](https://unpkg.com/@tanstack/vue-query@5.104.5/src/useMutation.ts)


## Imperative cache operations and host interop

| Need | Contract |
| --- | --- |
| Read or replace one result | `getQueryData(key)`, `getQueryState(key)`, `setQueryData(key, updater)`; concrete tagged keys preserve inference. Return a new immutable value; `undefined` from an updater does not delete/reset an entry. |
| Read/update an existing family | `getQueriesData(filters)` / `setQueriesData(filters, updater)`; existing matches can have different shapes, so narrow the resource family before applying an updater. Bulk writes do not invent missing queries. |
| Invalidate versus force refresh | `invalidateQueries(filters, options)` marks stale and normally refetches active matches; Vue defers the refetch half to `nextTick()` so reactive options settle. Await the returned promise, not a guessed timer. Refetch failures populate query error state but **do not reject this promise by default**; pass `{ throwOnError: true }` as the second argument when rejection is required. `refetchQueries` requests matching fetches directly; disabled/static queries are excluded by core policy. |
| Remove versus reset | `removeQueries(filters)` removes entries; `resetQueries(filters)` resets to initial state and refetches active queries. Stop private consumers and cancel work before an identity reset. `clear()` clears both caches, not just one resource family. |
| Shared indicators | `useIsFetching(filters)` and `useIsMutating(filters)` return count refs; use key filters so unrelated background work does not block a local form. `useMutationState({ filters, select })` returns an array ref with one result per matching retained mutation, not one observer's latest call. |
| Cache-level integration | `client.getQueryCache()` / `getMutationCache()` expose Vue-aware `find/findAll` and core `subscribe`; retain and invoke the unsubscribe function at owner disposal. Pass custom `QueryCache` / `MutationCache` to the client for global hooks. `setDefaultOptions`, `setQueryDefaults`, `setMutationDefaults` configure policy; they are not cache writes. |
| Non-browser hosts | Core exports such as `focusManager` and `onlineManager` are available directly from `@tanstack/vue-query`. Install a host event listener once, return listener cleanup, and do not replace it per component. Focus/online status controls scheduling, not proof that a backend is reachable. Low-level `QueryObserver` / `QueriesObserver` / `InfiniteQueryObserver` require explicit subscription cleanup; prefer Vue composables in components. |

The core re-export also includes hydration utilities and `notifyManager` / `environmentManager`. Preserve existing host integrations rather than overriding global notification or server-detection policy to silence a warning. Prefer the shipped Vue client/cache classes over importing framework-neutral clients into reactive Vue code. [Pinned client](https://unpkg.com/@tanstack/vue-query@5.104.5/src/queryClient.ts), [exports](https://unpkg.com/@tanstack/vue-query@5.104.5/src/index.ts)

### Persistence and paused mutations

Persistence is opt-in, distinct from SSR hydration. `VueQueryPlugin` accepts `clientPersister(client) => [unsubscribe, restorePromise]` and `clientPersisterOnSuccess(client)`. The plugin sets `client.isRestoring.value` while the promise is pending, suppresses query fetches, and invokes cleanup on app unmount. A rejected restore promise is not a documented automatic recovery path: the application-owned persister must deliberately discard/report corrupt or expired state and settle its restore contract. Partition payloads by principal/schema, exclude secrets, and remove private storage on logout. [Pinned plugin](https://unpkg.com/@tanstack/vue-query@5.104.5/src/vueQueryPlugin.ts)

For incumbent offline mutation replay: assign a stable `mutationKey`; register its real `mutationFn` with `client.setMutationDefaults(key, options)` **before** restoration, because functions cannot be serialized. After successful restoration, call and handle `client.resumePausedMutations()` (for example from `clientPersisterOnSuccess`). Persist only replayable variables and require server authorization, idempotency and conflict handling at replay time. `networkMode: 'online'` is the normal default; `'offlineFirst'` first attempts the operation and pauses retries, while `'always'` ignores connectivity. None makes an arbitrary write safe to replay. `reset()` clears a mutation observer's UI state, not a submitted server operation or all persisted entries. [Mutation persistence](https://tanstack.com/query/latest/docs/framework/vue/guides/mutations)


## Mutations and optimistic concurrency

- Capture tenant, resource ID and submitted values in mutation **variables**. A completion handler must invalidate the submitted resource, not whatever route/tenant is current when it settles.
- `mutate()` is fire-and-observe; show its error ref. `mutateAsync()` rejects, so callers must handle the promise. Hook-level handlers belong to every mutation; per-call observer callbacks can be replaced by later calls and are unsuitable for essential cache maintenance.
- Await/return invalidation when the UI must remain pending through reconciliation. Default invalidation marks matching entries stale and refetches active matches; `exact: true` restricts to one key, `refetchType: 'none'` only marks stale. The examples use default non-throwing refetch handling: consumers inspect the query's refresh-error state, while an accepted write remains successful. If opting into `{ throwOnError: true }`, catch/report reconciliation failure separately inside the mutation hook; a rejecting success-path hook enters mutation error handling and can trigger rollback after an accepted write. Neither policy is an atomic transaction with the backend. [Pinned refetch policy](https://unpkg.com/@tanstack/query-core@5.104.5/src/queryClient.ts), [mutation lifecycle](https://unpkg.com/@tanstack/query-core@5.104.5/src/mutation.ts).
- Prefer **UI-level optimism** for a pending form/row: render submitted variables separately from canonical data and discard the overlay on failure. When several mutations overlap, one mutation observer's `variables` is only its latest call; use distinct operation IDs and `useMutationState` to render all pending operations.

Complete cache-optimism composable against an **application-owned service interface**. Create it **once in a shared identity-bound app/feature provider**, with a non-secret `cacheScope` covering principal/tenant/auth epoch as required, and route all writes through `rename`. Readers must use the same `taskOptions` partition. Stop this provider's scope before removing its private entries; recreate it for the next identity. It rejects overlapping commands and suppresses its own cache callbacks after retirement. The service must retain submitted identity, authorize writes and enforce its conflict/version contract; disposal cannot undo an accepted server write.

```ts
import { onScopeDispose } from 'vue'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/vue-query'

export interface Task { id: number; tenant: string; title: string }
export interface Rename { tenant: string; id: number; title: string }
export interface TaskService {
  get(tenant: string, id: number, signal: AbortSignal): Promise<Task>
  rename(input: Rename): Promise<Task>
}

export function taskOptions(
  service: TaskService, cacheScope: string, tenant: string, id: number,
) {
  return queryOptions({
    queryKey: ['tasks', cacheScope, tenant, 'detail', id] as const,
    queryFn: ({ signal }) => service.get(tenant, id, signal),
  })
}

export function useSingleWriterRename(service: TaskService, cacheScope: string) {
  const client = useQueryClient()
  let active = true
  let writing = false
  onScopeDispose(() => { active = false })
  const mutation = useMutation({
    mutationFn: (input: Rename) => {
      if (!active) throw new Error('This writer has retired')
      return service.rename(input)
    },
    onMutate: async (input: Rename) => {
      if (!active) throw new Error('This writer has retired')
      const key = taskOptions(service, cacheScope, input.tenant, input.id).queryKey
      await client.cancelQueries({ queryKey: key, exact: true })
      if (!active) throw new Error('This writer has retired')
      const previous = client.getQueryData(key)
      if (previous) client.setQueryData(key, { ...previous, title: input.title })
      // Capture the installed value: structural sharing may change object identity.
      const installed = client.getQueryData(key)
      return { key, previous, installed }
    },
    onError: (_error, _input, snapshot) => {
      if (active && snapshot?.previous && client.getQueryData(snapshot.key) === snapshot.installed) {
        client.setQueryData(snapshot.key, snapshot.previous)
      }
    },
    onSettled: (_data, _error, input) => {
      if (active) return client.invalidateQueries({ queryKey: ['tasks', cacheScope, input.tenant] })
    },
  })

  async function rename(input: Rename): Promise<Task> {
    if (!active) throw new Error('This writer has retired')
    if (writing) throw new Error('A rename is already pending in this writer')
    writing = true
    try {
      return await mutation.mutateAsync({ ...input })
    } finally {
      writing = false
    }
  }
  return { rename, isPending: mutation.isPending, error: mutation.error }
}
```

Rollback must not overwrite a later mutation, a background refresh, or newly authenticated data. A reference-equality guard only prevents restoring over a different installed value; **it does not solve overlapping snapshots**: B can snapshot A's optimistic value, then restore it after both fail. Two separately created writers are not serialized by this example. For real concurrency use an app-wide per-resource coordinator, operation overlays with rebasing, or server versions/conflict resolution. TanStack mutation `scope: { id }` serializes mutation execution, but `onMutate` can run before the execution queue starts; it does not make overlapping optimistic snapshots safe. Invalidation from an earlier mutation can also clobber a later optimistic value. [Optimistic updates](https://tanstack.com/query/latest/docs/framework/vue/guides/optimistic-updates), [pinned mutation lifecycle](https://unpkg.com/@tanstack/query-core@5.104.5/src/mutation.ts)

Retirement is not mutation cancellation: hook-level callbacks can outlive their component, and a caller awaiting `rename()` must separately guard its own navigation/notice commits. Partitioned keys and the provider's active guard prevent this writer from rolling back or invalidating a later identity's cache; stop readers/writers, cancel/remove the retired partition, and clear its persisted state before exposing the next identity.

`removeQueries` retires query entries only: retained mutations can still contain private submitted variables, results, and errors. If using mutation keys for the same scope inventory, remove its retained operations through `const mutations = client.getMutationCache(); for (const entry of mutations.findAll({ mutationKey: retiredKey })) mutations.remove(entry)`. Use `client.clear()` only when both caches are entirely disposable/private. Neither mutation removal nor `clear()` cancels an accepted write or releases objects still held by its pending promise/observer; stop old UI owners and keep late-callback guards. [Exact mutation-cache `findAll` / `remove` / `clear`](https://unpkg.com/@tanstack/query-core@5.104.5/src/mutationCache.ts), [client `clear`](https://unpkg.com/@tanstack/query-core@5.104.5/src/queryClient.ts).

## SSR dehydration and serialization

Complete **standalone custom-server** helper for an application-provided root component, not a Nuxt plugin. Components opt into server loading with `onServerPrefetch(suspense)` or an explicit request-local `client.query(options)` call; do not await a query's `suspense()` while it remains disabled. The helper returns structured state; it does **not** implement an HTTP server or unsafe HTML embedding.

```ts
import { createSSRApp, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { QueryClient, VueQueryPlugin, dehydrate } from '@tanstack/vue-query'

export async function renderQueryRequest(
  root: Component, rootProps: Record<string, unknown> = {},
) {
  const app = createSSRApp(root, rootProps)
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, gcTime: Infinity } },
  })
  app.use(VueQueryPlugin, { queryClient: client })
  try {
    const html = await renderToString(app)
    const state = dehydrate(client, {
      shouldDehydrateMutation: () => false,
      shouldDehydrateQuery: (query) =>
        query.state.status === 'success' && query.meta?.ssr === true,
    })
    return { html, state }
  } finally {
    client.clear()
  }
}
```

The `meta: { ssr: true }` allowlist is an authored policy: mark only data authorized for this response's browser. Upstream dehydration otherwise includes successful queries by default and paused mutations by default; it is not a secret scrubber. Errors are excluded by the default success filter. Handle a required loader's failure as an explicit HTTP/render decision rather than claiming it was successfully prefetched.

On the browser, construct the app/client once, call `hydrate(client, state)` from `@tanstack/vue-query`, install `VueQueryPlugin` with that client, then hydrate/mount the same root with matching props and query keys. Use the host framework's safe payload serializer or an explicitly reviewed serializer such as named `stringify`/`parse` from `devalue`; **never insert unescaped `JSON.stringify(state)` into HTML**. Custom data types need matching serialization/revival; do not silently turn Dates into strings or serialize functions, credentials, request objects, or internal errors. See [Colada's concrete serializer example](pinia-colada.md#ssr-cache-serialization), which uses a different cache wire format.

Hydration freshness uses server `dataUpdatedAt`; keep server clocks correct and choose `staleTime` intentionally to avoid immediate duplicate refetches. Per-request clients do not make shared HTML/CDN caches safe for private pages. On logout or principal/tenant change, first stop protected consumers, then cancel/remove private cache entries and clear persisted private state before allowing the next identity to read it. Never reuse a dehydrated payload across users. Nuxt requires request-local plugin/payload integration; do not copy the old Nuxt 2/Vue 2 example into a Vue 3.5 app. [Official SSR guide](https://tanstack.com/query/latest/docs/framework/vue/guides/ssr)

## Incumbent v5 migration and debugging

| Older pattern or symptom | Current action |
| --- | --- |
| Positional hook/client arguments | Use one options/filter object (`useQuery({ queryKey, queryFn })`, `useMutation({ mutationFn })`); a deliberate second composable argument is the explicit client. |
| `cacheTime`, `useErrorBoundary` | Rename to `gcTime`, `throwOnError`; never rename `isError` to `throwOnError`. Error state and error propagation are different concerns. |
| `status: 'loading'`, old `isLoading` | Use `pending` / `isPending`; current query `isLoading` means `isPending && isFetching`. Mutations use `isPending`. |
| `keepPreviousData: true`, `isPreviousData` | Use `placeholderData: keepPreviousData` or an isolation-aware callback and `isPlaceholderData`. Placeholders report success and have `dataUpdatedAt: 0`; do not inherit prior status/timestamps. |
| Query `onSuccess/onError/onSettled`, `query.remove()` | Derive/watch or use global cache hooks; remove via `client.removeQueries`. Mutation lifecycle hooks remain. |
| Infinite query defaults/manual `pageParam`, `refetchPage` | Supply `initialPageParam` and `getNextPageParam`; let next/previous functions derive cursors. Use `maxPages` to bound stored/refetched pages; bidirectional retention needs both cursor functions. |
| Legacy dehydration booleans | Use `shouldDehydrateQuery` / `shouldDehydrateMutation`; review private-data filtering, not just syntax. |
| `isDataEqual`, custom logger, `hashQueryKey` | Use a deliberate `structuralSharing` function, application/cache reporting, and `hashKey` respectively; do not access private class internals. |
| Source mentions `initialData.updatedAt` removal | Do not remove the supported `initialDataUpdatedAt` option: it supplies the seed's real freshness timestamp. |
| Wrong result after input changes | Inspect concrete resolved keys and the options getter first; check captured primitives, missing filters and asynchronous reads of a later route. No injection: install the plugin or pass a client. Scope warning: move to setup/an owned scope, or use a one-shot client loader. |
| Queries stay paused/restoring | Inspect `fetchStatus`, network policy, host online manager and persister completion separately. Do not turn errors into successful empty data or set `'always'` on real network requests merely to hide the symptom. |

Older sources preparing 5.103.2 are not authority for this 5.104.5 baseline. Vue 2 examples are historical and out of this Vue 3.5 reference. `enableDevtoolsV6Plugin` is a legacy development panel; for Vue 3 prefer the separate `@tanstack/vue-query-devtools` integration and inspect its exact installed release before setup. [Official Vue migration guide](https://tanstack.com/query/latest/docs/framework/vue/guides/migrating-to-v5), [devtools](https://tanstack.com/query/latest/docs/framework/vue/devtools)

## Verification boundary and checks to add

Versions and signatures above were researched against registry metadata, official docs and pinned source; these examples are authored, **not executed in this reference**. The in-memory SFC is a local behavior example, service-backed code requires a supplied implementation, and SSR helpers require a real host/serializer integration. For application verification cover reactive ID changes, absent IDs, non-2xx responses, consumed abort signals, tenant switching while a request/mutation is pending, filter/page-key collisions, placeholder isolation, failed background refetches, overlapping optimistic operations, per-request SSR isolation and hydration freshness. See [testing](testing.md).

## Sources

- [5.104.5 registry metadata](https://registry.npmjs.org/@tanstack/vue-query/5.104.5); [exact Vue Query source](https://unpkg.com/@tanstack/vue-query@5.104.5/src/queryClient.ts); [mutation lifecycle](https://unpkg.com/@tanstack/query-core@5.104.5/src/mutation.ts).
- [Vue reactivity](https://tanstack.com/query/latest/docs/framework/vue/reactivity); [important defaults](https://tanstack.com/query/latest/docs/framework/vue/guides/important-defaults); [query keys](https://tanstack.com/query/latest/docs/framework/vue/guides/query-keys).
- [Mutations](https://tanstack.com/query/latest/docs/framework/vue/guides/mutations); [invalidation](https://tanstack.com/query/latest/docs/framework/vue/guides/query-invalidation); [optimistic updates](https://tanstack.com/query/latest/docs/framework/vue/guides/optimistic-updates).
- [Cancellation](https://tanstack.com/query/latest/docs/framework/vue/guides/query-cancellation); [pagination](https://tanstack.com/query/latest/docs/framework/vue/guides/paginated-queries); [SSR](https://tanstack.com/query/latest/docs/framework/vue/guides/ssr).
