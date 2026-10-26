# Setup and tooling

Read for a new Vue/Vite application, dependency/toolchain changes, TypeScript or
SFC type errors, aliases, environment variables, CSS integration, and build scripts.
For a local application change, inspect the existing setup rather than replacing
it with this example. Read [Vuetify setup](vuetify-setup.md) only when Vuetify is
selected; [Nuxt](nuxt.md) owns Nuxt host lifecycle and module boundaries.
[Debugging and SSR](debugging-ssr.md) owns hydration diagnostics and request-isolation
investigation. [Migration](migration.md) owns actual application/API upgrades.
For an explicitly selected OpenVue alternative, use its [dedicated Vite shell](openvue-setup.md#setup-in-a-dedicated-vite-app), not the default Vuetify workbench. The [official Nuxt module profile](openvue-setup.md#official-nuxt-module-complete-separate-application) has a separate host lifecycle. [OpenVue theming](openvue-theming.md) owns token/PT/layer contracts.

## Exact example baseline and API status

The bundled [dependency manifest](../assets/example-app/package.json) pins stable
packages; these are a reproducible direct-dependency snapshot, not a claim that
every package is the latest release or that all combinations have been exercised.
The Router/Pinia pins bound this example only; the owning [routing](routing.md)
and [state](state.md) references may cover newer majors and incumbent compatibility.
Do not downgrade an existing app to reproduce the fixture.

| Package | Exact example version | Responsibility |
| --- | --- | --- |
| `vue` | `3.5.44` | Runtime and matching SFC compiler via `vue/compiler-sfc` |
| `vuetify` | `4.3.0` | UI components/styles |
| `pinia` | `3.0.4` | Local in-memory task state |
| `vue-router` | `4.6.4` | SPA navigation |
| `vite` | `8.3.4` | Dev server and production bundling |
| `@vitejs/plugin-vue` | `6.0.10` | Vue SFC transform and HMR |
| `typescript` | `5.9.3` | TypeScript language/compiler |
| `vue-tsc` | `3.3.13` | Type checking `.ts` and `.vue` files |
| `@types/node` | `24.19.2` | Types for Node-side configuration |

[Vite 8.3.4](https://registry.npmjs.org/vite/8.3.4) and
[plugin-vue 6.0.10](https://registry.npmjs.org/@vitejs/plugin-vue/6.0.10)
require Node `^20.19.0 || >=22.12.0`. The plugin explicitly accepts Vite 8 and
Vue 3.5 through its published peer ranges. The selected workbench toolchain is
Node `24.15.0` and Bun `1.4.3`, pinned as `packageManager: "bun@1.4.3"`; this
statement does not record an executed build. Bun installs dependencies and launches
scripts; Node remains required for Node-shebang CLIs such as Vite and `vue-tsc`.
Do not add `--bun` to force those CLIs onto Bun's runtime or infer compatibility
for every framework, native dependency, or generator from this package-manager choice.
The current rolling [create-vue quick-start](https://vuejs.org/guide/quick-start.html)
has a stricter Node prerequisite, `^22.18.0 || >=24.12.0`. Do not equate a
scaffolder's prerequisites with the engine range of an existing locked app.
[`vue-tsc` 3.3.13](https://registry.npmjs.org/vue-tsc/3.3.13) declares TypeScript
`>=5.0.0`; that open-ended range alone does not prove every future TypeScript
major works. Keep the explicit TypeScript 5.9.3 snapshot until an upgrade is checked.

## Existing application or greenfield?

| Situation | Action |
| --- | --- |
| Existing app, monorepo, or framework-owned config | Read workspace package manifests, lockfile, `packageManager`, Node policy, Vite/framework config, `tsconfig` references, aliases, scripts, CSS entry and plugin registration. Preserve its package manager and conventions. |
| New ordinary Vue SPA | Use official `create-vue`, choose TypeScript, and add Router/Pinia/testing only for actual requirements; or copy the complete bundled workbench when its scope matches. |
| New minimal Vite experiment | `create-vite` supports `vue-ts`; it is a smaller starting point, not a replacement for a selected framework's generator. |
| Nuxt/SSR/SSG application | Use that framework's own modules, generated types and server/client configuration. Do not paste SPA `main.ts`, history, or environment assumptions into it. |
| Vue CLI/webpack incumbent | Keep narrow work compatible; a Vite migration is a separate scoped change with deployment, plugin, env and build parity. |

For a **new directory**, the official rolling generator is:

```sh
bun create vue@latest
```

Select the project name in its prompt, then use `bun install` and `bun run dev`
inside that directory unless the generated project explicitly declares another
manager. `bun create vue@latest` runs the `create-vue` npm package through `bunx`;
it fetches the generator's current release and its current template versions.
It does **not** recreate this skill's pinned snapshot. For a minimal experiment,
`bun create vite@latest my-vue-app --template vue-ts` selects Vite's Vue/TypeScript
template with the same rolling-version caveat. Do not run a generator over a
populated application. Keep generated TypeScript project references when they
separate app, configuration, and test globals.

### Package-manager and lockfile care

1. Respect the repository's declared manager/version and authoritative lockfile;
   the Bun preference applies to new/equivalent workflows, not forced migration.
   Do not introduce `bun.lock` beside an incumbent npm/pnpm/Yarn lock or update
   unrelated workspace dependencies. Install from the correct workspace root.
2. For a new Bun snapshot, `bun install` resolves dependencies and creates/updates
   `bun.lock`; commit the generated lockfile with the application. Exact direct
   pins alone do not lock the transitive tree. To intentionally add a package,
   use `bun add`; `bun add --exact vue@3.5.44` adds an exact runtime pin, while
   `bun add --dev --exact vue-tsc@3.3.13` adds an exact development pin. These are
   examples for a project choosing these versions, not instructions to downgrade
   an incumbent app. Commit manifest and lock changes together.
3. For locked reproduction, first require a nonempty committed `bun.lock`, then
   use `bun install --frozen-lockfile` with the pinned Bun version. For this
   committed text-lock workflow it refuses a manifest/lock resolution mismatch.
   **A missing lockfile alone does not make the frozen flag fail**: without a
   lock Bun can resolve dependencies without saving one. In **Bun 1.4.3**, an
   imported npm/Yarn/pnpm or binary Bun lock can even cause a migrated `bun.lock`
   to be written under this flag; it is not a migration guard. Do not call either
   case locked reproduction. [Exact 1.4.3 checks and migration exception](https://github.com/oven-sh/bun/blob/bun-v1.4.3/src/install/PackageManager/install_with_manager.rs#L2164-L2195)
   take precedence over later rolling documentation. Unlike `npm ci`, this
   command does not promise to remove `node_modules`; use a fresh checkout/copy
   when a clean dependency tree is required. In an incumbent npm project, keep
   its matching `package-lock.json` and `npm ci` workflow.
4. An explicitly requested migration may use Bun's automatic existing-lock import.
   Preserve the old lock until resolved package versions/integrities and direct
   pins have been compared, then retain one authoritative lock. Earlier migration
   notes recorded an npm lockfile-v3 → Bun 1.4.3 cutover preserving 88 package
   name/version/integrity records and nine direct pins before removing the old
   `package-lock.json`. That is historical evidence, not a fresh comparison:
   the deleted npm lock is not available to this source review. Do not hand-edit
   resolutions or certify another migration from those counts.
5. Inspect engine/peer conflicts rather than hiding them with force flags. Bun
   dependency lifecycle scripts follow a trust policy, not npm's default behavior:
   inspect install output and `bun pm untrusted`. Review any required script before
   granting trust to that specific package; never trust all merely to make an
   install pass. Omitting `trustedDependencies` uses Bun's built-in default allowlist
   for npm packages; specifying the field replaces that default list. This fixture
   leaves it omitted. Earlier Linux migration notes reported no blocked scripts
   and zero entries from `bun pm untrusted`; they identified optional Darwin-only
   `fsevents` as the old lock's only `hasInstallScript` package. These are historical
   observations, not a newly executed install or a fresh inspection of the deleted
   lock, and establish neither macOS behavior nor that every ecosystem script runs.
6. Keep one intended Vue runtime per application. For lower-level compiler tools,
   prefer `vue/compiler-sfc`; if `@vue/compiler-sfc` is explicitly installed, match
   its version to `vue`. Also align `@vue/server-renderer` with Vue when used.
   Do not install a Vue 3.6 compiler to obtain macros for a Vue 3.5 runtime.

## Run the bundled workbench

Use a fresh copy if changes should not modify the installed skill. Keep its
committed `bun.lock`, install Bun `1.4.3` and a supported Node version, and confirm
`bun --version` matches `packageManager`. From the skill root, in a POSIX shell:

```sh
cd assets/example-app
test -s bun.lock || { echo "Missing committed bun.lock" >&2; exit 1; }
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run dev
```

These commands are runnable instructions, not recorded typecheck/build results.
Do not substitute plain `bun install` for locked reproduction: that is the
resolution/update workflow above. Bun resolves script binaries from local
`node_modules/.bin`; pass application arguments after the script name directly,
for example `bun run dev --host 127.0.0.1` (no npm-style `--` separator). `bunx`
also honors Node shebangs by default; neither launcher removes Node prerequisites.
The example needs no `.env`, API keys, backend, external font or icon service.
It provides Tasks (`/`), About (`/about`) and a lazy Graphics (`/graphics`) route,
light/dark UI, validated task creation, completed-state toggling and reset
confirmation; all task state is memory-only and resets on reload. Graphics waits
for explicit **Start scene** before importing renderer packages: default
experimental WebGPURenderer or explicit WebGLRenderer compatibility, with its actual initialized backend shown
separately from the renderer family. Stop, renderer change, native loss or leaving
the page retires its scene; returning never starts it automatically. Its DOM
description/errors remain available without graphics, and optional rotation
respects reduced motion. See the [composition and evidence boundary](tresjs.md#bundled-workbench-composition).

For new compatible scenes, use WebGPURenderer as the modern standard default
posture and follow the [preferred factory recipe](tresjs.md#experimental-webgpu-and-custom-rendering).
Every material, effect, dependency and enabled feature must support both WebGPU
and its built-in WebGL2 backend to claim fallback. WebGLRenderer is an explicit
compatibility choice for unported GLSL ShaderMaterial/onBeforeCompile, legacy
EffectComposer or other incompatible pipelines, not an automatic interchangeable
fallback. The pinned Tres 5.9.3 / Three 0.186.1 integration remains experimental
with its documented lifecycle limits; this preference neither upgrades packages
nor certifies hardware or promises that WebGPU is always faster.
This is not a persistence, authorization, SSR, deployment or hardware-certification demonstration.

| Script | Actual command | What success establishes |
| --- | --- | --- |
| `bun run dev` | `vite` | Development server starts; inspect its actual printed URL/port |
| `bun run typecheck` | `vue-tsc --noEmit` | Selected TypeScript/SFC inputs satisfy the configured types |
| `bun run build` | `vite build` | Production assets can be bundled; not a type or behavior check |

Vite does not typecheck during transpilation. Keep `typecheck` and `build` as
separate scripts or explicitly run both in the application's CI. Do not infer one
from the other. Vite 8 uses **Oxc** for TypeScript transformation and **Rolldown**
for bundling; older esbuild/Rollup-specific configuration recipes need version
review, not mechanical copying. See [Vite features](https://vite.dev/guide/features).

For isolated SFC evidence, distinguish `parse`, `compileScript`, and
`compileTemplate` (or `compileScript` with explicit `inlineTemplate: true`).
Parsing a descriptor or compiling setup alone does not establish template code
generation. Inspect returned template/style diagnostics, supply the real binding/
compiler options, and distinguish client from SSR compilation. Even successful
block compilation does not resolve the application's imports, CSS preprocessors,
plugin transforms or bundle graph; use the real build for those and runtime tests
for behavior. [Exact compiler workflow](https://github.com/vuejs/core/blob/v3.5.44/packages/compiler-sfc/README.md),
[3.5.44 compiler options/results](https://unpkg.com/@vue/compiler-sfc@3.5.44/dist/compiler-sfc.d.ts).

## Minimal configuration and plugin ownership

The following is a **complete alternative `vite.config.ts`** for a Vue SPA using
an optional `@` alias. It is not an instruction to overwrite the fixture or an
incumbent framework config. `@types/node` supplies the Node import types.

```ts
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

Matching **complete minimal `tsconfig.json`** for this single-project SPA variant:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "strict": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "jsx": "preserve",
    "jsxImportSource": "vue",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

For a larger project, separate browser and Node/test configurations so Node/test
globals do not leak into browser code. Preserve generated `@vue/tsconfig` and
project references when present. `paths` informs TypeScript; the explicit Vite
alias resolves runtime imports. Vite 8 also offers `resolve.tsconfigPaths`, but
choosing that is an alternative to duplicate alias ownership, not a required
extra plugin. `target` in tsconfig does not configure Vite's browser support;
choose Vite's production `build.target` from actual supported browsers.

An explicit `compilerOptions.types` array restricts automatically included package
globals: `types: []` excludes them, while the example above admits only
`vite/client` and `node`. Imported modules still receive their normal types.
Add genuine ambient prerequisites deliberately (for example the
[VueUse Bluetooth/Temporal types](vueuse.md#authoring-globals-and-reproducible-typing-scope));
do not replace missing declarations with invented globals or runtime polyfills.
See [TypeScript `types`](https://www.typescriptlang.org/tsconfig/types.html).

- `vue()` handles SFCs. Add `@vitejs/plugin-vue-jsx` only for actual JSX/TSX use;
  TypeScript's JSX options alone do not provide Vue's full JSX transform.
- Respect each plugin's documented ordering. Vite groups `enforce: 'pre'`, normal,
  and `enforce: 'post'` plugins around its core/build plugins; array position is
  not the only ordering rule. Do not blanket-set every plugin to `pre`.
- The fixture uses explicit Vuetify component/directive registration and **no**
  `vite-plugin-vuetify`. If choosing that optional plugin for auto-imports or
  Sass customization, follow [Vuetify setup](vuetify-setup.md) for the verified
  plugin API/order. Do not register competing component resolvers for the same UI.
- Auto-imports, DevTools plugins, bundle visualizers, compression and monitoring
  integrations are optional, not an “essential plugins” bundle. If incumbent,
  preserve their generated declaration ownership and include those declarations
  in typecheck. Do not invent ambient declarations to hide unresolved imports.
- At runtime, install application plugins before `mount`. Install Pinia before
  Router when initial navigation/guards use stores; pass the intended Pinia
  instance to store calls outside component setup when context is unavailable.
  Install Vuetify before mounting its components. Vite's transform-plugin order
  and Vue's `app.use` registration order solve different problems; neither is a
  universal alphabetical ordering rule. See [state](state.md) and
  [routing](routing.md) for injection and initial-navigation details.

### Strict templates and native data attributes

For the retained **vue-tsc / `@vue/language-core` 3.3.13** profile, the published
defaults are **`dataAttributes: []`** and **`htmlAttributes: ["aria-*"]`**.
When legitimate native `data-*` attributes are part of the application contract,
this supported configuration can be merged into the existing tsconfig:

```json
{
  "vueCompilerOptions": {
    "strictTemplates": true,
    "dataAttributes": ["data-*"]
  }
}
```

This option **skips attribute typechecking for matching names**; it does not
validate their values, selector spelling, virtual-row indices, or measurement
registration. Keep those application invariants in typed helpers and behavioral
checks where required. It does not turn off unknown component-prop checks or
permit unrelated undeclared props such as `unknownProp`; retain strict template
checking and fix actual consumer defects. Prefer a narrower pattern when only a
specific data-attribute namespace is intended. Do not broaden `htmlAttributes`
to `["*"]` or disable strictness as a substitute.
[Exact 3.3.13 option table](https://unpkg.com/@vue/language-core@3.3.13/README.md),
[exact defaults/resolver](https://unpkg.com/@vue/language-core@3.3.13/lib/compilerOptions.js),
[official option semantics](https://github.com/vuejs/language-tools/wiki/Vue-Compiler-Options#dataattributes).

### CSS, assets, and production boundaries

Load global CSS explicitly from the application entry; the fixture imports
`vuetify/styles` before app-specific styling. Scoped SFC styles remain local;
use deliberate global tokens/resets instead of a second UI framework's reset.
Sass syntax requires a separately selected compatible Sass dependency; plain
Vuetify CSS does not. Component auto-imports do not imply icon fonts or their CSS
are loaded. Keep icon strategy and required assets explicit.

Vite handles imported assets and extracts production CSS. Start with its defaults;
do not disable CSS splitting, choose `esnext`, force manual vendor chunks, or
raise chunk warnings merely to silence feedback. Measure a real requirement
before changing output strategy. A hidden source map is still a generated file;
exclude it from public deployment or upload/delete it deliberately if it contains
sensitive source. A dev proxy is neither a production API server nor authorization.
Do not expose the dev server on all interfaces unless needed and permitted.

## Advanced tooling: diagnose and change one contract

These contracts use **Vite 8.3.4** (Rolldown dependency `~1.2.12`); they are not a
request to add every optional integration. Preserve the installed framework's
configuration owner and use its matching plugin declarations.

| Task | Action and failure boundary |
| --- | --- |
| Local HTTP/WebSocket backend | `server.proxy` matches path prefixes (or `^` regexes). Set a fixed trusted `target`; rewrite only the prefix the backend does not accept. `changeOrigin` adjusts the upstream Host header, not browser authorization. `ws: true` forwards upgrades; ensure the backend validates Origin/auth. Do not enable `rewriteWsOrigin` to bypass CSRF checks. A nonrelative Vite `base` must prefix matching rules. |
| Dev access or CORS failure | `server.host` controls bind interfaces; `allowedHosts` limits accepted names; `server.cors` controls which browser origins can read the dev response. None replaces another or backend authentication. Keep explicit trusted host/origin lists, not blanket `true`; avoid exposing source via LAN/public bindings or DNS rebinding. Proxying makes the browser call the dev origin, not a production CORS solution. |
| Debug a transformed source | Dev transform maps are separate from `build.sourcemap`. Build `false` emits none; `true` emits separate `.map` files with a linking comment; `'inline'` embeds maps into JS; `'hidden'` emits maps without the comment. Match generated file/release and original source paths. Set a debugger's web root to the actual workspace and map actual URL prefixes only when needed; do not paste webpack path overrides into a Vite session. |
| Application-owned production symbolication | Preserve source maps through all transforms and retain the **same** generated artifacts deployed by the CI job in an access-controlled application-owned artifact store. Match generated file/release and original sources when resolving a stack. Keep `.map` files out of public output, including CDN/storage copies; `'hidden'` alone is not access control. Do not introduce a hosted monitoring SDK, upload token or account as an implicit build prerequisite. |
| Components/API auto-imports | A resolver maps component names to actual package exports/styles; an API auto-import transform maps identifiers to imports. They are optional alternatives to explicit imports, not runtime registries. Keep one resolver per component namespace, include generated `.d.ts` files in the app's typecheck, and regenerate them when the scan/config changes. Generated declarations must agree with transformed runtime imports; neither suppress missing modules nor assume auto-imported components load icon CSS. |
| Reduce bundle/update cost | First inspect initial and lazy chunks, duplicate libraries, large assets and module evaluation. ESM named imports are clear, but namespace imports do **not** inherently disable tree shaking: static usage, package side effects and the bundler decide. In a published package, declare CSS/registration/polyfill side effects accurately; `sideEffects: false` can incorrectly remove them. Application `package.json` metadata does not rewrite dependencies' contracts. |
| Split chunks deliberately | Start with dynamic route/component imports and default splitting. Vite 8 uses `build.rolldownOptions`; `build.rollupOptions` is a deprecated alias, not proof every old Rollup option works unchanged. Advanced grouping uses Rolldown `output.codeSplitting.groups` after inspecting the locked version. Splitting every `node_modules` path is fragile for scoped packages, pnpm paths, request overhead and execution ordering; a forced vendor chunk can eagerly load lazy dependencies or reorder side effects. Keep order-sensitive modules together and measure cache hits/network waterfalls. |
| Tune transformation/minification | Vite 8 defaults to Oxc and Rolldown; do not copy `minify: 'esbuild'`, old optimizer options, CSS-unsplitting or `target: 'esnext'` as universal speed fixes. `optimizeDeps` targets development prebundling, not a general production chunk plan. Preserve supported browser/WebView targets, async CSS loading and measured correctness before changing defaults. |
| Deliver compressed output | `.gz`/`.br` files alone do nothing. Configure the real host/CDN to select an accepted encoding, return the original MIME type plus correct `Content-Encoding`, and vary cache entries by `Accept-Encoding` (`Vary`). Retain an identity representation, avoid double compression, and inspect actual response/transfer sizes. Compression changes transfer cost, not parsed JS or execution cost. |
| Optimize images | Supply intrinsic width/height (reserve aspect ratio), useful `alt`, responsive `srcset`/`sizes` or `<picture>` formats with a fallback, and appropriately sized encoded assets. Preserve SVG `viewBox` and visual semantics when optimizing. `decoding="async"` is a hint; `loading="lazy"` suits offscreen images, **not** the likely LCP/hero image. Use eager loading and, when justified, `fetchpriority="high"` for that image rather than assigning high priority to all assets. |
| Establish improvement | Record release, device/network, route/interaction and dataset. Compare production bundle graphs and real network transfer, then CPU/render work and field distributions; smaller gzip alone is not proof of lower interaction latency. Core Web Vitals are LCP, CLS and **INP**; old `onFID` code is obsolete. FCP/TTFB are useful diagnostics, not replacements. Use an analyzer compatible with the locked Rolldown/Vite release; a treemap does not establish runtime benefit. |

Complete alternative dev config; **requires an application-owned local backend**
on port 3000. It does not provide that backend, and is not a production proxy:

```ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        rewrite: path => path.replace(/^\/api(?=\/|$)/, ''),
      },
      '/ws': { target: 'ws://127.0.0.1:3000', ws: true },
    },
  },
})
```

Complete optional **web-vitals 6.2.3** module; call once from the browser bootstrap
when authorized. `report` is the application's real consent-aware reporting
contract, not an invented endpoint. This module does not adopt a backend or claim
observed performance:

```ts
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals'

export function observeCoreVitals(report: (metric: Metric) => void) {
  onCLS(report)
  onINP(report)
  onLCP(report)
}
```

Report only permitted metric fields; avoid leaking URLs, user data or DOM content.
Investigate field regressions alongside a reproducible profile, not just a single
lab score. [Vite server options](https://vite.dev/config/server-options),
[build options](https://vite.dev/config/build-options),
[Rolldown splitting](https://rolldown.rs/reference/OutputOptions.codeSplitting),
[pinned vitals exports](https://unpkg.com/web-vitals@6.2.3/dist/modules/index.d.ts).

## Environment values are not credentials

[Vite env rules](https://vite.dev/guide/env-and-mode) expose `VITE_*` values to
client bundles as strings and replace them at build time. Never place secret API
keys, database passwords, private signing material, or provider credentials in
those variables, `define`, or serialized app state. A publishable browser key is
public by design, not a way to conceal a secret. Keep private operations behind an
application-owned server; changing a variable prefix is not a security boundary
if code later sends the value to the browser.

Complete optional `src/vite-env.d.ts` for a **public** title; no import statements:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string
}
```

Contextual component fragment consuming that optional public value:

```vue
<script setup lang="ts">
const title = import.meta.env.VITE_APP_TITLE?.trim() || 'Vue application'
</script>

<template>
  <h1>{{ title }}</h1>
</template>
```

No `.env` file is required for this example: the fallback is an explicit UI title,
not a fake service implementation. Declarations do not validate runtime env values.
Parse numbers/booleans intentionally; `Boolean('false')` is `true`. Mode-specific
files override generic files, while existing process env has highest priority.
Restart Vite after env changes. **Bun also preloads `.env` into `process.env`**,
so those already-present values can prevent Vite's mode-specific files from
overriding generic values. When Vite should own env-file selection, launch with
`bun run --no-env-file dev --mode staging` (or the corresponding build script);
explicitly supplied process variables still win. See [Vite's Bun caveat](https://vite.dev/guide/env-and-mode#env-files)
and [Bun's env-file switch](https://bun.com/docs/runtime/environment-variables#disabling-automatic-env-loading).
Ignore local env files in version control; `*.local` alone does not prevent
accidental client bundling. `--mode staging` selects env mode and does not itself
make a development build. For browser runtime configuration, define a separately
validated public delivery mechanism rather than assuming build-time env changes
after deployment.

## SSR is a different setup

The workbench is a client-rendered SPA: `createApp`, a DOM mount, and browser
history are not an SSR implementation. SSR needs a server entry, client hydration
entry, request-scoped application/router/state, safe state serialization, and
appropriate server/client build/deployment handling. Browser-only imports may
execute before a runtime `window` guard; defer or replace them at the integration
boundary. Keep server-only credentials/modules out of the client graph.

Use Nuxt's module/runtime-config/server-route conventions in Nuxt, not generic
`defineNuxtPlugin`/`useNuxtApp` snippets in a Vite SPA. Vite's own SSR guide is a
low-level integration API, not a promise that adding `--ssr` converts an SPA into
a complete server app. Continue with [debugging and SSR](debugging-ssr.md).

## Proposed checks, not observed verification

When authorized, run the locked install and the application's own typecheck and
production build separately. Exercise navigation/direct route entry, validation,
keyboard submission, dialog cancel/confirm focus, light/dark UI and narrow layout
in the browser when they are affected. For deployment, check base paths, SPA
fallback or SSR route handling, public assets and credential exposure. Report only
commands and outcomes actually observed. This reference records registry/docs
research; it does not record executed installs, tests, builds or browser checks.

## Sources

- [Vue quick-start](https://vuejs.org/guide/quick-start.html), [TypeScript overview](https://vuejs.org/guide/typescript/overview.html), and [Vue 3.5.44 compiler-SFC README](https://github.com/vuejs/core/blob/v3.5.44/packages/compiler-sfc/README.md): scaffolding, SFC typechecking and matched compiler entry.
- [Vite 8.3.4 registry metadata](https://registry.npmjs.org/vite/8.3.4), [plugin-vue 6.0.10 metadata](https://registry.npmjs.org/@vitejs/plugin-vue/6.0.10), [TypeScript 5.9.3 metadata](https://registry.npmjs.org/typescript/5.9.3), and [vue-tsc 3.3.13 metadata](https://registry.npmjs.org/vue-tsc/3.3.13): exact versions, engines and peers. The example manifest records the remaining direct pins.
- [Vite features](https://vite.dev/guide/features), [plugin ordering](https://vite.dev/guide/using-plugins#enforcing-plugin-ordering), [shared config](https://vite.dev/config/shared-options), [env/modes](https://vite.dev/guide/env-and-mode), and [SSR boundary](https://vite.dev/guide/ssr): Vite 8 behavior. Prefer these current transform details over older references to esbuild in general Vue tooling prose.
- [Bun install](https://bun.com/docs/pm/cli/install), [lockfile/migration](https://bun.com/docs/pm/lockfile), [dependency lifecycle trust](https://bun.com/docs/pm/lifecycle), [script launching](https://bun.com/docs/runtime), and [bunx](https://bun.com/docs/pm/bunx): installation, frozen-lock caveat, migration and runtime boundaries. Installed Bun 1.4.3 CLI help supplies the command flags; [npm ci](https://docs.npmjs.com/cli/v12/commands/npm-ci) applies only to an incumbent npm workflow.
- [Vite 8.3.4 declarations](https://unpkg.com/vite@8.3.4/dist/node/index.d.ts), [server/proxy/security](https://vite.dev/config/server-options), [build/source maps](https://vite.dev/config/build-options), [Rolldown code splitting](https://rolldown.rs/reference/OutputOptions.codeSplitting).
- [web-vitals 6.2.3 exports](https://unpkg.com/web-vitals@6.2.3/dist/modules/index.d.ts), [web-vitals project](https://github.com/GoogleChrome/web-vitals).
- [HTTP encoding negotiation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Encoding), [image loading/size contracts](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img).
