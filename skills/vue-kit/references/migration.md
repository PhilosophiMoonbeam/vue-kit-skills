# Vue version boundaries and incumbent migration

Read before copying an older Vue example, upgrading runtime/compiler tooling, or changing an incumbent Options API/JSX integration. Baseline: **Vue 3.5.44** and its matching `@vue/*` runtime/compiler packages; preferred UI target **Vuetify 4.3.0**. Vue 3.6/Vapor APIs are **outside this skill's target**. This is a targeted cutover guide, not a mandate to rewrite working Options API components or swap an incumbent application framework during an unrelated fix.

## Establish the installed contract first

1. Inspect package manifest, lockfile, bundler plugins, `tsconfig`, Vue language tooling, test environment, and framework ownership. Distinguish a Vue SPA, Nuxt, SSR app, custom-element library, and embedded widget.
2. Identify the actual old API and its callers. Choose a migration slice that preserves observable behavior, including listener forwarding, form contracts, component refs, pending work, and server/client state ownership.
3. Align Vue runtime, compiler, and server renderer to **3.5.44**. The `vue@3.5.44` registry dependencies pin `@vue/compiler-sfc`, `@vue/compiler-dom`, `@vue/runtime-dom`, `@vue/server-renderer`, and `@vue/shared` to that version. Do not reuse a cached 3.6 declaration export catalog as evidence for 3.5.
4. Migrate the slice's callers and tests to one public contract; remove obsolete aliases/imports/config rather than leaving accidental dual behavior. Preserve application-selected libraries unless the assignment explicitly includes their migration.
5. Have the owning implementation run type checking, behavior tests, and production-build verification using the repo's toolchain. These are required migration evidence, not claims that this reference has executed them. See [setup/tooling](setup-tooling.md), [testing](testing.md), and [SSR/debugging](debugging-ssr.md).

