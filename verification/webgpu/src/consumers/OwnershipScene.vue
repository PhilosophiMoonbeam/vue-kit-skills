<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { useLoop, useTres } from '@tresjs/core'
import { BoxGeometry, CubeTexture, DataTexture, Mesh, MeshStandardMaterial, RGBAFormat, SRGBColorSpace, WebGLRenderer, WebGLRenderTarget } from 'three'
import { reportObservation, type Json } from '../lab-contract'
import { observeResourceDisposals } from './resource-observation'

const props = defineProps<{ cycle: number; firstLive: boolean; secondLive: boolean; snapshot: number }>()
const { renderer, scene, invalidate } = useTres()
const first = shallowRef<Mesh | null>(null)
const second = shallowRef<Mesh | null>(null)
const geometry = new BoxGeometry(1.2, 1.2, 1.2)
const map = new DataTexture(new Uint8Array([
  255, 255, 255, 255, 70, 145, 205, 255,
  70, 145, 205, 255, 255, 255, 255, 255,
]), 2, 2, RGBAFormat)
map.colorSpace = SRGBColorSpace
map.needsUpdate = true
const normalMap = new DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, RGBAFormat)
normalMap.needsUpdate = true
const environment = new CubeTexture(['#d5e7f5', '#6e90ac', '#f5f1df', '#53616b', '#a1c2db', '#a1c2db'].map(color => {
  const face = document.createElement('canvas')
  face.width = face.height = 8
  const context = face.getContext('2d')
  if (!context) throw new Error('A 2D canvas is required for the owned environment texture.')
  context.fillStyle = color
  context.fillRect(0, 0, face.width, face.height)
  return face
}))
environment.colorSpace = SRGBColorSpace
environment.needsUpdate = true
const material = new MeshStandardMaterial({ map, normalMap, envMap: environment, roughness: 0.4, metalness: 0.1 })
// This is an allocated ownership probe, not a postprocessing or custom-render pipeline.
const target = new WebGLRenderTarget(32, 32, { depthBuffer: false })
const resources = observeResourceDisposals([
  { kind: 'geometry', resource: geometry }, { kind: 'material', resource: material },
  { kind: 'map', resource: map }, { kind: 'normalMap', resource: normalMap },
  { kind: 'environment', resource: environment }, { kind: 'render-target', resource: target },
], { scene: 'ownership', cycle: props.cycle })
let released = false
let mounted = false
let retiring = false
let targetInitialized = false
let pendingSnapshot: string | null = 'initial comparable two-consumer workload'

function identity(mesh: Mesh | null): Json {
  if (!mesh) return null
  const actualMaterial = !Array.isArray(mesh.material) && mesh.material instanceof MeshStandardMaterial ? mesh.material : null
  return {
    meshUuid: mesh.uuid, attached: mesh.parent !== null,
    geometryUuid: mesh.geometry.uuid, geometryIsOwned: mesh.geometry === geometry,
    materialUuid: actualMaterial?.uuid ?? null, materialIsOwned: mesh.material === material,
    mapUuid: actualMaterial?.map?.uuid ?? null, mapIsOwned: actualMaterial?.map === map,
    normalMapUuid: actualMaterial?.normalMap?.uuid ?? null, normalMapIsOwned: actualMaterial?.normalMap === normalMap,
  }
}
function snapshot(reason: string) {
  let liveMeshes = 0
  scene.value.traverse(object => { if (object instanceof Mesh) liveMeshes += 1 })
  const disposals = resources.snapshot()
  const targetEvents = disposals.find(record => record.kind === 'render-target')?.events ?? 0
  reportObservation('resource', 'Comparable active-scene ownership snapshot.', {
    cycle: props.cycle, reason, liveMeshes, first: identity(first.value), second: identity(second.value),
    bothShareGeometry: first.value && second.value ? first.value.geometry === second.value.geometry : null,
    bothShareMaterial: first.value && second.value ? first.value.material === second.value.material : null,
    resources: disposals,
    metrics: renderer instanceof WebGLRenderer ? {
      source: 'actual WebGLRenderer.info after loop; counts are not required to reach zero',
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0, calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles, frame: renderer.info.render.frame,
      ownedRenderTargets: { source: 'explicit allocation/native-dispose ledger; renderer.info has no render-target count', initialized: targetInitialized, unreleased: targetInitialized && targetEvents === 0 ? 1 : 0 },
    } : { source: 'This consumer expects the ordinary WebGL renderer; no synthetic metric fallback.' },
  })
}
function requestSnapshot(reason: string) {
  if (retiring) return
  pendingSnapshot = reason
  invalidate()
}
function release(reason: string) {
  if (released) return
  released = true
  if (scene.value.environment === environment) scene.value.environment = null
  // All consumers have been detached before the explicit final owner releases anything.
  geometry.dispose()
  material.dispose()
  map.dispose()
  normalMap.dispose()
  environment.dispose()
  target.dispose()
  reportObservation('resource', 'Final explicit owner released all six owned resource kinds.', { cycle: props.cycle, reason, resources: resources.snapshot() })
  resources.stop()
}
const afterLoop = useLoop().onRender(() => {
  if (!pendingSnapshot || !mounted || retiring) return
  const reason = pendingSnapshot
  pendingSnapshot = null
  snapshot(reason)
})
onMounted(() => {
  mounted = true
  if (!(renderer instanceof WebGLRenderer)) throw new Error('The shared-resource consumer requires the actual ordinary WebGL renderer.')
  renderer.initRenderTarget(target)
  targetInitialized = true
  scene.value.environment = environment
  reportObservation('lifecycle', 'Shared-resource cycle mounted with two independent mesh consumers.', { cycle: props.cycle, first: identity(first.value), second: identity(second.value) })
  requestSnapshot('initial comparable two-consumer workload')
})
watch(() => [props.firstLive, props.secondLive], async () => {
  await nextTick()
  if (retiring) return
  if (!props.firstLive && !props.secondLive) {
    release('final consumer retired')
    requestSnapshot('all consumers retired; final owner released')
  } else requestSnapshot('first consumer retired; second remains live with the same owned resources')
}, { flush: 'post' })
watch(() => props.snapshot, () => requestSnapshot('user-requested comparable active-scene metrics'))
onBeforeUnmount(() => {
  retiring = true
  afterLoop.off()
  // Detach before resource release even when the entire canvas owner is unmounted.
  first.value?.removeFromParent()
  second.value?.removeFromParent()
  reportObservation('lifecycle', 'Shared-resource scene retiring; its loop observation was removed.', { cycle: props.cycle })
})
onUnmounted(() => {
  release('component unmounted')
  snapshot('owner unmounted; informational counts, not a zero-memory assertion')
})
</script>

<template>
  <TresMesh v-if="firstLive" ref="first" name="shared-consumer-a" :position="[-1, 0, 0]" :geometry="geometry" :material="material" :dispose="null" />
  <TresMesh v-if="secondLive" ref="second" name="shared-consumer-b" :position="[1, 0, 0]" :geometry="geometry" :material="material" :dispose="null" />
</template>
