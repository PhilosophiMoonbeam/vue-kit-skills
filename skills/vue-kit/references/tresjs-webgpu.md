# TresJS WebGPU: Core and Cientos 5.12

Choose `@tresjs/core/webgpu` for a new scene whose materials, effects, dependencies, and enabled features all work with `WebGPURenderer`. Its canvas defaults to that renderer and registers node constructors; `useTres()` from the same entry types `renderer` as `WebGPURenderer`. Use `@tresjs/cientos/webgpu` for optional helpers. Choose the root `@tresjs/core` and `@tresjs/cientos` entries for an explicit `WebGLRenderer` scene, such as one that still depends on GLSL `ShaderMaterial`/`RawShaderMaterial`, `onBeforeCompile`, or a legacy composer. Avoid switching entry families inside an active scene: Core shares a runtime catalogue. Select a complete compatible scene up front, or retire the previous canvas and its resources before switching.

`WebGPURenderer` can fall back to its own WebGL2 backend, **not** to `WebGLRenderer`. A fallback claim applies to the **whole scene**, not a single helper or material. Do not reject the renderer merely because `navigator.gpu` is absent, or assume it works when that property exists. Adapter, runtime, and backend initialization decide availability. For effects, see [TresJS post-processing](tresjs-post-processing.md); for package selection and archived recipes, see the [released package map](tresjs.md#released-package-map).

## Install and compile

The [workbench](tresjs.md#bundled-workbench-composition) and [repository lab](tresjs.md#evidence-and-proposed-verification) pin **Vue 3.5.46 / Core 5.12.0 / `three@0.187.0` / `@types/three@0.187.0`**. The standalone TSL and optional Cientos FBO examples below retain their separate source profile: **Vue 3.5.44 / Core 5.12.0 / `three@0.186.1` / `@types/three@0.186.0`**. The [Nuxt](nuxt-integrations.md#optional-tresjs-module) and [effects](tresjs-post-processing.md) examples also retain r186 source pins. Use the following exact versions to reproduce this example in an existing Vue/Vite app; they are not minimum requirements. Install Cientos only for the FBO variant.

```sh
bun add --exact vue@3.5.44 three@0.186.1 @tresjs/core@5.12.0
bun add --dev --exact @types/three@0.186.0
# Optional
bun add --exact @tresjs/cientos@5.12.0
```

Configure **one** Vue compiler plugin: merge these options into the existing call rather than adding a second plugin. Keep one installed/resolved Three package version across app and dependencies, including when linking workspaces. `three`, `three/webgpu`, and `three/tsl` are intentional entry points of that package; do not alias them all to the same entry. Duplicate package copies can break constructor checks and node interoperability.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tres from '@tresjs/core/template-compiler-options'

export default defineConfig({
  plugins: [vue(tres)],
  resolve: { dedupe: ['three'] },
})
```

The [published compiler preset](https://unpkg.com/@tresjs/core@5.12.0/dist/template-compiler-options.mjs) recognizes scene tags and `primitive` without classifying Vue components like `TresCanvas` as custom elements. The [Core manifest](https://registry.npmjs.org/@tresjs/core/5.12.0), [Three WebGPU runtime exports](https://unpkg.com/three@0.186.1/src/Three.WebGPU.js), and [matching types](https://unpkg.com/@types/three@0.186.0/src/Three.WebGPU.d.ts) are pinned evidence for this slice.

## Client-owned canvas and experimental TSL

Mount `WebGpuHost.vue` as a normal Vue DOM component. In SSR, put this host behind the framework's client-only boundary if renderer modules must also stay out of server evaluation; `onMounted` gates canvas mounting, not static imports. The host sizes the canvas parent and exposes both renderer initialization errors and Vue descendant errors. Keep a DOM alternative when graphics are unavailable. The child owns canvas-context calls. This example uses the default renderer and assumes a drawable host; if the canvas stays mounted through zero-size layout, see the [workbench's positive-size draw gate](tresjs.md#bundled-workbench-composition) and verify each enabled render pass separately.

```vue
<!-- WebGpuHost.vue -->
<script setup lang="ts">
import { onErrorCaptured, onMounted, ref } from 'vue'
import { TresCanvas } from '@tresjs/core/webgpu'
import WebGpuScene from './WebGpuScene.vue'

const mounted = ref(false)
const ready = ref(false)
const failure = ref('')
const color = ref('#38bdf8')

onMounted(() => { mounted.value = true })

function reportError(error: unknown) {
  failure.value = error instanceof Error && error.message
    ? error.message
    : 'The graphics renderer could not start or draw the scene.'
}

onErrorCaptured((error) => {
  reportError(error)
  return false
})

function toggleColor() {
  color.value = color.value === '#38bdf8' ? '#fb923c' : '#38bdf8'
}
</script>

<template>
  <section aria-label="3D preview">
    <template v-if="failure">
      <p role="alert">3D preview unavailable: {{ failure }}</p>
      <p>The preview shows an unlit box that switches between blue and orange.</p>
    </template>
    <template v-else>
      <p v-if="!ready" role="status">Loading 3D preview…</p>
      <div v-if="mounted" class="viewport">
        <TresCanvas render-mode="on-demand" clear-color="#172033"
          @ready="ready = true" @error="reportError">
          <WebGpuScene :color="color" />
        </TresCanvas>
      </div>
      <button type="button" :disabled="!ready" @click="toggleColor">Change box color</button>
    </template>
  </section>
</template>

<style scoped>
.viewport { width: 100%; height: 20rem; }
</style>
```

```vue
<!-- WebGpuScene.vue -->
<script setup lang="ts">
import { useLocalNodes, useUniforms } from '@tresjs/core/webgpu'

const props = defineProps<{ color: string }>()
useUniforms({ uColor: () => props.color }, 'surface')
const { colorNode } = useLocalNodes(({ uniforms }) => ({
  colorNode: uniforms.surface.uColor,
}))
</script>

<template>
  <TresPerspectiveCamera :position="[0, 0, 5]" />
  <TresMesh :rotation="[0.25, 0.45, 0]">
    <TresBoxGeometry :args="[1, 1, 1]" />
    <TresMeshBasicNodeMaterial :color-node="colorNode" />
  </TresMesh>
</template>
```

The button updates the same color uniform and invalidates the on-demand canvas. A same-kind value update does not replace the uniform, rebuild the local graph, or request shader recompilation. Import custom node-material constructors from `three/webgpu` and TSL expressions from `three/tsl` when needed.

### The five TSL composables (experimental since 5.11)

| API | Ownership and update contract |
| --- | --- |
| `useUniform(name, source)` / `useUniform(name)` | Register or reuse a root uniform from a value, ref, or getter; name-only lookup throws if absent. The return is the current node, not a live ref to future replacements. |
| `useUniforms(sources, scope?)` / `useUniforms(scope?)` | Register scoped or root uniforms or look them up through a live view. `removeUniforms`, `clearUniforms`, and `rebuildUniforms` change store entries; an ordinary reactive source change updates the current node's value. Keep source kinds stable (for example, don't alternate between a float and a color). |
| `useNodes(creator, scope?)` / `useNodes(scope?)` | Register or read shared graphs/functions. Creators run once per generation, not whenever a captured value changes. Use uniforms for changing values; use `rebuildNodes` for structural changes, and `removeNodes`/`clearNodes` for removal. |
| `useLocalNodes(creator, sources?)` | Component-owned graph, not stored by name. A record gives per-key `shallowRef`s that follow graph replacement. The creator is untracked: list structural dependencies as watch sources. Replacement, removal, or appearance of a store entry it read can also rebuild it. An install callback can write nodes to objects and return cleanup for rebuild/unmount. |
| `useRenderPipeline(main?, setup?)` | With `main`, configure the canvas-owned Three `RenderPipeline`: the default `scenePass` exists first, then `setup` runs, then `main`. Without callbacks, inspect the active pipeline (`renderPipeline`, `passes`, `isReady`). Configure output in `main`; returned named passes are registered. `rebuild`, `reset`, and `clearPasses` act on the shared pipeline, not a private copy. |

Shared store entries live for the canvas or until explicitly removed; unmounting a registering child stops its watchers, not the entries. First registration wins for shared node/entry identity within a generation, **not** exclusive writes from duplicate uniform sources: use one reactive writer per scoped name, and look up entries elsewhere. Keep the shared view or returned local shallow ref if the node can be replaced; destructuring a shared view's node or caching a shallow ref's `.value` captures the old node. Capture the required store entries during the creator/callback, before deferred `Fn` evaluation, so replacement tracking can see the reads.

The latest configuring pipeline component wins; when it unmounts, the previous configuring owner resumes, or the original render function is restored if none remains. Callbacks can rerun on active scene/camera changes, relevant store changes, or rebuild, not every frame. `reset()` releases the active pipeline; `clearPasses()` removes extra passes, not `scenePass`. Use **one** main render owner per canvas: don't stack callback owners, a composer, another `replaceRenderFunction`, or a second main draw in a loop hook. `useRenderPipeline` rejects `WebGLRenderer`, not `WebGPURenderer` using its WebGL2 backend. Per-effect/backend support is separate. Keep render targets drawable and test hiding/restoring the host; a replacement draw function does not inherit an application-level size guard.

[Core 5.11 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs%2Fcore%405.11.0) · [5.12 TSL declarations](https://unpkg.com/@tresjs/core@5.12.0/dist/webgpu.d.ts) · [5.12 TSL source](https://github.com/Tresjs/tres/tree/%40tresjs/core%405.12.0/packages/core/src/webgpu/tsl)

## Core migration details

- **5.10.1 loader:** In a scene child under Vue `Suspense`, `const { state: gltf, error, progress, load } = await useLoader(GLTFLoader, '/models/duck.glb')` resolves a **then-less copy of the return object**, not the GLTF asset itself. The refs and methods survive the copy. In script use `gltf.value?.scene`; in a template use the unwrapped ref and render only once the scene exists. Wrapper-added fields survive the runtime spread, but wrappers must declare their own awaited types. [Loader source](https://github.com/Tresjs/tres/blob/%40tresjs/core%405.10.1/packages/core/src/composables/useLoader/index.ts)
- **5.10.1 scheduling and devtools:** Prop invalidation checks run in a microtask to avoid accidental subscriptions to frame state. In an idle on-demand scene, check that one prop update draws and the scene returns to idle. Automatic devtools registration is skipped for production `NODE_ENV`, including a staging build with that environment. [Prop change](https://github.com/Tresjs/tres/pull/1499/files) · [Devtools change](https://github.com/Tresjs/tres/pull/1498/files)
- **5.12 catalogue:** `extend({ Follower: { object: Follower, attach: 'follower', assign: ['target'] } })` registers a constructor with a default attachment and a property whose assigned objects have caller identity, including objects supplied through constructor `args`. An explicit `attach` overrides the default; `null` or `undefined` restores it. Catalogue options do not apply to `primitive`. Constructor-owned or read-only math properties such as Three's own `position` keep copy/set semantics. Writable properties backed by caller objects accept replacement object identity; subsequent array/scalar updates use a reusable owned clone when cloneable instead of mutating the caller object. This does not protect pierced props: `target-x` writes into the current target. [Core source](https://github.com/Tresjs/tres/tree/%40tresjs/core%405.12.0/packages/core/src/core)
- **5.12 loop:** `onBeforeRender(fn, priority = 0)` and `onRender(fn, priority = 0)` return `{ off }`; scope disposal also removes registrations. Across siblings, sort **within each phase** by ascending priority, then `useLoop()` call order, then registration order in that call. Before hooks → conditional main draw → after hooks. For example, an after hook at `-10` still runs after a before hook at `10`; equal-priority siblings are ordered by their `useLoop()` calls even if the first sibling registers its callback later. Async callbacks are not awaited, and hook execution is not proof that a frame was drawn. [Loop source](https://github.com/Tresjs/tres/blob/%40tresjs/core%405.12.0/packages/core/src/composables/useLoop/index.ts) · [Core 5.12 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs%2Fcore%405.12.0)

## Cientos 5.12: render to a texture

With a `/webgpu` canvas, import `Fbo` or `useFBO` from `@tresjs/cientos/webgpu`: 5.12 creates Three `RenderTarget`, where 5.10 created `WebGLRenderTarget`. Root `@tresjs/cientos` still creates `WebGLRenderTarget` for the root renderer path. Update WebGPU code that assumes the old target class or uses WebGL-only APIs. For WebGPURenderer readback, await `readRenderTargetPixelsAsync(...)` and use its returned buffer; don't port the synchronous WebGL API. See the [Cientos 5.12 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs%2Fcientos%405.12.0), [tagged implementation](https://github.com/Tresjs/tres/tree/%40tresjs%2Fcientos%405.12.0/packages/cientos/src/core/objects/useFBO), and [Three r186 renderer types](https://unpkg.com/@types/three@0.186.0/src/renderers/common/Renderer.d.ts).

`useFBO(options)` requires an object, even `useFBO({})`; no positional width/height. Options are `width?`, `height?`, `depth?`, `settings?: RenderTargetOptions` (from `three`), and `autoRender?`. The result is `Ref<RenderTarget | null>` on `/webgpu`, `Ref<WebGLRenderTarget | null>` at the root. Dimensions default to the measured canvas size without DPR multiplication (zero also falls back). Defaults are `depth: false` (no separate depth texture), `autoRender: true`, linear min/mag filters, `HalfFloatType`, and zero samples. `settings` can override allocation defaults. `Fbo` takes these options as props and exposes `instance` via `shallowRef<InstanceType<typeof Fbo> | null>(null)` and `fboRef.value?.instance`; it does not render a slot or supply slot props.

Default auto-render runs in the before phase at priority `Infinity`, binds and clears the target, renders with the active camera if present, then sets the render target to `null`, not the previously bound target. It is not an independent timer. For a receiving mesh in the same scene or for chained render state, prefer `autoRender: false` and explicitly manage the offscreen pass. Hide **every** object that samples the bound texture or render a separate scene to avoid feedback. Follow the target ref: Cientos disposes/replaces targets on dimension changes (including measured canvas resize with explicit dimensions), invalidates, and disposes on unmount. Use reactive options for mutable dimensions; `depth`/`settings` changes alone do not reallocate the target. Don't cache the texture across resize or dispose a Cientos-owned target or texture yourself.

### Manual render-to-texture child

Install Cientos, then **replace** the scene child in `WebGpuHost.vue`: replace the `WebGpuScene` import with `import FboScene from './FboScene.vue'` and `<WebGpuScene :color="color" />` with `<FboScene />` in the same slot. Remove the color button, its state and handler, and change the DOM alternative text to describe the torus and its preview. Keep the sized parent, `@ready`/`@error`, and Vue error boundary. Do not mount both scene children or add a second camera in the host.

```vue
<!-- FboScene.vue -->
<script setup lang="ts">
import { shallowRef } from 'vue'
import type { Mesh } from 'three'
import { useLoop, useTres, useTresContext } from '@tresjs/core/webgpu'
import { useFBO } from '@tresjs/cientos/webgpu'

const target = useFBO({ autoRender: false, settings: { samples: 0 } })
const screen = shallowRef<Mesh | null>(null)
const { renderer, scene, camera, sizes } = useTres()
const { isInitialized } = useTresContext().renderer

useLoop().onBeforeRender(() => {
  const mesh = screen.value
  const activeCamera = camera.value
  const buffer = target.value
  if (!isInitialized.value || !mesh || !activeCamera || !buffer) return
  if (sizes.width.value < 1 || sizes.height.value < 1 || buffer.width < 1 || buffer.height < 1) return
  if (renderer.domElement.width < 1 || renderer.domElement.height < 1) return

  const previous = renderer.getRenderTarget()
  const cubeFace = renderer.getActiveCubeFace()
  const mipLevel = renderer.getActiveMipmapLevel()
  const visible = mesh.visible
  const autoClear = renderer.autoClear
  try {
    mesh.visible = false
    renderer.setRenderTarget(buffer)
    renderer.autoClear = false
    renderer.clear()
    renderer.render(scene.value, activeCamera)
  } finally {
    mesh.visible = visible
    renderer.autoClear = autoClear
    renderer.setRenderTarget(previous, cubeFace, mipLevel)
  }
})
</script>

<template>
  <TresPerspectiveCamera :position="[0, 0, 5]" />
  <TresMesh :position="[1.5, 0, 0]">
    <TresTorusGeometry :args="[0.5, 0.2, 16, 32]" />
    <TresMeshNormalMaterial />
  </TresMesh>
  <TresMesh ref="screen" :position="[-1, 0, 0]">
    <TresPlaneGeometry :args="[2, 2]" />
    <TresMeshBasicNodeMaterial :map="target?.texture ?? null" />
  </TresMesh>
</template>
```

This before hook adds one offscreen draw per callback invocation, not one per invalidated main draw. If continuous offscreen work is unwanted in a larger app, gate the pass on capture demand. The guard applies to this pass only; keep the mounted host drawable, or suspend/unmount the canvas when hiding it. Resize, reveal, and unmount are separate lifecycle cases to exercise. If a custom pass also modifies viewport, scissor, clear color, or other renderer state, restore those changes before handing control back to the main draw.

### Helper selection and support limits

`OrbitControls` and `RoundedBox` are exported from both entries. `/webgpu` also exports `Fbo`, `useFBO`, `CubeCamera`, `Environment`, `useEnvironment`, `Lightformer`, and node variants under the actual public names `Grid`, `Outline`, `Image`, `HolographicMaterial`, `MeshDiscardMaterial`, `MeshGlassMaterial`, `MeshWobbleMaterial`, `PointMaterial`, `Precipitation`, `Sparkles`, and `Stars`. Check the [tagged WebGPU entry](https://github.com/Tresjs/tres/blob/%40tresjs%2Fcientos%405.12.0/packages/cientos/src/webgpu.ts) for other exports; being exported does not certify a helper's options on both backends.

The [exact 5.12 exclusion list](https://github.com/Tresjs/tres/blob/%40tresjs%2Fcientos%405.12.0/packages/cientos/scripts/check-entries.mjs) is `AccumulativeShadows`, `BakeShadows`, `CatmullRomCurve3`, `ContactShadows`, `CubicBezierLine`, `CustomShaderMaterial`, `Lensflare`, `Line2`, `MeshPortalMaterial`, `MeshReflectionMaterial`, `MeshTransmissionMaterial`, `Ocean`, `QuadraticBezierLine`, `Reflector`, `Refractor`, `Sky`, `SoftShadows`, and `Stage`. Do not import these from the root entry to bypass the restriction under `WebGPURenderer`.

These examples describe the pinned r186 APIs, not a hardware compatibility result. Before claiming support, exercise the uniform-only change, the preview with no feedback errors, positive-size resize/restore, and clean unmount on both the native and forced WebGL2 backend of `WebGPURenderer`. Test depth textures, multisampling, and readback separately if used. Neither the archived workbench, device, and October receipts nor the current r187 runnable profile establish results for these standalone examples.
