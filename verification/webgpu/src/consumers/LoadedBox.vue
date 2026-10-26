<script setup lang="ts">
import { onBeforeUnmount, onUnmounted, watchEffect } from 'vue'
import { dispose, useLoader } from '@tresjs/core'
import { Box3, Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { reportObservation } from '../lab-contract'
import { loaderOwnedResources, observeResourceDisposals } from './resource-observation'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ status: [message: string] }>()
// One stable request per mounted loader, as in the retained recipe. No cache/racing-load contract.
const url = props.url
let alive = true
let observation: ReturnType<typeof observeResourceDisposals> | undefined
onBeforeUnmount(() => {
  alive = false
  reportObservation('asset', 'Box loader owner entered teardown; request cancellation is not promised.', { url })
})
const { state: model, isLoading, error, progress } = useLoader<GLTF>(GLTFLoader, url, {
  asyncOptions: {
    onSuccess: (asset: GLTF | null) => {
      if (!asset?.scene) return
      // Attach listeners before the late-result owner can dispose any returned resource.
      observation = observeResourceDisposals(loaderOwnedResources(asset.scene), { scene: 'asset', url })
      const size = new Box3().setFromObject(asset.scene).getSize(new Vector3())
      reportObservation('asset', 'Real GLTF loader success.', {
        url, alive, sceneUuid: asset.scene.uuid, children: asset.scene.children.length,
        bounds: [size.x, size.y, size.z], resources: observation.snapshot(),
      })
      if (!alive) {
        reportObservation('asset', 'Late-result owner releasing the returned scene, not aborting the network request.', { url })
        dispose(asset.scene)
        reportObservation('asset', 'Late-result cleanup completed.', { url, resources: observation.snapshot() })
        observation.stop()
      }
    },
  },
})
// Registered after useLoader: resolved assets are released by its pinned onUnmounted hook.
onUnmounted(() => {
  reportObservation('asset', 'Box loader unmounted.', {
    url, resolvedAtUnmount: !!model.value?.scene, loadingAtUnmount: isLoading.value,
    resources: observation?.snapshot() ?? [],
  })
  observation?.stop()
})
watchEffect(() => {
  let message: string
  if (error.value) {
    const cause = error.value
    message = `Model load failed: ${cause instanceof Error ? cause.message : String(cause)}`
  } else if (isLoading.value) message = 'Loading the real Khronos Box model.'
  else if (model.value?.scene) message = 'Box model loaded. Confirm its visible output in the canvas.'
  else message = 'No model result is available.'
  emit('status', message)
  reportObservation('asset', 'Reactive loader state.', {
    url, message, isLoading: isLoading.value, hasScene: !!model.value?.scene,
    error: error.value ? error.value instanceof Error ? error.value.message : String(error.value) : null,
    progress: { loaded: progress.loaded, total: progress.total, percentage: progress.total > 0 ? progress.loaded / progress.total * 100 : null },
  })
})
</script>

<template>
  <primitive v-if="!isLoading && !error && model?.scene" :object="model.scene" />
</template>
