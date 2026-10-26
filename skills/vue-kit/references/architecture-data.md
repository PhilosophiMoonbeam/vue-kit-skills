# Data architecture: identity, lifetime, and concurrent work

## When to read and version boundary

Read when route state, remote data, a form, and access scope touch the same workflow; neither Pinia nor a dedicated query cache is required. This is **authored synthesis** of coordination boundaries, not a substitute for one library's API reference. Baseline **Vue 3.5.44**; query-specific factual contracts below refer to **@tanstack/vue-query 5.104.5**, with **Pinia 4.1.0** for application-state context. Preserve the resource's existing read owner. In Nuxt that can be native data; when a dedicated cache is selected, use [Query](tanstack-query.md) or [Colada](pinia-colada.md), never two owners for the same resource. Their adapters, hydration APIs, and defaults are not interchangeable. [Package versions](https://registry.npmjs.org/@tanstack/vue-query/5.104.5).

Start with [application architecture](architecture.md) if deployment and ownership are undecided. In Nuxt, [Nuxt core](nuxt.md#data-payload-and-cancellation) owns request context, native data and payloads; [Nuxt integrations](nuxt-integrations.md) owns selected store/query setup and a provider-neutral private-cache contract. Otherwise continue to [forms](forms.md), [state](state.md), [auth](auth.md), or [routing](routing.md) only for the mechanism being implemented.

## Separate five state domains

| Domain | Canonical state | Lifetime and write boundary | Common category error |
| --- | --- | --- | --- |
| Route | Normalized resource ID, shareable filter/sort/page | Current history entry; router coordinator writes | Watchers maintaining a second mutable Pinia copy |
| Query cache | Parsed server snapshots, fetch/error/freshness state | Cache/access scope; query/mutation adapter reconciles | Editing cached objects through form `v-model` |
| Pinia | Genuinely shared client workflow, selected workspace intent, preferences | App or explicit feature scope; actions maintain invariants | Treating every response as permanent application state |
| Local draft/form | Editable values, baseline revision, touched/errors, pending validation | One edit session; form operations write | Refetch resetting dirty fields or cancel modifying server state |
| Auth | Loading/signed-out/ready/error state and current credential access | Application's real session boundary | Persisting a token or copying mutable session resources into every store |

**Synthesis:** keep one canonical owner per fact. Derive display state instead of synchronizing copies. A local search textbox may hold uncommitted input while the URL owns the committed query; they are different facts, not mirrors. Do not put private search text, credentials, or unsaved case content into a URL. Parse route arrays/nulls/unknown enum values before they become cache keys or request parameters.

The application's real session mechanism owns identity readiness. The application may own tenant-selection intent, but a selected tenant ID is not proof of membership. A route guard avoids an inappropriate screen; only server enforcement authorizes the operation. [OWASP requires checks on every request, in a trusted server-side location](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request).

## Make cache identity match response identity

TanStack Query requires serializable array keys unique to the returned data and instructs including changing variables used by the query function. That is an [upstream contract](https://tanstack.com/query/latest/docs/framework/vue/guides/query-keys). Choosing the application's access-scope fields is synthesis.

For a private support inbox, use a scope containing tenant plus principal identity (or another stable permission-sensitive cache partition), then resource family and normalized arguments. Include locale when the server actually localizes the response; do not fragment data keys for purely client-side formatting. Include a permission/session generation only when its lifetime is deliberately defined. Never put raw bearer tokens in keys.

**Complete pure TypeScript example:** these functions construct keys only. They do not fetch data, validate membership, or implement a service. The caller supplies already-normalized inputs.

```ts
export interface AccessScope {
  readonly principalId: string
  readonly tenantId: string
  readonly generation: number
}

export interface InboxView {
  readonly status: 'open' | 'closed' | 'all'
  readonly sort: 'updated-desc' | 'updated-asc'
  readonly page: number
}

export const caseKeys = {
  scope: (scope: AccessScope) => [
    'private', scope.principalId, scope.tenantId, scope.generation,
  ] as const,
  lists: (scope: AccessScope) => [...caseKeys.scope(scope), 'cases', 'list'] as const,
  list: (scope: AccessScope, view: InboxView) => [
    ...caseKeys.lists(scope), view.status, view.sort, view.page,
  ] as const,
  detail: (scope: AccessScope, id: string) => [
    ...caseKeys.scope(scope), 'cases', 'detail', id,
  ] as const,
  summary: (scope: AccessScope) => [...caseKeys.scope(scope), 'case-summary'] as const,
}
```

`generation` is an application-owned monotonically changing access epoch in this design, not a query-library feature. The same epoch must be used consistently by key producers and completion guards. A different tenant key prevents key collision; it does **not** erase old sensitive memory, persisted state, previous-data placeholders, late UI callbacks, SSR output, or an already-open editor.

### Tenant switch, logout, and permission-loss protocol

**Synthesis:** implement scope transition as a coordinated operation, not scattered watchers.

For an elective switch, settle save/discard/stay before retiring the old scope. **Stay** leaves that scope and draft intact; **save** must finish under the old scope before the switch proceeds; **discard** authorizes retirement. The steps below apply to an accepted switch or involuntary access loss. Do not invalidate an in-flight save's UI ownership merely to ask whether switching should occur.

1. Enter a blocked/transitioning access state, immediately hide old private content, and invalidate the old UI operation epoch. Stop accepting edits/commands in that scope.
2. Apply the accepted dirty-draft disposition. Involuntary session loss cannot be canceled by a dirty-form guard; close the private surface and follow an explicit privacy policy for unsaved data.
3. Dispose old feature subscriptions and cancel private reads where supported. Remove old private query entries, retained mutation variables/results, and persisted private partitions; reset shared client workflows, selections, draft instances, and extra controller refs retained by shared query setups. Use the selected cache's actual APIs: removing queries does not remove mutations, and removing mutation entries does not cancel their server writes or free pending promise closures. Do not remove only the visible detail key while list, summary, or export data remain. [Query retirement](tanstack-query.md#mutations-and-optimistic-concurrency), [Colada retirement](pinia-colada.md#mutations-invalidation-and-rollback).
4. Establish the new session/tenant context through the real auth integration. Do not retag an old session's response as the new tenant's data. Await the integration's actual readiness contract.
5. Create or activate the new scope, then enable its queries. Do not use previous-tenant data as placeholder content for the new scope.
6. Guard every delayed UI effect against the captured scope/operation identity: notifications, form reset, navigation, selected-row updates, and focus restoration. A completed old mutation may require later reconciliation, but must not repopulate a retired private partition or move the new tenant's UI.

Keep public caches separate if public data should survive logout. A global cache clear is a valid simpler policy when all cached data is private; targeted removal requires an inventory of every private family and persistence layer. Resetting a Pinia store is not the same as clearing the query cache, ending the server session, erasing local storage/service-worker data, or disposing a kept-alive draft.

### SSR isolation is a separate boundary

- Create private app/store/query-client instances per server request. Module-level mutable credentials, caches, or active-tenant refs can leak across requests even when individual keys look correct.
- The authenticated server request context supplies credentials to that request's adapters. Do not forward a shared mutable browser credential getter into server rendering.
- Dehydrate/serialize only authorized, necessary state using the framework's safe serialization path; the browser can read everything in its payload. Escape serialization for its HTML context, and hydrate at the library's required point.
- Response/CDN caching has its own audience and key policy. An isolated query cache does not make personalized HTML or payloads safe to share-cache.
- In Nuxt, follow [framework request/data ownership](nuxt.md#request-context-and-state) and the [selected module integration](nuxt-integrations.md); do not install the standalone SPA helpers or create a second cache for a resource already owned by `useFetch`/`useAsyncData`.

These follow the [Vue SSR isolation contract](https://vuejs.org/guide/scaling-up/ssr.html#cross-request-state-pollution) and [Pinia SSR instance/hydration guidance](https://pinia.vuejs.org/ssr/). Per-request factories and correct instance propagation, not the package name, establish isolation.

## Navigation, cancellation, and concurrency are different protocols

| Concurrent activity | Owner and policy (synthesis) | What cancellation does not prove |
| --- | --- | --- |
| Search/filter changes | Route/query owner derives a new key; consume query signal when cancellation is desired | A route change alone does not abort every request |
| Local async read without a cache | Owning watcher cleans up and guards publication by current request identity | A transport may ignore abort; stale completion must still be ignored |
| Leaving a dirty editor | Route/overlay coordinator requests save, discard, or stay | A UI leave guard is not a transactional server lock |
| Save pending while user leaves | Explicit policy: block elective leave, or transfer operation ownership to a longer-lived coordinator | Component unmount does not undo a committed server command |
| Two saves of one draft | Form submission lock plus server conditional-write contract | Disabling a button cannot prevent another tab/client from editing |
| Unknown write outcome | Preserve command identity/draft and reconcile through the real server contract | Retrying a non-idempotent mutation may duplicate effects |
| Optimistic updates | Resource-specific mutation coordinator owns snapshot/rollback and overlapping-write policy | A captured old snapshot cannot safely roll back unrelated later writes |

TanStack Query supplies an `AbortSignal`, but unmount does not universally cancel its reads. In **5.104.5**, removing the last observer cancels with state reversion when the signal was consumed **or** an initial query is paused (`fetchStatus: 'paused'`, `status: 'pending'`); otherwise it stops retries but lets the current fetch continue. See the [release-matched observer-removal implementation](https://unpkg.com/@tanstack/query-core@5.104.5/src/query.ts) and [cancellation guide](https://tanstack.com/query/latest/docs/framework/vue/guides/query-cancellation). Forward the signal to the real transport when transport abortion is required. Do not generalize read cancellation into mutation rollback. Vue watcher cleanup has its own lifecycle; `onWatcherCleanup` must be registered synchronously in Vue 3.5. See [composables](composables.md).

For an editor, a pessimistic save is usually the smallest honest design: hold the draft until the server confirms, then reconcile. Add optimistic behavior only when latency and reversibility justify its conflict/rollback policy. Do not invent idempotency keys, revision support, autosave ordering, or mutation-cancellation guarantees absent from the actual backend contract.

## Save sequencing: confirmed write versus reconciled view

**Worked design, synthesis:** an operator edits a case title. The baseline is revision `r7`; a background refetch returns `r8`. Keep the operator's dirty title and baseline `r7`; show that newer data exists. With a real atomic revision-precondition contract, a save against `r7` cannot overwrite a mismatching revision: the server follows its conflict policy. Silently replacing the baseline with `r8` would defeat that conflict detection. HTTP [`If-Match`](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1) is one standard lost-update mechanism, not a claim that this application's backend implements it or that every failed save is a conflict.

| Transition | Required behavior |
| --- | --- |
| `editing → validating` | Lock the submission path, including Enter/programmatic submit; validate current draft; preserve input on rejection |
| `validating → saving` | Capture draft, resource ID, scope, baseline revision and operation ownership once |
| `saving → invalid/forbidden/conflict` | Preserve draft; map field errors to the current form; forbidden enters the access policy; conflict offers inspect/reload/merge, never silent overwrite |
| `saving → outcome-unknown` | Explain that confirmation was lost; do not announce failure as proof of no write or retry blindly |
| `saving → committed` | Server has confirmed the write; accept its canonical snapshot and new revision |
| `committed → reconciling` | Reconcile detail and affected list/summary families; choose whether the UI waits before closing |
| `reconciling → fresh/stale` | Refresh failure does not turn a successful save into a failed mutation; offer refresh, not duplicate submission |
| `fresh/stale → next view` | Reset baseline from accepted result; navigate/close/announce only if the operation still owns the active view |

Returning/awaiting invalidation in mutation success callbacks can extend pending state; detached invalidation does not do the same. This is the [Query mutation sequencing contract](https://tanstack.com/query/latest/docs/framework/vue/guides/invalidations-from-mutations), not a guarantee that refetch succeeded or that all inactive queries were fetched. If accepting a canonical detail result cancels an older detail read, do so through the chosen library's actual cancellation API before it can overwrite the accepted value. Define list membership changes: after closing a case it may disappear from an `open` list; the focus fallback and count reconciliation must reflect that.

**Adapter postcondition:** in Query **5.104.5**, `invalidateQueries` defaults to active-query refetching; `refetchQueries` catches individual fetch errors unless `throwOnError: true`, excludes disabled/static queries, and resolves paused fetches without waiting for their eventual result. These are [release-matched implementation facts](https://unpkg.com/@tanstack/query-core@5.104.5/src/queryClient.ts), not synthesis. Thus `acceptAndRefresh` must define which visible queries require successful refresh, propagate errors for those reads, and inspect their completion state. A resolved invalidation promise alone cannot justify the example's `view: 'refreshed'`; inactive/paused data may remain stale.

### Typed save coordinator without fabricated transport

The complete TypeScript function below demonstrates **application-owned orchestration** with injected real capabilities. It is not a runnable backend example, query adapter, form validator, or authorization implementation. Before returning `saved` or `conflict`, the adapter must validate each server snapshot's scope/resource identity and canonical data; a conflict's `latest` is not exempt. `acceptAndRefresh` must reconcile the captured scope only, cancel conflicting reads if needed, and reject when the chosen refresh policy fails. The caller uses a separate validation lock before invoking this function.

```ts
export interface SaveInput {
  readonly scope: {
    readonly tenantId: string
    readonly principalId: string
    readonly generation: number
  }
  readonly id: string
  readonly title: string
  readonly expectedRevision: string
}

export interface SavedCase {
  readonly id: string
  readonly tenantId: string
  readonly title: string
  readonly revision: string
}

type ServerResult =
  | { kind: 'saved'; value: SavedCase }
  | { kind: 'invalid'; titleError: string }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; latest: SavedCase }

export type SaveOutcome =
  | { kind: 'busy' }
  | { kind: 'inactive' }
  | Exclude<ServerResult, { kind: 'saved' }>
  | { kind: 'outcome-unknown'; cause: unknown }
  | { kind: 'committed'; value: SavedCase; view: 'refreshed' }
  | { kind: 'committed'; value: SavedCase; view: 'stale'; cause: unknown }

export interface SavePorts {
  isCurrent(input: SaveInput): boolean
  save(input: SaveInput): Promise<ServerResult>
  acceptAndRefresh(input: SaveInput, value: SavedCase): Promise<void>
}

export function createSaveCoordinator(ports: SavePorts) {
  let pending = false

  return async function submit(input: SaveInput): Promise<SaveOutcome> {
    if (pending) return { kind: 'busy' }
    if (!ports.isCurrent(input)) return { kind: 'inactive' }
    pending = true
    try {
      let result: ServerResult
      try {
        result = await ports.save(input)
      } catch (cause) {
        return ports.isCurrent(input)
          ? { kind: 'outcome-unknown', cause }
          : { kind: 'inactive' }
      }
      if (!ports.isCurrent(input)) return { kind: 'inactive' }
      if (result.kind !== 'saved') return result

      try {
        await ports.acceptAndRefresh(input, result.value)
      } catch (cause) {
        return ports.isCurrent(input)
          ? { kind: 'committed', value: result.value, view: 'stale', cause }
          : { kind: 'inactive' }
      }
      return ports.isCurrent(input)
        ? { kind: 'committed', value: result.value, view: 'refreshed' }
        : { kind: 'inactive' }
    } finally {
      pending = false
    }
  }
}
```

Create one coordinator for the intended editor/operation lifetime, not on each click. `isCurrent` must include edit-session/resource identity, not only tenant equality: leaving and returning to the same case creates a different interaction. `inactive` means the caller no longer owns UI effects, **not** that the server did nothing. If writes must be tracked after leaving, move that ownership to a longer-lived operation coordinator with an explicit reconciliation policy. During `acceptAndRefresh`, adapters must recheck access before publishing after any awaited work; a pre-call check alone cannot prevent a logout race.

Do not let the form's generic catch handler turn `committed/stale` into “Save failed.” Reset the draft baseline only for a confirmed accepted write in the current edit session. Conflict inspection must preserve both the user's input and the latest server snapshot; merge policy is domain-specific.

## End-to-end responsibility handoff

1. **Route coordinator:** normalize the selected case and list arguments; acquire the current access scope; decide leave behavior.
2. **Read adapter:** load authorized detail/list through the resource's one owner—Nuxt native data, the selected cache, or a local read lifecycle—and expose remote status separately from local form status. Apply the scoped identity and completion policy through that owner's actual API.
3. **Editor:** capture editable values and revision; own validation, dirty state, duplicate lock, and field-error focus. A background cache update is not a draft reset instruction.
4. **Command adapter:** obtain current credentials, send the real service's command/precondition, validate its response; the server verifies principal, tenant, action, object ownership and allowed fields atomically with the write as required by the domain.
5. **Mutation coordinator:** translate confirmed write outcomes into cache reconciliation, keeping write failure distinct from read refresh failure.
6. **Route/overlay owner:** close or navigate only for the current edit session, preserve list view identity, and restore focus to a surviving logical target. See [UI architecture](architecture-ui.md).
7. **Access coordinator:** retire old private ownership on tenant/session change; reset every affected domain rather than merely hiding the page.

## Minimum reading and acceptance evidence

| Implementation question | Read next, in order |
| --- | --- |
| Which read owner and key? | For Nuxt-native data, [Nuxt data ownership](nuxt.md#data-payload-and-cancellation); for the selected dedicated cache, [Query](tanstack-query.md) or [Colada](pinia-colada.md); for an uncached local read, [composables](composables.md). Add a cache only for a requirement the incumbent owner cannot meet; [state](state.md) only for shared client state |
| How to bind and submit the draft? | [forms](forms.md), then the selected [VeeValidate](vee-validate.md), [TanStack Form](tanstack-form.md), [FormKit](formkit.md), or [Vuetify component](vuetify-components.md) branch |
| How to protect UX and server operations? | [auth](auth.md), then host-owned routing: [Nuxt](nuxt.md) or standalone [routing](routing.md); backend authorization review remains separate |
| Why does old work overwrite new data? | [composables](composables.md), then the selected cache's cancellation/mutation section |
| Why is SSR leaking or refetching? | [Nuxt request ownership](nuxt.md#request-context-and-state) for a Nuxt host; [debugging and SSR](debugging-ssr.md) for diagnosis; selected cache/store SSR section only when installed |
| What proves the protocol? | [testing](testing.md) |

**Proposed checks, not observed results:** reverse read completion order; tenant switch during read/save/refetch; logout with a kept-alive dirty editor; two edits with the same revision; save confirmed then refresh rejected; missing/expired credentials and forged tenant/resource IDs; browser Back during validation/save; reload after an unknown write outcome; two concurrent SSR requests. Assert user-visible state, actual server authorization, private-cache removal, and absence of stale navigation/announcements. A frontend unit test cannot prove backend isolation or atomic conditional writes.

## Sources

- [Vue 3.5.44 metadata](https://registry.npmjs.org/vue/3.5.44), [Pinia 4.1.0 metadata](https://registry.npmjs.org/pinia/4.1.0), [@tanstack/vue-query 5.104.5 metadata](https://registry.npmjs.org/@tanstack/vue-query/5.104.5).
- [Query keys and dependencies](https://tanstack.com/query/latest/docs/framework/vue/guides/query-keys), [cancellation behavior](https://tanstack.com/query/latest/docs/framework/vue/guides/query-cancellation), [mutation invalidation sequencing](https://tanstack.com/query/latest/docs/framework/vue/guides/invalidations-from-mutations).
- [Query core 5.104.5 invalidation/refetch implementation](https://unpkg.com/@tanstack/query-core@5.104.5/src/queryClient.ts).
- [Query core 5.104.5 last-observer cancellation and signal consumption](https://unpkg.com/@tanstack/query-core@5.104.5/src/query.ts).
- [Vue watcher side-effect cleanup](https://vuejs.org/guide/essentials/watchers.html#side-effect-cleanup), [Vue SSR isolation](https://vuejs.org/guide/scaling-up/ssr.html#cross-request-state-pollution), [Pinia SSR and hydration](https://pinia.vuejs.org/ssr/).
- [OWASP authorization, server-side enforcement and every-request checks](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- [HTTP conditional writes and lost-update prevention (`If-Match`)](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1), [non-idempotent automatic retry boundary](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2).
