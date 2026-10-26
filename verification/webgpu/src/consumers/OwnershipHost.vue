<script setup lang="ts">
import { onBeforeUnmount, onErrorCaptured, onMounted, ref } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { reportObservation } from '../lab-contract'
import OwnershipScene from './OwnershipScene.vue'

const ready = ref(false)
const failure = ref<string | null>(null)
const cycle = ref(1)
const phase = ref<'both' | 'one' | 'retired'>('both')
const snapshot = ref(0)
function retireFirst() {
  phase.value = 'one'
  reportObservation('lifecycle', 'User requested first shared consumer retirement.', { cycle: cycle.value })
}
function retireFinal() {
  phase.value = 'retired'
  reportObservation('lifecycle', 'User requested final shared consumer retirement.', { cycle: cycle.value })
}
function freshCycle() {
  cycle.value += 1
  phase.value = 'both'
  reportObservation('lifecycle', 'User requested a fresh comparable two-consumer cycle.', { cycle: cycle.value })
}
function rendererError(cause: Error) {
  failure.value = cause.message
  reportObservation('component-error', 'Ownership canvas emitted an error.', { message: cause.message })
}
onMounted(() => {
  ready.value = true
  reportObservation('lifecycle', 'Ownership DOM owner mounted.')
})
onBeforeUnmount(() => reportObservation('lifecycle', 'Ownership DOM owner retiring.'))
onErrorCaptured(cause => {
  failure.value = cause instanceof Error ? cause.message : String(cause)
  reportObservation('component-error', 'Ownership descendant error.', { message: failure.value })
})
</script>

<template>
  <section aria-label="Shared resources and final explicit ownership">
    <h2>Release shared resources</h2>
    <p>Retire the first cube; the second must remain intact. Then release the final owner and restart to compare cycles.</p>
    <div class="actions">
      <button type="button" :disabled="phase !== 'both'" @click="retireFirst">1. Retire first cube</button>
      <button type="button" :disabled="phase !== 'one'" @click="retireFinal">2. Release final owner</button>
      <button type="button" :disabled="phase !== 'retired'" @click="freshCycle">3. Restart cycle</button>
      <button type="button" @click="snapshot += 1">Record snapshot</button>
    </div>
    <p role="status">Cycle {{ cycle }} · Requested cubes: {{ phase === 'both' ? 'both' : phase === 'one' ? 'second only' : 'none' }}.</p>
    <details>
      <summary>Ownership probe details</summary>
      <p>Both meshes share geometry, material, color and normal maps, with <code>:dispose="null"</code>. The final owner releases these resources, the cube environment and a 32×32 render target.</p>
      <p>The target tests ownership, not postprocessing. Its counts are owner ledgers, not renderer metrics. Compare geometry, texture and program counts across matching cycles; counts need not reach zero.</p>
      <p>Constructor arguments stay fixed. Snapshots record actual mesh and resource identities and native dispose counts; they do not test constructor replacement or implicit cleanup.</p>
    </details>
    <p v-if="failure" role="alert">{{ failure }}</p>
    <div v-else-if="ready" class="scene" role="img" aria-label="Two lit patterned cubes sharing their resource owner; labeled retirement controls are above">
      <TresCanvas render-mode="on-demand" :dpr="1" clear-color="#17212b" @error="rendererError">
        <TresPerspectiveCamera :position="[0, 2.3, 6]" :look-at="[0, 0, 0]" />
        <TresAmbientLight :intensity="0.8" />
        <TresDirectionalLight :position="[3, 4, 2]" :intensity="2" />
        <OwnershipScene :key="cycle" :cycle="cycle" :first-live="phase === 'both'" :second-live="phase !== 'retired'" :snapshot="snapshot" />
      </TresCanvas>
    </div>
    <p v-else role="status">Preparing scene…</p>
  </section>
</template>

<style scoped>
.scene { width: 100%; height: 24rem; min-width: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-block: 1rem; }
</style>
