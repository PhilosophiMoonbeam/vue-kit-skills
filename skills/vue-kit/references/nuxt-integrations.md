# Selected Nuxt integrations

Read after [Nuxt](nuxt.md) when adding Vuetify, domain state, or an optional query cache. These are selected self-hostable library integration contracts, not blanket support for every Nuxt module or authentication-service setup. Nuxt remains the only application/router/SSR owner; do not copy the plain-Vue bootstrap from the linked SPA guides.

## Selected versions and ownership

Use **Bun 1.4.3** for a new application's package management and Node **24.15.0** for its Nuxt server/tooling, with Nuxt **4.6.2**, Vue **3.5.44**, generated TypeScript contexts and the lockfile from [the core catalogue](nuxt.md#local-catalogue-example). Preserve an existing application's package manager and authoritative lockfile instead of creating a second one. Preserve the bundled SPA's separate versions; this is a Nuxt application profile.

| Concern | Selected packages | Boundary |
| --- | --- | --- |
| Material UI | `vuetify@4.3.0` | Stable manual universal plugin below; explicit component imports, SSR enabled |
| Domain/UI state | `pinia@4.1.0`, `@pinia/nuxt@1.0.3`, `@vue/devtools-api@8.2.1` | Module creates the app/request instance and transfers its state |
| Optional server-state cache | `@pinia/colada@1.4.8`, `@pinia/colada-nuxt@1.2.0`, `@pinia/colada-devtools@2.0.1` | Official module, after Pinia; one query owner per feature |

Pinia's Vue peer is `^3.5.11`; its **required** devtools peer is `@vue/devtools-api ^8.2.1` (TypeScript `>=5.6.0` is optional). `@pinia/nuxt@1.0.3` requires Pinia `^4.1.0`. Colada requires Vue `^3.5.41` and admits Pinia `^2.2.6 || ^3.0.0 || ^4.0.2`; its Nuxt module requires Colada `>=1.4.5`. The module's `@pinia/colada-devtools ^2.0.0` peer is **optional** in both its published manifest and registry metadata; omit it when no panel is wanted. The devtools package's Vite/Devframe integration peers are optional too. The module only registers an installed panel with the Vite builder and compatible Nuxt DevTools 4 during development. These peer ranges admit the selected versions; they are not runtime proof. [Pinia metadata](https://registry.npmjs.org/pinia/4.1.0), [Pinia module metadata](https://registry.npmjs.org/@pinia/nuxt/1.0.3), [Colada metadata](https://registry.npmjs.org/@pinia/colada/1.4.8), [Colada module manifest](https://unpkg.com/@pinia/colada-nuxt@1.2.0/package.json), [registry metadata](https://registry.npmjs.org/@pinia/colada-nuxt/1.2.0), [devtools metadata](https://registry.npmjs.org/@pinia/colada-devtools/2.0.1), [module implementation](https://unpkg.com/@pinia/colada-nuxt@1.2.0/dist/module.mjs).

## Stable manual Vuetify integration

Start with the complete core catalogue files. Install the stable UI and state prerequisites once:

```sh
bun add --exact vuetify@4.3.0 pinia@4.1.0 @pinia/nuxt@1.0.3 @vue/devtools-api@8.2.1
```

Replace the core `nuxt.config.ts` with this complete public profile. The Colada section below adds its module only if chosen.

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

This is application memory with SSR payload transfer, not durable persistence. Initial `false` must be isolated across requests; a browser mutation persists across in-app navigation but not a new unpersisted session. Never persist session proof/tokens or mirror remote query records here. Use [state](state.md) for store design, not its SPA installer.

## Optional Colada query owner

Prefer native Nuxt data for a simple page read. Select Colada when its shared query lifecycle/invalidation is needed; retain an incumbent query owner unless a migration is actually requested. This optional alternative **replaces** the core catalogue page's native data owner. Do not keep both implementations mounted, wrap `useQuery` in `useFetch`/`useAsyncData`, mirror its result in Pinia, or manually dehydrate it alongside the official module. Migrate every consumer of a feature when changing its owner.

