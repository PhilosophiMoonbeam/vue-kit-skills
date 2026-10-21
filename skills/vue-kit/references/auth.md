# Clerk authentication in Vue

Read for Clerk setup, loaded/signed-in state, Vue Router gates, identity changes, tokens, or authorization boundaries. This is **plain Vue**, not Nuxt: do not import `defineNuxtRouteMiddleware`, `navigateTo`, Nuxt auto-imports, or Next.js `auth()` into these examples. Keep an incumbent provider unless the task explicitly calls for an auth migration. Router configuration belongs to [routing.md](routing.md); client state to [state.md](state.md); identity-scoped server caches to [tanstack-query.md](tanstack-query.md) / [pinia-colada.md](pinia-colada.md).

## Version and ownership

Baseline: Vue **3.5.44**, `@clerk/vue` **2.5.13**. Its published peer is Vue `^3.2.0`, engine Node `>=20.9.0`, and dependency `@clerk/shared ^4.41.0`. Use exact SDK versions plus a lockfile; Clerk's hosted JavaScript/UI are separately delivered unless explicitly bundled. An SDK pin alone is not a pin of every hosted component. [Package metadata](https://registry.npmjs.org/@clerk/vue/2.5.13), [component versioning](https://clerk.com/docs/reference/components/versioning).

| Concern | Authority / owner | Client responsibility |
| --- | --- | --- |
| Loaded state, session, current user/org | Clerk SDK | Read reactive composables, never a persisted duplicate |
| Sign-in/up, MFA, pending session tasks | Clerk flow | Prefer prebuilt components; do not equate one successful password step with a completed session |
| User-specific drafts and UI state | Application | Reset on identity/session/org transition; never restore another user's draft |
| Protected records | Authorized server and query cache | Partition keys by identity/org and stop stale work on transition |
| Resource access / tenant isolation | Server | Verify token and authorize every request; browser guards and `has()` only control UX |
| Return URL | Application redirect policy | Validate at the consumer; a query parameter is untrusted |

## Setup and complete component example

In a configured Vue/Vite app, install `@clerk/vue@2.5.13`. Set `VITE_CLERK_PUBLISHABLE_KEY` to the **publishable** key of the intended Clerk application, not a secret key. Existing working applications should keep their keys and application identity; do not provision a replacement to fix a missing import.

```sh
bun add --exact @clerk/vue@2.5.13
```

```ts
// src/main.ts
import { createApp } from 'vue'
import { clerkPlugin } from '@clerk/vue'
import App from './App.vue'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (typeof publishableKey !== 'string' || !publishableKey) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required.')
}

createApp(App).use(clerkPlugin, { publishableKey }).mount('#app')
```

The following `App.vue` is complete with that entrypoint and a real configured Clerk application. Clerk's prebuilt sign-in/up flow owns its own challenge/error UI. This component handles the separate application operation, signing out; it does not invent an `error` field on `useAuth()`.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { SignInButton, SignUpButton, useAuth, useUser } from '@clerk/vue'

const { isLoaded, isSignedIn, userId, signOut } = useAuth()
const { user, isLoaded: userLoaded } = useUser()
const pending = ref(false)
const error = ref<string | null>(null)

