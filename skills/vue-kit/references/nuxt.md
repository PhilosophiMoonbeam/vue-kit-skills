# Nuxt

First-class host guide for **Nuxt 4.6.2 + Vue 3.5.44**, for new applications and ordinary extension work. Nuxt owns bootstrap, file routing, SSR, payload transfer and the server engine; do not create a second Vue app, Router, Pinia instance or SPA hydration pipeline. Use [migration](migration.md#nuxt-3-to-4-migration) only for an actual Nuxt 3 upgrade. Add [selected Nuxt integrations](nuxt-integrations.md) only when Vuetify, Pinia, or an additional query owner is required; that guide is not certification of every optional module.

For an existing or explicitly selected OpenVue application, use [the official OpenVue Nuxt-module profile](openvue-setup.md#official-nuxt-module-complete-separate-application) after this host guide, then select only the needed [OpenVue capability owner](openvue.md#read-only-the-owner-needed). It is a separate UI profile, not a reason to install a second bootstrap or combine UI plugins.

## Start and generated types

Use **Bun 1.4.3** as the preferred launcher/package manager for a new project, with Node **24.15.0** available for the Nuxt Node runtime (supported Node range `^22.22.3 || ^24.15.0 || >=26.0.0`). The [4.6.2 package manifest](https://unpkg.com/nuxt@4.6.2/package.json) is the version authority, rather than an older generic Node minimum. For the standard starter, run `bun create nuxt@latest catalog-app`, select Bun when prompted, then pin Nuxt/Vue to the versions above and retain one authoritative `bun.lock`. The scaffold CLI and starter evolve independently of the pinned framework. Preserve an incumbent application's selected package manager and lockfile instead of converting it during unrelated work. [Official installation and Bun scaffold command](https://nuxt.com/docs/4.x/getting-started/installation).

Alternatively, create an empty directory with the complete files in this guide. Complete root `package.json` for that local catalogue:

```json
{
  "name": "nuxt-local-catalogue",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.4.3",
  "scripts": {
    "dev": "nuxt dev",
    "postinstall": "nuxt prepare",
    "typecheck": "nuxt typecheck",
    "build": "nuxt build",
    "preview": "nuxt preview"
  },
  "dependencies": {
    "nuxt": "4.6.2",
    "vue": "3.5.44"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "vue-tsc": "3.3.13"
  }
}
```

Run `bun install` in that new directory; retain its `bun.lock`. `bun run postinstall` regenerates types after configuration/module changes when needed; `bun run dev` serves the application. Use `bun run typecheck` and `bun run build` before deployment: the development server is not a typecheck. For an incumbent npm/pnpm/Yarn project, use its corresponding existing commands and lockfile instead. Do not commit `.nuxt/`, `.output/` or secrets. Complete root `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

Preparation creates the app (Vue/browser), server (request runtime), shared (both) and node (configuration/build) TypeScript contexts, including auto-import and route declarations. Do not replace them with the bundled Vite SPA tsconfig, manually edit generated files, or import browser composables into server/shared code. Extend generated options via `typescript.tsConfig` or the matching `appTsConfig`, `serverTsConfig`, `sharedTsConfig`, `nodeTsConfig` in Nuxt config. [Generated project references](https://nuxt.com/docs/4.x/directory-structure/tsconfig), [exact 4.6.2 configuration declarations](https://unpkg.com/@nuxt/schema@4.6.2/dist/index.d.mts).

## Directories, layers and aliases

Nuxt 4 defaults to `app/` (`app.vue`, `pages/`, `layouts/`, `middleware/`, `plugins/`, `components/`, `composables/`, `utils/`, `assets/`). Keep `nuxt.config.ts`, `server/`, `public/`, `shared/`, `modules/` and `layers/` at the project root. Public assets are served unchanged; never put secrets there. `shared/types/` and `shared/utils/` must remain usable by both runtimes.

`~`/`@` resolve to `srcDir` (normally `app/`); `~~`/`@@` resolve to the root; `#shared` addresses shared code. Use `nuxt.config.ts` aliases rather than overwriting generated TypeScript paths. Respect an incumbent `srcDir`, `serverDir` and layer structure rather than blindly moving directories. Layers compose reusable Nuxt configuration/source through `extends` or automatically registered `layers/`; the application overrides extended layers, and earlier `extends` entries have higher priority. Resolve a layer's own filesystem paths relative to that layer (for example with `fileURLToPath(new URL('./assets/theme.css', import.meta.url))`), not the consuming application's `~`. Audit conflicting components, routes and modules. [Directory migration](https://nuxt.com/docs/4.x/getting-started/upgrade#new-directory-structure), [layers](https://nuxt.com/docs/4.x/guide/going-further/layers), [aliases](https://nuxt.com/docs/4.x/api/nuxt-config#alias).

## Pages, layouts and middleware

`app/pages/index.vue` is `/`; `catalog/[id].vue` is `/catalog/:id`; `[...slug].vue` is a catch-all. Nested pages render children through `<NuxtPage />`. The root composes `<NuxtLayout><NuxtPage /></NuxtLayout>`; a layout renders its slot. Keep a single element root in pages/layouts when using transitions. `definePageMeta({ layout: 'default', middleware: 'catalog-redirect' })` belongs in a page, not its layout. Use `<NuxtLink>` and Nuxt's `useRoute`/`navigateTo`, not a separately installed router or the raw vue-router `useRoute` with different update timing. [Pages](https://nuxt.com/docs/4.x/directory-structure/app/pages), [layouts](https://nuxt.com/docs/4.x/directory-structure/app/layouts).

Complete optional `app/middleware/catalog-redirect.ts` (not required by the catalogue fixture). Attach its name only to pages that actually need this redirect:

```ts
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/catalog') return navigateTo('/catalog/1', { replace: true })
})
```

Named middleware runs when selected; `.global.ts` runs globally. Return/await redirects or return `abortNavigation()`; do not continue a guarded operation after redirecting. Use `to`/`from` inside middleware rather than `useRoute`. Middleware can run on the server and again during client hydration/navigation; avoid non-idempotent effects. Vue route middleware is navigation policy, **not API authorization**. `server/middleware/` runs in the HTTP request pipeline and is a different contract. [Route middleware](https://nuxt.com/docs/4.x/directory-structure/app/middleware).

## Request context and state

Call Nuxt composables in component setup, Nuxt plugins, route middleware or a composable invoked synchronously from those contexts. Do not call `useNuxtApp`, `useRuntimeConfig` or `useState` at module scope or from an arbitrary delayed callback. Supported transformed contexts preserve context across their `await`; an arbitrary async utility does not acquire that guarantee. Capture the needed instance/value before leaving the context; `nuxtApp.runWithContext` is an explicit escape hatch, not global request storage. Plugins create request-owned services inside `defineNuxtPlugin` and return `{ provide: { service } }`; browser-only libraries belong in `.client.ts` plugins. [Auto-import context](https://nuxt.com/docs/4.x/guide/concepts/auto-imports), [Nuxt app](https://nuxt.com/docs/4.x/api/composables/use-nuxt-app).

`useState('catalog-view', () => 'list')` is payload-backed, request-isolated shared app state. Keep its contents serializable and public: never store secrets, functions, class instances or a session proof. Module-level mutable refs leak across SSR requests. Component-only state remains a local ref; fetched server state remains in its data owner. Use [the official Pinia Nuxt integration](nuxt-integrations.md) when domain state/actions warrant Pinia; do not mirror the same remote record in both owners. `callOnce` can own deliberate once-per-app initialization/store actions, not a hidden mutation inside an async-data read. [State](https://nuxt.com/docs/4.x/api/composables/use-state), [callOnce](https://nuxt.com/docs/4.x/api/utils/call-once).

## Data, payload and cancellation

- Use Nuxt `useFetch` for URL reads, `useAsyncData` for a custom async read, and `$fetch` for an event-triggered mutation. A bare `$fetch` in universal setup can fetch once on the server and again during hydration; the data composables transfer results through Nuxt's payload.
- Make URLs/keys reactive and encode every dependency that changes the result. An interpolated setup-time string is a snapshot. Same-key callers share `data`, `error` and status; their handler, `deep`, `default`, `transform`, `pick`, `getCachedData`, `middleware` and serialization contracts must agree. Keys identify data, not authorization.
- Handle `idle`, `pending`, `error`, `success` and absent data explicitly. `lazy: true` permits nonblocking client navigation, not instantly resolved data; `server: false` defers initial data until client hydration, even if setup awaits the composable. `immediate: false` requires `execute()`.
- Nuxt 4 data is shallow by default: replace snapshots, or deliberately select `deep: true` when nested mutation is required. Do not expect changing `data.value.item.title` to notify shallow consumers.
- `dedupe: 'cancel'` cancels the earlier overlapping execution; `'defer'` reuses pending work. Neither is durable HTTP caching or an authorization boundary. Forward `useAsyncData`'s supplied `signal` to the actual transport; cancellation cannot undo an already committed server mutation.
- `refresh`/`execute` explicitly reload; the returned `clear()` aborts that owner's pending transport, clears data/error and restores idle/default state. `refreshNuxtData(key)` targets shared data; `clearNuxtData(key)` invalidates matching entries but **does not abort their transport in 4.6.2**. For identity teardown, call each owner's `clear()` or abort a controller supplied to `execute({ signal })`, then clear the private namespace. Reset identity-bound caches/state before enabling the next identity. Default cached-data lookup uses payload data during hydration and extracted static data for non-manual execution causes otherwise; `refresh()` and `refreshNuxtData()` bypass that default static lookup in 4.6.2. Custom `getCachedData` must define invalidation deliberately. Payload reuse does not prove fresh backend data.
- A handler must return a defined usable result and remain free of store mutations/other side effects. A custom wrapper should return the data composable rather than awaiting it internally.

[useFetch](https://nuxt.com/docs/4.x/api/composables/use-fetch), [useAsyncData](https://nuxt.com/docs/4.x/api/composables/use-async-data), [exact 4.6.2 async-data implementation](https://unpkg.com/nuxt@4.6.2/dist/app/composables/asyncData.js), [exact fetch implementation](https://unpkg.com/nuxt@4.6.2/dist/app/composables/fetch.js).

Contextual **alternative** setup fragment for `app/pages/catalog/[id].vue`, replacing that page's `useFetch` declaration below, with its existing `id` computed and `CatalogItem` type. It is not a second simultaneous owner. Capture `useRequestFetch()` synchronously so the custom read forwards the current SSR request context to the local route:

```ts
const requestFetch = useRequestFetch()
const { data, status, error, refresh } = await useAsyncData(
  () => `catalog:${id.value}`,
  (_nuxtApp, { signal }) => requestFetch<CatalogItem>(
    `/api/catalog/${encodeURIComponent(id.value)}`,
    { signal },
  ),
  { deep: false, dedupe: 'cancel' },
)
```

Relative `useFetch` automatically uses request-aware fetching during SSR; bare server `$fetch` does not forward browser cookies automatically. Forward only necessary headers to trusted destinations, never wholesale cookies/authorization to a user-supplied origin. Response `Set-Cookie` from an internal request is not automatically propagated to the browser response. [Request fetch](https://nuxt.com/docs/4.x/api/composables/use-request-fetch).

## Local catalogue example

This is a complete, deterministic, read-only local application, not a backend/authentication mock or a persistence claim. Assemble these files with the package/tsconfig above; no external service, credential or UI library is required. Open `/`, then `/catalog/1`; `/catalog/2` has another known record, `/api/catalog/3` returns 404, and `/api/catalog/invalid` returns 400. The API validates independently of page navigation. All Vue/Nuxt helpers in SFCs are generated auto-imports; server helpers are explicitly imported.

Complete `nuxt.config.ts`:

```ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  typescript: { strict: true },
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

Complete `shared/types/catalog.ts`:

```ts
export interface CatalogItem {
  id: string
  title: string
}
```

Complete `server/api/catalog/[id].get.ts`:

```ts
import { createError, defineEventHandler, getRouterParam } from 'nuxt/server'
import type { CatalogItem } from '#shared/types/catalog'

const titles: Readonly<Record<string, string>> = {
  '1': 'Component contracts',
  '2': 'Effect ownership',
}

export default defineEventHandler((event): CatalogItem => {
  const id = getRouterParam(event, 'id', { decode: true })
  if (!id || !/^[1-9]\d*$/.test(id)) {
    throw createError({ status: 400, statusText: 'Invalid catalogue ID' })
  }
  const title = Object.hasOwn(titles, id) ? titles[id] : undefined
  if (!title) {
    throw createError({ status: 404, statusText: 'Catalogue item not found' })
  }
  return { id, title }
})
```

Complete `app/app.vue`:

```vue
<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
```

Complete `app/layouts/default.vue`:

```vue
<template>
  <div>
    <header><NuxtLink to="/">Local catalogue</NuxtLink></header>
    <main id="main-content"><slot /></main>
  </div>
</template>
```

Complete `app/pages/index.vue`:

```vue
<script setup lang="ts">
const config = useRuntimeConfig()
useSeoMeta({ title: () => config.public.catalogTitle })
</script>

<template>
  <section>
    <h1>{{ config.public.catalogTitle }}</h1>
    <ul>
      <li><NuxtLink to="/catalog/1">Component contracts</NuxtLink></li>
      <li><NuxtLink to="/catalog/2">Effect ownership</NuxtLink></li>
    </ul>
  </section>
</template>
```

Complete `app/pages/catalog/[id].vue`:

```vue
<script setup lang="ts">
import type { CatalogItem } from '#shared/types/catalog'

definePageMeta({ layout: 'default' })
const route = useRoute()
const id = computed(() => String(route.params.id))
const { data, status, error, refresh } = await useFetch<CatalogItem>(
  () => `/api/catalog/${encodeURIComponent(id.value)}`,
  { deep: false, dedupe: 'cancel' },
)
useSeoMeta({ title: () => data.value?.title ?? 'Catalogue' })
</script>

<template>
  <section :aria-busy="status === 'pending'">
    <h1>Catalogue item</h1>
    <p v-if="status === 'pending'" role="status">Loading catalogue item</p>
    <p v-else-if="error" role="alert">Unable to load this item.</p>
    <article v-else-if="data"><h2>{{ data.title }}</h2></article>
    <p v-else>No item loaded.</p>
    <button type="button" :disabled="status === 'pending'" @click="refresh()">
      Refresh
    </button>
    <nav aria-label="Catalogue items">
      <NuxtLink to="/catalog/1">Item 1</NuxtLink>
      <NuxtLink to="/catalog/2">Item 2</NuxtLink>
    </nav>
  </section>
</template>
```

The page deliberately displays an inline fetch error; it does not turn every API error into a document-level 404. For a product that requires a missing item to produce an HTTP page error, explicitly throw the appropriate Nuxt page `createError` after the read and use an application `error.vue` policy. Do not treat a hidden error or an empty fallback record as success.

## Server boundaries and private configuration

In **Nuxt 4.6.2**, import `defineEventHandler` and all current server helpers explicitly from `nuxt/server` in the same handler. Its event is a request/response facade (`event.req`, `event.res`), not h3 v1's `event.node`. Auto-imported handler/helpers on Nuxt 4 remain h3 v1; mixing them can produce `NUXT_E8012`. `createError` takes `status`/`statusText`, router params are encoded unless `{ decode: true }`, response headers use `event.res.headers`, and a redirect must `return sendRedirect(...)`. Server `useRuntimeConfig()` takes no event argument. h3-specific handlers must consistently use h3's handler/event/helpers; do not partially migrate them. Session cookies from the two contracts are not interchangeable. [4.6 migration table](https://nuxt.com/docs/4.x/getting-started/upgrade#moving-to-nuxtserver), [exact exported server declarations](https://unpkg.com/nuxt@4.6.2/dist/server/index.d.ts).

The catalogue's ID check is real runtime validation, not a type assertion. For query/body inputs use `getValidatedQuery`/`readValidatedBody` with a runtime validation function or Standard Schema; repeated query keys may be arrays, an empty body can be undefined, and `readBody<T>` does not validate `T`. Enforce real session, authorization and resource ownership on every protected handler; page middleware cannot secure it. Bound body sizes/rates at the deployment boundary appropriate to the application. Return appropriate 400/401/403/404/500 errors without secrets, stack traces or arbitrary untrusted status text. [Server validation declarations](https://unpkg.com/nuxt@4.6.2/dist/server/validate.d.ts).

`runtimeConfig.catalogSecret` is server-only; `runtimeConfig.public.catalogTitle` is intentionally delivered to clients. Override with `NUXT_CATALOG_SECRET` and `NUXT_PUBLIC_CATALOG_TITLE` at runtime. The demonstration declares the secret boundary but does not invent a credential requirement or use that value as pretend authorization. Server code can explicitly import `useRuntimeConfig` from `nuxt/server`; never return the entire config, serialize it into `useState`/payload, or put secrets in `app.config`, public assets or client plugins. Build-time environment reads are not a substitute for matching runtime override names; production does not automatically load a development `.env` file. [Runtime configuration](https://nuxt.com/docs/4.x/guide/going-further/runtime-config).

## SSR, hydration and head

Universal setup runs on both server and client. Keep initial markup deterministic: no unseeded randomness, viewport reads, locale-dependent clock output or browser storage reads during SSR. Use payload-backed state/data for shared initial values and `onMounted` for browser-only effects; dispose listeners/timers. Correct invalid HTML rather than suppressing mismatch warnings. [Hydration guidance](https://nuxt.com/docs/4.x/guide/best-practices/hydration), [SSR debugging](debugging-ssr.md).

`useSeoMeta`/`useHead` accept reactive getters so titles track parameter-only navigation. Use `useHeadSafe` for untrusted head values; do not concatenate user HTML into scripts or expose private configuration. The catalogue supplies its title from a validated local record. [SEO/head](https://nuxt.com/docs/4.x/getting-started/seo-meta).

`<ClientOnly>` removes its default subtree from SSR; provide a meaningful fallback and reserve layout space. CSS used only inside that tree may not appear in the initial server CSS. A `.client.vue` component or client-only plugin also does not make its server HTML hydrate later: there is no such HTML. Lazy import and lazy hydration are different. Nuxt's SFC template lazy-hydration support uses a generated `Lazy` component and one explicit strategy; direct `#components` imports or spread hydration props do not have the same compiler contract. Prop changes can force hydration. [ClientOnly](https://nuxt.com/docs/4.x/api/components/client-only), [lazy hydration](https://nuxt.com/docs/4.x/directory-structure/app/components#delayed-or-lazy-hydration).

Complete optional `app/components/CatalogNote.vue` (not needed by the main fixture):

```vue
<template>
  <aside aria-label="Catalogue note">These two records are bundled local data.</aside>
</template>
```

Contextual template fragment inside a page's existing template, requiring that component. It delays hydration of existing SSR HTML, not server rendering or data authorization:

```vue
<LazyCatalogNote hydrate-on-visible />
```

Do not invent `definePageMeta({ hydration: ... })`; choose a supported strategy only when delaying interactivity is useful and accessible.

## Route rules, privacy and deployment

Default SSR runs per request; prerender runs at build time; `swr` caches responses with background revalidation; `isr` depends on the deployment platform. `ssr: false` changes rendering, **not access control**. The catalogue applies private/no-store route-rule headers to normal catalogue responses and enables no response-cache rule. This is not a blanket guarantee for every response: framework error handling or the deployment platform can replace those headers. Inspect final success **and error** responses in the deployed runtime before adding request-specific data; errors must not expose private configuration or identity-bound details, and their actual cache policy must meet the application's privacy requirements. The public demonstration's generic 400/404 errors contain no authentication or private data. If a route must become cacheable, prove its output is public across identities first. Never prerender or share-cache personalized HTML, API JSON, auth/session responses or their extracted payloads; review both the page and its API route, CDN rules and cache keys. A cache key containing an ID does not grant permission. [Rendering and route rules](https://nuxt.com/docs/4.x/guide/concepts/rendering).

The complete config selects Nitro's `node-server` preset. Build with `bun run build` and deploy the generated `.output` server plus public assets; run `NODE_ENV=production node .output/server/index.mjs` in the production Node environment, supplying runtime secrets there. `bun run preview` is a local preview, not a production process-management contract. Bun as launcher/package manager does not change this Node deployment contract. Choose the provider's actual preset and runtime limits for an edge/serverless target; Node filesystem/native APIs and durable in-memory state are not portable guarantees. [Deployment](https://nuxt.com/docs/4.x/getting-started/deployment), [Nitro deployment presets](https://nitro.build/deploy).

`nuxt generate`/static public output does not ship a running server: the catalogue's client navigation/refresh still needs its API. Do not deploy only `.output/public` and claim this application works end to end. A genuinely static version must redesign the data delivery or deploy a real API separately. Validate generated types, build, direct SSR/API requests, parameter navigation, refresh/error handling and hydration in the chosen runtime; a successful bundle alone proves none of request isolation, provider authentication or browser behavior.
