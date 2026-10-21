# Vue Kit

A unified Agent Skill for Vue 3.5 applications: TypeScript, Composition API, Vuetify-first UI and explicit ecosystem version boundaries. The master index routes agents to focused capability references and cross-library architecture instead of loading an entire skills collection.

## Install

Run from the project where your coding agent should receive the skill. **Bun is preferred**; the npm-compatible installer is also supported:

```sh
# Preferred
bunx skills add PhilosophiMoonbeam/vue-kit-skills

# npm-compatible installer
npx skills add PhilosophiMoonbeam/vue-kit-skills
```

Select `vue-kit` and your target agents when prompted. Installation is project-scoped by default; use the Skills CLI's `--global` option only when a user-wide installation is intended. The current Skills CLI requires Node.js 22.20 or later. See the [installer reference](https://github.com/vercel-labs/skills/blob/main/docs/commands.md#skills-add) for noninteractive, agent-selection and copy options.

## Navigate the skill

Install the skill for metadata-based discovery; do not preload its body or all references into every session. When a Vue task activates it, read [`skills/vue-kit/SKILL.md`](skills/vue-kit/SKILL.md), select the task's owning reference, and add companions only for decisions the change actually touches.

- **38 capability references:** Vue/reactivity, components/composables, state, authentication, routing, server-state caches, forms, UI frameworks, accessibility, tables, virtualization, visualization, motion, localization, SSR, testing, AI streaming and tooling.
- **Architectural synthesis:** [application boundaries](skills/vue-kit/references/architecture.md), [data ownership and lifetimes](skills/vue-kit/references/architecture-data.md), and [UI composition](skills/vue-kit/references/architecture-ui.md).
- **Preferred baseline:** Vue **3.5.44** and pinned authoring Vuetify **4.3.0**, with **4.3.x** preferred for new general-purpose UI. Alternative libraries and incumbent major versions retain their own compatibility boundaries; preference is not permission for an unrequested migration.
- **Package manager:** prefer Bun **1.4.3** for equivalent install, add, script and executable workflows. Respect an existing project's explicitly selected manager and authoritative lockfile unless migration is requested. Bun package management does not automatically change Node-based tooling into Bun-runtime tooling.

The installed skill is self-contained. Historical source paths in audit assets identify provenance; the original `.agents/skills/` corpus and a private discovery service are not installation dependencies.

## Run the example workbench

The bundled Vue/Vuetify/Pinia/Router application implements real in-memory tasks, validation, keyboard interaction, confirmation dialogs, navigation and theme changes. It has no backend, account, credentials or persistence; reload restores its example state.

Use Bun **1.4.3** and supported Node.js **24.15.0** for the recorded environment:

```sh
cd skills/vue-kit/assets/example-app
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run dev
```

The committed `bun.lock` is authoritative. Keep type checking separate from Vite bundling; a build alone does not prove types or behavior. See [setup and tooling](skills/vue-kit/references/setup-tooling.md) for prerequisites, lockfile migration and dependency lifecycle-script boundaries.

## Validate and inspect evidence

From the repository root:

```sh
python3 skills/vue-kit/scripts/validate.py skills/vue-kit --json
```

The standard-library validator checks skill structure, reference navigation, source coverage, current evidence quotes and content-addressed packaged files. It does not execute optional integrations or confer runtime certification.

[Sources and verification policy](skills/vue-kit/references/sources.md) explain the 49 historical source roots and 467 source documents: 48 roots remain in active capability coverage; the nine documents from the excluded presentation integration remain provenance only. [Scoped verification](skills/vue-kit/assets/verification.json) records current checks separately from archived observations; [coverage dispositions](skills/vue-kit/assets/coverage-audit.json) preserve native judgments alongside current inclusion and exclusion decisions.

The [historical second-pass audit](skills/vue-kit/assets/second-pass-audit.json) predates the integration removal. Its 39 low-confidence escalations (36 correctness, 3 mixed; zero processing errors or truncations; 17 deterministic prefilter exclusions) are investigation hypotheses, not 39 confirmed defects or current acceptance. Preserve its snapshot-bound observations; use the current verification record for the shipped package.

The [current third-pass audit](skills/vue-kit/assets/third-pass-audit.json) separates 39 packaged documents (**38 references plus CHANGELOG**, not the master) from 467 source-mapping rows. The master routing contract and this external shared README were reviewed separately. Document labels were 34 ready / 3 technical / 2 incomplete; all 39 escalated for uncertainty/version risk, all 12 cap-truncated units were fully read by authors, with zero processing errors and 19 deterministic exclusions. Mapping labels were 445 covered / 11 excluded / 11 gap, with 26 escalations and zero errors, truncations or prefilter exclusions. These native hypotheses are not final defect totals; “gap” is not confirmed missing content. Consult [current scoped verification](skills/vue-kit/assets/verification.json), not audit labels or historical passes, for exercised behavior and remaining boundaries.

**Removed integrations:** Slidev and its Twoslash/FloatingVue integration are not shipped as supported capabilities because the latest tested combination still fails its desktop compatibility patch. See the [removal decision and reintroduction criteria](skills/vue-kit/references/sources.md#slidev-twoslash-and-floatingvue). [VitePress documentation](skills/vue-kit/references/docs-vitepress.md) remains supported. Live identity/provider credentials, exhaustive SSR matrices and blanket accessibility certification are outside the recorded verification scope.
