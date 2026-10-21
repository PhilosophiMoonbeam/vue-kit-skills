# Selected Nuxt integrations

Read after [Nuxt](nuxt.md) when adding Vuetify, domain state, an optional query cache or Clerk. These are selected integration contracts, not blanket support for every Nuxt module. Nuxt remains the only application/router/SSR owner; do not copy the plain-Vue bootstrap from the linked SPA guides.

## Selected versions and ownership

Use **Bun 1.4.3** for a new application's package management and Node **24.15.0** for its Nuxt server/tooling, with Nuxt **4.6.2**, Vue **3.5.44**, generated TypeScript contexts and the lockfile from [the core catalogue](nuxt.md#local-catalogue-example). Preserve an existing application's package manager and authoritative lockfile instead of creating a second one. Preserve the bundled SPA's separate versions; this is a Nuxt application profile.

| Concern | Selected packages | Boundary |
| --- | --- | --- |
| Material UI | `vuetify@4.3.0` | Stable manual universal plugin below; explicit component imports, SSR enabled |
| Domain/UI state | `pinia@4.1.0`, `@pinia/nuxt@1.0.3`, `@vue/devtools-api@8.2.1` | Module creates the app/request instance and transfers its state |
| Optional server-state cache | `@pinia/colada@1.4.8`, `@pinia/colada-nuxt@1.2.0`, `@pinia/colada-devtools@2.0.1` | Official module, after Pinia; one query owner per feature |
| Optional authentication | `@clerk/nuxt@3.1.15`, direct `h3@1.15.11` for its h3-specific endpoint | Real Clerk application/keys; default Nitro 2 server boundary, not arbitrary builder certification |