Registry and declaration evidence: [3.5.44 metadata](https://registry.npmjs.org/vue/3.5.44), [pinned entry declarations](https://unpkg.com/vue@3.5.44/dist/vue.d.ts).

Alignment to 3.5.44 above applies to an **explicitly authorized adoption of this baseline**, not an instruction to downgrade or upgrade an incumbent framework during diagnosis. Keep its mutually compatible runtime/compiler/renderer until that migration is in scope. Vue's release policy warns that newer-minor compiler output may require the newer runtime; beta/RC/edge exports are not evidence for a stable 3.5 API. Test a deliberately selected prerelease in a separate exactly pinned integration, not by mixing a 3.6 compiler into this target. [Official compiler compatibility and prerelease policy](https://vuejs.org/about/releases.html#compiled-code-compatibility-with-older-runtime).

For an explicitly authorized UI-library cutover, [OpenVue setup](openvue-setup.md) owns its **1.0.0** package/host boundary and complete Vite/Nuxt profiles; the [capability index](openvue.md) routes deeper contracts. Do not rename imports mechanically: Select retains its label-ID behavior, Carousel is data-driven with an item slot, and Dialog models `visible`. These are the pinned profile's contracts, not a compatibility promise for all 1.x releases. Keep Quasar and unrelated incumbent integrations unchanged.

## What is and is not a Vue 3.5 API

| Version/status | Usable contract in this target | Boundary |
| --- | --- | --- |
| 3.3+ stable | `toValue`, getter-normalizing `toRef`, `defineOptions`, `defineSlots`, generic SFCs | Macros remain SFC-only; TypeScript AST conversion has limits. |
| 3.4+ stable | `defineModel`, same-name `v-bind` shorthand, `once` watchers, computed stability | Existing explicit model prop/update event contracts remain valid. |
| 3.5 stable | Reactive props destructure enabled by default; `useTemplateRef`, `useId`, `onWatcherCleanup`; numeric watcher depth; pause/resume watch handles | Reactivity is not granted to every destructured local variable; cleanup API must register synchronously. |
| 3.5 stable, SSR-specific | Async-component `hydrate` strategies; `data-allow-mismatch` | Not SPA lazy mounting. Mismatch suppression is for known unavoidable differences, not a blanket fix. |
| 3.5 stable | `<Teleport defer>`; custom-element host/shadow-root helpers and configuration | Deferred target must exist in the same tick; custom-element-only APIs do not apply to every component. |
| Experimental in 3.5 | `<Suspense>` and async setup integration | Explicitly accept API risk; boundary behavior and error handling in [components](components.md). |
| 3.6/Vapor, excluded | Vapor app/component factories, interop plugins, Vapor directives and runtime helpers, Vapor SFC compilation markers | Do not import, configure, or teach them as 3.5 APIs. |

Historical source notes recorded Vue **3.6.0-beta.17** alongside later RC statements; the deleted source corpus has not been freshly re-read. Those notes do not establish availability in 3.5.44 or a stable production compatibility guarantee. Specifically excluded: `createVaporApp`, `createVaporSSRApp`, `defineVaporComponent`, `defineVaporAsyncComponent`, `vaporInteropPlugin`, `renderEffect`, Vapor built-ins, `<script setup vapor>`, and Vapor-only event-delegation options/modifiers. Keep the ordinary `createApp`/`createSSRApp`, SFC compiler, and VDOM directives for this target. Do not copy beta-specific Options API restrictions into ordinary Vue 3.5.

Release context: [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4), [Vue 3.5](https://blog.vuejs.org/posts/vue-3-5). Prefer the API reference to release-post snippets when their spelling conflicts: the deferred Teleport prop is **`to`**, not `target`; custom-element creation is **`defineCustomElement`**, singular.

### Package entry points and runtime-compiler diagnosis

| Host | Vue 3.5.44 choice |
| --- | --- |
| SFC bundler | Default `vue` resolves to runtime-only `vue.runtime.esm-bundler.js`; the Vue plugin precompiles `.vue` templates. A template-string component needs the full `vue/dist/vue.esm-bundler.js` alias **only if runtime compilation is intentionally required**. Never compile untrusted templates to fix this warning. |
| Browser without a bundler | Use pinned `vue.global(.prod).js` for a `Vue` global or `vue.esm-browser(.prod).js` for native ESM. The `.runtime` variants require precompiled render functions. Global builds are IIFEs, not UMD. Import all Vue APIs from the same browser build to avoid separate reactivity instances. |
| Node/SSR | Package `import`/`require` conditions select the Node entry. Import rendering from `vue/server-renderer`, not the main Vue entry, and hydrate with `createSSRApp`. Do not assume the browser bundle is the server renderer. |
| Compiler tooling | Import `vue/compiler-sfc` to follow the matched compiler. In the CJS entry, TypeScript registration is wired when TypeScript is resolvable; custom ESM/browser compiler integrations must inspect matching `registerTS`/filesystem requirements for the particular imported-type analysis path. This is build-tool authoring, not something every app setup calls. |
| JSX/types | `vue/jsx-runtime` and `vue/jsx-dev-runtime` are exported, but their presence does not replace the installed Vue JSX transform. `vue/jsx` opts into global JSX types; preserve the documented transform configuration below. |

The bundler flags `__VUE_OPTIONS_API__` (default true), `__VUE_PROD_DEVTOOLS__`
(false), and `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` (false) are compile-time
booleans, not browser runtime settings. Set them through the owning build plugin/
config for tree shaking; enabling diagnostic details does not repair hydration.
Source authority: [pinned package exports](https://unpkg.com/vue@3.5.44/package.json),
[build selection](https://unpkg.com/vue@3.5.44/README.md),
[compiler CJS entry](https://unpkg.com/vue@3.5.44/compiler-sfc/index.js).

### Reactive props destructure is not the removed Reactivity Transform

Reactivity Transform (`$ref`, `$computed`, `$()`, `$$()`, `vue/macros`, and its core compiler option) was experimental and removed from core in **3.4**. Do not reintroduce its compiler option or type references in a 3.5 app. Replace it with explicit `ref`/`computed`/`toRef` and `.value` in script, then migrate consumers that expected transformed values. A separately installed Vue Macros plugin is an explicit incumbent build dependency, not a built-in alternative to import from Vue. [Official removal notice](https://vuejs.org/guide/extras/reactivity-transform.html).

Complete replacement SFC:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const { initialCount = 0 } = defineProps<{ initialCount?: number }>()
const count = ref(initialCount)
const doubled = computed(() => count.value * 2)
function increment() { count.value++ }
</script>

<template>
  <button type="button" @click="increment">{{ count }} (double: {{ doubled }})</button>
</template>
```

`initialCount` intentionally initializes a local counter once. Later parent changes do not reset it. For live props use computed/getter access; for resettable drafts define a deliberate reset rule. Only the direct props-destructured reads are compiler-rewritten; passing a primitive into a composable still snapshots it. See [components](components.md#sfc-and-typescript-boundaries).

Other 3.4 removals: template `@vnodeXXX` listeners become `@vue:XXX`; `v-is` becomes the documented `is="vue:ComponentName"` form where needed. `app.config.unwrapInjectedRef` was removed; it is **not** evidence that Composition `inject()` unwraps supplied refs. Composition inject preserves those refs; Options instance access has separate unwrapping behavior. [3.4 removal details](https://blog.vuejs.org/posts/vue-3-4#other-removed-features).

## Incumbent Options API

Options API remains supported in Vue 3.5. Do not label it removed or Vue-2-only. For a narrow fix, preserve it; for new extracted stateful behavior prefer a composable, and for new components prefer script setup. Do not disable `__VUE_OPTIONS_API__` if the app or dependencies still use Options API. [Compile-time flags](https://vuejs.org/api/compile-time-flags.html).

- Wrap typed Options components in `defineComponent`; use `PropType<T>` for complex runtime props, typed `emits`, explicit DOM event types, and strict TypeScript.
- `data()` creates per-instance state and returns an object. Methods/lifecycle hooks that use instance `this` must use regular method/function syntax, not arrow functions. Annotate computed return types when inference is circular or ambiguous.
- Stateful functions created once in module-level `methods` definitions can share debounce/throttle state across instances. Allocate their state per instance, and cancel resources at unmount. Creating timers in `created` also runs on the server; start browser/long-lived side effects in mounted where appropriate.
- The arrow-function caveat for prop `default`/`validator` inference is specifically **TypeScript <4.7**, not a modern universal requirement. Object/array default factories are still required independently of that historical TS issue. [Options TypeScript caveats](https://vuejs.org/guide/typescript/options-api.html#caveats).
- Explicit `setup(props)` is a supported integration seam: return refs/actions for template and Options instance access. `setup` has no instance `this` and cannot read later Options `data`/methods. Do not duplicate state between Options and setup, or assume script-setup locals appear on `this`. [Setup integration](https://vuejs.org/api/composition-api-setup.html).

### Typed Options contracts without global fiction

Enable `strict: true` in the **application's effective** tsconfig (or at minimum
`noImplicitThis` for contextual `this`; `noImplicitAny` is also needed for
unannotated arguments). `defineComponent` and strict configuration work together;
do not silence newly exposed errors with `any`. Annotate absent data with a union,
check null/undefined, and type native handlers with `Event`, `MouseEvent`,
`KeyboardEvent` or `SubmitEvent` as appropriate. `event.target` may be a child;
`currentTarget` is the element whose listener runs and must be read before an
await. Type custom-event handlers to their emitted payload, not to a DOM event.

`PropType<T>` affects static inference, **not** runtime structure validation.
Constructor/validator checks are development diagnostics, not a security boundary.
Complete Options module: typed collection and literal-union runtime props, typed
emits, and a writable computed adapter to per-instance state:

```ts
import { defineComponent, type PropType } from 'vue'

interface Choice { id: number; title: string }
export default defineComponent({
  props: {
    choices: { type: Array as PropType<readonly Choice[]>, default: () => [] },
    size: { type: String as PropType<'small' | 'large'>, default: 'small' },
  },
  emits: {
    select(id: number) { return Number.isInteger(id) },
  },
  data() { return { draft: '' } },
  computed: {
    normalized: {
      get(): string { return this.draft.trim() },
      set(value: string) { this.draft = value },
    },
    match(): Choice | undefined {
      return this.choices.find(choice => choice.title === this.normalized)
    },
  },
  methods: {
    selectMatch() {
      if (this.match) this.$emit('select', this.match.id)
    },
  },
})
```

This is a complete component definition without a rendering example, not a
claimed standalone page. String/array `inject` options do not infer a provider's
actual service shape. Prefer a typed Composition `inject(InjectionKey<T>)` inside
the incumbent component's `setup`, check the missing-provider case, and return the
service for Options/template consumption. This supported interop avoids globally
declaring a scoped injection on **every** instance. Options instance access can
unwrap injected refs; Composition inject preserves them. For an actual globally
installed property, augment `ComponentCustomProperties` in an included module
file containing an import/export; augmentation alone neither installs the plugin
nor guarantees a scoped provider. [Options typing](https://vuejs.org/guide/typescript/options-api.html),
[provide/inject](https://vuejs.org/guide/components/provide-inject.html).

Complete incumbent Options SFC: per-instance cancellable debounce state, no third-party debounce dependency, no network claims.

```vue
<script lang="ts">
import { defineComponent, useId } from 'vue'

export default defineComponent({
  setup() { return { id: useId() } },
  data() {
    return {
      draft: '',
      settled: '',
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    }
  },
  computed: {
    characterCount(): number { return this.draft.length },
  },
  beforeUnmount() { clearTimeout(this.timer) },
  methods: {
    update(event: Event) {
      if (!(event.target instanceof HTMLInputElement)) return
      this.draft = event.target.value
      clearTimeout(this.timer)
      this.timer = setTimeout(() => { this.settled = this.draft }, 250)
    },
  },
})
</script>

<template>
  <label :for="id">Draft</label>
  <input :id="id" :value="draft" @input="update" />
  <p>{{ characterCount }} characters; settled locally: {{ settled }}</p>
</template>
```

The delay is this example's local editing behavior, not an official performance prescription. A large incumbent refactor should move an entire coherent responsibility with its tests, not mechanically rewrite every method into a composable facade.

## Incumbent JSX and render functions

Retain JSX/TSX for an existing render-oriented API or a genuine programmatic rendering need; templates remain the default. Vue's transform is not React's transform. See [setup/tooling](setup-tooling.md) for the verified Vite plugin/toolchain configuration.

Contextual `tsconfig` merge fragment (not a replacement for the application's full configuration):

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "vue"
  }
}
```

Since **3.4**, Vue does not implicitly register global `JSX`. Use `jsxImportSource: "vue"`, or a per-file `@jsxImportSource vue` pragma. An incumbent dependency that truly requires global `JSX` can explicitly reference `vue/jsx`; do not add that global workaround to unrelated SFC apps. Keep JSX preserved for the installed Vue JSX transform rather than switching to React automatic-runtime assumptions. [Official JSX typing](https://vuejs.org/guide/extras/render-function.html#jsx-type-inference).

Complete `.tsx` component; requires the host's Vue JSX transform:

```tsx
import { defineComponent, ref, useId } from 'vue'

export default defineComponent({
  name: 'LocalSearch',
  setup() {
    const id = useId()
    const query = ref('')
    function update(event: Event) {
      if (event.target instanceof HTMLInputElement) query.value = event.target.value
    }
    return () => (
      <section class="local-search">
        <label for={id}>Search term</label>
        <input id={id} value={query.value} onInput={update} />
        <p>Current term: {query.value}</p>
      </section>
    )
  },
})
```

- Use Vue/HTML `class` and `for`, event props such as `onClick`/`onInput`, and explicit `.value` in render code. React `onChange` assumptions do not imply live input updates.
- A Vue setup function executes once per instance; return a function for reactive rendering. Refs/computed live in setup, not a React hook/render model. Do not import React hooks or assume React children/event semantics.
- Pass component slots as functions (a slot-object for named slots), and invoke them while rendering. For model contracts in `h()`, pass `modelValue` and `'onUpdate:modelValue'` explicitly; JSX-specific model syntax depends on the installed Vue transform.
- `h()` takes flattened props/listeners. Create unique vnodes per tree location; do not reuse one vnode object twice. Use `mergeProps` when class/style/listener merging is intended and `withModifiers` for supported event modifiers.
- For Vue 2 render migrations, remove `this.$createElement`, nested `data.on` listener maps, and `$scopedSlots`; use imported `h`, `onXxx` props, and `$slots` functions. [Render-function recipes](https://vuejs.org/guide/extras/render-function.html).

A stateless presentational render component may be a plain function with an
explicit props/slots contract; it has no component instance lifecycle. Do not
convert a stateful component merely to claim a performance gain. Native-element
models use DOM properties/listeners or Vue's `vModel*` directive helpers, whereas
component models use the prop/update contract. Resolve a registered component/
directive with `resolveComponent`/`resolveDirective` inside setup/render only when
direct imports are unavailable. `withDirectives(vnode, [[directive, value, arg,
modifiers]])` applies a real directive; a `'v-focus'` property on `h('input')` does
not. `withKeys` handles key guards and `withModifiers` handles event modifiers;
pass listeners such as `onClickOnce` for corresponding event options. [Render recipes](https://vuejs.org/guide/extras/render-function.html).

## Vue 2 contracts that must not survive accidentally

| Incumbent API | Vue 3 replacement / review |
| --- | --- |
| Global `new Vue`, `Vue.use`, global mutable app configuration | `createApp`/`createSSRApp`, `app.use`, app-scoped registration/provides. |
| Component `value` + `input`, `.sync`, custom `model` option | Default `modelValue` + `update:modelValue`, named `v-model`, or `defineModel`; migrate both sides. |
| `$listeners`, `v-on.native` | Declared emits plus `$attrs` listener forwarding; prevent duplicate native/custom calls. `$attrs` also contains class/style. |
| `$scopedSlots`, old slot syntax, functional-SFC option | Slot functions / `v-slot`; plain function components when intentionally stateless. |
| `beforeDestroy`, `destroyed`, `hook:*` events | `beforeUnmount`, `unmounted`, current `@vue:*` vnode lifecycle listeners where required. |
| `$set`, `$delete` | Proxy-tracked assignment/delete; review state ownership rather than keeping obsolete helpers. |
| Instance `$on`/`$off`/`$once`, `$children`, filters | Explicit component events, scoped dependencies/store, refs for deliberate imperative APIs, pure/computed formatting. |
| Old directive hooks and expression inspection | Current DOM directive lifecycle/binding contract; own disposal explicitly. |
| Array watch expecting nested mutation by default | Declare replacement versus mutation intent; 3.5 `deep: 1` for array-level mutations or narrow projection. |
| Assumed loop/condition precedence or implicit transition wrapper | Review `v-if` before `v-for`, keyed template groups, transition class names, and TransitionGroup's absent default wrapper. |

This table is a decision route, not a replacement for the [official Vue 2→3 breaking-change guide](https://v3-migration.vuejs.org/breaking-changes/). A compatibility build is a separately planned migration tool, not the permanent default of this 3.5 skill. Remove the old contract when its callers are migrated.

## Nuxt 3 to 4 migration

For new Nuxt applications and ordinary host work, use the first-class
[Nuxt guide](nuxt.md), not this migration checklist. Nuxt owns bootstrap, routing,
server handlers and SSR payloads; a Nuxt upgrade is not a Vue SPA rewrite.

For an actual Nuxt 3 → **4.6.2** migration:

1. Inventory the current Nuxt release, Node engine, modules, layers, `srcDir`,
   `serverDir` and lockfile. Check each module's current peer/runtime contract
   before upgrading; Nuxt compatibility is not guaranteed by Vue compatibility.
   The target requires Node `^22.22.3 || ^24.15.0 || >=26.0.0` and this track pins
   Vue 3.5.44. Upgrade the existing package-manager manifest/lockfile deliberately,
   without opting into Nuxt 5's `future.compatibilityVersion: 5`.
2. Adopt the Nuxt 4 `app/` directory only as a reviewed move: app assets,
   components, composables, layouts, middleware, pages, plugins, utils and root
   Vue files move together. Keep root configuration, `server/`, `public/`,
   `shared/`, `modules/` and `layers/` outside it. Reconcile explicit source/server
   directories and layer-relative paths; `~`/`@` now normally mean `app/`,
   while `~~`/`@@` mean the project root. Update external CSS/lint/test include
   paths rather than retaining aliases to deleted directories.
3. Regenerate Nuxt types and adopt its app/server/shared/node project references.
   Remove obsolete hand-maintained generated-type includes or SPA TypeScript
   configuration; preserve intentional custom options through Nuxt configuration.
4. Review async-data changes: Nuxt 4 uses shallow data by default, same-key
   callers share state and must use consistent contracts, and omitted data/error
   defaults are `undefined` rather than an assumed `null`. Replace nested
   snapshots or explicitly select deep tracking; review reactive keys,
   parameter-only navigation, clearing and refresh behavior rather than copying
   old cache assumptions.
5. When adopting the 4.6 `nuxt/server` boundary, migrate a handler and its helpers
   together. Explicitly import its `defineEventHandler`; auto-imported Nuxt 4
   handlers are still h3 v1. Change `statusCode`/`statusMessage` to
   `status`/`statusText`, request/response access and router-parameter decoding
   according to the [current server contract](nuxt.md#server-boundaries-and-private-configuration).
   Do not silently migrate session cookies between incompatible implementations.
6. Exercise generated-context typechecking, production build, direct SSR and API
   errors, hydration, parameter navigation, middleware and deployment output.
   Retire old paths only after all callers/configuration are migrated.

The [official Nuxt 3→4 upgrade guide](https://nuxt.com/docs/4.x/getting-started/upgrade#migrating-to-nuxt-4)
owns the full release-specific change list and optional codemods; review automated
diffs rather than treating them as compatibility evidence.
[Exact target manifest](https://unpkg.com/nuxt@4.6.2/package.json),
[current host/data examples](nuxt.md#local-catalogue-example).

## Custom non-Nuxt SSR

For **custom non-Nuxt SSR**, create a fresh `createSSRApp`/router/store per request,
load and provide the initial data before `renderToString`, safely serialize it,
and create the client with `createSSRApp` plus the same data before mount. A
Fastify handler merely wrapping HTML does not provide that pipeline. Never embed
raw `JSON.stringify(userData)` into a script or hydrate with `createApp`; keep
server/client builds distinct and serve the **emitted client assets**, not a
production `/src/entry-client.ts` URL. Use the built client `index.html` for its
rewritten asset links, or read `build.manifest` server-side to generate entry JS
and recursively imported CSS links under the deployment base. A manifest JSON
file is not a client script. The separate `build.ssrManifest` maps rendered
module IDs to client assets for optional preload hints; it does not replace
entry resolution. [Vite production SSR](https://vite.dev/guide/ssr#building-for-production),
[manifest-driven HTML](https://vite.dev/guide/backend-integration).
[SSR/debugging](debugging-ssr.md) owns hydration/error isolation;
[setup/tooling](setup-tooling.md) owns server/build seams.

### Incumbent mobile, Capacitor and PWA workflow

Do not replace an existing Quasar/native host during a Vue fix. The following
contracts use **@capacitor/core and CLI 8.5.3**, **@capacitor/app 8.1.2**,
**camera 8.2.6**, **geolocation 8.2.4**, **push-notifications 8.1.3**. Plugin
releases are independent; check platform/plugin peers before changing versions.
Capacitor CLI 8.5.3 requires Node >=22; native SDK/Xcode/Android requirements and
device permissions are additional, not proven by a web build.

1. Inspect whether Quasar CLI or plain Vue/Vite owns bootstrap and native output.
   A Quasar Vite plugin alone does not add Quasar CLI mobile/PWA build modes.
   For a new mode in an existing CLI project use `quasar mode add capacitor`
   (or `pwa`); retain its generated `src-capacitor`/`src-pwa` ownership. The current
   CLI evidence is **@quasar/app-vite 3.10.3**, not a reason to migrate an older
   Router/UI during this task. [Alternative UI](alternative-ui.md) owns Quasar
   layout/Notify/Dialog/Loading plugin setup; always hide loading UI in `finally`.
2. For a plain existing web app, configure `appId`, `appName`, and `webDir` from the
   **actual** built directory containing `index.html` (Vite commonly `dist`, not a
   universal `dist/spa`). Initialize Capacitor, install matching Android/iOS
   packages, `cap add` each target once, then build web assets → `cap sync` →
   `cap open android|ios` for native work. Do not ship development `server.url`,
   cleartext exceptions, localhost services or signing secrets in release config.
3. Use responsive CSS for layout; `$q.platform` identifies capabilities/platform,
   `$q.screen` supplies reactive sizing. A setup-time copy of `$q.screen.width`
   or `.lt.md` is a snapshot. Platform detection is not an authorization check,
   and an SSR server cannot infer a client's actual viewport from window APIs.
4. Request each native capability at an understandable user action. Distinguish
   denied permission, disabled system service, user cancellation and real errors.
   iOS privacy strings and Android manifest permissions are separate from the
   JavaScript request. Camera's supported incumbent
   `getPhoto({ resultType: CameraResultType.Uri, source: CameraSource.Camera|Photos })`
   returns `webPath` for display; do not treat it as an uploaded/persisted file.
   In camera 8.2.6 this API is deprecated, not removed: `takePhoto` returns one
   **MediaResult**; `chooseFromGallery` returns **MediaResults** with a `results`
   array, even for single-selection use. Neither is the old `Photo` result.
   Handle Android `appRestoredResult` for camera activities when the OS killed
   the original process.
5. For GPS, use `getCurrentPosition` for one read or `watchPosition` only while the
   feature needs it. It resolves a **promise of an ID**; stop must also handle an
   ID arriving after teardown. `clearWatch({ id })` is asynchronous; report release
   failures. `requestPermissions` is native-only, accuracy is not guaranteed, and
   background geolocation is not supplied by this plugin.
6. For push, install native platform credentials/capabilities (FCM config on
   Android, APNs capability/delegate wiring on iOS), attach `registration`,
   `registrationError`, receive and action listeners **before** calling
   `register`. Check/request permission separately; `register` does not prompt.
   Persist/associate token updates only through a real authenticated backend,
   revoke associations on logout, and validate notification deep links. Delivery
   is platform/state dependent; do not promise killed-app or silent-push support.
7. Retain and remove **each** `PluginListenerHandle`, including a handle returned
   after disposal; do not call `removeAllListeners` from a leaf and break other
   consumers. `appStateChange` drives pause/resume; `appUrlOpen`/`getLaunchUrl`
   drive allowlisted deep links. Android `backButton` overrides default behavior:
   reconcile overlays/router history before deliberate exit, not every root
   navigation. Vue KeepAlive inactivity and native backgrounding are distinct.

Complete explicit-owner location module; permission is handled by its caller.
Native callbacks are ignored after stop even if acquisition resolves late.
`dispose()` returns cleanup failure to its caller; a component should attach it
to its owner with an explicit error-reporting policy, not abandon a promise.

```ts
import { shallowRef } from 'vue'
import { Geolocation, type Position } from '@capacitor/geolocation'

export function createLocationWatch() {
  const position = shallowRef<Position | null>(null)
  const error = shallowRef<unknown>(null)
  let active = true
  const id = Geolocation.watchPosition(
    { enableHighAccuracy: false, timeout: 10000 },
    (next, cause) => {
      if (!active) return
      if (cause) error.value = cause
      else if (next) { position.value = next; error.value = null }
    },
  )
  void id.catch(cause => { if (active) error.value = cause })
  let cleanup: Promise<void> | undefined
  function dispose(): Promise<void> {
    active = false
    cleanup ??= id.then(
      watchId => Geolocation.clearWatch({ id: watchId }),
      () => undefined,
    )
    return cleanup
  }
  return { position, error, dispose }
}
```

### PWA cache, installation and update contracts

For Quasar CLI **3.10.3** PWA mode, use `src-pwa/manifest.json`,
`src-pwa/register-sw` and `pwa.workboxMode`. With **workbox-build 7.4.1**,
`GenerateSW` suits generated precache/simple runtime routing; `InjectManifest`
requires the owned custom worker for advanced routing/push. Configure generated
options via `extendPWAGenerateSWOptions` or injected options via
`extendPWAInjectManifestOptions`, not an obsolete blanket `workboxOptions` object.

| Concern | Contract |
| --- | --- |
| Cache policy | Precache revisioned shell assets. Use bounded `CacheFirst` for immutable/public images/fonts; `NetworkFirst` for deliberately offline-readable changing data; `StaleWhileRevalidate` only when stale content is acceptable. Set expiry/entry limits and ownership of invalidation. Do not cache all `/api` responses: authenticated/user-specific data can leak across logout/accounts, and offline mutations need a real queue/conflict protocol. |
| Navigation/offline | Provide an owned offline/navigation fallback and exclude API paths from HTML fallback. An `online` event/`navigator.onLine` indicates connectivity hints, not API reachability; create reads/listeners after mount and dispose them. Worker scope/HTTPS, manifest start URL/scope, display/colors and actual installable icon files must match deployment/base paths. |
| Installation | `beforeinstallprompt` is nonstandard and unavailable in some browsers. Retain the event, expose a button only when available, call `prompt()` from user activation, then clear the one-use event after accept/dismiss; observe `appinstalled` and standalone display mode. Remove listeners on disposal and offer platform instructions when no prompt exists. Do not fake universal installability. |
| Updating | Inspect both an already waiting worker and `updatefound` → installing `statechange`. A newly installed worker is an **update** only if an old controller exists. Preserve pending edits, ask the user before activation, post `SKIP_WAITING` only if the worker implements it, then wait for **controllerchange** before one reload. Immediate reload after postMessage races activation. `skipWaiting`/`clientsClaim` by default changes this policy and can mix old page/new asset versions. |

Contextual worker fragment for an application-owned **InjectManifest** worker;
include alongside that worker's actual precache/routing implementation, not as a
standalone offline worker:

```js
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})
```

The UI attaches `navigator.serviceWorker.addEventListener('controllerchange', ...)`
**before** posting to `registration.waiting`, guards one reload, and removes the
listener if the owner disappears. Install/update listeners have the same
late-setup cleanup obligation as native handles. [Quasar PWA configuration](https://quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa/),
[worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/controllerchange_event),
[install prompt status](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent).

## Modern Vuetify 3 → 4 boundary

For the preferred **Vuetify 4.3.0**, use the current Vuetify **3→4** upgrade guide and the verified [Vuetify setup](vuetify-setup.md), [components](vuetify-components.md), and [theme](vuetify-theme.md) references. Do not treat an old Vuetify 2→3 tutorial as a 3→4 migration. Inspect changed props/events/slots, form validation results, theme/default configuration, Sass settings, and removed/deprecated components in the actual app; migrate wrappers and their callers together. A Vue 3.5 update alone does not justify replacing a working Vuetify 3 application during a narrow change. [Official upgrade guide](https://vuetifyjs.com/en/getting-started/upgrade-guide/).

## Verification boundary and source corrections

The replacement/Options SFCs, TSX component, typed Options module and location-owner module are complete for their stated hosts/contracts; none is claimed built, mounted or typechecked here. The Nuxt migration checklist delegates runnable host examples to [Nuxt](nuxt.md); it supplies no replacement Nuxt entrypoint. JSON is a contextual merge fragment, and the worker fence is a contextual message handler, not a standalone worker. Review template/model/listener behavior, TSX and generic inference, independent Options instances, permission denial, late native-handle disposal, SSR payload/parameter navigation, authenticated cache isolation, worker activation before reload, and the actual migrated UI contracts with the owning tests.

Corrections incorporated from older/mixed guidance: no universal shallow-ref-for-primitives rule; no state mutation in `updated` presented as safe optimization; no 3.6 Vapor import in a 3.5 example; no universal Composition-inject ref unwrapping; no reactive/getter argument accepted as a template-ref key; no blanket prohibition of supported incumbent Options API; no mandatory hydration strategy, arbitrary loading-delay table, or guaranteed FPS. [Core Vue](core-vue.md) and [components](components.md) own the replacement decisions.

## Sources

- [Vue 3.5.44 registry](https://registry.npmjs.org/vue/3.5.44), [pinned declarations](https://unpkg.com/vue@3.5.44/dist/vue.d.ts), [Vue release policy](https://vuejs.org/about/releases.html).
- [3.4 release/removals](https://blog.vuejs.org/posts/vue-3-4), [3.5 release](https://blog.vuejs.org/posts/vue-3-5), [removed Reactivity Transform](https://vuejs.org/guide/extras/reactivity-transform.html), [SFC macros](https://vuejs.org/api/sfc-script-setup.html).
- [Options TypeScript](https://vuejs.org/guide/typescript/options-api.html), [setup interop](https://vuejs.org/api/composition-api-setup.html), [JSX/render functions](https://vuejs.org/guide/extras/render-function.html), [Vue 2 migration](https://v3-migration.vuejs.org/breaking-changes/).
- [SSR](https://vuejs.org/guide/scaling-up/ssr.html), [Nuxt](https://nuxt.com/docs), [Vuetify upgrade](https://vuetifyjs.com/en/getting-started/upgrade-guide/).
- [Pinned Vue build/entry selection](https://unpkg.com/vue@3.5.44/README.md), [exports](https://unpkg.com/vue@3.5.44/package.json), [compiler entry](https://unpkg.com/vue@3.5.44/compiler-sfc/index.js).
- [Nuxt 4.6.2 metadata](https://registry.npmjs.org/nuxt/4.6.2), [data declarations](https://unpkg.com/nuxt@4.6.2/dist/app/composables/asyncData.d.ts), [server declarations](https://unpkg.com/nuxt@4.6.2/dist/server/index.d.ts), [data fetching](https://nuxt.com/docs/4.x/getting-started/data-fetching), [upgrade/directory contract](https://nuxt.com/docs/4.x/getting-started/upgrade).
- [Capacitor 8 setup](https://capacitorjs.com/docs/getting-started), [CLI 8.5.3 metadata](https://registry.npmjs.org/@capacitor/cli/8.5.3), [app 8.1.2 declarations](https://unpkg.com/@capacitor/app@8.1.2/dist/esm/definitions.d.ts), [camera 8.2.6 declarations](https://unpkg.com/@capacitor/camera@8.2.6/dist/esm/definitions.d.ts), [geolocation 8.2.4 declarations](https://unpkg.com/@capacitor/geolocation@8.2.4/dist/esm/definitions.d.ts), [push 8.1.3 declarations](https://unpkg.com/@capacitor/push-notifications@8.1.3/dist/esm/definitions.d.ts).
- [Quasar CLI 3.10.3 metadata](https://registry.npmjs.org/@quasar/app-vite/3.10.3), [PWA configuration](https://quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa/), [Workbox strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies), [Workbox build 7.4.1 metadata](https://registry.npmjs.org/workbox-build/7.4.1), [browser install prompt](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent).
