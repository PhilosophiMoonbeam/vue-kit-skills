<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { ButtonHTMLAttributes, Component } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'

type RendererChoice = 'webgl' | 'experimental'
type Phase = 'idle' | 'loading' | 'initialized' | 'drawn' | 'stopped' | 'error' | 'lost'
interface SceneSession {
  id: number
  component: Component
  choice: RendererChoice
  onReady: (backend: string) => void
  onDraw: () => void
  onError: (cause: unknown) => void
  onLost: (message: string) => void
}

const choice = ref<RendererChoice>('experimental')
const phase = ref<Phase>('idle')
const session = shallowRef<SceneSession | null>(null)
const backend = ref('Not initialized')
const failure = ref('')
const visible = ref(true)
const width = ref('100%')
const playing = ref(false)
const reducedMotion = ref(true)
const webGpuExposed = ref<boolean | null>(null)
let nextId = 0
let alive = true
let motionQuery: MediaQueryList | undefined

const status = computed(() => {
  if (phase.value === 'idle') return 'Not started. Choose a renderer, then start the scene.'
  if (phase.value === 'stopped') return 'Stopped. Start creates a fresh scene.'
  if (phase.value === 'error') return 'Scene unavailable. Read the error below; you can change renderer or try starting again.'
  if (phase.value === 'lost') return 'Graphics context or device lost. The scene was retired; start again to create a fresh renderer.'
  if (!visible.value) return 'Viewport hidden. The scene stays mounted; drawing waits for a real positive size.'
  if (width.value === '0px') return 'Viewport is zero width. Drawing waits for a real positive size; choose Narrow or Full width to continue.'
  if (phase.value === 'loading') return 'Loading the renderer and waiting for initialization and a positive drawing buffer.'
  if (phase.value === 'initialized') return 'Renderer initialized. Waiting for the first positive-size draw.'
  return playing.value
    ? 'Scene active. Rotation is playing with explicit on-demand redraws.'
    : 'Scene active. Rotation is paused; static frames render on demand.'
})

function syncMotion(): void {
  reducedMotion.value = motionQuery?.matches ?? true
  if (reducedMotion.value) playing.value = false
}

onMounted(() => {
  webGpuExposed.value = 'gpu' in navigator
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncMotion()
  motionQuery.addEventListener('change', syncMotion)
})

function isCurrent(id: number): boolean {
  return alive && session.value?.id === id
}

function retire(nextPhase: Phase): void {
  // Removing this owner unmounts Tres; a replacement never reuses its renderer.
  session.value = null
  playing.value = false
  phase.value = nextPhase
}

function reportError(id: number, cause: unknown): void {
  // Preserve the original failure even if an old async owner has already gone away.
  console.error('[Graphics] Scene error:', cause)
  if (!isCurrent(id)) return
  failure.value = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)
  retire('error')
}

function startScene(): void {
  if (session.value) return
  const id = ++nextId
  failure.value = ''
  backend.value = 'Not initialized'
  playing.value = false
  phase.value = 'loading'
  session.value = {
    id,
    choice: choice.value,
    // Neither this module nor its GPU dependencies are requested until Start.
    component: defineAsyncComponent({
      loader: () => import('./graphics/GraphicsScene.vue'),
      onError(cause, _retry, fail) {
        reportError(id, cause)
        fail() // Keep Vue's original import failure observable; do not fake a scene.
      },
    }),
    onReady(actualBackend) {
      if (!isCurrent(id)) return
      backend.value = actualBackend
      phase.value = 'initialized'
    },
    onDraw() {
      if (isCurrent(id)) phase.value = 'drawn'
    },
    onError: cause => reportError(id, cause),
    onLost(message) {
      if (!isCurrent(id)) return
      failure.value = message
      retire('lost')
    },
  }
}

function stopScene(): void {
  retire('stopped')
}

function toggleRotation(): void {
  if (phase.value !== 'drawn' || reducedMotion.value || !visible.value || width.value === '0px') return
  playing.value = !playing.value
}

watch(choice, () => {
  retire(session.value ? 'stopped' : 'idle')
  backend.value = 'Not initialized'
  failure.value = ''
})
watch([visible, width], () => {
  if (!visible.value || width.value === '0px') playing.value = false
})
onBeforeUnmount(() => {
  alive = false
  session.value = null
  playing.value = false
  motionQuery?.removeEventListener('change', syncMotion)
})
</script>