async function logOut(): Promise<void> {
  if (!isLoaded.value || pending.value) return
  pending.value = true
  error.value = null
  try {
    await signOut.value()
  } catch {
    error.value = 'Sign-out failed. Your session may still be active. Try again.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <p v-if="!isLoaded" role="status">Loading authentication…</p>
  <section v-else-if="isSignedIn">
    <p v-if="!userLoaded" role="status">Loading profile…</p>
    <p v-else>Hello, {{ user?.firstName || userId }}.</p>
    <button type="button" :disabled="pending" @click="logOut">
      {{ pending ? 'Signing out…' : 'Sign out' }}
    </button>
  </section>
  <section v-else>
    <p>Sign in to access your account.</p>
    <SignInButton mode="modal"><button type="button">Sign in</button></SignInButton>
    <SignUpButton mode="modal"><button type="button">Create account</button></SignUpButton>
  </section>
  <p v-if="error" role="alert">{{ error }}</p>
</template>
```

### Composable contracts and failure states

- `useAuth()` and `useUser()` return objects of **computed refs**, so direct destructuring preserves reactivity. In script, call `await getToken.value()` / `await signOut.value()`; templates unwrap refs. Do not call a ref as though it were a bare function. `isSignedIn`, `userId`, and resources may be `undefined` until loaded, `null` when absent, or populated when ready; do not narrow the whole API to non-null strings or booleans prematurely. [Exact declarations](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/composables/useAuth.d.ts).
- `useUser()` exposes the current user profile; its loading boundary may differ from `useAuth()`. Profile display data is not a second auth decision. Never infer sign-in from a saved user name/avatar.
- `useClerk()` returns a shallow ref to `Clerk | null`, not the instance itself. Before using low-level methods check `clerk.value`; prefer `SignInButton`/`UserButton` for ordinary UI. [Exact declaration](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/composables/useClerk.d.ts).
- `useOrganization()` exposes `organization`, `membership`, and `isLoaded`; membership can be absent even with an organization. For standard org switching use `OrganizationSwitcher`. **`useOrganizationList` is not exported by 2.5.13**; do not copy the React hook or an older source recipe into Vue. If custom switching is required, use the loaded Clerk instance's supported resource methods and handle the resulting promise. [Published composable exports](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/composables/index.d.ts).
- `useSignIn()` / `useSignUp()` are for deliberately custom flows. Their resource and `setActive` can be unavailable until loaded. Respect the complete flow's statuses, second-factor and verification steps, and pending tasks; activate only the session produced by a genuinely complete flow. Never present a password-only sketch as complete authentication. Prefer prebuilt flows unless custom requirements justify this ownership.
- `isLoaded === false` means **unknown/loading**, not signed out or unauthorized. The SDK also has operational status (`loading`, `ready`, `degraded`, `error`); `loaded` can be true in degraded mode. Handle SDK loading failure in the shell and handle rejected operations separately. Do not fabricate a `useAuth().error` API or silently grant access on SDK/network failure. [Clerk status contract](https://clerk.com/docs/vue/reference/objects/clerk#properties).
- Vue composables require an injection context. Plugin installation does not make arbitrary module-scope `useAuth()` valid. Call synchronously in component setup, a correctly installed Pinia setup store, or a supported injection context such as a Vue Router guard before its first `await`. Do not rely on component lifecycle hooks in a guard.

### Organization membership and switching

Use `OrganizationSwitcher` for ordinary selection; it already owns membership pagination, pending/error presentation, and activation. For a genuinely custom picker in **2.5.13**, `useUser().user.value.getOrganizationMemberships({ initialPage, pageSize })` returns a promise of `{ data, total_count }`, not a `useOrganizationList` ref. Pages are one-based. `useOrganization().organization` is the **active** org, not the user's complete membership list. `organization.value.getMemberships()` lists members of that organization: it is a different operation.

This complete integration module exposes real SDK operations without copying resources into Pinia. Its promises reject on loading, stale identity, or SDK failure; the custom picker must catch/display failures, serialize activation while pending, render `data` with each membership's `organization.id`/`.name`, and use `total_count` to bound next-page navigation:

```ts
// src/use-organization-commands.ts
import { watch } from 'vue'
import { useAuth, useClerk, useUser } from '@clerk/vue'

export function useOrganizationCommands() {
  const clerk = useClerk()
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth()
  const { user, isLoaded: userLoaded } = useUser()
  let sessionGeneration = 0
  watch([isLoaded, isSignedIn, userId, sessionId], () => {
    sessionGeneration++
  }, { flush: 'sync' })

  function owner(): string {
    if (!isLoaded.value || !isSignedIn.value || !sessionId.value || !userId.value) {
      throw new Error('An active session is required.')
    }
    return JSON.stringify([sessionGeneration, userId.value, sessionId.value])
  }

  async function memberships(page = 1) {
    if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid membership page.')
    const key = owner()
    const resource = user.value
    if (!userLoaded.value || !resource || resource.id !== userId.value) {
      throw new Error('The user profile is not ready.')
    }
    const result = await resource.getOrganizationMemberships({ initialPage: page, pageSize: 10 })
    if (owner() !== key) throw new Error('The session changed; discard the membership page.')
    return result
  }

  async function activateOrganization(organization: string | null): Promise<void> {
    const key = owner()
    const instance = clerk.value
    if (!instance?.loaded) throw new Error('Clerk is not ready.')
    await instance.setActive({ organization })
    if (owner() !== key) throw new Error('The session changed during organization selection.')
  }

  return { memberships, activateOrganization }
}
```

Use an id from the current user's returned memberships, or `null` to leave organization context; do not activate a route/body-supplied tenant as proof of membership. On user/session transition discard pages, reset page to 1, and hide the picker/private subtree; on org transition apply the identity teardown below. A stale request check prevents consuming its result; it **does not cancel or undo** an activation already issued to Clerk. Do not issue competing activations or keep stale membership pages visible while switching accounts. SDK/backend authorization still decides access, and a removed membership can reject activation. [Exact SDK exports](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/composables/index.d.ts), [matching shared 4.41.0 user declaration](https://cdn.jsdelivr.net/npm/@clerk/shared@4.41.0/dist/types/user.d.ts), [activation declaration](https://cdn.jsdelivr.net/npm/@clerk/shared@4.41.0/dist/types/clerk.d.ts), [user membership API](https://clerk.com/docs/vue/reference/objects/user#getorganizationmemberships). The shared package is a ranged SDK dependency; the app lockfile determines its resolved release.

The synchronous session-generation watcher also rejects an old membership response after A → B → A returns to the same user/session identifiers. Identifier equality alone cannot detect that intervening teardown. It is scoped to the composable's setup owner; do not keep calling its commands after that owner is disposed.

## Vue Router guard, not a server security boundary

This is a complete **integration module**, not a second router setup. Use the classic router APIs documented in [routing.md](routing.md), with Vue Router **5.4.0** for this reference; existing Router 4 applications may retain their routing version after checking its guard injection support. Requirements for the host:

1. Install `clerkPlugin` before `app.use(router)` triggers initial navigation.
2. Register this guard before installing the router.
3. Define public route names `sign-in`, `auth-unavailable`, and `select-organization`; none may have `requiresAuth` or `requiresOrg`. `auth-unavailable` must display an honest failure state with an explicit retry/reload action, not treat failure as logout.
4. Mark private records with `meta: { requiresAuth: true }` and org-bound records additionally with `requiresOrg: true`.

The ten-second deadline below is an **application policy**, not Clerk's documented initialization SLA. It avoids an indefinitely pending private navigation and always disposes the temporary watcher. Guard injection is supported in Vue 3.3+: [Vue Router documentation](https://router.vuejs.org/guide/advanced/navigation-guards.html#global-injections-within-guards).

```ts
// src/clerk-guard.ts
import { watch, type Ref } from 'vue'
import { useAuth } from '@clerk/vue'
import type { Router } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresOrg?: boolean
  }
}

