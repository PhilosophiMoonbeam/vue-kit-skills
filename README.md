![Vue Kit — One skill. Open horizons. A Vue-green pirate ship sails across a neon sea beneath a striped sunset.](assets/branding/vue-kit-hero.svg)

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

Select `vue-kit` and your target agents when prompted. Skills CLI **1.7.4** installs project-scoped by default; use `--global` only for a user-wide installation. Its installer requires **Node.js >=22.20**, distinct from the authoring environment below. See the [pinned installer reference](https://github.com/vercel-labs/skills/blob/v1.7.4/docs/commands.md#skills-add) for noninteractive, agent-selection and copy options. These commands select the repository revision available remotely; they do not establish that this working-tree audit revision has been published or installed.

## Navigate the skill

Install the skill for metadata-based discovery; do not preload its body or all references into every session. When a Vue task activates it, read [`skills/vue-kit/SKILL.md`](skills/vue-kit/SKILL.md), select the task's owning reference, and add companions only for decisions the change actually touches.

- **48 capability references:** Vue/reactivity, first-class Nuxt, components/composables, state, application-owned session boundaries, routing, server-state caches, forms, UI frameworks, accessibility, tables, virtualization, visualization, motion, localization, SSR, testing, self-hostable AI streaming and tooling, including eight focused OpenVue owners.
- **Architectural synthesis:** [application boundaries](skills/vue-kit/references/architecture.md), [data ownership and lifetimes](skills/vue-kit/references/architecture-data.md), and [UI composition](skills/vue-kit/references/architecture-ui.md).
- **Nuxt:** [framework ownership and complete application](skills/vue-kit/references/nuxt.md), then [selected Vuetify/Pinia/Colada integrations](skills/vue-kit/references/nuxt-integrations.md) only when needed. Nuxt owns bootstrap, routing and SSR; standalone Vue examples are not module recipes.
- **Preferred baseline:** Vue **3.5.44** and pinned authoring Vuetify **4.3.0**, with **4.3.x** preferred for new general-purpose UI. Alternative libraries and incumbent major versions retain their own compatibility boundaries; preference is not permission for an unrequested migration.
- **Optional deep OpenVue coverage:** start with [selection and architecture](skills/vue-kit/references/openvue.md), then read only the needed owner: [Vite/Nuxt setup](skills/vue-kit/references/openvue-setup.md), [theming and pass-through](skills/vue-kit/references/openvue-theming.md), [forms](skills/vue-kit/references/openvue-forms.md), [data](skills/vue-kit/references/openvue-data.md), [overlays](skills/vue-kit/references/openvue-overlays.md), [navigation](skills/vue-kit/references/openvue-navigation.md), or [layout/media/utilities](skills/vue-kit/references/openvue-components.md). OpenVue is the designated rich-widget alternative, authored against **1.0.0**, with MIT-licensed core/themes and no account or license key. Verify future majors independently; Vuetify remains the default. [Quasar](skills/vue-kit/references/alternative-ui.md) has a separate incumbent route.
- **No implied outside services:** no hosted identity SDK, provider-key management, cloud account provisioning or required commercial service. Session helpers define application-owned contracts; streaming can target an application-owned or self-hosted backend; documentation search stays local.
- **Package manager:** prefer Bun **1.4.3** for equivalent install, add, script and executable workflows. Respect an existing project's explicitly selected manager and authoritative lockfile unless migration is requested. Bun package management does not automatically change Node-based tooling into Bun-runtime tooling.

The installed skill is self-contained. Historical source paths in audit assets identify provenance; the deleted conception-input corpus and a private discovery service are not installation dependencies. A normal client's `.agents/skills/` installation destination is not that deleted input corpus.

## Run the example workbench

The bundled Vue/Vuetify/Pinia/Router application implements real in-memory tasks, validation, keyboard interaction, confirmation dialogs, navigation and theme changes. It has no backend, account, credentials or persistence; reload restores its example state.

Open **Graphics** (`/graphics`) and choose **Start scene** for the default experimental, unlit WebGPURenderer baseline; choose the lit WebGLRenderer option explicitly for compatibility. WebGPURenderer is the modern standard default posture for new compatible scenes: all materials, effects, dependencies and features must support **both WebGPU and its built-in WebGL2 backend** to claim fallback. WebGLRenderer is not an interchangeable automatic fallback; use it for pipelines that require unported GLSL ShaderMaterial/onBeforeCompile, legacy EffectComposer or other incompatible dependencies. See the [preferred factory recipe](skills/vue-kit/references/tresjs.md#experimental-webgpu-and-custom-rendering). The page is lazy; renderer packages are not requested on Tasks/About or before Start. Its initialized backend distinguishes actual WebGPU from WebGPURenderer's WebGL 2 fallback. Controls, status, errors and a text alternative remain ordinary DOM.

Stop, renderer changes, native context/device loss and route exit retire the scene; returning requires Start again. Hide/show and width controls retain the mounted scene, with a public positive-size draw gate rather than fake dimensions or native-method wrappers. Rotation is opt-in, pauses when hidden/zero-width and is disabled by reduced-motion preference. The port adds no lab runtime, diagnostics collector, service or persistence. See the [retained recipe and port boundary](skills/vue-kit/references/tresjs.md#bundled-workbench-composition).

Use Bun **1.4.3** and supported Node.js **24.15.0** for the recorded environment:

```sh
cd skills/vue-kit/assets/example-app
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run dev
```

The committed `bun.lock` is authoritative. Keep type checking separate from Vite bundling; a build alone does not prove types or behavior. See [setup and tooling](skills/vue-kit/references/setup-tooling.md) for prerequisites, lockfile migration and dependency lifecycle-script boundaries.

## Target-browser WebGPU/WebGL verification

The repository-only [browser verification lab](verification/webgpu/) combines the explicit WebGLRenderer compatibility and preferred experimental WebGPURenderer [TresJS recipes](skills/vue-kit/references/tresjs.md) with bounded picking, real-asset loading and shared-resource ownership consumers: **five scenes and eight compatible diagnostic profiles**. Rendering uses the **viewing device's browser/GPU**; Node serves the lab and fixtures. The lab is outside the installed skill.

**Normal · no injection** leaves native GPU/canvas methods unchanged. The default **Run focused recheck** collects two resize/hide/show scenarios, including repeated visibility changes and native canvas readback. Select **Full verification · 18 scenarios** for controls, fallback/denial, assets, ownership and deliberate renderer loss/recreation. Each sequence uses fresh same-origin iframes and retains raw errors; removing a scene keeps its error observers alive for late completion.

**The corrected target-device recheck has been reviewed.** On the reported Edge 156 / Windows / NVIDIA Ampere configuration, both focused scenarios restored visible WebGL2/WebGPU output without raw GPU or application errors. All 45 served identities matched; ten tab images and eight native PNGs were retained. Both hidden 0×0 readbacks completed as empty responses in 2 ms, not timeouts. This confirms the two regressions on the observed configuration—not every browser, GPU, manual criterion or lighting/custom-shader pipeline.

1. Open the lab in the original target browser and choose **Run focused recheck**. The full sequence remains optional.
2. Select **this browser tab** in the capture prompt and keep it visible. Audio is not requested. If capture is declined or unavailable, explicitly choose **Continue without tab capture** for canvas images and diagnostics only, or retry capture.
3. Let the sequence finish, then choose **Download report** before closing or reloading. Send that JSON for review; it embeds both image channels, original check criteria, run associations, source metadata, errors and prior partial runs. **Stop verification** retains completed evidence and releases capture.

Display frames cover the selected visible tab, not a full-page screenshot. Images are limited to a 1920-pixel longest edge with original/output dimensions and frame timing retained. Native canvas PNGs remain a separate channel; disagreement is not automatically a rendering failure. Nothing is uploaded by the lab. **Device details** are optional annotations when browser-reported GPU/driver identity is absent or masked.

The **17 original criteria** remain linked to evidence and explicit review limits. **Manual checks** is an optional workspace for follow-up: page scripts do not prove trusted keyboard/pointer input, real OS-preference transitions, complete listener release, CORS/offline behavior or hardware identity. Custom shaders and postprocessing/shadow pipelines are not used by these examples, not passed by the baseline. Browser/driver-only console messages are not exposed to in-page scripts; available component, window/rejection and GPU events are retained.

The original submission/intake gates (`vue-kit-skills-liu.27`, `.28.1`), corrected focused device gate (`.33.3`) and bounded support decision (`.28.2`) are complete with explicit limits, not 17 blanket passes. The selected successor is now implemented in the bundled workbench's `/graphics` route. The target-device reports cover the retained recipe/lab source, **not a native-hardware test of this new workbench composition**; separate consumer acceptance does not renew those archived runs.

```sh
bun install --frozen-lockfile --cwd verification/webgpu
bun run --cwd verification/webgpu build
bun run --cwd verification/webgpu start
```

Fixture staging is offline and integrity-checked; initial dependency installation still needs the configured package registry. The unchanged Khronos **Box** fixture is by **Cesium, 2017, CC BY 4.0**, not covered by the project's MIT license. Its [primary license](verification/webgpu/fixtures/Box-LICENSE.md), metadata, README and [pinned acquisition receipt](verification/webgpu/fixtures/source-provenance.json) are retained and served with the real GLB. The delayed case completes that actual request; late disposal is not described as a network abort.

The backend listens only on `127.0.0.1:45875`. For access through an already configured tailnet, reuse a verified HTTPS route. Otherwise inspect `tailscale serve status` first and choose an unused port without changing existing Serve or Funnel routes:

```sh
tailscale serve --bg --https=11453 --yes http://127.0.0.1:45875
```

Use the HTTPS URL printed by the command; it provides the secure context WebGPU requires. This is tailnet-only Serve, not public Funnel. Keep the backend running. If you created this route for the lab, remove only that port with `tailscale serve --https=11453 off`; do not remove pre-existing routes. Tailscale is an optional verification-host tool, not a skill or recipe dependency. The lab requires no telemetry, uploads or account credentials.

The preferred WebGPURenderer recipe remains experimental on pinned Tres **5.9.3** / Three **0.186.1**, including its known failed-initialization teardown limit. Default posture is not upstream stability, new hardware certification or a claim that WebGPU is always faster. Use the [current bounded audit](skills/vue-kit/assets/current-audit.json) for recorded execution scopes and unresolved gates.

## Validate and inspect evidence

From the repository root:

```sh
python3 skills/vue-kit/scripts/validate.py skills/vue-kit --json
python3 -m unittest discover -s verification -p 'test_*.py'
bun test verification/webgpu/tests/capture-result.test.mjs
```

The standard-library validator checks skill structure, reference navigation, retained source identity/native-hypothesis fingerprints, current ownership and content-addressed packaged files. It does not execute optional integrations or confer runtime certification.

Repository-only regression consumers run the validator from isolated packaged copies and reject corrupted discovery policy, source/escalation identities and routing summaries. They refresh each copy's footprint so a stale hash cannot disguise a missing provenance check; they are not application runtime tests.

The [current bounded audit](skills/vue-kit/assets/current-audit.json) preserves the **October 22–23, 2026** review of the original **70 authored files, 48 references and 3,615 audit units**, including all 3,599 escalated units. Its explicit source-only workbench extension inventories **73 authored files and 3,637 units**, excluding the ledger itself, with 22 newly source-reviewed units rather than new classifier judgments or executions. The original scope, timestamps, 53 execution rows, 94 adjudications and both target-device receipts remain unchanged. Source review, observed runtime, historical integrity and remaining boundaries stay distinct; this working-tree evidence does not establish publication, remote installation or ecosystem-wide certification.

[Sources and verification policy](skills/vue-kit/references/sources.md) separate primary-source contracts, authoring policies, bounded consumers and full-declaration/UI checks. Forms and visualization retain broader declaration failures; an additional full motion dependency-tree profile has both missing ambient types and drag/ref declaration conflicts. Router 5.4.0's app-only declarations are separate from the combined plugin/runtime collision; TanStack AI Vue 0.27's full UI templates retain an upstream chat-message index error. Passing bounded application/build/browser scopes do not erase these negative profiles, and not every dependency-tree diagnostic is an upstream API defect.

The [retained verification record](skills/vue-kit/assets/verification.json), [fifth-pass audit](skills/vue-kit/assets/fifth-pass-audit.json), [support audit](skills/vue-kit/assets/support-audit.json) and [coverage routing](skills/vue-kit/assets/coverage-audit.json) preserve historical observations and provenance. Retained hashes, native risk labels and stored commands do not authenticate unavailable original traces or rerun earlier checks. Superseded reports remain optionally inspectable at repository commit `7bf433b98951918c694358e372d3b02cf6f982e5`; neither Git history nor deleted source inputs are required to use or validate the packaged skill. No complete server authentication implementation, exhaustive SSR matrix or blanket accessibility certification is implied.

**Removed presentation integration:** the earlier slide-authoring/tooltip integration remains excluded because its tested desktop compatibility patch failed at startup. See the [decision and reintroduction criteria](skills/vue-kit/references/sources.md#removed-integrations). [VitePress documentation](skills/vue-kit/references/docs-vitepress.md) and the unrelated Floating UI adapter remain supported.
