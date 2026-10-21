# TresJS and Three.js scenes

Read for declarative 3D scenes, cameras/lights, render loops, asset loading, resource ownership, or WebGL/SSR failures. TresJS is a Vue custom renderer for Three.js, not an HTML UI kit. Keep accessible controls, descriptions, and errors in ordinary DOM outside the scene. See [accessibility.md](accessibility.md), [motion.md](motion.md), and [debugging-ssr.md](debugging-ssr.md).

## Exact version and rendering boundary

Verified stable packages: **`@tresjs/core@5.9.3`**, **`three@0.186.1`**, targeting Vue **3.5.44**. Core declares Vue peer `>=3.4`, Three peer `>=0.133`, and is ESM-only. A broad peer range does not guarantee every historical Three feature: examples deliberately use the specified modern pair. Install matching Three typings for the chosen Three release. WebGPU/custom renderers are a separate, experimental boundary; the examples use ordinary WebGL. Current Three's WebGL renderer requires **WebGL 2**, not a WebGL 1 fallback. [Core registry](https://registry.npmjs.org/@tresjs/core/5.9.3), [Three registry](https://registry.npmjs.org/three/0.186.1), [WebGLRenderer documentation](https://threejs.org/docs/#api/en/renderers/WebGLRenderer).

For a Vite Vue host, merge Tres's compiler options with the existing Vue plugin; do not add a second Vue plugin or replace unrelated configuration. Complete minimal configuration, requiring `vite` and `@vitejs/plugin-vue` in the host:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { templateCompilerOptions } from '@tresjs/core'

