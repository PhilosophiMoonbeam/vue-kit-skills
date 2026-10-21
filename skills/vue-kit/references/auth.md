# Session identity and authorization boundaries

Read when an existing application's session, navigation, private cache, or identity-sensitive UI changes. This reference covers provider-neutral frontend boundaries, not authentication-service setup or a replacement login system. It installs no remote SDK, provisions no account, and supplies no password, token-verification, or session-server implementation. Preserve the application's real authentication mechanism. Use [routing](routing.md) for standalone guards, [Nuxt](nuxt.md) for framework middleware/request context, and [Nuxt integrations](nuxt-integrations.md#identity-transitions-and-private-caches) for the concrete private-cache boundary.

## Ownership and readiness

Baseline: Vue **3.5.44**. The following are application contracts, not APIs exported by Vue:

| Concern | Authority / owner | Client responsibility |
| --- | --- | --- |
| Session validity and current principal | Application's trusted server/session mechanism | Consume its readiness and failure states; never infer validity from saved profile data |
| Login, challenges, recovery and logout | Existing complete authentication flow | Do not substitute a password-only sketch or local state reset |
| User-specific drafts and UI state | Application | Erase or retire them on account/session/tenant transition |
| Private records | Authorized backend and one selected query cache | Partition by response identity and prevent stale publication |
| Resource/action/tenant access | Server on every request | Browser guards and hidden buttons control UX only |
| Return URL | Application redirect policy | Validate untrusted navigation input at consumption |

Keep loading/unknown, signed out, ready, and unavailable/error distinct. An unresolved or failed session check must not open private UI or silently become a signed-out success. Incomplete challenges remain gated. A selected tenant ID is intent, not membership proof. Profile names, avatars, decoded claims and hydrated client state are display data, not server authorization.

Create request-bearing session state and credential access per SSR request. Do not keep a mutable current-user object, cookie jar, token getter, or authorized cache in a server module singleton. Vue composables requiring injection/lifecycle must run in the owning setup/effect scope; installing a plugin does not make arbitrary module-scope composable calls valid.

## Navigation policy, not server security

Use the application's actual access readiness contract in [the injected route-access boundary](routing.md#guards-injection-failures-and-metadata). Install dependencies before initial navigation, capture injections before the first `await`, and define public recovery/loading routes explicitly if the application uses redirects. Nuxt route middleware follows [its own lifecycle](nuxt.md#pages-layouts-and-middleware), not a second standalone router.

A successful entry guard is not continuous authorization: on sign-out, revocation, session/tenant switch or permission loss, immediately close the private subtree and retire its state. Do not wait for another navigation. Server handlers must authenticate and authorize even when the browser guard allows entry.

### Sanitize post-login redirects at consumption

Never pass `route.query.returnTo` directly to `window.location` or `router.replace()`. This complete pure utility intentionally supports only two application-owned paths. Adapt the allowlist and fixed fallback to real routes; same-origin alone is not an allowlist.

```ts
// src/return-to.ts
const allowedPaths = new Set(['/dashboard', '/settings'])

export function safeReturnTo(value: unknown, origin: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard'
  }
  if (/[\\\u0000-\u0020]/u.test(value) || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|20)/iu.test(value)) {
    return '/dashboard'
  }
  try {
    const url = new URL(value, origin)
    if (url.origin !== origin || !allowedPaths.has(url.pathname)) return '/dashboard'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/dashboard'
  }
}
```

Consume the sanitized destination only after the real session flow completes. Obtain the trusted origin from application/request configuration (or `window.location.origin` in browser-only code), not an untrusted query/header. Do not re-decode the result or put passwords, tokens, or private payloads in return URLs.

## Token trust, authorization, and claims freshness

Only use bearer transport when the actual backend requires it; cookie-based APIs instead need their real cookie/CSRF policy. Credentials remain ephemeral: never persist them in Pinia/browser storage, query keys, URLs, logs, telemetry, or hydration payloads. A token getter may reject or return null.

This complete factory takes real application capabilities; it implements neither token issuance nor backend authorization:

```ts
// src/authenticated-transport.ts
export type GetSessionToken = () => Promise<string | null>

export function authenticatedFetch(
  getToken: GetSessionToken, apiOrigin: string, getGeneration: () => number,
) {
  const trustedOrigin = new URL(apiOrigin).origin
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(path, trustedOrigin)
    if (url.origin !== trustedOrigin) throw new Error('Untrusted API origin.')
    const generation = getGeneration()
    const token = await getToken()
    if (!token) throw new Error('An active session is required.')
    if (getGeneration() !== generation) throw new Error('The identity changed before dispatch.')
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...init, headers, redirect: 'error' })
  }
}
```

Supply a configured trusted HTTPS API origin and a synchronous identity-generation reader. The wrapper captures generation **before** token retrieval, rejects a changed generation **before** dispatch, and prevents cross-origin token forwarding/redirects. The caller owns cancellation, status handling, runtime decoding, and generation checks before publishing data, errors or completion. An ID-equality check alone misses A → B → A.

Server requirements, independent of frontend framework:

1. Verify the actual session credential using the application's real server mechanism. For signed tokens, validate signature, trusted issuer/audience, validity and applicable revocation policy; decoding a JWT is not verification. Keep verification secrets server-side.
2. Derive principal/session/tenant from verified request context, never a body/query `userId`, client store, or browser permission flag.
3. Authorize the requested resource and action, including membership and ownership, on **every** request. Reject absent/incomplete sessions and forbidden access without disclosing protected content.
4. Apply current policy to sensitive operations. Issued claims can become stale; a frontend refresh cannot implement immediate revocation. Await an authoritative permission mutation, refresh the real session contract if required, then invalidate affected data.

## Identity teardown and Pinia integration

Keep one canonical session owner. A store may derive display policy from that owner's reactive state, but must not create a separately persisted session, serialize credentials/resources, or treat cached membership as current authorization. Clearing Pinia is not logout; successful server logout does not automatically erase application drafts, query caches, persistence, sockets or background jobs.

The following complete composable owns a **synchronous UI retirement boundary**, not authentication. Its application-owned `scopeKey` is null unless the real session is usable; otherwise it includes principal, session, tenant and any permission revision that changes private response identity. The session owner must publish invalidation immediately, including changes initiated outside the local logout button. Call once in the app shell/setup scope.

```ts
// src/use-identity-boundary.ts
import { computed, onScopeDispose, readonly, shallowRef, watch, type Ref } from 'vue'

export function useIdentityBoundary(
  scopeKey: Readonly<Ref<string | null>>,
  clearIdentityState: () => void,
) {
  const generation = shallowRef(0)
  const blocked = shallowRef(true)
  watch(scopeKey, () => {
    blocked.value = true
    generation.value++
    clearIdentityState()
    blocked.value = false
  }, { immediate: true, flush: 'sync' })
  const identityKey = computed(() => blocked.value ? null : scopeKey.value)
  onScopeDispose(() => {
    blocked.value = true
    generation.value++
  })
  return { identityKey, generation: readonly(generation) }
}
```

`clearIdentityState` must synchronously erase/hide identity-sensitive client state and invalidate pending publication. A thrown cleanup leaves the gate closed; handle/report that failure at the application's error boundary rather than granting access. This callback is **not** an async cache-drain API. If cache teardown requires unmount/await, keep the new private subtree closed until that separate teardown completes; use the concrete [Nuxt Colada boundary](nuxt-integrations.md#identity-transitions-and-private-caches) or the selected [Query](tanstack-query.md)/[Colada](pinia-colada.md) cancellation/removal contract.

Render the private subtree only for non-null `identityKey` and key it by `generation`. Capture generation **before the first await**, including credential retrieval, and compare it before dispatch and every data/error/completion commit. Clear identity-scoped persistence and all private resource families, not just the visible detail; do not erase unrelated anonymous preferences. Async cleanup must target the captured old scope, not the newly active scope after an await. Cancellation that a transport ignores is not a publication barrier.

For explicit logout, close private UI and retire sensitive client state first, then await the existing server/session logout operation and show failure honestly. A failed logout can leave the server session active even after local data was erased. Re-enter only through a fresh accepted identity, not a restored profile snapshot.

## Verification boundary

These are complete frontend utilities and specified application contracts, not an exercised authentication system or a supplied integration backend. Application checks should cover unknown/error versus signed-out rendering, rejected logout, incomplete challenges, direct private URL entry, malicious redirect values, null/rejected token retrieval, wrong-origin dispatch, account/session/tenant A → B → A with in-flight results, cleanup failure, cache/persistence removal and stale permissions. Independently exercise real server rejection of forged/expired credentials and unauthorized cross-tenant reads/writes. Client component tests cannot prove server authorization; see [testing](testing.md).

## Sources

- [Vue SSR request isolation](https://vuejs.org/guide/scaling-up/ssr.html#cross-request-state-pollution), [synchronous watcher timing](https://vuejs.org/guide/essentials/watchers.html#sync-watchers), [effect-scope disposal](https://vuejs.org/api/reactivity-advanced.html#onscopedispose).
- [Vue Router guard injections](https://router.vuejs.org/guide/advanced/navigation-guards.html#global-injections-within-guards).
- [OWASP authorization: server-side enforcement and every-request checks](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [unvalidated redirects](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html).
