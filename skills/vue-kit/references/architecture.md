# Application architecture: choose boundaries before libraries

## When to read and version boundary

Read before a cross-feature change, a new application, or a deployment-mode decision. For a narrow fix, inspect the incumbent implementation and preserve its stack unless the fix requires a change. This reference is **authored synthesis**, not a framework architecture guarantee. It assigns ownership and reading routes; specialist references own API implementation.

Baseline: **Vue 3.5.44**, Composition API, `<script setup lang="ts">`, and **Vuetify 4.3.0**. Vuetify's declared Vue peer range includes `^3.5.0`; that is compatibility metadata, not proof that every integration works. For a standalone SPA, use the Router 4 track in [routing](routing.md) and the pinned build stack in [setup and tooling](setup-tooling.md). For new or existing Nuxt applications, [Nuxt 4.6.2](nuxt.md) owns bootstrap, routing, data and rendering; [Nuxt integrations](nuxt-integrations.md) owns selected library/module setup. Do not compose the SPA installation helpers into that host. Neither package peers nor this design guide certify an arbitrary Vue/Vuetify/Nuxt module matrix. [Package evidence](https://registry.npmjs.org/vuetify/4.3.0).

## Produce a compact design deliverable

Before implementation, write these decisions in the task or existing design record. Do not generate a speculative architecture document for every component.

1. **Outcome and scope:** actor, entry point, successful action, non-goals, existing behavior that must survive.
2. **Vertical slice:** URL → access readiness → data source → interaction → command → reconciliation → next view. Mark application-owned backend contracts that are not implemented by the frontend.
3. **Owners:** canonical state, instance creator, consumers, reset/disposal point, and trust boundary. Include hidden lifetimes: cached route, browser tab, request, persisted session.
4. **Decisions:** requirement → mechanism → rejected alternative → consequence → specialist route. Choose only mechanisms demanded by the slice.
5. **Failure behavior:** cold load, refresh failure with old data, validation rejection, permission loss, conflicting edit, navigation interruption, duplicate action, unknown mutation outcome.
6. **Evidence:** repository facts and upstream contracts separately from proposed behavior; acceptance scenarios, deployment prerequisites, and checks still to run.

A useful design fits around one flow. A package list, file tree, or universal `useApplication()` controller does not establish responsibility.

### Worked decision record: a tenant-scoped support inbox

**Illustrative requirements, not an implemented service:** an authorized operator opens a bookmarkable filtered inbox, reads a case, edits its title, saves, and returns to the same list. A summary chart can filter the list. Another operator may edit concurrently. Public help articles need indexable initial HTML; the private inbox does not.

| Requirement | Mechanism (synthesis) | Rejected alternative | Consequence | Specialist reading |
| --- | --- | --- | --- | --- |
| Back/bookmark restores inbox view | Normalize status, sort, page, case ID from URL | A Pinia-only filter mirrored by watchers | One canonical view identity; reject malformed values and reset page when filters change | [routing](routing.md) |
| One reusable remote snapshot | One query-cache family per resource and access scope | Copying every response into Pinia | Detail/list freshness requires explicit reconciliation; draft remains separate | [data architecture](architecture-data.md), then one [Query](tanstack-query.md) or [Colada](pinia-colada.md) implementation |
| Safe cancel and concurrent edits | Editor-owned draft plus server revision precondition | Two-way binding into cached server data | Cancel is local; conflicts preserve input and require resolution | [forms](forms.md) |
| Tenant change must not flash old content | Access-scope transition closes old interactions and resets private state | Replacing tenant ID while old promises still publish | An old result must not operate on the new view | [auth](auth.md), [data architecture](architecture-data.md) |
| Keyboard-operable editing | One Vuetify overlay owner; form emits semantic save/close results | Nesting competing focus traps from two libraries | Defined initial focus, close policy, and return-focus target | [UI architecture](architecture-ui.md), [accessibility](accessibility.md) |
| Chart selection and list agree | Chart emits domain filter intent; route coordinator updates canonical URL | Chart-local filtered data and a second list filter | One meaning for clear selection, Back, and shareable links | [visualization](visualization.md) |
| Private interaction, public discovery | SPA inbox; separately prerendered help, or a justified Nuxt hybrid deployment | SSR everywhere solely because it is available | Choose deployment based on initial-content and operational requirements | [debugging and SSR](debugging-ssr.md), [VitePress](docs-vitepress.md) |

