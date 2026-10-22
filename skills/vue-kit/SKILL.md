---
name: vue-kit
description: >-
  Build, debug, test, and modernize Vue applications with TypeScript, Composition
  API, Vuetify, Router, Pinia, forms, server-state queries, authentication,
  accessible UI, charts, motion, SSR, Nuxt, and Vite tooling. Use for Vue SFCs,
  Nuxt applications/modules/server routes, composables, ecosystem integrations,
  architecture, migrations, and Vue runtime or type errors. Routes to focused,
  version-aware references and runnable examples.
metadata:
  vue-baseline: "3.5.44"
  vuetify-baseline: "4.3.0"
  style: "Composition API; script setup; TypeScript"
---

# Vue Kit

Use this skill as a task router, not a reading checklist. It is self-contained;
load only the relevant references and the companions needed by the actual change.

Prefer **Bun 1.4.3** for new projects and equivalent package-management workflows:
`bun install` for a manifest, `bun add` for dependencies, `bun run <script>` for
scripts, and `bunx` for package executables. Respect an incumbent project's
explicit package-manager pin and authoritative lockfile; do not migrate managers
or create a second lockfile without a requested migration. Bun is the preferred
manager/launcher, not permission to force Node-based tools onto Bun's runtime.
Follow [setup tooling](references/setup-tooling.md) for lockfile and runtime policy.

## Start with the application

1. Inspect the affected code, package manifest, lockfile, runtime constraints,
   build scripts, TypeScript configuration, and existing tests. Establish installed
   versions, SPA versus SSR/Nuxt, current UI/data/auth libraries, and incumbent
   component, styling, and state conventions before selecting APIs.
2. Choose the host for **new and existing applications**. Use Vue/Vite for a
   standalone SPA; choose Nuxt when framework-managed routing, rendering or server
   endpoints fit the requirements. Preserve an existing host during a narrow fix.
   For **any Nuxt task**, load [Nuxt](references/nuxt.md) first; add
   [Nuxt integrations](references/nuxt-integrations.md) only for the selected
   local library or module. Do not paste SPA bootstrap/router/plugin helpers into Nuxt.
   For a **new application, broad feature, or structural redesign**, use
   [architecture](references/architecture.md) for the ownership decision.
   Otherwise go directly to the relevant task reference.
