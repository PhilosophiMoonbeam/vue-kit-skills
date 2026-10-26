<script setup lang="ts">
import { onBeforeUnmount, onErrorCaptured, onMounted, ref } from 'vue'
import { TresCanvas, type TresPointerEvent } from '@tresjs/core'
import { reportObservation, type Json } from '../lab-contract'

type SelectionId = 'cube-west' | 'cube-east'
const choices: { id: SelectionId; label: string; position: [number, number, number] }[] = [
  { id: 'cube-west', label: 'Left cube', position: [-1.1, 0, 0] },
  { id: 'cube-east', label: 'Right cube', position: [1.1, 0, 0] },
]
const ready = ref(false)
const failure = ref<string | null>(null)
const selected = ref<SelectionId | null>(null)
const hovered = ref<SelectionId | null>(null)
const activated = ref<SelectionId | null>(null)
const stopAncestors = ref(false)
const lastDispatch = ref('No picking event yet.')

function payload(event: TresPointerEvent): Json {
  return {
    type: event.type,
    hit: { name: event.object.name, uuid: event.object.uuid, type: event.object.type },
    current: { name: event.currentObject.name, uuid: event.currentObject.uuid },
    point: [event.point.x, event.point.y, event.point.z],
    client: [event.clientX, event.clientY],
    screen: [event.screenX, event.screenY],
    stopped: event.stopped,
  }
}
function select(id: SelectionId, input: 'pointer' | 'keyboard-or-dom') {
  selected.value = id
  reportObservation('picking', 'Stable business ID selected.', { id, input })
}
// Core 5.9.3 retains changed Object3D listener functions. Keep these identities stable.
function pick(event: TresPointerEvent) {
  const id = event.currentObject.name as SelectionId
  if (stopAncestors.value) event.stopPropagation()
  lastDispatch.value = `Child ${id}: ${event.type}${stopAncestors.value ? ' (ancestor stopped)' : ' (bubbling)'}.`
  reportObservation('picking', 'Child hit handler.', { id, propagation: stopAncestors.value ? 'stopped' : 'ordinary', event: payload(event) })
  select(id, 'pointer')
}
function ancestor(event: TresPointerEvent) {
  lastDispatch.value = `Ancestor received ${event.type} from ${event.object.name}.`
  reportObservation('picking', 'Ancestor received the ordinary bubbled hit.', payload(event))
}
function hover(event: TresPointerEvent) {
  const id = event.currentObject.name as SelectionId
  const inside = event.type === 'pointerenter'
  hovered.value = inside ? id : hovered.value === id ? null : hovered.value
  reportObservation('picking', inside ? 'Pointer entered cube.' : 'Pointer left cube.', { id, event: payload(event) })
}
function activate(id: SelectionId, input: 'pointer' | 'keyboard-or-dom', event?: TresPointerEvent) {
  if (event && stopAncestors.value) event.stopPropagation()
  selected.value = id
  activated.value = id
  reportObservation('picking', 'Cube activated.', { id, input, event: event ? payload(event) : null })
}
function activatePointer(event: TresPointerEvent) {
  activate(event.currentObject.name as SelectionId, 'pointer', event)
}
function clear(input: 'pointermissed' | 'keyboard-or-dom') {
  selected.value = null
  activated.value = null
  reportObservation('picking', 'Selection cleared.', { input })
}
function rendererError(cause: Error) {
  failure.value = cause.message
  reportObservation('component-error', 'Picking canvas emitted an error.', { message: cause.message })
}
onMounted(() => {
  ready.value = true
  reportObservation('lifecycle', 'Picking DOM owner mounted.')
})
onBeforeUnmount(() => reportObservation('lifecycle', 'Picking DOM owner retiring.'))
onErrorCaptured(cause => {
  failure.value = cause instanceof Error ? cause.message : String(cause)
  reportObservation('component-error', 'Picking descendant error.', { message: failure.value })
})
</script>

<template>
  <section aria-label="Picking and keyboard equivalents">
    <h2>Select a cube</h2>
    <p>Click to select, double-click to activate, or click empty canvas to clear. Use the buttons with Tab and Enter or Space.</p>
    <label><input v-model="stopAncestors" type="checkbox"> Stop events at the hit cube</label>
    <div class="actions" aria-label="Keyboard selection controls">
      <button v-for="choice in choices" :key="choice.id" type="button" :aria-pressed="selected === choice.id" @click="select(choice.id, 'keyboard-or-dom')">Select {{ choice.label }}</button>
      <button type="button" :disabled="!selected" @click="selected && activate(selected, 'keyboard-or-dom')">Activate selected</button>
      <button type="button" @click="clear('keyboard-or-dom')">Clear selection</button>
    </div>
    <p role="status">Selected: {{ selected ?? 'none' }}. Hovered: {{ hovered ?? 'none' }}. Activated: {{ activated ?? 'none' }}.</p>
    <details><summary>Event details</summary><p>{{ lastDispatch }}</p><p>Child and ancestor events, stable cube IDs and hit metadata are recorded in the event log.</p></details>
    <p v-if="failure" role="alert">{{ failure }}</p>
    <div v-else-if="ready" class="scene" role="img" aria-label="Two blue selectable cubes; equivalent labeled controls are above">
      <TresCanvas render-mode="on-demand" :dpr="1" clear-color="#17212b" @error="rendererError" @pointermissed="clear('pointermissed')">
        <TresPerspectiveCamera :position="[0, 2.3, 6]" :look-at="[0, 0, 0]" />
        <TresGroup name="selection-ancestor" @click="ancestor" @dblclick="ancestor">
          <TresMesh v-for="choice in choices" :key="choice.id" :name="choice.id" :position="choice.position"
            @click="pick" @dblclick="activatePointer"
            @pointerenter="hover" @pointerleave="hover">
            <TresBoxGeometry :args="[1.25, 1.25, 1.25]" />
            <TresMeshBasicMaterial :color="selected === choice.id ? '#7bca98' : hovered === choice.id ? '#e6a700' : '#3a9bd9'" />
          </TresMesh>
        </TresGroup>
      </TresCanvas>
    </div>
    <p v-else role="status">Preparing scene…</p>
  </section>
</template>

<style scoped>
.scene { width: 100%; height: 24rem; min-width: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-block: 1rem; }
</style>
