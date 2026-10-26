# VueUse integrations: explicit peers and lifetimes

Read when an existing app needs Vue bindings around Axios, focus-trap, universal-cookie, or another supported utility. Core browser/reactivity utilities belong to [VueUse](vueuse.md), validation ownership to [forms](forms.md), credentials to [auth](auth.md), and shared server-state ownership to [data architecture](architecture-data.md). Do not add an integration when Vue, browser APIs, or the installed UI component already solve the requirement.

## Exact package and import contract

Baseline: **`@vueuse/integrations@15.0.0`**, **Vue 3.5.44**, Node **>=22**, ESM. The package declares Vue `^3.5.0`, depends on core/shared **15.0.0**, and declares each underlying utility as an **optional peer**. Optional means other integrations need not install it; importing a wrapper still requires that wrapper's peer at runtime. Import the function subpath, not the root barrel, to avoid unnecessarily resolving unrelated peers:

```ts
import { useAxios } from '@vueuse/integrations/useAxios'
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
import { useCookies } from '@vueuse/integrations/useCookies'
```

Only wrappers with a component export have `/component` subpaths: `useAsyncValidator`, `useFocusTrap`, and `useSortable`. For example, `UseFocusTrap` comes from `@vueuse/integrations/useFocusTrap/component`, not `@vueuse/components`. [Exact exports/peers](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/package.json), [published manifest](https://registry.npmjs.org/@vueuse/integrations/15.0.0).

The following exact peer releases were registry-confirmed and fit the declared ranges. This is a declared-version boundary, **not** a claim that every wrapper/peer combination was run or exhaustively integration-tested. Retain a compatible incumbent peer lock rather than upgrading it during an unrelated change.

| Wrapper/subpath | Declared optional peer range | Exact researched release | Use and material boundary |
| --- | --- | --- | --- |
| `useAxios` | `axios ^1` | **1.20.0** | Existing Axios interceptors/adapters; local request state, not query caching. |
| `useFocusTrap` | `focus-trap ^7 \|\| ^8` | **8.2.3** | Custom focus-managed region; not a complete modal system. |
| `useCookies` | `universal-cookie ^7 \|\| ^8` | **8.1.2** | Reactive script-visible cookies; server response persistence is separate. |
| `useAsyncValidator` | `async-validator ^4` | **4.2.5** | Validation-only wrapper; no touched state or submission ownership. |
| `useChangeCase` | `change-case ^5` | **5.4.4** | Reactive casing, not a unique URL slug/security normalizer. |
| `useDrauu` | `drauu ^1 \|\| ^0.4` | **1.0.0** | SVG drawing controller; application owns export persistence and trust. |
| `useFuse` | `fuse.js ^7` | **7.5.0** | In-memory fuzzy search; not backend full-text search. |
| `useIDBKeyval` | `idb-keyval ^6` | **6.3.0** | Async IndexedDB state; no server persistence or transaction-wide application model. |
| `useJwt` | `jwt-decode ^4` | **4.0.0** | Decode claims only; never verification or authorization. |
| `useNProgress` | `nprogress ^0.2` | **0.2.0** | One browser progress-bar owner; not measured completion. |
| `useQRCode` | `qrcode ^1.5` | **1.5.4** | Client data-URL rendering; not a trusted-destination validator. |
| `useSortable` | `sortablejs ^1` | **1.15.7** | DOM-assisted reordering; application owns stable keys and keyboard alternatives. |

Install only selected peers. Commands for the three principal examples:

```sh
bun add --exact @vueuse/integrations@15.0.0 axios@1.20.0 focus-trap@8.2.3 universal-cookie@8.1.2
```

For TypeScript, inspect whether the peer ships declarations; `nprogress`, `qrcode`, and `sortablejs` may also require their corresponding `@types` package in the consuming project. Do not install every peer or bypass missing types with `any` by default.

## `useFocusTrap`: activate only after a real target exists

The wrapper accepts a target ref/getter, selector, or target array and forwards focus-trap options plus `immediate`. It returns `hasFocus`, `isPaused`, `activate`, `deactivate`, `pause`, and `unpause`. There is **no public `updateContainerElements`** on this wrapper; a post-flush watcher updates the underlying trap when resolved targets change. The wrapper deactivates on scope disposal. `activate`/`deactivate` are commands, not promises to await for animation completion. [v15 implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useFocusTrap/index.ts).

The v15 target watcher is **not immediate**: a static selector or already-populated target that never changes can leave the trap uninitialized, even with `immediate: true`. Use an initially null template ref that becomes a real element after mount, as below. An empty target list also returns without deactivating an existing trap; explicitly deactivate before hiding/removing an active region. Target watching is not a full visibility lifecycle.

With `v-if`, set visibility, await Vue `nextTick`, then activate. `immediate: true` means activate when a valid target becomes available; it does not make an unrendered element exist. `nextTick` proves Vue has patched, not that a CSS enter animation has finished. For animated regions, use focus-trap's `checkCanFocusTrap` readiness contract with the real transition lifecycle.

A trap needs a tabbable element or a valid `fallbackFocus`; a fallback element must be programmatically focusable, usually `tabindex="-1"`. Escape deactivates by default, but deactivation alone does not remove application markup. Keep visible state synchronized. Return focus defaults to the element focused before activation; preserve that trigger or provide an appropriate `setReturnFocus`. `allowOutsideClick` and `clickOutsideDeactivates` have different semantics. [Published focus-trap 8.2.3 documentation](https://cdn.jsdelivr.net/npm/focus-trap@8.2.3/README.md).

### Runnable SFC: custom modal with a scoped trap

Prefer the app's established dialog component; do not stack a second trap inside a Vuetify/Reka dialog that already owns focus. This standalone example owns all its background content, makes that content inert, gives the dialog a name, closes on Escape, and lets focus-trap return focus to the trigger.

```vue
<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'

const open = ref(false)
const panel = useTemplateRef<HTMLElement>('panel')
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const { activate, deactivate } = useFocusTrap(panel, {
  immediate: false,
  initialFocus: () => closeButton.value!,
  fallbackFocus: () => panel.value!,
  onDeactivate: () => {
    open.value = false
  },
})

async function reveal() {
  open.value = true
  await nextTick()
  activate()
}
</script>

<template>
  <main :inert="open">
    <h1>Focus trap example</h1>
    <button type="button" @click="reveal">Open details</button>
  </main>
  <Teleport to="body">
    <div v-if="open" class="backdrop">
      <section ref="panel" class="panel" role="dialog" aria-modal="true"
        aria-labelledby="details-title" tabindex="-1">
        <h2 id="details-title">Details</h2>
        <p>Tab stays within this panel. Escape closes it.</p>
        <button ref="closeButton" type="button" @click="deactivate()">Close details</button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; display: grid; place-items: center; background: rgb(0 0 0 / 50%); }
.panel { max-width: 30rem; margin: 1rem; padding: 1.5rem; background: white; color: black; }
</style>
```

This is one-instance markup: use instance-unique IDs if mounting multiple copies. Production background inertness must cover **all** outside application regions, not just one sibling. Focus trapping is distinct from scroll locking, backdrop presentation, accessible naming, and an application's unsaved-work policy. Keep those under the dialog owner; see [accessibility](accessibility.md).

## `useAxios`: imperative local request state

Supported overloads accept a URL plus config and/or an Axios instance, or an instance/config with no URL until `execute(url, config)`. The URL is a string, not a reactive URL getter contract. An Axios instance keeps existing adapter/interceptor policy. Return values include `data`, `response`, `error`, `isLoading`, `isFinished`, `isAborted`, `execute`, and `abort`; `cancel`/`isCanceled` are aliases, not different transports.

The no-custom-options branch uses `immediate: !!url`, `shallow: true`, and abort-previous behavior. **In published 15.0.0, passing a custom options object replaces that defaults object rather than merging it.** Therefore specify `immediate` and `shallow` explicitly whenever passing options; `abortPrevious` remains enabled unless explicitly false, and `resetOnExecute` defaults to false in the implementation. `initialData` determines initial data/type shape, not successful loading. `resetOnExecute: true` restores it before execution. [Published implementation](https://cdn.jsdelivr.net/npm/@vueuse/integrations@15.0.0/dist/useAxios.js).

Both the composable shell and `execute()` are thenable and **reject on error**. Rendering `error` does not handle the rejected promise from an awaited execute; catch it. Conversely, constructing a request does not require top-level await or a Suspense boundary. Without a URL, pass one to execute; a request config alone must resolve a URL through the supported overload, not a guessed positional argument.

Do not transfer `useFetch`'s stale-result guarantee to `useAxios`: the v15 execute counter guards loading completion, not every success/error commit. With `abortPrevious: false`, overlapping requests can overwrite each other; even abort-aware overlaps need care around stale error callbacks. Serialize this controller's actions, give independent operations separate instances, or use an existing query owner when keyed concurrency is required. The wrapper does not install scope-abort; register it if that is the desired lifetime. [Axios cancellation](https://axios-http.com/docs/cancellation), [VueUse source](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useAxios/index.ts).

### Complete integration SFC: explicit execution and failure handling

The host supplies an existing trusted application endpoint returning `{ name: string, count: number }`; it may be served locally or self-hosted. This component implements imperative request state, not that backend. The URL must come from application configuration rather than user input; authenticate/authorize and runtime-validate at the real service boundary as needed. Remount if its endpoint/identity changes. No external account or public vendor API is required.

```vue
<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import { isCancel } from 'axios'
import { useAxios } from '@vueuse/integrations/useAxios'

interface RecordSummary {
  name: string
  count: number
}
const props = defineProps<{ endpoint: string }>()
const notice = ref('')
const busy = ref(false)
let disposed = false
const { data, isLoading, execute, abort } = useAxios<RecordSummary>(
  props.endpoint,
  { method: 'GET' },
  { immediate: false, shallow: true, abortPrevious: true, resetOnExecute: false },
)

async function load() {
  if (busy.value || disposed) return
  busy.value = true
  notice.value = ''
  try {
    await execute()
  }
  catch (cause) {
    if (disposed) return
    notice.value = isCancel(cause)
      ? 'Request canceled.'
      : 'The summary could not be loaded. Try again.'
  }
  finally {
    if (!disposed) busy.value = false
  }
}
onScopeDispose(() => {
  disposed = true
  abort()
})
</script>

<template>
  <button type="button" :disabled="busy" @click="load">Load summary</button>
  <button type="button" :disabled="!isLoading" @click="abort()">Cancel request</button>
  <p v-if="isLoading" role="status">Loading</p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <p v-if="data">{{ data.name }}: {{ data.count }}</p>
</template>
```

`busy` owns serialization through the **settled execute promise**, not just the wrapper's loading flag. In v15, `abort()` sets `isLoading` false immediately, before the aborted request's catch/finally runs. Re-enabling Load from that flag alone permits an old cancellation to overwrite a new execution's error and contaminate its shared thenable. The guard also rejects same-tick/programmatic duplicate loads; scope disposal prevents this example's notice/finally callbacks from publishing after unmount. Abort still permits the wrapper's internal error ref to settle; it is not disposal of the controller's refs. [Exact abort and shared thenable](https://cdn.jsdelivr.net/npm/@vueuse/integrations@15.0.0/dist/useAxios.js)

With `resetOnExecute: false`, an HTTP failure or cancellation leaves the previous successful summary visible; the notice describes the latest attempt, not the age of that retained data. The example renders a generic failure, not the transport's raw error message; adapters/interceptors can include internal request details in errors. After cancellation settles, a deliberate new Load clears the notice and may succeed. Unmount aborts the local HTTP request, but the server may still finish its work; remount creates a fresh controller, not a continuation of the disposed promise. Client cancellation is not server rollback. [Error-disclosure boundary](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#error-handling).

Create credential-bearing Axios instances per SSR request/app as appropriate. Do not mutate a server-global Axios default Authorization header with a user's token. Interceptor attachment and ejection belong to the instance owner, not every rendering consumer. Use [Query](tanstack-query.md) or [Colada](pinia-colada.md) when the actual requirement is resource caching/invalidation rather than imperative transport state.

Callbacks `onSuccess`, `onError`, and `onFinish` are notification hooks, not the returned promise's rejection handler or a keyed latest-result boundary. Keep them non-throwing: in published v15, a thrown `onFinish` skips the following loading/finished update and can leave the shared thenable pending. `onFinish` runs for each underlying completion, including a superseded execution; do not perform irreversible follow-up work there merely because isLoading became false. An application-owned Axios instance can retain its adapters/interceptors, but the wrapper supplies its own AbortController signal for execution. Keep explicit controller lifetime with the request owner.

## `useCookies`: reactive reads and request isolation

`useCookies(dependencies?, { doNotParse, autoUpdateDependencies }?, cookiesInstance?)` returns methods, **not a ref containing all cookies**. Call `get`/`getAll` inside a computed/effect/template expression to establish the wrapper's reactive touch dependency. Saving `const locale = get('locale')` once only saves a snapshot.

- Omitted/null dependencies observe all cookie changes; `[]` observes none. With `autoUpdateDependencies: true`, each name read by `get` joins the observed list. Both options default to false.
- `doNotParse: false` means the underlying library may JSON-parse values. Use `doNotParse: true` for raw string conventions; do not assume every read is a string or a trusted application object.
- The internal change listener is removed on scope disposal. Listeners added manually through `addChangeListener` remain the caller's responsibility; pair them with `removeChangeListener`.
- `set`/`remove` forward universal-cookie options. Use the same path/domain when removing a cookie. `maxAge` is seconds, `expires` is a Date, and `secure` requires a suitable HTTPS deployment. Browser code cannot read or create an HttpOnly cookie.

These are the [v15 wrapper contracts](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useCookies/index.ts) and [universal-cookie 8.1.2 options](https://github.com/reactivestack/cookies/tree/v8.1.2/packages/universal-cookie).

### Runnable browser SFC: a non-secret preference

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useCookies } from '@vueuse/integrations/useCookies'

const cookies = useCookies(['locale'], { doNotParse: true })
const locale = computed({
  get: () => cookies.get<string>('locale') === 'fr' ? 'fr' : 'en',
  set: (value: string) => cookies.set('locale', value, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  }),
})
function reset() {
  cookies.remove('locale', { path: '/' })
}
</script>

<template>
  <label>Preferred language
    <select v-model="locale">
      <option value="en">English</option>
      <option value="fr">French</option>
    </select>
  </label>
  <button type="button" @click="reset">Reset preference</button>
  <p>Language: {{ locale }}</p>
</template>
```

**SSR:** create a fresh `createCookies(req)` factory for each incoming Node request, then expose that request's factory/context to its components. The wrapper initializes universal-cookie from `req.headers.cookie`. It does **not** connect `set()` to an outgoing response or emit `Set-Cookie` headers for you. The server/framework response layer owns that operation, HttpOnly flags, and authentication policy. Never export one cookie instance initialized from the first user's request. Browser-only `useCookies()` cannot provide server request cookies, and first-client cookie reads must agree with the SSR rendering policy to avoid hydration changes. For non-Node servers, supply a per-request universal-cookie instance from that framework's cookie-header contract rather than pretending to have `IncomingMessage`.

In Nuxt, its own `useCookie` is a different framework API with a different SSR contract; prefer it for Nuxt-owned response cookies. Explicitly import the VueUse wrapper only when intentionally using its contracts. Do not store session secrets in this client preference pattern.

## Remaining integration decisions

All signatures and behavior below are pinned to the [v15 integration sources](https://github.com/vueuse/vueuse/tree/v15.0.0/packages/integrations); install the table's peer before importing its subpath.

### Validation and text

- **`useAsyncValidator`** accepts reactive value/rules and `{ manual, immediate, validateOption }`. Automatic mode deeply watches data/rules; `manual: true` disables automatic validation, including its immediate run. `execute()` returns `{ pass, errors, errorInfo, errorFields }`; invalid input is represented in that result, not an automatic submission. Keep form pending/submission state and labels with the form owner. Concurrent executions have no latest-only guard: serialize manual validation when order matters. The component adapter is excluded below; use the composable directly. [Implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useAsyncValidator/index.ts).
- **`useChangeCase`** accepts reactive text, a reactive supported function name, and options. A getter input gives a readonly computed; writable input wraps a writable computed whose setter stores raw text in the source and whose getter transforms it. With change-case **5.4.4**, use **`kebabCase`**, not the nonexistent `paramCase` export. Invalid transformation names throw on reading. Casing is not uniqueness, transliteration, or a safe identifier guarantee. [Exact peer types](https://cdn.jsdelivr.net/npm/change-case@5.4.4/dist/index.d.ts), [wrapper](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useChangeCase/index.ts).
- **`useJwt`** returns computed `{ header, payload }`, with `fallbackValue` (default null) and `onError` for decoding failures. **An expired but syntactically valid token still decodes.** It does not check expiry, signatures, issuer, audience, or revocation. Authorization belongs on the server; client claims may support presentation only. [Implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useJwt/index.ts).

### Search and local persistence

- **`useFuse(search, data, options)`** returns `{ fuse, results }`; each result contains `item` and `refIndex`, with additional fields depending on Fuse options. Put searchable fields under `fuseOptions.keys`, and apply `resultLimit` deliberately. `matchAllWhenSearchEmpty: true` returns all items for empty search rather than matching through Fuse. Data changes update the collection; options changes can rebuild the index. For large collections, index cost and reactive deep watching still exist. [Implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useFuse/index.ts).
- **`useIDBKeyval` v15 returns `{ data, isFinished, isSupported, set }`, not a standalone ref.** Bind `data`; `null` deletes the key. Cross-tab BroadcastChannel synchronization is enabled by default and can be disabled with `listenToStorageChanges: false`. **`isSupported` tests BroadcastChannel, not IndexedDB availability**; do not use it as an IndexedDB capability guarantee. The initial read begins immediately, so mount this browser capability deliberately; storage denial is reported through `onError`. `set(value)` awaits the write attempt, but write errors are caught and passed to `onError`, so resolution alone is not proof of durable persistence. Observe/report the error path. With `shallow: true`, nested data remains non-reactive; `deep` is a separate watch option. IndexedDB uses structured-clone-compatible values by default, not the JSON storage contract. [Implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useIDBKeyval/index.ts).

Wait for `isFinished` before enabling edits when the stored record must initialize the UI: the initial asynchronous read can otherwise replace an early local edit. With a **non-throwing `onError`**, it means the initial read attempt finished, not “storage succeeded.” A throwing `onError` rejects the internally unawaited read before `isFinished` is set; during `set`, it can also reject before the paused watcher resumes. Report errors without throwing from that callback. `writeDefaults: false` prevents writing the default for an absent key; provide serializer.read/write when stored and UI shapes differ. Use a concrete initial value for predictable pre-read data: although initialValue is typed as MaybeRefOrGetter, the v15 implementation constructs data from the supplied argument before separately resolving its default. Disabling BroadcastChannel echo does not make IndexedDB private to a tab; the database is still shared by same-origin contexts. Cross-tab deletion restores the receiving ref's initial default, rather than proving that default was persisted. Scope disposal closes the channel, not an already-started read/write. [Published implementation](https://cdn.jsdelivr.net/npm/@vueuse/integrations@15.0.0/dist/useIDBKeyval.js).

The IndexedDB key is not reactive; remount with a new, non-secret per-identity namespace when ownership changes. Closing its scope/channel cannot retract a late default write or queued persistence operation. Keep this wrapper out of canonical private query-cache ownership: use the incumbent cache's established persister/retirement contract, and do not treat deleting a key during an outstanding write as final logout cleanup.

### DOM interaction and presentation

- **`useSortable`** takes an element ref/getter or selector and a mutable list. Use stable item keys. Its default `onUpdate` synchronizes the array; supplying your own handler replaces it, so call `moveArrayElement(list, oldIndex, newIndex, event)` if keeping that behavior. The helper schedules insertion with `nextTick`; do not read the final array immediately. `watchElement: true` reinitializes for changing element refs such as `v-if`, not selector strings. `start()` resolves the current target; `stop()` destroys the instance, but a still-active target watcher can initialize again on a later element change. Set `option('disabled', true)` for a temporary interaction pause. Provide keyboard reorder controls and announcements; pointer dragging alone is not accessible. [Implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useSortable/index.ts), [virtualization boundary](virtualization.md).
- **`useDrauu`** needs a real SVG root, not an arbitrary HTML element. It exposes brush state, undo/redo availability, load/dump/clear/cancel, and event hooks. **`onCommitted` receives the committed SVG node directly**, not `{ node }`. `dump()` may be undefined before initialization. The wrapper cleans up on scope disposal and replaces an existing instance when another valid SVG target arrives; removing a target is not an unconditional immediate destroy path. Scope the drawing owner appropriately. Treat SVG imported from outside the application as untrusted; a drawing wrapper is not an SVG sanitizer. [Implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useDrauu/index.ts).
- **`useNProgress`** wraps and patches the NProgress singleton; multiple owners contend for one global browser bar and their cleanup can remove each other's display. Choose one browser app-level owner and include `nprogress/nprogress.css` in the consuming app. `start`/`done` and writable `isLoading` indicate activity, not byte-level progress. The wrapper's browser guard does not make calling NProgress DOM commands on the server valid. Derive activity from the real router/query/task lifecycle rather than a fabricated timer. [Implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useNProgress/index.ts).
- **`useQRCode`** returns a string ref initially `''`; generation is client-only and asynchronous. Render the image only once it has a source, with meaningful alternative text appropriate to the QR's purpose. Empty input does not clear the last generated URL in v15, and overlapping generation has no latest-execution guard. For rapidly changing text or a strict clear/error policy, own generation with the peer API and explicit task identity rather than promising behavior the wrapper lacks. Its options are not an all-reactive input contract. [Implementation](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useQRCode/index.ts).

### Component adapters are not identical to composable calls

Use these only for template-local ownership; import the explicit `/component` subpath, not a core-components barrel.

| Adapter | Actual v15 runtime contract |
| --- | --- |
| `UseFocusTrap` | Props as/options; renders an as element (div default) as the trap target and provides the unwrapped controller to its default slot. It is **not pure renderless**. options are passed when setup constructs the trap; replacing an options object is not a general reactive-reconfiguration API. Keep the same visibility, fallback focus, background inertness, and return-focus rules as the composable. |
| `UseSortable` | Props modelValue/options/as; renders an as target (div default), exposes start/stop/option in its default slot, and bridges modelValue through useVModel. Use v-model with an owner-controlled mutable array and stable keyed children; configure the actual container element with as rather than accidentally nesting a div in a list/table. This adds neither keyboard sorting nor server persistence. |

These are observed source contracts, not browser results: [focus adapter](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useFocusTrap/component.ts), [sortable adapter](https://github.com/vueuse/vueuse/blob/v15.0.0/packages/integrations/useSortable/component.ts), [published validator adapter](https://cdn.jsdelivr.net/npm/@vueuse/integrations@15.0.0/dist/useAsyncValidator/component.js). The low-level `insertNodeAt(parent, element, index)` and `removeNode(node)` exports are DOM helpers, not reactive list operations; prefer moveArrayElement with the owning array for Sortable/Vue reconciliation.

### Excluded `UseAsyncValidator`: options are not forwarded

Do not select the **15.0.0 component adapter** for validation. Its published runtime declares `options` but calls only `useAsyncValidator(props.form, props.rules)`, so `manual: true` silently becomes automatic deep validation. Captured form/rules props also lose whole-object replacement tracking. This is not repaired by a caveat on the positive selection table or by remounting the adapter. Use the function subpath and real reactive inputs; no package patch or wrapper shim is required. [Published defective adapter](https://cdn.jsdelivr.net/npm/@vueuse/integrations@15.0.0/dist/useAsyncValidator/component.js), [supported composable](https://cdn.jsdelivr.net/npm/@vueuse/integrations@15.0.0/dist/useAsyncValidator.js).

Complete `ManualValidation.vue`, with `async-validator@4.2.5`. This validates local fields only; “valid” is not a saved/submitted backend result. The owner serializes executions and disables editing while a validation snapshot is pending:

```vue
<script setup lang="ts">
import { onScopeDispose, reactive, shallowRef } from 'vue'
import type { Rules } from 'async-validator'
import { useAsyncValidator } from '@vueuse/integrations/useAsyncValidator'

const form = reactive({ name: '' })
const rules = {
  name: { type: 'string', required: true, message: 'Enter a name.' },
} satisfies Rules
const busy = shallowRef(false)
const notice = shallowRef('')
let disposed = false
const { execute } = useAsyncValidator(form, rules, { manual: true })
onScopeDispose(() => { disposed = true })

async function validate() {
  if (busy.value || disposed) return
  busy.value = true
  notice.value = ''
  try {
    const result = await execute()
    if (!disposed) notice.value = result.pass
      ? 'Local fields are valid.'
      : result.errors?.map(error => error.message).join(' ') || 'Local validation failed.'
  } finally {
    if (!disposed) busy.value = false
  }
}
</script>

<template>
  <form @submit.prevent="validate">
    <label>Name <input v-model="form.name" :disabled="busy" /></label>
    <button type="submit" :disabled="busy">Validate fields</button>
    <p role="status">{{ notice }}</p>
  </form>
</template>
```

For asynchronous remote rules, the application must supply their real service contract and decide input invalidation, disposal, and submission policy; this local rule example does not claim transport cancellation.

## Migration and verification boundary

v15 raises the Node floor to 22 and changes IndexedDB state/tab-sync behavior. Core/shared changes such as removed `templateRef`, scheduler options, and throttle trailing defaults also apply transitively; see [VueUse migration notes](vueuse.md#v15-migration-and-specialized-browser-apis). Do not assume a peer-range expansion is a request to migrate the entire app.

Research covers registry releases, exports, declarations and implementations. Previously recorded production Chromium/local-HTTP checks exercised the then-current Axios reader with integrations 15.0.0 and Axios 1.20.0: success, HTTP failure, settled-promise serialization, cancellation, unmount abort and remount isolation. That historical reader rendered raw errors; the generic-error correction above has not been executed in this audit. Previously recorded checks also confirmed the excluded manual-validator adapter's unwanted eager validation and the manual-composable replacement's explicit invalid/valid transitions without typing-triggered validation; its Node SSR defaults rendered. See [scoped historical evidence](../assets/verification.json). Focus-trap, cookies, IndexedDB and other unlisted adapters remain source-only, not whole-reference runtime/SSR certification. Verify focus entry/Tab/Escape/return, absent peers, independent Axios controllers, same-path cookie deletion, request isolation, IndexedDB denial/tab sync and keyboard reorder in the consuming app; use [testing](testing.md).

## Sources

- [VueUse v15 integration manifest](https://registry.npmjs.org/@vueuse/integrations/15.0.0), [release](https://github.com/vueuse/vueuse/releases/tag/v15.0.0), and [all versioned wrappers](https://github.com/vueuse/vueuse/tree/v15.0.0/packages/integrations).
- [Axios 1.20.0 registry](https://registry.npmjs.org/axios/1.20.0), [cancellation documentation](https://axios-http.com/docs/cancellation), [focus-trap 8.2.3 registry](https://registry.npmjs.org/focus-trap/8.2.3), [published README](https://cdn.jsdelivr.net/npm/focus-trap@8.2.3/README.md), [universal-cookie 8.1.2 registry](https://registry.npmjs.org/universal-cookie/8.1.2), and [cookie API](https://github.com/reactivestack/cookies/tree/v8.1.2/packages/universal-cookie).
- Exact other peers: [async-validator 4.2.5](https://registry.npmjs.org/async-validator/4.2.5), [change-case 5.4.4](https://registry.npmjs.org/change-case/5.4.4), [drauu 1.0.0](https://registry.npmjs.org/drauu/1.0.0), [Fuse 7.5.0](https://registry.npmjs.org/fuse.js/7.5.0), [idb-keyval 6.3.0](https://registry.npmjs.org/idb-keyval/6.3.0), [jwt-decode 4.0.0](https://registry.npmjs.org/jwt-decode/4.0.0), [NProgress 0.2.0](https://registry.npmjs.org/nprogress/0.2.0), [qrcode 1.5.4](https://registry.npmjs.org/qrcode/1.5.4), and [Sortable 1.15.7](https://registry.npmjs.org/sortablejs/1.15.7).
