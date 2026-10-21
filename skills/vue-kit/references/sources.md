# Sources, versions and evidence

Read this before resolving contradictory examples, changing a package version, auditing coverage, or claiming that a check proves behavior. This is the provenance and lookup reference, not a second API manual. Follow the capability reference for implementation details.

## Baseline and authority

The authored baseline is **Vue 3.5.44** with pinned **Vuetify 4.3.0**; **Vuetify 4.3.x** is preferred for new general-purpose UI. Composition API, TypeScript and `<script setup lang="ts">` are the greenfield default; preserve a working incumbent stack during a narrow task. These are authoring preferences, not a promise that every optional ecosystem package is installed or jointly tested.

Use this order when sources disagree:

1. **The application's exact installed package:** lockfile resolution, package exports, bundled declarations, runtime source and matching release tag. Declarations settle import/signature questions; implementation settles behavior that declarations cannot express. A declaration may still contain stale comments. Do not infer runtime guarantees from a type alone.
2. **Official documentation for that exact release:** versioned docs, migration notes, release notes and tagged upstream source. Rolling official docs can describe a newer minor, a prerelease or an obsolete toolchain assumption. Record the specific claim and version rather than treating the entire site as one immutable authority.
3. **Exact registry metadata:** `version`, `exports`, `types`, `engines`, dependencies and peer ranges. A peer range establishes declared eligibility, not successful integration, accessibility or runtime correctness.
4. **Discovery indexes:** official site search, Context7 and web search help locate primary evidence. Check their snippets against the sources above; neither ranking nor snippet count proves compatibility. No discovery service or credential is required to use this skill.
5. **Historical skill material:** a coverage input, never an API authority. The bundled snapshot records provenance without requiring any prior skill installation.

