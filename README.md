![Vue Kit — One skill. Open horizons. A Vue-green pirate ship sails across a neon sea beneath a striped sunset.](assets/branding/vue-kit-hero.svg)

# Vue Kit

A unified Agent Skill for Vue 3.5 applications: TypeScript, Composition API, Vuetify-first UI and explicit ecosystem version boundaries. The master index routes agents to focused capability references and cross-library architecture instead of loading an entire skills collection.

## Install

Run from the project where your coding agent should receive the skill, using **Bun 1.4.5**:

```sh
bunx --bun skills@1.9.0 add PhilosophiMoonbeam/vue-kit-skills
```

Select `vue-kit` and your target agents when prompted. [Skills CLI 1.9.0](https://github.com/vercel-labs/skills/releases/tag/v1.9.0) installs to the current project by default; use `--global` only for a user-wide installation. To select explicitly, add `--skill vue-kit --agent codex --yes` (replace `codex` with your agent); add `--copy` to copy rather than symlink to agent directories. For an unpublished checkout, run the same command from the destination project with an explicit local checkout path in place of `PhilosophiMoonbeam/vue-kit-skills`.

The CLI pin selects the installer version, not this skill's revision. A remote installation requires the intended source revision to be published and reachable; to select it explicitly, use `PhilosophiMoonbeam/vue-kit-skills@<tag-or-full-commit>` with a real published tag or commit. In 1.9.0, Git entries in the [project skill lock](https://github.com/vercel-labs/skills/blob/v1.9.0/README.md#lock-file-content-hash) record the installed commit for restore. See the [tagged CLI reference](https://github.com/vercel-labs/skills/blob/v1.9.0/docs/commands.md#skills-add) for source formats and flags.

`--bun` explicitly runs the launcher on Bun. The [upstream Node.js ≥22.20.0 engine declaration](https://registry.npmjs.org/skills/1.9.0) describes the vendor's Node launch path. On Bun **1.4.5** with no Node.js executable on `PATH`, Skills CLI **1.9.0** ran `--version` and `add --help`. These launcher checks do not establish publication or remote installation; earlier **1.7.4** checks remain separate historical receipts.

## Navigate the skill

Install the skill for metadata-based discovery; do not preload its body or all references into every session. When a Vue task activates it, read [`skills/vue-kit/SKILL.md`](skills/vue-kit/SKILL.md), select the task's owning reference, and add companions only for decisions the change actually touches.

- **50 capability references:** Vue/reactivity, first-class Nuxt, components/composables, state, application-owned session boundaries, routing, server-state caches, forms, UI frameworks, accessibility, tables, virtualization, visualization, 3D, motion, localization, SSR, testing, self-hostable AI streaming and tooling, including eight focused OpenVue owners.
- **Architectural synthesis:** [application boundaries](skills/vue-kit/references/architecture.md), [data ownership and lifetimes](skills/vue-kit/references/architecture-data.md), and [UI composition](skills/vue-kit/references/architecture-ui.md).
- **Nuxt:** [framework ownership and complete application](skills/vue-kit/references/nuxt.md), then [selected Vuetify/Pinia/Colada/Tres integrations](skills/vue-kit/references/nuxt-integrations.md) only when needed. Nuxt owns bootstrap, routing and SSR; standalone Vue examples are not module recipes.
- **Preferred baseline:** Vue **3.5.46** and pinned authoring Vuetify **4.3.4**, with **4.3.x** preferred for new general-purpose UI. Alternative libraries and incumbent major versions retain their own compatibility boundaries; preference is not permission for an unrequested migration.
- **Optional deep OpenVue coverage:** start with [selection and architecture](skills/vue-kit/references/openvue.md), then read only the needed owner: [Vite/Nuxt setup](skills/vue-kit/references/openvue-setup.md), [theming and pass-through](skills/vue-kit/references/openvue-theming.md), [forms](skills/vue-kit/references/openvue-forms.md), [data](skills/vue-kit/references/openvue-data.md), [overlays](skills/vue-kit/references/openvue-overlays.md), [navigation](skills/vue-kit/references/openvue-navigation.md), or [layout/media/utilities](skills/vue-kit/references/openvue-components.md). OpenVue is the designated rich-widget alternative, authored against **1.0.0**, with MIT-licensed core/themes and no account or license key. Verify future majors independently; Vuetify remains the default. [Quasar](skills/vue-kit/references/alternative-ui.md) has a separate incumbent route.
- **TresJS:** start with the [released package map](skills/vue-kit/references/tresjs.md#released-package-map) for selection, Rapier, Leches and tooling, then [WebGPU scenes](skills/vue-kit/references/tresjs-webgpu.md) for Core/Cientos **5.12.0**. The workbench and lab pin Core **5.12.0**, Three **0.187.0** and `@types/three` **0.187.0**. The optional [effects](skills/vue-kit/references/tresjs-post-processing.md) (**3.13.0**) and [Nuxt module](skills/vue-kit/references/nuxt-integrations.md#optional-tresjs-module) (**5.10.0**) profiles retain their separate Three **0.186.1** / types **0.186.0** pins. Add only the packages the scene needs.
- **No implied outside services:** no hosted identity SDK, provider-key management, cloud account provisioning or required commercial service. Session helpers define application-owned contracts; streaming can target an application-owned or self-hosted backend; documentation search stays local.
- **Package manager and runtime:** use Bun **1.4.5** for the bundled workbench and repository tools. `--bun` forces a verified JavaScript CLI to run under Bun even if its shebang names Node and Node is installed. `node:*` compatibility APIs and `@types/node` declarations do not require a separate Node executable. Preserve a third-party project's selected manager, authoritative lockfile and runtime policy unless migration is requested. For new Vue app linting, prefer [Biome 2.6.8](skills/vue-kit/references/setup-tooling.md#biome-linting).

The installed skill is self-contained. Historical source paths in audit assets identify provenance; the deleted conception-input corpus and a private discovery service are not installation dependencies. A normal client's `.agents/skills/` installation destination is not that deleted input corpus.

## Run the example workbench

The bundled Vue/Vuetify/Pinia/Router application implements real in-memory tasks, validation, keyboard interaction, confirmation dialogs, navigation and theme changes. It has no backend, account, credentials or persistence; reload restores its example state.

The standalone [exact stack](skills/vue-kit/references/setup-tooling.md#exact-example-baseline-and-api-status) pairs Vue **3.5.46** and Vuetify **4.3.4** with Pinia **4.1.0**, `@vue/devtools-api` **8.2.1**, Router **5.5.1**, Vite **8.3.8**, `@vitejs/plugin-vue` **6.0.11**, TypeScript **6.0.3**, `vue-tsc` **3.3.14**, and `@types/bun` **1.4.5**. These pins do not supersede separately scoped incumbent recipes or historical receipts.

Open **Graphics** (`/graphics`) and choose **Start scene** for the default experimental, unlit WebGPURenderer via [`@tresjs/core/webgpu`](skills/vue-kit/references/tresjs-webgpu.md). Choose the lit WebGLRenderer via root `@tresjs/core` explicitly for compatibility. Each mount uses one renderer; the workbench does not automatically swap renderer families. The initialized backend distinguishes WebGPU from WebGPURenderer's own WebGL2 fallback. Claim that fallback only when the whole scene works on both backends; choose WebGLRenderer explicitly for incompatible dependencies, unported GLSL ShaderMaterial/onBeforeCompile or legacy EffectComposer. The route is lazy: Tasks and About do not load renderer packages, and Graphics waits for Start. Controls, status, errors and a text alternative remain ordinary DOM.

Stop, renderer changes, native context/device loss and route exit retire the scene; returning requires Start again. Hide/show and width controls retain the mounted scene and gate draws until the visible surface and canvas buffer have matching positive dimensions. They do not fake dimensions or wrap native methods. Rotation is opt-in, pauses when hidden/zero-width and is disabled by reduced-motion preference. The workbench adds no lab runtime, diagnostics collector, service or persistence. See the [workbench composition](skills/vue-kit/references/tresjs.md#bundled-workbench-composition) and the separate [archived 5.9.3 renderer-factory recipe](skills/vue-kit/references/tresjs.md#experimental-webgpu-and-custom-rendering).

Use Bun **1.4.5**; the workbench does not need a separate Node.js executable:

```sh
cd skills/vue-kit/assets/example-app
test -s bun.lock || { echo "Missing committed bun.lock" >&2; exit 1; }
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run dev
```

The committed `bun.lock` is authoritative. Keep the full `vue-tsc --noEmit` check separate from Vite bundling; neither a build nor Bun's native TypeScript checker replaces Vue template typechecking. See [setup and tooling](skills/vue-kit/references/setup-tooling.md) for compatibility observations, explicit TypeScript ambient types, lockfile migration and dependency lifecycle-script boundaries.

## Target-browser WebGPU/WebGL verification

The repository-only [browser verification lab](verification/webgpu/) uses **Tres Core 5.12.0** and **Three 0.187.0**, with **`@types/three` 0.187.0** for typechecking. It serves **five scenes and eight compatible diagnostic profiles**: [source-matched WebGLRenderer and WebGPURenderer scenes](skills/vue-kit/references/tresjs.md) plus bounded picking, real-asset loading and shared-resource ownership cases. The viewing device's browser and GPU render the scenes; Bun **1.4.5** serves the lab and fixtures. The lab is outside the installed skill.

**Normal · no injection** leaves native GPU/canvas methods unchanged. The default **Run focused recheck** collects two resize/hide/show scenarios, including repeated visibility changes and native canvas readback. Select **Full verification · 18 scenarios** for controls, fallback/denial, assets, ownership and deliberate renderer loss/recreation. Each sequence uses fresh same-origin iframes and retains raw errors; removing a scene keeps its error observers alive for late completion.

**The October corrected report is historical.** On the reported Edge 156 / Windows / NVIDIA Ampere configuration, the Core **5.9.3** / Three **0.186.1** lab restored visible WebGL2 and nonfallback WebGPU output in both focused scenarios without raw GPU or application errors. All 45 served identities matched that archived build; ten tab images and eight native PNGs were retained. Both hidden 0×0 readbacks completed as empty responses in 2 ms, not timeouts. This resolves the two regressions on the observed configuration and version only.

**To collect current device evidence**, use Bun **1.4.5** to build and serve this checkout from the repository root using the commands below:

1. Open the running lab on the device and browser you want to verify, then choose **Run focused recheck**. The full sequence remains optional.
2. Select **this browser tab** in the capture prompt and keep it visible. Audio is not requested. If capture is declined or unavailable, explicitly choose **Continue without tab capture** for canvas images and diagnostics only, or retry capture.
3. Let the sequence finish, then choose **Download report** before closing or reloading. Send that JSON for review; it embeds both image channels, original check criteria, run associations, source metadata, errors and prior partial runs. **Stop verification** retains completed evidence and releases capture.

Match the report's runtime versions and source, lock, build and fixture hashes to the served checkout. Review the initialized backends, restored visible output after resize/hide/show, native readback results and raw errors together. A reviewed report can establish those observations for the exercised scenarios on that browser/device. A software adapter, a backend name or a PNG alone is not proof of native WebGPU rendering.

Display frames cover the selected visible tab, not a full-page screenshot. Images are limited to a 1920-pixel longest edge with original/output dimensions and frame timing retained. Native canvas PNGs remain a separate channel; disagreement is not automatically a rendering failure. Nothing is uploaded by the lab. **Device details** are optional annotations when browser-reported GPU/driver identity is absent or masked.

The **17 original criteria** remain linked to evidence and explicit review limits. **Manual checks** is an optional workspace for follow-up: page scripts do not prove trusted keyboard/pointer input, real OS-preference transitions, complete listener release, CORS/offline behavior or hardware identity. Custom shaders and postprocessing/shadow pipelines are not used by these examples, not passed by the baseline. Browser/driver-only console messages are not exposed to in-page scripts; available component, window/rejection and GPU events are retained.

The original submission/intake gates (`vue-kit-skills-liu.27`, `.28.1`), corrected focused device gate (`.33.3`) and bounded support decision (`.28.2`) are complete for the archived **5.9.3/r186** profile with explicit limits, not 17 blanket passes. Neither the migrated lab nor the bundled `/graphics` workbench inherits a native-hardware pass. A fresh lab report would not cover the workbench; testing that composition on native hardware is separate.

```sh
test -s verification/webgpu/bun.lock || { echo "Missing committed lab bun.lock" >&2; exit 1; }
bun install --frozen-lockfile --cwd verification/webgpu
bun run --cwd verification/webgpu build
bun run --cwd verification/webgpu start
```

The lab's `build` script extracts the pinned sources, runs its typecheck, bundles with Vite, and stages provenance and fixtures. To check types separately, run `bun run --cwd verification/webgpu extract` first, then `bun run --cwd verification/webgpu typecheck`.

Fixture staging is offline and integrity-checked; initial dependency installation still needs the configured package registry. The unchanged Khronos **Box** fixture is by **Cesium, 2017, CC BY 4.0**, not covered by the project's MIT license. Its [primary license](verification/webgpu/fixtures/Box-LICENSE.md), metadata, README and [pinned acquisition receipt](verification/webgpu/fixtures/source-provenance.json) are retained and served with the real GLB. The delayed case completes that actual request; late disposal is not described as a network abort.

The backend listens only on `127.0.0.1:45875`. For access through an already configured tailnet, reuse a verified HTTPS route. Otherwise inspect `tailscale serve status` first and choose an unused port without changing existing Serve or Funnel routes:

```sh
tailscale serve --bg --https=11453 --yes http://127.0.0.1:45875
```

Use the HTTPS URL printed by the command; it provides the secure context WebGPU requires. This is tailnet-only Serve, not public Funnel. Keep the backend running. If you created this route for the lab, remove only that port with `tailscale serve --https=11453 off`; do not remove pre-existing routes. Tailscale is an optional verification-host tool, not a skill or recipe dependency. The lab requires no telemetry, uploads or account credentials.

The lab records the archived SFC fence fingerprints and checks source identity before staging. The three WebGL SFCs remain verbatim. The WebGPU copy moves the canvas imports to `@tresjs/core/webgpu`, removes the old pending-init unmount hook so r187 handles pending initialization through Tres's disposal call, and replaces the host's WebGL probe with the archived guide's exact `onMounted(() => { ready.value = true })`. The diagnostic canvas retains its synchronous factory and public draw guard. Served provenance distinguishes the archive fingerprints, transformed sources, exact pins and current `bun.lock` from built and fixture bytes. Failed-initialization teardown is not guaranteed; the earlier recipe's observations are not results for this build. See the [current bounded audit](skills/vue-kit/assets/current-audit.json) for recorded executions and unresolved gates.

## Contributor tooling

From the repository root with Bun **1.4.5**:

```sh
test -s bun.lock || { echo "Missing committed root bun.lock" >&2; exit 1; }
bun install --frozen-lockfile
bun run lint
```

The root [Biome](skills/vue-kit/references/setup-tooling.md#biome-linting) gate runs `biome lint . --error-on-warnings` without writing files. It checks authored JavaScript, TypeScript and Vue sources, not archived SFC fences or generated lab copies. Use `bun run lint:fix` to apply safe fixes and `bun run format <path>` only for files you intend to format. Neither app needs the root tooling to install or run.

## Validate and inspect evidence

From the repository root:

```sh
python3 skills/vue-kit/scripts/validate.py skills/vue-kit --json
python3 -m unittest discover -s verification -p 'test_*.py'
bun run --cwd verification/webgpu test
```

Install the lab's locked dependencies as shown above before running its test script.

The standard-library validator checks skill structure, reference navigation, retained source identity/native-hypothesis fingerprints, current ownership and content-addressed packaged files. It does not execute optional integrations or confer runtime certification.

Repository-only regression consumers run the validator from isolated packaged copies and reject corrupted discovery policy, source/escalation identities and routing summaries. They refresh each copy's footprint so a stale hash cannot disguise a missing provenance check; they are not application runtime tests.

The [current bounded audit](skills/vue-kit/assets/current-audit.json) preserves the **October 22–23, 2026** review of the original **48-reference** archive and separately records later source extensions and bounded consumers. The October release and target-device receipts keep their original scopes. Source review does not renew earlier executions or certify a newer package profile.

[Sources and verification policy](skills/vue-kit/references/sources.md) separate primary-source contracts, authoring policies, bounded consumers and full-declaration/UI checks. Forms and visualization retain broader declaration failures; an additional full motion dependency-tree profile has both missing ambient types and drag/ref declaration conflicts. Router 5.4.0's app-only declarations are separate from the combined plugin/runtime collision; TanStack AI Vue 0.27's full UI templates retain an upstream chat-message index error. Passing bounded application/build/browser scopes do not erase these negative profiles, and not every dependency-tree diagnostic is an upstream API defect.

The [retained verification record](skills/vue-kit/assets/verification.json), [fifth-pass audit](skills/vue-kit/assets/fifth-pass-audit.json), [support audit](skills/vue-kit/assets/support-audit.json) and [coverage routing](skills/vue-kit/assets/coverage-audit.json) preserve historical observations and provenance. Retained hashes, native risk labels and stored commands do not authenticate unavailable original traces or rerun earlier checks. Superseded reports remain optionally inspectable at repository commit `7bf433b98951918c694358e372d3b02cf6f982e5`; neither Git history nor deleted source inputs are required to use or validate the packaged skill. No complete server authentication implementation, exhaustive SSR matrix or blanket accessibility certification is implied.

**Removed presentation integration:** the earlier slide-authoring/tooltip integration remains excluded because its tested desktop compatibility patch failed at startup. See the [decision and reintroduction criteria](skills/vue-kit/references/sources.md#removed-integrations). [VitePress documentation](skills/vue-kit/references/docs-vitepress.md) and the unrelated Floating UI adapter remain supported.
