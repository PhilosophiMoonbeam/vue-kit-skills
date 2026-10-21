# Data architecture: identity, lifetime, and concurrent work

## When to read and version boundary

Read when a route, remote cache, Pinia store, form, and auth integration touch the same workflow. This is **authored synthesis** of coordination boundaries, not a substitute for one library's API reference. Baseline **Vue 3.5.44**; query-specific factual contracts below refer to **@tanstack/vue-query 5.104.5**, with **Pinia 4.1.0** for application-state context. Use [Query](tanstack-query.md) or [Colada](pinia-colada.md), not both caches for the same resource. Their adapters, hydration APIs, and defaults are not interchangeable. [Package versions](https://registry.npmjs.org/@tanstack/vue-query/5.104.5).

Start with [application architecture](architecture.md) if deployment and ownership are undecided. Continue to [forms](forms.md), [state](state.md), [auth](auth.md), and [routing](routing.md) only for the mechanism being implemented.

## Separate five state domains

| Domain | Canonical state | Lifetime and write boundary | Common category error |
| --- | --- | --- | --- |
| Route | Normalized resource ID, shareable filter/sort/page | Current history entry; router coordinator writes | Watchers maintaining a second mutable Pinia copy |
| Query cache | Parsed server snapshots, fetch/error/freshness state | Cache/access scope; query/mutation adapter reconciles | Editing cached objects through form `v-model` |
| Pinia | Genuinely shared client workflow, selected workspace intent, preferences | App or explicit feature scope; actions maintain invariants | Treating every response as permanent application state |
| Local draft/form | Editable values, baseline revision, touched/errors, pending validation | One edit session; form operations write | Refetch resetting dirty fields or cancel modifying server state |
| Auth | Loading/signed-out/signed-in state and current credential access | SDK/session scope | Persisting a token or copying a mutable SDK user into every store |

**Synthesis:** keep one canonical owner per fact. Derive display state instead of synchronizing copies. A local search textbox may hold uncommitted input while the URL owns the committed query; they are different facts, not mirrors. Do not put private search text, credentials, or unsaved case content into a URL. Parse route arrays/nulls/unknown enum values before they become cache keys or request parameters.

The auth SDK owns identity readiness. The application may own tenant-selection intent, but a selected tenant ID is not proof of membership. A route guard avoids an inappropriate screen; only server enforcement authorizes the operation. [OWASP requires checks on every request, in a trusted server-side location](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request).

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

1. Enter a blocked/transitioning access state, immediately hide old private content, and invalidate the old UI operation epoch. Stop accepting edits/commands in that scope.
2. Resolve dirty draft policy before an elective switch. Involuntary session loss cannot be canceled by a dirty-form guard; close the private surface and follow an explicit privacy policy for unsaved data.
3. Dispose old feature subscriptions and cancel private reads where supported. Remove old private cache entries and persisted private partitions; reset shared client workflows, selections, and draft instances. Do not remove only the visible detail key while list, summary, or export data remain.
4. Establish the new session/tenant context through the real auth integration. Do not retag an old session's response as the new tenant's data. Await the integration's actual readiness contract.
5. Create or activate the new scope, then enable its queries. Do not use previous-tenant data as placeholder content for the new scope.
6. Guard every delayed UI effect against the captured scope/operation identity: notifications, form reset, navigation, selected-row updates, and focus restoration. A completed old mutation may require later reconciliation, but must not repopulate a retired private partition or move the new tenant's UI.

Keep public caches separate if public data should survive logout. A global cache clear is a valid simpler policy when all cached data is private; targeted removal requires an inventory of every private family and persistence layer. Resetting a Pinia store is not the same as clearing the query cache, auth SDK state, local storage, service-worker data, or a kept-alive draft.

### SSR isolation is a separate boundary

- Create private app/store/query-client instances per server request. Module-level mutable credentials, caches, or active-tenant refs can leak across requests even when individual keys look correct.
- The authenticated server request context supplies credentials to that request's adapters. Do not forward a shared mutable browser credential getter into server rendering.
- Dehydrate/serialize only authorized, necessary state using the framework's safe serialization path; the browser can read everything in its payload. Escape serialization for its HTML context, and hydrate at the library's required point.
- Response/CDN caching has its own audience and key policy. An isolated query cache does not make personalized HTML or payloads safe to share-cache.
- In Nuxt, follow the framework/module's request context and hydration integration; do not add a second SPA query client or bypass Nuxt's data ownership accidentally.

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