function waitForAuth(loaded: Readonly<Ref<boolean>>): Promise<void> {
  if (loaded.value) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const stop = watch(loaded, (ready) => {
      if (!ready) return
      stop()
      clearTimeout(timer)
      resolve()
    })
    const timer = setTimeout(() => {
      stop()
      reject(new Error('Authentication initialization did not finish.'))
    }, 10_000)
  })
}

export function installClerkGuard(router: Router): () => void {
  return router.beforeEach(async (to) => {
    if (!to.meta.requiresAuth && !to.meta.requiresOrg) return true
    // Acquire injected refs synchronously, before yielding to async work.
    const { isLoaded, isSignedIn, orgId } = useAuth()
    try {
      await waitForAuth(isLoaded)
    } catch {
      return { name: 'auth-unavailable', replace: true }
    }
    if (!isSignedIn.value) {
      return { name: 'sign-in', query: { returnTo: to.fullPath }, replace: true }
    }
    if (to.meta.requiresOrg && !orgId.value) {
      return { name: 'select-organization', replace: true }
    }
    return true
  })
}
```

The returned function removes the guard during host teardown. A guard checks entry, not continuous access: after sign-out, revocation, org switching, or loss of permission, hide/unmount the private subtree immediately and navigate to a public route. Do not wait for another navigation to remove private UI. Server requests must still authorize the operation even when this guard returns `true`. Pending-session tasks must remain gated; do not change Clerk's pending-as-signed-out default just to bypass onboarding.

### Sanitize post-login redirects at consumption

Never pass `route.query.returnTo` directly to `window.location`, Clerk redirect options, or `router.replace()`. Use a local route allowlist; a same-origin URL can still be an unwanted redirect/transition. This complete utility intentionally supports only two application-owned destinations. Replace the allowlist with real intended route paths; do not widen it to arbitrary schemes/hosts.

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

Contextual consumption in a sign-in route: import `safeReturnTo`, compute `safeReturnTo(route.query.returnTo, window.location.origin)`, and use that value for a prebuilt `SignIn` component's `forceRedirectUrl`, or navigate with `router.replace()` after observing a loaded signed-in session. `fallbackRedirectUrl` is not an allowlist: higher-priority redirect inputs can override a fallback. Do not re-decode a sanitized result, and do not place passwords/tokens/private payloads in the return URL. Configure Clerk's allowed redirect origins/protocols consistently with the app's policy. A catch-all nested sign-in route is required when using path-routed prebuilt flows; hash routing is a different choice. See [SignIn props](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/components/ui-components/SignIn.vue.d.ts) and [routing.md](routing.md).

## Token trust, authorization, and claims freshness

`getToken.value()` can resolve to **null** and can reject. Obtain tokens just before a request; keep them ephemeral, do not persist them in Pinia/localStorage, log them, place them in query keys/URLs, or include them in error telemetry. Never send `Authorization: Bearer null`. This complete transport factory defines an explicit application-owned transport boundary; it does not invent a backend endpoint or claim to implement server authorization:

```ts
// src/authenticated-transport.ts
export type GetSessionToken = () => Promise<string | null>

