<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { useLoop, useTres } from '@tresjs/core'
import type { Mesh } from 'three'

const props = defineProps<{ playing: boolean; unlit: boolean }>()
const cube = shallowRef<Mesh | null>(null)
const dimensions: [number, number, number] = [1, 1, 1]
const { invalidate } = useTres()
const { onBeforeRender } = useLoop()

// Keep render-mode static: changing idle on-demand to always does not seed the
// pinned Tres frame budget. Both the first opted-in draw and each mutation wake it.
watch(() => props.playing, () => invalidate(), { flush: 'post' })
onBeforeRender(({ delta }) => {
  const mesh = cube.value
  if (!props.playing || !mesh) return
  mesh.rotation.y += delta * 0.8
  invalidate()
})
</script>

<template>
  <TresMesh ref="cube">
    <TresBoxGeometry :args="dimensions" />
    <TresMeshBasicMaterial v-if="props.unlit" color="#2166ac" />
    <TresMeshStandardMaterial v-else color="#3a9bd9" :roughness="0.6" />
  </TresMesh>
</template>