TanStack Query supplies an `AbortSignal`, but unused/unmounted queries are not canceled by default merely because the component disappeared; consuming the signal changes cancellation behavior. See [query cancellation](https://tanstack.com/query/latest/docs/framework/vue/guides/query-cancellation). Do not generalize read cancellation into mutation rollback. Vue watcher cleanup has its own lifecycle; `onWatcherCleanup` must be registered synchronously in Vue 3.5. See [composables](composables.md).

For an editor, a pessimistic save is usually the smallest honest design: hold the draft until the server confirms, then reconcile. Add optimistic behavior only when latency and reversibility justify its conflict/rollback policy. Do not invent idempotency keys, revision support, autosave ordering, or mutation-cancellation guarantees absent from the actual backend contract.

## Save sequencing: confirmed write versus reconciled view

**Worked design, synthesis:** an operator edits a case title. The baseline is revision `r7`; a background refetch returns `r8`. Keep the operator's dirty title and baseline `r7`; show that newer data exists. A conditional save against `r7` either succeeds atomically or returns conflict. Silently replacing the baseline with `r8` would defeat conflict detection.

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

### Typed save coordinator without fabricated transport

The complete TypeScript function below demonstrates **application-owned orchestration** with injected real capabilities. It is not a runnable backend example, query adapter, form validator, or authorization implementation. The adapter must validate response scope/resource identity and canonical data before returning `saved`; `acceptAndRefresh` must reconcile the captured scope only, cancel conflicting reads if needed, and reject when the chosen refresh policy fails. The caller uses a separate validation lock before invoking this function.

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
2. **Query adapter:** load authorized detail/list under scoped keys and expose remote status separately from local form status.
3. **Editor:** capture editable values and revision; own validation, dirty state, duplicate lock, and field-error focus. A background cache update is not a draft reset instruction.
4. **Command adapter:** obtain current credentials, send the real service's command/precondition, validate its response; the server verifies principal, tenant, action, object ownership and allowed fields atomically with the write as required by the domain.
5. **Mutation coordinator:** translate confirmed write outcomes into cache reconciliation, keeping write failure distinct from read refresh failure.
6. **Route/overlay owner:** close or navigate only for the current edit session, preserve list view identity, and restore focus to a surviving logical target. See [UI architecture](architecture-ui.md).
7. **Access coordinator:** retire old private ownership on tenant/session change; reset every affected domain rather than merely hiding the page.

## Minimum reading and acceptance evidence

| Implementation question | Read next, in order |
| --- | --- |
| Which cache and how to key it? | One of [Query](tanstack-query.md) / [Colada](pinia-colada.md); [state](state.md) only if shared client state also exists |
| How to bind and submit the draft? | [forms](forms.md), then the selected [VeeValidate](vee-validate.md), [TanStack Form](tanstack-form.md), [FormKit](formkit.md), or [Vuetify component](vuetify-components.md) branch |
| How to protect UX and server operations? | [auth](auth.md), [routing](routing.md); backend authorization review remains separate |
| Why does old work overwrite new data? | [composables](composables.md), then the selected cache's cancellation/mutation section |
| Why is SSR leaking or refetching? | [debugging and SSR](debugging-ssr.md), then selected cache/store SSR section |
| What proves the protocol? | [testing](testing.md) |

**Proposed checks, not observed results:** reverse read completion order; tenant switch during read/save/refetch; logout with a kept-alive dirty editor; two edits with the same revision; save confirmed then refresh rejected; missing/expired credentials and forged tenant/resource IDs; browser Back during validation/save; reload after an unknown write outcome; two concurrent SSR requests. Assert user-visible state, actual server authorization, private-cache removal, and absence of stale navigation/announcements. A frontend unit test cannot prove backend isolation or atomic conditional writes.

## Sources

- [Vue 3.5.44 metadata](https://registry.npmjs.org/vue/3.5.44), [Pinia 4.1.0 metadata](https://registry.npmjs.org/pinia/4.1.0), [@tanstack/vue-query 5.104.5 metadata](https://registry.npmjs.org/@tanstack/vue-query/5.104.5).
- [Query keys and dependencies](https://tanstack.com/query/latest/docs/framework/vue/guides/query-keys), [cancellation behavior](https://tanstack.com/query/latest/docs/framework/vue/guides/query-cancellation), [mutation invalidation sequencing](https://tanstack.com/query/latest/docs/framework/vue/guides/invalidations-from-mutations).
- [Vue watcher side-effect cleanup](https://vuejs.org/guide/essentials/watchers.html#side-effect-cleanup), [Vue SSR isolation](https://vuejs.org/guide/scaling-up/ssr.html#cross-request-state-pollution), [Pinia SSR and hydration](https://pinia.vuejs.org/ssr/).
- [OWASP authorization, server-side enforcement and every-request checks](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