export default defineConfig({
  plugins: [vue({ ...templateCompilerOptions })],
})
```

`@tresjs/core/template-compiler-options` is also exported for compiler-only consumers. Nuxt uses `@tresjs/nuxt`; do not paste Vite SPA bootstrapping into a Nuxt plugin. Version that module separately before adopting it. [Official installation](https://docs.tresjs.org/getting-started/installation), [pinned package exports](https://unpkg.com/@tresjs/core@5.9.3/package.json).

## Scene ownership and API model

| Surface | Rule |
| --- | --- |
| `TresCanvas` | Owns scene, renderer, size observation, camera management, and rendering context. Give its parent a real height. |
| `Tres` + Three class name | `<TresMesh>`, `<TresBoxGeometry>`, `<TresPerspectiveCamera>`, `<TresDirectionalLight>` are generated scene elements, not individually imported Vue components. |
| `args` | Constructor arguments; changing them recreates the instance. Use properties for ordinary updates and stable args for geometry. |
| Math/property props | `:position="[x, y, z]"`, `:rotation="[x, y, z]"`, `color="…"` update Three properties. |
| Attachments | Geometry/material children attach to the mesh's `geometry`/`material`; the canvas supplies the scene. Do not nest a second scene unnecessarily. |
| Template refs | Use `shallowRef<Mesh | null>` (or the actual Three type). Refs are null before mount/after removal; guard every frame callback. Do not deeply proxy Three instances. |
| `<primitive :object="object" />` | Mounts an existing Three object. Ownership of programmatic resources must be explicit; mounting is not universal ownership transfer. |
| `useLoop`, `useTres` | Call in a **descendant component of `TresCanvas`**, where its context is provided; not in the same component that creates the canvas. |

Declare a camera and its aim intentionally. The first registered camera is normally active; when switching cameras, use the camera manager rather than mutating a snapshot. `useTres().camera` exposes the active camera ref; `useTresContext().camera` is the **manager**, whose `activeCamera` is a ref. No camera is not a useful framing strategy, even though the canvas can create a default one. MeshStandardMaterial requires lighting; MeshBasicMaterial/MeshNormalMaterial do not demonstrate a lit scene.

## Complete example: client boundary, controls, and animated scene

Install `@tresjs/core@5.9.3 three@0.186.1` plus matching Three typings and use the Vite configuration above. These three SFCs are a complete focused example. `SceneHost.vue` is the ordinary DOM entry, `SceneCanvas.vue` owns controls/canvas, and `SpinningCube.vue` consumes the canvas context. Animation is opt-in, disabled under reduced-motion preference, and uses an on-demand renderer while stopped.

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
    <h2>Lit cube</h2>
    <p>A blue cube illuminated from above. Rotation is optional; no information requires 3D.</p>
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
        :render-mode="active ? 'always' : 'on-demand'"
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
onBeforeRender(({ delta }) => {
  if (props.playing && cube.value) cube.value.rotation.y += delta * 0.8
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
- Treat mesh refs and `useTres().camera.value` as live, nullable handles. Do not capture a camera instance once and assume it survives camera switching. Keep `args` static unless reconstruction is intended.

Source correction: v4 `useRenderLoop`, `useTexture` in core, promise-style `await useLoader`, and hyphenated `@pointer-down` are not v5 APIs. Use `useLoop`; texture helpers live in the separately versioned `@tresjs/cientos`; use reactive loader state; pointer names are native `@pointerdown`, `@pointermove`, `@click`. Only the first intersected object receives the ordinary pointer interaction under current v5 semantics. Provide a DOM keyboard equivalent for any mesh action; pointer picking does not make a canvas keyboard accessible. [Upgrade guide](https://docs.tresjs.org/getting-started/upgrade-guide), [loop API](https://docs.tresjs.org/api/composables/use-loop).

### Picking, propagation, and selection

The pinned **5.9.3** declaration accepts `click`, `contextmenu`, `dblclick`, `pointerdown`, `pointerup`, `pointercancel`, `pointermove`, `pointerover`, `pointerout`, `pointerenter`, `pointerleave`, `lostpointercapture`, and `wheel`. Use **`@dblclick`**, not the current guide's `@doubleclick` spelling: exact declarations/runtime decide that conflict. Raycastable objects and primitives can receive handlers. Events bubble through the object hierarchy, not through every occluded mesh; `stopPropagation()` stops ancestor handling, `pointerover`/`pointerout` bubble, and `pointerenter`/`pointerleave` do not. Use a common `TresGroup` to coordinate child selection and canvas `@pointermissed` to clear it.

`TresPointerEvent` carries `object`, world-space `point`, distance/face/UV and screen `xy`; the hit `object` is not necessarily a `Mesh` with one color-bearing material. Narrow it before mutation, including material arrays. Prefer selecting a stable business ID and deriving appearance from state to blindly mutating `event.object.material.color`.

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
</script>

<template>
  <TresMesh
    @click="select" @pointerenter="hovered = true" @pointerleave="hovered = false"
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

`useLoader(LoaderConstructor, path, options?)` returns reactive **`state`, `isLoading`, `error`, `progress`, `load`**, not a Promise. The path can be a ref; `extensions(loader)` configures decoders before loading. Check errors explicitly; `progress.total` may be zero/unknown, so a percentage is not always meaningful. Do not display 100% as proof that textures/shaders have rendered.

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

The subtree opt-out affects renderer removal, **not** `useLoader`'s separate glTF cleanup. Do not put a cache-shared `scene` into that loader-owned lifetime or assume cloning its hierarchy isolates GPU resources. Cache-owned assets need a cache owner that controls final disposal; use per-instance clones with deliberately shared or independently cloned materials/textures. In **5.9.3**, exported `dispose(object)` disposes mesh geometry, material(s), and their `map` textures, not every possible texture slot. Track other owned maps/targets separately and dispose each only after its final consumer. [Pinned removal, loader, and disposal implementation](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js), [Three resource cleanup](https://threejs.org/manual/en/cleanup.html).

Bound DPR and FPS according to measured quality needs. Reuse geometry/materials, use instancing for repeated meshes, reduce draw calls and expensive shadows, and avoid per-frame allocation of vectors/materials/arrays. Do not turn ordinary constructor changes into an animation strategy. Renderer-creation props such as `antialias`, `alpha`, and WebGL context settings are mount-time decisions; changing them requires a deliberate renderer remount, not an assumed live patch.

Size the canvas's **parent** explicitly; window-sized mode is a different layout choice. A zero-height parent is not a Three camera bug. Tres observes size and updates camera aspect; do not install an unrelated competing resize loop. Handle context loss and recovery deliberately: stop dependent work, retain an informative DOM alternative, and recreate/reload only resources whose owner requires it. WebGPU opt-in uses a supplied renderer and a separate capability path; it is not an automatic fallback for WebGL failure.

## Experimental WebGPU and custom rendering

For **core 5.9.3 / Three 0.186.1**, the `renderer` prop is a synchronous factory `(ctx: TresRendererSetupContext) => TresRenderer`, not a ready-made instance or Promise. Tres owns initialization of the returned renderer. This complete alternative `SceneCanvas.vue` reuses the earlier client host's async import, error listeners, preparation text, and DOM description (do not also mount the WebGL cube scene). **For this variant only**, replace that host's WebGL 2 probing `onMounted` callback with `onMounted(() => { ready.value = true })`: the selected renderer, not a mandatory WebGL probe, must decide WebGPU/backend availability. Keep `onErrorCaptured` for synchronous constructor failures and the forwarded `@error` for rejected renderer initialization. [Pinned backend selection](https://unpkg.com/three@0.186.1/src/renderers/webgpu/WebGPURenderer.js), [Tres construction and initialization](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js).

```vue
<script setup lang="ts">
import { toValue } from 'vue'
import { TresCanvas, type TresRendererSetupContext } from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'

