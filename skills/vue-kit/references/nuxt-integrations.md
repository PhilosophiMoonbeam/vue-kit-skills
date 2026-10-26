# Selected Nuxt integrations

Read after [Nuxt](nuxt.md) when adding Vuetify, domain state, an optional query cache, or an optional TresJS scene. These are selected self-hostable library integration contracts, not blanket support for every Nuxt module or authentication-service setup. Nuxt remains the only application/router/SSR owner; do not copy the plain-Vue bootstrap from the linked SPA guides.

OpenVue's separate official-module configuration, generated styles and SSR boundaries belong to [OpenVue setup](openvue-setup.md#official-nuxt-module-complete-separate-application), reached through [OpenVue selection](openvue.md). Do not copy this manual Vuetify integration into that profile or treat either profile as blanket certification of other modules.

## Selected versions and ownership

Use **Bun 1.4.3** for a new application's package management and Node **24.15.0** for its Nuxt server/tooling, with Nuxt **4.6.2**, Vue **3.5.44**, generated TypeScript contexts and the lockfile from [the core catalogue](nuxt.md#local-catalogue-example). Preserve an existing application's package manager and authoritative lockfile instead of creating a second one. Preserve the bundled SPA's separate versions; this is a Nuxt application profile.

| Concern | Selected packages | Boundary |
| --- | --- | --- |
| Material UI | `vuetify@4.3.0` | Stable manual universal plugin below; explicit component imports, SSR enabled |
| Domain/UI state | `pinia@4.1.0`, `@pinia/nuxt@1.0.3`, `@vue/devtools-api@8.2.1` | Module creates the app/request instance and transfers its state |
| Optional server-state cache | `@pinia/colada@1.4.8`, `@pinia/colada-nuxt@1.2.0`, `@pinia/colada-devtools@2.0.1` | Official module, after Pinia; one query owner per feature |
| Optional browser 3D | `@tresjs/nuxt@5.8.0`, `@tresjs/core@5.10.0`, optionally `@tresjs/cientos@5.10.0`, `three@0.186.1` | Separate latest-release profile below; app-wide WebGPU entry selection, client canvas, SSR DOM alternative |

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
import type { HTMLAttributes } from 'vue'
import { VMain } from 'vuetify/components/VMain'

const mainAttrs: Pick<HTMLAttributes, 'id' | 'tabindex' | 'class' | 'style'> = {
  id: 'main-content',
  tabindex: -1,
}
</script>

<template>
  <div class="catalogue-shell">
    <a href="#main-content">Skip to content</a>
    <nav aria-label="Primary">
      <NuxtLink to="/">Home</NuxtLink>
      <NuxtLink to="/catalog/1">Catalogue</NuxtLink>
      <NuxtLink to="/preferences">Preferences</NuxtLink>
    </nav>
    <VMain v-bind="mainAttrs"><slot /></VMain>
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

