<script setup lang="ts">
import { defineComponent, onBeforeUnmount, onErrorCaptured, useTemplateRef, watchPostEffect } from 'vue'
import {
  isPerspectiveCamera, isWebGLRenderer, isWebGPURenderer, TresCanvas as WebGLCanvas, useLoop, useTresContext,
  type TresContext,
} from '@tresjs/core'
import { TresCanvas as WebGPUCanvas } from '@tresjs/core/webgpu'
import SpinningCube from './SpinningCube.vue'

const props = defineProps<{ choice: 'webgl' | 'experimental'; playing: boolean }>()
// The page keys this owner by session and unmounts it before another choice can start.
const Canvas = props.choice === 'webgl' ? WebGLCanvas : WebGPUCanvas
const emit = defineEmits<{
  ready: [backend: string]
  draw: []
  error: [cause: unknown]
  lost: [message: string]
}>()
const canvasOwner = useTemplateRef<{ readonly context?: TresContext }>('canvasOwner')
let ownerRetired = false
let activeContext: TresContext | undefined
let observedCanvas: HTMLCanvasElement | undefined
let firstDraw = false

function reportError(cause: unknown): void {
  if (ownerRetired) {
    // Vue no longer emits from an unmounted instance; retain its original cause.
    console.error('[Graphics] Retired scene error:', cause)
    return
  }
  emit('error', cause)
}
onErrorCaptured(cause => {
  reportError(cause)
  // Do not return false: Vue must also report the original exception normally.
})

function retireAfterLoss(message: string): void {
  if (ownerRetired) return
  ownerRetired = true
  activeContext?.renderer.loop.stop()
  emit('lost', message)
}

function onContextLost(event: Event): void {
  const message = (event as WebGLContextEvent).statusMessage
  retireAfterLoss(`Native WebGL context lost${message ? `: ${message}` : '.'}`)
  // Do not suppress the native event or replace Three's own loss handlers.
}

function observeCanvas(canvas: HTMLCanvasElement): void {
  if (observedCanvas === canvas) return
  observedCanvas?.removeEventListener('webglcontextlost', onContextLost)
  observedCanvas = canvas
  canvas.addEventListener('webglcontextlost', onContextLost)
}

// Backend flags/device are read only after native initialization. These fields are
// pinned to Three r187, not a portable backend-introspection or capability API.
interface InitializedBackend {
  isWebGPUBackend?: boolean
  isWebGLBackend?: boolean
  device?: { lost: Promise<{ reason: string; message: string }> }
}

watchPostEffect(() => {
  const context = canvasOwner.value?.context
  if (!context || ownerRetired) return
  activeContext = context
  const { instance, isInitialized } = context.renderer
  observeCanvas(instance.domElement)
  if (!isWebGPURenderer(instance) || !isInitialized.value) return
  const { device } = instance.backend as unknown as InitializedBackend
  if (!device) return

  // Observe native loss without waiting for Tres's positive-buffer ready event.
  // The already-owned device reports 'destroyed' too; Three's callbacks stay intact.
  void device.lost.then(info => {
    if (activeContext !== context) return
    retireAfterLoss(`Native WebGPU device lost (${info.reason}): ${info.message || 'No additional message.'}`)
  }, reportError)
})

function onReady(context: TresContext): void {
  if (ownerRetired) {
    context.renderer.loop.stop()
    return
  }
  const instance = context.renderer.instance
  if (isWebGLRenderer(instance)) {
    emit('ready', 'WebGL 2 · WebGLRenderer')
  } else if (isWebGPURenderer(instance)) {
    const backend = instance.backend as unknown as InitializedBackend
    emit('ready', backend.isWebGPUBackend === true
      ? 'WebGPU · WebGPURenderer (experimental)'
      : backend.isWebGLBackend === true
        ? 'WebGL 2 fallback · WebGPURenderer (experimental)'
        : 'Unconfirmed backend · WebGPURenderer (experimental)')
  } else {
    emit('ready', 'Unconfirmed renderer and backend')
  }
}

function onDraw(): void {
  if (ownerRetired || firstDraw) return
  firstDraw = true
  emit('draw')
}

// This gate controls submission only. Tres still owns logical size, DPR and buffer
// writes, and Three can initialize or resize backend resources before this guard.
const PositiveSizeRender = defineComponent({
  setup() {
    const { renderer, scene, camera } = useTresContext()
    const { render } = useLoop()
    const canvas = renderer.instance.domElement
    const host = canvas.parentElement
    if (!host) throw new Error('The graphics canvas needs a sized DOM parent.')
    let width = 0
    let height = 0
    let retired = false
    const observer = new ResizeObserver(([entry]) => {
      if (retired || ownerRetired || !entry) return
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
      // Wake a static scene even when its on-demand frame budget is already zero.
      if (width > 0 && height > 0) renderer.invalidate()
    })
    render((notifySuccess) => {
      const activeCamera = camera.activeCamera.value
      const dpr = renderer.instance.getPixelRatio()
      if (
        retired || ownerRetired || !host.isConnected || host.clientWidth <= 0 || host.clientHeight <= 0
        || width <= 0 || height <= 0 || canvas.width <= 0 || canvas.height <= 0
        || canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)
        || !activeCamera
        || (isPerspectiveCamera(activeCamera) && (!Number.isFinite(activeCamera.aspect) || activeCamera.aspect <= 0))
      ) return // Retain the pending frame until an actual positive-size draw.
      try {
        renderer.instance.render(scene.value, activeCamera)
        notifySuccess()
      } catch (cause) {
        renderer.loop.stop()
        reportError(cause)
        throw cause // Keep the native draw failure observable as well as in DOM.
      }
    })
    observer.observe(host)
    onBeforeUnmount(() => {
      retired = true
      observer.disconnect()
    })
    return () => null
  },
})

onBeforeUnmount(() => {
  ownerRetired = true
  activeContext?.renderer.loop.stop()
  observedCanvas?.removeEventListener('webglcontextlost', onContextLost)
  // Core invokes dispose once. Three r187 waits for pending init; it cannot cancel it.
})
</script>

<template>
  <div
    class="scene"
    role="img"
    :aria-label="props.choice === 'webgl' ? 'Blue cube shaded by ambient and directional lights' : 'Experimental blue cube with an unlit Basic material'"
  >
    <component
      :is="Canvas"
      ref="canvasOwner"
      render-mode="on-demand"
      :dpr="1"
      :fps-limit="30"
      :antialias="true"
      :alpha="false"
      clear-color="#17212b"
      @ready="onReady"
      @render="onDraw"
      @error="reportError"
    >
      <PositiveSizeRender />
      <TresPerspectiveCamera :position="[3, 2, 4]" :look-at="[0, 0, 0]" />
      <TresAmbientLight v-if="props.choice === 'webgl'" :intensity="0.8" />
      <TresDirectionalLight v-if="props.choice === 'webgl'" :position="[3, 4, 2]" :intensity="2" />
      <SpinningCube :playing="props.playing" :unlit="props.choice === 'experimental'" />
    </component>
  </div>
</template>

<style scoped>
.scene { width: 100%; height: 22rem; min-width: 0; }
</style>