3. Default new Vue code to Composition API and `<script setup lang="ts">`.
   The documented baseline is [Vue 3.5.44](https://github.com/vuejs/core/releases/tag/v3.5.44)
   with [Vuetify 4.3.0](https://github.com/vuetifyjs/vuetify/releases/tag/v4.3.0)
   as the pinned authoring baseline and **Vuetify 4.3.x** preferred for a new
   general-purpose UI. These are preferences, not permission to replace an
   incumbent alternative or require Vuetify for headless/3D work.
   Preserve Options API and JSX where the application requires them.
   The example's Router/Pinia/tooling pins are a bounded runnable snapshot, not
   ecosystem-wide version ceilings or instructions to downgrade newer incumbents.
4. Write the smallest complete change. Keep state ownership and lifetime explicit;
   derive state with `computed`, use watchers for effects, and clean up resources.
   Give substantial independent responsibilities useful boundaries, not arbitrary
   file-size splits or a page-sized universal controller. Keep direct contracts
   typed, accessible behavior intact, and server credentials off the client.
5. Select evidence appropriate to the change. Separate proposed checks from checks
   actually run, record failures honestly, and do not claim production, SSR,
   accessibility, or performance support from a successful bundle alone.
6. Keep integrations service-independent. Do not introduce hosted identity,
   provider-key management, commercial cloud SDKs, or account provisioning.
   Application-owned APIs and self-hostable libraries are valid explicit contracts;
   client identity state never substitutes for verified server authorization.

## Route by task

Read the first matching owner. The companion column is conditional, not a request
to load every linked document. Combine owners only when the task crosses domains.

### Host framework

| Task trigger | Read | Add only when needed |
| --- | --- | --- |
| Nuxt application, pages/layouts, middleware, useFetch/useAsyncData/useState, Nitro/server API, runtime config, rendering, deployment or Nuxt migration | [Nuxt](references/nuxt.md) | [Nuxt 3 → 4 migration](references/migration.md#nuxt-3-to-4-migration) only for that cutover; debugging SSR for a localized rendering failure |
| Nuxt with Pinia, selected Colada cache, or Vuetify | [Nuxt integrations](references/nuxt-integrations.md) | Nuxt core remains the host owner; the selected library reference owns reusable library semantics, not a second app/bootstrap |

### Foundations and architecture

| Task trigger | Read | Add only when needed |
| --- | --- | --- |
| Reactivity, watchers, lifecycle, template refs, SFC/compiler semantics | [Core Vue](references/core-vue.md) | Components for a public component contract; composables for extracted effects |
| Props, emits, models, slots, attrs, injection, Options API or JSX interop | [Components](references/components.md) | Core Vue for reactive semantics; accessibility for interactive controls |
| Reusable or single-use stateful capability, reactive inputs, cleanup | [Composables](references/composables.md) | VueUse before reimplementing a supported browser utility |
| Vue/version upgrade, removed APIs, incumbent Options API/JSX migration | [Migration](references/migration.md) | Setup tooling for compiler/build changes; affected library owner for its migration |
| Greenfield app, feature boundaries, large refactor, SPA/SSR choice | [Architecture](references/architecture.md) | Architecture data or architecture UI for the affected decisions |
| State ownership, service boundaries, cache versus store, feature workflows | [Architecture data](references/architecture-data.md) | State and the chosen query owner, not every cache library |
| Design/component boundaries, page composition, UI stack selection | [Architecture UI](references/architecture-ui.md) | Design system and the selected UI owner |
| Vite, TypeScript, aliases, env, Node/package manager, build versus typecheck | [Setup tooling](references/setup-tooling.md) | Vuetify setup if selected; debugging SSR for server rendering |

### Browser utilities, state, identity, routing, and server data

| Task trigger | Read | Add only when needed |
| --- | --- | --- |
| VueUse core/shared/math/components utilities and browser lifecycles | [VueUse](references/vueuse.md) | Composables for application-owned capability design |
| VueUse integrations with Axios, focus trap, cookies, QR, or external packages | [VueUse integrations](references/vueuse-integrations.md) | VueUse for shared conventions; auth for identity-sensitive cookies |
| Pinia, TanStack Vue Store, local/shared state, hydration, store contracts | [State](references/state.md) | Architecture data for ownership decisions; auth for session state |
| Application-owned sessions, identity loading, safe redirects, client guards and server authorization boundaries | [Session boundaries](references/auth.md) | Routing for protected navigation; debugging SSR for server applications; no hosted authentication SDK |
| Vue Router routes, params, guards, navigation/history, v5 file routing or experimental loaders | [Routing](references/routing.md) | Auth for identity checks; testing for navigation; keep `vue-router/experimental` APIs distinct from stable imports |
| Explicit TanStack Vue Router browser-adapter evaluation or incumbent usage | [TanStack routing](references/routing-tanstack.md) | Vue Router/Nuxt for SSR; stock TanStack Vue SSR wrappers are excluded at the inspected release |
| TanStack Vue Query cache, queries, mutations, invalidation, SSR | [TanStack Query](references/tanstack-query.md) | Architecture data for cache ownership; auth for user-scoped caches |
| Pinia Colada queries, mutations, cache and SSR | [Pinia Colada](references/pinia-colada.md) | State for application state; do not add a second query cache by default |

### Forms and validation

| Task trigger | Read | Add only when needed |
| --- | --- | --- |
| Choose form ownership, native/Vuetify validation, async submit and errors | [Forms](references/forms.md) | Accessibility and the selected form-library owner |
| Incumbent or explicitly chosen vee-validate | [vee-validate](references/vee-validate.md) | Forms for cross-layer submit policy |
| TanStack Vue Form fields, validators, subscriptions, submission | [TanStack Form](references/tanstack-form.md) | Forms for selection and service boundaries |
| FormKit core nodes, plugins, schema/validation integration boundaries | [FormKit](references/formkit.md) | Forms and accessibility for rendered controls |

### UI systems and accessible interaction

| Task trigger | Read | Add only when needed |
| --- | --- | --- |
| Install/register Vuetify, CSS/icons, VApp layout, Vite integration | [Vuetify setup](references/vuetify-setup.md) | Setup tooling for shared build configuration |
| Vuetify controls, dialogs, menus, forms and responsive layouts | [Vuetify components](references/vuetify-components.md) | Accessibility; forms for submission policy |
| Vuetify themes, tokens, typography, dark mode and defaults | [Vuetify theme](references/vuetify-theme.md) | Design system for application-wide visual decisions |
| UI design/review, hierarchy, tokens, responsive states, coherent product patterns | [Design system](references/design-system.md) | Accessibility; the chosen UI component owner |
| Keyboard/focus, names/labels, dialogs, error announcements, reduced motion | [Accessibility](references/accessibility.md) | Headless UI or Vuetify components for implementation contracts |
| Reka UI, Floating UI Vue, shadcn-vue primitives and positioning | [Headless UI](references/headless-ui.md) | Accessibility; design system for styling |
| OpenVue 1.x or newer, Quasar, or an incumbent UI alternative | [Alternative UI](references/alternative-ui.md) | Setup tooling for integration; do not install competing UI systems casually |

### Data presentation and motion

| Task trigger | Read | Add only when needed |
| --- | --- | --- |
| Vuetify or TanStack Vue Table, sorting/filtering/pagination and row identity | [Data tables](references/data-tables.md) | Virtualization for measured large-list costs; selected query owner for server data |
| TanStack Vue Virtual, list/window virtualizers, measurements and focus | [Virtualization](references/virtualization.md) | Accessibility; tables when virtualizing tabular data |
| Unovis TS/Vue or Vue Data UI charts, tooltips and reactive data | [Visualization](references/visualization.md) | Accessibility; virtualization only for separate list rendering |
| TresJS/Three.js scene, render loop, GPU resources and disposal | [TresJS](references/tresjs.md) | Composables for effect ownership; debugging SSR for client-only boundaries |
| Vue transitions, Motion for Vue, VueUse Motion and animation lifecycle | [Motion](references/motion.md) | Accessibility for reduced motion and focus preservation |

### Platform, quality, and specialized applications

| Task trigger | Read | Add only when needed |
| --- | --- | --- |
| Vue I18n and Unhead, locale/head state and SSR isolation | [I18n and head](references/i18n-head.md) | Debugging SSR for hydration; routing for route-driven locale |
| VitePress documentation sites, static rendering, build and deployment | [VitePress](references/docs-vitepress.md) | Setup tooling for shared runtime constraints; preserve the documentation tool's app lifecycle |
| Vitest, Vue Test Utils, browser/E2E behavior and test boundaries | [Testing](references/testing.md) | The affected feature owner; accessibility for keyboard/focus assertions |
| Runtime warnings, async errors, SSR/Nuxt, hydration, request isolation | [Debugging and SSR](references/debugging-ssr.md) | Core Vue for semantics; relevant cache/router/head owner |
| TanStack AI Vue chat/streaming against application-owned or self-hosted endpoints | [AI streaming](references/ai-streaming.md) | Auth and architecture data when identity or persistence is involved; no hosted-provider account or key setup |
| Version/provenance questions, source conflicts, experimental status | [Sources](references/sources.md) | The owning reference for exact APIs and primary links |

## Resolve API and version uncertainty

- Read installed declarations and the locked package version first. Use the
  corresponding official API docs, tagged source/release notes, and package
  author registry metadata for signatures, peer dependencies, engines, and status.
  Search snippets, old examples, and migration notes are leads, not authority.
- Prefer matching-version evidence over an unversioned “latest” page. If primary
  docs and published types disagree, inspect the installed release and explain
  the conflict. Do not silently mix stable and experimental adapters or majors.
- Vue 3.6 prerelease/Vapor APIs are not Vue 3.5 APIs. Nuxt modules, server routes,
  runtime config, and SSR lifecycle belong to [Nuxt](references/nuxt.md), not a
  standalone Vite bootstrap or manual router installation.
  Select one canonical owner for each resource: Nuxt data or an explicitly chosen
  query integration, not two independent hydration caches for the same result.
- Recommend supported replacement packages and current APIs for active setup.
  Confine obsolete names to explicit migration/historical explanations; do not
  proactively install deprecated packages. An absent npm deprecation notice is
  not proof of current API support, and a repository move is not deprecation.
- Architectural defaults in this skill are recommendations, not upstream
  guarantees. A package's peer range is not observed end-to-end compatibility.

## Runnable resources and honest verification

- [Example dependency manifest](assets/example-app/package.json): exact versions
  for the local, in-memory Vue/Vuetify/Pinia/Router workbench. Follow
  [setup tooling](references/setup-tooling.md) for `bun install`,
  `bun run typecheck`, `bun run build`, and `bun run dev`. It has no backend,
  authentication, persistence, or production deployment claim.
- [Skill validator](scripts/validate.py): Python 3 standard-library structural
  validator. From the skill root, run `python3 scripts/validate.py` or add
  `--json`; an optional positional root selects another installed skill copy.
  It does not execute example tests or builds and cannot establish runtime API
  correctness, accessibility, SSR safety, or source accuracy.
- [Source manifest](assets/source-manifest.json), [source audit](assets/source-audit.json)
  and [coverage routing](assets/coverage-audit.json): retained historical input
  identities and current reference ownership, not semantic or runtime certification.
  Superseded vendor-bound reports remain in repository history, outside this skill.
- [Scoped verification](assets/verification.json): exercised checks, exact versions,
  limitations and content-addressed packaged files. Earlier checks do not certify
  changed examples; consult [sources](references/sources.md) for evidence policy.
- [Fifth-pass audit](assets/fifth-pass-audit.json): native review dispositions,
  corrections and scoped evidence; risk labels are not confirmed defect totals.
- [Support-boundary audit](assets/support-audit.json): registry triage, exact-release
  exclusions, primary sources and executable consumer evidence; not a package allowlist.

When verification is authorized, select the repository's own typecheck, tests,
production build, and browser checks that exercise the change. For UI behavior,
cover relevant loading/error/empty/success states, keyboard/focus and responsive
layout; for server code, cover request isolation and hydration. Report the exact
commands and outcomes actually observed. If checks were not run, say so; list
recommended commands separately rather than presenting them as evidence.
