<script setup lang="ts">
import { onBeforeUnmount, onErrorCaptured, onMounted, ref } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { reportObservation } from '../lab-contract'
import LoadedBox from './LoadedBox.vue'

const mode = new URLSearchParams(window.location.search).get('mode')
const url = mode === 'asset-unavailable' ? '/fixtures/missing.glb' : mode === 'asset-delayed' ? '/fixtures/Box-delayed.glb' : '/fixtures/Box.glb'
const ready = ref(false)
const failure = ref<string | null>(null)
const modelStatus = ref('Preparing the Box loader.')
function rendererError(cause: Error) {
  failure.value = cause.message
  reportObservation('component-error', 'Asset canvas emitted an error.', { message: cause.message })
}
onMounted(() => {
  ready.value = true
  reportObservation('lifecycle', 'Asset DOM owner mounted.', { url })
})
onBeforeUnmount(() => reportObservation('lifecycle', 'Asset DOM owner retiring.', { url }))
onErrorCaptured(cause => {
  failure.value = cause instanceof Error ? cause.message : String(cause)
  reportObservation('component-error', 'Asset descendant error.', { message: failure.value })
})
</script>

<template>
  <section aria-label="Real Box asset and loader ownership">
    <h2>Load Box</h2>
    <p>Request: <code>{{ url }}</code></p>
    <p v-if="mode === 'asset-delayed'">Loading is delayed by about three seconds. Choose Remove scene before it finishes; the request is not cancelled.</p>
    <p v-if="mode === 'asset-unavailable'">This missing file returns HTTP 404. It does not test CORS or offline access.</p>
    <p role="status">{{ modelStatus }}</p>
    <p v-if="failure" role="alert">{{ failure }}</p>
    <div v-else-if="ready" class="scene" role="img" aria-label="Real Khronos Box lit from above; loader status is outside the canvas">
      <TresCanvas render-mode="on-demand" :dpr="1" clear-color="#17212b" @error="rendererError">
        <TresPerspectiveCamera :position="[3, 2, 4]" :look-at="[0, 0, 0]" />
        <TresAmbientLight :intensity="0.8" />
        <TresDirectionalLight :position="[3, 4, 2]" :intensity="2" />
        <LoadedBox :url="url" @status="modelStatus = $event" />
      </TresCanvas>
    </div>
    <p v-else role="status">Preparing canvas…</p>
    <details>
      <summary>Asset license and attribution</summary>
      <p>Box by Cesium (2017), licensed under CC BY 4.0. Unchanged from Khronos glTF Sample Assets.</p>
      <p><a href="/fixtures/Box-LICENSE.md" target="_blank" rel="noreferrer">Primary license</a> · <a href="/fixtures/Box-metadata.json" target="_blank" rel="noreferrer">Primary attribution</a></p>
    </details>
  </section>
</template>

<style scoped>
.scene { width: 100%; height: 24rem; min-width: 0; }
</style>