These complete Nuxt consumers use the [checked native fallthrough bags](vuetify-setup.md#strict-template-checking-and-native-fallthrough) for Vuetify 4.3's undeclared HTML attributes/listeners. Keep the bags narrow, including optional shared `class`/`style` for strict component compatibility; keep declared Vuetify props such as `disabled` outside them. Static layout attributes and the refresh listener use stable bags. Reactive attributes use a computed snapshot: a changed boolean produces new props while Pinia's bound action stays stable. Do not reuse a plain bag with reactive getters: previous and next props can be the same object, or both getters can read the new value during comparison, leaving DOM attributes stale. [Vue 3.5.44 prop comparison](https://unpkg.com/@vue/runtime-core@3.5.44/dist/runtime-core.esm-bundler.js), [tagged VMain root](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VMain/VMain.tsx), [tagged VBtn root/emits](https://github.com/vuetifyjs/vuetify/blob/v4.3.0/packages/vuetify/src/components/VBtn/VBtn.tsx).

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
import { computed } from 'vue'
import type { ButtonHTMLAttributes } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { usePreferencesStore } from '~/stores/preferences'

const preferences = usePreferencesStore()
const { compact } = storeToRefs(preferences)
const compactAttrs = computed<Pick<ButtonHTMLAttributes, 'aria-pressed' | 'onClick' | 'class' | 'style'>>(() => ({
  'aria-pressed': compact.value,
  onClick: preferences.toggleCompact,
}))
</script>

<template>
  <section>
    <h1>View preferences</h1>
    <p>Compact view: {{ compact ? 'on' : 'off' }}</p>
    <VBtn v-bind="compactAttrs">
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
import { computed, type ButtonHTMLAttributes } from 'vue'
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
function refreshCatalog() {
  if (asyncStatus.value !== 'loading') void refetch()
}
const refreshAttrs: Pick<ButtonHTMLAttributes, 'onClick' | 'class' | 'style'> = {
  onClick: refreshCatalog,
}
useSeoMeta({ title: 'Query catalogue' })
</script>

<template>
  <section :aria-busy="asyncStatus === 'loading'">
    <h1>Query catalogue</h1>
    <p v-if="state.status === 'pending'" role="status">Loading catalogue item</p>
    <p v-else-if="state.status === 'error'" role="alert">Unable to load this item.</p>
    <article v-else><h2>{{ state.data.title }}</h2></article>
    <VBtn v-bind="refreshAttrs" :disabled="asyncStatus === 'loading'">Refresh</VBtn>
    <nav aria-label="Query catalogue items">
      <NuxtLink to="/catalog/1">Item 1</NuxtLink>
      <NuxtLink to="/catalog/2">Item 2</NuxtLink>
    </nav>
  </section>
</template>
```

`useQuery` registers server prefetch itself; no top-level `await` or extra manual prefetch is needed here. On client navigation the loading state may render immediately. Grouped `state` preserves discriminated-union narrowing; `asyncStatus` separately describes ongoing work, including background refresh. The reactive key includes the changing ID; the supplied abort signal reaches the transport. `useRequestFetch()` captures the current Nuxt SSR request, rather than assuming bare server `$fetch` forwards its cookies. A `public` prefix is a cache policy label, **not** a permission grant; this particular API returns identity-independent catalogue records.

Error ownership differs by lifecycle. Colada 1.4.8's `ssrCatchError` defaults to `false`; `onServerPrefetch` calls `refresh(true)` in that case, so an initial server query rejection propagates to Nuxt's document error handling rather than this page's inline alert. An earlier fixture observation reported a 404 document for direct `/catalog/3` and an inline alert without the stale article when navigating there from `/catalog/1`; those are historical observations, not a fresh generated-Nuxt result. Verify the final document status/error policy and mounted client refresh behavior separately. Do not conflate mounted client failures with the initial SSR path or the core native `useFetch` example's different error policy. The button explicitly calls `refetch()` with no event argument: its default falsy `throwOnError` resolves the resulting error state for this visible error UI. `refetch(true)`/`refresh(true)` instead propagate rejection and require an explicit caller error policy. Do not enable `ssrCatchError` merely to conceal an unexpected SSR failure. [Exact error option and return contracts](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts), [server-prefetch and refetch implementation](https://unpkg.com/@pinia/colada@1.4.8/dist/index.mjs).

The module depends on the Pinia plugin, installs Colada once, serializes/hydrates its query cache, disables server GC timers and clears the server cache after render. Keep all instances request-owned; do not add manual plugin installation or serialization copied from a plain-Vue SSR recipe. Cache contents enter the HTML/payload and must be safe for the current recipient. [Exact SSR plugin](https://unpkg.com/@pinia/colada-nuxt@1.2.0/dist/runtime/plugin.js), [exact query/cache types](https://unpkg.com/@pinia/colada@1.4.8/dist/index.d.mts), [official Nuxt guide](https://pinia-colada.esm.dev/nuxt.html), [query design](pinia-colada.md).

The static topic title is intentional for this version profile. The module serializes the query cache and then clears it in `app:rendered`; reactive query state is not a durable post-render head snapshot. An earlier fixture observation reported a fallback SSR title when deriving it directly from that state, even though the body contained the item and hydration reused its payload without an initial browser API read. That observation is historical, not a fresh run of this profile. Do not claim item-specific SSR SEO from that reactive getter or patch the module to retain a shared server cache. This demo keeps `Query catalogue` as its fixed title across SSR/hydration/navigation. If item-specific SSR metadata is required, prefer the core [native Nuxt data owner](nuxt.md#local-catalogue-example), which awaits the read before deriving its title, instead of adding a second native read around Colada. Verify final HTML metadata separately from body/payload success. [Exact module lifecycle](https://unpkg.com/@pinia/colada-nuxt@1.2.0/dist/runtime/plugin.js).

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

**Observed local contract exercise, 2026-10-21:** the unchanged three private components and shared interfaces also passed generated strict Nuxt 4.6.2/Vue 3.5.44 contexts and production SSR/browser execution with the official Pinia/Colada modules. A deliberately local allowlisted-cookie reader—not a production authentication service—returned caller-specific A/B identities; 24 concurrent A/B/invalid-cookie documents remained isolated with `private, no-store`, and an unsigned reader request returned a detail-free 401 with the same policy. Hydration reused the private query payload without an initial browser API read. Browser checks exercised sign-out, user/session/organization replacement, pending-read A → B → A cancellation, private eviction with public retention, reader-identity mismatch rejection, retained-consumer fail-closed behavior, client navigation and SSR refresh. These observations establish the displayed/cache contracts only: the host still owns real session verification, authorization, mutation guards and production response policy; no provider authentication or live tenant-authorization result is claimed.

This dated paragraph preserves the original local observation, not a fresh execution or proof that every later consumer is unchanged. Its retained [verification record](../assets/verification.json) identifies the private-cache fixture and its limits; production session verification and final response policy still require the host's own evidence.

## Optional TresJS module: Nuxt 4 and the 5.8.0 release

This is a **separate optional application profile**, not a dependency migration of the bundled Tres 5.9.3/Three 0.186.1 SPA or its retained device receipts. Use this page's Nuxt 4.6.2/Vue 3.5.44/Node 24.15.0 host profile. Nuxt module **5.8.0** depends on core **5.10.0** exactly, accepts `nuxt >=3.16.0` in module metadata and peers on `three >=0.133`. Cientos **5.10.0** peers on core `^5.9.1`, Vue `>=3.5.17` and Three `>=0.133`. Those broad lower bounds do not prove that old Three releases provide today's `three/webgpu`/TSL APIs. Keep Three and its matching declarations aligned; the example selects Three 0.186.1 and `@types/three@0.186.0`. [Module manifest](https://registry.npmjs.org/@tresjs/nuxt/5.8.0), [Cientos manifest](https://registry.npmjs.org/@tresjs/cientos/5.10.0), [core manifest](https://registry.npmjs.org/@tresjs/core/5.10.0).

Install in the **Nuxt application**, preserving its package manager and lockfile:

```sh
bun add --exact @tresjs/nuxt@5.8.0 @tresjs/core@5.10.0 @tresjs/cientos@5.10.0 three@0.186.1
bun add -D --exact @types/three@0.186.0
```

Merge these fields into the existing `nuxt.config.ts`; retain its other modules, CSS, runtime config, route policy and Nitro ownership:

```ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: ['@tresjs/nuxt'], // append alongside existing modules
  tres: {
    renderer: 'webgpu',
    modules: ['@tresjs/cientos'],
    devtools: false,
    glsl: false,
  },
})
```

### Renderer, catalogue and generated imports

`renderer` is the module's **app-wide auto-import target**, not a per-page GPU capability check. Its default is `'webgl'`; explicitly choose `'webgpu'` for this skill's WebGPURenderer-first policy. In 5.8.0 this selects `@tresjs/core/webgpu`, the corresponding Nuxt client wrapper and each installed ecosystem package's declared `./webgpu` entry. Core's WebGPU entry registers `three/webgpu` constructors in the Tres catalogue and defaults its canvas to **WebGPURenderer**. Three can select its native WebGPU backend or WebGL2 fallback; both must support the **whole scene**. Falling back inside WebGPURenderer does not make legacy GLSL helpers or an EffectComposer pipeline compatible. Explicit `'webgl'` selects legacy **WebGLRenderer** and root package entries; use that only for a deliberately incompatible pipeline, not as a hidden failure fallback. [Published module](https://unpkg.com/@tresjs/nuxt@5.8.0/dist/module.mjs), [WebGPU canvas/catalogue](https://unpkg.com/@tresjs/core@5.10.0/dist/webgpu.js).

The exact module setup:

- Adds `@tresjs` packages to Nuxt's transpilation list, dedupes `three` through Vite defaults and adds optimization defaults for `three`, `three/webgpu`, `three/tsl` in WebGPU mode. Keep one resolved Three identity; this is not permission to install mismatched nested Three versions.
- Reads the selected core entry's actual exports and auto-imports names beginning with `use`. It separately exposes `extend` as **`extendTres`**, plus the `TresObject` type, and adds the selected core entry to generated type references. For explicit imports in this profile use `import { useTres, useLoop, extend } from '@tresjs/core/webgpu'`; do not mix in a root-entry canvas accidentally.
- Registers `TresCanvas` with separate client/server files. Three primitives such as `TresMesh` are **catalogue intrinsics**, not hundreds of Nuxt component imports. Add an extra constructor with `extendTres({ YourConstructor })` (or explicit `extend`) in client scene setup before using `TresYourConstructor`. Do not register a second Vue app/plugin.
- Scans direct `dependencies` and `devDependencies` with `@tresjs/` names in the app and, if present, **one immediate parent** package manifest; unions those with `tres.modules`. This is not recursive workspace discovery. `tres.modules` supplies package IDs to inspect, **not** Nuxt modules to install or options objects. Packages must already resolve. Missing packages/builds can be skipped or warned about; explicit installation and generated-file inspection remain necessary.
- Registers uppercase ecosystem exports as Nuxt components and other exports as imports. With Cientos installed, `<OrbitControls />`, `useGLTF`, etc. come from `@tresjs/cientos/webgpu` in this profile. Explicit equivalents must use that same entry: `import { OrbitControls, useGLTF } from '@tresjs/cientos/webgpu'`. Install/import `@tresjs/cientos/styles.css` only for a helper that actually needs its DOM styling.
- For packages with `/webgpu`, compares uppercase root exports with WebGPU exports and writes `.nuxt/tres/webgpu-stubs.mjs` for missing components. Mounting one throws a named error explaining that the helper is not available for WebGPU; it is **not silently omitted or ported**. Lowercase/composable exports absent from `/webgpu` are not stubbed. `@tresjs/post-processing` is explicitly skipped with a warning in WebGPU mode; manual imports do not bypass its renderer limitation. Other packages without `/webgpu` can still use their root entry, so successful auto-import does not certify renderer safety. [Stub source](https://unpkg.com/@tresjs/nuxt@5.8.0/dist/runtime/webgpuStub.js), [Cientos WebGPU exports](https://unpkg.com/@tresjs/cientos@5.10.0/dist/webgpu.js).

The module **assigns**, rather than composes, `vue.compilerOptions.isCustomElement` to Tres's predicate. That predicate recognizes `Tres[A-Z]…`, `tres-…` and `primitive`, with exceptions for Vue components including `TresCanvas`, `TresPortal` and `TresCanvasContext`. A host with unrelated custom elements must deliberately compose its predicate **after module setup**, for example in a `modules:done` hook capturing the installed Tres predicate and returning `isTres(tag) || tag.startsWith('company-')`. Do not mark every tag custom or mark `TresCanvas` custom; either breaks Vue component handling. [Exact predicate](https://unpkg.com/@tresjs/core@5.10.0/dist/template-compiler-options.mjs).

`tres.glsl: true` installs `vite-plugin-glsl` with defaults to import shader text; it does not translate GLSL to TSL/WGSL or make `ShaderMaterial` work with WebGPURenderer. Leave it false unless the selected, verified pipeline requires it. `tres.devtools` defaults true; false above avoids registering the optional local iframe/tab. The published UI is served under `/__tres_nuxt_devtools` via Vite middleware; the source-development branch proxies that route to **localhost:3300**, not a hosted Tres service. This option does not turn all Nuxt DevTools off. Do not expose development servers or scene inspection to untrusted networks. [Exact options](https://unpkg.com/@tresjs/nuxt@5.8.0/dist/module.d.mts), [UI/module implementation](https://unpkg.com/@tresjs/nuxt@5.8.0/dist/module.mjs).

### Client scene with an SSR-readable alternative

The module's server `TresCanvas` returns only `<span />` and **does not render its default slot**. Its client wrapper forwards attributes/listeners and the scene slot to the selected core canvas. Consequently the module already provides a client-only canvas; another `<ClientOnly>` is not mandatory. The explicit boundary below also gives a useful loading fallback and makes it obvious which subtree must never own SSR content. Keep required instructions, names, links and data in normal DOM **outside** the scene. A `.client.vue` scene additionally prevents browser-only composables from executing during SSR; do not run `useTres` in the parent page or at module scope. [Server wrapper](https://unpkg.com/@tresjs/nuxt@5.8.0/dist/runtime/TresCanvas.server.vue), [WebGPU client wrapper](https://unpkg.com/@tresjs/nuxt@5.8.0/dist/runtime/TresCanvasWebGPU.client.vue).

Add `app/components/LocalTresScene.client.vue`:

```vue
<template>
  <TresPerspectiveCamera :position="[3, 2, 4]" :look-at="[0, 0, 0]" />
  <OrbitControls />
  <TresMesh>
    <TresBoxGeometry :args="[1, 1, 1]" />
    <TresMeshBasicNodeMaterial color="#82dbc5" />
  </TresMesh>