<template>
  <section class="graphics-page" aria-labelledby="graphics-heading">
    <header class="page-heading">
      <p class="section-kicker">Optional rendering</p>
      <h2 id="graphics-heading" class="page-title">Graphics</h2>
      <p class="page-description">Choose a renderer and start the scene. The controls and text remain usable without 3D.</p>
    </header>

    <div class="graphics-layout">
      <section class="control-panel" aria-labelledby="controls-heading">
        <h3 id="controls-heading" class="section-title">Scene controls</h3>
        <label class="field-label" for="renderer-choice">Renderer</label>
        <select id="renderer-choice" v-model="choice" class="select-control" aria-describedby="renderer-help">
          <option value="experimental">WebGPURenderer · recommended (experimental)</option>
          <option value="webgl">WebGLRenderer · compatibility (WebGL 2)</option>
        </select>
        <p id="renderer-help" class="control-help">Prefer WebGPURenderer for new scenes, with WebGPU or its built-in WebGL 2 backend. Materials, effects, dependencies, and features must support both backends for fallback to work. Choose WebGLRenderer explicitly when a pipeline requires GLSL ShaderMaterial, onBeforeCompile, or legacy EffectComposer; it is not an automatic fallback. Changing renderer stops the scene. Start again to initialize your selection.</p>
        <p v-if="choice === 'experimental'" class="experimental-note">
          Experimental, unlit Basic-material baseline. WebGPURenderer can select WebGPU or its built-in WebGL 2 fallback; its name alone is not proof of WebGPU support.
          <span v-if="webGpuExposed === false">This browser does not expose the WebGPU API here. The renderer may choose WebGL 2.</span>
          Hardware, lighting/PBR, custom shaders, and postprocessing are not certified by this baseline.
        </p>

        <div class="button-row">
          <VBtn
            class="control-button"
            v-bind="{ type: 'button', onClick: startScene } satisfies ButtonHTMLAttributes"
            color="primary"
            variant="flat"
            :disabled="session !== null"
          >
            Start scene
          </VBtn>
          <VBtn
            class="control-button"
            v-bind="{ type: 'button', onClick: stopScene } satisfies ButtonHTMLAttributes"
            variant="outlined"
            :disabled="session === null"
          >
            Stop scene
          </VBtn>
        </div>

        <details class="viewport-experiments">
          <summary>Resize and visibility</summary>
          <fieldset class="viewport-controls">
            <legend>Viewport boundary</legend>
            <label class="checkbox-label" for="viewport-visible">
              <input id="viewport-visible" v-model="visible" type="checkbox">
              Show viewport
            </label>
            <label class="field-label" for="viewport-width">Viewport width</label>
            <select id="viewport-width" v-model="width" class="select-control" aria-describedby="viewport-help">
              <option value="100%">Full width</option>
              <option value="50%">Narrow (50%)</option>
              <option value="0px">Zero width (0 px)</option>
            </select>
            <p id="viewport-help" class="control-help">These controls keep the scene mounted. Hiding or choosing zero width pauses rotation.</p>
          </fieldset>
        </details>

        <VBtn
          class="control-button rotation-button"
          v-bind="{ type: 'button', onClick: toggleRotation, 'aria-pressed': playing } satisfies ButtonHTMLAttributes"
          variant="outlined"
          :disabled="phase !== 'drawn' || reducedMotion || !visible || width === '0px'"
        >
          {{ playing ? 'Pause rotation' : 'Play rotation' }}
        </VBtn>
        <p class="control-help">{{ reducedMotion ? 'Rotation is disabled by your reduced-motion preference.' : 'Rotation is optional. A paused scene has no continuous draws.' }}</p>
      </section>

      <section class="scene-panel" aria-labelledby="preview-heading">
        <div class="preview-heading">
          <h3 id="preview-heading" class="section-title">Scene preview</h3>
          <span class="scene-kind">{{ choice === 'webgl' ? 'Lit Standard material' : 'Experimental · unlit Basic material' }}</span>
        </div>
        <div class="viewport-stage">
          <div v-show="visible" class="viewport" :style="{ width }">
            <component
              :is="session.component"
              v-if="session"
              :key="session.id"
              :choice="session.choice"
              :playing="playing && !reducedMotion"
              @ready="session.onReady"
              @draw="session.onDraw"
              @error="session.onError"
              @lost="session.onLost"
            />
          </div>
          <p v-if="!session || !visible || width === '0px'" class="viewport-note">
            {{ !session ? 'No active canvas. The scene description remains available below.' : !visible ? 'Viewport hidden — scene retained, drawing paused.' : 'Zero-width viewport — scene retained, waiting for positive size.' }}
          </p>
        </div>
        <div class="scene-status" role="status" aria-live="polite" aria-atomic="true">
          <p>{{ status }}</p>
          <p><strong>Initialized backend:</strong> {{ backend }}{{ !session && backend !== 'Not initialized' ? ' (previous scene; now retired)' : '' }}</p>
        </div>
        <div v-if="failure" class="failure-message" role="alert">
          <h4>{{ phase === 'lost' ? 'Scene retired after native loss' : 'Scene could not continue' }}</h4>
          <p class="raw-error">{{ failure }}</p>
          <p>The text alternative is still available. Check browser graphics support, try another renderer explicitly, or start a fresh scene. Original failures remain in the browser console; the experimental version has a known upstream failed-initialization teardown limitation.</p>
        </div>
        <div class="scene-description">
          <h4>What the scene represents</h4>
          <p v-if="choice === 'webgl'">A blue cube viewed from above and to the side against a dark background. Ambient and directional lights shade its Standard material. Optional rotation turns it around its vertical axis; it conveys no additional information.</p>
          <p v-else>A blue cube viewed from above and to the side against a dark background. Its Basic material is intentionally unlit, so faces do not demonstrate directional lighting or PBR. Optional rotation turns it around its vertical axis; it conveys no additional information.</p>
          <details>
            <summary>Rendering and lifecycle limits</summary>
            <p>Initialization identifies the renderer and backend, not visible pixels. Active means a positive-size frame was submitted, not a readback or a hardware-support guarantee. Stop, backend changes, native loss, and leaving this page retire the scene. Returning always requires Start. The pinned Tres 5.9.3 / Three 0.186.1 experimental path retains known upstream failed-initialization teardown and in-flight unmount limits.</p>
          </details>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.page-heading { margin-block-end: 2rem; }