export function authenticatedFetch(getToken: GetSessionToken, apiOrigin: string) {
  const trustedOrigin = new URL(apiOrigin).origin
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(path, trustedOrigin)
    if (url.origin !== trustedOrigin) throw new Error('Untrusted API origin.')
    const token = await getToken()
    if (!token) throw new Error('An active session is required.')
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...init, headers, redirect: 'error' })
  }
}
```

In setup, inject the SDK getter as `() => getToken.value()` and a configured trusted HTTPS API origin. The wrapper forbids cross-origin token forwarding and redirects; the caller still owns cancellation, response status handling, payload validation, and identity-generation checks. Do not accept `apiOrigin` from a route/user input. Same-origin cookie-based APIs have their own cookie/CSRF policy; do not add bearer transport indiscriminately.

Server requirements, independent of frontend framework:

1. Verify the Clerk session token with the matching backend SDK/middleware (`authenticateRequest` or its framework equivalent), trusted issuer/keys, validity dates, and configured authorized parties. Decoding a JWT is not signature verification. Secret keys and privileged SDKs stay server-side.
2. Derive user/session/active tenant from **verified** claims. Do not trust body/query `userId`, Pinia state, `isSignedIn`, or a browser `has()` result as proof.
3. Authorize the specific resource and action, including tenant membership and ownership. Authentication alone does not grant access to every record. Deny absent/pending/incomplete sessions according to application policy; return distinct unauthenticated/forbidden responses without leaking protected content.
4. Apply current policy to sensitive operations. Token claims are snapshots: revocation/role/metadata changes may not be reflected in an already-issued valid token. Where immediate revocation is required, perform the necessary current server-side checks; frontend refresh is not a revocation mechanism.

[Verification guidance](https://clerk.com/docs/guides/sessions/manual-jwt-verification), [authorization guidance](https://clerk.com/docs/vue/guides/secure/authorization-checks). `has.value({ permission: 'org:team_settings:manage' })` can gate UI only if that actual custom permission exists in the app. System permissions are not included in session-token permission checks; verify the appropriate role/current server policy instead. Org permission checks require an active organization. No UI conditional, hidden button, client route guard, or client state container protects server data.

After a successful server-side metadata/role change, `await getToken.value({ skipCache: true })` forces a new client token; `await user.value?.reload()` refreshes the user resource and token. Neither should run on every render. Await the authoritative mutation first, refresh only what changed, then invalidate affected cached data. Claims are not instantly fresh merely because a Pinia flag was updated. [Refresh semantics](https://clerk.com/docs/guides/sessions/force-token-refresh), [session-token claims](https://clerk.com/docs/guides/sessions/session-tokens).

## Identity teardown and Pinia integration

Keep one source of truth. A thin Pinia setup store may derive app-specific policy from Clerk refs after both plugins are installed, but do not persist or copy `userId`, `isSignedIn`, user resources, tokens, or org membership into another mutable auth state. SDK resources are externally owned, not serializable Pinia state. Do not assume any Pinia setup store automatically has component lifecycle context: installation order and the app's injection context matter. Direct SDK composables are often simpler.

### A derived Pinia facade, not a second session

For an incumbent needing store-based policy access, this complete module returns only computed presentation/policy and an ephemeral token operation. Install Clerk and Pinia before instantiating it, inside the app's injection context. It does not serialize Clerk's user or organization resource:

```ts
// src/access-store.ts
import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuth, useOrganization, useUser } from '@clerk/vue'