```sh
bun add --exact @pinia/colada@1.4.8 @pinia/colada-nuxt@1.2.0
# Optional development panel; not required by the query module:
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

## Identity transitions and private caches

The application's real session mechanism owns user/session/organization readiness; do not duplicate it in Pinia or treat hydrated profile data as proof. The public Colada page above intentionally contains no private data. If introducing a private query, make that feature choose **either** native Nuxt data **or** Colada, never both. Include accepted identity, session, active organization and every result-changing input in its key; disable work until identity is ready. Forward request credentials only to the intended API and authorize there. A client key isolates display caches, not backend access.

On sign-out, user/session change or organization switch, immediately stop rendering the old identity's data, cancel old reads, remove their entries and reset identity-bound drafts/stores before enabling new work. Pass cancellation signals to transport and reject stale mutation results before committing them. Do not retain previous private data as placeholder content during the transition. Do not indiscriminately persist/hydrate the entire private cache. For native Nuxt private data, use a consistent private-key namespace, the same identity partitioning and each owner's returned `clear()` (or an explicitly owned transport controller), then `clearNuxtData` for namespace invalidation. In 4.6.2, `clearNuxtData` alone deletes pending-promise bookkeeping but does **not** abort the transport; the core [data lifecycle](nuxt.md#data-payload-and-cancellation) owns that alternative.

The following complete frontend components apply **only when private Colada consumers are introduced into an application with an existing, implemented session boundary**. They do not install authentication or implement a private endpoint. The application supplies a stable `SessionIdentitySource` object containing a readonly reactive session ref, and a real `PrivateSessionReader`. The source must replace its snapshot synchronously on every invalidation, including logout, permission loss and tenant changes; `revision` must increase even for A → B → A. Use loading/error rather than retaining a formerly ready identity during revalidation. The reader must authenticate the current server request, return only that caller's server-verified identity, runtime-validate its response and reject unauthorized access. It must forward the signal and use the real request-local credentials during SSR. A browser-supplied identity is never server proof.

The boundary owns an immutable accepted identity and a monotonically increasing epoch; children never derive a changing private key directly from a live session. Its synchronous gate invalidates old callbacks before the next render. It cancels reads, waits for child teardown, re-enumerates/removes inactive private entries, then accepts the latest identity. An active entry after teardown fails closed. The source is a stable holder around the ref rather than a snapshot prop, so invalidation is observable immediately without waiting for parent-to-child prop rendering.

For real private pages/APIs and session responses, prohibit prerender/SWR/ISR/shared CDN caching and set `Cache-Control: private, no-store` on success and failure at the actual response owner. Route rules alone do not prove final error-handler/CDN behavior. Inspect final headers/bodies and keep errors free of private details. Nuxt navigation middleware remains a UX gate; the reader's server must verify credentials and authorize each operation independently.

Complete `shared/types/private-identity.ts`. These application-owned interfaces are cache/display contracts, not an authentication implementation or session proof:

```ts
import type { Ref } from 'vue'

export interface VerifiedSession {
  readonly sessionId: string
  readonly userId: string
  readonly orgId: string | null
}

export type SessionSnapshot =
  | { readonly revision: number; readonly status: 'loading' | 'signed-out' | 'error' }
  | { readonly revision: number; readonly status: 'ready'; readonly identity: VerifiedSession }

export interface SessionIdentitySource {
  readonly current: Readonly<Ref<SessionSnapshot>>
}

export type PrivateSessionReader = (signal: AbortSignal) => Promise<VerifiedSession>

export interface PrivateIdentity extends VerifiedSession {
  readonly epoch: number
}
```

Complete `app/components/PrivateCacheBoundary.vue`:

```vue
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onUnmounted, shallowRef, watch } from 'vue'
import { useQueryCache } from '@pinia/colada'
import type { PrivateIdentity, SessionIdentitySource } from '#shared/types/private-identity'

const props = defineProps<{ session: SessionIdentitySource }>()
const session = computed(() => props.session.current.value)
const cache = useQueryCache()
const transitioning = shallowRef(false)
const blocked = shallowRef(false)
let epoch = 0
let disposed = false
const identityKey = computed(() => {
  const current = session.value
  return JSON.stringify(current.status === 'ready'
    ? [current.revision, current.status, current.identity.sessionId,
        current.identity.userId, current.identity.orgId]
    : [current.revision, current.status])
})
let acceptedIdentityKey = identityKey.value
function captureIdentity(version: number): PrivateIdentity | null {
  const current = session.value
  return current.status === 'ready'
    ? Object.freeze({ ...current.identity, epoch: version })
    : null
}
const accepted = shallowRef<PrivateIdentity | null>(captureIdentity(epoch))
function isCurrent(identity: PrivateIdentity) {
  return !disposed && accepted.value === identity && acceptedIdentityKey === identityKey.value
}
function purgePrivateEntries() {
  let complete = true
  for (const entry of cache.getEntries({ key: ['private'] })) {
    cache.cancel(entry)
    if (entry.active) complete = false
    else cache.remove(entry)
  }
  return complete
}
watch(identityKey, async () => {
  const current = ++epoch
  accepted.value = null
  transitioning.value = true
  blocked.value = false
  cache.cancelQueries({ key: ['private'] })
  await nextTick()
  if (disposed || current !== epoch) return
  if (!purgePrivateEntries()) {
    blocked.value = true
    transitioning.value = false
    return
  }
  acceptedIdentityKey = identityKey.value
  accepted.value = captureIdentity(current)
  transitioning.value = false
}, { flush: 'sync' })
onBeforeUnmount(() => {
  disposed = true
  ++epoch
  accepted.value = null
  cache.cancelQueries({ key: ['private'] })
})
onUnmounted(() => { purgePrivateEntries() })
</script>