.section-kicker {
  margin: 0 0 0.75rem;
  color: rgb(var(--v-theme-primary));
  font-size: 0.75rem;
  font-weight: 650;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.page-title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 2.75rem);
  line-height: 1.15;
  font-weight: 650;
  letter-spacing: -0.045em;
}
.page-description { max-width: 42rem; margin: 1rem 0 0; line-height: 1.75; opacity: 0.85; }
.graphics-layout { display: grid; grid-template-columns: minmax(15rem, 19rem) minmax(0, 1fr); gap: 2rem; align-items: start; }
.control-panel {
  min-width: 0;
  padding: 1.25rem;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 0.75rem;
  background: rgb(var(--v-theme-surface));
}
.section-title { margin: 0 0 1rem; font-size: 1.125rem; font-weight: 650; letter-spacing: -0.02em; }
.field-label { display: block; margin-block: 1rem 0.5rem; font-size: 0.875rem; font-weight: 600; }
.select-control {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.5);
  border-radius: 0.25rem;
  color: rgb(var(--v-theme-on-surface));
  background: rgb(var(--v-theme-surface));
  font: inherit;
  font-size: 0.875rem;
}
.control-help { margin: 0.65rem 0 0; font-size: 0.8125rem; line-height: 1.65; opacity: 0.85; }
.experimental-note { margin-block: 1rem; padding-inline-start: 0.75rem; border-inline-start: 3px solid rgb(var(--v-theme-primary)); font-size: 0.8125rem; line-height: 1.7; }
.button-row { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-block-start: 1.25rem; }
.control-button { text-transform: none; letter-spacing: 0; }
.viewport-experiments { margin-block-start: 1.25rem; font-size: 0.875rem; }
.viewport-experiments > summary, .scene-description summary { cursor: pointer; font-weight: 650; }
.viewport-experiments > summary:focus-visible, .scene-description summary:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 4px; }
.viewport-controls { min-width: 0; margin: 1.5rem 0 0; padding: 1rem 0 0; border: 0; border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.2); }
.viewport-controls legend { padding-inline-end: 0.5rem; font-size: 0.875rem; font-weight: 650; }
.checkbox-label { display: flex; align-items: center; gap: 0.65rem; min-height: 2.75rem; font-size: 0.875rem; cursor: pointer; }
.checkbox-label input { width: 1.125rem; height: 1.125rem; accent-color: rgb(var(--v-theme-primary)); }
.rotation-button { margin-block-start: 1.25rem; }
.scene-panel { min-width: 0; }
.preview-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.25rem 1rem; }
.scene-kind { margin-block-end: 1rem; font-size: 0.75rem; opacity: 0.8; }
.viewport-stage { position: relative; min-height: 22rem; overflow: hidden; border-radius: 0.75rem; background: #17212b; color: #f3f6f9; }
.viewport { height: 22rem; min-width: 0; }
.viewport-note { position: absolute; inset: 0; display: grid; place-content: center; margin: 0; padding: 2rem; text-align: center; font-size: 0.9375rem; line-height: 1.75; pointer-events: none; }
.scene-status { padding-block: 1rem; border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.2); font-size: 0.8125rem; line-height: 1.7; }
.scene-status p { margin: 0 0 0.25rem; }
.failure-message { margin-block-start: 1.25rem; padding: 1rem; border: 2px solid rgb(var(--v-theme-error)); border-radius: 0.5rem; font-size: 0.875rem; line-height: 1.7; }
.failure-message h4, .scene-description h4 { margin: 0 0 0.5rem; font-size: 0.9375rem; font-weight: 650; }
.failure-message p { margin: 0.5rem 0 0; }
.raw-error { white-space: pre-wrap; overflow-wrap: anywhere; font-family: ui-monospace, monospace; }
.scene-description { margin-block-start: 1.25rem; font-size: 0.875rem; line-height: 1.8; }
.scene-description p { margin: 0.5rem 0 0; }
.select-control:focus-visible, .checkbox-label input:focus-visible, .control-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 4px; }
@media (max-width: 800px) {
  .graphics-layout { grid-template-columns: minmax(0, 1fr); }
}
</style>