export const useAccessStore = defineStore('access', () => {
  const { isLoaded, isSignedIn, userId, sessionId, orgId, getToken } = useAuth()
  const { user } = useUser()
  const { organization, isLoaded: organizationLoaded } = useOrganization()
  const ready = computed(() => isLoaded.value)
  const identityKey = computed(() => !isLoaded.value || !isSignedIn.value
    ? null : JSON.stringify([userId.value, sessionId.value, orgId.value ?? null]))
  const displayName = computed(() => isLoaded.value && isSignedIn.value
    ? user.value?.fullName ?? userId.value ?? '' : '')
  const activeOrganizationName = computed(() => organizationLoaded.value
    ? organization.value?.name ?? null : null)
  const canEnterOrganization = computed(() =>
    isLoaded.value && isSignedIn.value === true && Boolean(orgId.value))

  async function requestToken(): Promise<string | null> {
    if (!isLoaded.value || !isSignedIn.value) return null
    return getToken.value()
  }
  return { ready, identityKey, displayName, activeOrganizationName, canEnterOrganization, requestToken }
})
```

Consumers use `storeToRefs(access)` for reactive computed fields and call `await access.requestToken()` (a Pinia action, not Clerk's computed function ref). Token rejection still propagates; never store its result as state. This store has no owned mutable session state to `$reset`, and no resource/persistence plugin should mirror SDK internals. `canEnterOrganization` is only a navigation/display prerequisite, not a permission or backend authorization check. If first instantiated outside setup, pass the correct Pinia and establish a supported injection context; a request-global active root is not sufficient. SDK refs are reactive without a manual SDK listener or `onMounted` copy. [Pinia app-context setup execution](https://unpkg.com/pinia@4.1.0/dist/pinia.js), [Clerk computed-ref declaration](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/composables/useAuth.d.ts).

The following complete composable accepts an **application-owned synchronous cleanup contract**. Call once from the app shell, supply the real cleanup implementation, and key the private subtree by its returned generation. It catches changes initiated elsewhere, not just the local sign-out button.

```ts
// src/use-identity-boundary.ts
import { computed, readonly, shallowRef, watch } from 'vue'
import { useAuth } from '@clerk/vue'