<template>
  <div v-if="accepted" :key="accepted.epoch">
    <slot v-bind="{ identity: accepted, isCurrent }" />
  </div>
  <p v-else-if="blocked" role="alert">Private data could not be reset.</p>
  <p v-else-if="transitioning || session.status === 'loading'" role="status">Loading session</p>
  <p v-else-if="session.status === 'error'" role="alert">Session is unavailable.</p>
  <p v-else>Sign in to view private data.</p>
</template>
```

Complete `app/components/PrivateSession.vue`. Its fixed snapshot key starts with `['private', sessionId, userId, orgId, epoch, ...]`. The guard also covers imperative `refetch()`, which is not disabled by `enabled: false` in Colada. The application reader's response must still belong to the captured identity before entering its cache:

```vue
<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import type { PrivateIdentity, PrivateSessionReader } from '#shared/types/private-identity'

const props = defineProps<{
  identity: PrivateIdentity
  isCurrent: (identity: PrivateIdentity) => boolean
  readSession: PrivateSessionReader
}>()
const identity = props.identity
const { state, asyncStatus, refetch } = useQuery({
  key: ['private', identity.sessionId, identity.userId, identity.orgId, identity.epoch, 'session'],
  enabled: () => props.isCurrent(identity),
  query: async ({ signal }) => {
    if (!props.isCurrent(identity)) throw new Error('Private session changed')
    const result = await props.readSession(signal)
    if (!props.isCurrent(identity) || result.userId !== identity.userId
      || result.sessionId !== identity.sessionId || result.orgId !== identity.orgId) {
      throw new Error('Private session changed')
    }
    return result
  },
})
</script>

<template>
  <section :aria-busy="asyncStatus === 'loading'">
    <h2>Server session</h2>
    <p v-if="state.status === 'pending'" role="status">Loading private session</p>
    <p v-else-if="state.status === 'error'" role="alert">Unable to load this session.</p>
    <p v-else>Server-verified user: {{ state.data.userId }}</p>
    <button type="button" :disabled="asyncStatus === 'loading'" @click="refetch()">Refresh session</button>
  </section>
</template>
```

Complete `app/components/PrivateAccount.vue`, an application integration component rather than a replacement Nuxt page or invented login flow. Its host supplies the actual session source and reader under the contract above. Protect its real route/API at the server and response-cache boundaries; this component alone cannot do so.

```vue
<script setup lang="ts">
import type { PrivateSessionReader, SessionIdentitySource } from '#shared/types/private-identity'
import PrivateCacheBoundary from '~/components/PrivateCacheBoundary.vue'
import PrivateSession from '~/components/PrivateSession.vue'

defineProps<{ session: SessionIdentitySource; readSession: PrivateSessionReader }>()
</script>

<template>
  <section>
    <h1>Account</h1>
    <PrivateCacheBoundary :session="session" v-slot="{ identity, isCurrent }">
      <PrivateSession :identity="identity" :is-current="isCurrent" :read-session="readSession" />
    </PrivateCacheBoundary>
  </section>
</template>
```

Mount one boundary around **all** private consumers; public entries remain untouched. Private consumers, including `defineQuery` subscribers, must be subtree-owned: no retained store/effect scope outside it, `KeepAlive`, or leave transition that keeps them active after the teardown tick. Unmount also cancels/removes the departing subtree's cache. The watcher is component-owned; epoch/disposal checks prevent an awaiting callback from reopening an unmounted or superseded subtree. Reset private drafts in the transition owner before publishing the next ready session; the supplied `preferences` store contains none. Apply `isCurrent(capturedIdentity)` before committing mutation results too; cancellation cannot undo a server write. [Exact cache lifecycle](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs), [cache APIs](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts), [identity design](auth.md#identity-teardown-and-pinia-integration).

## Verification boundaries

For the public app, regenerate Nuxt contexts, typecheck/build, request SSR and both API records, navigate between IDs, refresh/error states, mutate Pinia then navigate back, and check clean browser hydration plus the single app/main landmark and emitted Vuetify theme styles. Request isolation and accessible controls are runtime obligations, not consequences of compatible peers.

For the contextual private boundary, use the real application's session mechanism and reader to verify unsigned server rejection, signed-in SSR/client navigation, sign-out, account/session/organization A → B → A transitions with pending reads, late mutation suppression, public-cache retention and private-cache teardown. Verify that an intentionally retained private consumer prevents acceptance of the next identity. Compiler success cannot prove server session verification or tenant authorization. These contracts require no hosted-service account or vendor SDK; no live authentication result is claimed.
