# TresJS and Three.js scenes

Read for declarative 3D scenes, cameras/lights, render loops, asset loading, resource ownership, or WebGL/SSR failures. TresJS is a Vue custom renderer for Three.js, not an HTML UI kit. Keep accessible controls, descriptions, and errors in ordinary DOM outside the scene. See [accessibility.md](accessibility.md), [motion.md](motion.md), and [debugging-ssr.md](debugging-ssr.md).

For a new compatible scene, start with the [WebGPU and Cientos guide](tresjs-webgpu.md). Choose [post-processing](tresjs-post-processing.md) by renderer entry. For Nuxt-owned setup, use the [Nuxt module](nuxt-integrations.md#optional-tresjs-module). Keep the root WebGLRenderer pipeline when required by an incumbent material, shader, effect, or dependency.

## Released package map

Stable profile as of **2026-11-22**, with each package version selected independently. The links point to the exact published manifests; [release history](https://github.com/tresjs/tres/releases) includes prereleases and dependency-only updates, not just feature releases.

| Package | Published profile | Choose it for |
| --- | --- | --- |
| `@tresjs/core` | [**5.12.0**](https://registry.npmjs.org/@tresjs/core/5.12.0) | [Choose the canvas and renderer entry](tresjs-webgpu.md): `/webgpu` for WebGPURenderer, root for explicit WebGLRenderer compatibility |
| `@tresjs/cientos` | [**5.12.0**](https://registry.npmjs.org/@tresjs/cientos/5.12.0) | [Choose helpers by pipeline](tresjs-webgpu.md): controls, assets, staging, batching, and picking |
| `@tresjs/nuxt` | [**5.10.0**](https://registry.npmjs.org/@tresjs/nuxt/5.10.0) | [Configure the optional Nuxt module](nuxt-integrations.md#optional-tresjs-module): auto-imports, client canvas, and renderer entry selection |
| `@tresjs/post-processing` | [**3.13.0**](https://registry.npmjs.org/@tresjs/post-processing/3.13.0) | [Choose an effect pipeline](tresjs-post-processing.md): `/webgpu` node effects or root WebGLRenderer composers |
| `@tresjs/rapier` | [**1.4.0**](https://registry.npmjs.org/@tresjs/rapier/1.4.0) | [Add Rapier physics](#rapier-asynchronous-wasm-world-explicit-collider-contracts): WASM world, bodies, colliders, sensors, and step hooks |
| `@tresjs/leches` | [**1.3.3**](https://registry.npmjs.org/@tresjs/leches/1.3.3) | [Add Leches DOM controls](#leches-reactive-dom-controls-not-a-tres-scene-component): optional reactive development panel |
| `@tresjs/cli` | [**0.1.1**](https://registry.npmjs.org/@tresjs/cli/0.1.1) | [Generate Vue SFCs from glTF](#cli-setup-and-its-actual-command-surface): local generation and optional model transformation |
| `@tresjs/eslint-config` | [**1.7.0**](https://registry.npmjs.org/@tresjs/eslint-config/1.7.0) | [Optional release history](#tres-eslint-config-release-history-not-recommended), not the kit's lint setup |

Install only what the scene needs. The runnable [workbench](#bundled-workbench-composition) and [repository lab](#evidence-and-proposed-verification) pin **Vue 3.5.46, Core 5.12.0, [Three r187](https://github.com/mrdoob/three.js/releases/tag/r187) (`three@0.187.0`) and [`@types/three@0.187.0`](https://registry.npmjs.org/@types/three/0.187.0)**. The standalone [TSL/Cientos](tresjs-webgpu.md), [Nuxt](nuxt-integrations.md#optional-tresjs-module), and [effects](tresjs-post-processing.md) examples retain their separate **Core 5.12.0 / `three@0.186.1` / `@types/three@0.186.0`** source profiles. They are not covered by the active r187 pins or by older r186 device receipts.

## Exact version and rendering boundary

**Archive boundaries:** the compatibility, loader, and custom-renderer recipes below preserve the **Core 5.9.3 / Three 0.186.1** baseline. The former workbench/lab and its device receipts remain scoped to that version; the [October Core/Cientos 5.10 entry-point examples](#published-510-entry-points-not-a-baseline-upgrade) describe another archived source snapshot, not renewed hardware evidence for either current runnable consumer.

The pinned **`@tresjs/core@5.9.3` / `three@0.186.1`** examples target **Vue 3.5.44** and **`@types/three@0.186.0`**. Core 5.9.3 is ESM-only and declares Vue peer `>=3.4` and Three peer `>=0.133`; those broad peer ranges do not establish support for each API used here. The historical custom-renderer integration remains experimental on this pair. [Core 5.9.3 manifest](https://registry.npmjs.org/@tresjs/core/5.9.3), [Three 0.186.1 manifest](https://registry.npmjs.org/three/0.186.1).

The fallback contract requires the **whole scene**—materials, shaders, effects, dependencies and enabled features—to work on **both WebGPU and WebGPURenderer's built-in WebGL2 backend**. Backend selection stays within WebGPURenderer; it does not switch to WebGLRenderer. Choose **WebGLRenderer explicitly for compatibility** when the pipeline cannot use WebGPURenderer, such as unported GLSL `ShaderMaterial`/`RawShaderMaterial`, `onBeforeCompile`, legacy `EffectComposer` passes or renderer-specific dependencies. Its WebGL 2 requirement is not a WebGL 1 fallback. Preserve working incumbent pipelines during narrow work, and measure actual workloads rather than assuming WebGPU is always faster.

For the **5.9.3 recipes below**, merge Tres's compiler options with the Vite host's existing Vue plugin; do not add a second plugin or replace unrelated configuration. This complete minimal configuration requires `vite` and `@vitejs/plugin-vue` in the host:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { templateCompilerOptions } from '@tresjs/core'

export default defineConfig({
  plugins: [vue({ ...templateCompilerOptions })],
})
```

`@tresjs/core/template-compiler-options` is also exported for compiler-only consumers. For current compiler setup, see the [focused WebGPU guide](tresjs-webgpu.md). Nuxt uses [its own module](nuxt-integrations.md#optional-tresjs-module); do not paste Vite SPA bootstrapping into a Nuxt plugin. [Official installation](https://docs.tresjs.org/getting-started/installation), [pinned package exports](https://unpkg.com/@tresjs/core@5.9.3/package.json).

## Scene ownership and API model

| Surface | Rule |
| --- | --- |
| `TresCanvas` | Owns scene, renderer, size observation, camera management, and rendering context. Give its parent a real height. |
| `Tres` + Three class name | `<TresMesh>`, `<TresBoxGeometry>`, `<TresPerspectiveCamera>`, `<TresDirectionalLight>` are generated scene elements, not individually imported Vue components. |
| `args` | Constructor arguments. In **5.9.3**, changing a nonempty args array constructs a temporary instance and copies writable properties onto the existing object; do not promise a new template-ref identity or automatic disposal of replaced resources. Use properties for ordinary updates and stable args for geometry. |
| Math/property props | `:position="[x, y, z]"`, `:rotation="[x, y, z]"`, `color="…"` update Three properties. |
| Attachments | Geometry/material children attach to the mesh's `geometry`/`material`; the canvas supplies the scene. Do not nest a second scene unnecessarily. |
| Template refs | Use `shallowRef<Mesh | null>` (or the actual Three type). Refs are null before mount/after removal; guard every frame callback. Do not deeply proxy Three instances. |
| `<primitive :object="object" />` | Mounts an existing Three object. Ownership of programmatic resources must be explicit; mounting is not universal ownership transfer. |
| `useLoop`, `useTres` | Call in a **descendant component of `TresCanvas`**, where its context is provided; not in the same component that creates the canvas. |

Declare a camera and its aim intentionally. The first registered camera is normally active; when switching cameras, use the camera manager rather than mutating a snapshot. `useTres().camera` exposes the active camera ref; `useTresContext().camera` is the **manager**, whose `activeCamera` is a ref. No camera is not a useful framing strategy, even though the canvas can create a default one. MeshStandardMaterial requires lighting; MeshBasicMaterial/MeshNormalMaterial do not demonstrate a lit scene.

## Complete WebGLRenderer compatibility example: client boundary, controls, and animated scene

This archived example shows an explicit **WebGLRenderer compatibility** pipeline on `@tresjs/core@5.9.3`, `three@0.186.1`, and `@types/three@0.186.0`, using the Vite configuration above. For a new compatible scene, start with the [current WebGPU guide](tresjs-webgpu.md). The three SFCs remain a complete focused example: `SceneHost.vue` is the DOM entry, `SceneCanvas.vue` owns controls and canvas, and `SpinningCube.vue` consumes the canvas context. Animation is opt-in, disabled under reduced-motion preference, and uses on-demand rendering while stopped.

```vue
<!-- SceneHost.vue -->
<script setup lang="ts">
import { defineAsyncComponent, onErrorCaptured, onMounted, ref } from 'vue'

const SceneCanvas = defineAsyncComponent(() => import('./SceneCanvas.vue'))
const ready = ref(false)
const failure = ref<string | null>(null)
onMounted(() => {
  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2')
    if (!gl) {
      failure.value = 'WebGL 2 is unavailable; the scene cannot be displayed.'
      return
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    ready.value = true
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  }
})
onErrorCaptured(cause => {
  failure.value = cause instanceof Error ? cause.message : String(cause)
  return false
})
</script>

<template>
  <section aria-label="Cube demonstration">
    <h2>Blue cube</h2>
    <p>No information requires 3D.</p>
    <p v-if="failure" role="alert">{{ failure }}</p>
    <SceneCanvas v-else-if="ready" @error="failure = $event.message" />
    <p v-else role="status">Preparing the interactive scene.</p>
  </section>
</template>
```

```vue
<!-- SceneCanvas.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { TresCanvas } from '@tresjs/core'
import SpinningCube from './SpinningCube.vue'

const emit = defineEmits<{ error: [cause: Error] }>()
const playing = ref(false)
const reduced = ref(true)
const active = computed(() => playing.value && !reduced.value)
let media: MediaQueryList | undefined
function syncMotion() {
  reduced.value = media?.matches ?? true
  if (reduced.value) playing.value = false
}
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncMotion()
  media.addEventListener('change', syncMotion)
})
onBeforeUnmount(() => media?.removeEventListener('change', syncMotion))
</script>

<template>
  <div>
    <button
      type="button" :disabled="reduced" :aria-pressed="active"
      @click="playing = !playing"
    >
      {{ active ? 'Pause rotation' : 'Start rotation' }}
    </button>
    <p v-if="reduced">Rotation is disabled by your reduced-motion preference.</p>
    <div class="scene" role="img" aria-label="Blue cube with ambient and directional lighting">
      <TresCanvas
        render-mode="on-demand"
        :dpr="1" :fps-limit="30" clear-color="#17212b"
        @error="emit('error', $event)"
      >
        <TresPerspectiveCamera :position="[3, 2, 4]" :look-at="[0, 0, 0]" />
        <TresAmbientLight :intensity="0.8" />
        <TresDirectionalLight :position="[3, 4, 2]" :intensity="2" />
        <SpinningCube :playing="active" />
      </TresCanvas>
    </div>
  </div>
</template>

<style scoped>
.scene { width: 100%; height: 24rem; min-width: 0; }
</style>
```

```vue
<!-- SpinningCube.vue -->
<script setup lang="ts">
import { shallowRef } from 'vue'
import { useLoop } from '@tresjs/core'
import type { Mesh } from 'three'

const props = defineProps<{ playing: boolean }>()
const cube = shallowRef<Mesh | null>(null)
const dimensions: [number, number, number] = [1, 1, 1]
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta, invalidate }) => {
  if (!props.playing) return
  const mesh = cube.value
  if (!mesh) return
  mesh.rotation.y += delta * 0.8
  invalidate()
})
</script>

<template>
  <TresMesh ref="cube">
    <TresBoxGeometry :args="dimensions" />
    <TresMeshStandardMaterial color="#3a9bd9" :roughness="0.6" />
  </TresMesh>
</template>
```

The client-only host delays importing the canvas module until after mount; server and first client render share the preparation text. WebGL probing is capability detection, not a guarantee that later context creation succeeds. The canvas's emitted renderer `error` is explicitly forwarded to the DOM host; `onErrorCaptured` handles descendant Vue exceptions, not component-emitted errors. Both paths replace the scene with a real error message. In a production information interface, preserve an equivalent image/text/table, not only a loading placeholder. In Nuxt, a `.client.vue` boundary plus useful `<ClientOnly>` fallback is another host-specific choice.

## Render loop and reference lifetimes

- `useLoop().onBeforeRender` is the current update hook. Timing is **`delta` and `elapsed`, in seconds**. Multiply rates by delta; do not add a fixed angle per frame. Clamp unusually large deltas only when the simulation's semantics require it.
- `render-mode="always"` is continuous. `on-demand` redraws after observed prop/lifecycle/size changes; **direct ref mutations bypass Vue observation**, so call `useTres().invalidate()` after them. `manual` uses `advance()`.
- A stopped rotation does not need an independent `requestAnimationFrame` loop. Do not run one alongside Tres's loop unless there is an explicit separate owner and cleanup.
- `onBeforeRender`/`onRender` accept a priority; higher priority executes later. Keep physics updates before rendering and avoid reactive DOM writes on every frame unless the UI truly needs frame-rate updates.
- `useLoop().render(fn)` takes over rendering for postprocessing/multipass work. The function must perform its rendering and call the supplied **`notifySuccess()`** completion callback; otherwise frame scheduling/render modes become inconsistent. Dispose custom render targets, composers, and passes yourself.
- Treat mesh refs and `useTres().camera.value` as live, nullable handles. Do not capture a camera instance once and assume it survives camera switching. Keep `args` static unless constructor-level property replacement is intended.

**Pinned 5.9.3 boundary:** an idle `on-demand` → `always` prop change does not seed its zero frame budget. Keep this example in `on-demand` and call the loop context's `invalidate()` for each opted-in mutation; do not use a live mode switch as the play control. The context's `renderer.mode` field is an initial snapshot, not live prop evidence. [Pinned frame-budget and invalidation implementation](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js).

Source correction: v4 `useRenderLoop`, `useTexture` in core, treating `await useLoader(...)` as the raw loaded asset, and hyphenated `@pointer-down` are not the v5 contract. Use `useLoop`; texture helpers live in the separately versioned `@tresjs/cientos`; consume reactive loader state. The v5 loader result is thenable, but awaiting it yields that state-bearing result, not a raw glTF scene. Pointer names are native `@pointerdown`, `@pointermove`, `@click`. Only the first intersected object receives the ordinary pointer interaction under current v5 semantics. Provide a DOM keyboard equivalent for any mesh action; pointer picking does not make a canvas keyboard accessible. [Upgrade guide](https://docs.tresjs.org/getting-started/upgrade-guide), [loop API](https://docs.tresjs.org/api/composables/use-loop).

### Picking, propagation, and selection

The pinned **5.9.3** declaration accepts `click`, `contextmenu`, `dblclick`, `pointerdown`, `pointerup`, `pointercancel`, `pointermove`, `pointerover`, `pointerout`, `pointerenter`, `pointerleave`, `lostpointercapture`, and `wheel`. Use **`@dblclick`**, not the current guide's `@doubleclick` spelling: exact declarations/runtime decide that conflict. Raycastable objects and primitives can receive handlers. Events bubble through the object hierarchy, not through every occluded mesh; `stopPropagation()` stops ancestor handling, `pointerover`/`pointerout` bubble, and `pointerenter`/`pointerleave` do not. Use a common `TresGroup` to coordinate child selection and canvas `@pointermissed` to clear it.

`TresPointerEvent` carries `object`, world-space `point`, distance/face/UV and native-style `clientX`/`clientY` or `screenX`/`screenY` coordinates; there is no combined `xy` property. The hit `object` is not necessarily a `Mesh` with one color-bearing material. Narrow it before mutation, including material arrays. Prefer selecting a stable business ID and deriving appearance from state to blindly mutating `event.object.material.color`. [Pinned pointer base payload](https://unpkg.com/@pmndrs/pointer-events@6.6.30/dist/html-event.d.ts).

At **5.9.3**, keep Object3D pointer-handler function identities stable. Its `patchProp` registers a changed supported handler with `addEventListener` without removing the previous function; replacing or clearing that prop is not a reliable unsubscribe. Fresh closures inside `v-for` can therefore accumulate callbacks across reactive updates. Prefer stable script methods that read current state inside the handler; ordinary Vue DOM event patching is a different path. The bounded picking consumer reproduced the accumulation and confirmed stable callbacks after repeated real hover/selection updates. [Pinned event prop implementation](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js).

Complete scene child (mount under the configured canvas). The DOM owner receives a genuine selection event and must offer the same selection action through an ordinary labeled button/list:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { TresPointerEvent } from '@tresjs/core'

const emit = defineEmits<{ select: [id: 'cube'] }>()
const hovered = ref(false)
function select(event: TresPointerEvent) {
  event.stopPropagation()
  emit('select', 'cube')
}
function hover(event: TresPointerEvent) {
  hovered.value = event.type === 'pointerenter'
}
</script>

<template>
  <TresMesh
    @click="select" @pointerenter="hover" @pointerleave="hover"
  >
    <TresBoxGeometry :args="[1, 1, 1]" />
    <TresMeshBasicMaterial :color="hovered ? '#e6a700' : '#2166ac'" />
  </TresMesh>
</template>
```

Debug missing picks in order: canvas/overlay actually receives input, camera/frustum and object visibility, raycastable geometry, hit order, then handler propagation. DOM CSS cannot be assumed to disable an individual Three mesh's raycast. [Pointer guide](https://docs.tresjs.org/api/events/pointer-events), [exact event names and payload](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.d.ts).

### Advanced component and context integration

| Workflow | Usable boundary |
| --- | --- |
| Host owns the HTML canvas | Import `TresCanvasContext`, own `ref<HTMLCanvasElement \| null>(null)`, render `<canvas ref="canvas">` and mount the context with `v-if="canvas"` and `:canvas="canvas"`. Supply the same scene children/camera, parent dimensions, and client/error boundary; do not run a second TresCanvas renderer against that element. |
| Portal to another scene/group | Import `TresPortal`; pass an existing stable `Object3D`/`Scene` as `:to`. Children and attachments target that object; `disabled` puts children back in place. **Injected `useTres().scene` remains the main scene**. Own target rendering (for example a render texture), disposal, and any explicit alternate context; a portal does not create an FBO or second camera pipeline. |
| Non-Three constructor | Call `extend({ YourConstructor })` before `<TresYourConstructor>` use. Keep its args/property/disposal contracts explicit; the compiler prefix is not automatic runtime constructor registration. |
| Template-first loader | Import `UseLoader`; give `loader`, `path`, optional `manager`/`extensions`; its slot receives `{ state, isLoading, error }` and it emits `loaded`/`error`. It wraps the same loader lifecycle, not an independent caching/cancellation service. Prefer the composable when typed decoder configuration or orchestration is needed. |
| Cross-renderer injection | `enableProvideBridge` defaults true. Keep provided business state scoped to the host; disabling the bridge intentionally changes injection visibility. `customRendererOptions.primitivePrefix` changes the primitive tag to avoid host collisions; coordinate compiler handling too. |
| Library-level renderer/camera owner | `useCameraManager`, `useRendererManager`, and `useTresContextProvider` are exported building blocks, not prerequisites for normal app code. Reuse TresCanvas/TresCanvasContext unless you are deliberately assuming scene, sizing, camera registration, loop, event and disposal ownership. |

`@ready` gives initialized context; `@error` reports renderer errors (`TresRendererError`, code `INITIALIZATION_FAILED`), and `@before-loop`/`@loop` work on the canvas itself without descendant injection. `useLoop` registrations return `{ off }` for early removal and are removed with their Vue scope. Its `start`/`stop` and `isActive` control the **shared canvas loop**, not only that component's callbacks; use a local playing guard or remove one registration when unrelated scene animation must continue. Do not manually call the exposed canvas `dispose()` again after ordinary Vue unmount has already released the owner.

`useGraph(object)` returns **one computed map**, not an object of refs: keep `const graph = useGraph(computed(() => model.value?.scene))`, then read `graph.value?.nodes[name]`, `.materials[name]`, or `.meshes[name]`. `buildGraph(object)` is the nonreactive snapshot form. The source's destructured `{ nodes, materials } = useGraph(...)` drops this contract. Names can be absent/duplicated and material changes can affect shared meshes; inspect the map and resource ownership before edits. [Pinned composables/components](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.d.ts), [portal semantics](https://docs.tresjs.org/api/components/tres-portal), [host canvas](https://docs.tresjs.org/api/components/tres-context).

For a v4 cutover also replace `useCamera` with the active `useTres().camera`, `useTresReady` with `@ready`, `useSeek` with the computed graph, and `useRaycaster`/`useTresEventManager` with current picking; `useLogger` becomes logging utilities. Context `performance` is removed: inspect a narrowed WebGL renderer's `info` (render calls, geometries, textures), not a historical performance ref. `v-log`/`v-log:material`, `v-light-helper`, `v-distance-to`, and Tres devtools are diagnostic aids, not production animation or resource owners. [Migration](https://docs.tresjs.org/getting-started/upgrade-guide), [directives](https://docs.tresjs.org/api/utils/directives).

## Assets: current loader API and ownership

`useLoader(LoaderConstructor, path, options?)` returns reactive **`state`, `isLoading`, `error`, `progress`, `load`**, not a bare asset Promise. It also retains VueUse's thenable interface: `await useLoader(...)` resolves to the state-bearing result, so read its `state` rather than assuming the awaited value is the asset. The path can be a ref; `extensions(loader)` configures decoders before loading. Check errors explicitly; `progress.total` may be zero/unknown, so a percentage is not always meaningful. Do not display 100% as proof that textures/shaders have rendered. [Pinned thenable implementation](https://unpkg.com/@vueuse/core@15.0.0/dist/index.js).

The complete child below loads a real, small, uncompressed Khronos glTF Box asset. It requires network access to that primary URL; for an offline application, vendor the asset and its license rather than claiming an absent `/models/box.glb` exists. Mount this child **inside** a configured canvas with camera/lights. Its `status` event lets the ordinary DOM owner display loading/error text; do not render `<p>` inside the Three scene.

```vue
<!-- LoadedBox.vue -->
<script setup lang="ts">
import { onBeforeUnmount, watchEffect } from 'vue'
import { dispose, useLoader } from '@tresjs/core'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

const emit = defineEmits<{ status: [message: string] }>()
const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Box/glTF-Binary/Box.glb'
let alive = true
onBeforeUnmount(() => { alive = false })
const { state: model, isLoading, error } = useLoader<GLTF>(GLTFLoader, url, {
  asyncOptions: {
    onSuccess: (asset: GLTF | null) => {
      // useLoader only disposes state already resolved at unmount.
      if (!alive && asset?.scene) dispose(asset.scene)
    },
  },
})
watchEffect(() => {
  if (error.value) {
    const cause = error.value
    emit('status', `Model load failed: ${cause instanceof Error ? cause.message : String(cause)}`)
  } else if (isLoading.value) emit('status', 'Loading the box model.')
  else emit('status', 'Box model loaded.')
})
</script>

<template>
  <primitive v-if="!isLoading && !error && model?.scene" :object="model.scene" />
</template>
```

To use it in the previous example, replace `SpinningCube` with `LoadedBox`, import that component, own `const modelStatus = ref('Loading the box model.')` in `SceneCanvas.vue`, bind `@status="modelStatus = $event"`, and display `<p role="status">{{ modelStatus }}</p>` **outside** `TresCanvas`. Remove the rotation controls and loop-only child from that static-asset variant. This is an alternative composition, not an extra hidden file dependency of the cube example.

Decoder and asset rules:

- Compressed glTF may require DRACO, Meshopt, or KTX2 helpers configured in `extensions`; install and serve the actual decoder files. A `.glb` extension alone does not imply uncompressed data. The often-cited Tres blender-cube asset **requires `KHR_draco_mesh_compression`**, unlike the Khronos Box used here.
- Respect model scale, bounds, camera near/far range, light/material requirements, CORS, base URLs, texture color spaces, and asset licenses. Load errors are not repaired by a random camera offset.
- A single Object3D has one parent: clone a scene for independent mounts. Cloning a hierarchy may still share geometry/material/texture resources; define a resource owner before disposing any copy. Skinned assets need an appropriate skeleton-aware clone.
- **5.9.3 runtime detail:** `useLoader` disposes an already resolved `state.scene` when its reactive path changes and on unmount. Do not add a second blanket `dispose(model.scene)` handler to this loader-owned glTF example. Its success callback disposes **only a result arriving after teardown**, when the loader's unmount callback could not see it. `load(path)` follows its own execution path; do not assume it has identical replacement-disposal semantics to the watched path.
- This loader is not a general request-cancellation, shared-cache, or out-of-order-result contract. The inspected implementation does not cancel an in-flight request on unmount; the example closes that late-result resource lifetime through `asyncOptions.onSuccess`, supported by its VueUse 15 dependency. It still does **not** abort network I/O. Keep one stable asset per mounted loader here; racing/repeated loads need separate result identity and disposal ownership, not this single-load guard. [Pinned success-callback semantics](https://unpkg.com/@vueuse/core@15.0.0/dist/index.js).

[Loader API](https://docs.tresjs.org/api/composables/use-loader), [pinned loader implementation](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js), [Khronos Box source and license information](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box).

## Disposal, performance, and browser failure modes

| Resource | Lifetime rule |
| --- | --- |
| Template-created geometry/material | Tres recursively cleans up on removal by default; do not dispose while a live scene still uses it. Set `:dispose="null"` on the resource-sharing subtree to opt out, then let its explicit shared owner release resources after the final consumer. |
| Programmatically owned primitive | Generic primitives do not establish ownership. Call exported `dispose(object)` when its sole owner releases it; loader-owned glTF scenes are the specific exception described above. |
| Shared geometry/material/texture | Use an explicit shared owner/reference lifetime; one unmounted mesh must not invalidate another live mesh. |
| Separately created Texture/render target/decoder/composer | Follow its actual `.dispose()`/cleanup API. Object disposal is not a claim that unrelated resources or external event handlers are freed. |
| DOM listeners/observers outside Tres | Clean up with the Vue owner, as in the media-query listener example. |

The exported `dispose` is an Object3D-oriented recursive utility, not a universal function for arbitrary resource types. For standalone programmatic geometry/material/texture objects, call their actual Three `.dispose()` methods. Never render the same programmatic object under two parents and then dispose it twice.

The subtree opt-out affects renderer removal, **not** `useLoader`'s separate glTF cleanup. Do not put a cache-shared `scene` into that loader-owned lifetime or assume cloning its hierarchy isolates GPU resources. Cache-owned assets need a cache owner that controls final disposal; use per-instance clones with deliberately shared or independently cloned materials/textures. In **5.9.3**, exported `dispose(object)` disposes mesh geometry, material(s), and their `map` textures, not every possible texture slot. Track other owned maps/targets separately and dispose each only after its final consumer. [Pinned removal, loader, and disposal implementation](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js), [Three resource cleanup](https://threejs.org/manual/pages/how-to-dispose-of-objects.html).

Bound DPR and FPS according to measured quality needs. Reuse geometry/materials, use instancing for repeated meshes, reduce draw calls and expensive shadows, and avoid per-frame allocation of vectors/materials/arrays. Do not turn ordinary constructor changes into an animation strategy. Renderer-creation props such as `antialias`, `alpha`, and WebGL context settings are mount-time decisions; changing them requires a deliberate renderer remount, not an assumed live patch.

Size the canvas's **parent** explicitly; window-sized mode is a different layout choice. A zero-height parent is not a Three camera bug. Tres observes size and updates camera aspect; do not install an unrelated competing resize loop. Handle context loss and recovery deliberately: stop dependent work, retain an informative DOM alternative, and recreate/reload only resources whose owner requires it. WebGPURenderer selects its own backend; explicit WebGLRenderer compatibility is a separate pipeline choice, not a fallback after failure.

## Experimental WebGPU and custom rendering

**Archived factory recipe for Core 5.9.3.** Use the [current dedicated entry](tresjs-webgpu.md) for new compatible scenes. Claim WebGL2 fallback only when every scene material, effect, dependency, and feature supports both WebGPURenderer backends. The unlit Basic-material baseline below is deliberately bounded, not a PBR or post-processing certification or evidence that WebGPU is always faster.

For **core 5.9.3 / Three 0.186.1**, the `renderer` prop is a synchronous factory `(ctx: TresRendererSetupContext) => TresRenderer`, not a ready-made instance or Promise. Tres owns initialization of the returned renderer. This complete alternative `SceneCanvas.vue` reuses the earlier client host's async import, error listeners, preparation text, and DOM description (do not also mount the WebGL cube scene). **For this variant only**, replace that host's WebGL 2 probing `onMounted` callback with `onMounted(() => { ready.value = true })`: the selected renderer, not a mandatory WebGL probe, must decide WebGPU/backend availability. Keep `onErrorCaptured` for synchronous constructor failures and the forwarded `@error` for rejected renderer initialization. [Pinned backend selection](https://unpkg.com/three@0.186.1/src/renderers/webgpu/WebGPURenderer.js), [Tres construction and initialization](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js).

```vue
<script setup lang="ts">
import { defineComponent, onBeforeUnmount, toValue } from 'vue'
import {
  isPerspectiveCamera, TresCanvas, useLoop, useTresContext,
  type TresRendererSetupContext,
} from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'

const emit = defineEmits<{ error: [cause: Error] }>()
const createRenderer = (context: TresRendererSetupContext) => {
  const renderer = new WebGPURenderer({
    canvas: toValue(context.canvas), antialias: true, alpha: false,
  })
  onBeforeUnmount(() => {
    // Tres disposes normally. If init is still pending, release its late result too.
    if (!renderer.initialized) {
      void renderer.init().then(
        () => renderer.dispose(),
        cause => emit('error', cause instanceof Error ? cause : new Error(String(cause), { cause })),
      )
    }
  })
  return renderer
}

// This child owns draw eligibility, not a second resize/camera implementation.
const PositiveSizeRender = defineComponent({
  setup() {
    const { renderer, scene, camera } = useTresContext()
    const { render } = useLoop()
    const canvas = renderer.instance.domElement
    const host = canvas.parentElement
    if (!host) throw new Error('The WebGPU canvas needs a sized DOM parent.')
    let width = 0
    let height = 0
    let retired = false
    const observer = new ResizeObserver(([entry]) => {
      if (retired || !entry) return
      // Match VueUse 15's logical content-box measurements, including vertical writing.
      const boxes = entry.contentBoxSize as ResizeObserverSize[] | ResizeObserverSize | undefined
      width = 0
      height = 0
      if (Array.isArray(boxes)) {
        for (const box of boxes) {
          width += box.inlineSize
          height += box.blockSize
        }
      } else if (boxes) {
        width = boxes.inlineSize
        height = boxes.blockSize
      } else {
        width = entry.contentRect.width
        height = entry.contentRect.height
      }
      // Also wake a static scene whose on-demand frame count is already zero.
      if (width > 0 && height > 0) renderer.invalidate()
    })
    render((notifySuccess) => {
      const activeCamera = camera.activeCamera.value
      const dpr = renderer.instance.getPixelRatio()
      if (
        retired || !host.isConnected || host.clientWidth <= 0 || host.clientHeight <= 0
        || width <= 0 || height <= 0 || canvas.width <= 0 || canvas.height <= 0
        || canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)
        || !activeCamera
        || (isPerspectiveCamera(activeCamera) && (!Number.isFinite(activeCamera.aspect) || activeCamera.aspect <= 0))
      ) return // Do not consume the pending frame before a real, positive-size draw.
      renderer.instance.render(scene.value, activeCamera)
      notifySuccess()
    })
    observer.observe(host)
    onBeforeUnmount(() => {
      retired = true
      observer.disconnect()
    })
    return () => null
  },
})
</script>

<template>
  <div class="scene">
    <TresCanvas
      :renderer="createRenderer" render-mode="on-demand" :dpr="1"
      @error="emit('error', $event)"
    >
      <PositiveSizeRender />
      <TresPerspectiveCamera :position="[3, 2, 4]" :look-at="[0, 0, 0]" />
      <TresMesh>
        <TresBoxGeometry :args="[1, 1, 1]" />
        <TresMeshBasicMaterial color="#2166ac" />
      </TresMesh>
    </TresCanvas>
  </div>
</template>

<style scoped>
.scene { width: 100%; height: 24rem; }
</style>
```

Bind this variant's `@error` in the DOM host to set its existing `failure` message: emitted errors need an explicit listener, not an assumption that `onErrorCaptured` catches component emits. Keep a text/image alternative and capability/error handling even when `navigator.gpu` exists; secure context, adapter availability and renderer initialization decide actual support. Do not copy dated browser-version/flag lists as a guarantee. WebGPURenderer's built-in WebGL2 backend is its fallback only for dual-backend-compatible pipelines; it is **not** WebGLRenderer and does not make legacy WebGL-only customizations interchangeable.

**Zero-size ownership on this exact pair:** Tres **5.9.3** observes the canvas parent, debounces width and height independently by 10 ms, calls `setSize()` after initialization even for zero dimensions, and invalidates the on-demand scene. Three **0.186.1**'s `Renderer.setSize()` → `CanvasTarget.setSize()` only writes the HTML canvas/viewport and dispatches resize; its WebGPU resize handler invalidates a cached pass descriptor, **not** a GPU texture allocation. The subsequent native `render()` is the allocation/submission boundary: `_getFrameBufferTarget()` takes the drawing-buffer dimensions, and the WebGPU render-pass/depth/MSAA paths create textures from them without a positive-size guard. Stopping only a resize observer, checking only `@ready`, or guarding capture after rendering is too late. [Pinned Tres sizing/render/init order](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js), [Three renderer](https://unpkg.com/three@0.186.1/src/renderers/common/Renderer.js), [canvas sizing](https://unpkg.com/three@0.186.1/src/renderers/common/CanvasTarget.js), [WebGPU pass/resize](https://unpkg.com/three@0.186.1/src/renderers/webgpu/WebGPUBackend.js), [texture allocation](https://unpkg.com/three@0.186.1/src/renderers/webgpu/utils/WebGPUTextureUtils.js).

`PositiveSizeRender` uses the public [custom render callback](https://docs.tresjs.org/api/composables/use-loop#take-over-the-render-loop); it does not wrap or replace the native renderer's methods or mutate Tres's size refs. Tres remains the sole camera, size, DPR, scene and ordinary renderer-disposal owner. The child is installed synchronously when Tres mounts the scene at readiness, before its first RAF draw. It checks the **current** host as well as the actual buffer, so hiding before the debounced zero-size update cannot submit a stale draw. Its observer records the latest real content-box dimensions; a positive restoration invalidates even an otherwise idle scene, and rendering waits until Tres's buffer matches those dimensions. On this pinned implementation, skipping `notifySuccess()` retains the pending on-demand frame; call it only after the real draw. Static rendering and explicit `invalidate()` therefore remain on-demand, including rapid hide/show/resize. An initially hidden canvas does not become ready or start the Tres loop until a positive buffer exists. Once ready, the host, canvas and scene stay mounted while hidden: **the HTML drawing buffer may honestly be 0×0**, but the guarded scene does not allocate or submit a zero-size GPU frame, invent a 1×1 image, or change readback semantics.

On actual unmount, the child retires its draw callback and disconnects its observer. The factory's retirement hook additionally waits for an already-pending native `init()` and disposes its successful late result: r186's early `dispose()` skips resources not initialized yet. Initialization failures still reach the DOM host, native errors remain observable, and the pinned failed-init teardown limitation below is not suppressed. A new mount creates a new actual renderer and scene; no retired callback owns the replacement. This boundary is specific to the shown single-canvas pipeline: additional custom render/postprocessing consumers must use the same positive-size draw policy.


**Observed support, not universal certification:** the [verification register](../assets/verification.json) preserves historical software-WebGPU/fallback observations. The [current audit](../assets/current-audit.json) additionally retains two user reports from reported Edge 156 / Windows / NVIDIA Ampere hardware. The original report exposed 0×0 WebGPU texture validation errors before capture; the corrected focused report matched all 45 served identities, restored visible output through narrow/wide/hidden/shown and repeated transitions, and retained no raw GPU/application errors. All ten display frames were reviewed; four WebGPU PNGs contained actual opaque blue pixels. Both hidden readbacks returned `data:,` in 2 ms rather than timing out. Four valid transparent WebGL PNGs remained distinct from visibly rendered tab output. The guarded baseline is confirmed on that observed configuration; keep the WebGPU integration experimental. Exact model/driver, other devices, unused custom shaders/postprocessing and lighting/PBR are not certified.

The same historical register records controlled runs that **deliberately denied both WebGPU initialization and WebGL2 fallback**: the canvas forwarded `TresRendererError` (`INITIALIZATION_FAILED`) to the host alert, followed by an unhandled teardown rejection. Fresh inspection confirms the pinned source path Tres unmount → unawaited `renderer.dispose()` → Three **0.186.1**'s unawaited `setAnimationLoop(null)` → the stored rejected `init()` promise; that source trace is not a rerun of the observation. This injected-failure result is not evidence that ordinary rendering or a particular GPU is broken. Keep the recipe experimental, do not suppress raw errors, and independently exercise initialization failure and cleanup in the actual target environment. [Pinned Three lifecycle source](https://unpkg.com/three@0.186.1/src/renderers/common/Renderer.js), [pinned Tres implementation](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js).

`useTresContext().isWebGPU.value` and `isWebGPURenderer(renderer)` identify the **renderer family**, including its WebGL2 fallback, not proof of an active GPU backend. For custom shaders, import node materials from `three/webgpu` and TSL expressions from `three/tsl`; TSL targets WGSL or GLSL according to the selected backend. `ShaderMaterial`, `RawShaderMaterial`, and `onBeforeCompile` customizations are not supported by this renderer, including its WebGL2 fallback; port them to node materials/TSL. Legacy WebGL `EffectComposer` passes are not interchangeable with its node-based postprocessing. Use `isWebGLRenderer` before accessing WebGLRenderer-specific APIs. On the selected **r186** pair, soft shadows fall back to `PCFShadowMap` on WebGPU too; old “WebGPU always defaults to PCFSoftShadowMap” guidance applies only before r186. Custom postprocessing must support the selected renderer and call `notifySuccess()` as described above. [Exact capability/default declarations](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.d.ts), [Three migration and TSL](https://threejs.org/manual/pages/webgpurenderer.html), [experimental integration](https://docs.tresjs.org/api/advanced/web-gpu).

## Published 5.10 entry points: not a baseline upgrade

**Archived October profile.** These source-backed examples target **`@tresjs/core@5.10.0`, `@tresjs/cientos@5.10.0`, `three@0.186.1`, `@types/three@0.186.0`, Vue `3.5.44`**. In this pair Core requires Vue `>=3.4`, while Cientos requires **Vue `>=3.5.17`** and Core `^5.9.1`. The broad Three peer `>=0.133` does not establish support for modern node APIs. This snapshot is neither a browser receipt nor a dependency migration. For new work, follow the [current WebGPU guide](tresjs-webgpu.md). [Archived Core manifest](https://unpkg.com/@tresjs/core@5.10.0/package.json), [archived Cientos manifest](https://unpkg.com/@tresjs/cientos@5.10.0/package.json), [Core 5.10.0 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/core%405.10.0).

### Entry selection, catalogue and types

| Import boundary | Archived 5.10 behavior |
| --- | --- |
| `@tresjs/core/webgpu` | `TresCanvas` and `TresCanvasContext` create **WebGPURenderer by default**; no user factory is needed for ordinary setup. A supplied factory must synchronously return `WebGPURenderer`, not a Promise or WebGLRenderer. Tres initializes it. |
| `useTres` from `@tresjs/core/webgpu` | Returns the renderer typed as `WebGPURenderer`. Use it only under that entry's canvas; it is a type promise about the owner, not a runtime renderer conversion. |
| `useTresContext`, shared `useLoop`/loader/portal/utilities | Shared context and lifecycle contracts remain. The full context is not wholly specialized to WebGPU; narrow renderer-family APIs rather than assuming every exported manager is specialized. |
| `@tresjs/core` | Root canvas/context still create **WebGLRenderer**. This is the explicit compatibility pipeline, not WebGPURenderer's fallback backend. |
| `@tresjs/cientos/webgpu` | Curated shared helpers plus node-material ports under familiar component names. Importing a missing helper from the root is not a backend-safe substitute. |

The WebGPU entry imports `three/webgpu`, **extends the shared runtime catalogue**, and augments Vue `GlobalComponents` for names absent from the root Three types, including node materials. Shared names retain the root **declaration** types; this is not a second isolated renderer registry. Root canvas/context setup also extends that same catalogue with `three`. Avoid mounting competing entry families that overwrite shared constructor names in one app; for custom classes use deliberate, unambiguous `extend({ Name })` registration. The WebGPU entry is marked side-effectful in the package manifest so its registration survives tree shaking; do not mark that module side-effect-free in a consumer bundler.

The default factory forwards `antialias`, `alpha`, `depth`, `stencil`, `logarithmicDepthBuffer`, and non-`default` `powerPreference` to the WebGPURenderer constructor. A prop inherited in the public canvas interface, such as `preserveDrawingBuffer`, does **not** mean the WebGPU constructor receives it. Renderer-specific features need actual backend support, not only acceptance by the shared prop type. [Published entry/runtime](https://unpkg.com/@tresjs/core@5.10.0/dist/webgpu.js), [specialized types](https://unpkg.com/@tresjs/core@5.10.0/dist/webgpu.d.ts), [shared catalogue/runtime](https://unpkg.com/@tresjs/core@5.10.0/dist/src-DL__Foe9.js).

### Exact Vue/Vite assumptions for the 5.10 examples

Use an existing **Vue SFC + Vite ESM** host, with `vite`, `@vitejs/plugin-vue`, `typescript`, and `vue-tsc` installed and invoked with the [Bun toolchain](setup-tooling.md). Tres's own 5.10 manifest develops against Vite `^8.2.2` and plugin-vue `^6.0.8`; those are upstream development dependencies, not Tres peer requirements. This standalone configuration is for an otherwise empty Vite Vue host. In a real host, merge the predicate into its **one** existing Vue plugin and preserve other template/compiler/plugin options. No global Tres plugin, Nuxt module, auto-import plugin, GLSL plugin, or `@tresjs/cientos/styles.css` is needed for this controls/node-material example.

```ts
// vite.config.ts — 5.10 compiler-only default export, not a named export
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tresCompilerOptions from '@tresjs/core/template-compiler-options'

export default defineConfig({
  plugins: [vue(tresCompilerOptions)],
})
```

The predicate treats `Tres[A-Z]…`, `tres-…`, and `primitive` as custom renderer elements, except Vue component names `TresCanvas`, `TresCanvasContext`, `TresLeches`, `TresScene`, and `TresPortal`. Imported Cientos components such as `OrbitControls` remain normal Vue components. `extend()` registers runtime constructors; it does not replace SFC compiler setup or independently declare template types. If a non-template library needs WebGPU global component typing without a runtime import, explicitly include `import type {} from '@tresjs/core/webgpu'` in a declaration/module reached by the TypeScript project. [Pinned compiler predicate](https://unpkg.com/@tresjs/core@5.10.0/dist/template-compiler-options.mjs), [pinned WebGPU augmentation](https://unpkg.com/@tresjs/core@5.10.0/dist/webgpu.d.ts).

### Complete 5.10 WebGPU/node-prop scene

Place these two SFCs in that host and mount `ModernHost.vue` as its normal application component. This uses an explicit factory **only** to expose the native renderer's `forceWebGL` fixture option and pending-initialization ownership; omitting `:renderer` selects the new entry's default WebGPURenderer. No WebGL-only material/effect is present. The compatibility button selects **WebGPURenderer's built-in WebGL2 backend**, not WebGLRenderer. Switching retires and remounts the owner; an actual legacy WebGLRenderer scene belongs in a separate explicit compatibility composition.

```vue
<!-- ModernHost.vue -->
<script setup lang="ts">
import { defineAsyncComponent, onErrorCaptured, ref } from 'vue'

const ModernCanvas = defineAsyncComponent(() => import('./ModernCanvas.vue'))
const started = ref(false)
const forceWebGL = ref(false)
const failure = ref<string | null>(null)
function start(fallback: boolean) {
  forceWebGL.value = fallback
  failure.value = null
  started.value = true
}
function reportError(cause: unknown) {
  console.error(cause)
  failure.value = cause instanceof Error ? cause.message : String(cause)
}
onErrorCaptured(cause => {
  reportError(cause)
  return false
})
</script>

<template>
  <section aria-label="Node material demonstration">
    <h2>Switchable blue or orange cube</h2>
    <p>The cube illustrates a material color; no information requires the 3D view.</p>
    <button type="button" @click="start(false)">Start WebGPU-preferred scene</button>
    <button type="button" @click="start(true)">Start built-in WebGL 2 backend</button>
    <button type="button" @click="started = false">Stop scene</button>
    <p v-if="failure" role="alert">{{ failure }}</p>
    <ModernCanvas
      v-else-if="started" :key="String(forceWebGL)" :forceWebGL="forceWebGL"
      @error="reportError"
    />
    <p v-else role="status">Scene is stopped.</p>
  </section>
</template>
```

```vue
<!-- ModernCanvas.vue -->
<script setup lang="ts">
import { computed, defineComponent, onBeforeUnmount, ref, toValue } from 'vue'
import {
  isPerspectiveCamera, TresCanvas, useLoop, useTresContext,
  type TresRendererSetupContext,
} from '@tresjs/core/webgpu'
import { OrbitControls } from '@tresjs/cientos/webgpu'
import { WebGPURenderer } from 'three/webgpu'
import { color } from 'three/tsl'

const props = defineProps<{ forceWebGL: boolean }>()
const emit = defineEmits<{ error: [cause: Error] }>()
const warm = ref(false)
const blue = color('#2166ac')
const orange = color('#c65d12')
const colorNode = computed(() => warm.value ? orange : blue)
const createRenderer = (ctx: TresRendererSetupContext) => {
  const renderer = new WebGPURenderer({
    canvas: toValue(ctx.canvas), antialias: true, forceWebGL: props.forceWebGL,
  })
  onBeforeUnmount(() => {
    if (!renderer.initialized) {
      void renderer.init().then(
        () => renderer.dispose(),
        cause => emit('error', cause instanceof Error ? cause : new Error(String(cause))),
      )
    }
  })
  return renderer
}

// Descendant context: retain positive-size draw ownership on this r186 pair.
const PositiveSizeDraw = defineComponent({
  setup() {
    const { renderer, scene, camera } = useTresContext()
    const { render } = useLoop()
    const canvas = renderer.instance.domElement
    const host = canvas.parentElement
    if (!host) throw new Error('The scene needs a sized DOM parent.')
    let width = 0
    let height = 0
    let retired = false
    const observer = new ResizeObserver(([entry]) => {
      if (retired || !entry) return
      const boxes = entry.contentBoxSize as ResizeObserverSize[] | ResizeObserverSize | undefined
      width = 0
      height = 0
      if (Array.isArray(boxes)) {
        for (const box of boxes) {
          width += box.inlineSize
          height += box.blockSize
        }
      } else if (boxes) {
        width = boxes.inlineSize
        height = boxes.blockSize
      } else {
        width = entry.contentRect.width
        height = entry.contentRect.height
      }
      if (width > 0 && height > 0) renderer.invalidate()
    })
    render((notifySuccess) => {
      const activeCamera = camera.activeCamera.value
      const dpr = renderer.instance.getPixelRatio()
      if (
        retired || !host.isConnected || host.clientWidth <= 0 || host.clientHeight <= 0
        || width <= 0 || height <= 0 || canvas.width <= 0 || canvas.height <= 0
        || canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)
        || !activeCamera
        || (isPerspectiveCamera(activeCamera) && (!Number.isFinite(activeCamera.aspect) || activeCamera.aspect <= 0))
      ) return
      renderer.instance.render(scene.value, activeCamera)
      notifySuccess()
    })
    observer.observe(host)
    onBeforeUnmount(() => {
      retired = true
      observer.disconnect()
    })
    return () => null
  },
})
</script>

<template>
  <div>
    <button type="button" :aria-pressed="warm" @click="warm = !warm">
      {{ warm ? 'Use blue material' : 'Use orange material' }}
    </button>
    <p>Current material: {{ warm ? 'orange' : 'blue' }}. Drag to orbit; scroll to zoom.</p>
    <div class="scene" role="img" aria-label="A colored cube">
      <TresCanvas :renderer="createRenderer" render-mode="on-demand" :dpr="1"
        @error="emit('error', $event)">
        <PositiveSizeDraw />
        <TresPerspectiveCamera :position="[3, 2, 4]" :look-at="[0, 0, 0]" />
        <OrbitControls :enable-damping="false" :auto-rotate="false" />
        <TresMesh>
          <TresBoxGeometry :args="[1, 1, 1]" />
          <TresMeshBasicNodeMaterial :color-node="colorNode" />
        </TresMesh>
      </TresCanvas>
    </div>
  </div>
</template>

<style scoped>
.scene { width: 100%; height: 24rem; min-width: 0; }
</style>
```

This recipe has no autonomous animation and deliberately disables controls damping/autorotation. It does not replace a keyboard-operable camera UI where orbiting itself conveys required information. Start is a real client interaction, so the canvas module is not imported during initial SSR rendering; retain a normal Vite SSR/client entry or Nuxt client boundary as appropriate. `onErrorCaptured` catches descendant exceptions; the explicit listener handles emitted renderer failures. The positive-size gate and late-init cleanup are retained ownership precautions, **not a claim that 5.10 fixes the pinned r186 failed-init teardown or all device-loss cases**. Keep original errors observable and test real failure/unmount paths independently.

**Node-prop fix, precisely:** core 5.10 marks a NodeMaterial `needsUpdate = true` when a patched property's previous **or** next value is a TSL Node. This includes replacing/removing a node and the supported pierced-property patch path; it is not a blanket recompile for every number/color prop. The example swaps stable `color()` nodes so the graph change passes through Tres's prop patcher. Direct `material.colorNode = …` writes bypass that patcher: own `material.needsUpdate` and on-demand invalidation yourself. For fast animation keep a stable `uniform()` node and mutate its `.value`, rather than building/recompiling a graph each frame; direct uniform changes still need draw scheduling in on-demand mode. [Fix #1540](https://github.com/Tresjs/tres/pull/1540), [5.10 patch implementation](https://unpkg.com/@tresjs/core@5.10.0/dist/src-DL__Foe9.js), [Three TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language).

## Cientos 5.10: choose helpers by pipeline and lifetime

**Archived Cientos 5.10.0 snapshot.** See the [current helper guide](tresjs-webgpu.md) for new work. Cientos is optional, separately versioned convenience code, not automatically installed by Core. In this snapshot use **`@tresjs/cientos/webgpu` with the WebGPU canvas** and **`@tresjs/cientos` with an explicit WebGLRenderer pipeline**. The `/webgpu` entry does not export the entire root package. Shared helpers internally consume the shared Core context; a root-Core import inside the bundle is not itself proof of an incompatible helper.

### Controls and scene composition

| Need | Source-backed usage and ownership |
| --- | --- |
| Orbit/map interaction | Import `OrbitControls` or `MapControls`, mount below the canvas, set `target`, `minDistance`/`maxDistance`, `enablePan`/`enableZoom`/`enableRotate` deliberately. Optional `camera`/`domElement` override the active camera/canvas. `change`, `start`, `end` emit the controls instance. Both are in `/webgpu`. |
| Cinematic camera moves | `CameraControls` is the camera-controls wrapper, not OrbitControls. `makeDefault` publishes it into the shared controls ref. Obtain its exposed `instance` before calling that library's methods; do not assume OrbitControls methods/types. One owner should control a camera at a time. |
| Object editing | `TransformControls` manipulates an attached object; arbitrate with the camera control during dragging and provide DOM editing fields. Do not let two control systems fight over pointer input or camera state. |
| First-person navigation | `PointerLockControls` and `KeyboardControls` are exported in both entries. Pointer lock/audio must follow real user activation; provide visible unlock/exit and keyboard alternatives, and scope global listeners to the mounted owner. Historical 5.4 fixes matter for on-demand navigation. |
| Framing/alignment | `Bounds`, `Align`, `Fit`, `Billboard`, `ScreenSpace`, `LOD` are curated shared exports. `AbsoluteGroup` appears in release history/internal composition but is **not** a published 5.10 entry export. Framing content can move the camera; do not also animate that camera with an independent owner. Screen-space Three objects do not become accessible DOM controls. |
| DOM annotations | `Html` is a component, not permission to put arbitrary HTML directly under Tres custom nodes. Ensure its DOM overlay's focus, pointer behavior and visibility are intentional; it is not the scene's only textual alternative. |

For modern canvases use `import { OrbitControls, Bounds } from '@tresjs/cientos/webgpu'`; for a compatibility canvas the same names come from `@tresjs/cientos`. Controls expose a component `instance`, not the component proxy itself as a Three control. The orbit wrapper remounts its control when the active camera UUID changes and handles invalidation through its lifecycle helper. Keep public control prop values stable where possible; use local play guards, not stopping the entire shared loop. [Published shared types](https://unpkg.com/@tresjs/cientos@5.10.0/dist/index-Chqfwa4v.d.ts), [published controls/runtime](https://unpkg.com/@tresjs/cientos@5.10.0/dist/useStars-DmGIezjm.js).

### Models, textures, decoders, progress and animation

- **`useGLTF(path, { draco, decoderPath, traverse })`** adds computed `nodes` and `materials` maps to core's loader result. Its published return declaration lists `state`, `isLoading`, `execute`, `nodes`, `materials`, whereas runtime spreads the full loader result. Do not base a typed error UI on an undeclared Cientos `.error`; use core `useLoader<GLTF>` for an explicitly typed `error`, `progress`, `load`, decoder extensions, and late-result cleanup as in the existing loader recipe. `useFBX`/`FBXModel` are also exported; an FBX result is a `Group`, not glTF's `.scene` wrapper.
- **`GLTFModel`** is the simpler component: required `path`, optional `draco`, `decoderPath`, `castShadow`, `receiveShadow`, with exposed `instance` containing the loaded **glTF result**. It does not declare core `UseLoader`'s loaded/error slot/emits contract. Use the composable/core loader for orchestration and real DOM error reporting instead of assuming every loader component has the same events.
- The composable's runtime DRACO default is `https://www.gstatic.com/draco/versioned/decoders/1.5.6/`; the component declaration still documents `1.4.1`. Pass an explicit served decoder path for reproducible/offline deployments. `useGLTF` does not declare Meshopt/KTX2 configuration; use core `useLoader(GLTFLoader, path, { extensions })` and configure `setMeshoptDecoder`, `setDRACOLoader`, `setKTX2Loader` on the matching loader. Check the chosen KTX2Loader version's actual renderer-support detection API and run it after renderer initialization; copying a WebGL-only capability probe is not a WebGPU portability strategy.
- Decoder workers/WASM, model buffers/images and fonts are real deployable assets with CORS/base-path/license requirements. Own manually created DRACO/KTX2 loader `.dispose()` lifetimes; neither a glTF filename nor `draco: true` certifies a complete decoder deployment. The source creates a DRACOLoader inside `useGLTF` without exposing its disposal owner; choose the lower-level path when worker lifetime must be controlled.
- **`useTexture(path)`** returns core's reactive loader state, initialized with a Texture, not a ready bitmap Promise. Use `isLoading`/`error`; the initial Texture is not successful loading evidence. **`useTextures(paths)`** returns an array of computed texture refs, aggregate `isLoading`, and `error: Error[] | null`, not a name-keyed texture object. Set color space by semantic usage (albedo versus normal/roughness/data) and dispose separately owned textures only after their last consumer. `useVideoTexture` is async and can return `void`; own media playback, user-activation failures, streams and texture teardown.
- **`useProgress()`** is async and returns `hasFinishLoading`, numeric `progress`, and `items`. It observes the global loading-manager workflow, not a per-canvas shader/pixel completion guarantee; do not present its completion as proof of a displayed frame or swallow loader errors behind a finished bar.
- **`useAnimations(clips, modelRef, { manualUpdate })`** returns `actions` keyed by clip name and a **computed** `mixer`. Clips/model may arrive later, so watch for a specific action before `.reset().play()`. Default updates register with the canvas loop; they do **not** by themselves maintain an on-demand frame budget. For explicit play/pause ownership choose `manualUpdate: true`, update `mixer.value` in `useLoop().onBeforeRender` only while playing and call `invalidate()` for successive frames. Stop/uncache an owned root on teardown; a mixer is not GPU-resource disposal.

Example of the **scene-child animation wiring**, given `model` from the existing typed core glTF loader and a reactive `playing` prop controlled by accessible DOM buttons:

```ts
import { computed, onBeforeUnmount, watchEffect } from 'vue'
import { useLoop } from '@tresjs/core/webgpu'
import { useAnimations } from '@tresjs/cientos/webgpu'

const root = computed(() => model.value?.scene)
const clips = computed(() => model.value?.animations ?? [])
const { actions, mixer } = useAnimations(clips, root, { manualUpdate: true })
watchEffect(() => {
  // Select a real inspected clip name, not a promised universal "Idle".
  const name = clips.value[0]?.name
  if (name) actions[name]?.reset().play()
})
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta, invalidate }) => {
  if (!props.playing || !root.value) return
  mixer.value.update(delta)
  invalidate()
})
onBeforeUnmount(() => {
  mixer.value.stopAllAction()
  if (root.value) mixer.value.uncacheRoot(root.value)
})
```

Keep each animation owner tied to one stable loaded root; a dynamic model swap needs explicit old-mixer/action cleanup, not an assumption that rebinding a ref releases every old action. Pause guards freeze mixer time without stopping unrelated scene work. The snippet is wiring for the stated loader child, not a third self-contained host, and does not add a second glTF GPU-disposal handler. [Published loader/animation contracts](https://unpkg.com/@tresjs/cientos@5.10.0/dist/index-Chqfwa4v.d.ts), [actual loader/animation implementation](https://unpkg.com/@tresjs/cientos@5.10.0/dist/useStars-DmGIezjm.js).

### Staging, material ports and unavailable WebGPU exports

The 5.10 `/webgpu` entry supplies node-based implementations under **`Grid`, `Outline`, `Image`, `HolographicMaterial`, `MeshDiscardMaterial`, `MeshGlassMaterial`, `MeshWobbleMaterial`, `PointMaterial`, `Precipitation`, `Sparkles`, `Stars`**. Use those names from that entry, not guessed `WebGPUGrid`/`GridNodeMaterial` public exports. Shared exported `Environment`/`useEnvironment`, `Lightformer`, `CubeCamera`, and `Fbo`/`useFBO` still need per-workflow review: export availability alone does not certify every dynamic environment, offscreen target, multisampling, depth texture, or render-order option on both backends. `Fbo` declares `autoRender`, `width`, `height`, `depth`, `settings`; introducing one adds a render-target/rendering owner and must share the positive-size policy before every draw.

For an image-based environment, `Environment` accepts `preset` or explicit `files`/`path`, `background`, `environmentIntensity`/`Rotation`, and `quality: '1k' | '2k' | '4k'` for **presets only**. The `preset` takes precedence over `files`/`path`. Start with `quality="1k"`; a larger HDR is a download/VRAM decision, not a free quality toggle. A dynamic scene-capture environment is a different expensive workflow with `frames` and `resolution`. Ensure its capture/render-target lifetime and backend support instead of treating a static-HDR success as dynamic capture evidence.

**Not exported by `@tresjs/cientos/webgpu@5.10.0`:** `Stage`, `ContactShadows`, `AccumulativeShadows`, `SoftShadows`, `Sky`, `Ocean`, `Reflector`, `Refractor`, `MeshReflectionMaterial`, `MeshTransmissionMaterial`, `MeshPortalMaterial`, `CustomShaderMaterial`, `Lensflare`, `Line2`, `CatmullRomCurve3`, `CubicBezierLine`, `QuadraticBezierLine`. Importing these from `/webgpu` should fail at the module/type boundary; switching the import to root does not port their GLSL/multipass/WebGL assumptions. If the feature is essential, choose an explicit WebGLRenderer compatibility pipeline or implement a real node-based alternative with complete backend coverage.

In that **compatibility pipeline**, `Stage` composes `lighting` (`rembrandt`/`portrait`/`upfront`/`soft` or positions), `intensity`, `environment`, `adjustCamera`, `align` and `shadows` (`contact`/`accumulative` or detailed options). This is useful product staging, not just syntactic sugar for a light. Bound shadow resolution/bake frames and understand camera/environment mutation. Use `update()` after intentional late geometry/bounds changes. Version **5.9.1** fixes Stage shadow placement/prop leakage and accumulative-shadow settings/GPU leaks; older releases are not equivalent. Reflection/transmission, portal, water and custom-shader helpers remain renderer-specific work even when the root manifest permits a broad Three version. [5.10 curated exports and node props](https://unpkg.com/@tresjs/cientos@5.10.0/dist/webgpu.d.ts), [node ports/runtime](https://unpkg.com/@tresjs/cientos@5.10.0/dist/webgpu.js), [root exports](https://unpkg.com/@tresjs/cientos@5.10.0/dist/trescientos.d.ts), [staging types](https://unpkg.com/@tresjs/cientos@5.10.0/dist/index-Chqfwa4v.d.ts).

### Batching and picking performance with explicit owners

`Instances`, `Instance`, `Merged`, `useBVH` and `UseBVH` are exported in both 5.10 entries. `Instances` takes consumer-owned `geometry` and `material`, with initial `limit` (default 1000), not a permanent hard cap. Shadow flags belong to the batch. `Merged :meshes="record"` creates a batch per named mesh; descendants choose `<Instance batch="name" />`. It reuses resources rather than magically reducing all materials to one draw call.

Complete small **canvas child**, using a node material so its shared resources are suitable for the modern pipeline. Mount it instead of the single cube in the modern canvas; no additional camera/renderer is created:

```vue
<!-- BatchedBoxes.vue -->
<script setup lang="ts">
import { onUnmounted } from 'vue'
import { Instance, Instances } from '@tresjs/cientos/webgpu'
import { BoxGeometry, MeshBasicNodeMaterial } from 'three/webgpu'

const geometry = new BoxGeometry(0.4, 0.4, 0.4)
const material = new MeshBasicNodeMaterial({ color: '#2166ac' })
// The batch does not own these resources. Parent hook runs after its children retire.
onUnmounted(() => {
  geometry.dispose()
  material.dispose()
})
</script>

<template>
  <Instances :geometry="geometry" :material="material" :limit="3">
    <TresGroup :position="[-1, 0, 0]"><Instance /></TresGroup>
    <TresGroup :position="[0, 0, 0]"><Instance /></TresGroup>
    <TresGroup :position="[1, 0, 0]"><Instance /></TresGroup>
  </Instances>
</template>
```

`Instance` declares batch/color selection, not native transform attributes at its public component boundary. Use parent `TresGroup` transforms, as above, rather than undeclared `position` props or a type-check bypass.

`useBVH(target, { enabled, firstHitOnly, … })` accepts a reactive object/group; `enabled` can be reactive. It accelerates mesh ray tests, not draw calls, physics or instance resource ownership. It alters geometry/raycast behavior, so coordinate shared geometry lifetimes and final tree disposal. `firstHitOnly` intentionally changes hit collection; test near/far/layers and business selection. `Stats`/`StatsGl` are exported diagnostics, not production fallback capability checks or backend-neutral proof of GPU timings. Profile the actual initialized renderer and workload. [Batch/BVH ownership and props](https://unpkg.com/@tresjs/cientos@5.10.0/dist/index-Chqfwa4v.d.ts), [5.9 batching release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/cientos%405.9.0).

## Release-aware migration decisions

The release feed contains both package-scoped releases and older unscoped/major/prerelease tags; **nightly/alpha/RC is not stable**, and a downstream dependency-only release is not a new renderer capability. In particular, the tagged upgrade guide still says “nightly” and shows `tresjs@next`, calls the loader Nuxt `useAsyncData`, and includes stale progress/graph examples. The published v5 runtime uses VueUse `useAsyncState`; use the declarations and examples above, not those stale snippets. Stable installs use actual scoped packages with selected versions. [Stable 5.0 release](https://github.com/Tresjs/tres/releases/tag/5.0.0), [release-pinned upgrade guide](https://github.com/Tresjs/tres/blob/%40tresjs/core%405.10.0/apps/docs/content/1.getting-started/4.upgrade-guide.md).

| Release milestone | Migration lesson and focused consumer concern |
| --- | --- |
| Legacy **1.x–3.x** | Early Cientos releases introduced OrbitControls, glTF/DRACO, FBX, TransformControls, environment and animation helpers; those historical APIs are not current contracts. Core 2.4 exported compiler options, 3.1 changed constructor-args re-instancing, and 3.5/3.6 carried disposal/resize fixes. Reuse the conceptual ownership model, not an old snippet's callback names, return shape, identity or memory guarantees. |
| **4.0–4.3.6** | On-demand/manual rendering, local node state and pointer manager changed in v4; 4.2 adjusted attachment/detachment, primitive proxy identity and event registration; 4.2.8/4.2.9 corrected cube-loader array handling. 4.3 added UseLoader/provide bridging, then primitive typing/disposal fixes and type-change reverts. A v4 reproduction therefore needs its exact patch; neither its event manager nor its args/primitive behavior establishes the v5 contract. [4.0](https://github.com/Tresjs/tres/releases/tag/4.0.0), [4.2](https://github.com/Tresjs/tres/releases/tag/4.2.0), [4.3](https://github.com/Tresjs/tres/releases/tag/4.3.0), [4.3.3](https://github.com/Tresjs/tres/releases/tag/4.3.3). |
| 4.x → **5.0.0** | ESM-only; replace old loop hooks with current `useLoop`/`onBeforeRender`/`onRender`, not transitional prerelease names. `useTresContext().camera` is a manager, `useTres().camera` the active ref. Move texture helpers to Cientos, replace seek with graph lookup and old event-manager/raycaster integrations with native-name pointer events. Consume reactive loader state and establish ownership anew. v5's custom renderer support did **not** make root TresCanvas default to WebGPU. |
| Core **5.1–5.3** | Kebab-case scene elements, exported canvas props/emits/pixel ratio, primitive-prefix support; 5.3.1 reverted 5.3.0 event forwarding. 5.3.2 improved camera/renderer initialization errors and WebGPU readiness, 5.3.3 deferred ready handling for window-size scenes. Do not treat all 5.x readiness/error behavior as identical. |
| Core **5.4–5.7** | Fragment/text/comment handling fixes; 5.4.1 and 5.6 delta/clock fixes, Timer migration for newer Three and 5.7 Clock fallback for pre-r179. Measure elapsed/delta with the selected pair; old broad peers do not make timing interchangeable. Context export arrived in 5.5. |
| Core **5.8–5.8.3** | `fpsLimit`; per-canvas custom-renderer reuse/HMR listener and disposal fixes; template `UseLoader` gained extensions. Core dropped `three-stdlib` at 5.8.3; explicit addon imports are app responsibilities, not an implicitly installed helper contract. |
| Core **5.9–5.9.3** | `TresPortal`, renderer-family guard/reactive flag, math typing repair for r186; PCFShadowMap default and r186 WebGPU correction. The baseline above deliberately includes these, but still retains its observed frame-budget, pointer and initialization-teardown limits. |
| Core/Cientos **5.10.0** | Dedicated `/webgpu` entries; core node-prop graph recompilation fix. Opt into the right imports and compiler/type contract; do not assume a package version bump rewrites existing root imports or ports unavailable helpers. |
| Cientos **5.0–5.2** | Scroll/FBX and v5-integration fixes, AbsoluteGroup/ScreenSpace positioning, Html rework/camera shake, Image/color-space and material fixes. Old examples may have pre-v5 return shapes or pre-rework DOM behavior. |
| Cientos **5.4–5.7** | BVH reactive enabling/first-hit/layer/disposal fixes and UseBVH; control on-demand fixes; Timer/Holographic and Ocean lifetime changes; ContactShadows r183 fix; StatsGl DOM fix and Decal editor/targeting work. These are reasons to qualify repro versions, not reasons to enable all expensive helpers. |
| Cientos **5.8–5.9.3** | Root transmission, HDR quality tiers; Instances/Merged, portal/refractor/rounded-plane features; progress reset, particle reactivity, accumulative bake/environment fix and 5.9.1 staging/GPU-lifetime fixes. 5.9.2/5.9.3 are dependency bumps, not independent helper implementations. |

Primary history: [all releases](https://github.com/Tresjs/tres/releases), [core 5.8.1](https://github.com/Tresjs/tres/releases/tag/%40tresjs/core%405.8.1), [core 5.9.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/core%405.9.0), [Cientos 5.4.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/cientos%405.4.0), [Cientos 5.8.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/cientos%405.8.0), [Cientos 5.9.1](https://github.com/Tresjs/tres/releases/tag/%40tresjs/cientos%405.9.1), [Cientos 5.10.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/cientos%405.10.0).

## Released ecosystem: post-processing 3.11.0, Rapier 1.2.0, Leches 1.3.2

**Archived October recipes.** The dependency table and code below preserve the exact 3.11.0 / 1.2.0 / 1.3.2 fixture profile, separate from the archived 5.9.3 workbench and device receipts. For new effects use the [current effects guide](tresjs-post-processing.md); the Rapier and Leches sections open with current package guidance before their archived examples. The archived fixtures need no models, texture CDN, API key, or external service.

### Dependency and renderer boundary

| Exact archived package | Published peers | Published runtime dependencies | Renderer boundary at that version |
| --- | --- | --- | --- |
| `@tresjs/post-processing@3.11.0` | `@tresjs/core ^5.9.1`, `three >=0.169`, `vue >=3.4` | `postprocessing ^6.39.5`, `n8ao ^2.0.1`, `@vueuse/core ^15.0.0` | Both composer families require **legacy `WebGLRenderer`**. Not compatible with `WebGPURenderer`, including its WebGL2 backend. |
| `@tresjs/rapier@1.2.0` | `@tresjs/core ^5.3.2`, `three >=0.169`, `vue >=3.4.0` | `@dimforge/rapier3d-compat ^0.20.0`, `@vueuse/core ^15.0.0` | CPU/WASM physics is renderer-independent. Every visual, material, helper, and effect in the scene must still support the chosen renderer. |
| `@tresjs/leches@1.3.2` | `vue >=3.3.4` | `@unocss/core ^66.9.2`, `@vueuse/motion ^3.0.3`, `@vueuse/components ^15.0.0`, `unocss-preset-scrollbar ^4.0.0` | Vue **DOM** UI; no Three/Core peer and no renderer requirement. Place outside the Tres scene graph. Published JS also imports `@vueuse/core`, which the manifest does not declare as a runtime dependency. |

To reproduce the **archived isolated fixture**, install these exact direct dependencies in a throwaway Bun 1.4.5 project, not in a new production project or the bundled app. These are Bun reproduction instructions only: the original observations and their package-manager provenance are unchanged.

```sh
bun add --exact vue@3.5.44 three@0.186.1 @tresjs/core@5.10.0 \
  @tresjs/post-processing@3.11.0 @tresjs/rapier@1.2.0 @tresjs/leches@1.3.2
```

Do not confuse package versions: the wrapper's **3.10.0 N8AO feature** uses the `n8ao` dependency in the **2.x** range. Caret runtime dependencies are not an exact reproducibility lock; retain the fixture lockfile and resolved versions. Broad peers are not evidence that every intervening Three release or every shader works. Use a single resolved Three instance.

Primary manifests: [post-processing 3.11.0](https://registry.npmjs.org/@tresjs/post-processing/3.11.0), [Rapier 1.2.0](https://registry.npmjs.org/@tresjs/rapier/1.2.0), [Leches 1.3.2](https://registry.npmjs.org/@tresjs/leches/1.3.2).

### Post-processing: choose one complete rendering pipeline

**Archived 3.11.0 composer recipes.** The two root Vue component families use different injection keys and are not interchangeable. For 3.13.0, including its separate `/webgpu` entry, see the [current effects guide](tresjs-post-processing.md).

- **Three addons**: `EffectComposer` with `UnrealBloom`, `N8AO`, `Output`, `SMAA`, `Pixelation`, `Glitch`, or `Halftone`. The composer inserts a `RenderPass` unless `without-render-pass` is set. `render-target` accepts an externally created render target; establish its ownership explicitly.
- **pmndrs**: `EffectComposerPmndrs` with suffixed components such as `BloomPmndrs`, `N8AOPmndrs`, `DepthOfFieldPmndrs`, `OutlinePmndrs`, `FXAAPmndrs`, `ToneMappingPmndrs`, or `VignettePmndrs`. It inserts its own render pass. Each effect component creates an `EffectPass`; do not assume adjacent Vue effects are automatically fused into a single pass. Controls include `multisampling` (default `0`), `frame-buffer-type` (default half float), `depth-buffer`, `stencil-buffer`, `disable-normal-pass`, `resolution-scale`, and `auto-clear`. `@render` receives the composer, not a DOM event.

Both **3.11.0 root families** directly construct WebGL composers and install a replacement Tres render function. Neither adapts a `WebGPURenderer`, including when that renderer uses its WebGL2 fallback. The following WebGL fixture is separate from the application-owned node pipeline further below; do not mount both under one canvas.

**Minimal legacy WebGL N8AO + bloom fixture** (`App.vue`, Vue SFC compiler configured for Tres tags):

```vue
<script setup lang="ts">
import { TresCanvas, type TresRendererSetupContext } from '@tresjs/core'
import { EffectComposer, N8AO, Output, UnrealBloom } from '@tresjs/post-processing'
import { WebGLRenderer } from 'three'
import { unref } from 'vue'

const createLegacyRenderer = ({ canvas }: TresRendererSetupContext) =>
  new WebGLRenderer({ canvas: unref(canvas), antialias: true })
</script>

<template>
  <div style="width: 640px; height: 480px">
    <TresCanvas :renderer="createLegacyRenderer" clear-color="#30343b">
      <TresPerspectiveCamera :position="[4, 3, 6]" :look-at="[0, 0.5, 0]" />
      <TresMesh :position="[0, 0.5, 0]">
        <TresBoxGeometry :args="[1, 1, 1]" />
        <TresMeshBasicMaterial color="white" />
      </TresMesh>
      <TresMesh :rotation="[-Math.PI / 2, 0, 0]">
        <TresPlaneGeometry :args="[8, 8]" />
        <TresMeshBasicMaterial color="#909090" />
      </TresMesh>
      <EffectComposer without-render-pass>
        <N8AO :ao-radius="0.5" :intensity="2" :half-res="true" />
        <UnrealBloom :strength="0.4" :radius="0.2" :threshold="0.6" />
        <Output />
      </EffectComposer>
    </TresCanvas>
  </div>
</template>
```

`N8AO` renders the scene itself. **Use `without-render-pass`** here, otherwise the scene renders twice each frame and the wrapper warns. `N8AOPmndrs` instead uses `N8AOPostPass` after the pmndrs composer's existing render pass; nest it under `EffectComposerPmndrs`, not the Three composer. A corresponding pmndrs subtree is:

```vue
<EffectComposerPmndrs :multisampling="0">
  <N8AOPmndrs :ao-radius="0.5" :intensity="2" />
  <BloomPmndrs :intensity="0.4" :mipmap-blur="true" :radius="0.2"
    :luminance-threshold="0.6" />
</EffectComposerPmndrs>
```

Import all three names from `@tresjs/post-processing`; retain the same explicit legacy renderer and scene. `BloomPmndrs.radius` writes `mipmapBlurPass.radius`: enable `mipmap-blur` when that is the intended blur path. It is not the same constructor or prop contract as `UnrealBloom`.

**N8AO implementation details that matter:** the wrapper lazy-imports `n8ao`, inserts a disabled placeholder to preserve pass order while loading, and uses a generation guard so a stale async import cannot attach after replacement/unmount. Prop changes invalidate the Tres scene. The pass exposes `pass`; wait until this ref is populated before inspecting it. Supported settings include `ao-radius`, `distance-falloff`, `intensity`, `color`, sample/denoise counts, `half-res`, `depth-aware-upsampling`, `screen-space-radius`, `ao-tones`, `render-mode`, and `gamma-correction`. Omitted booleans intentionally preserve n8ao defaults (notably depth-aware upsampling); omitted gamma uses the pmndrs pass's automatic behavior, or enables gamma on the Three pass. Do not add a second color-space transform blindly. The cleanup specifically avoids disposing the composer's borrowed depth texture while disposing owned targets/materials/textures/fullscreen quads.

**Loop and lifetime:** one composer owns the canvas render callback. Do not run a second RAF, call `renderer.render()` after the composer, or mount two composers in the same canvas. The package removes effect passes and disposes composers/effects on unmount, but its composer unmount handlers do **not restore the previous render callback**. `enabled=false` merely stops its replacement callback from drawing; it does not fall back to normal scene rendering. Mount/unmount the whole canvas as a rendering session, or explicitly restore the desired rendering function when changing pipelines. Camera/composer replacement deserves a smoke receipt: general effect helpers initialize once, unlike the N8AO helper's explicit recreation watcher. Resizing must include actual nonzero canvas dimensions. Animated effects still need an advancing render loop; an isolated prop invalidation does not create continuous on-demand animation.

**Archived application-owned WebGPURenderer alternative.** This example uses Three's node pipeline instead of either 3.11.0 WebGL composer. In Three **0.186.1**, `PostProcessing` is a deprecated alias (since r183) for **`RenderPipeline`**. This app-owned pipeline predates the [current package's `/webgpu` composer](tresjs-post-processing.md); do not install both as owners of one canvas. The source-backed bloom core is:

```ts
import { RenderPipeline } from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

// renderer is an initialized WebGPURenderer; scene/camera are the active session's.
const scenePass = pass(scene, camera)
const sceneColor = scenePass.getTextureNode('output')
const bloomNode = bloom(sceneColor, 0.4, 0.2, 0.6)
const pipeline = new RenderPipeline(renderer)
pipeline.outputNode = sceneColor.add(bloomNode)
// Inside Tres's single replacement render callback:
pipeline.render()
// Notify Tres of successful rendering only after that render succeeds.
// At session teardown, dispose owned objects (not only the pipeline's material):
bloomNode.dispose()
scenePass.dispose()
pipeline.dispose()
```

For a directly mountable Tres child, put this in `NodePipeline.vue`:

```vue
<script setup lang="ts">
import { isWebGPURenderer, useTresContext } from '@tresjs/core/webgpu'
import { watchEffect } from 'vue'
import { RenderPipeline } from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

const { renderer: manager, scene, camera } = useTresContext()
watchEffect((onCleanup) => {
  const renderer = manager.instance
  const currentScene = scene.value
  const currentCamera = camera.activeCamera.value
  if (!currentScene || !currentCamera) return
  if (!isWebGPURenderer(renderer)) throw new Error('Node pipeline requires WebGPURenderer')
  const scenePass = pass(currentScene, currentCamera)
  const color = scenePass.getTextureNode('output')
  const glow = bloom(color, 0.4, 0.2, 0.6)
  const pipeline = new RenderPipeline(renderer)
  pipeline.outputNode = color.add(glow)
  manager.replaceRenderFunction((notify) => {
    pipeline.render()
    notify()
  })
  onCleanup(() => {
    manager.replaceRenderFunction((notify) => {
      const activeCamera = camera.activeCamera.value
      if (!scene.value || !activeCamera) return
      renderer.render(scene.value, activeCamera)
      notify()
    })
    glow.dispose()
    scenePass.dispose()
    pipeline.dispose()
  })
})
</script>

<template></template>
```

The node fixture's `App.vue` can use the box/plane/camera from the legacy fixture, but import `TresCanvas` from `@tresjs/core/webgpu`, import `NodePipeline` from `./NodePipeline.vue`, remove `createLegacyRenderer` and its canvas prop, and replace the entire `<EffectComposer>...</EffectComposer>` subtree with `<NodePipeline />`. For the second run, supply this **synchronous** factory to that same WebGPU canvas (Tres initializes and owns it):

```ts
import { type TresRendererSetupContext } from '@tresjs/core/webgpu'
import { WebGPURenderer } from 'three/webgpu'
import { toValue } from 'vue'

const forceWebGL2 = ({ canvas }: TresRendererSetupContext) =>
  new WebGPURenderer({ canvas: toValue(canvas), forceWebGL: true, antialias: true })
// <TresCanvas :renderer="forceWebGL2"> ...same entire scene... </TresCanvas>
```

Use the WebGPU entry's `TresCanvas` (`@tresjs/core/webgpu`) and its standard `WebGPURenderer`; run the **same whole scene** once with the WebGPU backend and once with `new WebGPURenderer({ canvas, forceWebGL: true })`. Await initialization through the renderer/session owner before rendering. Install the node pipeline as the sole Tres replacement render function, rebuild it when its scene/camera ownership changes, and restore the direct-render function before disposing the pipeline if the canvas remains mounted. `RenderPipeline.dispose()` disposes its fullscreen material, **not all nodes/targets**. The Three `PassNode` resizes its target during updates; do not invent a WebGL `EffectComposer.setSize()` bridge. This bloom alternative does not purport to reproduce N8AO; choose a renderer-compatible node AO separately if AO parity is required. Never quietly omit a failing helper/material on the second backend and call the whole scene compatible.

**Release migration lessons:** [3.0.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/post-processing%403.0.0) is the core-v5-ready cutover; do not mix old-major tutorials indiscriminately. [3.2.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/post-processing%403.2.0) adds the customizable Three composer `renderTarget`. [3.9.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/post-processing%403.9.0) adds `BloomPmndrs.radius`; [3.10.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/post-processing%403.10.0) adds the two N8AO variants. [3.11.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/post-processing%403.11.0) records a core 5.10.0 dependency update, **not** WebGPU composer support or a new effect. The intervening 3.1/3.2 patch and 3.3–3.8 releases mostly record core/tooling/Leches dependency updates; 3.2.3's release body is a core forwarding revert, not a new effects API. Preserve the older core error/renderer receipts rather than treating these trains as blanket bug-fix evidence.

Sources: [published declarations](https://unpkg.com/@tresjs/post-processing@3.11.0/dist/tres-post-processing.d.ts), [published implementation](https://unpkg.com/@tresjs/post-processing@3.11.0/dist/tres-post-processing.js), [official guide](https://post-processing.tresjs.org/), [Three r186 node bloom](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/BloomNode.js), [node pipeline ownership](https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/RenderPipeline.js), [deprecated PostProcessing name](https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/PostProcessing.js).

### Rapier: asynchronous WASM world, explicit collider contracts

**Current `@tresjs/rapier@1.4.0`.** For a compatible host, install with `bun add --exact @tresjs/rapier@1.4.0`. The [1.4.0 manifest](https://registry.npmjs.org/@tresjs/rapier/1.4.0) declares Core `^5.3.2`, Three `>=0.169`, and Vue `>=3.4.0` as peers, and `@dimforge/rapier3d-compat ^0.20.0` and `@vueuse/core ^15.0.0` as dependencies. It exposes the root entry, not `/webgpu`. CPU/WASM physics is independent of renderer choice; the scene's visuals still need renderer qualification.

The public provider is **`Physics`**, not `PhysicsWorld`. Mount it in `Suspense` **inside** the canvas, call `useRapier()` below the initialized provider, and keep loading/error DOM outside the scene. The provider imports and initializes Rapier WASM asynchronously; handle rejection at an ancestor error boundary, not in the Suspense fallback. Use a client rendering session in SSR/Nuxt.

Releases [1.2.1](https://github.com/Tresjs/tres/releases/tag/%40tresjs/rapier%401.2.1), [1.3.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/rapier%401.3.0), and [1.4.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/rapier%401.4.0) record Core updates to 5.10.1, 5.11.0, and 5.12.0 respectively, not new physics APIs or a higher peer floor. The published JS and declarations match 1.2.0 apart from their version banners. The archived fixture's limits still apply: `RigidBodyProps` omits `position` and `RigidBody`/`CuboidCollider` have empty emits declarations, so keep explicit typed application adapters. Initial solver placement reads the body's root **local** position/quaternion, not a parent transform. Event dispatch is asymmetric; do not promise mirrored events or stable source/target order. `useRapier().step()` bypasses the provider's EventQueue and drain. The provider frees neither its `World` nor its private `EventQueue` on teardown; child unregister is not proof of leak-free remounts, and children must not free the provider's world. [Release comparison](https://github.com/Tresjs/tres/compare/%40tresjs/rapier%401.2.0...%40tresjs/rapier%401.4.0), [1.4.0 declarations](https://unpkg.com/@tresjs/rapier@1.4.0/dist/tresrapier.d.ts), [published JS](https://unpkg.com/@tresjs/rapier@1.4.0/dist/tresrapier.js), [tagged provider](https://github.com/Tresjs/tres/blob/%40tresjs/rapier%401.4.0/packages/rapier/src/components/Physics.vue). This is source parity, not a new consumer receipt.

`useRapier()` / `useRapierContext()` must execute in a **descendant of an initialized `Physics`**; they throw without a ready provider. They expose refs `rapier`, `world`, `isPaused`, `isDebug`, `timeStep`, `timeScale`, plus `onBeforeStep`, `step`, `init`, and `setWorld`. Do not call `init()` again from every body, or replace the world while bodies/joints still belong to the old one. `Physics` also exposes this context through a component ref.

**Archived 1.2.0 fixture layout:** an outer component owns the canvas and async provider; a child owns bodies and controllers. The fixture uses ordinary geometry/materials so the same bodies and visuals can be exercised on both WebGPURenderer backends. Do not add WebGL-only effects to the fallback run.

`App.vue`:

```vue
<script setup lang="ts">
import { TresCanvas } from '@tresjs/core/webgpu'
import { Physics } from '@tresjs/rapier'
import PhysicsScene from './PhysicsScene.vue'
</script>

<template>
  <div style="width: 640px; height: 480px">
    <TresCanvas clear-color="#252932">
      <TresPerspectiveCamera :position="[6, 4, 8]" :look-at="[1, 1, 0]" />
      <Suspense>
        <Physics :gravity="[0, -9.81, 0]" :time-step="1 / 60">
          <PhysicsScene />
        </Physics>
      </Suspense>
    </TresCanvas>
  </div>
</template>
```

`PhysicsScene.vue`:

```vue
<script setup lang="ts">
import { h, shallowRef, type FunctionalComponent } from 'vue'
import {
  CuboidCollider, RigidBody, useRapier,
  type ExposedRigidBody, type RigidBodyProps, type SourceTarget,
} from '@tresjs/rapier'

type Pair = { source: SourceTarget; target: SourceTarget }
type Signals = {
  'collision-enter': [event: Pair]
  'intersection-enter': [event: Pair]
  'intersection-exit': [event: Pair]
}
type BodyProps = Partial<Pick<RigidBodyProps,
  'type' | 'collider' | 'activeCollision' | 'sensor' | 'restitution'>> & {
  position?: [number, number, number]
}
// Application-owned, finite boundary for runtime attrs/events missing upstream types.
const RapierBody: FunctionalComponent<BodyProps, Signals> = (props, { slots, emit }) =>
  h(RigidBody, {
    type: props.type,
    collider: props.collider,
    activeCollision: props.activeCollision,
    sensor: props.sensor,
    restitution: props.restitution,
    ...(props.position ? { position: props.position } : {}),
    onCollisionEnter: (event: Pair) => emit('collision-enter', event),
    onIntersectionEnter: (event: Pair) => emit('intersection-enter', event),
    onIntersectionExit: (event: Pair) => emit('intersection-exit', event),
  }, slots)
RapierBody.props = ['type', 'collider', 'activeCollision', 'sensor', 'restitution', 'position']
RapierBody.emits = ['collision-enter', 'intersection-enter', 'intersection-exit']
RapierBody.inheritAttrs = false

type CuboidProps = {
  args: [number, number, number]
  position?: [number, number, number]
  sensor?: boolean
  activeCollision?: boolean
}
const RapierCuboid: FunctionalComponent<CuboidProps, Signals> = (props, { slots, emit }) =>
  h(CuboidCollider, {
    args: props.args,
    ...(props.position ? { position: props.position } : {}),
    sensor: props.sensor,
    activeCollision: props.activeCollision,
    onCollisionEnter: (event: Pair) => emit('collision-enter', event),
    onIntersectionEnter: (event: Pair) => emit('intersection-enter', event),
    onIntersectionExit: (event: Pair) => emit('intersection-exit', event),
  }, slots)
RapierCuboid.props = ['args', 'position', 'sensor', 'activeCollision']
RapierCuboid.emits = ['collision-enter', 'intersection-enter', 'intersection-exit']
RapierCuboid.inheritAttrs = false

const platform = shallowRef<ExposedRigidBody>()
const { onBeforeStep } = useRapier()
let simulationTime = 0
let platformPlaced = false
onBeforeStep((dt) => {
  simulationTime += dt
  const body = platform.value?.instance
  if (!body) return
  if (!platformPlaced) {
    body.setTranslation({ x: 3, y: 0.5, z: 0 }, true)
    platformPlaced = true
  }
  body.setNextKinematicTranslation({
    x: 3 + Math.sin(simulationTime), y: 0.5, z: 0,
  })
})
function record(kind: string, event: Pair) {
  console.info(kind, event.source.context.collider.handle,
    event.target.context.collider.handle)
}
</script>

<template>
  <RapierBody type="fixed" :collider="false"
    @collision-enter="record('floor-contact', $event)">
    <RapierCuboid :args="[5, 0.5, 3]" :position="[0, -0.5, 0]" active-collision />
    <TresMesh :position="[0, -0.5, 0]">
      <TresBoxGeometry :args="[10, 1, 6]" />
      <TresMeshBasicMaterial color="#666b77" />
    </TresMesh>
  </RapierBody>
  <RapierBody type="dynamic" collider="cuboid" :position="[0, 3, 0]"
    active-collision :restitution="0.1"
    @collision-enter="record('box-contact', $event)">
    <TresMesh>
      <TresBoxGeometry :args="[1, 1, 1]" />
      <TresMeshBasicMaterial color="#82dbc5" />
    </TresMesh>
  </RapierBody>
  <RapierBody type="fixed" :collider="false" sensor active-collision
    @intersection-enter="record('sensor-enter-body', $event)"
    @intersection-exit="record('sensor-exit-body', $event)">
    <RapierCuboid :args="[1, 0.1, 1]" :position="[0, 1.5, 0]"
      sensor active-collision
      @intersection-enter="record('sensor-enter-collider', $event)"
      @intersection-exit="record('sensor-exit-collider', $event)" />
  </RapierBody>
  <RigidBody ref="platform" type="kinematic" collider="cuboid">
    <TresMesh>
      <TresBoxGeometry :args="[1, 0.25, 1]" />
      <TresMeshBasicMaterial color="#fbb03b" />
    </TresMesh>
  </RigidBody>
</template>
```

**Published declaration boundary:** the 1.2.0 `RigidBody`/`CuboidCollider` declarations have empty emits contracts, and `RigidBodyProps` omits native `position`. Direct listener/position attributes therefore fail `strictTemplates`; changing event capitalization does not fix those declarations. `RapierBody` and `RapierCuboid` above are deliberately named **application components**, not claimed package exports. Each declares a finite typed prop surface and typed Vue emits, explicitly forwards the observed runtime `onCollisionEnter` / `onIntersectionEnter` / `onIntersectionExit` handlers through `h`, and rejects unrelated fallthrough attrs. There is no cast, arbitrary attrs spread, template `v-bind` escape hatch, or disabled compiler check. The underlying Rapier helpers emit the kebab-case event names through their Vue instance; Vue resolves those to the camel-case handler keys supplied here.

The body's initial `position` is a narrowly owned runtime fallthrough attribute: published `RigidBody.vue` has one `TresGroup` root and no `inheritAttrs: false`, and body creation reads that group's **local** position/quaternion. A positioned outer `TresGroup` alone would move visuals without establishing the equivalent solver position. The adapter therefore forwards only the explicitly typed position tuple to that root; treat it as initial state, not a dynamic-body animation API. The kinematic example instead retains the package's typed exposed-body ref and places it with the official `setTranslation` method before its first target step. [Tagged rigid-body implementation](https://github.com/Tresjs/tres/blob/%40tresjs/rapier%401.2.0/packages/rapier/src/components/RigidBody.vue), [runtime collision event names](https://github.com/Tresjs/tres/blob/%40tresjs/rapier%401.2.0/packages/rapier/src/utils/collisions.ts), [runtime sensor event names](https://github.com/Tresjs/tres/blob/%40tresjs/rapier%401.2.0/packages/rapier/src/utils/intersections.ts).

**Units, transforms, shapes:**

- `RigidBody` defaults to `type="dynamic"`, auto `collider="cuboid"`. Spell them explicitly in teaching/smoke fixtures. `collider="ball"` requests a ball from the child geometry; a spherical visual is not a promise of a spherical default collider. Automatic shapes are `cuboid`, `ball`, `capsule`, `cone`, `cylinder`, `convexHull`, and `trimesh`. `collider=false` disables generation and is the right choice for custom colliders; otherwise accidental extra colliders can double contact/mass.
- `CuboidCollider.args` are **half extents**, so `[5, 0.5, 3]` matches a visual box `[10, 1, 6]`. `BallCollider` takes `[radius]`; capsule/cylinder/cone take Rapier's half-height/radius arguments. Supply exact args. The generic `Collider` has runtime default `args=[1,1,1]`, not shape-aware values inferred from every arbitrary child; helper wrappers have no independently meaningful shape-specific default args. Generic fallback-to-bounds on an error is not successful geometry validation.
- Custom collider `position` is body-relative; rotation is a quaternion tuple `[x,y,z,w]`, not a Tres Euler rotation. Keep the initial body transform on `RigidBody`, local mesh/collider offsets on children, and use matching geometry dimensions. Auto generation initially inspects supported direct children; asynchronously inserted geometry needs its own lifecycle/remount decision rather than an assumed reactive scene rescan. Remount on geometry topology changes unless the exact collider update has been validated.
- Extended custom exports cover ball/capsule/cone/cuboid/cylinder, convex hull/mesh, polyline/trimesh/heightfield, and rounded variants. Consult the actual Rapier constructor signature for typed vertex/index buffers, heightfield scale, and round radius. Prefer simple convex primitives for moving bodies; a render mesh and a physically suitable mesh are different assets.
- Dynamic bodies own their displayed group transforms once simulation starts. Do not animate a dynamic group's Three `position` every render and expect the solver to follow. For a teleport, call the exposed Rapier body's `setTranslation(vector, true)` and set rotation/velocities intentionally. Position-based `type="kinematic"` uses `setNextKinematicTranslation` / `setNextKinematicRotation` before solver steps, as above; `kinematicVelocity` uses explicit Rapier velocities. A fixed body is not a kinematic body. Avoid treating nested transformed/scaled Three parents as an unvalidated coordinate conversion layer.

**Simulation time and events:** numeric `time-step` defaults to **1/60 s**, with a fixed-step accumulator since 1.0.0. The solver can run several substeps per render; `time-step="vary"` instead uses one clamped render delta. The scaled frame delta is clamped to **0.5 s**; `time-scale<=0` skips stepping and `pause` freezes simulation. Put forces, vehicle updates, and kinematic targets in `onBeforeStep(dt)`, not in a display-refresh-dependent interval. The callback unregisters with its Vue scope and also returns a manual unregister function. Changing `time-step` resets the accumulator. No render interpolation is implemented by the provider: rigid-body groups copy the latest solver pose in `onBeforeRender`. Use an advancing Tres loop for ongoing physics; on-demand rendering does not itself schedule physics forever.

Set `active-collision` to request Rapier collision events; a sensor additionally needs `sensor` and does not physically block other bodies. `collision-enter`, `collision-exit`, `intersection-enter`, and `intersection-exit` carry `{ source, target }`, each containing `objects: [rigidBodyObject, colliderObject]` and `context: { collider, rigidBody }`. `active-contact-force` plus `contact-force-event-threshold` enables `contact-force`, whose payload adds total/max force vectors and magnitudes. `collision-groups` determines eligible pairs; `solver-groups` governs solving, not the same filter. Active collision types are another separate Rapier setting. The sensor in the fixture uses a dynamic-versus-fixed pair; do not expect all fixed-versus-fixed pairs to report with default active types.

**Published 1.2.0 event limitation:** the provider calls `collisionTrigger(source1, source2)` only, and calls `emitIntersection(source2, source1, ...)` only. It does not symmetrically dispatch both orderings. The intersection helper separately examines the source body's sensor flag and the target collider's sensor flag. Consequently, do not assert mirrored delivery, stable source/target orientation, or a guaranteed body-only sensor callback. The fixture registers both contact bodies and both sensor body/collider listeners to observe the real dispatch, and should record handles rather than assuming order. The exposed context's `step(dt)` calls `world.step()` **without the provider's EventQueue/drain path**; it is not an equivalent event-emitting replacement for the provider loop. Do not combine manual stepping with an unpaused provider.

**Resource/session ownership:** the provider creates the world; bodies remove their own rigid bodies on unmount, colliders remove valid own colliders and unregister from the body, and joints remove owned impulse joints. `InstancedRigidBody` exposes per-instance contexts and removes its bodies; use it for instanced visuals, not a promise of free solver cost. Joint components (`FixedJoint`, `RevoluteJoint`, `SphericalJoint`, `PrismaticJoint`, `RopeJoint`, `SpringJoint`, `GenericJoint`/`BaseJoint`) accept resolved body instances and Rapier joint params; wait for body refs before connecting them.

The **published provider has no `World.free()` or `EventQueue.free()` teardown**, and does not expose its private EventQueue. Do not claim WASM allocations are completely reclaimed just because Three meshes disappear. For repeated mount/unmount sessions, capture memory receipts and address the provider boundary; freeing a world before child bodies/colliders/joints unregister is unsafe, and a child-only world cleanup cannot free the private queue. A custom externally owned low-level Rapier world/queue needs its own `free()` after its loop and children are stopped. The static minimal fixture is not a demonstrated leak-free remount solution.

**Release migration lessons:** [1.0.0-alpha.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/rapier%401.0.0-alpha.0) was explicitly unstable; use stable exact versions rather than preserving alpha assumptions. [1.0.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/rapier%401.0.0) adds frame-rate-independent stepping, full collider shapes, force/group support and fixes collision/args resolution, intersection source objects, reactive custom/automatic collider props, and v5 integration. [1.1.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/rapier%401.1.0) fixes gravity leaking across worlds by copying the default gravity object and supports the CLI physics-generation workflow. [1.1.3](https://github.com/Tresjs/tres/releases/tag/%40tresjs/rapier%401.1.3) fixes custom collider positioning relative to its body and visible debug lines. [1.2.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/rapier%401.2.0) records a core 5.10.0 dependency update, not a renamed provider, new solver feature, or complete resource cleanup fix. Other 1.1.x patches are dependency updates.

Sources: [published declarations](https://unpkg.com/@tresjs/rapier@1.2.0/dist/tresrapier.d.ts), [published implementation](https://unpkg.com/@tresjs/rapier@1.2.0/dist/tresrapier.js), [tagged Physics provider](https://github.com/Tresjs/tres/blob/%40tresjs/rapier%401.2.0/packages/rapier/src/components/Physics.vue), [official API guide](https://rapier.tresjs.org/), [Rapier collider semantics](https://rapier.rs/docs/user_guides/javascript/colliders/).

### Leches: reactive DOM controls, not a Tres scene component

**Current `@tresjs/leches@1.3.3`.** Mount the development panel in ordinary DOM, not in the Tres scene. It needs Vue `>=3.3.4`, not Three or Core. Omit `@tresjs/leches/styles`: the manifest exports that path, but the published package has no CSS file there. The root JS injects CSS and imports `@vueuse/core`, which Leches lists only as a development dependency. Install `@vueuse/core@^15.0.0` directly in the consuming app; do not rely on hoisting or another Tres package. [1.3.3 manifest](https://registry.npmjs.org/@tresjs/leches/1.3.3), [package inventory](https://unpkg.com/@tresjs/leches@1.3.3/?meta), [published JS](https://unpkg.com/@tresjs/leches@1.3.3/dist/tresleches.js).

```sh
bun add --exact @tresjs/leches@1.3.3
bun add '@vueuse/core@^15.0.0'
```

In setup, import `{ TresLeches, useControls }` from `@tresjs/leches` and register `const { size } = useControls({ size: 1 }, { uuid: 'scene-controls' })`. Render `<TresLeches uuid="scene-controls" :float="false" />` beside the canvas; read `size.value` in script. The root exports only `TresLeches`, `useControls`, and `useControlsProvider`, not the internal `dispose`.

In **1.3.3**, a collapsed floating panel keeps computed dimensions of **36 × 36 px**, including on viewport resize; reopening restores expanded dimensions. `useResizeObserver` tracks slot height, including child margins via the `flow-root` wrapper. Recalculation uses that measured height as the slot or controls change, subject to viewport and max-height limits. These are source-confirmed changes, not new animation or layout receipts. [1.3.3 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/leches%401.3.3), [tagged panel](https://github.com/Tresjs/tres/blob/%40tresjs/leches%401.3.3/packages/leches/src/components/TresLeches.vue).

`useControls({...})` registers controls in a shared UUID store and returns the **value refs themselves**. Use `size` in a template; do not copy a nonreactive primitive or add a second `.value` based on an outdated example. Passing an existing Vue ref (or a config's `value: ref`) binds that same ref. A plain initial value becomes a new ref; a plain variable supplied once is not kept in sync.

**CSS packaging trap in 1.3.2:** the official guide documents `import '@tresjs/leches/styles'`, and the manifest exports it to `dist/tresleches.css`, but the exact published tarball contains **no such CSS file**. Its `dist/tresleches.js` injects the stylesheet in a guarded `document.createElement('style')` at module evaluation. Therefore the executable **1.3.2 fixture below deliberately does not import `/styles`**; adding that guide import is a resolver-negative fixture, not required setup. Do not invent a local empty stylesheet or claim that failed import is a working recipe. If CSP disallows inline styles, account for this injection and nonce/style policy explicitly; simply deleting the CSS import does not solve CSP.

**Archived 1.3.2 scene and DOM controls fixture** (`App.vue`):

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { TresCanvas } from '@tresjs/core/webgpu'
import { TresLeches, useControls } from '@tresjs/leches'

const boundScale = ref(1)
const { size, color, visible, position, label, mode } = useControls({
  size: { type: 'range', value: boundScale, min: 0.25, max: 2, step: 0.05 },
  color: { type: 'color', value: '#82dbc5' },
  visible: true,
  position: { type: 'vector', value: [0, 0, 0], min: -2, max: 2, step: 0.1 },
  label: 'Box',
  mode: { type: 'select', value: 'solid', options: ['solid', 'wire'] },
}, { uuid: 'scene-controls' })
</script>

<template>
  <main style="display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 12px">
    <div style="height: 480px; min-width: 0">
      <TresCanvas clear-color="#252932">
        <TresPerspectiveCamera :position="[3, 2, 5]" :look-at="[0, 0, 0]" />
        <TresMesh :scale="size" :position="position" :visible="visible">
          <TresBoxGeometry />
          <TresMeshBasicMaterial :color="color" :wireframe="mode === 'wire'" />
        </TresMesh>
      </TresCanvas>
      <output>{{ label }} — scale {{ size.toFixed(2) }}</output>
    </div>
    <aside aria-label="Scene controls" style="min-width: 0; max-height: 520px; overflow: auto">
      <TresLeches uuid="scene-controls" :float="false" />
    </aside>
  </main>
</template>
```

For a narrow host, make the parent grid one column rather than allowing the panel to obscure the scene. This panel is ordinary DOM: do not insert it as a child of the Tres scene, and do not use its overlay's screen rectangle as canvas picking coordinates. Its default `float=true` creates an absolute, draggable panel; `float=false` makes embedding/layout ownership explicit. `collapsed` supplies initial state; the component manages its own local collapsed state rather than promising a two-way `v-model:collapsed` event. The exposed `controls` is a computed record; there is no declared panel-level `change`/`update:modelValue` API. Observe the returned refs with Vue `watch` when application side effects are needed.

**Control contracts:** primitive booleans/numbers/text/hex colors are inferred; explicit `type` is safer when intent is not obvious. A config can specify `value`, `label`, `visible`, `icon`, and appropriate type options. Number/range controls accept `min`, `max`, `step`, and a display `format(value)` function; vector controls support those same numeric options. Number/range text entry and dragging are separate UI paths; text changes commit on the relevant input's change/blur/keyboard handling. Dragging uses horizontal movement, optional Pointer Lock, Shift/Alt modifiers, and clamps numeric values. This is a GUI bound, not a security/physics validation boundary: assigning an out-of-range ref in application code is not guaranteed to be rejected. Text control changes commit on `change`, not every keystroke. Select options may be strings or `{ text, value }` records; the declarations additionally name an `alias` field, but the implementation requires text/value and does not need an alias for selection. Button configuration is a value object with `onClick`/`variant`; graph `onUpdate` receives sample history, **not** a universal callback for every ordinary value edit. `useControls('fpsgraph')` is a monitor, not a promise of GPU frame time.

**Folders and store lifetime:** `useControls('Scene', { size: 1 }, { uuid: 'x' })` returns a ref keyed **`SceneSize`**, not `size`, because folder names prefix and capitalize keys. Label and stored identity are different things. In 1.3.1 the key sanitizer strips emoji/variation selectors/disallowed symbols; despite the release shorthand, the actual regex retains Unicode letters/numbers/marks, so do not assume every non-ASCII letter disappears. Two controls with the same resulting key in one UUID overwrite that store entry; folders differing only in stripped symbols can collide. Prefer stable ASCII folder identities and explicit labels, and avoid treating generated keys as durable database IDs.

A UUID isolates the registry used by `useControls` and `<TresLeches uuid="...">`; both must match. Creating controls does **not** automatically remove just those controls when their calling component unmounts. The panel's unmount handler deletes **all entries for its UUID**. Consequently use one panel owner per UUID, do not share an unrelated application's default store casually, and coordinate parent/child registration with that lifetime. Removing one of two panels that share a UUID clears the other panel's registry. The module internally has a `dispose` function, but it is **not a public root export in 1.3.2**; do not recommend `import { dispose } from '@tresjs/leches'` as an available cleanup API.

**DOM/browser limits:** search filters by folder/control labels/keys/names; Escape clears/closes it. “Copy controls as JSON” uses `navigator.clipboard.writeText`, requires a secure/permission-allowed browser context, and explicitly excludes button/graph/fpsgraph controls. It serializes values, not a complete restorable executable GUI schema. Copying is an explicit user action; do not accidentally include secrets in development controls. The panel reads viewport dimensions, attaches DOM interactions/animations, and can use pointer lock; keep it client-owned in SSR integrations and distinguish display-value SSR fixes from proof of full server-side interaction. Test keyboard focus, readable light/dark contrast, overflow and canvas reachability at the actual host bounds.

**Release migration lessons:** [1.1.3](https://github.com/Tresjs/tres/releases/tag/%40tresjs/leches%401.1.3) and [1.1.4](https://github.com/Tresjs/tres/releases/tag/%40tresjs/leches%401.1.4) fix shared-store SSR reactivity, Nuxt parent/child behavior and control value display; they are not permission to access DOM at SSR setup. [1.2.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/leches%401.2.0) rewrites number/vector editing, adds formatting, range/color enhancements, compact CSS-variable layout, pointer-lock dragging and body-portaled guides, and fixes mixed parent/child folders/reactive panel access. [1.2.1](https://github.com/Tresjs/tres/releases/tag/%40tresjs/leches%401.2.1) preserves textfield values and adds PgUp/PgDn handling. [1.3.0](https://github.com/Tresjs/tres/releases/tag/%40tresjs/leches%401.3.0) adds search and JSON copy plus dark-mode/documentation fixes; [1.3.1](https://github.com/Tresjs/tres/releases/tag/%40tresjs/leches%401.3.1) sanitizes folder key prefixes; [1.3.2](https://github.com/Tresjs/tres/releases/tag/%40tresjs/leches%401.3.2) improves dark-mode contrast in folders/inputs. Earlier 1.1.0/1.1.1/1.1.2 updates are tooling/build metadata changes, not a different controls binding model.

Sources: [official getting started (compare CSS guidance to tarball)](https://tresleches.tresjs.org/guide/getting-started), [published control declarations](https://unpkg.com/@tresjs/leches@1.3.2/dist/composables/useControls.d.ts), [published panel declaration](https://unpkg.com/@tresjs/leches@1.3.2/dist/components/TresLeches.vue.d.ts), [published implementation/CSS injection/store ownership](https://unpkg.com/@tresjs/leches@1.3.2/dist/tresleches.js), [tagged package entry](https://github.com/Tresjs/tres/blob/%40tresjs/leches%401.3.2/packages/leches/src/index.ts).

### Source-backed smoke acceptance (recipes, not execution receipts)

To reproduce the **archived ecosystem profile above**, use a disposable Vue/Vite host with `@vitejs/plugin-vue` and Tres's `templateCompilerOptions` in `vue({ template: templateCompilerOptions })`; resolve it from `@tresjs/core`. Serve the selected fixture with `bun --bun vite --host 127.0.0.1 --port 4191`. Do not run these installs/checks against the bundled pinned app. This Bun procedure does not restate historical execution or establish results for the November packages.

1. **Legacy composer:** run the exact WebGL SFC. Wait for lazy N8AO `pass` readiness. Assert exactly one N8AO scene-rendering pass, no extra `RenderPass` with `without-render-pass`, visible contact AO/bloom, nonzero resize behavior and no duplicate-render warning. Test the pmndrs subtree separately with its own imports/injection family. Change AO intensity and confirm its pass configuration changes; confirm `BloomPmndrs.radius` with mipmap blur. Negative cases: deliberate WebGPURenderer use must be classified incompatible; `enabled=false` is not accepted as bypass-to-normal-render behavior.
2. **Node pipeline:** wrap the provided RenderPipeline core in a child using `useTresContext` and `renderer.replaceRenderFunction(notify => { pipeline.render(); notify() })`, with scene/camera ready and the callback installed once per session. Use the same scene and compatible materials for WebGPU and forced-WebGL2 WebGPURenderer runs; record actual backend separately from the `isWebGPU` renderer-class flag. Confirm both produce a scene plus bloom, resize and session cleanup. Do not include any legacy composer components in this fixture.
3. **Physics:** run the two SFCs after WASM readiness on both WebGPURenderer backend paths. Observe the box fall from body y=3 and settle with center near y=0.5 (floor top y=0), cross the y=1.5 sensor without resting on it, and the amber platform move near x=3 according to solver time. Capture contact and sensor enter/exit payload handles without assuming mirrored event ordering. Add `debug` as a separate helper-compatibility receipt rather than an untested baseline assertion. Toggle `pause`, then `time-scale=0.5`; compare simulated travel to solver time rather than rendered frame count. Add a second world with different gravity to cover the historical gravity-copy regression. Check translated custom-collider alignment for the 1.1.3 regression. Repeated unmount is a **WASM ownership investigation**; the source does not warrant leak-free acceptance.
4. **Leches:** run the SFC **without `/styles`**. Confirm panel CSS is present via injected style, size edits change `boundScale` and rendered scale, booleans toggle visibility, color/vector/select bind, and text commits after change/blur. Inspect normal and dark modes, use numeric keyboard/drag bounds, search controls/folders and clear with Escape; copy JSON only in a clipboard-capable secure context and verify transient monitors/buttons are excluded. At narrow bounds the panel must not cover or resize the canvas unpredictably. Mount two different UUID panels to verify isolation; separately record the documented same-UUID teardown hazard. An explicit `import '@tresjs/leches/styles'` should be treated as a packaging-negative fixture against this exact tarball, never as a hidden required step for the positive fixture.

## Released tooling: CLI 0.1.1 and ESLint config 1.7.0

The generator is an **optional local development tool**, not a runtime plugin, renderer port, hosted service, or a reason to change a host's runtime dependencies. CLI **0.1.1** only updates its development ESLint-config dependency; the substantive generator features shipped in **0.1.0**. [CLI 0.1.0 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/cli%400.1.0), [CLI 0.1.1 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/cli%400.1.1).

### CLI setup and its actual command surface

`@tresjs/cli@0.1.1` exports the **`tres`** executable and is ESM. Use Bun 1.4.5 with the exact locally installed CLI: `--bun` overrides the executable's Node shebang and `--no-install` prevents fetching a different tool. Upstream Node requirements still matter for Node users: the CLI manifest says Node `>=20`, but Commander 15 requires **Node >=22.12.0**. Native `sharp` binaries/libvips matter when transforming textures; a successful parse does not verify native transform support. The published CLI has only `gltf <input>` and the registry smoke command `banana` (`-c, --count <n>`, default 1), plus Commander help/version. It is **not** the separate project scaffolder: do not invent `tres init`, `create`, `add`, `--renderer`, `--webgpu`, `--typescript`, `--draco` or `--telemetry` flags. [Manifest](https://registry.npmjs.org/@tresjs/cli/0.1.1), [Commander requirement](https://registry.npmjs.org/commander/15.0.0), [published command registration](https://unpkg.com/@tresjs/cli@0.1.1/dist/index.mjs).

The [CLI manifest](https://registry.npmjs.org/@tresjs/cli/0.1.1) depends on `three: ^0.186.0`, which excludes the workbench's r187. Keep it a generation-only tool; do not force it to share the application's r187 resolution or import it into the browser bundle.

```sh
bun add -D --exact @tresjs/cli@0.1.1
bunx --bun --no-install tres gltf public/models/robot.glb --dry-run
bunx --bun --no-install tres gltf public/models/robot.glb --json
bunx --bun --no-install tres gltf public/models/robot.glb -o src/models/Robot.gen.vue --url /models/robot.glb --slots all
```

The input is a **filesystem** `.glb`/`.gltf` path, not its browser URL. A `.gltf` may read local `.bin`/texture sidecars relative to the file. The implementation configures Three's GLTFLoader and locally resolved Draco decoder, with a minimal Node DOM/worker shim; this is not a browser render or full extension-compatibility validator. In particular it does not configure a KTX2Loader or MeshoptDecoder for the parse stage. Keep original model/sidecar provenance and inspect warnings about sanitized/colliding names. The Node loader turns sidecar file reads into data URIs; remote URL sidecars are not a supported remote-fetch contract. [Published GLTF pipeline](https://unpkg.com/@tresjs/cli@0.1.1/dist/gltf-CJjeqsAN.mjs).

| Options in 0.1.1 | Exact role and defaults |
| --- | --- |
| `-o, --output <path>` | `.vue` filename or destination directory. Default is `<PascalModel>.gen.vue`; for input under `public/`, chooses project `src/models`, then `app/models`, then `models`, rather than a scanned components directory. Outside `public/`, next to input. |
| `-u, --url <url>` | Runtime model URL; inferred relative to nearest `public/`, otherwise guessed as `/basename` with a warning. Does not copy or upload assets. |
| `-a, --animations <path>` | Repeatable separate clip files. Matching/bound clips are merged; later same-named clips override earlier/model clips at runtime. Their runtime URLs are separately inferred; this flag has no per-clip URL override. |
| `-s, --slots <mode>` | `named` (default), `all`, `none`; regenerate fallback markup and keep parent slot overrides outside generated files. Exporter-named nodes may yield no `named` slots; warnings explain using `all`. |
| `--shadows`; `-K, --keepgroups`; `-k, --keepnames` | Emit mesh cast/receive-shadow props; retain pass-through groups; retain node names. Animated target names are preserved for binding even without `--keepnames`. |
| `-r, --root <name>`; `-p, --precision <digits>`; `-m, --meta` | Select subtree (missing name errors), transform fractional digits (default 2), glTF extras as `user-data`. No invented scene/animation selector. |
| `-c, --console`; `-f, --force`; `-v, --verbose` | Print SFC instead of writing; permit replacing non-generated SFCs; show all slot/clip names rather than the preview cap. |
| `-T, --transform` | Optimize to sibling `<input>-transformed.glb`; generated loader points at it. Original input is read-only. |
| `-i, --instance`; `-I, --instanceall` | Batch shared geometry/material meshes, or every eligible mesh including singleton batches. Both imply transform and force mesh preservation. |
| `-P, --physics <engine>` | Only `rapier`; generate bodies/colliders from authored node-name suffixes. Does not install Rapier or create its world. |
| `--resolution <px>`; `--format <fmt>` | Transform texture limit (default 1024) and encoder format (`webp` default; `jpeg`, `png`, `avif` also accepted). |
| `--simplify`; `--ratio <n>`; `--error <n>` | Meshoptimizer geometry simplification; fraction bounds 0–1 for ratio/error. Source defaults are ratio 0 and error 0.001 when simplification is enabled without overrides; choose an intentional ratio instead of relying on that aggressive default. |
| `--keepmeshes`; `--keepmaterials` | Disable mesh joining / material palette batching in transform. They do not disable all optimization steps. |
| `--dry-run`; `--json` | Parse and report / full intermediate representation to stdout, without emission **or transform**, even when transform/instance flags are present. JSON branch wins if both are supplied. |

Decorative UI/progress/warnings go to **stderr**; `--json`/`--console` payloads go to **stdout**. `--console --instance` prints **two SFC payloads** separated by an HTML filename comment, not one importable Vue file. Do not redirect that combined stream into a single `.vue` and expect it to compile. Normal file generation protects an existing non-generated component/provider unless `--force`; generated-marker files can be regenerated. The transformed asset write occurs earlier and is **not covered by that SFC overwrite guard**. With `--console --transform`, optimization is temporary and cleaned up: the emitted URL still names the intended sibling transformed asset, which the console run does not deploy. Do not treat stdout mode as an asset publisher.

The transform pipeline is dedup → optional material palette → flatten → dequantize → optional mesh join → weld → optional simplify → resample → prune → sparse → texture compression → **Draco**. This is lossy/structural asset processing, not a semantics-preserving minifier. Inspect animated hierarchy, material boundaries, alpha/texture quality, collider naming and output size; keep authored sources. It does not automatically copy textures/models into the host, configure its deployment base, set loader decoder URLs or guarantee renderer compatibility.

### Generated SFC contracts: consume, do not hand-edit

A generated model imports **`useGLTF` from `@tresjs/cientos`**, Vue utilities and asset-specific Three types; animation output adds `useAnimations`. The batch provider imports `Merged` and `useGLTF` from the same root entry. Use Core/Cientos **5.12.0** with Vue **`>=3.5.17`** and the [current guide's Three pair and compiler setup](tresjs-webgpu.md) for a new consumer. The emitter has **no renderer-selection flag**. In a WebGPURenderer app, own any adaptation of generated imports/materials/helpers to compatible `/webgpu` contracts. Nuxt's `tres.renderer` selects **auto-imports**; it cannot rewrite these explicit imports. Type imports from `three` do not select a renderer; runtime GLSL materials and renderer-specific helpers can constrain the pipeline. [Cientos 5.12.0 manifest](https://registry.npmjs.org/@tresjs/cientos/5.12.0), [tagged model emitter](https://github.com/Tresjs/tres/blob/%40tresjs/cli%400.1.1/packages/cli/src/emit/sfc.ts), [tagged provider emitter](https://github.com/Tresjs/tres/blob/%40tresjs/cli%400.1.1/packages/cli/src/emit/instances.ts).

The emitter produces a single `TresGroup` root but does not declare public transform props on the generated Vue component. A transform on `<Robot>` relies on Vue attribute fallthrough, not a typed generator API. For visual placement, put transforms on a native parent `TresGroup`:

```vue
<script setup lang="ts">
import Robot from './models/Robot.gen.vue'
</script>

<template>
  <!-- Inside an existing TresCanvas scene, not a second application/root canvas. -->
  <TresGroup :position="[3, 0, 0]">
    <Robot />
  </TresGroup>
</template>
```

The generated **`ready` event** exposes `{ nodes, materials }`, plus `actions` for animated models. `defineExpose` provides those handles and **`isReady`**; the event is edge-triggered and `isReady` is the replayable state. Its watcher uses post-flush timing, waits for main and bound clip loads (and actions for animated output), and resets false when readiness stops holding. `ready` means the component's graph/load criteria, **not** completion of GPU compilation, renderer initialization or a rendered frame. Start an action by its real generated `ActionName` when ready; do not assume clips autoplay or invent `play`/`pause` component props. Separate clip files must match the rendered rig's node names/tracks; unmatched sources are not emitted, and a source with no bound tracks is not retargeted magically.

The generator does **not** expose loader `error` or `execute()` on its component ref and does not emit an error event. Its readiness flag is not a full load/error UI. A production consumer must provide an actual owned loading/error boundary or an application-owned loader wrapper rather than treating `@ready` as a rejection handler. Keep generated output mechanical: customize named slots from a handwritten parent, or intentionally take ownership of the generated code if changing imports/loading semantics and stop overwriting those changes on regeneration.

Generated roots use **`:dispose="null"`** because geometries/materials are shared from the loaded graph. Removing the SFC is not a promise that every referenced GPU asset/cache entry was released. Define the cache owner, eviction point and final-user disposal policy; never dispose shared materials while another model still renders them. Animation mixers/actions and manual cloned objects have their own cleanup contract. Resource lifetime matters on navigation, account switch and repeated previews, not just initial render.

`--instance` emits **`Robot.gen.vue` and `Robot.instances.gen.vue`**. The provider owns the load, `Merged` batches and typed injection context. Import both files explicitly and put model children **inside** `<RobotInstances>`; models outside it throw. Use a native parent `TresGroup` for root placement inside that provider, but this does not fix undeclared transforms inside generated batch files. Provider `limit` defaults to 100 as initial per-batch allocation, not a fixed population cap. Skinned meshes and morph-target meshes remain unbatched. A batched override slot receives the real **`batch`** key; use the compatible `Instance` helper with that key instead of a second full geometry draw. Retained unbatched primitives can have shared-object/reparenting restrictions; inspect generator warnings before rendering multiple copies.

`--physics rapier` emits `RigidBody` imports only where authored suffixes produce valid bodies. `-col` means fixed/trimesh, `-colonly` adds hidden rendering, `-convcol` means fixed/convexHull, `-convcolonly` hides it, `-rigid` means dynamic/convexHull, `-rb-fixed`/`-rb-dynamic`/`-rb-kinematic`/`-rb-kinematicvelocity` choose body type; `-sensor` can generate a hidden fixed convex sensor. Optional shape suffixes include cuboid/ball/capsule/cone/cylinder/hull/trimesh. Names are case-insensitive and support `-`, `_`, `$` separators and common duplicate counters. A typo, group without geometry, nested bodies or transformed ancestors produces diagnostic warnings, not a repaired physics scene. The host owns **one `<Physics>` world** from `@tresjs/rapier`; generated bodies outside it do not simulate. Batched bodies use invisible geometry proxies for collider derivation, not duplicate visual draws. Evaluate the physics shape/body choice rather than inferring artist intent from a suffix.

Install `@tresjs/rapier@1.4.0` explicitly for a new physics consumer. The [tagged physics emitter](https://github.com/Tresjs/tres/blob/%40tresjs/cli%400.1.1/packages/cli/src/emit/physics.ts) uses its root import, moves position and rotation to the body, and keeps scale on the mesh. The host owns asset serving, the provider, and cleanup. Use [Rapier's body placement contract](#rapier-asynchronous-wasm-world-explicit-collider-contracts), not the visual parent-group transform above, to initialize solver position.

**Observed generated-batch type boundary:** CLI **0.1.1** emits `Instance :position` in its `--instance` consumer, but Cientos **5.10.0** does not declare that native attribute on `Instance`. A separate strict-template consumer of the generated panel variants rejected that batch file with `TS2353`; CLI exit zero is not a clean compiler result. Keep plain generated models and the explicitly authored, positioned-group batching pattern above as separate accepted paths until this generator/declaration mismatch is resolved. Do not hide it with a cast, loose template checking, or a renderer switch: the declaration mismatch affects both backends.

**Current source review:** Cientos **5.12.0** still declares only `batch`, `name`, and `color` on `InstanceProps`, not transforms. Its `/webgpu` entry exports the same implementation; Core's native-element types do not add props to this Vue component. The CLI's tagged assertions expect translated `Instance` output, but its compile tests check Vue parsing and script/template compilation, not strict consumer template types. The `TS2353` above is the archived **5.10.0** result, not a rerun on 5.12.0. For a new strict host, use plain output or [manual batching with positioned groups](#batching-and-picking-performance-with-explicit-owners); check generated files separately from parent placement. [5.12.0 declarations](https://unpkg.com/@tresjs/cientos@5.12.0/dist/index-LpMDuY3m.d.ts), [tagged `/webgpu` entry](https://github.com/Tresjs/tres/blob/%40tresjs/cientos%405.12.0/packages/cientos/src/webgpu.ts), [CLI batch assertions](https://github.com/Tresjs/tres/blob/%40tresjs/cli%400.1.1/packages/cli/src/emit/instances.test.ts), [CLI compile checks](https://github.com/Tresjs/tres/blob/%40tresjs/cli%400.1.1/packages/cli/src/emit/compiles.test.ts).

### Lint authored Vue and Tres code with Biome

Follow [Biome linting](setup-tooling.md#biome-linting) for the kit's pinned lint configuration and repository-wide `bun run lint` gate. With the root dependencies installed, run this strict, read-only check from the repository root to scope feedback to authored Tres scene code:

```sh
bunx --bun --no-install biome lint --error-on-warnings skills/vue-kit/assets/example-app/src/graphics
```

Keep Vue type checking and renderer/browser checks separate. Lint does not validate catalogue registration, asset loading, disposal, physics, shader compatibility, backend parity, or accessibility at runtime.

### Tres ESLint config release history (not recommended)

Optional upstream `@tresjs/eslint-config@1.7.0` aligns versions without code changes. It was published as an Antfu-based flat style config, not a plugin exposing `tres/*` rules. Its exact named exports are **`tresLintConfig`** (an async flat-config composer) and **`nuxt`** (additional rule items, not a module or standalone parser/plugin preset). It has no default export, `configs.recommended`, `createConfig`, or legacy string `extends`; the CJS entry wraps ESM Antfu via `require`, so older Node interop is not assured. The package's ESLint `>=8.40.0` peer understates the effective constraints: Antfu `~9.5.1` expects `^9.10.0 || ^10.0.0`, and Unicorn 74 requires ESLint `>=10.4` and Node `>=22`. The Nuxt rules disable `no-undef` broadly and do not generate import types or validate hydration. These are release facts, not kit setup instructions; unrelated external ESLint policies remain host-owned. [Release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/eslint-config%401.7.0), [manifest](https://registry.npmjs.org/@tresjs/eslint-config/1.7.0), [published types](https://unpkg.com/@tresjs/eslint-config@1.7.0/dist/index.d.mts), [Antfu metadata](https://registry.npmjs.org/@antfu/eslint-config/9.5.1), [Unicorn metadata](https://registry.npmjs.org/eslint-plugin-unicorn/74.0.0).

### Source-backed tooling smoke fixtures (not execution receipts)

Use a **throwaway profile**, not the bundled pinned app. The following `make-model.mjs` creates a local, texture-free glTF with two shared triangle meshes and one `Lift` translation clip; no downloaded model, credential or network asset is needed:

```js
import { mkdir, writeFile } from 'node:fs/promises'

const data = Buffer.alloc(76)
const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0]
positions.forEach((value, index) => data.writeFloatLE(value, index * 4))
;[0, 1, 2].forEach((value, index) => data.writeUInt16LE(value, 36 + index * 2))
;[0, 1].forEach((value, index) => data.writeFloatLE(value, 44 + index * 4))
;[0, 0, 0, 0, 1, 0].forEach((value, index) => data.writeFloatLE(value, 52 + index * 4))
const gltf = {
  asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, 1] }],
  nodes: [{ name: 'Panel-col', mesh: 0 }, { name: 'PanelCopy', mesh: 0, translation: [2, 0, 0] }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
  materials: [{ name: 'Mint', pbrMetallicRoughness: { baseColorFactor: [0.51, 0.86, 0.77, 1], metallicFactor: 0, roughnessFactor: 1 } }],
  buffers: [{ byteLength: data.length, uri: `data:application/octet-stream;base64,${data.toString('base64')}` }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }, { buffer: 0, byteOffset: 44, byteLength: 8 }, { buffer: 0, byteOffset: 52, byteLength: 24 }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    { bufferView: 2, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
    { bufferView: 3, componentType: 5126, count: 2, type: 'VEC3' },
  ],
  animations: [{ name: 'Lift', samplers: [{ input: 2, output: 3 }], channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }] }],
}
await mkdir('public/models', { recursive: true })
await writeFile('public/models/panel.gltf', JSON.stringify(gltf))
```

Commands for the integration owner to execute, after installing the declared tools/runtime dependencies in that throwaway app:

```sh
bun make-model.mjs
bunx --bun --no-install tres gltf public/models/panel.gltf --dry-run
bunx --bun --no-install tres gltf public/models/panel.gltf --json
bunx --bun --no-install tres gltf public/models/panel.gltf -o app/models/Panel.gen.vue --slots all
bunx --bun --no-install tres gltf public/models/panel.gltf -o app/models/PanelBatch.gen.vue --instance --slots all
bunx --bun --no-install tres gltf public/models/panel.gltf -o app/models/PanelPhysics.gen.vue --physics rapier --slots all
bunx --bun --no-install tres gltf public/models/panel.gltf -o app/models/PanelOptimized.gen.vue --transform --simplify --ratio 0.8 --error 0.001
```

Require: JSON is parseable without decorative stdout; dry-run/JSON do not emit transformed assets; ordinary URL is `/models/panel.gltf`; instance generation creates a sibling provider and transformed GLB; physics output has a fixed trimesh `RigidBody` for the suffixed mesh and a note requiring `<Physics>`; `ready`/`isReady` and `Lift` action types exist. Also supply a separate clip file with one matching target and one unmatched target to exercise repeatable `--animations` warnings/binding; two files with the same clip name must follow the documented last-source order. The fixture's animated **fixed** body is an emission check, not a sensible moving-physics design. To exercise actual simulation use an intentionally authored dynamic collider and verify world ownership/collision behavior.

In an actual client host, strict-check plain, generated batch, and physics variants separately, including parent root placement. Record new diagnostics separately from the archived `TS2353`; CLI exit zero does not pass the host compiler. After explicitly resolving import and typing boundaries, exercise any accepted WebGPURenderer consumer on both backends. Check the provider-missing negative case, a failed asset URL, navigation cleanup, and readiness timing. A generator receipt is not a browser receipt.

The Bun 1.4.5 compatibility check without Node covered `@tresjs/cli@0.1.1` parsing the two-mesh fixture with `--json`. It did not cover the remaining generation commands, native transforms, or browser rendering.

## Bundled workbench composition

The bundled [workbench](../assets/example-app/package.json) pins **Vue 3.5.46,
`@tresjs/core@5.12.0`, `three@0.187.0`, and `@types/three@0.187.0`**.
Tasks/About do not import the lazy `/graphics` route. Within that route,
[GraphicsPage.vue](../assets/example-app/src/GraphicsPage.vue) owns ordinary DOM
controls, reduced-motion preference, errors, the text alternative, and session
identity. The scene module is imported only on **Start scene**. Stop, changing
pipeline, native loss, or leaving the route retires the session; returning
requires Start again.

[GraphicsScene.vue](../assets/example-app/src/graphics/GraphicsScene.vue) selects
`TresCanvas` from `@tresjs/core/webgpu` for the default unlit Basic-material scene
and from `@tresjs/core` for the explicit, lit WebGLRenderer compatibility scene.
Each mount keeps its entry and uses its default renderer. Core owns initialization
and normal disposal; the old factory's second, late-success disposal is not
needed on r187. The workbench observes native loss and reports the initialized
WebGPU or built-in WebGL2 backend separately from the renderer family. Its
version-specific backend fields are not a general capability probe.
[SpinningCube.vue](../assets/example-app/src/graphics/SpinningCube.vue) keeps
rotation opt-in and explicitly invalidates in `on-demand` mode. The
[Vite config](../assets/example-app/vite.config.ts) merges the compiler-only
preset into the existing Vue plugin.

The workbench is application composition, not copied recipe fences. Its
`PositiveSizeRender` in [GraphicsScene.vue](../assets/example-app/src/graphics/GraphicsScene.vue)
uses the public [`useLoop().render()` callback](https://docs.tresjs.org/api/composables/use-loop#take-over-the-render-loop)
for both selected renderers. Hide/show and real zero width keep the scene
mounted. Draw only with a live, positive-size host and a matching positive
drawing buffer; positive restoration invalidates the idle scene. Call
`notifySuccess()` only after the actual draw. Tres still owns camera updates,
DPR and buffer writes; the gate does not patch renderer methods, prevent native
initialization, guard extra passes, or prove visible pixels/readback.

In [Three r187](https://github.com/mrdoob/three.js/blob/r187/src/renderers/common/Renderer.js#L3019-L3064),
`dispose()` waits for an existing `init()` before cleanup. That removes the
r186 late-success gap, not the need to test failure: the same await can reject
and [Core 5.12.0 does not await `dispose()`](https://github.com/Tresjs/tres/blob/%40tresjs/core%405.12.0/packages/core/src/composables/useRenderer/useRendererManager.ts#L485-L489).
This is a source distinction, not a new injected-failure or hardware receipt.
The [audit](../assets/current-audit.json) retains the former workbench source
review and separate recipe/lab device observations; none certifies native
hardware execution of this r187 workbench, arbitrary effects, or complete GPU
resource release.

## Evidence and proposed verification

The November release guidance and the active runtime pins do not renew the archived 5.9.3 device reports or October consumer receipts. Verify the actual host, renderer backend, and enabled features before claiming support.

Exact registry metadata, the archived **5.9.3** public declarations/runtime, official guides, and the Khronos Box GLB are source-research evidence, not browser execution. The archived cube configuration/three SFCs and loader child are focused examples; the loader child requires the shown canvas context. The [verification register](../assets/verification.json) and [audit](../assets/current-audit.json) preserve historical compiler, software-rendering, injected-failure and device observations under their original scope.

The repository-only `verification/webgpu` lab runs **Vue 3.5.46, `@tresjs/core@5.12.0`, `three@0.187.0`, and `@types/three@0.187.0`**. It extracts the [archived WebGLRenderer fences](#complete-webglrenderer-compatibility-example-client-boundary-controls-and-animated-scene) verbatim. Its [archived WebGPU variant](#experimental-webgpu-and-custom-rendering) substitutes `onMounted(() => { ready.value = true })` for the host's WebGL2 pre-probe, rewrites the canvas's `@tresjs/core` import to `@tresjs/core/webgpu`, and removes the r186-only late-success disposal hook. The extractor records the transformations and hashes of both the fences and generated sources; it does not copy the standalone TSL/Cientos guide. The lab adds bounded picking, real-asset and shared-owner consumers and is not an installed-skill dependency.

The two earlier target-device reports and the closed focused gate (`vue-kit-skills-liu.33.3`) apply to the observed r186 resize/readback regressions. Use **Run focused recheck** for a changed source, package pair, or target device. Full verification covers broader diagnostics, not automatic acceptance. Neither sequence changes manual verdicts or certifies trusted input, real OS-preference transitions, every listener's release, VRAM reclamation, unused custom shaders, or postprocessing.

## Sources

- [Core 5.9.3 metadata](https://registry.npmjs.org/@tresjs/core/5.9.3), [Three 0.186.1 metadata](https://registry.npmjs.org/three/0.186.1), [pinned Tres public declarations](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.d.ts), [pinned implementation](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js).
- [Installation](https://docs.tresjs.org/getting-started/installation), [TresCanvas](https://docs.tresjs.org/api/components/tres-canvas), [useLoop](https://docs.tresjs.org/api/composables/use-loop), [useLoader](https://docs.tresjs.org/api/composables/use-loader), [performance/disposal](https://docs.tresjs.org/api/advanced/performance), [upgrade guide](https://docs.tresjs.org/getting-started/upgrade-guide).
- [Three WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [resource cleanup manual](https://threejs.org/manual/pages/how-to-dispose-of-objects.html), [WebGPU/TSL migration](https://threejs.org/manual/pages/webgpurenderer.html).
- [Khronos Box asset](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box), [Tres compressed blender-cube asset](https://github.com/Tresjs/assets/blob/main/models/gltf/blender-cube.glb).
