# Vue Router: navigation, inputs, and data boundaries

Read for Vue Router setup, route-driven components, guards, typed routes, file generation, or loader adoption. Inspect the installed package and incumbent conventions first. This is not Nuxt's pages/middleware contract. For the alternative adapter read [TanStack Router](routing-tanstack.md); install and mount only one router. See [authentication](auth.md), [server-state ownership](architecture-data.md), and [SSR](debugging-ssr.md).

## Versions and API status

| Contract | Exact researched version | Boundary |
| --- | --- | --- |
| Current Vue Router | `vue-router@5.4.0` | Vue/compiler peer `^3.5.34 || ^4.0.0`; Vue `3.5.44` satisfies it. Vite `^7.3.0 || ^8.0.0` is optional. Includes the file-routing plugin. |
| Incumbent Router 4 / bundled workbench | `vue-router@4.6.4` | Vue peer `^3.5.0`. Classic route-record examples below work on this line and current 5.4.0. Do not use v5 plugin imports in this fixture. |
| Opt-in APIs in 5.4.0 | `vue-router/experimental` | Data loaders and resolver/param-parser experiments are not made stable by the package major. The resolver router is explicitly **not production-ready** upstream. |

Sources: [5.4.0 metadata](https://registry.npmjs.org/vue-router/5.4.0), [4.6.4 metadata](https://registry.npmjs.org/vue-router/4.6.4), [v4→v5 migration](https://router.vuejs.org/guide/migration/v4-to-v5.html), [experimental router warning](https://router.vuejs.org/experimental/router-resolver.md). The prepared source's 5.3.1 is not the current baseline. Do not silently upgrade an incumbent during an unrelated task.

Choose one installation, retaining the application's existing toolchain:

```sh
# Current application
bun add --exact vue@3.5.44 vue-router@5.4.0
# Instead, for the explicitly Router-4 application
bun add --exact vue@3.5.44 vue-router@4.6.4
```

## Histories and request lifetime

| History | Use | Required behavior |
| --- | --- | --- |
| `createWebHistory(base)` | Browser SPA, normal URLs | Host must serve the app shell for valid deep links; preserve real asset/API failures and HTTP 404 policy. Match the deployed base and Vite base. |
| `createWebHashHistory(base)` | Static hosting without rewrite control | Hash contains client route; it is not sent to the server. Not a replacement for SSR. |
| `createMemoryHistory(base)` | Server render, isolated tests, non-browser use | No initial navigation or browser URL. Explicitly push the request URL and await readiness. |

Create router, app, Pinia, and user-specific caches **per server request**, never as request-bearing module singletons. Install providers before router installation starts the initial navigation. Server sequence: construct with memory history → install providers/router → `await router.push(requestUrl)` → `await router.isReady()` → render. Client hydration uses web history for the same URL, awaits `isReady()`, then mounts a `createSSRApp` tree. Handle redirects/status codes in the server integration; a client catch-all does not set an HTTP status. Router core alone does not serialize application data. [History documentation](https://router.vuejs.org/guide/essentials/history-mode.html).

This request-scoped classic-router path remains the SSR replacement for the excluded stock TanStack Vue `RouterServer`/`RouterClient` wrappers at the exact baseline in [the alternative-adapter diagnosis](routing-tanstack.md#vue-ssr-excluded-stock-wrappers-diagnostic-context-only). Their exported signatures are not evidence of a working Vue server/client protocol. Keep a working incumbent SSR integration; do not migrate it to those wrappers to obtain loaders or generated routes.

### Incumbent hand-written hash navigation

Do not replace a tiny existing hash switch merely to fix its listener leak. The following complete browser component retains that model, initializes only after mount (safe during SSR), and removes the **same handler** at unmount. It is not a second router to mount beside Vue Router; it deliberately lacks nested routes, guards, history-state navigation, and server matching. Prefer `createWebHashHistory` when those capabilities are needed. With KeepAlive, unmount cleanup does not run on deactivation: pause component-owned listeners in `onDeactivated` and restore them in `onActivated` if an inactive view must stop observing.

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'

const path = shallowRef('/')
const title = computed(() => path.value === '/' ? 'Home'
  : path.value === '/about' ? 'About' : 'Page not found')
function syncHash() { path.value = window.location.hash.slice(1) || '/' }
onMounted(() => {
  syncHash()
  window.addEventListener('hashchange', syncHash)
})
onUnmounted(() => window.removeEventListener('hashchange', syncHash))
</script>

<template>
  <nav aria-label="Main"><a href="#/">Home</a> <a href="#/about">About</a></nav>
  <h1>{{ title }}</h1>
</template>
```

[Vue manual-routing example](https://vuejs.org/guide/scaling-up/routing.html), [lifecycle cleanup](https://vuejs.org/api/composition-api-lifecycle.html#onunmounted).

## Complete classic-route SPA

These four files are a small browser entry for a Vue/Vite TypeScript application with an `#app` element. All local components and routes are defined. Render functions keep route infrastructure in one file; ordinary feature components remain SFCs. `/users/1?page=2` demonstrates a reused page and normalized props. The about SFC is genuinely lazy-loaded.

```ts
// src/main.ts
import { createApp, defineComponent, h } from 'vue'
import {
  createRouter, createWebHistory, RouterView,
  type LocationQueryValue,
} from 'vue-router'
import App from './App.vue'
import UserPage from './UserPage.vue'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
  }
}

function first(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
function pageNumber(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  const text = first(value)
  if (text == null || !/^[1-9]\d*$/.test(text)) return 1
  const number = Number(text)
  return Number.isSafeInteger(number) ? number : 1
}
const Home = defineComponent({
  setup: () => () => h('h1', 'Home'),
})
const UsersLayout = defineComponent({
  setup: () => () => h('section', [h('h1', 'Users'), h(RouterView)]),
})
const UserIndex = defineComponent({
  setup: () => () => h('p', 'Choose user 1 from the navigation.'),
})
const NotFound = defineComponent({
  setup: () => () => h('h1', 'Page not found'),
})
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: Home, meta: { title: 'Home' } },
    {
      path: '/users', component: UsersLayout,
      children: [
        { path: '', name: 'users', component: UserIndex },
        {
          path: ':id', name: 'user', component: UserPage,
          props: to => {
            if (to.name !== 'user') throw new Error('Expected the user route')
            return { id: String(to.params.id), page: pageNumber(to.query.page) }
          },
          meta: { title: 'User' },
        },
      ],
    },
    {
      path: '/about', name: 'about', component: () => import('./AboutPage.vue'),
      meta: { title: 'About' },
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash }
    return { top: 0, left: 0 }
  },
})
router.afterEach((to, _from, failure) => {
  if (!failure) document.title = `${to.meta.title ?? 'Page'} — Router example`
})
const app = createApp(App)
app.use(router)
await router.isReady()
app.mount('#app')
```

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { nextTick, watch, useTemplateRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
const content = useTemplateRef<HTMLElement>('content')
watch(() => route.path, async (path) => {
  await nextTick()
  if (route.path === path) content.value?.focus({ preventScroll: true })
})
</script>

<template>
  <a href="#content">Skip to content</a>
  <nav aria-label="Main">
    <RouterLink :to="{ name: 'home' }">Home</RouterLink>
    <RouterLink :to="{ name: 'user', params: { id: '1' }, query: { page: 2 } }">
      User 1
    </RouterLink>
    <RouterLink :to="{ name: 'about' }">About</RouterLink>
  </nav>
  <main id="content" ref="content" tabindex="-1"><RouterView /></main>
</template>
```

```vue
<!-- src/UserPage.vue -->
<script setup lang="ts">
const props = defineProps<{ id: string; page: number }>()
</script>

<template>
  <h2>User {{ props.id }}</h2>
  <p>Requested page: {{ props.page }}</p>
</template>
```

```vue
<!-- src/AboutPage.vue -->
<template><h1>About this router example</h1><p>No network or persistence.</p></template>
```

Nested child paths are relative (`:id`); a leading slash makes a root path. A parent layout must render `RouterView`; an empty child renders at the parent's URL. Named views require matching `components` and per-view `props` entries. Use unique route names. `redirect` changes location; `alias` preserves the visible URL while matching the aliased record. Navigation guards on a redirecting record do not replace access checks on its target.

Use `component: () => import(...)` for lazy route components, not `defineAsyncComponent`. Load failures reject navigation; report them through `router.onError` and the application's error UI, rather than swallowing errors or blindly reloading. For transitions/KeepAlive use the `RouterView` slot and wrap its rendered `Component`, not `RouterView` itself. A key such as `route.params.id` deliberately remounts and discards local state; do not key every view by `fullPath` merely to repair stale data. [Lazy routes](https://router.vuejs.org/guide/advanced/lazy-loading.html), [RouterView slot](https://router.vuejs.org/guide/advanced/router-view-slot.html).

## URL normalization and reuse

- Stable-router path params normalize to strings, or arrays for repeatable segments (`:parts+`, `:parts*`); optional params need an explicit absent-value policy. A `\d+` match is still a string, not a number. Validate domain constraints separately.
- Query values are `string | null | (string | null)[]`; missing keys are `undefined` at runtime. `?flag` is `null`; `?flag=` is `''`. Decide whether repeated scalar input uses first/last value or is rejected. The example intentionally takes the first and defaults invalid page numbers to 1; that is application policy, not router validation.
- Navigate with `{ name, params }` for URL encoding. A `path` plus `params` ignores the params. Pass numbers/strings, not objects; keep secrets and non-serializable state out of URLs. `undefined` removes a query entry, `null` writes a bare key. Use `replace` for canonicalization or high-frequency filter changes when back-history entries are not wanted.
- `router.currentRoute` is a ref outside setup (`.value`); `useRoute()` is reactive inside setup. Do not capture `const id = route.params.id` and expect updates. Watch only inputs you use, or map them through reactive route props.
- `/users/1` → `/users/2` reuses the page instance: setup/mount do not rerun. `beforeEnter` does not run for changes to params, query, or hash on the same record. Use a narrow watcher for post-confirmation work; `onBeforeRouteUpdate` if work must approve/block navigation. Parent `beforeEnter` also does not rerun between its children.

### Async requests: cancellation and stale-result rejection

This is a complete **contextual component**, not a supplied backend. The parent/route adapter must provide the explicitly application-owned `loadUser(id, signal)` service. It owns HTTP response checking and runtime decoding. The component owns request lifetime and error/loading display. The `current` flag also protects against services that ignore cancellation.

```vue
<script setup lang="ts">
import { shallowRef, watch } from 'vue'

interface User { id: string; name: string }
const props = defineProps<{
  id: string
  loadUser: (id: string, signal: AbortSignal) => Promise<User>
}>()
const user = shallowRef<User>()
const error = shallowRef<string>()
const pending = shallowRef(false)
watch(() => props.id, async (id, _previous, onCleanup) => {
  const controller = new AbortController()
  let current = true
  onCleanup(() => { current = false; controller.abort() })
  user.value = undefined
  error.value = undefined
  pending.value = true
  try {
    const result = await props.loadUser(id, controller.signal)
    if (current) user.value = result
  } catch (cause) {
    if (current) error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (current) pending.value = false
  }
}, { immediate: true })
</script>

<template>
  <p v-if="pending" role="status">Loading user</p>
  <p v-else-if="error" role="alert">{{ error }}</p>
  <h2 v-else-if="user">{{ user.name }}</h2>
</template>
```

Router cancellation prevents an older navigation from committing, but does not undo arbitrary store writes or cancel your network calls. Await guard work; return its decision; do not fire untracked requests then immediately allow navigation. Pass signals where supported and avoid committing global state for obsolete targets. A query library can own this lifetime instead; do not copy its result into a second store. [Data fetching](https://router.vuejs.org/guide/advanced/data-fetching.html).

The component's watcher covers **route-id changes only**. For private data, the host must also hide/key its owner on user/session/org generation changes as specified in [auth.md](auth.md); a tenant switch can keep the same `id` and URL. Check that generation after token acquisition and before every data/error/loading commit. Neither route reuse handling nor a navigation-cancellation result invalidates requests under a different identity automatically.

## Guards, injection, failures, and metadata

| Return from `beforeEach` / `beforeResolve` / update/leave guard | Meaning |
| --- | --- |
| `undefined`, no return, `true` | Proceed to the next guard. |
| `false` | Abort and restore the previous URL when needed. |
| Route location | Drop this navigation and redirect. Exempt public destinations to prevent loops. |
| Throw/reject an error | Abort and call `router.onError`; unexpected errors are not successful navigation. |

Prefer return-based guards. **Router 4 still supports `next`**, exactly once per non-overlapping execution path; do not label it removed/deprecated in 4. Runtime deprecation was introduced in **5.0.3**. Never mix `next` completion with returned decisions. Options API `beforeRouteEnter` has no `this` because the instance does not exist yet; its legacy `next(vm => ...)` callback is distinct from update/leave guards. Composition API exposes `onBeforeRouteUpdate` and `onBeforeRouteLeave`, not an instance-based enter composable. [Versioned v4 guard contract](https://github.com/vuejs/router/blob/v4.6.4/packages/docs/guide/advanced/navigation-guards.md), [5.0.3 notes](https://github.com/vuejs/router/releases/tag/v5.0.3).

Resolution order: deactivated leave guards → global `beforeEach` → reused-component update guards → route `beforeEnter` → async components → activated enter guards → global `beforeResolve` → confirmation → `afterEach` → DOM update → enter callbacks. `beforeResolve` is useful for work that should wait until entry checks and async components resolve. `afterEach` cannot redirect or cancel.

Vue 3.3+ permits `inject()` inside global guards. Install Pinia/providers before `app.use(router)`; obtain injections synchronously before an `await`, not at module evaluation. The following contextual installer requires a real application access service and aborts denied navigation without inventing a login destination. Provider-neutral session readiness, redirect validation and server authorization boundaries belong to [auth.md](auth.md).

```ts
import { inject, type App, type InjectionKey } from 'vue'
import type { Router } from 'vue-router'

interface AccessService { canEnter: (path: string) => Promise<boolean> }
const accessKey: InjectionKey<AccessService> = Symbol('route-access')
export function installAccessGuard(app: App, router: Router, service: AccessService) {
  app.provide(accessKey, service)
  return router.beforeEach(async to => {
    if (!to.meta.requiresAuth) return
    const access = inject(accessKey)
    if (!access) throw new Error('Route access provider is missing')
    if (!await access.canEnter(to.path)) return false
  })
}
```

Client guards improve UX; the server must enforce authorization independently. Preserve redirects when catching control-flow exceptions. Validate any post-login return URL against the application's same-origin/allowed-path policy; never trust an arbitrary query string as an external redirect.

For a slow access service, its application-owned request deadline must reject or return a denial; a timeout must **never silently grant access**. A returned/awaited promise is sufficient; `undefined` after a completed successful check correctly allows navigation. Do not copy a timeout `Promise.race` that leaves the request/timer alive or converts an unknown identity into success. Display navigation-pending UI separately from page-fetch loading, and settle it on failures/errors as well as confirmation. Parallelize independent access checks only when both results are required; no protected store write should precede the decision.

To debug loops, trace each guard's incoming target, returned destination, and readiness/role decision (without tokens or sensitive query values), then inspect `router.resolve(target).matched` and shallow merged metadata. Check direct entry, already-at-login, guest-only destinations, error pages, and onboarding transitions against one policy snapshot. A target must be outside the rule redirecting to it; two individually non-self redirects can still form A→B→A. Fix that graph, not a user-editable `_redirectCount` query escape hatch.

`meta` is a **shallow, non-recursive** parent-to-child merge. A child can overwrite `requiresAuth` or a whole nested object. Put policies in explicitly typed fields, as in the example's `RouteMeta` augmentation; use an imported module/`export {}` so augmentation does not replace the module. Types do not enforce authorization. If every matched record must pass a policy, explicitly inspect `to.matched` rather than assuming deep merge semantics.

`await router.push(target)` resolves a navigation failure for aborted, cancelled, or duplicated navigation. Use `isNavigationFailure(result, NavigationFailureType.aborted)` to distinguish a declined leave dialog from an obsolete navigation; unexpected errors can reject. Redirect success is not the same as failure. Inspect the third `afterEach` argument before analytics/title/focus changes. `router.isReady()` replaces the removed `onReady()` API.

Scroll and focus are separate: saved positions restore back/forward scroll, hashes need a real target, and async content/transitions may require a promised scroll result after the target exists. The example focuses main only on path changes, after a DOM tick; it preserves focus for query-only filter changes and avoids double scrolling. An application with deferred content should place focus at its actual completion boundary and announce the page title. Avoid moving focus on failed navigation. See [accessibility](accessibility.md) and [scroll behavior](https://router.vuejs.org/guide/advanced/scroll-behavior.html).

### Link interoperability and runtime route registration

`RouterLink` is an anchor by default. Active matching checks route records and params (including ancestor records); query is not part of active matching. Exact-active excludes ancestor-only matches; aliases match their record and redirects are not followed for active checks. Set `active-class`/`exact-active-class` locally or `linkActiveClass`/`linkExactActiveClass` on the router. For an incumbent design-system anchor, the following complete component keeps `href`, modified-click behavior, and `aria-current`; its optional default slot is label content. `useLink` exposes the same reactive `href`, `route`, active flags, and `navigate` when a headless composable fits better. Do not turn external URLs into router targets.

```vue
<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
defineProps<{ to: RouteLocationRaw; replace?: boolean }>()
</script>

<template>
  <RouterLink :to="to" :replace="replace" custom
    v-slot="{ href, navigate, isActive, isExactActive }">
    <a :href="href" @click="navigate" :class="{ active: isActive }"
      :aria-current="isExactActive ? 'page' : undefined"><slot /></a>
  </RouterLink>
</template>
```

For plugin/permission-provided **classic** routes, `addRoute(record)` returns a removal callback; `addRoute(parentName, child)` nests under a named parent. `hasRoute`/`getRoutes` inspect registration; `removeRoute(name)` removes aliases/children too. Reusing a name replaces its old record. Registration alone does not rematch the current URL: outside guards, await `replace(router.currentRoute.value.fullPath)` when needed. Inside a guard, register then **return `to.fullPath`**, not `router.replace`; the next pass must see the route and stop registering. Remove session-scoped records on logout, but enforce authorization separately. Generated types do not update at runtime; the experimental resolver does not support this API. Keep the removal/unregister callbacks for global guards and `onError` subscriptions too, and invoke them when an application/plugin owner is disposed.

Custom `parseQuery`/`stringifyQuery` must be a matching pair across SSR/client and navigation; preserve a documented null/repetition/encoding policy and avoid double encoding. `strict` and `sensitive` control trailing-slash/case matching globally or per record; do not rely on deprecated `end: false` for subtree layouts. Use nested records instead.

[Active links](https://router.vuejs.org/guide/essentials/active-links.html), [custom links](https://router.vuejs.org/guide/advanced/extending-router-link.html), [dynamic routes](https://router.vuejs.org/guide/advanced/dynamic-routing.md).

## Typed and file-based routes: do not mix major versions

- Manual typed route maps (`RouteRecordInfo` + `TypesConfig.RouteNamedMap`) exist since **4.4.0**. Raw params can accept numbers while normalized params remain strings. Types are not runtime URL validation.
- In Router 4, automatic generation comes from the separately installed `unplugin-vue-router`, whose exact installed version must be checked. `vue-router/vite` is **not** a Router-4 export.
- In **5.4.0**, use `vue-router/vite` and `vue-router/auto-routes`; remove the old external plugin only as an intentional migration. Avoid deprecated `vue-router/auto`. Generated route names are not necessarily hand-written names: read the generated map. Include it in TypeScript; never hand-edit generated output.

[Typed-route introduction at v4.6.4](https://github.com/vuejs/router/blob/v4.6.4/packages/docs/guide/advanced/typed-routes.md), [v5 file setup](https://router.vuejs.org/file-based-routing.md).

### Manual map for an incumbent non-generated tree

This complete declaration file matches the classic example's **named** records; keep it synchronized with that tree and do not also load a generated map. Parent layouts with no name do not need a named entry. The fourth generic models normalized URL params, not raw navigation inputs. Use a closed object **type alias** here: Router **4.6.4** constrains the map to `Record<string | symbol, RouteRecordInfoGeneric>`, which accepts this alias's implicit index signature but rejects the equivalent augmentable interface. Adding a broad explicit index signature would lose the finite route-name inference:

```ts
// src/routes.d.ts
import type { RouteRecordInfo } from 'vue-router'

type RouteNamedMap = {
  home: RouteRecordInfo<'home', '/', Record<never, never>, Record<never, never>>
  users: RouteRecordInfo<'users', '/users', Record<never, never>, Record<never, never>>
  user: RouteRecordInfo<'user', '/users/:id', { id: string | number }, { id: string }>
  about: RouteRecordInfo<'about', '/about', Record<never, never>, Record<never, never>>
  'not-found': RouteRecordInfo<'not-found', '/:pathMatch(.*)*',
    { pathMatch?: (string | number)[] }, { pathMatch: string[] }>
}
declare module 'vue-router' {
  interface TypesConfig { RouteNamedMap: RouteNamedMap }
}
```

`useRoute('user')` narrows for that name but does not prove the component is currently under that record. Runtime input checks remain necessary; inferred types must not hide unknown deep-link values. A route-record `props` callback receives the union of named routes, not an automatically narrowed location for its enclosing record; the classic example checks `to.name` before accessing `id` and retains its normalized prop/query conversion.

### Complete minimal v5 generated-route alternative

Replace the classic entry with these files, not a second router. Use the existing Vite Vue toolchain; configure `moduleResolution: "Bundler"`, include `src`, and optionally add `vue-router/volar/sfc-route-blocks` and `vue-router/volar/sfc-typed-router` under `vueCompilerOptions.plugins`. The plugin generates `src/route-map.d.ts`; initial generation is a prerequisite for route-aware type checks.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueRouter from 'vue-router/vite'

export default defineConfig({
  plugins: [VueRouter({ dts: 'src/route-map.d.ts' }), vue()],
})
```

```ts
// src/main.ts
import { createApp, h } from 'vue'
import { createRouter, createWebHistory, RouterView } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes })
if (import.meta.hot) handleHotUpdate(router)
const app = createApp({ setup: () => () => h(RouterView) })
app.use(router)
await router.isReady()
app.mount('#app')
```

Keep app-consumer checking separate from the build-tool configuration when using the retained **5.4.0** package. Add `tsconfig.app.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts", "src/**/*.vue", "src/**/*.d.ts"]
}
```

Run `vue-tsc --noEmit -p tsconfig.app.json` for that app scope, with the base configuration's `strict: true` and `skipLibCheck: false` unchanged. A single full-tree TypeScript project that includes both `vite.config.ts` and the app exposes an upstream **5.4.0 declaration-bundling collision**: `vue-router/vite` imports `dist/options-B1Pk0SIa.d.mts`, while the runtime/experimental exports import `dist/index-u4XkZVDG.d.ts`; both independently augment Vue's route guards, `$route`, `$router`, `RouterView`, and `RouterLink`. The generated route map augments the runtime's `TypesConfig`, not the plugin's duplicate copy. App-only checking does **not** certify that full-tree project: retain and report its seven duplicate-declaration diagnostics separately rather than patching vendor declarations or enabling `skipLibCheck`.

```vue
<!-- src/pages/index.vue -->
<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <h1>Catalog</h1>
  <RouterLink to="/catalog/1">Read catalog item 1</RouterLink>
</template>
```

Add the catalog page below to complete that link. `index.vue` maps to `/`; nested directories and parent pages form layouts; `[id].vue` adds a dynamic segment; `[...path].vue` is a catch-all. Check the actual [file conventions](https://router.vuejs.org/file-based-routing/file-based-routing.md) for optional/repeatable parameters and named views. Changing generated routes at runtime does not regenerate static types; use plugin build-time extension hooks when generation must describe additional routes.

### Generated conventions and customization

| Need | v5 convention / owner |
| --- | --- |
| Optional / repeatable | `[[id]].vue` → optional; `[slugs]+.vue` → one-or-more; `[[slugs]]+.vue` → zero-or-more. Components must accept the corresponding absent/array shapes. |
| URL nesting without a parent view | `users.create.vue` → `/users/create`; unlike `users.vue` plus `users/`, it does not nest under that page. |
| Named view / organizational group | `index@aux.vue` supplies view `aux`; `(admin)/dashboard.vue` keeps `/dashboard`. The layout must render the matching named `RouterView`. |
| Folder layout | `_parent.vue` owns a non-matchable parent layout; it still needs `RouterView`. |
| Static route options | One `definePage({ name, alias, meta })` per page; globally recognized macro, or import it explicitly. No setup-local values or `beforeEnter` functions; use typed metadata plus a global guard. `<route lang="json">`/JSON5/YAML is the custom-block alternative. |
| Folder scope | `routesFolder` accepts folders or folder descriptors with URL prefixes; avoid overlapping/nested roots. `extensions`, `filePatterns`, and `exclude` define the scanned set; `importMode` chooses async/sync page imports. |
| Type-visible route changes | `extendRoute(node)` changes each editable node; `beforeWriteFiles(root)` edits the final tree. `node.addAlias`, `node.addToMeta`, `node.name`, `node.insert`/`delete` affect generated output. This build-time deep metadata editing is **not** runtime `route.meta` merge behavior. |

For example, this complete replacement Vite config adds an alias to the existing catalog page at build time, so output remains type-visible:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueRouter from 'vue-router/vite'

export default defineConfig({
  plugins: [
    VueRouter({
      dts: 'src/route-map.d.ts',
      extendRoute(route) {
        if (route.name === '/catalog/[id]') route.addAlias('/c/:id')
      },
    }),
    vue(),
  ],
})
```

For non-Vite incumbents use the exported `vue-router/unplugin/{webpack,rollup,esbuild,rolldown}` adapter appropriate to that build tool; do not rewrite its toolchain. `VueRouterAutoImports` from `vue-router/unplugin` is an optional configuration map for an **already installed** auto-import plugin, not another router or a prerequisite. Declare `definePage` as a readonly lint global when using the macro without imports. If routes do not generate, inspect `routesFolder`/extensions/filter scope; if navigation works but types fail, inspect the generated map's inclusion and restart the language server after generation.

[File conventions](https://router.vuejs.org/file-based-routing/file-based-routing.md), [extension hooks and macro limitations](https://router.vuejs.org/file-based-routing/extending-routes.md), [exact plugin utilities](https://unpkg.com/vue-router@5.4.0/dist/unplugin/index.d.mts).

## Experimental data loaders in 5.4.0

Use loaders only after explicitly accepting their experimental API. They work with the stable router; adopting them does **not** require the experimental resolver. Install `DataLoaderPlugin` before the router. In the generated entry above add `import { DataLoaderPlugin } from 'vue-router/experimental'` and `app.use(DataLoaderPlugin, { router })` immediately before `app.use(router)`.

This complete page uses an honest local, read-only catalog, not a fabricated backend. Export the loader from the normal `<script>` so the lazy page module exposes it to discovery. Use the returned composable without `await` in setup.

```vue
<!-- src/pages/catalog/[id].vue -->
<script lang="ts">
import { defineBasicLoader, reroute } from 'vue-router/experimental'

const catalog = new Map([['1', { id: '1', title: 'Vue routing' }]])
export const useCatalogItem = defineBasicLoader('/catalog/[id]', async to => {
  const item = catalog.get(String(to.params.id))
  if (!item) reroute('/')
  return item
}, { key: 'catalog-item' })
</script>

<script setup lang="ts">
import { shallowRef } from 'vue'

const { data: item, error, isLoading, reload } = useCatalogItem()
const reloadError = shallowRef<string>()
async function reloadItem(): Promise<void> {
  if (isLoading.value) return
  reloadError.value = undefined
  try {
    await reload()
  } catch (cause) {
    reloadError.value = cause instanceof Error ? cause.message : 'Could not reload the item.'
  }
}
</script>

<template>
  <p v-if="isLoading" role="status">Loading catalog item</p>
  <p v-else-if="error || reloadError" role="alert">{{ reloadError ?? error?.message }}</p>
  <h1 v-else-if="item">{{ item.title }}</h1>
  <button type="button" :disabled="isLoading" @click="reloadItem">Reload item</button>
</template>
```

- `defineBasicLoader` reruns on navigation; it is not an independent normalized entity cache. The loader receives `(to, { signal })`; pass `signal` to a real cancellable service. Cancellation occurs on superseding/failed navigation. Keep side effects out of loaders; injection/store lookup must occur before the first await.
- Pass the generated route **name** as the first argument when a loader reads that route's params; here it is `'/catalog/[id]'`, not its URL pattern. The named overload preserves inferred result data and normalized `id: string`; omitting the name gives the union of every generated route's params. This is static narrowing, not runtime validation: the catalog lookup and `reroute('/')` still reject unknown item IDs.
- Blocking loader errors abort navigation and reach `router.onError`; `reroute(location)` throws internal navigation control and stops execution. Do not swallow it. `new NavigationResult(...)` is deprecated.
- `{ lazy: true }` makes a loader non-blocking: data can be undefined, errors live in its error ref, and it cannot control navigation. This differs from lazy-loading the page's JavaScript. Default staged data commits avoid exposing inconsistent partial navigation results; changing `commit` is an explicit UX decision.
- Export loaders from lazy page modules, or explicitly declare `meta.loaders` for eager components. A loader merely imported inside setup is not automatic page discovery. Nested loaders must use the supported loader context, not start unrelated Vue reactive effects.

### Loader composition, reload, and expected errors

Call **and await** a nested loader at the start of its parent loader; within a loader this yields the loaded data, not the component's `{ data, error }` refs. Calls in one navigation deduplicate. Do not create reciprocal dependencies (deadlock), assume layout-export order, or insert an unrelated `await` before a later nested loader. If an unrelated promise must intervene, wrap it with the **current exported** `withLoaderContext(promise)` to restore the loader context; older docs spell this helper inconsistently. Nested invalidation depends on the loader implementation, not a universal guarantee. The following complete local loader module can be imported and **re-exported from a lazy page's normal script**:

```ts
// src/loaders/catalog-summary.ts
import { defineBasicLoader, reroute, withLoaderContext } from 'vue-router/experimental'

const catalog = new Map([['1', { id: '1', title: 'Vue routing' }]])
const useItem = defineBasicLoader('/catalog/[id]', async to => {
  const item = catalog.get(String(to.params.id))
  if (!item) reroute('/')
  return item
})
const useEdition = defineBasicLoader(async () => ({ label: 'Local edition' }))
export const useCatalogSummary = defineBasicLoader(async () => {
  const item = await useItem()
  const suffix = await withLoaderContext(Promise.resolve('read-only'))
  const edition = await useEdition()
  return { title: `${item.title} — ${edition.label} (${suffix})` }
})
```

`reload()` returns `Promise<void>`, uses the current route, and must not be started during an ongoing navigation. The button's disabled state **and handler check** reject a reload while this loader is busy; the handler also catches the reload promise, which can reject even when the local error ref is populated. A host with additional async guards/chunk-pending UI must gate reload against that navigation state too: a loader's `isLoading` is not a whole-navigation flag. The basic loader does **not** expose the source's invented `refetch()` method. In setup call the loader synchronously; awaiting it there can duplicate requests and confuses its two call contracts. `useIsDataLoading()` from `vue-router/experimental` reflects the navigation's loader phase, not time waiting in earlier guards/chunk loading or manual reloads; use the individual loader's `isLoading` for reload UI. [Exact reload implementation](https://unpkg.com/vue-router@5.4.0/dist/experimental/index.js).

Unexpected blocking errors abort and go to `router.onError`, **not** the local error ref. A loader's `errors: [ExpectedError]` or predicate can instead permit navigation and expose a local error; then `data` may be undefined. Global `DataLoaderPlugin({ router, errors })` definitions require `errors: true` on an opting-in loader. Local `errors: false` retains abort behavior; a local list/predicate overrides global matching. Lazy/reload errors are local regardless of that expected-error filter. Never classify navigation-control exceptions as successful data. `{ server: false }` skips server loading; `{ lazy: !import.meta.env.SSR }` instead blocks SSR but not client navigation. Neither implements state serialization.

For stricter application error handling, augment `TypesConfig.Error` on **`'vue-router'`** to `unknown` in an imported declaration file and narrow the local error before displaying `.message`. Do not augment an unexported `TypesConfig` on the experimental subpath merely because an old declaration comment names it there. This changes static handling, not which exceptions the loader catches. The existing catalog template assumes the default `Error` type.

For loaders defined in separate files, explicit page re-exports are simplest. The Vite-only `experimental.autoExportsDataLoaders` plugin option accepts loader-path globs to generate those exports; it is opt-in and experimental, not discovery of every setup import.

[Nested loaders](https://router.vuejs.org/data-loaders/nested-loaders.md), [error policy](https://router.vuejs.org/data-loaders/error-handling.md), [exact helper/result declarations](https://unpkg.com/vue-router@5.4.0/dist/index-u4XkZVDG.d.ts).

### Colada cache alternative

Use `defineColadaLoader` instead of the basic loader when [Pinia Colada](pinia-colada.md) owns server state. For the researched compatible stack: `pinia@4.1.0`, `@pinia/colada@1.4.8`, Vue `3.5.44`; install Pinia's required devtools peer as described in [state](state.md). Install Pinia → `PiniaColada` with options → `DataLoaderPlugin` → router. Do not install two data-loader implementations for the same result.

The following **replacement normal-script block** for the catalog page reuses its setup/template. The key is passed to Colada; cache invalidation must use the same key. Real server-state use replaces the explicitly local query with an application-owned decoded service call.

```vue
<script lang="ts">
import { defineColadaLoader } from 'vue-router/experimental/pinia-colada'
import { reroute } from 'vue-router/experimental'

const catalog = new Map([['1', { id: '1', title: 'Vue routing' }]])
export const useCatalogItem = defineColadaLoader('/catalog/[id]', {
  key: to => ['catalog', String(to.params.id)],
  query: async to => {
    const item = catalog.get(String(to.params.id))
    if (!item) reroute('/')
    return item
  },
  staleTime: 10_000,
})
</script>
```

Colada owns freshness/deduplication/invalidation; `refresh` observes staleness, `refetch` forces work. Include every result-changing input and user/tenant scope in cache keys. Do not mirror results in an application store. Route tracking is not authorization or complete key design. SSR must serialize/hydrate the Colada cache using its documented protocol; a loader `key` alone is not an SSR implementation. Basic-loader SSR documentation is incomplete; do not promise production SSR parity from its type signatures. [Loader contracts](https://router.vuejs.org/data-loaders/defining-loaders.md), [Colada loader](https://router.vuejs.org/data-loaders/colada.md), [loader SSR boundary](https://router.vuejs.org/data-loaders/ssr.md).

## Experimental resolver and param parsers

Separate opt-in: `experimental_createRouter` from `vue-router/experimental` plus generated `resolver` from `vue-router/auto-resolver`. Enable `experimental: { paramParsers: true }` in the **5.4.0** VueRouter plugin. This replaces the stable `createRouter({ routes })` matching layer; do not mount both. Explicitly register/import `RouterLink` and `RouterView`; this router does not install them globally. Its fixed resolver has no stable-router dynamic `addRoute`/`removeRoute` API. Upstream limits it to testing/feedback, not production.

Contextual replacement for the generated entry (same `createApp`, `h`, `RouterView`, `createWebHistory` imports and pages; remove the stable `createRouter`/`routes` imports):

```ts
import { experimental_createRouter } from 'vue-router/experimental'
import { resolver, handleHotUpdate } from 'vue-router/auto-resolver'

const router = experimental_createRouter({
  history: createWebHistory(import.meta.env.BASE_URL), resolver,
})
if (import.meta.hot) handleHotUpdate(router)
declare module 'vue-router' {
  interface TypesConfig { Router: typeof router }
}
```

- `[id=int].vue` parses an integer to `number`; native `bool`/`string` also exist. Unlike stable-router regexes, this changes normalized parameter types. `definePage({ params: { query: { page: { parser: 'int', default: 1 } } } })` exposes the parsed query input under `route.params.page`.
- Custom parser modules in `src/params` export `parser = defineParamParser<T>({ get, set })`. `get` validates, `set` serializes. `miss()` rejects the match and can let a catch-all match; it is not an auth redirect. `defineParamParserRaw` owns null/array handling; `defineHashParamParser` owns the single hash value. Standard Schema parsing is one-way; provide an explicit reversible `set` for values not correctly serialized by `String(value)`.
- Query shape **differs** from the stable router: all raw query values are arrays; a bare key is `[null]`, an absent key is undefined. Navigate with arrays. Query `format: 'value'` selects the last repeated entry; `'array'` preserves entries. Do not reuse the classic first-value policy accidentally.
- Keep parser defaults, requiredness, named-navigation validation, query/hash behavior, and generated type augmentation aligned. `definePage` is a build-time macro; it cannot close over setup-local runtime variables. Treat generated types and resolver as a versioned pair.

For example, this complete `src/params/date.ts` module supports `[day=date].vue` on the experimental resolver. The filename registers parser `date`; automatic wrappers handle optional/repeated values, while raw parsers must implement those shapes themselves:

```ts
import { defineParamParser, miss } from 'vue-router/experimental'

export const parser = defineParamParser<Date>({
  get(value) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) miss('Invalid date')
    return date
  },
  set: value => value.toISOString(),
})
```

This accepts JavaScript date parsing and canonicalizes to an ISO timestamp; a date-only/calendar domain needs a stricter codec. Named navigation must pass `Date` values for this parser, not a string merely cast to that type. Keep `_ParamParsers`/`_RouteFileInfoMap` generated rather than hand-editing internal configuration slots.

[Experimental resolver](https://router.vuejs.org/experimental/router-resolver.md), [param-parser contract](https://router.vuejs.org/experimental/param-parsers.md), [exact experimental declarations](https://unpkg.com/vue-router@5.4.0/dist/experimental/index.d.ts).

## Incumbent migrations

Migrate only when requested, across configuration, runtime imports, virtual modules, generated declarations, and editor plugins together:

- **Router 3 → 4/5:** replace `new VueRouter`/`mode` with `createRouter` plus explicit history; `*` with `/:pathMatch(.*)*`; `onReady` with `isReady`; `currentRoute` reads with `.value`; `x/y` scroll coordinates with `left/top`; `addRoutes` with `addRoute`. Removed `router.app` requires explicitly passing the app/provider. Revisit RouterView transition/KeepAlive slots and legacy `RouterLink` APIs rather than mechanically preserving removed props.
- **Router 4 classic → 5:** upstream describes no breaking classic-route change except the IIFE devtools bundle limitation. Verify peer/runtime/tooling requirements; do not force file generation or the resolver.
- **External unplugin → bundled v5:** plugin import → `vue-router/vite` (or its matching unplugin adapter); utilities → `vue-router/unplugin`; generated records → `vue-router/auto-routes`; loaders → `vue-router/experimental` or `/experimental/pinia-colada`; Volar paths → `vue-router/volar/...`. Remove old `unplugin-vue-router/client` references, old generated-map inclusion when relocating it, and the obsolete dependency only after all callers migrate. Keep exactly one generated map/router registration. Deprecated `vue-router/auto` is not a compatibility plan.
- **Experimental upgrades:** `reroute` replaces `NavigationResult`; removed `selectNavigationResult` has no current installation recipe. Keep this ESM-only opt-in surface separate from classic CJS consumers. Compare the exact pinned experimental declarations; do not treat old release-note features as additional new APIs to install.

[Official v3 migration](https://router.vuejs.org/guide/migration/index.html), [official v5 migration](https://router.vuejs.org/guide/migration/v4-to-v5.md).

## Verification boundary

The classic entry and generated-route files are standalone alternatives within a configured Vite app; service-injected async UI, access installer, replacement loader script, and resolver replacement are explicitly contextual. The bundled [workbench](../assets/example-app/package.json) remains Router 4.6.4, not runtime proof of experimental v5 routing. Compiler/type success does not establish browser navigation, request isolation, or server authorization.

An integrating agent should check direct/deep-link reloads and base paths; initial SSR/client URL agreement; param/query changes on a reused page; repeatable/invalid inputs; guard loops, denial and injected readiness; rapid A→B navigation and stale results; aborted/duplicated navigation; missing chunks; back/forward/hash scroll; focus and announcements; generated types after page renames; cache invalidation/auth-scope changes; and per-request isolation.

## Sources

- [Vue Router 5.4.0 registry contract](https://registry.npmjs.org/vue-router/5.4.0), [4.6.4 registry contract](https://registry.npmjs.org/vue-router/4.6.4).
- [Versioned Router-4 guards](https://github.com/vuejs/router/blob/v4.6.4/packages/docs/guide/advanced/navigation-guards.md), [typed routes](https://github.com/vuejs/router/blob/v4.6.4/packages/docs/guide/advanced/typed-routes.md), [navigation](https://github.com/vuejs/router/blob/v4.6.4/packages/docs/guide/essentials/navigation.md).
- [Current migration](https://router.vuejs.org/guide/migration/v4-to-v5.html), [file routing](https://router.vuejs.org/file-based-routing.md), [meta](https://router.vuejs.org/guide/advanced/meta.html), [navigation failures](https://router.vuejs.org/guide/advanced/navigation-failures.html).
- [Experimental loader setup](https://router.vuejs.org/data-loaders.md), [cancellation](https://router.vuejs.org/data-loaders/load-cancellation.md), [Colada declarations](https://unpkg.com/vue-router@5.4.0/dist/experimental/pinia-colada.d.ts).