[Vue's release policy](https://vuejs.org/about/releases) explicitly permits TypeScript definition changes across minor releases and warns about compiler/runtime minor mismatches. Keep the compiler/runtime family aligned. Do not teach Vue 3.6-only or Vapor APIs as Vue 3.5 APIs. Treat experimental features and prerelease adapters as opt-in, exact-pinned integrations even when discovered through a stable library's documentation.

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
| [VueUse](vueuse.md), [integrations](vueuse-integrations.md) | [Core](https://vueuse.org/functions.html), [components](https://vueuse.org/guide/components.html), [integrations](https://vueuse.org/integrations/README.html), [math](https://vueuse.org/math/README.html), [source](https://github.com/vueuse/vueuse) |
| [Application state](state.md) | [Pinia](https://pinia.vuejs.org/), [TanStack Store Vue](https://tanstack.com/store/latest/docs/framework/vue/overview) |
| [Authentication](auth.md) | [Clerk Vue](https://clerk.com/docs/vue/overview) |
| [Routing](routing.md), [alternative router](routing-tanstack.md) | [Vue Router](https://router.vuejs.org/), [TanStack Router](https://tanstack.com/router/latest) |
| [Query](tanstack-query.md), [Colada](pinia-colada.md) | [TanStack Vue Query](https://tanstack.com/query/latest/docs/framework/vue/overview), [Pinia Colada](https://pinia-colada.esm.dev/) |
| [Forms](forms.md), [VeeValidate](vee-validate.md), [TanStack Form](tanstack-form.md), [FormKit](formkit.md) | [VeeValidate v4](https://vee-validate.logaretm.com/v4/), [TanStack Vue Form](https://tanstack.com/form/latest/docs/framework/vue/overview), [FormKit core](https://formkit.com/essentials/architecture) |
| [Vuetify setup](vuetify-setup.md), [components](vuetify-components.md), [theme](vuetify-theme.md) | [Installation](https://vuetifyjs.com/en/getting-started/installation/), [API](https://vuetifyjs.com/en/api/), [theme](https://vuetifyjs.com/en/features/theme/), [v4.3.0 source](https://github.com/vuetifyjs/vuetify/tree/v4.3.0/packages/vuetify/src) |
| [Design](design-system.md), [accessibility](accessibility.md) | [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) |
| [Headless primitives](headless-ui.md) | [Floating UI Vue](https://floating-ui.com/docs/vue), [Reka UI](https://reka-ui.com/docs/overview/introduction), [shadcn-vue](https://www.shadcn-vue.com/docs/introduction.html) |
| [Incumbent UI alternatives](alternative-ui.md) | [PrimeVue](https://primevue.org/), [Quasar](https://quasar.dev/), [Quasar releases](https://github.com/quasarframework/quasar/releases) |
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

## Reproducible coverage assets

- [Source manifest](../assets/source-manifest.json): schema version 1; exact Vue/Vuetify baseline; **49 historical source-root IDs, 48 active roots and one excluded root**. The excluded presentation-integration root has **9 documents** and maps only to the removal record below. Active roots map to substantive capability/architecture references with document and flagged-document counts. Mapping is a coverage claim, not an instruction to preserve obsolete or unsupported advice.
- [Source audit](../assets/source-audit.json): the **467-document** historical snapshot, **335 flagged documents**, each repository-relative source path, original SHA-256, domain, migration judgment and flag. It preserves the original rubric/counts plus resolved caveats and input-metadata hashes without duplicating source text.
  Flagged means the triage required verification or had uncertain classification; **335 flagged documents does not mean 335 confirmed defects**. Original migration totals: verify 312, retain 144, rewrite 6, mixed 4, unrelated 1.
- Prefilter accounting: 10 non-Markdown-extension items and one utility document excluded; zero truncated documents and zero audit processing errors. Excluded utility roots/caches are described in the audit rubric. Those zero counts concern the source audit, not application tests or replacement quality.
- [Replacement crosswalk](../assets/coverage-audit.json): all 467 source units and 38 reference reviews, including 450 explicit source dispositions and 17 native-only covered units. Every original triage flag and material residual coverage/contradiction candidate has an individual disposition. Native partial/missing and mixed-reference hypotheses remain visible alongside their resolutions; `corrected` does not mean every historical source was defective.
- [Scoped verification](../assets/verification.json): recorded workflow checks and archived compiler/browser observations with their packaged-file snapshots. Historical results are not retroactively rerun when command guidance changes. The validator detects stale/missing current evidence; hashes do not authenticate an execution claim or prove upstream correctness.

A source path or hash is a historical identifier, **not a file required at runtime**. The replacement references stand alone. Original source material was not bulk reclassified manually: the snapshot supplied per-document judgments; only flagged material needed for corrections was escalated to authors. `retain` means the original audit found no visible conflict, not that the advice was independently proven; `verify`, `rewrite` and `mixed` are original triage labels, not unresolved release blockers. The audit's `source_caveats` records primary-evidence resolutions; the owning reference teaches the replacement contract. A path's original migration judgment remains unchanged after correction to preserve the snapshot.

Hashes allow comparison against the original snapshot **if those historical inputs are separately available**. They do not reconstruct source text, prove authorship/license, certify semantic completeness or require redistributing the old corpus. Input-artifact hashes identify exactly which coverage metadata was transformed into the bundled assets.

The archived [second-pass replacement audit](../assets/second-pass-audit.json) classified 39 Markdown units (master plus 38 references): 36 correctness hypotheses and 3 mixed hypotheses, all low confidence, with 17 deterministic exclusions, no truncations and no processing errors. Its original 39 units, 40 author handoff maps, snapshots, results and input/output hashes remain historical; those hashes do not identify the current shipped output. The [removal ledger](../assets/removals.json) supersedes its integration-adoption conclusions for the excluded capability. These are escalation counts, not confirmed defects, completed dispositions or evidence that current acceptance passed. Keep them separate from the 467-document historical source snapshot and current exercised verification.

### Current third pass

The [third-pass audit](../assets/third-pass-audit.json) keeps two independent batches separate:

- **39 packaged Markdown units: 38 references plus CHANGELOG**, not master plus references. Native labels were **34 ready, 3 technical and 2 incomplete**. All 39 escalated for uncertainty/version risk; authors read all 12 cap-truncated units completely. Processing had **0 errors** and **19 deterministic exclusions**. The excluded master routing contract was separately reviewed directly; the root README is an external shared contract, also reviewed separately.
- **467 source-to-replacement mapping rows:** **445 covered, 11 excluded and 11 gap** native labels, with **26 escalated**, **0 processing errors, 0 truncations and 0 prefilter exclusions**. Mapping-row exclusions are labels, not processing exclusions. Native gap labels are hypotheses, not confirmed missing replacement content; these counts do not replace the historical source judgments above.

Author evidence records concrete corrections and overturned or clarified hypotheses without turning native labels into final defect/disposition totals. The master review retained conditional companions, broad-architecture versus narrow-task routing and the pinned Vue/Vuetify baseline; exact metadata and release notes support that baseline, not universal optional-package compatibility. Use [current scoped verification](../assets/verification.json) for exercised checks and their snapshots. Third-pass review alone is not runtime, SSR, accessibility or production certification; archived second-pass observations remain historical.

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

Detailed source paths, package versions, primary URLs and resolutions are machine-readable in `source_caveats`; the original labels remain historical rather than unexplained open findings.

## What evidence does and does not establish

| Evidence | Can establish | Cannot establish alone |
| --- | --- | --- |
| Coverage manifest/audit | Enumerated roots, routing claims, original triage/count/hash identity | Semantic completeness, licensing, compiled examples or correct behavior |
| Structural skill validator | Only the frontmatter/path/link/schema/code-fence properties it actually checks | Correct APIs, accessible operation, safe SSR or fulfilled product requirements |
| Exact declarations and SFC type check | Export/signature agreement and the configured TypeScript constraints | Backend authorization, network behavior, focus restoration or runtime rendering |
| Production build | Bundling of the exercised entry/configuration | Type safety when transpilation-only; browser behavior or all optional integrations |
| Unit/component tests | Assertions exercised in their stated renderer/environment | Every browser, screen reader, backend, SSR request lifecycle or production deployment |
| Browser/SSR integration and accessibility checks | Observed behavior for named versions, routes, interactions and environments | An unrestricted ecosystem-wide certification or manual screen-reader coverage not performed |

The workbench is local and in memory, not an authenticated backend or persistence demonstration. The [verification record](../assets/verification.json) separates current checks from `historical_runs` bound to earlier file snapshots; reference acceptance paragraphs identify obligations in a consuming application, not an ecosystem-wide certification. Keep syntax compilation, strict TypeScript, template-checking mode, production builds, observed browser paths and unexercised provider/SSR/accessibility obligations distinct. The [removed-integration decision](#removed-integrations) is a shipped exclusion, not an accepted upstream boundary for an advertised capability.

## Authorship and licensing boundary

These references are authored synthesis: corrected explanations, decisions, focused examples and integration guidance informed by historical coverage and primary documentation. The manifest is not a license grant or an assertion that all source roots share a license. Package registry license fields apply to their packages, not automatically to unrelated skill prose. Preserve applicable notices when actually copying licensed material; inspect the relevant license and copied scope rather than assuming attribution or relicensing from a name, repository or hash. No original source text is duplicated in the audit.

## Sources

- [Vue 3.5.44 exact metadata](https://registry.npmjs.org/vue/3.5.44), [Vue release policy](https://vuejs.org/about/releases), [Vue TypeScript evidence boundary](https://vuejs.org/guide/typescript/overview.html).
- [Vuetify 4.3.0 exact metadata](https://registry.npmjs.org/vuetify/4.3.0), [tagged source](https://github.com/vuetifyjs/vuetify/tree/v4.3.0), [upgrade guide](https://vuetifyjs.com/en/getting-started/upgrade-guide/).
- [Vite TypeScript transform boundary](https://vite.dev/guide/features#typescript), [Agent Skills specification](https://agentskills.io/specification).
- Capability-specific primary routes above and the exact-version URLs in each owning reference and bundled audit caveat.
