# Client state: Pinia and TanStack Store

Read when choosing a state owner, implementing stores, diagnosing stale destructuring, or isolating state by app/request. For authentication read [auth.md](auth.md); URL state belongs to [routing.md](routing.md). Server-owned records, invalidation, retries, and optimistic updates belong to [tanstack-query.md](tanstack-query.md) or [pinia-colada.md](pinia-colada.md), not a second client-store cache.

For new or existing Nuxt applications, [Nuxt](nuxt.md#request-context-and-state) owns request-scoped `useState` and payloads; [Nuxt integrations](nuxt-integrations.md) owns `@pinia/nuxt` setup when Pinia is selected. The standalone `createPinia`/app-install, custom SSR and browser persistence helpers below are contextual examples, not Nuxt bootstrap/plugin recipes. Reuse store contracts with the framework-provided request instance; do not install another Pinia root.

## Version and selection boundary

Baseline: Vue **3.5.44**, Pinia **4.1.0**, `@vue/devtools-api` **8.2.1**; optional testing companion `@pinia/testing` **2.0.2**. Pinia 4 is ESM-only, requires Vue `^3.5.11` and the devtools API peer; TypeScript `>=5.6.0` is an optional peer. These are [published package requirements](https://registry.npmjs.org/pinia/4.1.0), not requirements inferred from older tutorials. Pinia 3 applications need not migrate during an unrelated change. The bundled local workbench has its own pinned dependencies; do not interpret it as a Pinia 4 compatibility test.

Alternative: `@tanstack/vue-store` **0.11.2**, with exact core dependency `@tanstack/store` **0.11.2**. This is a pre-1.0 library: pin releases and inspect declarations on upgrade. Its Vue peer includes Vue 3; no extra core installation is required. [Package metadata](https://registry.npmjs.org/@tanstack/vue-store/0.11.2).

The following is an architectural recommendation, not an upstream mandate to put every application value in a store:

| State / required lifetime | Owner | Reason / failure to avoid |
| --- | --- | --- |
| Open dialog, input draft, hover | Component `ref` / `reactive` | Keep state and cleanup with the interaction; a global store outlives it |
| Related descendants, one editor/wizard instance | Scoped composable plus typed provide/inject | Create one provider-owned instance, not one instance per consumer |
| Shareable filter, sort, page | Parsed router query/params | Back/forward, refresh, and links must restore the same view; do not maintain competing URL/store copies |
| Cross-route client workflow or preferences | Pinia | Vue integration, devtools, actions, plugins, per-app ownership |
| Framework-independent immutable domain state | TanStack Store | Share pure state/actions with non-Vue consumers; Vue uses selector subscriptions |
| Fetched server records | Query/Colada cache | Cache owns freshness, deduplication, cancellation, and mutations; do not copy its data into Pinia |
| Identity/session/token/active organization | Application's existing session mechanism | Derive UI from its readiness contract; client state is never authorization evidence |
| Durable sensitive data | Authorized backend | Browser persistence, devtools, and hydration payloads are observable and tamperable |

A store definition can be module-scoped; a user-specific **instance** must not be a server module singleton. A small, typed scoped Vue state object is valid production code. Application size alone does not require Pinia.

For a Vuex incumbent, migrate one domain at a time: move its state factory/getters into a uniquely named Pinia store, replace mutations/`commit` with actions or deliberate direct writes, replace namespaced `dispatch` with typed action calls, and migrate every consumer of that domain before removing its old module. Do not mirror one domain in both stores. Pinia supplies conventions, inferred types, action/state devtools, plugins, and HMR integration; scoped Vue state is not inherently untyped or unsuitable for production. SSR isolation and persistence still require explicit ownership. [Vuex migration](https://pinia.vuejs.org/cookbook/migration-vuex.html).

Legacy Pinia upgrade checklist: Vue 2 remains on Pinia 2; Vue 3 target apps use the declared peers above. Replace removed object-only `defineStore({ id, ... })` with `defineStore('id', options)`, and removed `PiniaStorePlugin` with `PiniaPlugin`; then account for Pinia 4's ESM/devtools/diagnostic boundary below. Do not keep aliases for removed signatures. For application typing prefer `ReturnType<typeof useNotesStore>`; use `StoreState<ThatStore>`, `StoreGetters<ThatStore>`, and `StoreActions<ThatStore>` when a generic adapter actually needs only that surface. Reserve `StoreGeneric` for infrastructure that intentionally accepts any store, not domain code that should retain inference. A `StoreDefinition` is the callable definition with `$id`, not its state instance. `setActivePinia`/`getActivePinia` manage a fallback, not a safe way to share request-specific state. [2 → 3 migration](https://pinia.vuejs.org/cookbook/migration-v2-v3.html), [4.1.0 declarations](https://unpkg.com/pinia@4.1.0/dist/pinia.d.ts).

### Shareable URL state

Treat the URL as the committed source for filters, sort, page, and shareable tabs. Parse route query into typed computed values: distinguish `string`, `string[]`, and `null`; allowlist enum values; require a finite positive integer for page with an application upper bound; interpret booleans by explicit strings (`'false'` is truthy in JavaScript). Omit default values when writing and preserve unrelated query keys. Keep typing drafts local, then commit with `router.replace({ query: { ...route.query, q: draft || undefined, page: undefined } })`; use `push` for deliberate history-worthy changes. Handle the returned navigation promise in the UI's error contract. Reset page when its filter changes. Back/forward updates the parsed computed view without copying values into a second store.

Do not install opposing deep watchers to synchronize a Pinia filter copy and the URL; if an incumbent requires a draft, give it an explicit edit/apply boundary. Do not put private form contents, session tokens, or arbitrary serialized store state in URLs. `useRouteQuery` is an optional `@vueuse/router` adapter, not `@vueuse/core`, and does not remove the need for parsing/serialization policy. The complete router-owned implementation and query mutation contract belong to [routing.md](routing.md). [Router query contract](https://router.vuejs.org/guide/essentials/navigation.html), [VueUse router adapter](https://vueuse.org/router/useRouteQuery/).

## Pinia: setup store and consuming component

Install exact versions in an ESM Vue app:

```sh
bun add --exact pinia@4.1.0 @vue/devtools-api@8.2.1
```

These three files form a complete in-memory example in a configured Vue/Vite application. No persistence or backend is implied. The store owns the shared list and its invariants; the component owns the unfinished input and operation error.

```ts
// src/notes-store.ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

interface Note { id: number; title: string }

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const nextId = ref(1)
  const count = computed(() => notes.value.length)

  function addNote(input: string): void {
    const title = input.trim()
    if (!title) throw new Error('Enter a note title.')
    notes.value.push({ id: nextId.value++, title })
  }

  function $reset(): void {
    notes.value = []
    nextId.value = 1
  }

  return { notes, nextId, count, addNote, $reset }
})
```

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useNotesStore } from './notes-store'

const store = useNotesStore()
const { notes, count } = storeToRefs(store)
const { addNote } = store
const title = ref('')
const error = ref<string | null>(null)

function submit(): void {
  error.value = null
  try {
    addNote(title.value)
    title.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not add the note.'
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <label>Note title <input v-model="title" /></label>
    <button type="submit">Add note</button>
  </form>
  <p v-if="error" role="alert">{{ error }}</p>
  <p>{{ count }} notes, stored for this app session only.</p>
  <ul><li v-for="note in notes" :key="note.id">{{ note.title }}</li></ul>
  <button type="button" @click="store.$reset()">Clear notes</button>
</template>
```

```ts
// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
```

Pinia's [setup-store contract](https://pinia.vuejs.org/core-concepts/#setup-stores): returned refs/reactive objects are state, computed refs are getters, functions are actions. Return **all owned state**, including bookkeeping such as `nextId`; do not hide it or return readonly wrappers around owned state. That breaks hydration, devtools, or plugins. Injected dependencies such as the router or external session resources are not store-owned state: use them internally rather than returning them as hydrated state.

The store object unwraps refs: `store.count`, not `store.count.value`. Destructure state/getters with `storeToRefs(store)`; plain `{ count } = store` captures a value. Actions are bound and may be destructured directly. Both `@click="store.$reset"` and `@click="store.$reset()"` preserve a Pinia action's context; arguments/event forwarding, not a blanket `this` rule, determine which to use.

### Option stores remain supported

Use an option store for straightforward state/getter/action modules or an incumbent convention. It is independent of whether consuming components use Composition API.

```ts
// src/preferences-store.ts
import { defineStore } from 'pinia'

type Theme = 'light' | 'dark'
export const usePreferencesStore = defineStore('preferences', {
  state: () => ({ theme: 'light' as Theme, compact: false }),
  getters: {
    isDark: (state): boolean => state.theme === 'dark',
  },
  actions: {
    toggleTheme(): void {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
    },
    setCompact(value: boolean): void {
      this.compact = value
    },
  },
})
```

Option stores provide `$reset()` from `state()`; setup stores must implement their own reset as above. Option actions that use `this` must not be arrow functions. Getters using other getters through `this` should declare a return type. Existing Options API components may keep `mapState`, `mapWritableState`, and `mapActions`; do not force a component rewrite solely to use a store.

### Incumbent Options API components

This complete component consumes the preceding preferences store without rewriting the component to Composition API:

```vue
<script lang="ts">
import { defineComponent } from 'vue'
import { mapActions, mapState, mapStores, mapWritableState } from 'pinia'
import { usePreferencesStore } from './preferences-store'

export default defineComponent({
  computed: {
    ...mapStores(usePreferencesStore),
    ...mapState(usePreferencesStore, { dark: 'isDark' }),
    ...mapWritableState(usePreferencesStore, ['compact']),
  },
  methods: {
    ...mapActions(usePreferencesStore, { toggle: 'toggleTheme' }),
  },
})
</script>

<template>
  <p>Theme: {{ preferencesStore.theme }}; dark: {{ dark }}</p>
  <label><input v-model="compact" type="checkbox" /> Compact layout</label>
  <button type="button" @click="toggle()">Toggle theme</button>
</template>
```

`mapStores` takes **store definitions as separate arguments**, not instances (`usePreferencesStore()`) or an array. Its default suffix is `Store`, appended to the store **id**, not the imported variable name. `mapState` maps state/getters or selector functions to readonly computed properties; it does not prevent nested array/object mutations. Use `mapWritableState` only for writable state/computeds, never a readonly getter. `mapActions` forwards arguments and return values. If an incumbent changes the suffix with `setMapStoreSuffix('')`, call it before helper use and augment `MapStoresCustomization { suffix: '' }` in a module importing `pinia` so runtime and TypeScript agree. `mapGetters` is a deprecated alias; use `mapState` for new mappings. [Options cookbook](https://pinia.vuejs.org/cookbook/options-api.html).

### Cross-store composition, getters, and HMR

- Acquire dependencies once at setup/action entry, before any `await`. Two setup stores may reference each other, but must not both read each other's state while constructing: defer at least one read to a computed getter or action. Cross-store actions can otherwise recurse too; keep workflow orchestration in one owner and make the dependency direction explicit.
- Getters are computed values. A getter returning a function supports parameterized lookup, but the **invocations of that function are not separately cached**; build an index in a computed getter when repeated lookup is expensive. A setup-store writable computed retains its setter through `storeToRefs`/`mapWritableState`.
- The setup helper `defineStore('id', ({ action }) => ...)` can wrap an internal function with `action(fn, 'name')` so internal calls reach `$onAction`. Ordinary returned functions are wrapped already; use the helper only for a concrete internal observation requirement.
- Vite HMR requires `acceptHMRUpdate`, not just a stable store module. Contextual addition to `notes-store.ts`: import `acceptHMRUpdate` from `pinia`, then append `if (import.meta.hot) { import.meta.hot.accept(acceptHMRUpdate(useNotesStore, import.meta.hot)) }`. Keep ids stable; a changed id forces invalidation. Do not use HMR as logout/reset or as evidence that SSR is isolated.

[Composition rules](https://pinia.vuejs.org/cookbook/composing-stores.html), [getters](https://pinia.vuejs.org/core-concepts/getters.html), [HMR](https://pinia.vuejs.org/cookbook/hot-module-replacement.html), [4.1.0 setup helpers](https://unpkg.com/pinia@4.1.0/dist/pinia.d.ts).

### Writes, failures, and subscriptions

- Declare the state shape up front. Vue 3 proxies can track added properties, but adding undeclared store state violates Pinia's declared-state, typing, reset, and hydration contract; it is not a Vue 2 reactivity limitation.
- Direct writes are supported. Put multi-field invariants in actions. `$patch(object)` merges; `$patch(state => ...)` groups collection mutations and must be **synchronous**. Assigning `$state` patches; it does not replace the reactive store object.
- Async actions return promises. Resolve dependencies and other stores before the first `await`; capture the relevant identity and cancel/ignore obsolete work after reset, logout, or org switch. Pinia does not automatically cancel pending work or roll back partial changes.
- Choose one error contract: throw/reject and let the caller catch, or return an explicit discriminated result. Do not return an `Error` as though it were a successful record. A UI event's async handler must handle rejection and release its pending flag in `finally`; a render error boundary alone is not the operation's UX.
- `$onAction(({ after, onError }) => ...)` observes resolved/rejected actions; it is not a substitute for the caller's error contract. Do not log sensitive action arguments, tokens, or complete user records. `$subscribe` observes state; neither API is a transaction, persistence layer, or security audit log.
- Component-created subscriptions normally stop on unmount. Detached `$subscribe(..., { detached: true })` and `$onAction(..., true)` need an explicit owner retaining their returned unsubscribe functions.
- Store watchers live with the store, not the first consuming component. `$dispose()` stops its scope and unregisters the instance; it **does not delete** `pinia.state.value[store.$id]`. Reset/erase sensitive state deliberately before re-creation, and stop external resources too. [Published lifecycle declarations](https://unpkg.com/pinia@4.1.0/dist/pinia.d.ts).

### Subscription timing and action observation

`$subscribe` receives `(mutation, state)`; discriminate `mutation.type` with `MutationType.direct`, `.patchObject`, or `.patchFunction`. Only `patchObject` has `mutation.payload`; `mutation.events` is development debugger data, not production business input. Default direct-write observation follows Vue watcher batching; `{ flush: 'sync' }` observes direct writes synchronously. **A `$patch` emits one grouped notification regardless of `flush`**, not one notification per inner write. Pinia 4 deduplicates identical callback functions; retain the first unsubscribe rather than registering the same callback repeatedly.

This complete observer factory uses the earlier notes store and an application-owned callback, without copying state or logging records:

```ts
// src/observe-notes.ts
import { MutationType, type Pinia } from 'pinia'
import { useNotesStore } from './notes-store'

export function observeNotes(
  pinia: Pinia,
  changed: (count: number, patched: boolean) => void,
  actionFinished: (name: string, failed: boolean) => void,
): () => void {
  const store = useNotesStore(pinia)
  const stopState = store.$subscribe((mutation, state) => {
    changed(state.notes.length, mutation.type !== MutationType.direct)
  }, { detached: true })
  const stopActions = store.$onAction(({ name, after, onError }) => {
    after(() => actionFinished(name, false))
    onError(() => actionFinished(name, true))
  }, true)
  return () => { stopState(); stopActions() }
}
```

`after` receives the actual returned value (resolved value for promises); `onError` sees throws/rejections. In **4.1.0 the runtime rethrows/rejects after notifying `onError`**: returning `false` from that observer does not catch the caller's error, despite stale declaration prose. Keep observers non-throwing so they do not replace the operation's result/error. For an intentional whole-app watcher, `watch(pinia.state, callback, { deep: true })` observes every store; it still needs a lifetime owner and must not become blanket sensitive-state persistence. [4.1.0 runtime](https://unpkg.com/pinia@4.1.0/dist/pinia.js), [state subscriptions](https://pinia.vuejs.org/core-concepts/state.html#subscribing-to-the-state).

## Outside setup, plugins, and SSR

Pass the app's instance explicitly outside setup. Never call `useNotesStore()` eagerly while importing a router/service module. The following factory is complete; a host supplies its root component and calls it once per SSR request (or once for the browser app).

```ts
// src/create-state-app.ts
import { createSSRApp, type Component } from 'vue'
import { createPinia, disposePinia, type StateTree } from 'pinia'
import { useNotesStore } from './notes-store'

export function createStateApp(root: Component, initialState?: Record<string, StateTree>) {
  const app = createSSRApp(root)
  const pinia = createPinia()
  app.use(pinia)
  if (initialState) pinia.state.value = initialState
  const notes = useNotesStore(pinia)
  return { app, pinia, notes, dispose: () => disposePinia(pinia) }
}
```

Server host responsibilities: render the request-local app; serialize only safe, serializable state with an HTML-safe serializer; release request resources after rendering. Client host responsibilities: restore that payload into `pinia.state.value` **before any client `useStore()` call**, then hydrate with the matching app. Do not insert raw `JSON.stringify()` into a script tag without HTML escaping. See [debugging-ssr.md](debugging-ssr.md) for hydration and [official SSR guidance](https://pinia.vuejs.org/ssr/). `skipHydrate` is for a setup-store value that should not be hydrated; `markRaw` prevents proxying. Neither makes secrets safe to serialize or authorizes sharing a singleton. Nuxt must use its framework integration instead of copying this Vite host lifecycle.

Hydration extensions: option stores with custom/client-only refs use `hydrate(storeState, initialState)` to reconstruct the ref/resource when plain value restoration is insufficient; setup stores can apply `skipHydrate` to the specific returned value, and `shouldHydrate(value)` reports that marker. Do not use either to bypass request isolation. Reactive `Map`/`Set` setup state is cleared before applying initial state in 4.1.0, rather than unioning old entries; serialization still needs a format that restores the intended types. Functions, DOM nodes, sockets, and SDK resources are not JSON state. With Nuxt, install its matching `@pinia/nuxt` integration (1.x for Pinia 4) and register plugins on that request's framework-provided Pinia; do not create a second root or copy browser globals into SSR. [Hydration declarations](https://unpkg.com/pinia@4.1.0/dist/pinia.d.ts), [runtime](https://unpkg.com/pinia@4.1.0/dist/pinia.js), [Nuxt integration](https://pinia.vuejs.org/ssr/nuxt.html).

Register `pinia.use(plugin)` before creating the stores it must affect; registration may happen before **or after** app installation. Pre-install registrations are queued until `app.use(pinia)`; neither path retrofits already-created stores. Use `PiniaPlugin`/`PiniaPluginContext`, typed module augmentation for custom properties, and `markRaw` for external clients. Added state must be reflected in `$state` and store access; plugin-added state is not automatically covered by an option store's `$reset()`. Plugins that wrap actions must preserve return values, rejection, `this`, and disposal. [Plugin contract](https://pinia.vuejs.org/core-concepts/plugins.html), [4.1.0 registration queue and store extension](https://unpkg.com/pinia@4.1.0/dist/pinia.js).

### A typed state-extending plugin

This complete plugin adds one non-sensitive flag to every store while preserving hydrated values and each store's existing reset behavior:

```ts
// src/operation-flag-plugin.ts
import { toRef } from 'vue'
import type { PiniaPlugin } from 'pinia'

declare module 'pinia' {
  interface PiniaCustomProperties { hasError: boolean }
  interface PiniaCustomStateProperties<S> { hasError: boolean }
}

export const operationFlagPlugin: PiniaPlugin = ({ store }) => {
  if (!Object.hasOwn(store.$state, 'hasError')) store.$state.hasError = false
  Object.assign(store, { hasError: toRef(store.$state, 'hasError') })
  const reset = store.$reset.bind(store)
  store.$reset = () => {
    reset()
    store.hasError = false
  }
}
```

Register with `createPinia().use(operationFlagPlugin)` before app installation/store creation. Reserve the added name across store definitions; a plugin must not silently overwrite domain state. Both accesses share one value; do not return the flag again and duplicate its devtools display. Setup stores still need their own `$reset`; the plugin deliberately preserves that requirement.

For non-state capabilities, return a typed property from the plugin (declare it in `PiniaCustomProperties`) and apply `markRaw` to external clients. The context exposes `app`, `pinia`, `store`, and normalized `options`, including extracted setup actions. Custom options belong in `DefineStoreOptionsBase<S, Store>`; put option-store values in the options object and setup-store values in `defineStore`'s third argument. Use `StoreActions<Store>` to constrain action-name option maps. Wrappers must return the original sync value/promise, preserve rejection and binding, and compose `$dispose` to stop added external resources. Do not depend on `_p`/`_s` internals or treat `piniaSymbol` (an explicitly unstable advanced injection export) as a normal app API. [Plugin typing and lifecycle](https://pinia.vuejs.org/core-concepts/plugins.html).

Persistence is optional and not built into Pinia. Persist an allowlist of non-sensitive preferences, not all `$state`. Define schema version/migration, validation on hydration, expiry, unavailable/quota-error behavior, and user/org namespaces. Read browser storage only in a client lifecycle. Never persist tokens, passwords, SDK resources, authorization decisions, or another user's cached data. Treat restored content as untrusted input. Logout must remove identity-scoped persisted state, not just reset the displayed refs.

### Client-only preference persistence

This complete adapter uses the earlier preferences store. Invoke once after client mount with `window.localStorage` and an application error callback; retain its returned teardown. Acquiring `localStorage` itself can throw, so catch that in the client host too. The schema deliberately excludes identity or server records:

```ts
// src/persist-preferences.ts
import type { Pinia } from 'pinia'
import { usePreferencesStore } from './preferences-store'

export function persistPreferences(
  pinia: Pinia, storage: Storage, report: (message: string) => void,
): () => void {
  const store = usePreferencesStore(pinia)
  const key = 'preferences:v1'
  try {
    const raw = storage.getItem(key)
    if (raw !== null) {
      const value: unknown = JSON.parse(raw)
      if (typeof value !== 'object' || value === null ||
          !('version' in value) || value.version !== 1 ||
          !('theme' in value) || (value.theme !== 'light' && value.theme !== 'dark') ||
          !('compact' in value) || typeof value.compact !== 'boolean') {
        throw new Error('Invalid saved preferences.')
      }
      store.$patch({ theme: value.theme, compact: value.compact })
    }
  } catch {
    report('Saved preferences could not be restored; using current defaults.')
  }
  return store.$subscribe((_mutation, state) => {
    try {
      storage.setItem(key, JSON.stringify({
        version: 1, theme: state.theme, compact: state.compact,
      }))
    } catch {
      report('Preferences could not be saved on this device.')
    }
  }, { detached: true })
}
```

This schema has no expiry or migration because it holds anonymous preferences only; a future schema must explicitly migrate or discard v1, not reinterpret old JSON. This is one-tab persistence, not cross-tab synchronization. If preferences are identity-scoped in the actual application, namespace the key and remove/rebind it on identity change; do not attach a second writer to the same key.

Pinia 4 upgrade boundary: ESM-only distribution, required devtools peer, and Nostics diagnostics replace older warning presentation. Diagnose the missing/incorrect app instance or peer instead of suppressing a diagnostic. Pinia **4.1.0** additionally exposes `getStores(pinia)` for enumerating an app's stores; prefer an explicit list of identity-sensitive reset owners over resetting unrelated preferences indiscriminately. [Release](https://github.com/vuejs/pinia/releases/tag/v4.1.0).

### Pinia 4 diagnostic workflow

Use the development diagnostic's code and first application frame to find the owner; production absence does not prove correctness. The **4.1.0** runtime includes `PINIA_R1008` as well as the earlier seven codes:

| Diagnostic / failure | Correction |
| --- | --- |
| `PINIA_R1001` | Pass definitions separately to `mapStores`, not an array |
| `PINIA_R1002` | Rename colliding getter/state keys |
| `PINIA_R1003` | Return a fresh plain object from option `state()` |
| `PINIA_R1004` / no active Pinia | Follow the import chain for eager `useStore()`; install Pinia before router initial navigation; pass request/app Pinia explicitly outside setup |
| `PINIA_R1005` | Keep HMR store ids stable or accept full invalidation |
| `PINIA_R1006` | Make intended state a ref/reactive value; explicitly `markRaw` intentional external values rather than expecting `storeToRefs` to expose them |
| `PINIA_R1007` | Remove duplicate callback registration; retain its original unsubscribe |
| `PINIA_R1008` | Drop references to disposed/replaced store instances; reacquire through the definition and do not dispose an obsolete instance again |
| Setup store lacks `$reset` | Implement and return a reset for every owned field |
| `Pinia destroyed` | Do not reuse `disposePinia`'s dead root; create a new app/test root |

An ordinary `<script>` top-level runs at module import; `<script setup>` runs per instance. Moving `useStore()` into a normal `setup()` is also valid. A dynamic import is not the fix for wrong instance ownership, and optional `getActivePinia()` checks must not silently hide a required store dependency. [Exact diagnostic catalog and runtime](https://unpkg.com/pinia@4.1.0/dist/pinia.js).

## TanStack Store: immutable state with Vue subscriptions

Use this alternative when the domain store must be framework-independent or an incumbent app already uses it. Do not install both libraries to manage the same values. Core stores are not Vue proxies: reading `store.state` in a template does **not** establish a Vue subscription.

The following module and SFC form a complete focused example. Passing a factory-created store as a prop makes its ownership explicit; independent editors get independent stores, while siblings can receive the same instance.

```ts
// src/selection-store.ts
import { createStore } from '@tanstack/vue-store'

interface SelectionState { selected: readonly string[]; revision: number }

export function createSelectionStore() {
  const store = createStore<SelectionState>({ selected: [], revision: 0 })
  function toggle(id: string): void {
    store.setState((previous) => ({
      selected: previous.selected.includes(id)
        ? previous.selected.filter((value) => value !== id)
        : [...previous.selected, id],
      revision: previous.revision + 1,
    }))
  }
  function reset(): void {
    store.setState(() => ({ selected: [], revision: 0 }))
  }
  return { store, toggle, reset }
}
```

```vue
<!-- src/SelectionPane.vue -->
<script setup lang="ts">
import { useSelector } from '@tanstack/vue-store'
import { createSelectionStore } from './selection-store'

const props = defineProps<{ selection: ReturnType<typeof createSelectionStore> }>()
const selected = useSelector(props.selection.store, (state) => state.selected)
const revision = useSelector(props.selection.store, (state) => state.revision)
const choices = ['alpha', 'beta', 'gamma']
</script>

<template>
  <button v-for="id in choices" :key="id" type="button"
    :aria-pressed="selected.includes(id)" @click="props.selection.toggle(id)">
    {{ id }}
  </button>
  <p>{{ selected.length }} selected; revision {{ revision }}</p>
  <button type="button" @click="props.selection.reset()">Reset selection</button>
</template>
```

```vue
<!-- src/App.vue; alternative to the Pinia example -->
<script setup lang="ts">
import SelectionPane from './SelectionPane.vue'
import { createSelectionStore } from './selection-store'
const selection = createSelectionStore()
</script>

<template><SelectionPane :selection="selection" /></template>
```

`useSelector(source, selector?, { compare? })` returns a readonly Vue ref and subscribes until its effect scope is disposed. Call it synchronously in setup/an owned effect scope. Default equality is **`===`**, not shallow comparison. For selectors producing fresh objects, import `shallow` and pass `{ compare: shallow }`; prefer a cheap scalar/reference selector when possible. Do not write to the returned ref or mutate nested selected objects. `readonly` protects the Vue-facing value; it is not deep immutability enforcement for raw core state. [Exact adapter implementation](https://unpkg.com/@tanstack/vue-store@0.11.2/src/useSelector.ts).

`setState(previous => next)` uses immutable replacement: create new objects/arrays along changed paths and preserve references on unchanged paths. Do not `push` into a core array and return the same root; change detection/selectors can miss it. `createStore(() => source.get()...)` creates derived readonly state. `createAtom` and `useAtom` provide an alternative writable atom model; `useAtom(atom)` returns `[readonlyRef, setter]`. `batch(() => ...)` groups synchronous updates, not async transactions. `createAsyncAtom` can represent a local asynchronous computation, but it does not replace a remote-data cache's key isolation, invalidation, or retry policy.

Outside Vue, `const subscription = store.subscribe(value => ...)` returns an object: dispose with `subscription.unsubscribe()`, not `subscription()`. A browser module singleton may intentionally share one store; SSR must create/inject it per request and dispose subscriptions. This adapter has no Pinia plugin, reset, devtools, or hydration contract automatically attached; application code owns those needs.

Migration: prefer `useSelector` over deprecated `useStore` (whose third argument is a bare comparator); avoid experimental `_useStore` in baseline examples. `createStoreContext` is **not exported** by 0.11.2. The modern factory API supersedes older `new Derived`/`new Effect` examples; the published core still exports `Store`, so do not claim its constructor has vanished. [Exports](https://cdn.jsdelivr.net/npm/@tanstack/vue-store@0.11.2/src/index.ts), [core source](https://cdn.jsdelivr.net/npm/@tanstack/store@0.11.2/src/store.ts).

### Atoms, derived stores, actions, and batching

This complete model and component demonstrate core interop without exposing a writable Vue ref:

```ts
// src/counter-model.ts
import { batch, createAtom, createStore } from '@tanstack/vue-store'

export function createCounterModel() {
  const step = createAtom(1)
  const counter = createStore(0, ({ setState, get }) => ({
    increment: () => setState((previous) => previous + step.get()),
    reset: () => setState(() => 0),
    isPositive: () => get() > 0,
  }))
  const doubled = createStore(() => counter.get() * 2)
  function resetAll(): void {
    batch(() => { step.set(1); counter.actions.reset() })
  }
  return { step, counter, doubled, resetAll }
}
```

```vue
<!-- src/CounterPane.vue -->
<script setup lang="ts">
import { useAtom, useSelector } from '@tanstack/vue-store'
import { createCounterModel } from './counter-model'

const model = createCounterModel()
const [step, setStep] = useAtom(model.step)
const count = useSelector(model.counter)
const doubled = useSelector(model.doubled)
</script>

<template>
  <p>{{ count }}; doubled: {{ doubled }}; step: {{ step }}</p>
  <button type="button" @click="setStep((previous) => previous + 1)">Increase step</button>
  <button type="button" @click="model.counter.actions.increment()">Increment</button>
  <button type="button" @click="model.resetAll()">Reset both</button>
</template>
```

The actions factory receives bound `get`/`setState`; pass an **updater** to `setState`, not an object literal copied from an obsolete recipe. A function first argument creates a readonly derived store; its dependency reads must happen synchronously through core `.get()`/`.state`. Its optional `previous` argument is the prior derived value, not an actions factory in a second argument. Writable `createAtom(value, { compare? })` accepts direct values or updaters through `.set`; computed `createAtom(fn)` has no setter. Core atom equality defaults to **`Object.is`**, distinct from the Vue adapter's `===`. `shallow` compares Maps/Sets by entries, Dates by timestamp, and own string/symbol keys with `Object.is`; it is not recursive equality.

`batch` flushes at the end of the outermost synchronous callback; awaiting inside it does not create an async transaction. `flush()` drains queued core effects and is a no-op while a batch is open; it is not Vue `nextTick()` or a network-wait helper. Outside Vue, `subscribe` accepts a callback or an observer (`next`/`error`/`complete`), with `toObserver` available for normalization. Subscribing does **not** emit the initial value in 0.11.2: read `get()` separately if initialization is needed, then own `unsubscribe()`. [Store/actions implementation](https://unpkg.com/@tanstack/store@0.11.2/src/store.ts), [atom/batch/observer implementation](https://unpkg.com/@tanstack/store@0.11.2/src/atom.ts), [shallow implementation](https://unpkg.com/@tanstack/store@0.11.2/src/shallow.ts).

### Local async computation and selector diagnostics

This complete browser-side factory reads an application-supplied file; it is not a fake remote-data endpoint:

```ts
// src/file-preview.ts
import { createAsyncAtom } from '@tanstack/vue-store'

export function createFilePreview(file: File) {
  return createAsyncAtom(async () => file.text())
}
```

Create one preview per file/job and consume it with `useSelector(preview)` in setup. Branch on `.value.status` in script (template refs unwrap): `pending` has no data, `done` has `data: string`, `error` has `error: unknown` requiring safe display. The `async` callback turns synchronous throws into rejected promises. This 0.11.2 primitive does not provide abort, retries, invalidation, or stale-generation suppression; do not reuse a dependency-changing async atom for competing identity/file jobs and assume latest-result-wins. Dispose the old Vue scope and create/key a new preview owner; external side effects still need explicit cleanup. For server records use the cache references above. Infer the status type from the atom rather than importing the unexported `AsyncAtomState`. [Exact async implementation](https://unpkg.com/@tanstack/store@0.11.2/src/atom.ts).

When a view is stale, check in order: subscribed with `useSelector` rather than reading raw `.state`; changed paths replaced immutably; selector/equality neither allocates every time nor hides meaningful changes; scope still active; source instance still the intended one. The hook captures its source and selector and recomputes on **core notifications**, not on reactive props read inside the selector. For a prop-selected key, subscribe to the required stable core slice then derive the key with Vue `computed`; for a different store instance remount/key the owning scope or explicitly rebuild its subscription. Do not assume changing a prop retargets an existing subscription. [Exact adapter](https://unpkg.com/@tanstack/vue-store@0.11.2/src/useSelector.ts).

### Incumbent and historical Store APIs

For an incumbent using experimental `_useStore`, call `_useStore(store, selector, { compare? })` synchronously in setup; the selector is required, even for identity. It returns `[readonlyRef, store.actions]` for an actions-factory store, otherwise `[readonlyRef, store.setState]`. Keep writes through that second element and pin the experimental adapter; new code above separates `useSelector` and actions. [Exact tuple implementation](https://unpkg.com/@tanstack/vue-store@0.11.2/src/_useStore.ts).

On 0.10 → 0.11 migration, replace `{ equal }`/implicit shallow assumptions with explicit `{ compare: shallow }` on `useSelector` when producing object/array slices; deprecated `useStore` instead takes a **bare comparator** as argument three. On pre-0.9 migration, replace `new Derived(fn)` with `createStore(fn)` and its readonly result, and replace `new Effect(...)` with `subscribe` plus owned `unsubscribe`. `new Store` remains exported in 0.11.2; prefer factories but do not mechanically delete valid incumbent constructor usage. Build-format-only changes do not justify a state rewrite.

## Verification boundary

Examples are authored, complete client-state recipes, not an assertion of executed tests. Parent/application verification should cover: reactive updates after destructuring; reset of every owned field; thrown/rejected action handling; disposal of detached subscriptions; two concurrent SSR requests with separate state; hydration before store creation; storage-denied/malformed-payload handling if persistence is added; immutable selector notifications; and identity teardown described in [auth.md](auth.md).

For store unit tests use a fresh `createPinia()` per test (`setActivePinia` is a test convenience, not request isolation). Component tests may use `createTestingPinia`; actions are stubbed by default, so such a test does not prove action behavior. Run real-action tests with `stubActions: false` or an actual Pinia instance, and provide the test runner's spy when required. `@pinia/testing@2.0.2` requires Pinia `>=4.1.0`; do not combine it blindly with a Pinia 3 fixture. See [testing.md](testing.md) and [testing cookbook](https://pinia.vuejs.org/cookbook/testing.html).

### Real-store and testing-Pinia contracts

This complete Vitest unit test exercises the actual notes actions, not a mocked success:

```ts
// src/notes-store.test.ts
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia'
import { useNotesStore } from './notes-store'

let pinia: Pinia
beforeEach(() => { pinia = createPinia(); setActivePinia(pinia) })
afterEach(() => { disposePinia(pinia); setActivePinia(undefined) })

it('adds trimmed notes and resets every owned field', () => {
  const notes = useNotesStore()
  notes.addNote('  First  ')
  expect(notes.notes).toEqual([{ id: 1, title: 'First' }])
  expect(notes.count).toBe(1)
  expect(() => notes.addNote(' ')).toThrow('Enter a note title.')
  notes.$reset()
  expect(notes.notes).toEqual([])
  expect(notes.nextId).toBe(1)
})
```

For plugin unit tests, install the real root into `createApp({})` before creating stores; `.use(plugin)` without app installation does not apply queued plugins. Dispose roots between tests. For component isolation, configure `createTestingPinia({ initialState: { notes: { notes: [], nextId: 1 } }, createSpy: vi.fn, stubActions: false })` with imports from `@pinia/testing` and `vitest` in the host test; supply it as an installed plugin. `initialState` is keyed by **store id** and patches on creation. `stubActions` can instead be a name array or `(name, store) => boolean`; real actions remain spied. Pass store plugins in its `plugins` option, not a later `testingPinia.use()` call; `fakeApp: true` supplies app context for standalone plugin tests. `stubPatch`/`stubReset` separately control those operations. Testing getters can be forced by assignment and restored by assigning `undefined`; that is a testing-Pinia facility, not a production writable-getter contract. These testing recipes are proposed, not executed here. [2.0.2 implementation](https://unpkg.com/@pinia/testing@2.0.2/dist/index.mjs), [testing cookbook](https://pinia.vuejs.org/cookbook/testing.html).

## Sources

- [Pinia 4.1.0 metadata](https://registry.npmjs.org/pinia/4.1.0), [declarations](https://unpkg.com/pinia@4.1.0/dist/pinia.d.ts), [release](https://github.com/vuejs/pinia/releases/tag/v4.1.0).
- [Pinia stores](https://pinia.vuejs.org/core-concepts/), [state/reset/subscriptions](https://pinia.vuejs.org/core-concepts/state.html), [actions](https://pinia.vuejs.org/core-concepts/actions.html), [plugins](https://pinia.vuejs.org/core-concepts/plugins.html), [SSR](https://pinia.vuejs.org/ssr/).
- [TanStack Vue Store 0.11.2 metadata](https://registry.npmjs.org/@tanstack/vue-store/0.11.2), [Vue quick start](https://tanstack.com/store/latest/docs/framework/vue/quick-start), [selector source](https://unpkg.com/@tanstack/vue-store@0.11.2/src/useSelector.ts), [core source](https://cdn.jsdelivr.net/npm/@tanstack/store@0.11.2/src/store.ts).
- [Pinia testing 2.0.2 metadata](https://registry.npmjs.org/@pinia/testing/2.0.2).
