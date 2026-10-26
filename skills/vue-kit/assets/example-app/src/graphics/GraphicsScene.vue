<script setup lang="ts">
import { defineComponent, onBeforeUnmount, onErrorCaptured, onMounted, toValue, useTemplateRef } from 'vue'
import {
  isPerspectiveCamera, isWebGLRenderer, isWebGPURenderer, TresCanvas, useLoop, useTresContext,
  type TresContext, type TresRendererSetupContext,
} from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'
import SpinningCube from './SpinningCube.vue'

const props = defineProps<{ choice: 'webgl' | 'experimental'; playing: boolean }>()
const emit = defineEmits<{
  ready: [backend: string]
  draw: []
  error: [cause: unknown]
  lost: [message: string]
}>()
const sceneHost = useTemplateRef<HTMLDivElement>('sceneHost')
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

const createExperimentalRenderer = (context: TresRendererSetupContext) => {
  const canvas = toValue(context.canvas)
  observeCanvas(canvas)
  const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: false })
  onBeforeUnmount(() => {
    // Tres owns normal disposal. r186's early dispose skips pending init resources.
    // init() returns the existing native promise; no adapter/device is probed here.
    if (!renderer.initialized) {
      void renderer.init().then(
        () => renderer.dispose(),
        cause => reportError(cause),
      )
    }
  })
  return renderer
}

// Backend flags/device are read only after native initialization. These fields are
// pinned to Three r186, not a portable backend-introspection or capability API.
interface InitializedBackend {
  isWebGPUBackend?: boolean
  isWebGLBackend?: boolean
  device?: { lost: Promise<{ reason: string; message: string }> }
}

function onReady(context: TresContext): void {
  if (ownerRetired) {
    context.renderer.loop.stop()
    return
  }
  activeContext = context
  const instance = context.renderer.instance
  observeCanvas(instance.domElement)
  if (isWebGLRenderer(instance)) {
    emit('ready', 'WebGL 2 · WebGLRenderer')
  } else if (isWebGPURenderer(instance)) {
    const backend = instance.backend as unknown as InitializedBackend
    emit('ready', backend.isWebGPUBackend === true
      ? 'WebGPU · WebGPURenderer (experimental)'
      : backend.isWebGLBackend === true
        ? 'WebGL 2 fallback · WebGPURenderer (experimental)'
        : 'Unconfirmed backend · WebGPURenderer (experimental)')
    if (backend.device) {
      // Observe the already-owned device, including its native 'destroyed' reason.
      // Keep Three's own onDeviceLost/onError callbacks completely unchanged.
      void backend.device.lost.then(info => {
        if (ownerRetired || activeContext?.renderer.instance !== instance) return
        retireAfterLoss(`Native WebGPU device lost (${info.reason}): ${info.message || 'No additional message.'}`)
      }, reportError)
    }
  } else {
    emit('ready', 'Unconfirmed renderer and backend')
  }
}

function onDraw(): void {
  if (ownerRetired || firstDraw) return
  firstDraw = true
  emit('draw')
}

// Public custom-render gate retained from references/tresjs.md. This owns draw
// eligibility only: Tres still owns camera, logical sizing, DPR and buffer writes.
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

onMounted(() => {
  const canvas = sceneHost.value?.querySelector('canvas')
  if (canvas) observeCanvas(canvas)
})
onBeforeUnmount(() => {
  ownerRetired = true
  activeContext?.renderer.loop.stop()
  observedCanvas?.removeEventListener('webglcontextlost', onContextLost)
})
</script>

<template>
  <div
    ref="sceneHost"
    class="scene"
    role="img"
    :aria-label="props.choice === 'webgl' ? 'Blue cube shaded by ambient and directional lights' : 'Experimental blue cube with an unlit Basic material'"
  >
    <TresCanvas
      :renderer="props.choice === 'experimental' ? createExperimentalRenderer : undefined"
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
    </TresCanvas>
  </div>
</template>

<style scoped>
.scene { width: 100%; height: 22rem; min-width: 0; }
</style>
