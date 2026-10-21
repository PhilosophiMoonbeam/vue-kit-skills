# TanStack Router for Vue: verified adapter boundaries

Read only when an application already uses `@tanstack/vue-router`, or an explicit evaluation needs its route/search/loader model. [Vue Router](routing.md) remains the conservative Vue default. These are alternatives: do not install Vue Router into the same root or combine `RouterView` with `RouterProvider`. Nuxt and TanStack Start are different integration contracts; a React Start example is not a Vue SSR implementation.

## Exact release and support status

Research baseline: **`@tanstack/vue-router@1.170.41`**, ESM-only, Node `>=20.19`, Vue peer `^3.3.0`; its actual runtime dependencies include `@tanstack/router-core@1.171.38`, `@tanstack/history@1.162.5`, and `@tanstack/vue-store@^0.11.2`. Vue `3.5.44` satisfies the peer range. Package versions are independently numbered; do not invent matching numbers for every package. The prepared source's `1.170.35` is superseded. [Exact registry metadata](https://registry.npmjs.org/@tanstack/vue-router/1.170.41).

**Published does not mean production parity.** The registry's latest release has no prerelease suffix; its published README does not designate it beta. However, the requested Vue overview URL redirected to a generic overview naming React and Solid, not a Vue support guarantee. No authoritative stable-Vue/SSR-parity commitment was established. **Recommend bounded evaluation before adoption.** This is authored risk policy, not an upstream experimental or beta designation. If an installed release is marked beta/experimental upstream, preserve that limitation even when shared-core documentation looks mature. Pin exact releases and verify the Vue-specific declarations/examples before shipping, particularly SSR, devtools, SFC splitting, and hydration. [Published Vue README](https://cdn.jsdelivr.net/npm/@tanstack/vue-router@1.170.41/README.md), [overview actually returned](https://tanstack.com/router/latest/docs/overview), [Vue source/examples](https://github.com/TanStack/router/tree/main/examples/vue).

The examples below use exports verified in this **Vue** package, not names inferred from React. Shared-core behavior is cited as shared core; framework rendering/hydration is checked in Vue adapter declarations.

## Decision workflow

1. Inspect the lockfile, adapter version, generated route tree, bundler target, and SSR entrypoints. Keep the incumbent router during a narrow change.
2. Choose code-defined routes for a small explicit tree; choose file generation when convention-driven scale is useful. Use one tree, not a manually maintained duplicate of generated output.
3. Decide the data owner: router loader cache **or** an external server-state cache. Keep drafts/forms/UI state out of loader snapshots.
4. Define runtime search validation and all loader dependencies before navigation consumers. Inference is not runtime input validation.
5. Provide auth/services through typed router context; never create Vue setup effects inside loader callbacks.
6. Mount `RouterProvider`; register the inferred router type; exercise Vue-specific boundaries before treating an evaluation as a production migration.

```sh
bun add --exact vue@3.5.44 @tanstack/vue-router@1.170.41
```

## Complete code-based browser example

This is one complete `src/main.ts` for an existing Vite TypeScript application with an `#app` element. It requires no JSX plugin, local SFCs, generated file, backend, or authentication server. Its catalog and permission are explicitly **local demonstration data**, not evidence of network/security integration. Every link/redirect target exists.