export function useIdentityBoundary(clearIdentityState: () => void) {
  const { isLoaded, isSignedIn, userId, sessionId, orgId } = useAuth()
  const generation = shallowRef(0)
  const identityKey = computed(() => {
    if (!isLoaded.value || !isSignedIn.value) return null
    return JSON.stringify([userId.value, sessionId.value, orgId.value ?? null])
  })
  watch(identityKey, () => {
    generation.value++
    clearIdentityState()
  }, { immediate: true, flush: 'sync' })
  return { identityKey, generation: readonly(generation) }
}
```

The callback must synchronously hide/erase identity-owned client state and invalidate the generation under which pending requests may commit. It should initiate cancellation/eviction of identity-scoped server caches and remove identity-scoped persisted records; query implementations and their async cancellation contracts belong to [tanstack-query.md](tanstack-query.md) / [pinia-colada.md](pinia-colada.md). Key every private query by user **and** active organization (session when its semantics require it), enable it only for a loaded usable identity, and ignore late responses from previous generations. Clear on logout, account switch, session switch, org switch, and revocation. Component unmount alone does not erase a global cache. Do not reset unrelated anonymous preferences automatically.

Capture `generation.value` **before the first await**, including token retrieval; check that it is unchanged before dispatching identity-bound I/O and before publishing data, errors, or completion flags. Compare generations, not just the identity string: A → B → A must reject A's first request even when its IDs match again. Render the generation-keyed private subtree only when `identityKey` is non-null. Async cache teardown must target the captured old scope, not clear the newly active identity's cache after awaiting cancellation. Do not enable the new private subtree until its required cleanup has completed; cancellation that a transport ignores is not a publication barrier. These are application lifetime requirements, not automatic Clerk behavior. [Synchronous watcher timing](https://vuejs.org/guide/essentials/watchers.html#sync-watchers), [exact Clerk reactive auth contract](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/composables/useAuth.d.ts).

For explicit logout, close/hide the private subtree and clear sensitive client state before it can render to another identity; then await Clerk sign-out, show failures honestly, and redirect to a fixed public destination. The SDK owns session termination: clearing Pinia is not logout. Conversely, SDK sign-out does not automatically know about application drafts, query caches, persisted records, sockets, or background jobs. A failed sign-out can leave the server session active even though local sensitive data was erased.

## Verification boundary

These are authored SDK/integration examples, not an exercised authentication system. The standalone component needs a real Clerk application/key; the guard requires the explicitly named host routes; the cleanup composable requires real application cleanup. Backend authorization is specified as a required contract, not a fabricated service implementation. No test account or production resource is provisioned by this reference.

Application verification should exercise: unknown/loading versus signed-out rendering; SDK initialization failure/degraded operation; successful/rejected sign-out; required MFA/pending tasks; direct/private URL entry before initialization; redirect arrays, `//host`, backslashes, control characters, encoded separators, and disallowed paths; null/rejected token retrieval; forged/expired/wrong-party token rejection on the server; cross-tenant resource denial; account/org/session switches with in-flight responses; cache/draft/persistence removal; and stale claims after a server mutation. See [testing.md](testing.md). Client component tests cannot prove server authorization.

## Sources

- [`@clerk/vue` 2.5.13 metadata](https://registry.npmjs.org/@clerk/vue/2.5.13), [public exports](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/index.d.ts), [composable exports](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/composables/index.d.ts), [plugin options](https://cdn.jsdelivr.net/npm/@clerk/vue@2.5.13/dist/plugin.d.ts).
- [Manual Vue setup](https://clerk.com/docs/vue/getting-started/quickstart?manual=1), [`useAuth`](https://clerk.com/docs/vue/reference/composables/use-auth), [`useUser`](https://clerk.com/docs/vue/reference/composables/use-user), [`useClerk`](https://clerk.com/docs/vue/reference/composables/use-clerk), [`useOrganization`](https://clerk.com/docs/vue/reference/composables/use-organization).
- [Vue Router guard injections](https://router.vuejs.org/guide/advanced/navigation-guards.html#global-injections-within-guards), [Router 5.4.0 metadata](https://registry.npmjs.org/vue-router/5.4.0).
- [Token verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification), [authorization](https://clerk.com/docs/vue/guides/secure/authorization-checks), [claims](https://clerk.com/docs/guides/sessions/session-tokens), [forced refresh](https://clerk.com/docs/guides/sessions/force-token-refresh).