Pinia's Vue peer is `^3.5.11`; its **required** devtools peer is `@vue/devtools-api ^8.2.1` (TypeScript `>=5.6.0` is optional). `@pinia/nuxt@1.0.3` requires Pinia `^4.1.0`. Colada requires Vue `^3.5.41` and admits Pinia `^2.2.6 || ^3.0.0 || ^4.0.2`; its Nuxt module requires Colada `>=1.4.5` and **non-optional** `@pinia/colada-devtools ^2.0.0`. Install that peer even if the panel is disabled. The devtools package's Vite/Devframe integration peers are optional; the module only registers its panel with the Vite builder and compatible Nuxt DevTools 4 during development. These peer ranges admit the selected versions; they are not runtime proof. [Pinia metadata](https://registry.npmjs.org/pinia/4.1.0), [Pinia module metadata](https://registry.npmjs.org/@pinia/nuxt/1.0.3), [Colada metadata](https://registry.npmjs.org/@pinia/colada/1.4.8), [Colada module metadata](https://registry.npmjs.org/@pinia/colada-nuxt/1.2.0), [devtools metadata](https://registry.npmjs.org/@pinia/colada-devtools/2.0.1), [module implementation](https://unpkg.com/@pinia/colada-nuxt@1.2.0/dist/module.mjs).

Clerk Nuxt 3.1.15 declares Nuxt `>=4.0.0` module compatibility and depends on `@clerk/vue ^2.5.13` and `@clerk/backend ^3.26.0`, not exact transitive pins. Retain the resolved lockfile; hosted Clerk JavaScript/UI have their own delivery/version boundary. Do not install the Vue SDK separately or call `clerkPlugin` alongside the Nuxt module. [Exact package](https://registry.npmjs.org/@clerk/nuxt/3.1.15), [module source](https://unpkg.com/@clerk/nuxt@3.1.15/dist/module.js), [hosted component versioning](https://clerk.com/docs/reference/components/versioning).

## Stable manual Vuetify integration

Start with the complete core catalogue files. Install the stable UI and state prerequisites once:

```sh
bun add --exact vuetify@4.3.0 pinia@4.1.0 @pinia/nuxt@1.0.3 @vue/devtools-api@8.2.1
```

Replace the core `nuxt.config.ts` with this complete public profile. The Colada section below adds its module only if chosen; Clerk is a separate credential-required addition.

```ts
// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  typescript: { strict: true },
  modules: ['@pinia/nuxt'],
  css: ['vuetify/styles', '~/assets/css/app.css'],
  build: { transpile: ['vuetify'] },
  app: {
    head: {
      link: [{
        key: 'vuetify-layer-order',
        rel: 'stylesheet',
        href: '/layers.css',
        tagPriority: 'critical',
      }],
    },
  },
  runtimeConfig: {
    catalogSecret: '',
    public: { catalogTitle: 'Local catalogue' },
  },
  nitro: { preset: 'node-server' },
  routeRules: {
    '/catalog/**': { headers: { 'cache-control': 'private, no-store' } },
    '/api/catalog/**': { headers: { 'cache-control': 'private, no-store' } },
  },
})
```

Complete `app/plugins/vuetify.ts`. Create the instance **inside** the Nuxt plugin, once for each Nuxt app/SSR request, not at module scope. It is universal, not `.client.ts`.

```ts
import { defineNuxtPlugin } from '#app'
import { createVuetify } from 'vuetify'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    theme: { defaultTheme: 'light' },
  })
  nuxtApp.vueApp.use(vuetify)
})
```

Replace `app/app.vue` completely:

```vue
<script setup lang="ts">
import { VApp } from 'vuetify/components/VApp'
</script>

<template>
  <VApp>
    <NuxtLayout><NuxtPage /></NuxtLayout>
  </VApp>
</template>
```

Replace `app/layouts/default.vue` completely. This layout owns the single `VMain`; the skip link and navigation are outside its focusable target so skipping actually bypasses navigation:

```vue
<script setup lang="ts">
import { VMain } from 'vuetify/components/VMain'
</script>

<template>
  <div class="catalogue-shell">
    <a href="#main-content">Skip to content</a>
    <nav aria-label="Primary">
      <NuxtLink to="/">Home</NuxtLink>
      <NuxtLink to="/catalog/1">Catalogue</NuxtLink>
      <NuxtLink to="/preferences">Preferences</NuxtLink>
    </nav>
    <VMain id="main-content" tabindex="-1"><slot /></VMain>
  </div>
</template>
```

Complete `app/assets/css/app.css`:

```css
@layer vuetify-overrides {
  .v-application { font-family: system-ui, sans-serif; }
  .catalogue-shell { max-width: 64rem; margin-inline: auto; padding: 1.5rem; }
  .catalogue-shell nav { display: flex; flex-wrap: wrap; gap: 1rem; margin-block: 1rem; }
}
```

Complete unbundled `public/layers.css`, using the same full nested order as [Vuetify setup](vuetify-setup.md#vite-setup-complete-minimal-files):

```css
@layer vuetify-core {
  @layer reset, base;
}
@layer vuetify-components;
@layer vuetify-overrides;
@layer vuetify-utilities {
  @layer theme-base, typography, helpers, theme-background, theme-foreground;
}
@layer vuetify-final {
  @layer transitions, trumps;
}
```

The config's critical stylesheet link establishes top-level **and nested** layer order before bundled framework/component CSS and Vuetify's SSR-generated theme style. Keep it unbundled: a later statement in `app.css` cannot reorder layers already established by earlier CSS. This profile deploys at `/`; its static `href` is literal, so adjust it for the actual deployment base/CDN before a non-root deployment. Preserve an existing deliberate layer policy if it already establishes this full ordering. Inspect the actual SSR/browser stylesheet order rather than assuming a bundled CSS import is first. [Tagged layer source](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/styles/generic/_layers.scss), [tagged loading policy](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/docs/src/pages/en/styles/layers.md), [Nuxt head configuration and literal asset paths](https://nuxt.com/docs/4.x/getting-started/seo-meta), [Unhead priority](https://unhead.unjs.io/docs/head/guides/core-concepts/positions).

There is one `VApp` and one `VMain`; do not put another app wrapper in a page/layout. Nuxt supplies `NuxtPage`, `NuxtLayout` and its router. Explicit Vuetify group imports supply each SFC's components and component CSS, so this profile needs **no** `vite-plugin-vuetify` or auto-import plugin. When adding components, import their actual group exports; register directives you use directly. Do not paste a `vite.config.ts` into a Nuxt app or install a second Vue Vite plugin.

Keep `VApp` at the app root and `VMain` around the default layout's page slot, not around the layout's navigation. `tabindex="-1"` makes the fragment target focusable without adding it to normal Tab order. Verify that activating “Skip to content” focuses `#main-content` and the next Tab reaches page content rather than returning to the skip link or primary navigation.

Vuetify 4 ships cascade layers; preserve their order before introducing an application layer. Unlayered CSS outranks normal layered CSS. The example intentionally uses system fonts and no icon-dependent UI, so it has no undeclared Roboto/icon-font dependency. If adding icons, configure a real SVG set or install the selected font stylesheet. The fixed `light` theme is deterministic for SSR; do not read browser storage or media queries to choose initial server markup. Vuetify 4.3's theme installer checks `app._context.provides.usehead`: when present it registers a stylesheet with `tagPosition: 'bodyOpen'`; otherwise its browser fallback updates or creates the stylesheet by ID and appends a newly created element to `document.head`. Do not promise a permanent head-only location: the selected Nuxt profile can emit the style in SSR head and retain a single applied `#vuetify-theme-stylesheet` in the body after hydration. Verify one stylesheet, applied theme variables and stable appearance rather than its parent element alone. `ssr: true` updates display values after Nuxt resolves suspense. Do not create a second head manager or manually duplicate the theme style. [Exact framework](https://unpkg.com/vuetify@4.3.0/lib/framework.js), [theme installer](https://unpkg.com/vuetify@4.3.0/lib/composables/theme.js), [layer declarations](https://unpkg.com/vuetify@4.3.0/lib/styles/main.css), [package exports/peers](https://registry.npmjs.org/vuetify/4.3.0).

`vuetify-nuxt-module@1.0.0-rc.6` is an **opt-in prerelease**, even though its peer accepts `vuetify ^3.4.0 || ^4.0.0`. That range is not stable Nuxt/Vuetify 4 assurance. If deliberately selecting that module, replace the manual plugin/style/registration strategy with its documented ownership and verify that distinct configuration; never stack both installers. It is not installed by this guide. [Exact prerelease metadata](https://registry.npmjs.org/vuetify-nuxt-module/1.0.0-rc.6).

## Pinia owned by the Nuxt app

`@pinia/nuxt` installs Pinia, exposes the current instance, and handles payload serialization/hydration. Do not add `createPinia()`, `setActivePinia()` or a manual Pinia hydration plugin. A store definition at module scope is fine; a **store instance**, mutable request state or module-level `useStore()` is not. Call a store in setup; outside setup capture `usePinia()` in a supported Nuxt context and pass that instance to `usePreferencesStore(pinia)` before leaving the context. Do not rely on whichever global active instance happened to run last. [Exact module plugin](https://unpkg.com/@pinia/nuxt@1.0.3/dist/runtime/plugin.js), [Nuxt cookbook](https://pinia.vuejs.org/ssr/nuxt.html).

Complete `app/stores/preferences.ts`:

```ts
import { defineStore } from 'pinia'

export const usePreferencesStore = defineStore('preferences', {
  state: () => ({ compact: false }),
  actions: {
    toggleCompact() { this.compact = !this.compact },
  },
})
```

Complete `app/pages/preferences.vue`:

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { VBtn } from 'vuetify/components/VBtn'
import { usePreferencesStore } from '~/stores/preferences'

const preferences = usePreferencesStore()
const { compact } = storeToRefs(preferences)
</script>

<template>
  <section>
    <h1>View preferences</h1>
    <p>Compact view: {{ compact ? 'on' : 'off' }}</p>
    <VBtn :aria-pressed="compact" @click="preferences.toggleCompact()">
      Toggle compact view
    </VBtn>
  </section>
</template>
```

This is application memory with SSR payload transfer, not durable persistence. Initial `false` must be isolated across requests; a browser mutation persists across in-app navigation but not a new unpersisted session. Never persist Clerk proof/tokens or mirror remote query records here. Use [state](state.md) for store design, not its SPA installer.

## Optional Colada query owner

Prefer native Nuxt data for a simple page read. Select Colada when its shared query lifecycle/invalidation is needed; retain an incumbent query owner unless a migration is actually requested. This optional alternative **replaces** the core catalogue page's native data owner. Do not keep both implementations mounted, wrap `useQuery` in `useFetch`/`useAsyncData`, mirror its result in Pinia, or manually dehydrate it alongside the official module. Migrate every consumer of a feature when changing its owner.

```sh
bun add --exact @pinia/colada@1.4.8 @pinia/colada-nuxt@1.2.0
bun add --dev --exact @pinia/colada-devtools@2.0.1
```

Contextual replacement of the **existing** `modules` property in the public `nuxt.config.ts` above (do not add a second property or module registration):

```ts
modules: ['@pinia/nuxt', '@pinia/colada-nuxt'],
```

Complete optional root `colada.options.ts`:

```ts
import type { PiniaColadaOptions } from '@pinia/colada'

export default {
  queryOptions: { staleTime: 60_000 },
} satisfies PiniaColadaOptions
```

Complete replacement `app/pages/catalog/[id].vue`, requiring the core `CatalogItem` and **existing** `/api/catalog/[id]` handler. Remove that page's previous native `useFetch` implementation; open `/catalog/1` as before. This endpoint returns the two real bundled local records; it is not a substitute external backend.

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@pinia/colada'
import { VBtn } from 'vuetify/components/VBtn'
import type { CatalogItem } from '#shared/types/catalog'

const route = useRoute()
const id = computed(() => String(route.params.id))
const requestFetch = useRequestFetch()
const { state, asyncStatus, refetch } = useQuery({
  key: () => ['public', 'catalog', id.value],
  query: ({ signal }) => requestFetch<CatalogItem>(
    `/api/catalog/${encodeURIComponent(id.value)}`,
    { signal },
  ),
})
useSeoMeta({ title: 'Query catalogue' })
</script>

<template>
  <section :aria-busy="asyncStatus === 'loading'">
    <h1>Query catalogue</h1>
    <p v-if="state.status === 'pending'" role="status">Loading catalogue item</p>
    <p v-else-if="state.status === 'error'" role="alert">Unable to load this item.</p>
    <article v-else><h2>{{ state.data.title }}</h2></article>
    <VBtn :disabled="asyncStatus === 'loading'" @click="refetch()">Refresh</VBtn>
    <nav aria-label="Query catalogue items">
      <NuxtLink to="/catalog/1">Item 1</NuxtLink>
      <NuxtLink to="/catalog/2">Item 2</NuxtLink>
    </nav>
  </section>
</template>
```

`useQuery` registers server prefetch itself; no top-level `await` or extra manual prefetch is needed here. On client navigation the loading state may render immediately. Grouped `state` preserves discriminated-union narrowing; `asyncStatus` separately describes ongoing work, including background refresh. The reactive key includes the changing ID; the supplied abort signal reaches the transport. `useRequestFetch()` captures the current Nuxt SSR request, rather than assuming bare server `$fetch` forwards its cookies. A `public` prefix is a cache policy label, **not** a permission grant; this particular API returns identity-independent catalogue records.

Error ownership differs by lifecycle. Colada 1.4.8's `ssrCatchError` defaults to `false`; `onServerPrefetch` calls `refresh(true)` in that case, so an initial server query rejection propagates to Nuxt's document error handling. In this fixture, a direct `/catalog/3` request produces Nuxt's 404 document, not this page's inline alert. Client navigation from the loaded `/catalog/1` page to `/catalog/3` instead displays the inline `Unable to load this item.` alert without the stale article; refreshing that missing item preserves the visible error state. Do not conflate these mounted client failures with the initial SSR path or the core native `useFetch` example's different error policy. The button explicitly calls `refetch()` with no event argument: its default `throwOnError = false` resolves the resulting error state for this visible error UI. `refetch(true)`/`refresh(true)` instead propagate rejection and require an explicit caller error policy. Do not enable `ssrCatchError` merely to conceal an unexpected SSR failure. [Exact error option and return contracts](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts), [server-prefetch and refetch implementation](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs).

The module depends on the Pinia plugin, installs Colada once, serializes/hydrates its query cache, disables server GC timers and clears the server cache after render. Keep all instances request-owned; do not add manual plugin installation or serialization copied from a plain-Vue SSR recipe. Cache contents enter the HTML/payload and must be safe for the current recipient. [Exact SSR plugin](https://unpkg.com/@pinia/colada-nuxt@1.2.0/dist/runtime/plugin.js), [exact query/cache types](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts), [official Nuxt guide](https://pinia-colada.esm.dev/nuxt.html), [query design](pinia-colada.md).

The static topic title is intentional for this version profile. The module serializes the query cache and then clears it in `app:rendered`; reactive query state is not a durable post-render head snapshot. In the selected runtime, deriving the title directly from that state produced the fallback SSR title even though the body contained the item and hydration reused its payload without an initial browser API read. Do not claim item-specific SSR SEO from that reactive getter or patch the module to retain a shared server cache. This demo keeps `Query catalogue` consistent across SSR/hydration/navigation. If item-specific SSR metadata is required, prefer the core [native Nuxt data owner](nuxt.md#local-catalogue-example), which awaits the read before deriving its title, instead of adding a second native read around Colada. Verify final HTML metadata separately from body/payload success. [Exact module lifecycle](https://unpkg.com/@pinia/colada-nuxt@1.2.0/dist/runtime/plugin.js).

## Clerk module and authorization

This optional profile requires the **intended existing Clerk application**, its real publishable/secret keys, enabled sign-in methods, and an allowed application origin/redirect configuration. Do not create a replacement application or use invented keys to make a build look authenticated. Keep these prerequisites distinct from the credential-free public profile.

```sh
bun add --exact @clerk/nuxt@3.1.15 h3@1.15.11
```

Supply `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `NUXT_CLERK_SECRET_KEY` through the development environment/secret store. The former is intentionally public; the latter must never enter public runtime config, a Vue component, URL, log, static asset or payload. Production requires the same runtime environment names; a production server does not load the development `.env` automatically. [Official manual setup](https://clerk.com/docs/nuxt/getting-started/quickstart.md?manual=1), [exact module runtime keys](https://unpkg.com/@clerk/nuxt@3.1.15/dist/module.js), [server client configuration](https://unpkg.com/@clerk/nuxt@3.1.15/dist/runtime/server/clerkClient.js).

Contextual additions to the public `nuxt.config.ts`: put this guard after its import and before `defineNuxtConfig`, then add `@clerk/nuxt` once to its existing `modules` array. The selected reproducible profile deliberately refuses implicit keyless provisioning; missing configuration is a failure, not successful anonymous authentication.

```ts
if (!process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.NUXT_CLERK_SECRET_KEY) {
  throw new Error('Clerk requires NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY and NUXT_CLERK_SECRET_KEY')
}
```

Contextual properties inside that same `defineNuxtConfig` object, replacing the existing `modules` property. Omit the Colada entry only if that optional query track was not installed:

```ts
modules: ['@pinia/nuxt', '@pinia/colada-nuxt', '@clerk/nuxt'],
clerk: { signInUrl: '/sign-in', signInFallbackRedirectUrl: '/account' },
```

Also add these entries to its **existing** `routeRules` object; do not prerender, SWR/ISR-cache or CDN-share-cache these pages/APIs or their extracted payloads:

```ts
'/account': { headers: { 'cache-control': 'private, no-store' } },
'/sign-in/**': { headers: { 'cache-control': 'private, no-store' } },
'/api/private/**': { headers: { 'cache-control': 'private, no-store' } },
```

These route rules express the intended response policy, not a guarantee over every final response. The endpoint below sets `private, no-store` on its normal response, but Nuxt/Nitro's global error handling can replace headers (for example with `no-cache`) after a thrown error. Its generic 401 contains no private identity payload. Inspect the actual final headers/body on success, unsigned rejection, middleware failure and deployment error paths; configure the real error handler/CDN policy before relying on all auth responses being non-cacheable. Never put private details into an error merely because a route rule requests `no-store`.

The module installs its universal Vue plugin and default server middleware. **Do not** also add `server/middleware/clerk.ts` calling `clerkMiddleware()`. If the deployment requires a custom `authorizedParties` policy, explicitly replace that default using the SDK's `skipServerMiddleware: true` option and exactly one custom middleware with the actual trusted origins. Never trust a client-supplied origin list. [Exact options](https://unpkg.com/@clerk/nuxt@3.1.15/dist/module.d.ts), [middleware API](https://clerk.com/docs/nuxt/reference/clerk-middleware), [actual implementation](https://unpkg.com/@clerk/nuxt@3.1.15/dist/runtime/server/clerkMiddleware.js).

### Route middleware is navigation policy

Complete `app/middleware/auth.ts`:

```ts
import { useAuth } from '@clerk/nuxt/composables'

export default defineNuxtRouteMiddleware(() => {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded.value) {
    return abortNavigation(createError({
      statusCode: 503,
      statusMessage: 'Authentication is not ready',
    }))
  }
  if (!isSignedIn.value) return navigateTo('/sign-in')
})
```

Unknown/loading is not signed out: this deliberately fails closed rather than entering protected UI or inventing a session. A product can present an explicit public loading/error shell; do not grant access while waiting. Server and client navigation may both execute middleware. A rejected operation/loading failure does not become an authenticated fallback. [Official route-middleware guidance](https://clerk.com/docs/nuxt/guides/secure/protect-content), [actual exported composables](https://unpkg.com/@clerk/nuxt@3.1.15/dist/runtime/composables/index.d.ts).

Complete `app/pages/sign-in/[[...sign-in]].vue`. The optional catch-all handles Clerk's nested sign-in steps; `with-sign-up` lets its prebuilt flow own registration too. Return targets are fixed application paths, not an unvalidated query parameter.

```vue
<script setup lang="ts">
import { SignIn } from '@clerk/nuxt/components'
</script>

<template>
  <section>
    <h1>Sign in</h1>
    <SignIn routing="path" path="/sign-in" fallback-redirect-url="/account" with-sign-up />
  </section>
</template>
```

Complete `app/pages/account.vue`:

```vue
<script setup lang="ts">
import { useAuth } from '@clerk/nuxt/composables'
import { UserButton } from '@clerk/nuxt/components'

definePageMeta({ middleware: 'auth' })
const { isLoaded, isSignedIn, userId } = useAuth()
</script>

<template>
  <section>
    <h1>Account</h1>
    <p v-if="!isLoaded" role="status">Loading authentication</p>
    <template v-else-if="isSignedIn">
      <p>Signed in as {{ userId }}</p>
      <UserButton />
      <a href="/api/private/session">Read server-verified session identity</a>
    </template>
    <p v-else>Sign in to access your account.</p>
  </section>
</template>
```

These UI components/composables are exported by the selected module; use the prebuilt flow rather than an incomplete password-only implementation. Clerk owns sign-out errors/session tasks and its user menu; the account page does not create a parallel token store. [Exact component exports](https://unpkg.com/@clerk/nuxt@3.1.15/dist/runtime/components/index.d.ts), [sign-in prop declarations](https://unpkg.com/@clerk/nuxt@3.1.15/dist/runtime/components/uiComponents.d.ts).

### Server authorization and event compatibility

Complete `server/api/private/session.get.ts` for this **Nitro 2/h3 v1** profile:

```ts
import { createError, defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const auth = typeof event.context.auth === 'function' ? event.context.auth() : undefined
  if (!auth?.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return { userId: auth.userId, sessionId: auth.sessionId, orgId: auth.orgId ?? null }
})
```

`event.context.auth` is a **function**. The default middleware verifies the request and installs it; no context function or no accepted signed-in session produces 401 here. The SDK defaults to session-token auth for this call, not arbitrary machine-token acceptance. Do not copy stale declaration comments using `event.context.auth.userId`. This endpoint returns only the caller's verified identity; when adding records/tenant operations, independently authorize the requested resource and active organization on **every** server request, returning 403/404 as appropriate. A URL/key containing an organization ID is not authority. Never accept a client `userId` in place of the verified server identity. [Exact authentication function type](https://unpkg.com/@clerk/nuxt@3.1.15/dist/runtime/server/types.d.ts), [middleware implementation](https://unpkg.com/@clerk/nuxt@3.1.15/dist/runtime/server/clerkMiddleware.js).

Nuxt 4.6's portable `defineEventHandler` from `nuxt/server` passes `RequestEvent`; Clerk 3.1.15's `clerkMiddleware`/`clerkClient` declarations use **h3 v1 `H3Event`** and the module augments `h3.H3EventContext`. Therefore the Clerk-specific endpoint above deliberately imports its handler and helpers together from `h3`; the independent core catalogue keeps `nuxt/server`. Do not pass a portable event into `clerkClient`, cast it to `H3Event`, mix portable helpers with an h3 event or assume that upgrading to another server builder ports this SDK. The published `clerkMiddleware.d.ts` itself contains a package-internal pnpm h3 path: do not reproduce that path in application imports. Keep generated Nuxt/module declarations and report a genuine upstream declaration-resolution error rather than masking it with an invented event augmentation. [Exact middleware declaration](https://unpkg.com/@clerk/nuxt@3.1.15/dist/runtime/server/clerkMiddleware.d.ts), [Nuxt server imports](https://nuxt.com/docs/4.x/guide/going-further/server-imports), [server compatibility](https://nuxt.com/docs/4.x/guide/modules/server-compatibility).

## Identity transitions and private caches

Clerk owns reactive user/session/organization state; do not duplicate it in Pinia or treat hydrated profile data as proof. The public Colada page above intentionally contains no private data, and the account page does not cache its server identity response. If introducing a private query, make that feature choose **either** native Nuxt data **or** Colada, never both. Include loaded/accepted identity, session, active organization and every result-changing input in its key; disable work until identity is ready. Forward request credentials only to the intended API and authorize there. A client key isolates display caches, not backend access.

On sign-out, user/session change or organization switch, immediately stop rendering the old identity's data, cancel old reads, remove their entries and reset identity-bound drafts/stores before enabling new work. Pass cancellation signals to transport and reject stale mutation results before committing them. Do not retain previous private data as placeholder content during the transition. Do not indiscriminately persist/hydrate the entire private cache. For native Nuxt private data, use a consistent private-key namespace and `clearNuxtData` (which clears/aborts pending entries), plus the same identity partitioning; the core [data lifecycle](nuxt.md#data-payload-and-cancellation) owns that alternative.

Complete contextual `app/components/PrivateCacheBoundary.vue`, **only when both Clerk and Colada are selected and private Colada consumers are introduced**. Mount it once around all private consumers; their `useQuery` keys must start with `['private', sessionId, userId, orgId, ...]`, and their `enabled` predicate must require a loaded signed-in identity. It synchronously gates the subtree and cancels old work, waits for consumers to unmount, removes inactive old entries, then mounts the new identity's subtree. Colada forbids removing active entries; do not remove them before teardown. Public cache entries are untouched. Reset any actual identity-bound Pinia draft store in the same transition owner; the guide's public `preferences` store contains no such draft.

```vue
<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue'
import { useAuth } from '@clerk/nuxt/composables'
import { useQueryCache } from '@pinia/colada'

const { isLoaded, isSignedIn, sessionId, userId, orgId } = useAuth()
const cache = useQueryCache()
const transitioning = shallowRef(false)
let transition = 0
const identity = computed(() => JSON.stringify([
  isLoaded.value, isSignedIn.value, sessionId.value, userId.value, orgId.value,
]))
watch(identity, async () => {
  const current = ++transition
  transitioning.value = true
  const oldEntries = cache.getEntries({ key: ['private'] })
  cache.cancelQueries({ key: ['private'] })
  await nextTick()
  for (const entry of oldEntries) {
    if (!entry.active) cache.remove(entry)
  }
  if (current === transition) transitioning.value = false
}, { flush: 'sync' })
</script>

<template>
  <div v-if="!transitioning && isLoaded && isSignedIn" :key="identity"><slot /></div>
  <p v-else-if="transitioning || !isLoaded" role="status">Loading authentication</p>
  <p v-else>Sign in to view private data.</p>
</template>
```

Mount it before the private subtree, not separately in each query consumer. Its watcher is component-owned and disposed on unmount; it does not install another cache. Mutation authorization remains server-owned even after a browser cancellation. [Actual query-cache cancellation/removal APIs](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts), [Clerk computed auth contract](https://unpkg.com/@clerk/vue@2.5.13/dist/composables/useAuth.d.ts), [identity design](auth.md#identity-teardown-and-pinia-integration).

## Verification boundaries

Verify the public profile separately from the credential-required Clerk profile. For the public app, regenerate Nuxt contexts, typecheck/build, request SSR and both API records, navigate between IDs, refresh/error states, mutate Pinia then navigate back, and check clean browser hydration plus the single app/main landmark and emitted Vuetify theme styles. Request isolation and accessible controls are runtime obligations, not consequences of compatible peers.

For Clerk, verify missing-key configuration rejection without inventing credentials. A local direct request to the endpoint with no authenticated context must return 401 even without a page guard; that proves this handler's fail-closed path, **not** that the provider middleware/session verification ran successfully. With real configured keys, separately verify actual unsigned 401, signed-in SSR and client navigation, sign-out, account/organization transitions, forbidden resources and cache isolation. A build with SDK declarations is not a live sign-in pass. No real Clerk application credentials are available in the authoring environment; provider UI, token verification against that application, and authenticated tenant-transition results must remain explicitly unverified until those prerequisites are supplied. Never label the credential-free public fixture a fully verified Clerk application.