```ts
// src/main.ts
import { createApp, defineComponent, h } from 'vue'
import {
  createRootRouteWithContext, createRoute, createRouter,
  Link, Outlet, RouterProvider, notFound, redirect,
  useLoaderData, useNavigate,
} from '@tanstack/vue-router'

interface RouterContext {
  permissions: { readCatalog: boolean }
}
interface Item { id: string; title: string }
const catalog: readonly Item[] = [
  { id: '1', title: 'Vue composition' },
  { id: '2', title: 'Routing inputs' },
  { id: '3', title: 'Accessible navigation' },
]
const Root = defineComponent({
  setup() {
    return () => h('div', [
      h('nav', { 'aria-label': 'Main' }, [
        h(Link, { to: '/' }, { default: () => 'Home' }),
        h(Link, { to: '/items', search: { page: 1, q: '' } }, {
          default: () => 'Catalog',
        }),
      ]),
      h('main', [h(Outlet)]),
    ])
  },
})
const Home = defineComponent({
  setup: () => () => h('h1', 'Local catalog example'),
})
const ItemList = defineComponent({
  setup() {
    const data = useLoaderData({ from: '/items' })
    const navigate = useNavigate({ from: '/items' })
    return () => h('section', [
      h('h1', 'Catalog'),
      h('p', `${data.value.total} matching items`),
      h('ul', data.value.items.map(item => h('li', { key: item.id }, [
        h(Link, { to: '/items/$itemId', params: { itemId: item.id } }, {
          default: () => item.title,
        }),
      ]))),
      h('button', {
        type: 'button',
        disabled: !data.value.hasNext,
        onClick: () => navigate({
          to: '/items', search: previous => ({ ...previous, page: previous.page + 1 }),
        }),
      }, 'Next page'),
    ])
  },
})
const ItemDetail = defineComponent({
  setup() {
    const item = useLoaderData({ from: '/items/$itemId' })
    return () => h('h1', item.value.title)
  },
})
const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Root,
  notFoundComponent: () => h('h1', 'Item or page not found'),
  errorComponent: ({ error }) => h('p', { role: 'alert' }, error.message),
})
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
})
const itemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'items',
  validateSearch: (input: Record<string, unknown>) => {
    const candidate = typeof input.page === 'number' || typeof input.page === 'string'
      ? Number(input.page) : 1
    return {
      page: Number.isSafeInteger(candidate) && candidate >= 1 ? candidate : 1,
      q: typeof input.q === 'string' ? input.q : '',
    }
  },
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q }),
  beforeLoad: ({ context }) => {
    if (!context.permissions.readCatalog) throw redirect({ to: '/' })
  },
  loader: ({ deps }) => {
    const filtered = catalog.filter(item =>
      item.title.toLowerCase().includes(deps.q.toLowerCase()),
    )
    const start = (deps.page - 1) * 2
    return {
      items: filtered.slice(start, start + 2), total: filtered.length,
      hasNext: start + 2 < filtered.length,
    }
  },
  staleTime: 10_000,
  component: ItemList,
})
const itemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'items/$itemId',
  beforeLoad: ({ context }) => {
    if (!context.permissions.readCatalog) throw redirect({ to: '/' })
  },
  loader: ({ params }) => {
    const item = catalog.find(candidate => candidate.id === params.itemId)
    if (!item) throw notFound()
    return item
  },
  component: ItemDetail,
})
const routeTree = rootRoute.addChildren([homeRoute, itemsRoute, itemRoute])
export const router = createRouter({
  routeTree,
  context: { permissions: { readCatalog: true } },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/vue-router' {
  interface Register { router: typeof router }
}

createApp({ setup: () => () => h(RouterProvider, { router }) }).mount('#app')
```

The detail is intentionally a **sibling** with path `items/$itemId`, not a child of the list; it does not render inside the list. For nested layout routes use `getParentRoute` pointing at that layout, attach children with `addChildren`, and render `Outlet` in the layout. A pathless layout uses `id`, not a URL segment. Do not type-erase the tree/router with `AnyRouter` casts: `Register` and the concrete tree drive link/search/loader inference. Return **VNode render functions from setup**, rather than calling composables inside render callbacks. [Exact Vue route/component types](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/route.d.ts), [exports](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/index.d.ts).

## Vue subscriptions and navigation

| API | Vue return contract | Usage |
| --- | --- | --- |
| `useRouter()` | Router instance | `router.navigate(...)`, `router.invalidate()`, context updates. Not `.value`. |
| `useNavigate({ from })` | Navigation function | Call/await it; not `.value`. |
| `useSearch`, `useParams`, `useLoaderData`, `useRouteContext`, `useMatch`, `useLocation` | `Ref` of selected data | `.value` in script; automatic unwrapping only for top-level template bindings. |
| `useRouterState({ select })` | Selected `Ref` | Select the narrow state needed rather than subscribing to everything. |
| `getRouteApi(routeId)` | Route-scoped API | Use in deep components to avoid importing the route configuration and creating cycles. |
| `Link` / `Outlet` / `RouterProvider` | Vue components | Not `RouterLink` / `RouterView`; the provider owns router rendering. |

[Exact `useLoaderData` declaration](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/useLoaderData.d.ts), [Vue adapter exports](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/index.d.ts).

### Scope, matching, and return-type traps

- `from` is an **active route ID**, not an arbitrary destination URL. `Route.useSearch()`/`useParams()`/`useLoaderData()`/`useLoaderDeps()`/`useRouteContext()`/`useMatch()` and the corresponding `getRouteApi(id)` methods scope subscriptions without importing configuration into a page. `Route.useNavigate()` and `Route.Link` scope navigation too.
- In generic hooks, `strict: false` relaxes route-specific **typing**; it does not search for a requested parent or make an inactive route active. Without `from`, runtime matching uses the injected nearest route; with `from`, it selects that active match. `shouldThrow: false` permits an absent match and the resulting `undefined`, which must be rendered explicitly. Never copy a hook call to a shell outside its route and silence the invariant with a cast.
- `useLoaderDeps()` returns a `Ref` of the selected dependencies. `useMatches`, `useParentMatches`, and `useChildMatches` return match-array refs; the latter two slice relative to the calling route. Use `select` for a breadcrumb/title slice rather than copying matches into Pinia.
- `useMatchRoute()` is a function whose **invocation returns a computed ref** of `false | params`; inspect `.value`, not the truthiness of the ref. `MatchRoute` exposes matched params through its slot. `useCanGoBack()` returns a boolean ref from the router's history index, not proof that browser Back would stay inside this app; offer an explicit defined-route fallback.
- **Published declaration/runtime discrepancy:** `useLinkProps()` is declared as a plain props object, but 1.170.41's implementation returns a computed ref on the client and a shallow ref on the server (or `{}` without a provider). Do not spread its declared object into an anchor and assume it works. Prefer `Link` or `createLink`, which unwrap the internal source themselves; re-check this mismatch before adopting the low-level hook. This is source inspection, not an exercised runtime result.
- The shared core declares `defaultStructuralSharing`, but this adapter's `useRouterState` delegates directly to Vue Store `useSelector`; do not promise React-style structural-sharing behavior for object-returning Vue selectors from that option alone. Prefer narrow primitive selections and inspect the actual installed adapter.

