# Pinia Colada: query state without mirrored stores

Read for `@pinia/colada` setup, reactive queries, cache actions, mutations, pagination, plugins, or SSR. Inspect the existing Pinia instance, service layer, query factories and identity boundary before adding another data owner.

In Nuxt, start with [Nuxt data ownership](nuxt.md#data-payload-and-cancellation) and select the official Colada module only when a query cache is needed; [Nuxt integrations](nuxt-integrations.md) owns that setup. Do not paste the standalone app-install or custom-server serialization helpers below into Nuxt, and do not give Colada and `useFetch`/`useAsyncData` independent ownership of the same result.

**Verified baseline:** `@pinia/colada` **1.4.8**, Vue **3.5.44**, Pinia **4.1.0**. Colada peers are Vue `^3.5.41` and Pinia `^2.2.6 || ^3.0.0 || ^4.0.2`; this combination satisfies them. Pinia 4.1.0 additionally requires `@vue/devtools-api ^8.2.1` and has optional TypeScript peer `>=5.6.0`. [Colada metadata](https://registry.npmjs.org/@pinia/colada/1.4.8), [Pinia metadata](https://registry.npmjs.org/pinia/4.1.0), [exact Colada declarations](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts).

## Choose and assign ownership

| Situation | Colada decision | Companion |
| --- | --- | --- |
| Existing Colada/Pinia application | Keep Colada as the canonical query cache; use its native keys and actions. | [Application stores](state.md) |
| Existing TanStack Query application or cross-framework query conventions | Keep the existing client unless the task requires migration. Do not cache the same resource in both libraries. | [TanStack Vue Query](tanstack-query.md) |
| Filter, selection, preferences, unsaved form draft | Own these locally or in a purposeful Pinia store. Derive the request key from them. | [Data architecture](architecture-data.md) |
| Shared remote result | Own it in Colada's query cache. Derive views; never continuously copy results into an application Pinia store. | [Data architecture](architecture-data.md) |

`useQueryCache()` and `useMutationCache()` are implemented as Pinia stores, but they are **Colada's caches**, not an instruction to model every remote result as an application store. `defineQuery()` shares a synchronous query setup and its extra refs; it does not define an ordinary Pinia store or automatically serialize those extra refs.

## Install Pinia first

Complete **standalone Vue** installation helper. Call once before mounting; the defaults below are explicit application policy. Keep existing Pinia installation instead of installing a second instance. Nuxt uses the module setup linked above, not this helper.

```ts
import type { App } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'

export function installColada(app: App): Pinia {
  const pinia = createPinia()
  app.use(pinia)
  app.use(PiniaColada, {
    queryOptions: { staleTime: 30_000, gcTime: 300_000 },
    plugins: [],
  })
  return pinia
}
```

Provide the options object even when empty. Query defaults belong under `queryOptions`, mutation defaults under `mutationOptions`; do not copy old root-level options. Installing after Pinia lets Colada find the correct instance. Its explicit `pinia` option is available for deliberate installation order, not a reason to create a second cache. Call composables in setup/an owned scope and use the **request's** explicit Pinia instance for server-side cache access. [Installation](https://pinia-colada.esm.dev/quick-start.md)

## Query contracts and Vue reactivity

- `useQuery({ key, query, ... })` or `useQuery(() => options)` is the **1.x** API. The old `useQuery(options, paramsGetter)` form was removed. `useQueryState(keyOrGetter)` reads an entry without fetching and initially returns undefined values if it does not exist.
- `key` and `enabled` accept values, refs or getters. `key: () => ['tasks', id.value]` tracks the ID; `key: ['tasks', id.value]` constructed once does not. For a dynamic bundle of options, pass a single whole-options getter.
- `defineQueryOptions(params => options)` makes reusable options with a data-tagged key. Pass `() => taskOptions(params.value)` to `useQuery`, not one eagerly evaluated result when params must remain reactive. `getQueryData(options.key)` then infers the data type.
- Keys must be nonempty JSON-serializable arrays. Include resource, tenant, authenticated subject/auth epoch when relevant, ID, filters, search, sort, includes/projection, locale and page size. Include every representation-changing argument: an `includeComments` request flag cannot be omitted from the key. Normalize both key and request from one snapshot.
- The query receives `{ signal, entry }` and returns a promise. Forward `signal` to `fetch` and child requests. Capture immutable request inputs in the options factory; do not look up a new route/tenant after an `await` while writing the response under an earlier key.
- `enabled: false` suppresses automatic fetching, **not access control or cache removal**. It can still expose cached data, and imperative `refresh/refetch` are not authorization guards. Validate required service inputs before calling the transport.
- Use the returned grouped `state` for status-based TypeScript narrowing. State fields are refs/computed refs: `.value` in script, top-level template bindings auto-unwrap. `state.status` is `pending / success / error`; `asyncStatus` is `idle / loading`. `isPending` means no final data state; `isLoading` includes background loading.
- Queries have no per-instance `onSuccess/onError/onSettled`. Use pure derivation for view data, a scoped watcher for a real component side effect, or the bundled query-hooks plugin for global policy. Do not use a watcher to mirror canonical data into a store.

[Queries](https://pinia-colada.esm.dev/guide/queries.md), [keys](https://pinia-colada.esm.dev/guide/query-keys.md), [pinned types](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts).

When using `useQuery(() => options)`, return resolved option values: read reactive inputs inside the factory and return a boolean `enabled`. Direct getter/ref-valued options and factory return types differ in 1.4.8; do not nest an `enabled` getter inside the factory's returned object.

### Local in-memory query, mutation and pagination

Complete SFC after plugin installation. This is one local dataset for one mounted demo instance, not a backend, authentication, persistence or latency demonstration. A multi-component application must provide one appropriately scoped service rather than creating different datasets behind identical cache keys.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { defineQueryOptions, useMutation, useQuery, useQueryCache } from '@pinia/colada'

type Task = { id: number; tenant: string; title: string; done: boolean }
type Filter = 'all' | 'open'
type TaskPage = { tenant: string; filter: Filter; items: Task[]; hasMore: boolean }
type PageInput = { owner: string; selected: Filter; currentPage: number }
type Rename = { tenant: string; id: number; title: string }

const records: Task[] = [
  { id: 1, tenant: 'A', title: 'Read query keys', done: false },
  { id: 2, tenant: 'A', title: 'Review cancellation', done: true },
  { id: 3, tenant: 'B', title: 'Review tenant isolation', done: false },
]
const tenant = ref('A')
const filter = ref<Filter>('all')
const page = ref(1)

async function listTasks(input: PageInput, signal: AbortSignal): Promise<TaskPage> {
  signal.throwIfAborted()
  await Promise.resolve()
  signal.throwIfAborted()
  const matching = records.filter((task) =>
    task.tenant === input.owner && (input.selected === 'all' || !task.done))
  return {
    tenant: input.owner,
    filter: input.selected,
    items: matching.slice(input.currentPage - 1, input.currentPage).map((task) => ({ ...task })),
    hasMore: input.currentPage < matching.length,
  }
}

const pageOptions = defineQueryOptions((input: PageInput) => ({
  key: ['memory-tasks', input.owner, { filter: input.selected, page: input.currentPage }],
  query: ({ signal }) => listTasks(input, signal),
  placeholderData: (previous: TaskPage | undefined) =>
    previous?.tenant === input.owner && previous.filter === input.selected ? previous : undefined,
}))
const { state, asyncStatus, isPlaceholderData } = useQuery(() => ({
  ...pageOptions({ owner: tenant.value, selected: filter.value, currentPage: page.value }),
  enabled: tenant.value.length > 0,
}))

const cache = useQueryCache()
const reconciliationError = ref<unknown>(null)
const { mutate, isLoading: saving, error: saveError } = useMutation({
  onMutate: () => { reconciliationError.value = null },
  mutation: async (input: Rename): Promise<Task> => {
    const task = records.find((item) => item.tenant === input.tenant && item.id === input.id)
    if (!task) throw new Error('Task no longer exists in this local dataset')
    task.title = input.title
    return { ...task }
  },
  onSuccess: async (_saved, input) => {
    try {
      await cache.invalidateQueries({ key: ['memory-tasks', input.tenant] })
    } catch (cause) {
      reconciliationError.value = cause
    }
  },
})
</script>

<template>
  <section>
    <h1>Local Colada example</h1>
    <label>Tenant <select v-model="tenant" @change="page = 1">
      <option>A</option><option>B</option>
    </select></label>
    <label>Filter <select v-model="filter" @change="page = 1">
      <option value="all">All</option><option value="open">Open</option>
    </select></label>
    <p v-if="asyncStatus === 'loading'" role="status">Loading or refreshing page</p>
    <p v-if="state.status === 'error'" role="alert">{{ state.error.message }}</p>
    <p v-if="saveError" role="alert">{{ saveError.message }}</p>
    <p v-if="reconciliationError" role="alert">
      The local rename succeeded, but refreshing failed. {{ String(reconciliationError) }}
    </p>
    <p v-if="isPlaceholderData">Showing the previous page while the next page loads.</p>
    <ul v-if="state.data">
      <li v-for="task in state.data.items" :key="task.id">
        {{ task.title }}
        <button type="button" :disabled="saving || isPlaceholderData"
          @click="mutate({ tenant: task.tenant, id: task.id, title: task.title + '!' })">
          Append exclamation mark locally
        </button>
      </li>
    </ul>
    <p v-if="state.data && state.data.items.length === 0">No matching tasks.</p>
    <button type="button" :disabled="page === 1" @click="page--">Previous</button>
    <span>Requested page {{ page }}</span>
    <button type="button" :disabled="isPlaceholderData || !state.data?.hasMore" @click="page++">
      Next
    </button>
  </section>
</template>
```

### Reuse is not a second cache

Plain `useQuery` calls with the same key resolve to the same cached entry; do not claim they each create an independent canonical result. They must agree on the resource and request semantics. Use `defineQueryOptions` for independent component parameters. Use `defineQuery` when the setup's **additional state itself** should be shared, such as one shared filter/controller. Its setup must be synchronous. A component-local filter and an intentionally global filter are different ownership choices; cache-key deduplication does not decide that choice.

Do not depend on whichever observer last supplied an entry's options to reconcile conflicting functions under one key. A store that owns a live query can keep that query active for the store's lifetime. Prefer cache reads for passive access, guard genuine live queries with reactive `enabled`, and dispose feature scopes when their lifetime ends. Extra refs returned by `defineQuery` are not ordinary Pinia-serialized state: serialize/hydrate those separately or move intentionally shared SSR inputs into a real application store. [Reusable queries](https://pinia-colada.esm.dev/advanced/reusable-queries.md), [pinned cache reuse implementation](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs).

In 1.4.8, `defineQuery` retains one setup result per query-cache instance. Losing the last scoped consumer **pauses** its setup scope and untracks its entries; it does not stop/recreate that setup or reset extra refs. A later consumer resumes the same setup. Entry `gcTime` governs cached query entries, not these extra controller refs. The setup scope belongs to the Pinia cache store and ends when that Pinia is disposed. Do not equate route unmount, cache-entry GC, and store disposal. [Exact `ensureDefinedQuery` / `defineQuery` lifecycle](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs)

Private-identity retirement must also reset any extra refs retained by `defineQuery`; deleting entries or leaving the route does not reset that controller. Keep private inputs/results out of those extra refs, provide an explicit owner reset, or dispose the identity's Pinia when the whole app boundary ends. Do not stop an internal cache scope or add a second Pinia just to clear one feature.

## Freshness, errors, and cancellation

| Concern | Colada 1.4.8 contract |
| --- | --- |
| `staleTime` | Default `5000` ms. Controls freshness, not a polling interval or deletion. |
| `gcTime` | Query default `300_000` ms after inactivity; `false` disables GC. Mutation default `60_000` ms. It does not make data fresh. |
| `refresh()` | Prefer for normal refresh/prefetch: respects freshness and deduplicates pending work. |
| `refetch()` | Forces a fetch; can replace/cancel a pending call. Do not use for every reactive-input change; the key drives that. |
| Promise errors | `refresh()` and `refetch()` normally resolve state even on failure. Pass `true` to reject: `await refresh(true)`. Lower-level `cache.refresh/cache.fetch` can reject. |
| Result errors | A failed background fetch can retain previous data. Render the refresh failure without unnecessarily destroying useful content. |
| Cancellation | `cache.cancelQueries({ key, exact: true })` is synchronous. It aborts the context signal and discards that pending result; a transport that ignores the signal can still consume resources. A caller-owned/external abort need not be treated as an internally canceled query. |
| Retry | Retry is an optional plugin, not a core default to assume from TanStack Query. Do not silently retry validation/authorization failures or non-idempotent writes. |

Last-consumer cleanup is not the same command as `cancelQueries`. In **1.4.8**, untracking the last consumer aborts the controller only while the entry's data status is `pending`; it does not clear `entry.pending`. A transport that ignores that abort can still publish its result, and a background refresh with existing success/error state is not aborted by this path. For private retirement, stop consumers and explicitly `cancelQueries` before removing inactive entries; that command clears pending ownership so late results are ignored. [Exact `untrack` / `scheduleGarbageCollection` / `cancel` / `fetch` branches](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs).

`fetch()` resolves on HTTP 4xx/5xx. Complete transport helper, with an explicit application-owned URL/decoder contract rather than a fictional endpoint:

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

Throw/reject for failures; never catch and return `[]` to make a failed query appear successful. Runtime decoding belongs in the service boundary; TypeScript assertions do not validate JSON. Do not expose private response bodies or credentials in error messages. [Query API](https://pinia-colada.esm.dev/guide/queries.md), [cancellation implementation](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs).

## Mutations, invalidation, and rollback

- `mutate(vars)` does not reject; observe its error state. `mutateAsync(vars)` returns a rejecting promise; callers must handle it. `variables` is the latest call's input, not a log of concurrent operations.
- Submit a snapshot containing tenant and resource ID. Completion hooks must use **submitted variables**, not the current route/tenant. Keep successful write state distinguishable from a later reconciliation failure.
- `cache.invalidateQueries({ key: ['tasks', tenant] })` marks matching active/inactive entries stale and normally refetches active, enabled entries. Prefix matching is default; `exact: true` narrows it. The second argument `false` suppresses refetch; `'all'` also refetches inactive enabled entries. Even `'all'` does not override `enabled: false`. Invalidation also cancels matching pending work.
- Return/await invalidation from a mutation hook when pending UI must extend through reconciliation. Do not promise atomic server/cache consistency.
- For cache optimism, put `onMutate` **before** `mutation` in the options object so its returned context is inferred in later hooks. Context properties can be undefined if `onMutate` throws.
- Prefer UI-level optimism for a collocated form: overlay submitted variables while loading; remove the overlay on failure and display the error. Multiple pending operations need distinct operation IDs and mutation-cache entries, not just the latest `variables` ref.

Complete cache-optimism composable against an **application-owned service interface**. Instantiate it **once in a shared identity-bound app/feature provider**, with a non-secret `cacheScope` covering principal/tenant/auth epoch as required, and route all writes through `rename`. Readers must use the same `taskOptions` partition. Stop this provider's scope before removing its private entries; recreate it for the next identity. One pending command is permitted, and its cache callbacks stop publishing after retirement. The service must retain submitted identity, authorize writes and enforce its conflict/version contract; disposal cannot undo an accepted server write.

```ts
import { onScopeDispose, shallowRef } from 'vue'
import { defineQueryOptions, useMutation, useQueryCache } from '@pinia/colada'

export interface Task { id: number; tenant: string; title: string }
export interface Rename { tenant: string; id: number; title: string }
export interface TaskService {
  get(tenant: string, id: number, signal: AbortSignal): Promise<Task>
  rename(input: Rename): Promise<Task>
}

export function taskOptions(
  service: TaskService, cacheScope: string, tenant: string, id: number,
) {
  return defineQueryOptions({
    key: ['tasks', cacheScope, tenant, 'detail', id],
    query: ({ signal }) => service.get(tenant, id, signal),
  })
}

export function useSingleWriterRename(service: TaskService, cacheScope: string) {
  const cache = useQueryCache()
  let active = true
  let writing = false
  onScopeDispose(() => { active = false })
  const reconciliationError = shallowRef<unknown>(null)
  const mutation = useMutation({
    onMutate: (input: Rename) => {
      if (!active) throw new Error('This writer has retired')
      const key = taskOptions(service, cacheScope, input.tenant, input.id).key
      cache.cancelQueries({ key, exact: true })
      const previous = cache.getQueryData(key)
      const installed = previous ? { ...previous, title: input.title } : undefined
      if (installed) cache.setQueryData(key, installed)
      return { key, previous, installed }
    },
    mutation: (input: Rename) => {
      if (!active) throw new Error('This writer has retired')
      return service.rename(input)
    },
    onError: (_error, _input, snapshot) => {
      if (active && snapshot.previous && cache.getQueryData(snapshot.key) === snapshot.installed) {
        cache.setQueryData(snapshot.key, snapshot.previous)
      }
    },
    onSettled: async (_data, _error, input) => {
      if (!active) return
      try {
        await cache.invalidateQueries({ key: ['tasks', cacheScope, input.tenant] })
      } catch (cause) {
        if (active) reconciliationError.value = cause
      }
    },
  })

  async function rename(input: Rename): Promise<Task> {
    if (!active) throw new Error('This writer has retired')
    if (writing) throw new Error('A rename is already pending in this writer')
    writing = true
    reconciliationError.value = null
    try {
      return await mutation.mutateAsync({ ...input })
    } finally {
      writing = false
    }
  }
  return { rename, isLoading: mutation.isLoading, error: mutation.error, reconciliationError }
}
```

The separate `reconciliationError` is intentional, not a swallowed write error: consumers must present it as “refresh failed,” while `rename` still resolves an accepted write or rejects the original write failure. In 1.4.8, a rejecting `onSettled` overrides the mutation promise's outcome and prevents the following assignment of `asyncStatus = 'idle'`. Catch/report refresh failures inside that hook rather than misclassifying an accepted write or leaving loading stuck. [Pinned mutation-cache `mutate` finally block](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs)

Mutation hooks can finish after their consumer unmounts; callers awaiting `rename()` must separately guard their own navigation/notice commits. The active guard and partitioned keys prevent this writer's late rollback/invalidation from reaching a later identity. Stop private readers/writers, cancel/remove the retired partition and clear its persisted state before exposing the next identity; removing a mutation-cache entry does not cancel its accepted server write.

Query removal does not erase retained mutation variables/results. Inventory private mutation entries too with `useMutationCache().getEntries({ key })` and remove the retired entries with that cache's `remove(entry)` after stopping their UI owners. Removal is bookkeeping, not write cancellation, and a still-running mutation keeps its entry/variables in its promise closure until it settles; keep the completion guards above. The query cache and mutation cache have separate GC and removal actions. [Exact mutation `ensure` / `remove` / `mutate` implementation](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs).

An unconditional snapshot rollback can erase another mutation or a background refresh. A reference-equality guard prevents restoring over a different installed value but **does not compose overlapping snapshots**: B can snapshot A's optimistic value, then restore it after both fail. Separately instantiated writers are not serialized. For overlapping writers, use an app-wide per-resource coordinator, operation overlays with rebasing, or server versions/conflict resolution. Earlier invalidations can overwrite later optimism too; a bare `onError => restore(previous)` is not a general concurrency solution. Never restore across a principal/tenant cache reset. [Optimistic updates](https://pinia-colada.esm.dev/guide/optimistic-updates.md), [invalidation](https://pinia-colada.esm.dev/guide/query-invalidation.md).

### Cache actions and shared mutation state

| Need | Native API and boundary |
| --- | --- |
| Read/write one canonical result | `getQueryData(key)`, `setQueryData(key, valueOrUpdater)`; tagged factory keys preserve inference. Replace objects/arrays instead of mutating cached results in place. |
| Update existing matching results | `setQueriesData(filters, updater)`; handle each response shape explicitly. Do not apply an ordinary-list updater to an infinite entry or detail object. |
| Prefetch | `const entry = cache.ensure(options); await cache.refresh(entry)`. It is one-shot, not a reactive subscription. Inspect the resolved state or catch rejection. |
| Read state without a fetch | `useQueryState(keyOrGetter)`; no extra options/params argument in 1.x. |
| Reset/remove | `setQueryData(key, undefined)` is not the typed reset API. Use `setEntryState(entry, { status: 'pending', data: undefined, error: null })` for a compatible entry, or `cache.remove(entry)` when removing it. Cancel pending work first when removing private data. |
| Observe mutations elsewhere | Assign a mutation `key` and inspect `useMutationCache().getEntries({ key })`; these are entries with their own state/async status, not another canonical query result store. |
| Reuse mutation definitions | `defineMutationOptions` shares typed options; `defineMutation` shares a mutation setup. Deliberately choose whether an observer/latest-call state should be shared. |

[Query cache](https://pinia-colada.esm.dev/advanced/query-cache.md), [mutation API](https://pinia-colada.esm.dev/guide/mutations.md).

### Entry filters, lifecycle, and global mutation context

`getEntries({ key, exact, stale, active, status, predicate })` combines a key prefix with the supplied state filters; `exact: true` requires a key. `active: true/false` selects observed/unobserved entries; `null` or absence includes both. A predicate runs after the other filters. Use `cache.get(key)` only when raw entry control is required: `entry.state` / `asyncStatus` are shallow refs, `when` is the last-data timestamp (`0` after invalidation), `pending` contains the controller/promise, and `options` can be null after hydration until `ensure` attaches fetching options. `entry.stale` is evaluated on access, not by a reactive wall-clock timer.

For a guard/loader use the request/app's `useQueryCache(pinia)` within its app injection context, then `ensure(factory(snapshot))` and `await cache.refresh(entry)`. It does not subscribe to future route changes. `cache.fetch(entry)` forces work; `cache.refresh(entry)` respects freshness/deduplication. Prefer these over hand-constructing an entry with `create`. `invalidate(entry)` and `cancel(entry)` are lower-level single-entry controls; use filtered actions for resource families. Remove only **inactive** entries after stopping consumers and canceling work, not while a live query still owns them. [Exact cache/runtime](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs)

Mutation entries are indexed by numeric IDs, not query keys. `useMutationCache().get(id)` reads one retained operation; `getEntries({ key, status, predicate })` selects operations for shared UI. A mutation key may be an array or a function of submitted variables. `reset()` resets the composable's latest state, not an accepted server write. For low-level cache calls, ensure a fresh entry/variables before `mutate`; never replay an already-used entry. `defineMutationOptions` supplies tagged reusable options, while `defineMutation` shares synchronous setup and its additional refs; invoke it inside a component/store/owned scope.

Global `mutationOptions.onMutate` may return application context; local `onMutate` context is merged with it for the mutation and later hooks. Augment `UseMutationGlobalContext` only with properties actually supplied by that global hook; `entry` is already provided by the library's common context. Keep submitted resource identity in variables instead of hiding it in a changing global context. Global hooks are lifecycle policy, not serializable mutation data. [Pinned mutation contracts](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts)


## Pagination and placeholders

For ordinary pagination put page/cursor and page size in the key. `placeholderData: previous => previous` keeps display continuity, **reports success without populating the new cache entry**, and is not serialized as canonical data. The local example restricts continuity to the same tenant/filter. Do not let previous-user/tenant results survive into another identity's loading UI; qualify totals and disable actions with `isPlaceholderData`. `initialData: () => data` instead seeds successful cache state; use `initialDataUpdatedAt` when that data has an older timestamp. [Paginated queries](https://pinia-colada.esm.dev/guide/paginated-queries.md)

For accumulated pages use `useInfiniteQuery`, `initialPageParam`, `getNextPageParam`, `hasNextPage`, and **`loadNextPage`**; do not copy TanStack's `fetchNextPage` name. The query receives `{ pageParam, signal, entry }`; tenant/filter/sort remain in the key but the evolving page parameter does not. Data is `{ pages, pageParams }`. Preserve this shape, return null/undefined from the next-page function at the end, prevent duplicate load triggers, and set `maxPages` when necessary. `getPreviousPageParam` enables backward loading. Use `setInfiniteQueryData(cache, key, valueOrUpdater)` rather than ordinary `setQueryData` when priming an infinite entry; it initializes infinite-query extensions. Do not reuse its key for an ordinary query. [Infinite queries](https://pinia-colada.esm.dev/guide/infinite-queries.md)

Complete cursor composable against an application-owned service. It uses the tagged infinite-options factory, captures tenant identity, and ignores repeated load requests while any current operation is pending. Call in setup/an owned scope; handle the rejecting `next()` promise in the UI.

```ts
import { type Ref } from 'vue'
import { defineInfiniteQueryOptions, useInfiniteQuery } from '@pinia/colada'

export interface FeedItem { id: string; title: string }
export interface FeedPage { items: FeedItem[]; nextCursor: string | null }
export interface FeedReader {
  list(tenant: string, cursor: string | null, signal: AbortSignal): Promise<FeedPage>
}

export function useTenantFeed(tenant: Readonly<Ref<string>>, service: FeedReader) {
  const options = defineInfiniteQueryOptions((owner: string) => ({
    key: ['feed', owner],
    enabled: owner.length > 0,
    initialPageParam: null as string | null,
    query: ({ pageParam, signal }) => service.list(owner, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    maxPages: 10,
  }))
  const query = useInfiniteQuery(() => options(tenant.value))
  async function next(): Promise<void> {
    if (!query.hasNextPage.value || query.isLoading.value) return
    await query.loadNextPage({ cancelRefetch: false, throwOnError: true })
  }
  return { ...query, next }
}
```

`getNextPageParam(lastPage, allPages, lastPageParam, allPageParams)` and the corresponding previous-page function must return the service's real cursor. `loadNextPage` / `loadPreviousPage` default to `cancelRefetch: true`, `throwOnError: false`; use `cancelRefetch: false` to ignore a duplicate trigger, and opt into rejection when the caller handles it. When manually changing pages, update **both** `pages` and `pageParams` consistently; appending a page without its parameter corrupts the refetch contract. A `maxPages` window discards pages, not the underlying records; backward navigation needs a real previous-cursor function. [Pinned infinite declarations](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts)


## SSR cache serialization

Queries called in a component register `onServerPrefetch` internally and await enabled queries during SSR. `ssrCatchError` defaults to false; choose the render/HTTP error policy deliberately rather than silently presenting failed data as a successful prefetch. A lazy `enabled: false` query is not fetched on the server.

Complete **standalone custom-server** query-cache helper, not a Nuxt plugin. It uses optional serializer **`devalue` 6.0.3**, whose actual API exports **named** `stringify` and `parse`, not a default `devalue` object. [Serializer exports](https://unpkg.com/devalue@6.0.3/types/index.d.ts). The application supplies its real root component; the helper handles Colada's query payload, not an HTTP server or unrelated application-store state.

```ts
import { createSSRApp, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia, disposePinia } from 'pinia'
import { stringify } from 'devalue'
import {
  PiniaColada, PiniaColadaSSRNoGc, serializeQueryCache, useQueryCache,
} from '@pinia/colada'

export async function renderColadaRequest(
  root: Component, rootProps: Record<string, unknown> = {},
) {
  const app = createSSRApp(root, rootProps)
  const pinia = createPinia()
  app.use(pinia)
  app.use(PiniaColada, { plugins: [PiniaColadaSSRNoGc()] })
  const cache = app.runWithContext(() => useQueryCache(pinia))
  try {
    const html = await renderToString(app)
    const all = serializeQueryCache(cache)
    const payload: ReturnType<typeof serializeQueryCache> = {}
    for (const entry of cache.getEntries({
      status: 'success', predicate: (entry) => entry.meta.ssr === true,
    })) {
      payload[entry.keyHash] = all[entry.keyHash]!
    }
    return { html, state: stringify(payload) }
  } finally {
    cache.cancelQueries()
    cache.caches.clear()
    disposePinia(pinia)
  }
}
```

Complete client restoration helper for a **server-generated payload delivered through the host's trusted payload channel**; validate external/untrusted persisted data before calling a cache hydrator. Call before mounting/hydrating the same root, with matching root props. Ordinary application Pinia-store state must also be restored separately before consumers run if the root uses it.

```ts
import { createSSRApp, type Component } from 'vue'
import { createPinia } from 'pinia'
import { parse } from 'devalue'
import {
  PiniaColada, hydrateQueryCache, useQueryCache,
} from '@pinia/colada'

export function restoreColadaApp(
  root: Component, rootProps: Record<string, unknown>, serialized: string,
) {
  const app = createSSRApp(root, rootProps)
  const pinia = createPinia()
  app.use(pinia)
  app.use(PiniaColada, {})
  app.runWithContext(() => {
    hydrateQueryCache(useQueryCache(pinia), parse(serialized))
  })
  return app
}
```

- Create **fresh app, Pinia and caches per request**. Never use a server singleton or process-global active Pinia as request identity.
- `serializeQueryCache`/`hydrateQueryCache` are required for Colada's cache representation; serializing an arbitrary Pinia store snapshot is not a substitute. `isQueryCache` supports a custom serializer reducer when serializing a larger Pinia graph instead of the dedicated payload above. `isMutationCache` identifies mutation stores in such a graph; exclude their operation state from a query-only browser payload instead of treating mutation entries/functions as ordinary serializable application data.
- The success plus `meta: { ssr: true }` allowlist is authored policy, not an upstream default: `serializeQueryCache` otherwise includes all cached entries, including error/data/meta. Serialize only data authorized for this response's browser; do not include tokens, request objects, internal errors, functions, or privileged fields. Custom classes/errors need explicit safe serialization/revival if deliberately included.
- `PiniaColadaSSRNoGc()` disables query/mutation GC timers on the server, including per-call overrides. Clear the request's caches after rendering/serialization and dispose the Pinia scope. Do not apply this retention policy to the browser by accident.
- Preserve the serializer's escaping when embedding payloads. Never insert raw unescaped `JSON.stringify` output into HTML, `eval` a payload, or reuse private HTML/payloads through shared CDN caches. Hydrate before mounting to avoid duplicate loads and inconsistent initial views.
- Stop protected consumers on logout/principal change, cancel pending work, remove private entries and clear persisted private caches before the next identity can consume them. Tenant-key separation alone is not server authorization or protection against a mismatched SSR payload.
- **Nuxt boundary:** [Nuxt integrations](nuxt-integrations.md) owns the selected official `@pinia/colada-nuxt` **1.2.0** setup with `@pinia/nuxt`, including module-managed SSR serialization and cleanup. Its Colada peer requires `>=1.4.5`, not proof of arbitrary host/module compatibility. Do not duplicate the custom-server helpers or wrap a Colada-owned query in a second native data cache. Within shared `defineQuery` files, official guidance explicitly imports `useRoute` from `vue-router` rather than relying on Nuxt's auto-imported route wrapper. [Official Nuxt integration](https://pinia-colada.esm.dev/nuxt.md), [exact module metadata](https://registry.npmjs.org/@pinia/colada-nuxt/1.2.0).

[SSR guide](https://pinia-colada.esm.dev/guide/ssr.md), [exact serialization implementation](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs), [devalue metadata](https://registry.npmjs.org/devalue/6.0.3).

## Plugins and migration boundaries

Plugins go in `PiniaColada`'s `plugins` array and run in installation order. In **1.4.8**, custom plugins receive **`{ queryCache, pinia, scope }`**, not `mutationCache`. Opt into mutations with `useMutationCache(pinia)`; this preserves core tree-shaking. Own reactive effects through the supplied scope. `TypesConfig` module augmentation can type the default error and query/mutation meta, but cannot transform or validate actual thrown values. Keep SSR meta serializable. [Exact plugin context](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts)

| Capability | Verified package/status and decision |
| --- | --- |
| Global query hooks | Bundled `PiniaColadaQueryHooksPlugin({ onSuccess, onError, onSettled })`; suitable for one cache-level reporting policy. Do not recreate per-observer success/error side effects. |
| Server timer policy | Bundled `PiniaColadaSSRNoGc()`; server-only, used above. |
| Retry | Optional `@pinia/colada-plugin-retry` **1.0.3**, peer Colada `>=1.4.6`. Choose retryability/idempotency explicitly; core does not silently supply this behavior. |
| Loading-delay policy | Optional `@pinia/colada-plugin-delay` **0.2.1**, peer `>=1.1.0`. Use for deliberate loading-feedback UX, not artificial transport latency. |
| Periodic refresh | Optional `@pinia/colada-plugin-auto-refetch` **0.2.7**, peer `>=1.4.6`. Distinguish polling from freshness; stop unnecessary background work. |
| Persistence | Optional `@pinia/colada-plugin-cache-persister` **1.1.3**, peer `>=1.4.7`. Define expiry/schema and identity partitioning; clear private persisted entries at logout. Persistence is not SSR or authorization. |
| Devtools | Separate `@pinia/colada-devtools` **2.0.1**. v2 uses Vite/Devframe integration, not a root Vue component or `app.use` plugin. Vite peer is `^7.0.0 || ^8.0.0`; choose its Vite or standalone host and install the corresponding peers. Do not copy removed v1 component imports. |

These optional package peer ranges admit Colada 1.4.8; they do not establish compatibility for every host/framework combination. Read [official plugin guidance](https://pinia-colada.esm.dev/plugins/official.md), [devtools v2 migration](https://pinia-colada.esm.dev/cookbook/migration-devtools-v2.md), and each package's exact metadata before changing the host integration.

For old code, migrate `QueryPlugin` to `PiniaColada`, root defaults into `queryOptions`, `isFetching` to `isLoading`, `setQueryState` to `setEntryState`, and old infinite-query `loadMore/initialPage` to `loadNextPage/initialPageParam`. In 1.x use the single getter form and `useQueryState(keyOrGetter)`; the shipped codemods describe those cutovers. Do not leave a second set of deprecated wrappers/caches alongside the native API. [Changelog](https://github.com/posva/pinia-colada/blob/main/CHANGELOG.md)

### Typed metadata and a real plugin action subscription

Complete type augmentation module; include it in the application's TypeScript compilation. These are application-defined metadata fields, not automatically implemented behavior:

```ts
import '@pinia/colada'

declare module '@pinia/colada' {
  interface TypesConfig {
    defaultError: Error
    queryMeta: { ssr?: boolean; onErrorMessage?: string }
    mutationMeta: { operation?: string }
  }
}
```

Complete custom plugin with an application-owned outcome sink. It observes actual query fetch outcomes; the sink must implement its own privacy-safe reporting and must not throw. The subscription is disposed with the supplied scope:

```ts
import { onScopeDispose } from 'vue'
import { type PiniaColadaPlugin } from '@pinia/colada'

export interface QueryOutcome { keyHash: string; outcome: 'success' | 'error' }

export function queryOutcomePlugin(
  report: (outcome: QueryOutcome) => void,
): PiniaColadaPlugin {
  return ({ queryCache, scope }) => {
    scope.run(() => {
      const unsubscribe = queryCache.$onAction(({ name, args, after, onError }) => {
        if (name !== 'fetch') return
        const [entry] = args
        after(() => report({ keyHash: entry.keyHash, outcome: 'success' }))
        onError(() => report({ keyHash: entry.keyHash, outcome: 'error' }))
      }, true)
      onScopeDispose(unsubscribe)
    })
  }
}
```

Register the returned plugin in `plugins` during installation. Fetch-action rejection includes aborted/outdated work that may not become entry error state; classify those separately if the sink drives user notifications. For conventional global query callbacks prefer the bundled `PiniaColadaQueryHooksPlugin`; its callbacks observe **fetches**, not every cache write. To observe any canonical state change subscribe to `setEntryState`, including writes from `setQueryData`.

For entry extensions, subscribe to `extend(entry)`, create reactive fields inside `scope.run`, and add properties to `entry.ext` without replacing the extension object. Augment the matching `UseQueryEntryExtensions<TData, TError, TDataInitial>` or `UseMutationEntryExtensions<TData, TVars, TError, TContext>` interface with the real field type; initialize it for every entry before consumers read it. Extend `UseQueryOptions` / `UseMutationOptions` (and global counterparts for defaults) only when the plugin actually implements the added option. Observe `remove` and cancel any plugin-owned per-entry timers/resources there; owning the plugin scope alone is not per-entry cleanup. [Plugin authoring](https://pinia-colada.esm.dev/plugins/writing-plugins.md)

### Incumbent migration and compatibility

| Existing code | Native 1.4.8 action |
| --- | --- |
| `useQuery(options, paramsGetter)` | `useQuery(() => options(paramsGetter()))`; do not eagerly snapshot reactive params. |
| `useQueryState(options, paramsGetter)` | `useQueryState(() => options(paramsGetter()).key)`; read without scheduling a request. |
| `queryCache.cancelQuery(entry)` | `queryCache.cancel(entry)`; use `cancelQueries(filters)` for a family. |
| Reset by writing `undefined` | Use `setEntryState` with the desired compatible state, or stop consumers/cancel/remove the inactive entry. |
| Old infinite-page cache seeding | Use `setInfiniteQueryData`; preserve paired `pages` / `pageParams`. |
| Older plugin installation/grouping | `migration-0-13-to-0-14.yaml` groups defaults and adds the options object; rename older `QueryPlugin` imports/callers explicitly. `migration-0-21-to-1-0.yaml` migrates the two-argument query forms. For the latter, the deliberate migration command is `ast-grep scan -r node_modules/@pinia/colada/codemods/rules/migration-0-21-to-1-0.yaml -i src`; choose the matching rule for older grouping changes, then review the complete diff and all callers. |

For an existing TanStack-to-Colada migration, map `queryKey/queryFn` to `key/query`, result `fetchStatus` to `asyncStatus`, infinite `fetchNextPage` to `loadNextPage`, and `select` to a computed view. Revisit freshness defaults, mutation pending indicators, invalidation arguments, retry, persistence and SSR wire format rather than performing a mechanical name swap. Colada core has no TanStack `networkMode`/offline-paused state or `structuralSharing` option; retain a real application offline strategy when that capability is required.

The official optional **`@pinia/colada-plugin-tanstack-compat` 0.1.0**, peer Colada `>=1.0.0`, is for an **incumbent** compatibility deployment, not this reference's default cutover. Register `PiniaColadaTanStackCompat()` from that package in `plugins` when maintaining such an installation. It adds status/timestamp convenience fields, not a second cache and not full TanStack semantics: no `'paused'` fetch status, `networkMode`, `select`, or automatic time-driven staleness updates. Read `entry.stale` when evaluating freshness on access. Do not introduce the compatibility plugin during a native migration merely to avoid updating callers. The live cookbook's claim that mutation extensions are never exposed directly is stale relative to core 1.4.8's declared extension return contract; use the exact installed plugin/core types and mutation-cache entries for operation-wide observation, not that historical workaround as an upstream guarantee. [Compatibility guide](https://pinia-colada.esm.dev/cookbook/tanstack-compat.md), [exact plugin metadata](https://registry.npmjs.org/@pinia/colada-plugin-tanstack-compat/0.1.0), [core declarations](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts)

### Diagnostic codes and investigation order

Read the first diagnostic rather than adding a second Pinia/cache or suppressing the warning. The pinned runtime reports the following contracts; keep a fresh app/Pinia/cache for each isolated test and install the real plugin before mounting consumers. These are proposed debugging steps, not executed checks.

| Code | Investigate and repair |
| --- | --- |
| `PINIA_COLADA_C0001` | Install Pinia before Colada or pass the intended instance explicitly. |
| `PINIA_COLADA_R0001` | Restore an app injection context for cache access; on the server also pass the request-local Pinia. |
| `PINIA_COLADA_R0002` | Stop replacing the cache itself; use cache actions to change its contents. |
| `PINIA_COLADA_R0003` | Supply a nonempty stable key containing request identity. |
| `PINIA_COLADA_R0004` | A raw entry lacks fetch options: use `ensure(realOptions)` before fetching, especially after hydration; reduce/report unexpected library paths instead of fabricating options. |
| `PINIA_COLADA_R0005` / `R0006` | Low-level mutation entry was not ensured or was reused; ensure fresh submitted variables/entry before each mutation. |
| `PINIA_COLADA_R0007` | Call shared mutation setup in a component/store/owned effect scope so effects can dispose. |
| `PINIA_COLADA_R0008` | Supply a real `getPreviousPageParam` before requesting previous pages. |
| `PINIA_COLADA_R0009` | Infinite entry is absent; keep its consumer active and do not load after removal/unmount. |
| `PINIA_COLADA_R0010` | Do not remove an active entry; stop all consumers first, or invalidate it to refresh while active. |

For stale UI, inspect the concrete key, grouped state, `asyncStatus`, enabled scheduling, placeholder identity and pending cancellation before changing retry/freshness. Devtools are optional diagnostics, not runtime ownership. [Pinned diagnostic implementation](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs), [official errors](https://pinia-colada.esm.dev/errors/)


## Verification boundary and checks to add

Registry metadata, pinned declarations/runtime and official docs ground this reference; the examples are authored and **not executed here**. The SFC is explicitly in memory; service-backed examples need a real implementation; server/client helpers need a host payload channel and matching application state. Application checks should cover plugin order, reactive route/filter updates, absent inputs, non-2xx errors, abort consumption, grouped-state narrowing, tenant-switch placeholders, mutation completion after navigation, rollback races, disabled-query invalidation, page retention, per-request SSR isolation, serializer revival and logout cache clearing. See [testing](testing.md) and [SSR debugging](debugging-ssr.md).

## Sources

- [Colada 1.4.8 metadata](https://registry.npmjs.org/@pinia/colada/1.4.8); [exact types](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts); [exact runtime](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs); [Pinia 4.1.0 metadata](https://registry.npmjs.org/pinia/4.1.0).
- [Queries](https://pinia-colada.esm.dev/guide/queries.md); [reusable queries](https://pinia-colada.esm.dev/advanced/reusable-queries.md); [keys](https://pinia-colada.esm.dev/guide/query-keys.md); [query cache](https://pinia-colada.esm.dev/advanced/query-cache.md).
- [Mutations](https://pinia-colada.esm.dev/guide/mutations.md); [optimistic updates](https://pinia-colada.esm.dev/guide/optimistic-updates.md); [invalidation](https://pinia-colada.esm.dev/guide/query-invalidation.md); [pagination](https://pinia-colada.esm.dev/guide/paginated-queries.md); [infinite queries](https://pinia-colada.esm.dev/guide/infinite-queries.md).
- [SSR](https://pinia-colada.esm.dev/guide/ssr.md); [Nuxt](https://pinia-colada.esm.dev/nuxt.md); [Nuxt module 1.2.0 metadata](https://registry.npmjs.org/@pinia/colada-nuxt/1.2.0); [devalue 6.0.3 metadata](https://registry.npmjs.org/devalue/6.0.3).
- [Retry 1.0.3](https://registry.npmjs.org/@pinia/colada-plugin-retry/1.0.3); [delay 0.2.1](https://registry.npmjs.org/@pinia/colada-plugin-delay/0.2.1); [auto-refetch 0.2.7](https://registry.npmjs.org/@pinia/colada-plugin-auto-refetch/0.2.7); [cache persister 1.1.3](https://registry.npmjs.org/@pinia/colada-plugin-cache-persister/1.1.3); [devtools 2.0.1](https://registry.npmjs.org/@pinia/colada-devtools/2.0.1).
- [Plugin authoring](https://pinia-colada.esm.dev/plugins/writing-plugins.md); [compatibility plugin 0.1.0 metadata](https://registry.npmjs.org/@pinia/colada-plugin-tanstack-compat/0.1.0); [exact 1.x migration rule](https://unpkg.com/@pinia/colada@1.4.8/codemods/rules/migration-0-21-to-1-0.yaml); [exact options-grouping rule](https://unpkg.com/@pinia/colada@1.4.8/codemods/rules/migration-0-13-to-0-14.yaml).