The inbox route composes access readiness, resource queries, list presentation, and an editor boundary. It does not own editor input events, focus-trap internals, chart drawing, or HTTP authorization policy.

## Responsibility, state lifetime, deployment, and trust matrix

**Synthesis:** choose an owner by the invariant and lifetime it maintains, not by whether two files read the value.

| State or capability | Canonical owner and lifetime | SSR/deployment rule | Trust and reset rule |
| --- | --- | --- | --- |
| Shareable filter, sort, selected resource | Router; current history entry | Parse the same normalized values on server and client | URL is untrusted input; no credentials, private draft text, or sensitive search terms |
| Server resource snapshot | Selected query client; app/access scope | New private cache per SSR request; hydrate only authorized public-to-that-user data | Cache is not authorization; partition by identity/tenant; remove on access loss |
| Shared client workflow or preference | Pinia when genuinely cross-feature; application or explicit feature instance | New Pinia instance per SSR request; restore safely before hydration | Persist only with an explicit privacy/version/reset policy |
| Draft, touched/errors, baseline revision | Form/editor instance | Do not serialize private unsaved input by default | Never mutate server cache through form binding; reset on accepted save or explicit discard |
| Open menu, focus, drag, resize | Owning UI instance; mounted interaction | Browser effects start in client lifecycle; dispose listeners/observers | Close on scope loss; retain a logical focus destination |
| Identity/session readiness | Application's existing session mechanism; current session | Request-local server identity, no shared mutable request credentials | UI claims only shape UX; server verifies each read/write |
| Effective authorization and business invariants | Trusted server at operation time | Applies equally to SPA requests, SSR fetches, exports, and streams | Derive principal from verified credentials; verify tenant/resource/action |
| Tokens, component defaults, locale messages | Design-system configuration; deployment/app instance | Stable initial locale/theme assumptions or serialized resolution | Config is not customer content; translated/user text is not executable HTML |