[Exact match runtime](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/useMatch.js), [search hook types](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/useSearch.d.ts), [matching subscriptions](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/Matches.js), [link runtime](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/link.js) versus [link declarations](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/link.d.ts), [state selector runtime](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/useRouterState.js).

Use `Link` for ordinary navigation so anchors retain keyboard, modified-click, and new-tab behavior. Supply `params` for `$itemId`; don't manually substitute strings. Use `search` objects or updater functions with complete required validated output. Preserve only intended keys, not secrets or arbitrary URL input. `replace` avoids unnecessary history entries for rapidly edited filters. `Link` owns its active state/`aria-current`; custom links must preserve accessible anchor behavior. External URLs need an explicit allowed-protocol policy; do not bypass the adapter's protocol checks.

Await `navigate` for sequencing, but do not apply Vue Router's `NavigationFailureType` model to this adapter. Use `throw redirect(...)` in `beforeLoad`/loaders rather than rendering `Navigate` to enforce access after a protected tree has already rendered. `Navigate` is component lifecycle navigation, not a server HTTP redirect. Navigation blockers can protect dirty local forms; auth/server authorization remains independent.

### Reusable links, preloading, and dirty-form blocking

`linkOptions` validates a reusable target without widening `to` to `string`; the result works with `Link`, `navigate`, and `redirect`. This complete component belongs **under the code-based example's provider**; both targets already exist. Bind `active-options` as an object, not an unbound string. `includeSearch` defaults to true, so disable it deliberately when a section link should remain active across filter changes:

```vue
<script setup lang="ts">
import { Link, linkOptions } from '@tanstack/vue-router'
const catalogLink = linkOptions({ to: '/items', search: { page: 1, q: '' } })
</script>

<template>
  <Link v-bind="catalogLink" :active-options="{ exact: false, includeSearch: false }"
    :active-props="{ class: 'selected' }" preload="intent" v-slot="{ isActive }">
    Catalog <span v-if="isActive">(current section)</span>
  </Link>
</template>
```

`activeProps`/`inactiveProps` merge classes/styles with base props; active links set `data-status` and `aria-current`. Relative `to` resolves from `from`; supply it explicitly in reusable components. `replace` changes history; `resetScroll: false` preserves page scroll; `hashScrollIntoView` targets a fragment; `reloadDocument` deliberately delegates a full document navigation. `state` is history state, not a shareable URL or durable storage. `target` and modified clicks must retain normal anchor behavior. `disabled` removes the usable destination rather than becoming an authorization check.

Per-link `preload` accepts `'intent'`, `'viewport'`, `'render'`, or `false`; `preloadDelay` controls intent/viewport delay (router default 50 ms), and `preloadIntentProximity` changes the intent trigger. Preload failure is not a successful navigation. Use `router.preloadRoute(target)` for explicit warmup, never to perform a business mutation. Freshness/retention are the cache windows below, not a nonexistent `defaultPreloadMaxAge`.

For a design-system anchor, this complete module forwards the router's resolved props/events/slot to an actual anchor. The base is a Vue functional component satisfying the published `createLink` contract; it must not render another router link or a button:

```ts
import { h, mergeProps } from 'vue'
import { createLink, type CreateLinkProps } from '@tanstack/vue-router'

const BaseAnchor = (props: CreateLinkProps) => {
  const { children, ...anchorProps } = props
  const content = typeof children === 'function'
    ? children({ isActive: Reflect.get(props, 'data-status') === 'active' })
    : children
  return h('a', mergeProps({ class: 'app-link' }, anchorProps), content)
}
export const AppLink = createLink(BaseAnchor)
```

For a dirty form, mount this complete confirmation component under the provider and pass its actual dirty state. `true` means **block**, `proceed()` accepts the pending navigation, `reset()` keeps the page. Register once during setup; the hook removes its history subscription with its effect scope. The native unload prompt is browser-controlled and cannot render this confirmation UI:

```vue
<script setup lang="ts">
import { useBlocker } from '@tanstack/vue-router'
const props = defineProps<{ dirty: boolean }>()
const blocker = useBlocker({
  shouldBlockFn: () => props.dirty,
  enableBeforeUnload: () => props.dirty,
  withResolver: true,
})
</script>

<template>
  <section v-if="blocker.status === 'blocked'" aria-label="Unsaved changes">
    <p role="alert">Leave without saving your changes?</p>
    <button type="button" @click="blocker.proceed?.()">Leave</button>
    <button type="button" @click="blocker.reset?.()">Stay</button>
  </section>
</template>
```

`shouldBlockFn` receives `{ current, next, action }` and may return a promise; inspect params/search when only some transitions should be blocked. Without `withResolver`, `useBlocker` returns void and the callback owns the decision. `enableBeforeUnload` must use the **current** dirty state; passing an initial boolean snapshot can leave a permanent unload prompt. Use the object signature, not deprecated `(fn, condition)` forms. `Block` is the component/resolver alternative, not a second blocker to install simultaneously. The current implementation permits leaving a not-found location for a matched route; this is not an access-control mechanism. For a modal confirmation instead of this inline region, apply the dialog focus/escape contract in [accessibility](accessibility.md).

[Exact Vue link implementation](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/link.js), [link factories/types](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/link.d.ts), [blocker implementation](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/useBlocker.js), [core preload options](https://unpkg.com/@tanstack/router-core@1.171.38/dist/esm/router.d.ts).

## Search validation and loader ordering

TanStack's default search parser is JSON-first: numbers/booleans/arrays/objects can be parsed values, not just strings. Treat its input as unknown. The example accepts string/number page inputs, defaults invalid values to 1, and discards unknown search keys from its validated result. This is a deliberate permissive URL policy; a strict application can throw validation errors to show a route error boundary instead. Defaults must be identical during server and client rendering.

`validateSearch` defines the validated shape, not a security boundary. If using a schema library, verify its exact adapter and input/output default semantics; do not assume every schema produces optional navigation inputs. Serialization adapters for SSR are **not** search-schema adapters. Default JSON search supports arrays/objects; a custom serializer is not required just because a value is non-scalar. Dates and richer application values need a documented round trip. Never put access tokens or sensitive payloads into URLs.

Keep inference-sensitive options ordered: `validateSearch`/`params` → `loaderDeps` → context/`beforeLoad` → `loader`. Lifecycle: matches/params/search are resolved, `beforeLoad` runs parent-to-child, then eligible loaders can run in parallel; child loaders must not rely on another loader's side effect. Return a context extension from `beforeLoad` when child work needs a derived authenticated identity.

Only search fields returned by `loaderDeps` become loader dependencies. Params already participate in the route match identity; include every result-changing search field, but not unrelated UI tabs. Pass `abortController.signal` from loader context to cancellable I/O; avoid writes into an external global store after an obsolete load. Preloads can invoke the same pipeline: loaders/auth checks must tolerate speculative execution without mutations, login prompts, or duplicate business actions. [Shared-core route contract at 1.171.38](https://unpkg.com/@tanstack/router-core@1.171.38/dist/esm/route.d.ts).

### Shared search and reversible path codecs

Put shared validated search on a layout route so descendants inherit it; read that layout's active route ID rather than pretending `strict: false` finds the parent. `search.middlewares` transforms **generated navigation URLs**, not inbound validation. `retainSearchParams(['q'])` keeps only the chosen parent field; `stripSearchParams({ page: 1, q: '' })` omits those default values, and the validator must restore them on reload. Add the following contextual option to the example's `itemsRoute` (add both imports from `@tanstack/vue-router`); it replaces deprecated `preSearchFilters`/`postSearchFilters`:

```ts
search: {
  middlewares: [
    retainSearchParams(['q']),
    stripSearchParams({ page: 1, q: '' }),
  ],
},
```

Distinguish optional navigation **input** from complete validated **output** when defaults exist. `SearchSchemaInput` can mark a plain validator's input; a schema library's specific search adapter can preserve that distinction. `createSerializationAdapter` is for SSR serialization, not the schema-validator adapter. Avoid asserting optional input with casts or copying obsolete claims that a serializer is needed for every array/object. For custom URL formats, pair `parseSearchWith(parse)` and `stringifySearchWith(stringify)` using the same codec on server/client; prove round trips for repeated keys, Unicode, null, booleans, empty/default values, and any richer types. Search parsing errors/validator failures belong to route error handling (`SearchParamError`), not a fake default after every exception.

Path params use `params.parse`/`params.stringify`, not deprecated top-level `parseParams`/`stringifyParams`. The following **contextual option** replaces those options on a `$itemId` route and leaves its canonical domain type as `string`. Validation rejects invalid direct URLs; stringification is its inverse, not arbitrary string interpolation:

```ts
params: {
  parse: ({ itemId }) => {
    if (!/^[1-9]\d*$/.test(itemId)) throw new Error('Item ID must be a positive integer')
    return { itemId }
  },
  stringify: ({ itemId }) => ({ itemId }),
},
```

Place codecs before dependency/loader options so inference propagates. A branded/number/date domain type needs its own reversible, runtime-checked codec and loader agreement; compile-time link safety alone cannot validate copied URLs.

[Exact shared-core codec/search contracts](https://unpkg.com/@tanstack/router-core@1.171.38/dist/esm/route.d.ts), [core search serializer declarations](https://unpkg.com/@tanstack/router-core@1.171.38/dist/esm/searchParams.d.ts).

## Auth/context and cache ownership

`beforeLoad` and `loader` are ordinary callbacks, not Vue setup. Do not call `useAuth`, `watch`, lifecycle hooks, or effect-producing composables there. Capture an application session in Vue setup/application initialization and pass the required service or snapshot through `createRootRouteWithContext<Context>()` and `createRouter({ context })`. This also gives each SSR request a different context instance.

The following is a **contextual function added beside the example router**. A real application calls it after its independently implemented session service produces a new permission snapshot. It is not login, token validation, or server authorization:

```ts
export async function applyPermissions(readCatalog: boolean) {
  router.update({ context: { permissions: { readCatalog } } })
  await router.invalidate()
}
```

`applyPermissions` deliberately changes a **local demo permission**, not a user/tenant. Do not reuse this two-line function as identity teardown. The exact shared core's `invalidate()` marks matches invalid while retaining data; `clearCache()` retires cached/preloaded matches but does not erase committed rendered matches. For a real identity transition, synchronously hide the private subtree and invalidate the application's request generation first; retire old-scope cache entries, update context, and reload the required matches before enabling the new private view. Partition external query keys by identity/org and check the captured generation before any external side effect/result commit, including after token acquisition. Context updates alone do not add identity to loader cache keys. Keep teardown scoped to the old identity so delayed cancellation cannot evict the new identity's data. See [identity teardown](auth.md#identity-teardown-and-pinia-integration) and [exact invalidation/cache implementation](https://unpkg.com/@tanstack/router-core@1.171.38/src/router.ts).

Do not catch a `redirect()`/`notFound()` and turn it into fallback data. If a service error mapper catches broadly, preserve recognized routing control with `isRedirect`/`isNotFound` before handling domain errors. Public redirect targets must be defined and exempt from the same denied policy. Validate post-login destinations as same-origin/allowlisted application locations. Access to the browser route never grants access to the backend resource. See [auth](auth.md) for the application identity boundary, not a Vue-Router-specific Clerk guard transplanted into this adapter.

| Data owner | Route's responsibility | Invalidation |
| --- | --- | --- |
| Router loader cache | Load/return route data; consume `useLoaderData`. Appropriate for route-scoped results. | `router.invalidate()` and loader freshness settings. Not a general entity mutation cache. |
| TanStack Query | Loader orchestrates/awaits `queryClient.ensureQueryData` using the **same** query key/options components observe; components subscribe to Query. | Query mutation/invalidation APIs own data freshness. Router invalidation alone does not invalidate Query data. |
| Pinia application store | Own session, workflow selection, drafts, or UI policy. | Do not copy cached query/loader entities into a parallel store. |

For Query-backed orchestration set `defaultPreloadStaleTime: 0` when the loader must always delegate a preload freshness decision to Query; set Query's own `staleTime` deliberately. Avoid competing independent loader/Query freshness assumptions. Do not teach a second handwritten query cache in router context; pass the actual `QueryClient`. Query SSR dehydration/hydration is a separate protocol; Router's serialization does not automatically transfer it. See [TanStack Query](tanstack-query.md) and [data architecture](architecture-data.md).

Exact shared-core defaults: `defaultStaleTime: 0`, `defaultPreloadStaleTime: 30_000`, `defaultPreloadGcTime: 300_000`, `defaultGcTime: 300_000`. Distinguish freshness from retention. The old source's `defaultGsTime` and `defaultPreloadMaxAge` are not the verified options. Use `defaultGcTime` and `defaultPreloadStaleTime`/`defaultPreloadGcTime`. These are not `gcTime` options of TanStack Query. [Exact core RouterOptions](https://unpkg.com/@tanstack/router-core@1.171.38/dist/esm/router.d.ts).

### Pending, errors, not-found, and deferred results

Set `pendingComponent`/`errorComponent`/`notFoundComponent` on the owning route or their router-wide `default*` equivalents. `pendingMs` delays pending UI and `pendingMinMs` avoids a flash; these do not change the service's deadline. `shouldReload` controls whether an eligible match reloads; it is not a substitute for including all result-changing dependencies. `errorComponent` receives `{ error, reset }`; loader failures are not successful empty results. In this adapter the failed match's `reset` invalidates the router; a rendering boundary also needs its own reset. A retry button should invoke that supplied callback rather than forcing a document reload. `onCatch`/`defaultOnCatch` observe boundary errors; do not disable the global catch boundary merely to suppress an exception.

`throw notFound()` is distinct from an ordinary error and uses the nearest eligible not-found boundary (`notFoundMode: 'fuzzy'`) or root mode when selected. A domain 404 can use `notFound({ routeId })` to choose the owning boundary; an unmatched URL is separate from a missing entity in a matched loader. Keep a root not-found UI even when resource routes have local boundaries. Server HTTP status still requires the SSR response protocol.

For non-critical work, return a promise-valued field from a loader (optionally wrapped with `defer`) while awaiting critical data first; pass its exact promise to a consumer rather than awaiting everything and claiming streaming. This complete **contextual promise consumer** takes an application/loader-owned promise and uses the Vue adapter's actual required `children` function prop, not an assumed default-slot API:

```vue
<script setup lang="ts">
import { h } from 'vue'
import { Await } from '@tanstack/vue-router'
defineProps<{ promise: Promise<string> }>()
function renderText(text: string) { return h('p', text) }
</script>

<template>
  <Suspense>
    <Await :promise="promise" :children="renderText" />
    <template #fallback><p role="status">Loading details</p></template>
  </Suspense>
</template>
```

Rejected promises need an enclosing route/error boundary; `<Suspense>` is not an error handler. `useAwaited({ promise })` instead returns `[data, deferredPromise]` (not a ref), and throws its pending promise/error internally; prefer `Await`'s async setup rather than assuming thrown React promises automatically implement Vue streaming. Browser deferred display and server streamed serialization are different acceptance gates.

`remountDeps` returns a small JSON-serializable dependency value; the Vue adapter `JSON.stringify`s it as the component key. For example, `remountDeps: ({ params }) => params.itemId` deliberately resets local detail state on item changes. It does **not** return the source's claimed `'before'`/`'after'` timing modes. Preserve a draft elsewhere before forcing remount; freshness/loader dependency changes need not destroy a form.

[Vue match/error/remount runtime](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/Match.js), [required Await props/runtime](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/awaited.js), [core route options](https://unpkg.com/@tanstack/router-core@1.171.38/dist/esm/route.d.ts).

### Advanced incumbent configuration and lifecycle

| Existing requirement | Contract / failure boundary |
| --- | --- |
| Browser/hash/server history | `createBrowserHistory`, `createHashHistory`, or `createMemoryHistory` from this package; server request history starts at its complete URL. Do not call Vue Router history factories. |
| Deployment prefix and canonical URL | Align `basepath`, `trailingSlash`, and host rewrites. `rewrite: { input, output }`/`composeRewrites` are a bidirectional URL transformation, not an auth guard or string prefix patch; test deep links and generated links both ways. |
| Masked location | `createRouteMask({ routeTree, from, to, params })` and router `routeMasks`, or a navigation's `mask`, separate rendered/internal from visible location. A full reload must still have a real routable policy; masking is not secrecy, validation, or authorization. |
| Route metadata / wrappers | `context` is a route context callback; `beforeLoad` adds async context before child loaders. `Wrap`/`InnerWrap` render wrappers must forward their slot and preserve provider ownership; do not reinitialize the router on each render. |
| Lifecycle effects | `onEnter`, `onStay`, `onLeave` observe route matches. `router.subscribe('onResolved', listener)` returns an unsubscribe function: register once per application/component owner and dispose that subscription when the owner stops. Keep route-loading inputs in loaders, not side effects in subscriptions. |
| View transitions | `defaultViewTransition` or navigation `viewTransition` opts into the browser API where supported; it is not a guarantee of animation or a replacement for reduced-motion/accessibility policy. |
| Virtual/scrolled panels | `useElementScrollRestoration({ id, getElement })` reads the saved entry for a stable panel ID; the panel/virtualizer applies the offset. Keep IDs stable and wait for the target to exist. This is independent of main-window focus and history restoration. |

Do not copy a `router.dispose()` call from another adapter/version: it is not declared in this researched core instance contract. Keep the actual subscription removers and follow the provider/history owner's lifecycle. Use factories rather than deprecated `Route`/`RootRoute`/`RouteApi`/`FileRoute` classes; `getRouteApi` replaces direct `RouteApi` construction. `createLazyRoute`/`createLazyFileRoute` represent non-critical options when an incumbent already uses manual lazy routes; do not move critical loaders into deprecated `FileRouteLoader` files.

[Exact core router options/methods](https://unpkg.com/@tanstack/router-core@1.171.38/dist/esm/router.d.ts), [route factories and mask type](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/route.d.ts), [element scroll hook](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ScrollRestoration.d.ts).

## File-based SFC alternative

Researched generator: **`@tanstack/router-plugin@1.168.47`** (Node `>=20.19`), sharing core `1.171.38` with the Vue adapter. Its exact schema accepts `target: 'vue'`; the React-oriented package description is not proof that Vue configuration is absent. [Metadata](https://registry.npmjs.org/@tanstack/router-plugin/1.168.47), [target/config declarations](https://unpkg.com/@tanstack/router-plugin@1.168.47/dist/esm/core/config.d.ts).

Install it as a development dependency. These are a complete **replacement** for the code-based application, not extra files to add while retaining its registered router. The existing toolchain supplies Vite and `@vitejs/plugin-vue`. No JSX plugin is needed for these `.ts`/`.vue` files; add `@vitejs/plugin-vue-jsx` only if authoring Vue JSX/TSX.

```sh
bun add --dev --exact @tanstack/router-plugin@1.168.47
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'vue', autoCodeSplitting: true }), vue()],
})
```

```ts
// src/routes/__root.ts
import { h } from 'vue'
import { createRootRoute, Outlet } from '@tanstack/vue-router'

export const Route = createRootRoute({ component: () => h(Outlet) })
```

```ts
// src/routes/index.route.ts
import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/')({})
```

```vue
<!-- src/routes/index.component.vue -->
<template><h1>Generated Vue route</h1><p>This page is local and read-only.</p></template>
```

```ts
// src/main.ts
import { createApp, h } from 'vue'
import { createRouter, RouterProvider } from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })
declare module '@tanstack/vue-router' {
  interface Register { router: typeof router }
}
createApp({ setup: () => () => h(RouterProvider, { router }) }).mount('#app')
```

`routeTree.gen.ts` is actual plugin output, not a missing hand-authored module: generation must run before route-aware type checks. Do not manually edit it. Keep the generated declaration/tree synchronized after file renames. Defaults scan `src/routes`; `.route.ts` supplies configuration and `.component.vue` supplies the view. `$param` is dynamic, `_layout` creates a pathless layout, `_` suffix unnests, `(group)` organizes without a URL segment, and `-` prefix excludes a file. Parent layouts still need `Outlet`. Check the **published Vue README**, not React filename assumptions.

Automatic splitting defaults separate component/pending/error/not-found nodes. The generator's grouping schema also accepts `loader`, but that does not mean every loader is split by default. Avoid unnecessary `.lazy.ts` loader files; keep route-critical loading in the route config. Confirm actual chunks/HMR with this exact Vue target rather than promising React-plugin parity. [Published conventions](https://cdn.jsdelivr.net/npm/@tanstack/vue-router@1.170.41/README.md), [exact splitting defaults/schema](https://unpkg.com/@tanstack/router-plugin@1.168.47/dist/esm/core/config.d.ts).

Keep generator customization in the actual `tanstackRouter` options: `routesDirectory`, `generatedRouteTree`, `routeFileIgnorePrefix`/`routeFileIgnorePattern`, `indexToken`, and `routeToken` control scanning/naming. For chunk changes, `codeSplittingOptions.defaultBehavior` or `.splitBehavior({ routeId })` sets global/per-route groupings, while a route's `codeSplitGroupings` overrides grouping at that route; for example `[['component'], ['errorComponent', 'notFoundComponent']]`. Do not copy the old `codeSplitting.defaultBehavior` spelling or assume loader splitting is enabled by default. Reserve `createLazyFileRoute` for an intentionally manual non-critical subset; regenerated `FileRoutesByPath` must describe renamed files before `createFileRoute` literals can infer correctly.

## SSR, scroll, and focus: explicit boundaries

Verified Vue entrypoints are `@tanstack/vue-router/ssr/server` and `/ssr/client`. This is **not** a complete deployment recipe. Missing Vue SSR integration guarantees are an adoption constraint, not permission to copy React rendering code.

| Verified API | Actual 1.170.41 contract | Incorrect substitution to reject |
| --- | --- | --- |
| `renderRouterToString` | `({ router, responseHeaders: Headers, App: Component }) => Promise<Response>` | Positional `renderRouterToString(router)` returning an HTML string. |
| `RouterServer` | Vue component taking required `router` prop | A Node HTTP request handler. |
| `RouterClient` | Vue component taking required `router` prop | `new RouterClient(router)` constructor. |
| `defaultRenderHandler` / `defaultStreamHandler` | Shared-core handler callbacks returning Web responses | Assumed `{ req, res, router }` Node handlers. |
| `Html`, `Body`, `HeadContent`, `Scripts` | Vue adapter document/head components | React elements/ReactDOM hydration APIs. |

[Server exports](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/server.d.ts), [string renderer](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/renderRouterToString.d.ts), [client component](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/RouterClient.d.ts), [default handler runtime](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/defaultRenderHandler.js).

Before SSR adoption, implement and verify the entire protocol: a fresh request router/context/cache; memory history with the complete request URL (`createMemoryHistory({ initialEntries: [url] })`); matched loader execution; status/redirect/error response headers; server serialization scripts; the matching client router and hydration protocol; a real asset manifest/document shell; safe serialization and CSP. A client SPA provider alone does not establish any of these. Returning deferred promises from loaders also requires working streaming serialization, error propagation, and client consumption—not simply Vue `<Suspense>`.

In the published Vue client implementation, `RouterClient` calls core `hydrate(router)` and waits for mount before showing `RouterProvider`; it has module-level hydration state. Do not infer multi-root isolation or a drop-in `createSSRApp` hydration sequence from a React example. Full-document and nested mounting must be checked against an actual supported Vue example and build output. Route `ssr` options (`false`/`'data-only'`) belong to the matched SSR protocol, not a browser-history shortcut. [Exact client implementation](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/RouterClient.js), [server implementation](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/renderRouterToString.js).

Document metadata is also part of that protocol: route `head()` returns `{ meta, links, styles, scripts }`, `headers()` returns response header values, and `scripts()` supplies body scripts. `HeadContent` consumes resolved head tags; `Scripts`/`Asset` use the actual generated asset/serialization metadata, not hardcoded development URLs. `Html`/`Body` supply the document shell, and `ScriptOnce` is a one-shot script facility, **not** an HTML sanitizer. Keep inline script serialization/CSP nonce handling in the verified server integration. `ClientOnly` with a fallback, or a route's `ssr: false`, defers browser-only widgets; `'data-only'` transfers matched data without server-rendering that route. Neither can repair a different server/client route tree or module-singleton user cache. Server subscription hooks return initial snapshots rather than live watcher updates; finish loader work before rendering. A local head configuration, for example `head: () => ({ meta: [{ title: 'Local catalog' }] })`, is contextual route configuration, not a full SSR entry.

`scrollRestoration: true` configures router scroll restoration; don't add the deprecated `ScrollRestoration` component. Saved scroll is not focus management. After successful page navigation, update/announce the title and focus the appropriate heading/main **after the view exists**; preserve focus on search-only updates. Avoid stealing focus during speculative preloading or failed/blocked navigation. For delayed content coordinate at the page's completion boundary. See [accessibility](accessibility.md).

## Verification boundary

The code-based catalog and file-based root are complete browser alternatives inside an existing Vue/Vite TypeScript app. `applyPermissions` is explicitly a contextual extension; no real identity provider/backend is supplied. No SSR runnable claim is made: exact signatures and the required protocol are documented instead. Research inspected registry, published declarations/runtime, and official source; no compilation, browser, build, or runtime verification is claimed here.

An integrating agent should check generated route inference/`Register`; malformed and repeated search values; list/detail navigation; denied redirects and auth snapshot invalidation; missing item/route boundaries; loader dependency changes and obsolete loads; intent preloads without side effects; Query/cache freshness ownership; back/forward/hash restoration and focus; plugin output after renames; and per-request SSR/serialization/hydration isolation if adopting SSR. Unknown Vue production-support status remains explicit until authoritative upstream evidence resolves it.

## Sources

- [Vue adapter 1.170.41 metadata](https://registry.npmjs.org/@tanstack/vue-router/1.170.41), [published README](https://cdn.jsdelivr.net/npm/@tanstack/vue-router@1.170.41/README.md), [Vue examples](https://github.com/TanStack/router/tree/main/examples/vue).
- [Exact Vue exports](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/index.d.ts), [route/component types](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/route.d.ts), [loader refs](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/useLoaderData.d.ts).
- [Shared-core 1.171.38 router options](https://unpkg.com/@tanstack/router-core@1.171.38/dist/esm/router.d.ts), [route options](https://unpkg.com/@tanstack/router-core@1.171.38/dist/esm/route.d.ts).
- [Generator 1.168.47 metadata](https://registry.npmjs.org/@tanstack/router-plugin/1.168.47), [Vue target/splitting schema](https://unpkg.com/@tanstack/router-plugin@1.168.47/dist/esm/core/config.d.ts).
- [Vue SSR renderer signature](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/renderRouterToString.d.ts), [RouterServer](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/RouterServer.d.ts), [RouterClient](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/RouterClient.d.ts), [default handler](https://unpkg.com/@tanstack/vue-router@1.170.41/dist/esm/ssr/defaultRenderHandler.js).