const emit = defineEmits<{ error: [cause: Error] }>()
const createRenderer = (context: TresRendererSetupContext) =>
  new WebGPURenderer({
    canvas: toValue(context.canvas), antialias: true, alpha: false,
  })
</script>

<template>
  <div class="scene">
    <TresCanvas
      :renderer="createRenderer" render-mode="on-demand" :dpr="1"
      @error="emit('error', $event)"
    >
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

Bind this variant's `@error` in the DOM host to set its existing `failure` message: emitted errors need an explicit listener, not an assumption that `onErrorCaptured` catches component emits. Keep a text/image alternative and capability/error handling even when `navigator.gpu` exists; secure context, adapter availability and renderer initialization decide actual support. Do not copy dated browser-version/flag lists as a guarantee. Three's WebGPU renderer may use its WebGL2 backend; this is **not** an automatic fallback from the default WebGLRenderer.

`useTresContext().isWebGPU.value` and `isWebGPURenderer(renderer)` identify the **renderer family**, including its WebGL2 fallback, not proof of an active GPU backend. NodeMaterial/TSL belongs to that family; GLSL `ShaderMaterial` is not supported under it. Use `isWebGLRenderer` before accessing WebGL-specific diagnostics/APIs. On the selected **r186** pair, soft shadows fall back to `PCFShadowMap` on WebGPU too; old “WebGPU always defaults to PCFSoftShadowMap” guidance applies only before r186. Custom postprocessing must support the selected renderer and call `notifySuccess()` as described above. [Exact capability/default declarations](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.d.ts), [experimental integration](https://docs.tresjs.org/api/advanced/web-gpu).

## Evidence and proposed verification

Inspected registry metadata, exact **5.9.3** public declarations/runtime, official current guides, and the Khronos Box GLB header/JSON (1664 bytes, no required compression extension). The cube configuration/three SFCs and loader child are complete focused examples; the loader child explicitly requires the shown canvas context. Executed compiler/type scopes are in the [verification record](../assets/verification.json); no WebGL/browser, SSR, visual or disposal stress pass is claimed. Verify SSR module isolation, unavailable/lost WebGL 2, reduced-motion changes, play/pause, resize, ref removal, asset failure/CORS, required decoders, repeated mount/unmount and GPU/resource counts.

## Sources

- [Core 5.9.3 metadata](https://registry.npmjs.org/@tresjs/core/5.9.3), [Three 0.186.1 metadata](https://registry.npmjs.org/three/0.186.1), [pinned Tres public declarations](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.d.ts), [pinned implementation](https://unpkg.com/@tresjs/core@5.9.3/dist/tres.js).
- [Installation](https://docs.tresjs.org/getting-started/installation), [TresCanvas](https://docs.tresjs.org/api/components/tres-canvas), [useLoop](https://docs.tresjs.org/api/composables/use-loop), [useLoader](https://docs.tresjs.org/api/composables/use-loader), [performance/disposal](https://docs.tresjs.org/api/advanced/performance), [upgrade guide](https://docs.tresjs.org/getting-started/upgrade-guide).
- [Three WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer), [GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader), [resource cleanup manual](https://threejs.org/manual/en/cleanup.html).
- [Khronos Box asset](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box), [Tres compressed blender-cube asset](https://github.com/Tresjs/assets/blob/main/models/gltf/blender-cube.glb).
