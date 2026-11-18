# TresJS post-processing: choose a render owner

| Renderer and intent | Use |
| --- | --- |
| `WebGLRenderer`, existing Three addon passes | Root `@tresjs/post-processing` → `EffectComposer`. See the [legacy Three and N8AO fixture](tresjs.md#post-processing-choose-one-complete-rendering-pipeline). |
| `WebGLRenderer`, pmndrs effects | Root `@tresjs/post-processing` → `EffectComposerPmndrs`. See the [legacy pmndrs subtree](tresjs.md#post-processing-choose-one-complete-rendering-pipeline). These two composers have different injection keys and pass contracts; their children are not interchangeable. |
| `WebGPURenderer`, effects as Vue components | `@tresjs/core/webgpu` canvas + `@tresjs/post-processing/webgpu` → `EffectComposer` and `defineEffect`. |
| `WebGPURenderer`, app-owned graph and scheduling decisions | Configure Core’s [`useRenderPipeline`](tresjs-webgpu.md) or own Three’s `RenderPipeline` directly. See the [historical app-owned pipeline fixture](tresjs.md#post-processing-choose-one-complete-rendering-pipeline) for the direct approach. Do not mount either alongside the composer. |

**3.12.0** adds the `/webgpu` entry with exactly two runtime exports, `EffectComposer` and `defineEffect`. It chains effects in slot order before output conversion. **3.13.0** retains those exports and adds the definition-level `stage` option and exported `EffectStage` type. Both versions export the effect definition, component, state, prop and uniform types and `EffectComposerProps`. Neither entry exports prebuilt WebGPU effect components. Do not put root-exported passes, including `Output`, into this composer.

The `/webgpu` API needs **Core 5.11+ and Three r183+** (`RenderPipeline`), not just the manifest’s broad Core `^5.9.1` and Three `>=0.169` peer ranges. These are API floors, not proof that an arbitrary effect or version pairing works. The example targets **Vue 3.5.44, Core 5.12.0, post-processing 3.13.0, Three 0.186.1 and `@types/three` 0.186.0**. Use the [Tres compiler configuration](tresjs-webgpu.md) and mount client-side. `WebGPURenderer` using its WebGL2 backend still is not `WebGLRenderer`.

## HDR bloom and display-space FXAA

The emissive mesh supplies scene-linear values above the bloom threshold. Bloom adds a halo before tone mapping; FXAA samples display colors after output conversion. Uncheck **Enable effects** to compare against direct rendering of the same mesh, camera and output settings. Use `force-webgl` only when mounting a separate fallback session.

```vue
<!-- WebGpuEffectsHost.vue -->
<script setup lang="ts">
import { TresCanvas, type TresRendererSetupContext } from '@tresjs/core/webgpu'
import { defineEffect, EffectComposer } from '@tresjs/post-processing/webgpu'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { add } from 'three/tsl'
import { ConvertNode, WebGPURenderer } from 'three/webgpu'
import { ref, toValue } from 'vue'

const props = defineProps<{ forceWebgl?: boolean }>()
const enabled = ref(true)
const rendererError = ref<string | null>(null)
function createRenderer({ canvas }: TresRendererSetupContext) {
  return new WebGPURenderer({
    canvas: toValue(canvas),
    forceWebGL: props.forceWebgl === true,
    antialias: false,
  })
}

function onRendererError(error: Error) {
  rendererError.value = error.message
}

const SceneBloom = defineEffect<{ strength: number }>({
  name: 'SceneBloom',
  props: { strength: 0.4 },
  stage: 'hdr',
  create(input, { uniforms }) {
    // The composer accepts generic Node; the r186 bloom helper takes Node<'vec4'>.
    const color = new ConvertNode<'vec4'>(input, 'vec4')
    return add(color, bloom(color, uniforms.strength, 0.2, 1))
  },
})

const DisplayFXAA = defineEffect({
  name: 'DisplayFXAA',
  stage: 'ldr',
  create: input => fxaa(input),
})
</script>

<template>
  <label>
    <input v-model="enabled" type="checkbox" />
    Enable effects
  </label>
  <p v-if="rendererError !== null" role="alert">Renderer initialization failed: {{ rendererError }}</p>
  <div style="width: 100%; max-width: 640px; height: 360px">
    <TresCanvas
      :renderer="createRenderer"
      :tone-mapping="ACESFilmicToneMapping"
      :output-color-space="SRGBColorSpace"
      clear-color="#20242c"
      @error="onRendererError"
    >
      <TresPerspectiveCamera :position="[0, 0, 4]" />
      <TresMesh :rotation="[0.3, 0.5, 0.15]">
        <TresBoxGeometry />
        <TresMeshStandardMaterial color="black" emissive="white" :emissive-intensity="4" />
      </TresMesh>
      <EffectComposer :enabled="enabled">
        <SceneBloom />
        <DisplayFXAA />
      </EffectComposer>
    </TresCanvas>
  </div>
</template>
```

## Effect contract and lifecycle

- `defineEffect({ name, props?, stage?, create })` returns a Vue component. `props` maps keys to **defaults**, not Vue prop descriptors; those keys become optional component props and same-name, instance-local uniforms. Defaults are numbers, booleans, CSS color strings, `Color`, or `Vector2`/`Vector3`/`Vector4`. A color prop also accepts a numeric hex or a `Color`; a vector prop also accepts a tuple of matching length. Strings represent colors, not enums; booleans become float uniforms (`0` or `1`), not shader booleans.
- `create(input, { uniforms, passes, scene, camera, renderer })` takes and returns a `Node` from `three/webgpu`. `passes.scenePass` is the Core-owned `PassNode`, `scene` is the active Tres scene, `camera` is typed `Camera | undefined`, and `renderer` is a `WebGPURenderer`. Transform `input`: sampling the original scene color instead can discard upstream effects.
- `stage` is definition-time only: lowercase `'hdr'` (default) or `'ldr'`. The graph runs all HDR effects, then the renderer’s tone mapping and output color-space conversion, then all LDR effects. Within each stage it follows rendered slot order; an LDR child listed first still runs after every HDR child. In development that mixed order warns, and fixing the order resets the warning. With no LDR effects Three applies its normal pipeline output transform; with LDR effects the composer inserts `renderOutput` at the stage boundary and disables the final automatic transform. Do not convert a second time.
- Adding, removing or reordering effects rebuilds the graph and scene pass. Changing scene or active camera also rebuilds; Core can rerun the build on tracked pass-store changes or explicit `rebuild()`. Prop changes write uniform `.value` and invalidate rather than recreating the graph. Watchers are shallow: replace colors, vectors and tuples rather than mutating in place. Rejected values warn and retain the prior value. A zero strength can remove the visual contribution without avoiding the pass cost.
- Only `enabled` is a composer prop (default `true`); there are no legacy render-target, render-pass or multisampling props. Turning it off unmounts its pipeline host, releases ownership and restores the normal Tres draw when this is the only owner. The effect children and their uniforms remain mounted. Removing the composer also removes its children. This differs from the root composers: disabling those skips drawing and their unmount does not restore the render callback.
- Core releases the pipeline and its registered `PassNode` targets. The composer disposes replaced or unmounted build-owned nodes reachable from the output, excluding the scene pass and input. Keep separately allocated resources not reachable from that graph, and pre-existing shared resources, under explicit app ownership. With a raw app-owned pipeline, restore the prior render callback before disposing it and dispose owned nodes and targets separately: `RenderPipeline.dispose()` is not recursive graph cleanup.

## Target checks and limits

Use one render owner per canvas: no second composer, configuring `useRenderPipeline`, independent RAF draw, or `renderer.render()` layered on top. Give the host positive width and height at startup and during use. A pipeline draw replaces the normal Tres callback and can bypass its size guard; if the layout collapses, disable/unmount the pipeline until the host is measurable. Canvas `ready` means renderer initialization succeeded, not that the entire graph renders correctly.

For a bounded consumer check, mount the full scene at **640 × 360**. On a target browser/device, confirm the actual initialized backend (inspect `context.renderer.instance.backend` from the canvas `ready` callback, not only the renderer class). Look for bloom outside the mesh silhouette and FXAA smoothing on slanted edges. Toggle **Enable effects** off and back on: the mesh must keep drawing directly while off and regain its halo when re-enabled. Move FXAA ahead of bloom in the slot and verify HDR still runs first; then remove FXAA and check that the output is not tone-mapped or encoded twice. Change the bloom strength, switch the active camera, and resize at positive dimensions. Unmount only the composer and confirm the scene still draws; then unmount the canvas. Repeat with the same scene mounted using `<WebGpuEffectsHost force-webgl />` and confirm the actual WebGL2 backend. If the default run silently falls back, record that as fallback, not native WebGPU evidence. Initialization or graph failures on a target are not a basis to mix in legacy passes.

This is a source-backed example and check procedure, not an executed browser receipt or a guarantee for all nodes, browsers or fallback devices.

**Pinned sources:** [3.12.0 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/post-processing%403.12.0), [3.12.0 declarations](https://unpkg.com/@tresjs/post-processing@3.12.0/dist/webgpu.d.ts); [3.13.0 release](https://github.com/Tresjs/tres/releases/tag/%40tresjs/post-processing%403.13.0), [manifest](https://registry.npmjs.org/@tresjs/post-processing/3.13.0), [runtime](https://unpkg.com/@tresjs/post-processing@3.13.0/dist/webgpu.js), [declarations](https://unpkg.com/@tresjs/post-processing@3.13.0/dist/webgpu.d.ts), [graph source](https://github.com/Tresjs/tres/blob/%40tresjs/post-processing%403.13.0/packages/postprocessing/src/core/webgpu/graph.ts); [Core 5.12.0 pipeline ownership](https://github.com/Tresjs/tres/blob/%40tresjs/core%405.12.0/packages/core/src/webgpu/tsl/useRenderPipeline.ts); [Three r183 RenderPipeline](https://github.com/mrdoob/three.js/blob/r183/src/renderers/common/RenderPipeline.js), [r186 output transform](https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/RenderPipeline.js), [r186 conversion node types](https://unpkg.com/@types/three@0.186.0/src/nodes/utils/ConvertNode.d.ts), [Bloom types](https://unpkg.com/@types/three@0.186.0/examples/jsm/tsl/display/BloomNode.d.ts), [FXAA types](https://unpkg.com/@types/three@0.186.0/examples/jsm/tsl/display/FXAANode.d.ts).