Vue explicitly warns about module-singleton cross-request state pollution and recommends a fresh application/store per request. Merely importing Pinia does not establish isolation. Browser-only mounting hooks do not run during SSR; cleanup-dependent timers should not start in universal setup. These are [Vue SSR contracts](https://vuejs.org/guide/scaling-up/ssr.html#writing-ssr-friendly-code), not optional layering preferences.

**Creator/disposal contract (synthesis):** the application bootstrap—or SSR request factory—creates the router, store/cache instances and auth integration. A feature provider creates shared feature capabilities once; each editor session creates its draft and save coordinator. The UI owner creates browser effects and disposes them with its interaction. Route departure, access retirement and application/request completion are distinct teardown points; [KeepAlive deactivation](https://vuejs.org/guide/built-ins/keep-alive.html#lifecycle-of-cached-instance) is not unmount/disposal. Name the owner of any work intentionally outliving these boundaries.

## Boundaries that survive feature growth

**Synthesis:** start with cohesive feature slices. Extract when a boundary hides meaningful policy, a stateful invariant, a lifecycle, or an independently changing UI responsibility. File length and reuse count are signals, not rules.

- **Route/screen:** decodes view intent and coordinates feature operations; owns navigation policy and top-level load/error composition.
- **Feature interaction:** owns a meaningful user task, its local state and cleanup; exposes domain props/events rather than pointer events relayed through unrelated ancestors.
- **Form/editor:** owns draft, validation, dirty/baseline comparison, and submission lock; receives a server snapshot, not a mutable cache object.
- **Query adapter:** owns resource key construction, request parsing, cancellation, freshness and reconciliation. Do not also make it the form or auth store.
- **Application store:** owns client state shared across features with a matching lifetime. Avoid a second normalized entity cache unless a concrete invariant requires it.
- **Transport/auth adapter:** obtains current credentials at operation time and parses server responses. It must not turn authentication readiness into authorization certainty.
- **Design-system primitive:** owns visual/semantic conventions. Add wrappers for a stable application policy, not to rename every Vuetify prop.

Use direct props/events for direct contracts; component events do not bubble automatically. Use typed scoped injection for a shared descendant capability when intermediate components would only relay it. The provider creates one intended instance; consumers must not silently create fallback state. See [components](components.md) and [composables](composables.md).

### A typed seam, not a backend implementation

The following complete TypeScript declaration is an **application-owned contract** for the illustrative inbox. It implements no network, authorization, persistence, or concurrency checking. A real service adapter must map a real backend response to it; changing the contract does not create that backend capability.

```ts
export interface CaseSnapshot {
  readonly tenantId: string
  readonly id: string
  readonly title: string
  readonly revision: string
}

export interface SaveCaseCommand {
  readonly tenantId: string
  readonly id: string
  readonly title: string
  readonly expectedRevision: string
}

export type SaveCaseResult =
  | { kind: 'saved'; value: CaseSnapshot }
  | { kind: 'invalid'; fields: Readonly<Partial<Record<'title', string>>> }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; latest: CaseSnapshot }

export interface CaseCommands {
  save(command: SaveCaseCommand): Promise<SaveCaseResult>
}
```

The server must atomically enforce the revision precondition for `conflict` to be meaningful. If the real API has no conditional-write contract, do not claim lost-update protection; record that prerequisite and design truthful reconciliation. A TypeScript union documents expected results but validates neither untrusted JSON nor server behavior.

An HTTP `If-Match` precondition is one possible real backend mechanism, not something this seam assumes: [RFC 9110 §13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1) requires strong entity-tag comparison and forbids performing the method when the condition fails. A revision string is not automatically an ETag. Returning `conflict.latest` also requires authorization to disclose that snapshot; a failed write must not become an unauthorized read. Adapt to the service's actual contract rather than inventing a conflict payload.

## SPA, SSR, SSG, or Nuxt: choose the operational contract

| Situation | Recommended starting choice (synthesis) | Cost or boundary to make explicit |
| --- | --- | --- |
| Private, highly interactive application with no initial-indexing requirement | Vue/Vite SPA with Router | Static host needs correct history fallback; initial content waits for client code/data; API remains separately authorized |
| Public content known at build time | SSG, often VitePress for documentation | Content freshness follows rebuild/deployment; generated output has no per-request private identity |
| Public request-dependent content with important initial HTML | Framework-managed SSR, commonly [Nuxt](nuxt.md) for a new application | Request isolation, hydration, response caching/privacy, runtime hosting, and error status behavior become requirements |
| Public pages and private workspace share one deployment | [Nuxt hybrid rendering](nuxt.md#route-rules-privacy-and-deployment) when operationally justified | Route rules do not authorize private data; never share-cache personalized HTML/payloads without a proven isolation policy |
| Existing Nuxt application | Preserve [Nuxt's application/router/data lifecycle](nuxt.md) | Do not bolt on a second standalone Vite bootstrap, router instance, or hydration cache without an explicit integration design |
| Existing custom SSR stack | Preserve its factory/render contract while fixing the actual boundary | Audit request-local dependencies and client hydration rather than recreating the platform casually |

Vue documents SSR's initial-content benefit and additional build/runtime cost; [Nuxt rendering modes](https://nuxt.com/docs/4.x/guide/concepts/rendering) document universal, client, hybrid, and prerendered boundaries. Neither promises automatic offline support, backend authorization, zero duplicate fetches, or a performance win for every application. Static prerender output alone does not include a running server endpoint.

For SSR, decide what is serialized, how it is escaped, who may receive it, and which cache can retain it. Do not put secrets in browser payloads. Ensure initial locale, timezone-dependent formatting, theme, IDs, and data resolve deterministically; keep browser-only charts/3D behind a purposeful initial-content boundary rather than suppressing hydration warnings.

## Trace the worked flow end to end

1. The router normalizes the inbox URL. Auth starts in `loading`; private queries and previous-tenant content are not displayed as current.
2. A verified active client session and selected tenant establish an access scope. The server still verifies membership and resource permissions on each request.
3. The list query uses that scope and normalized filters. The UI distinguishes first load, empty authorized result, background refresh, and refresh failure with old data.
4. Opening a case establishes route selection if deep linking is required. The detail query is canonical remote state; the editor copies only editable fields and baseline revision once for this edit session.
5. The overlay owns focus and close/discard policy. Chart selection remains route intent, not a mutation of draft state.
6. Valid submission locks the form, sends a scoped revision-bearing command, and handles invalid/forbidden/conflict/unknown outcomes without erasing draft input.
7. Confirmed save reconciles the detail cache and affected list/summary families. A subsequent refresh failure is reported as stale presentation, not a failed write. Only the still-current scope may navigate or announce success.
8. Closing restores focus to the opener or a surviving logical target. Tenant change/logout invalidates pending UI ownership, removes private caches and client workflow state, and closes the editor; a late old completion cannot manipulate the new tenant's screen.

The detailed concurrency and UI protocols are in [data architecture](architecture-data.md) and [UI architecture](architecture-ui.md).

## Minimal progressive reading sets

Read this guide once; then take only the branch that owns the next implementation decision.

| Next decision | Minimum next reading | Add only when needed |
| --- | --- | --- |
| New feature boundary | [components](components.md), [composables](composables.md) | [core Vue](core-vue.md) for unfamiliar reactivity |
| Remote editable resource | [data architecture](architecture-data.md), [forms](forms.md) | The existing read owner's reference; one selected form branch only when needed. Nuxt native data does not require a second query cache |
| Shared client workflow | [state](state.md) | [auth](auth.md) only for identity/session integration |
| New Vuetify screen | [UI architecture](architecture-ui.md), [Vuetify components](vuetify-components.md) | [design system](design-system.md), [Vuetify theme](vuetify-theme.md) for token changes |
| Deployment or hydration change | [Nuxt](nuxt.md) for a Nuxt host; [debugging and SSR](debugging-ssr.md) for diagnosis | [Nuxt integrations](nuxt-integrations.md) for a selected SDK/module; [setup and tooling](setup-tooling.md) for standalone build changes |
| Incumbent stack extension | Owning specialist, then [migration](migration.md) only if required | [OpenVue](openvue.md), [Quasar](alternative-ui.md) or [TanStack routing](routing-tanstack.md) only for that incumbent/capability |
| Acceptance/evidence design | [testing](testing.md) | The feature's specialist for library-specific failure modes |

## Verification boundary

This is a proposed design and contract, not an exercised inbox implementation. Before accepting an implementation, demonstrate: deep-link/Back behavior; stale data without draft overwrite; duplicate submission; simultaneous edits; access loss; out-of-order responses; tenant switch during save; unauthorized server requests; keyboard focus after close/removal; and concurrent SSR requests with different users. Measure initial-content and bundle/runtime costs before justifying a deployment change. Source review cannot prove accessibility, privacy isolation, or production performance.

## Sources

- [Vue 3.5.44 package metadata](https://registry.npmjs.org/vue/3.5.44) and [Vuetify 4.3.0 metadata/peers](https://registry.npmjs.org/vuetify/4.3.0).
- [Vue SSR overview, isolation, hydration, lifecycle](https://vuejs.org/guide/scaling-up/ssr.html).
- [Vue component events](https://vuejs.org/guide/components/events.html) and [provide/inject ownership](https://vuejs.org/guide/components/provide-inject.html).
- [Nuxt 4.6.2 metadata](https://registry.npmjs.org/nuxt/4.6.2) and [Nuxt 4 rendering modes](https://nuxt.com/docs/4.x/guide/concepts/rendering).
- [OWASP authorization: every request, server-side enforcement](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- [RFC 9110 conditional writes and `If-Match`](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1).
