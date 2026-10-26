# Sources, versions and evidence

Read this before resolving contradictory examples, changing a package version, auditing coverage, or claiming that a check proves behavior. This is the provenance and lookup reference, not a second API manual. Follow the capability reference for implementation details.

## Baseline and authority

The authored baseline is **Vue 3.5.44** with pinned **Vuetify 4.3.0**; **Vuetify 4.3.x** is preferred for new general-purpose UI. Composition API, TypeScript and `<script setup lang="ts">` are the greenfield default; preserve a working incumbent stack during a narrow task. These are authoring preferences, not a promise that every optional ecosystem package is installed or jointly tested.

For new compatible 3D scenes, **WebGPURenderer is the modern standard default posture**; the [TresJS reference](tresjs.md#experimental-webgpu-and-custom-rendering) owns the preferred factory recipe and pinned **Tres 5.9.3 / Three 0.186.1** experimental integration/lifecycle limits. Claim its built-in WebGL2 fallback only when the entire scene's materials, shaders, effects, dependencies and enabled features support **both backends**. WebGLRenderer is an explicit compatibility choice for pipelines that cannot use WebGPURenderer (including unported GLSL ShaderMaterial/onBeforeCompile or legacy EffectComposer), never an automatic interchangeable fallback. This authoring policy does not reclassify upstream experimental status, renew historical observations, certify new hardware or assert that WebGPU is always faster.

The following precedence is this skill's **evidence policy**, not an upstream guarantee:

1. **The application's exact installed package:** lockfile resolution, package exports, bundled declarations, runtime source and matching release tag. Declarations settle import/signature questions; implementation settles behavior that declarations cannot express. A declaration may still contain stale comments. Do not infer runtime guarantees from a type alone.
2. **Official documentation for that exact release:** versioned docs, migration notes, release notes and tagged upstream source. Rolling official docs can describe a newer minor, a prerelease or an obsolete toolchain assumption. Record the specific claim and version rather than treating the entire site as one immutable authority.
3. **Exact registry metadata:** `version`, `exports`, `types`, `engines`, dependencies and peer ranges. A peer range establishes declared eligibility, not successful integration, accessibility or runtime correctness.
4. **Discovery indexes:** official site search, Context7 and web search help locate primary evidence. Check their snippets against the sources above; neither ranking nor snippet count proves compatibility. No discovery service or credential is required to use this skill.
5. **Historical skill material:** a coverage input, never an API authority. The bundled snapshot records provenance without requiring any prior skill installation.

[Vue's release policy](https://vuejs.org/about/releases) explicitly permits TypeScript definition changes across minor releases and warns about compiler/runtime minor mismatches. Keep the compiler/runtime family aligned. Do not teach Vue 3.6-only or Vapor APIs as Vue 3.5 APIs. Treat experimental features and prerelease adapters as explicitly selected, exact-pinned integrations even when discovered through a stable library's documentation. The WebGPURenderer-first authoring policy above retains that experimental boundary rather than claiming upstream stability.

The [Vue 3.5.44 registry record](https://registry.npmjs.org/vue/3.5.44) pins its compiler, renderer and runtime dependencies to 3.5.44. The [Vuetify 4.3.0 record](https://registry.npmjs.org/vuetify/4.3.0) declares Vue `^3.5.0 || ^3.6.0-0`, TypeScript `>=4.7`, optional `vite-plugin-vuetify >=2.1.0` and optional `webpack-plugin-vuetify >=3.1.0`. The Vue 3.5.44 baseline falls inside that Vue range; the range is not evidence for mixing other packages or enabling future Vue features. Review [Vuetify upgrades](https://vuetifyjs.com/en/getting-started/upgrade-guide/) before translating v2/v3 examples.

## Lookup workflow, including offline work

1. Inspect the existing app's `package.json`, lockfile, router, state providers, UI plugin and SSR entry points before choosing defaults. Record exact resolved versions; distinguish dependencies from optional integrations and dev tooling.
2. Open the package's installed `package.json` and follow its `exports` and `types` targets. Search the declaration for the requested API, then read its implementation or release-tagged source when behavior is ambiguous. Use the project's established file tools; package layouts vary.
3. Read the owning bundled reference, its version/status section and primary links. Separate its architectural recommendations from upstream contracts. If an incumbent version differs, verify the corresponding older/newer contract rather than silently upgrading it.
4. Online, query official docs and exact registry records. If discovery is needed, resolve a library before querying Context7 and follow its returned primary URLs. Never send application secrets or private code to a public search service.
5. Offline, use this skill, installed declarations/source, checked-in lockfiles and locally cached official docs. Do not install a new version to make a remembered API available. State precisely what is unavailable when exact release evidence is absent; a cached page is not necessarily for the installed release.
6. Record the conclusion as: package/version, API/import, primary URL or installed path, confirmed scope, unresolved boundary and the check actually exercised. Do not turn a recommendation into a reported result.

These are **lookup commands**, not evidence that they have been run in a target app:

```sh
# Bun lockfile dependency view; inspect installed package files separately.
bun pm ls

# Online exact registry lookup, not an install or a compatibility test.
# Inspect version, exports, dependencies and peer fields in the returned JSON.
bun info vue@3.5.44 --json
bun info vuetify@4.3.0 --json
```

`bun pm ls` lists direct dependencies according to the Bun lockfile; it is not an `npm ls`-style validation of the installed tree. Inspect the actual `node_modules/vue/package.json` and `node_modules/vuetify/package.json` and their exports/declarations before claiming those releases are installed. In an incumbent npm project, retain `npm ls vue vuetify --depth=0` for its installed-tree diagnostics rather than generating a Bun lockfile merely to inspect it. Missing dependencies or a failed inspection do not authorize replacing the application's authoritative lockfile. A registry fetch failure is an unavailable evidence source, not proof that the package/API is absent. Bun 1.4.3's installed `bun pm --help` and `bun info --help` confirm the commands above; the full JSON lookup avoids assuming npm's multi-field output contract. See [Bun package-manager utilities](https://bun.com/docs/pm/cli/pm), [registry inspection](https://bun.com/docs/pm/cli/info) and [setup and tooling](setup-tooling.md).

## Official routes by capability

These are primary navigation entry points. Exact versions and API contracts live in the linked owning reference; a URL in this table alone does not certify its current content against every release.

| Capability and owning reference | Official route |
| --- | --- |
| [Vue APIs](core-vue.md), [components](components.md), [composables](composables.md), [migration](migration.md) | [Guide](https://vuejs.org/guide/introduction.html), [API](https://vuejs.org/api/), [releases](https://vuejs.org/about/releases), [tagged core](https://github.com/vuejs/core/tree/v3.5.44) |
| [Nuxt framework](nuxt.md), [selected integrations](nuxt-integrations.md) | [Nuxt 4 guide](https://nuxt.com/docs/4.x/getting-started/introduction), [Nuxt source](https://github.com/nuxt/nuxt), [Pinia Nuxt](https://pinia.vuejs.org/ssr/nuxt.html), [Colada](https://pinia-colada.esm.dev/); exact module/peer contracts and prerelease boundaries belong to the integration owner |
| [VueUse](vueuse.md), [integrations](vueuse-integrations.md) | [Core](https://vueuse.org/functions.html), [components](https://vueuse.org/guide/components.html), [integrations](https://vueuse.org/integrations/README.html), [math](https://vueuse.org/math/README.html), [source](https://github.com/vueuse/vueuse) |
| [Application state](state.md) | [Pinia](https://pinia.vuejs.org/), [TanStack Store Vue](https://tanstack.com/store/latest/docs/framework/vue/overview) |
| [Application-owned session boundaries](auth.md) | [Vue watchers](https://vuejs.org/api/reactivity-core.html#watch), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html); client coordination is not a server identity implementation |
| [Routing](routing.md), [alternative router](routing-tanstack.md) | [Vue Router](https://router.vuejs.org/), [TanStack Router](https://tanstack.com/router/latest) |
| [Query](tanstack-query.md), [Colada](pinia-colada.md) | [TanStack Vue Query](https://tanstack.com/query/latest/docs/framework/vue/overview), [Pinia Colada](https://pinia-colada.esm.dev/) |
| [Forms](forms.md), [VeeValidate](vee-validate.md), [TanStack Form](tanstack-form.md), [FormKit](formkit.md) | [VeeValidate v4](https://vee-validate.logaretm.com/v4/), [TanStack Vue Form](https://tanstack.com/form/latest/docs/framework/vue/overview), [FormKit core](https://formkit.com/essentials/architecture) |
| [Vuetify setup](vuetify-setup.md), [components](vuetify-components.md), [theme](vuetify-theme.md) | [Installation](https://vuetifyjs.com/en/getting-started/installation/), [API](https://vuetifyjs.com/en/api/), [theme](https://vuetifyjs.com/en/features/theme/), [v4.3.0 source](https://github.com/vuetifyjs/vuetify/tree/v4.3.0/packages/vuetify/src) |
| [Design](design-system.md), [accessibility](accessibility.md) | [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) |
| [Headless primitives](headless-ui.md) | [Floating UI Vue](https://floating-ui.com/docs/vue), [Reka UI](https://reka-ui.com/docs/overview/introduction), [shadcn-vue](https://www.shadcn-vue.com/docs/introduction.html) |
| [OpenVue selection](openvue.md), [setup](openvue-setup.md), [theming](openvue-theming.md), [forms](openvue-forms.md), [data](openvue-data.md), [overlays](openvue-overlays.md), [navigation](openvue-navigation.md), [components](openvue-components.md) | [OpenVue source](https://github.com/openvi-foundation/openvue), [OpenVue documentation](https://openvue.dev/); exact published 1.0.0 declarations/runtime govern copyable contracts |
| [Quasar incumbent route](alternative-ui.md) | [Quasar](https://quasar.dev/), [Quasar releases](https://github.com/quasarframework/quasar/releases) |
| [Tables](data-tables.md), [virtualization](virtualization.md) | [TanStack Vue Table](https://tanstack.com/table/latest/docs/framework/vue/overview), [TanStack Vue Virtual](https://tanstack.com/virtual/latest/docs/framework/vue/virtualizer) |
| [Visualization](visualization.md) | [Unovis](https://unovis.dev/docs/intro/), [Vue Data UI](https://vue-data-ui.graphieros.com/) |
| [Three.js](tresjs.md) | [TresJS](https://docs.tresjs.org/), [Three.js](https://threejs.org/docs/) |
| [Motion](motion.md) | [Motion for Vue](https://motion.dev/docs/vue), [VueUse Motion](https://motion.vueuse.org/) |
| [Localization and head](i18n-head.md) | [Vue I18n](https://vue-i18n.intlify.dev/), [Unhead Vue](https://unhead.unjs.io/docs/vue/head/guides/get-started/overview) |
| [VitePress documentation](docs-vitepress.md) | [VitePress](https://vitepress.dev/) |
| [Testing](testing.md), [debugging/SSR](debugging-ssr.md) | [Vue Test Utils](https://test-utils.vuejs.org/), [Vitest](https://vitest.dev/guide/), [Playwright](https://playwright.dev/docs/intro), [Vue SSR](https://vuejs.org/guide/scaling-up/ssr.html) |
| [AI streaming](ai-streaming.md) | [TanStack AI](https://tanstack.com/ai/latest/docs/overview), [Vue adapter source](https://github.com/TanStack/ai/tree/main/packages/vue-ai) |
| [Toolchain](setup-tooling.md) | [Vite](https://vite.dev/guide/), [Vue TypeScript](https://vuejs.org/guide/typescript/overview.html), [Vue language tools](https://github.com/vuejs/language-tools), [TypeScript](https://www.typescriptlang.org/docs/) |

[Application architecture](architecture.md), [data architecture](architecture-data.md) and [UI architecture](architecture-ui.md) are authored cross-library synthesis, not claims that any upstream project mandates one application architecture. Nuxt owns its app lifecycle, routing, SSR and auto-import conventions; Vue/Vite SPA examples do not establish Nuxt compatibility. Consult [Nuxt documentation](https://nuxt.com/docs) and the integration's exact Nuxt module before applying them.

Nuxt is a first-class host: [framework ownership](nuxt.md) covers ordinary new/existing applications; [selected integrations](nuxt-integrations.md) owns explicitly chosen Vuetify, Pinia and Colada contracts. Migration guidance is for actual upgrades, not the only Nuxt entry point. Active instructions use supported packages. A missing registry deprecation notice alone does not certify maintenance or compatibility.

### OpenVue corpus and evidence ownership

The OpenVue expansion uses the **122-page canonical official-document corpus** pinned to upstream commit [`d064f02ac75c3aaeb60a676c70e5ee08e3e3042e`](https://github.com/openvi-foundation/openvue/tree/d064f02ac75c3aaeb60a676c70e5ee08e3e3042e), separately from the retained historical inventory below. Context7's actual library identifier is **`/openvi-foundation/openvue`**; use it for discovery, not release certification. Rolling pages and snippets may differ from the authored **OpenVue 1.0.0** snapshot. Published exact-release exports/declarations take precedence for imports and signatures; published runtime settles behavior and documented release conflicts. Verify future majors independently.

[Selection and architecture](openvue.md) routes to the seven focused implementation owners rather than duplicating their APIs here. The [OpenVue coverage ledger](../assets/openvue-coverage.json) owns corpus identities, routing/dispositions and release conflicts; [scoped verification](../assets/verification.json) owns executed checks, exact environments and limits. Reading every source page or routing it to a reference does not prove browser, SSR, accessibility or optional-peer compatibility. The historical source/native inventories remain unchanged.

The validator separately fingerprints the OpenVue discovery rubric, input cap, escalation policy/identities and retrievable source metadata. Native hypotheses and immutable discovery inputs remain distinct from editable semantic routing. Disposition and reference summary counts must describe the actual document rows; refreshing packaged hashes does not authorize rewriting discovery history.

## Reproducible coverage assets

- [Source manifest](../assets/source-manifest.json), schema 2: **47 retained historical roots**, of which 46 remain active and one is the nine-document presentation exclusion below. Two separately identified extensions cover OpenVue primary sources and application-owned session contracts; they are not invented historical source judgments.
- [Source audit](../assets/source-audit.json), schema 2: **459 retained source documents**, **327 historical triage flags**, original path/SHA-256/domain/migration/flag values and rubric. Eight superseded vendor-bound input units are not installed. Filtering changes this population's totals; it does not rewrite the original snapshot or imply a new judgment run.
- [Coverage routing](../assets/coverage-audit.json), schema 2: all 459 retained source identities, original native probability maps and historical dispositions, mapped to their reference owners. The validator fingerprints the retained source hashes/native hypotheses and original 38-reference native maps. Two separately recorded Nuxt extensions formed the historical **40-reference** index; eight OpenVue owners extend current discovery to **48 references** without rewriting those historical maps. Routing is not a claim that an old verdict or quotation validates a changed example.
- [Scoped verification](../assets/verification.json): exercised cutover and later checks, their exact environments, limits and packaged-file SHA-256 footprint. Earlier check records retain `source_commit`; current checks are separately scoped. The validator catches stale/missing snapshots; hashes do not authenticate execution, prove upstream correctness or certify semantic completeness.
- [Current bounded audit](../assets/current-audit.json): original October 22–23, 2026 source review plus an explicit source-only workbench/release extension. Original scope/records remain frozen: 70 files, 3,615 unit identities, 53 execution rows and 94 adjudications, with both GPU receipts retained. Current inventory is 73 authored files, excluding the ledger itself, and 3,652 units; 37 added source-reviewed units are not new triage or renewals of original execution results. The validator checks extension ownership/coverage/counts, current literal excerpts and the original population fingerprint, not source truth or execution authenticity.

Superseded audit bodies and verification reports remain at repository commit `7bf433b98951918c694358e372d3b02cf6f982e5`, outside the installed skill. They are immutable historical observations, not refreshed passes. Git history is optional provenance, never a dependency for using the references or validator. Original input paths are historical identifiers, not required installed files.

### Current authoring and negative scopes

The recorded authoring environment uses **Node 24.15.0 / Bun 1.4.3**; the Skills CLI **1.7.4** installer requirement of **Node >=22.20** is a different scope. These are not minimum runtimes for every consuming application. The current audit separates core full declarations, state bounded consumers/lifetimes, the Vue/Vuetify workbench, UI interactions, OpenVue Vite/Nuxt foundation and widget profiles, tooling and application-owned HTTP/session/streaming contracts. Only the ledger's actually observed checks count as passes; an unexecuted scope is not promoted by source review or another profile's success.

Known negative scopes remain visible alongside bounded successes:

- **Forms:** full dependency declarations fail in upstream optional adapters/generated declarations; bounded consumers and CPU/jsdom cases do not establish a clean full declaration tree.
- **Visualization:** the real-ambient full dependency tree retains upstream diagnostics even where bounded consumers pass. Neither CPU nor software/headless rendering proves native hardware behavior.
- **Router 5.4.0:** generated app-only declarations pass separately from the combined plugin/runtime full-tree declaration collision.
- **TanStack AI Vue 0.27:** full UI template checking retains the upstream chat-message `string | number` index issue. Transport consumers and an application-owned interrupt boundary do not prove a clean full UI template tree.
- **Motion:** the recorded motion-v/core full-declaration incompatibility is not waived by a typed native-tag consumer; preserve the owning reference's graph/compiler boundary.

OpenVue copyable contracts are bounded to **1.0.0**, with exact prerequisite and host profiles in the focused owners. The 122-page corpus is documentation coverage, not whole-library runtime, accessibility or future-major acceptance. Service-independent ownership is a project policy: local application APIs/self-hostable endpoints are valid, but no account or hosted provider is required, and client state cannot authorize server data.

The original and corrected focused target-device submissions are reviewed with limits; native gate `vue-kit-skills-liu.33.3` and bounded support decision `.28.2` are closed. The reported Edge 156 / Windows / NVIDIA Ampere recipe/lab observations resolve the scoped resize/readback regressions, not every manual criterion or hardware configuration. Injected faults and software adapters remain separate observations. The selected successor is now the [bundled workbench composition](tresjs.md#bundled-workbench-composition); source review of its new `/graphics` port does not inherit a native-hardware pass or renew any of the 53 original execution rows. New consumer runtime acceptance is recorded separately by its actual runner.

### Fifth-pass review and scoped corrections

The historical [fifth-pass audit](../assets/fifth-pass-audit.json) covers **42 Markdown documents** (master, 40 references and changelog), divided into **442 heading-bounded units**: 393 ready, 30 technical, 7 mixed, 1 discovery and 11 other. The native review escalated **392 units**, including 343 ready-category uncertainty cases; 50 units were unflagged, with zero errors or truncations. Pre-filtering excluded 20 non-Markdown files and one ignored directory. These are retained review populations and risk labels, **not 392 confirmed bugs** or the current audit population. Recorded dispositions do not authenticate unavailable original executions.

Stored fifth-pass observations include bounded before/after tween, router search/deferred-result, cache-writer retirement, form/native-control, VueUse target-lifecycle and VitePress local-search consumers. Strict consumers, unit fixtures and syntax/template compilation have distinct scopes; they do not establish that every optional integration was rerun. The record says VueUse's initial measurement was corrected to the next frame and browser-verified, and Vue I18n's two `runtimeOnly` profiles worked, overturning that failure hypothesis rather than demonstrating a failing-before runtime repair. Lazy resources and actual compiler removal were not exercised **in that historical pass**; later scopes are separate.

The supported skill is service-independent: no hosted authentication SDK, provider-key management, commercial cloud account or implicit account provisioning. Application-owned APIs and self-hostable libraries remain valid when their contracts are explicit. Client session state and local test identities never establish server authentication or authorization. VitePress uses local search; AI streaming guidance consumes an application-owned or self-hosted endpoint rather than setting up a hosted model provider.

### Subsequent support-boundary tightening

The historical [support-boundary audit](../assets/support-audit.json) separates registry triage from executable compatibility. Its **140 exact releases / 135 package names** include historical exclusion citations and owner-specific schema majors, not 140 recommendations. Its fetched snapshot records no npm deprecation notice; this is not a fresh registry-wide finding. Experimental releases retain explicit limits; age, overlapping APIs and non-latest versions alone do not justify a cut.

Exact-release failures remove individual offerings, not functioning packages: stock TanStack Vue SSR wrappers, defective VueUse adapters, mixed vee-validate/schema graphs and unsupported I18n compiler-removal combinations. Motion-v's custom-SFC declaration failure requires a typed native-tag alternative, not a cast. The owning references retain concise diagnosis and supported replacements; prior package exclusions remain unchanged. The registry's native verdicts, source-only findings and observed consumer results are distinct evidence classes.

The earlier VueUse next-frame workaround is superseded by direct core geometry ownership. Actual compiler-removal and lazy-catalog profiles now distinguish raw string compilation from precompiled ASTs; `runtimeOnly` alone still does not remove the compiler. Current checks do not imply complete optional-package coverage, TanStack Vue SSR hydration support, all-browser accessibility or native GPU certification.

## Removed integrations

### Slidev, Twoslash, and FloatingVue

Slidev and its Twoslash/FloatingVue integration are removed from the shipped Vue Kit capability set; their source records are historical exclusions, not supported implementation guidance.

The removal decision is dated **2026-10-21** and recorded in the machine-readable [removal ledger](../assets/removals.json), with the original provenance retained rather than rewritten. The latest-version reproduction used `@slidev/cli` **53.0.0**, `@slidev/client` **53.0.0**, `@shikijs/vitepress-twoslash` **4.5.0** and `floating-vue` **5.4.0**. Real Chromium startup logged `Failed to patch FloatingVue`, with a caught `TypeError` reading `Popper`. The client's unconditionally installed plugin assumes `VMenu.components.Popper.extends`, but the registered component has no `components` object. This is an observed compatibility defect in that integration, not a claim that every package is obsolete or inoperative.

Ordinary type hover was observed working. The failed patch is the desktop drag/text-selection guard; working hover, deck rendering or a successful build does not establish clean initialization or correct selection/drag interactions. Vue Kit does not ship a private-component shim, error suppression or an unsupported dependency downgrade. The former combined guide has been replaced by the VitePress-only reference; the nine historical source documents are explicit exclusions, not routes to a supported slide capability. **VitePress, `@floating-ui/vue` and Reka remain in scope**; Floating UI's Vue adapter is a different library from `floating-vue`.

Primary evidence: [CLI 53.0.0 metadata](https://unpkg.com/@slidev/cli@53.0.0/package.json), [client dependency contract](https://unpkg.com/@slidev/client@53.0.0/package.json), [client setup](https://unpkg.com/@slidev/client@53.0.0/setup/main.ts), [Twoslash 4.5.0 patch implementation](https://unpkg.com/@shikijs/vitepress-twoslash@4.5.0/dist/client.mjs), and [FloatingVue 5.4.0 metadata](https://unpkg.com/floating-vue@5.4.0/package.json). These sources explain the contract and failure mechanism; the runtime observation is distinct from a registry or source inspection. Decision/evidence tracking: `vue-kit-skills-bt3` and `vue-kit-skills-9uu`.

Reintroduction requires all of the following, recorded against exact installed versions and fresh evidence:

1. A supported compatible source/release fix for the integration, not merely a new `latest` tag, a local shim or a suppressed diagnostic.
2. Clean real-browser startup without the patch error or uncaught initialization failures.
3. Tooltip/type-hover, query and completion behavior, plus desktop drag/text-selection acceptance with both keyboard and pointer interactions.
4. A production build and real integration checks on the authored Vue **3.5.44** baseline, with the exact dependency graph, browser environment and exercised limits recorded.

Until these conditions are met, historical successful subfeatures and archived runs do not authorize restoring the removed capability.

## Material source caveats

| Historical claim or risk | Replacement rule and evidence owner |
| --- | --- |
| Blanket `shallowRef` performance preference, state writes in updated hooks | Use ordinary `ref` by default; choose shallow state for a stated ownership/performance need. Do not mutate component state in `onUpdated`. [Vue foundation](core-vue.md). |
| `useTemplateRef` cannot represent `v-for` refs | Vue 3.5 supports it, but ref-array order is not guaranteed to match source data. Use stable identity when correlating elements. [Debugging](debugging-ssr.md). |
| Vuetify v2/v3 installation, breakpoints, theme and Labs inventory presented as current | Follow 4.3.0 exports/source; deprecated props are not automatically removed props. Register styles explicitly. [Setup](vuetify-setup.md), [components](vuetify-components.md), [theme](vuetify-theme.md). |
| `$t` proves Vue I18n Legacy mode; future removal means already absent | Composition global injection can expose `$t`. Read the exact 11.x API/deprecation status; do not invent a v12 result. [Localization](i18n-head.md). |
| Adapter names, major versions and schemas assumed interchangeable | Use the exact Vue adapter, exported contract and declared peers. Table v8/v9, VeeValidate v4/v5, Zod v3/v4 and framework-specific TanStack examples are not drop-in substitutes. [Tables](data-tables.md), [forms](vee-validate.md), [router alternative](routing-tanstack.md). |
| Quasar plugin, CLI and runtime requirements conflated | Distinguish the Quasar Vite plugin from its CLI; current CLI dependencies are not the Router 4 fixture. Separate auto-installed facilities from opt-in plugins, and treat client env exposure explicitly. [UI alternatives](alternative-ui.md). |
| Generic provider automatically prevents cross-request state leakage | Create app/provider state per SSR request, serialize safely and test hydration. [Data architecture](architecture-data.md), [SSR](debugging-ssr.md). |
| Discovery snippets imply working integration | Verify exact types/source, then separately exercise the relevant structural, type and behavioral checks. [Testing](testing.md). |

Current API corrections and exact-version primary evidence live in each owning reference. Historical source triage remains historical rather than an unexplained current defect count.

## What evidence does and does not establish

| Evidence | Can establish | Cannot establish alone |
| --- | --- | --- |
| Coverage manifest/audit | Enumerated roots, routing claims, original triage/count/hash identity | Semantic completeness, licensing, compiled examples or correct behavior |
| Structural skill validator | Only the frontmatter/path/link/schema/code-fence properties it actually checks | Correct APIs, accessible operation, safe SSR or fulfilled product requirements |
| Exact declarations and SFC type check | Export/signature agreement and the configured TypeScript constraints | Backend authorization, network behavior, focus restoration or runtime rendering |
| Production build | Bundling of the exercised entry/configuration | Type safety when transpilation-only; browser behavior or all optional integrations |
| Unit/component tests | Assertions exercised in their stated renderer/environment | Every browser, screen reader, backend, SSR request lifecycle or production deployment |
| Browser/SSR integration and accessibility checks | Observed behavior for named versions, routes, interactions and environments | An unrestricted ecosystem-wide certification or manual screen-reader coverage not performed |

The workbench is local and in memory, not an authenticated backend or persistence demonstration. The [verification record](../assets/verification.json) preserves earlier check records with their `source_commit` and separately scopes current checks, including later runtime observations; it has no `historical_runs` field. Reference acceptance paragraphs identify obligations in a consuming application, not an ecosystem-wide certification. Keep syntax compilation, strict TypeScript, template-checking mode, production builds, observed browser paths and unexercised provider/SSR/accessibility obligations distinct. The [removed-integration decision](#removed-integrations) is a shipped exclusion, not an accepted upstream boundary for an advertised capability.

## Authorship and licensing boundary

These references are authored synthesis: corrected explanations, decisions, focused examples and integration guidance informed by historical coverage and primary documentation. The manifest is not a license grant or an assertion that all source roots share a license. Package registry license fields apply to their packages, not automatically to unrelated skill prose. As a project policy, preserve applicable notices when actually copying licensed material; inspect the relevant license and copied scope rather than assuming attribution or relicensing from a name, repository or hash. Audit identity records do not establish the contents or licensing of unavailable original source text.

## Sources

- [Vue 3.5.44 exact metadata](https://registry.npmjs.org/vue/3.5.44), [Vue release policy](https://vuejs.org/about/releases), [Vue TypeScript evidence boundary](https://vuejs.org/guide/typescript/overview.html).
- [Vuetify 4.3.0 exact metadata](https://registry.npmjs.org/vuetify/4.3.0), [tagged source](https://github.com/vuetifyjs/vuetify/tree/v4.3.0), [upgrade guide](https://vuetifyjs.com/en/getting-started/upgrade-guide/).
- [Vite TypeScript transform boundary](https://vite.dev/guide/features#typescript), [Agent Skills specification](https://agentskills.io/specification).
- Capability-specific primary routes above and the exact-version URLs in each owning reference and bundled audit caveat.