</template>
```

This uses generated Cientos imports and a catalogue material from `three/webgpu`, without models, fonts, HDRIs, decoders or CDN dependencies. Add `app/pages/scene.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'

const failed = ref(false)
function onCanvasError(cause: unknown) {
  console.error(cause)
  failed.value = true
}
</script>

<template>
  <section>
    <h1>Local cube</h1>
    <p>A mint-coloured cube. Drag to orbit; scroll to zoom.</p>
    <p>The description remains available without graphics support.</p>
    <p v-if="failed" role="status">The 3D view is unavailable.</p>
    <div v-else style="height: 24rem">
      <ClientOnly>
        <TresCanvas clear-color="#17202a" @error="onCanvasError">
          <LocalTresScene />
        </TresCanvas>
        <template #fallback><p>Loading optional 3D view…</p></template>
      </ClientOnly>
    </div>
  </section>
</template>
```

The container has deterministic dimensions to avoid a zero-height canvas/layout jump. Scene objects are rendered by Tres's custom renderer, not by the DOM renderer: do not put `<p>`, Vuetify controls or an application layout inside its primitive tree. A DOM-overlay helper has its own mounting/accessibility contract; it is not an SSR alternative. Core's `error` event covers its initialization/render-manager errors; a Cientos unsupported-helper setup throw or an independent loader failure needs a Vue error boundary/that loader's error state, not a promise that this canvas handler catches every descendant exception. Never display raw asset URLs, private metadata or internal exception details to users.

### Assets, teardown and privacy

Nuxt owns routing, server rendering and request state; each mounted canvas owns its renderer/context and Tres scene lifetime. A descendant `useLoop` subscription belongs to the component scope; remove separately created timers, listeners and unmanaged GPU resources on teardown. Keep Three instances shallow/non-proxied; never serialize a renderer, geometry, material, texture or scene graph into `useState`, Pinia SSR payloads or `useAsyncData`. Server loaders may return serializable model metadata, but browser Three loaders and WebGPU initialization belong behind the client boundary.

Nuxt `public/models/cube.glb` is served as `/models/cube.glb`, **not** `/public/models/cube.glb`; adjust URLs for the host's base/CDN deliberately. Anything in `public/` is public: no confidential models, session tokens or tenant-specific assets. For private models use the application's authorized asset delivery and identity lifecycle, not an obscured filename. Clear identity-scoped loader caches/resources when the session changes, in addition to the private query-cache contract above. A scene's retained/shared assets must not be disposed while another consumer still uses them; choose one owner for cache eviction, geometry/material/texture disposal and any blob URL revocation. See [Tres ownership and renderer limits](tresjs.md), including the preserved older-version caveats.

The package/module setup requires no Tres account, API key, telemetry endpoint or hosted backend. Loading a remote model, font, HDRI or Draco/KTX decoder is still a browser request; configure local URLs/decoder paths and inspect the actual Network panel if self-hosting/no-egress is required. Installing a helper alone is not proof it has no external default assets. Do not feed signed URLs or secrets into generated component headers, committed configs, SSR payloads or developer screenshots.

### Release transitions and acceptance recipes

The full monorepo release inventory supplies **23 Nuxt entries** through 5.8.0; many are dependency-only releases, not new Nuxt APIs. The tagged package changelog also retains the pre-monorepo history. Relevant transitions:

- Module 3.0.0 moved to core 4; 3.0.5 recorded a `useEnvironment` Nuxt fix. Do not copy that old module/core pairing into this profile.
- Module 4.0.0 raised the Nuxt support baseline to 3.16.0. The 5.0 prerelease/stable transition adopted Nuxt 4/core 5 and new devtools; its RC fixed wrapper attribute forwarding, and 5.0.1 followed a core regression fix.
- 5.1.5's GitHub release highlights a core canvas forwarding revert; the package changelog lists the core 5.3.1 bump. Do not infer a new module option from that release title. 5.7.3 selected core 5.9.3 and therefore is not the `/webgpu`-entry module recipe.
- **5.8.0** adds renderer-aware `/webgpu` entry selection and updates core to 5.10.0. It also fixes the packaged devtools favicon/path; 5.4.0's earlier icon/dark-mode fix was not a renderer change. [Nuxt 5.8.0 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/nuxt%405.8.0), [5.1.5 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/nuxt%405.1.5), [tagged complete package changelog](https://github.com/Tresjs/tres/blob/%40tresjs/nuxt%405.8.0/packages/nuxt/CHANGELOG.md).

**Source-backed smoke recipe, not an execution receipt:** in the separate Nuxt app with the files above, run `bunx nuxt prepare`, `bunx nuxt typecheck` and `bunx nuxt build`, then serve its normal Nitro output (`node .output/server/index.mjs`). Inspect generated `.nuxt/imports.d.ts` and component declarations: core imports/types must target `/webgpu`, `OrbitControls` must target Cientos `/webgpu`, and unsupported helpers must point at generated stubs. Request `/scene` before JavaScript: heading, description and optional-view fallback must exist, without browser globals or a serialized Three graph. Hydrate/navigate away/back: no mismatch, one canvas, usable orbit interaction, unmount cleanup and a retained DOM alternative on a deliberate initialization failure.

Exercise the **same scene** in native WebGPU and WebGPURenderer's forced WebGL2 backend. For the latter, supply a client-only `renderer` factory importing `WebGPURenderer` from `three/webgpu` and returning `new WebGPURenderer({ canvas: toValue(ctx.canvas), forceWebGL: true })` (types `TresRendererSetupContext` from `@tresjs/core/webgpu`, `toValue` from `vue`); it is a test variation, not a permanent fallback switch. In a separate negative fixture render an absent helper such as `ContactShadows` and require its named “not available for WebGPU yet” error; do not hide it to make the positive scene pass. Review public-asset requests and private-route policy separately. Compiler/module compatibility alone proves none of these runtime obligations.
