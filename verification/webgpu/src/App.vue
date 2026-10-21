<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'

type Mode = 'normal' | 'adapter-unavailable' | 'device-rejected' | 'both-unavailable' | 'device-and-fallback-unavailable'
type Command = 'unmount' | 'capture' | 'inspect'
type JsonRecord = Record<string, unknown>

interface FrameState {
  secureContext: boolean
  mode: Mode
  versions: { vue: string; core: string; three: string }
  userAgent: string
  adapter?: unknown
  deviceCreated: boolean
  backend: 'webgpu' | 'webgl2' | 'pending' | 'unknown' | 'unavailable'
  canvasMounted: boolean
  unhandledCount: number
}

interface LabEvent {
  id: number
  runId: string
  mode: Mode
  receivedAt: string
  time: string | number
  category: string
  message: string
  detail?: unknown
}

interface Capture {
  dataUrl?: string
  error?: string
  receivedAt: string
}

interface Run {
  id: string
  mode: Mode
  startedAt: string
  state: FrameState | null
  events: LabEvent[]
  capture: Capture | null
  unmountRequested: boolean
}

const cases: { value: Mode; label: string; description: string }[] = [
  {
    value: 'normal',
    label: 'Normal · no injection',
    description: 'Uses the browser’s actual capabilities. Native GPU and canvas API functions are left unchanged: no wrappers and no injected denials.',
  },
  {
    value: 'adapter-unavailable',
    label: 'Injected · adapter unavailable',
    description: 'Test intervention: requestAdapter returns null. Three may select its WebGL2 fallback if that backend is available.',
  },
  {
    value: 'device-rejected',
    label: 'Injected · device request rejected',
    description: 'Test intervention: requestDevice rejects after adapter acquisition. Three may select its WebGL2 fallback if available.',
  },
  {
    value: 'both-unavailable',
    label: 'Injected · adapter + fallback unavailable',
    description: 'Test intervention: requestAdapter returns null and WebGL2 context creation is denied. Initialization is expected to fail.',
  },
  {
    value: 'device-and-fallback-unavailable',
    label: 'Injected · device + fallback unavailable',
    description: 'Test intervention: requestDevice rejects and WebGL2 context creation is denied. Initialization is expected to fail.',
  },
]

const provenance = {
  source: 'skills/vue-kit/references/tresjs.md',
  recipe: 'SceneHost.vue + Experimental WebGPU and custom rendering / SceneCanvas.vue',
  hostVariant: 'WebGPU host uses onMounted(() => { ready.value = true }); no WebGL preflight.',
  pins: { vue: '3.5.44', core: '5.9.3', three: '0.186.1' },
  isolation: 'Fresh same-origin case.html iframe on every Start. Diagnostic instrumentation surrounds the retained recipe.',
  servedSources: {
    host: '/source/SceneHost.vue',
    canvas: '/source/SceneCanvas.vue',
    instrumentation: '/source/frame.ts',
    inspectionUi: '/source/App.vue',
    reference: '/source/tresjs.md',
    hashes: '/source/provenance.json',
  },
}

const selectedMode = shallowRef<Mode>('normal')
const runs = ref<Run[]>([])
const currentRunId = shallowRef('')
const frameSrc = shallowRef('')
const frameLoaded = shallowRef(false)
const capturePending = shallowRef(false)
const announcement = shallowRef('')
const hiddenThroughEventId = shallowRef(0)
const frame = useTemplateRef<HTMLIFrameElement>('case-frame')
let runSequence = 0
let eventSequence = 0
let captureTimeout: ReturnType<typeof setTimeout> | undefined

const currentRun = computed(() => runs.value.find((run) => run.id === currentRunId.value) ?? null)
const observed = computed(() => currentRun.value?.state ?? null)
const selectedCase = computed(() => cases.find((item) => item.value === selectedMode.value)!)
const activeCase = computed(() => cases.find((item) => item.value === currentRun.value?.mode))
const allEvents = computed(() => runs.value.flatMap((run) => run.events))
const visibleEvents = computed(() => allEvents.value.filter((event) => event.id > hiddenThroughEventId.value))
const capture = computed(() => currentRun.value?.capture ?? null)
const canCommand = computed(() => frameLoaded.value && currentRun.value !== null)
const adapterLabel = computed(() => {
  if (!observed.value || observed.value.adapter === undefined) return 'Not reported'
  if (observed.value.adapter === null) return 'None returned'
  return 'Reported · see raw JSON'
})
const rawReport = computed(() => JSON.stringify({
  provenance,
  currentRunId: currentRunId.value,
  runs: runs.value.map((run) => ({
    ...run,
    capture: run.capture ? {
      receivedAt: run.capture.receivedAt,
      error: run.capture.error,
      pngAvailable: Boolean(run.capture.dataUrl),
    } : null,
  })),
}, null, 2))

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFrameState(value: unknown): value is FrameState {
  if (!isRecord(value) || !isRecord(value.versions)) return false
  return typeof value.secureContext === 'boolean'
    && value.mode === currentRun.value?.mode
    && typeof value.versions.vue === 'string'
    && typeof value.versions.core === 'string'
    && typeof value.versions.three === 'string'
    && typeof value.userAgent === 'string'
    && typeof value.deviceCreated === 'boolean'
    && ['webgpu', 'webgl2', 'pending', 'unknown', 'unavailable'].includes(String(value.backend))
    && typeof value.canvasMounted === 'boolean'
    && typeof value.unhandledCount === 'number'
    && Number.isFinite(value.unhandledCount)
}

function appendEvent(run: Run, category: string, message: string, detail?: unknown, time: string | number = new Date().toISOString()) {
  run.events.push({ id: ++eventSequence, runId: run.id, mode: run.mode, receivedAt: new Date().toISOString(), time, category, message, detail })
}

function clearCaptureTimeout() {
  if (captureTimeout !== undefined) clearTimeout(captureTimeout)
  captureTimeout = undefined
}

function startRun() {
  clearCaptureTimeout()
  capturePending.value = false
  frameLoaded.value = false
  const id = `${Date.now().toString(36)}-${++runSequence}`
  const run: Run = {
    id, mode: selectedMode.value, startedAt: new Date().toISOString(), state: null,
    events: [], capture: null, unmountRequested: false,
  }
  runs.value.push(run)
  currentRunId.value = id
  const url = new URL('/case.html', window.location.origin)
  url.searchParams.set('mode', run.mode)
  url.searchParams.set('run', id)
  frameSrc.value = url.href
  appendEvent(run, 'shell', `Started ${run.mode} in a fresh iframe.`, { injected: run.mode !== 'normal' })
  announcement.value = `Started ${run.mode}. Previous run records are retained below and in the JSON export.`
}

function sendCommand(command: Command) {
  const run = currentRun.value
  const target = frame.value?.contentWindow
  if (!run || !target || !frameLoaded.value) return false
  target.postMessage({ channel: 'vue-kit-webgpu-lab-command', runId: run.id, command }, window.location.origin)
  return true
}

function frameDidLoad() {
  frameLoaded.value = true
  sendCommand('inspect')
}

function unmountScene() {
  const run = currentRun.value
  if (!run || !sendCommand('unmount')) return
  run.unmountRequested = true
  appendEvent(run, 'shell', 'Unmount requested. The iframe and its error listeners remain alive.')
  announcement.value = 'Unmount requested. Keep watching events for cleanup errors; use Start to mount a fresh case.'
}

function requestCapture() {
  const run = currentRun.value
  if (!run || !sendCommand('capture')) return
  capturePending.value = true
  run.capture = null
  announcement.value = 'Reading the current canvas as PNG inside the case frame.'
  clearCaptureTimeout()
  captureTimeout = setTimeout(() => {
    if (currentRunId.value !== run.id) return
    capturePending.value = false
    run.capture = { error: 'No capture response received within 10 seconds. The frame may still be initializing; you can capture again.', receivedAt: new Date().toISOString() }
    announcement.value = run.capture.error!
  }, 10_000)
}

function receiveMessage(event: MessageEvent<unknown>) {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  const payload = event.data
  const run = currentRun.value
  if (!run || !isRecord(payload) || payload.channel !== 'vue-kit-webgpu-lab' || payload.runId !== run.id) return
  const data = payload.data
  if (payload.kind === 'state' && isFrameState(data)) {
    run.state = data
  } else if (payload.kind === 'event' && isRecord(data)
    && typeof data.category === 'string' && typeof data.message === 'string'
    && (typeof data.time === 'string' || typeof data.time === 'number')) {
    appendEvent(run, data.category, data.message, data.detail, data.time)
  } else if (payload.kind === 'capture' && isRecord(data)) {
    const dataUrl = typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:image/png;base64,') ? data.dataUrl : undefined
    const error = typeof data.error === 'string' ? data.error : undefined
    if (!dataUrl && !error) return
    clearCaptureTimeout()
    capturePending.value = false
    run.capture = { dataUrl, error, receivedAt: new Date().toISOString() }
    announcement.value = error ? `Canvas capture failed: ${error}` : 'Canvas PNG captured. Inspect it below or download the PNG.'
  }
}

function downloadJson() {
  const report = {
    exportedAt: new Date().toISOString(),
    provenance,
    currentRunId: currentRunId.value,
    note: 'Browser-local observations, including retained events and canvas captures. Injected denials are test interventions, not hardware diagnoses.',
    runs: runs.value,
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `webgpu-lab-${currentRunId.value || 'session'}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  announcement.value = 'JSON export prepared in your browser. It has not been uploaded.'
}

function clearEventDisplay() {
  hiddenThroughEventId.value = eventSequence
  announcement.value = 'Event display cleared. Retained records are still included in raw JSON and the download.'
}

function detailText(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function formatEventTime(event: LabEvent) {
  if (typeof event.time === 'number') return `${event.time.toFixed(1)} ms`
  return event.time
}

function isErrorEvent(category: string) {
  return ['component-error', 'unhandled-rejection', 'window-error', 'gpu-validation'].includes(category)
}

onMounted(() => {
  window.addEventListener('message', receiveMessage)
  startRun()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', receiveMessage)
  clearCaptureTimeout()
})
</script>

<template>
  <div class="lab-shell">
    <a class="skip-link" href="#case-controls">Skip to case controls</a>
    <header class="masthead">
      <div>
        <p class="eyebrow">Vue kit / independent browser inspection</p>
        <h1>WebGPU recipe lab<span class="title-dot" aria-hidden="true">.</span></h1>
        <p class="intro">Run the retained TresJS recipe in your browser. Separate real capabilities from deliberate failure tests, then inspect rendering and cleanup.</p>
      </div>
      <div class="version-stamp" aria-label="Pinned runtime versions">
        <span>PINNED RUNTIME</span>
        <strong>Vue 3.5.44</strong>
        <span>@tresjs/core 5.9.3 · Three 0.186.1</span>
      </div>
    </header>

    <main>
      <section id="case-controls" class="controls panel" aria-labelledby="controls-title" tabindex="-1">
        <div class="section-heading">
          <div><p class="eyebrow">01 / Configure</p><h2 id="controls-title">Choose a case</h2></div>
          <span class="tag" :class="{ 'tag-warning': selectedMode !== 'normal' }">{{ selectedMode === 'normal' ? 'No fault injection selected' : 'Explicit fault injection selected' }}</span>
        </div>
        <form class="case-form" @submit.prevent="startRun">
          <div class="case-field">
            <label for="case-mode">Case to start</label>
            <select id="case-mode" v-model="selectedMode" aria-describedby="case-description case-help">
              <option v-for="item in cases" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <button class="button button-primary" type="submit">Start / restart case <span aria-hidden="true">↗</span></button>
        </form>
        <p id="case-description" class="case-description">{{ selectedCase.description }}</p>
        <p id="case-help" class="muted small">Changing the selection does not affect the running case. Start creates a new iframe and resets overrides; earlier run logs remain in this session.</p>
      </section>

      <div class="inspection-grid">
        <section class="scene-panel panel" aria-labelledby="scene-title">
          <div class="section-heading">
            <div><p class="eyebrow">02 / Live recipe</p><h2 id="scene-title">Canvas under observation</h2></div>
            <span class="tag" :class="{ 'tag-warning': currentRun?.mode !== 'normal' }">{{ currentRun?.mode === 'normal' ? 'Normal' : 'Injected case' }}</span>
          </div>
          <p class="active-case">{{ activeCase?.label ?? 'Preparing case' }}</p>
          <div class="frame-wrap">
            <iframe
              v-if="frameSrc"
              :key="currentRunId"
              ref="case-frame"
              class="case-frame"
              :src="frameSrc"
              title="Live TresJS WebGPU recipe and its DOM fallback"
              @load="frameDidLoad"
            />
          </div>
          <div class="scene-actions">
            <button class="button" type="button" :disabled="!canCommand || currentRun?.unmountRequested" @click="unmountScene">Unmount scene</button>
            <button class="button" type="button" :disabled="!canCommand || capturePending || !observed?.canvasMounted" @click="requestCapture">{{ capturePending ? 'Capturing…' : 'Capture canvas PNG' }}</button>
            <a v-if="capture?.dataUrl" class="button" :href="capture.dataUrl" :download="`webgpu-${currentRunId}.png`">Download PNG</a>
          </div>
          <p class="muted small">Unmount keeps the frame and listeners alive so late cleanup errors stay observable. Start is required to mount again.</p>
          <p class="muted small">Capture reads the current drawing buffer without changing the recipe. A blank or transparent readback can occur after the buffer is discarded even while the live canvas is visible; it is not, by itself, evidence of rendering failure.</p>
          <p v-if="capture?.error" class="capture-error" role="alert">{{ capture.error }}</p>
          <details v-if="capture?.dataUrl" class="capture-details" open>
            <summary>Canvas readback · {{ capture.receivedAt }}</summary>
            <img class="canvas-capture" :src="capture.dataUrl" alt="PNG read directly from the current recipe canvas" />
          </details>
        </section>

        <section class="status-panel panel" aria-labelledby="status-title">
          <div class="section-heading"><div><p class="eyebrow">03 / Observed state</p><h2 id="status-title">What this run reports</h2></div></div>
          <dl class="observations">
            <div><dt>Active backend</dt><dd class="backend">{{ observed?.backend ?? 'Awaiting frame' }}</dd></div>
            <div><dt>Secure context</dt><dd>{{ observed ? (observed.secureContext ? 'Yes' : 'No') : 'Not reported' }}</dd></div>
            <div><dt>WebGPU device created</dt><dd>{{ observed ? (observed.deviceCreated ? 'Observed' : 'Not observed') : 'Not reported' }}</dd></div>
            <div><dt>Adapter</dt><dd>{{ adapterLabel }}</dd></div>
            <div><dt>Canvas mounted</dt><dd>{{ observed ? (observed.canvasMounted ? 'Yes' : 'No') : 'Not reported' }}</dd></div>
            <div><dt>Unhandled rejections</dt><dd :class="{ 'error-text': (observed?.unhandledCount ?? 0) > 0 }">{{ observed?.unhandledCount ?? 'Not reported' }}</dd></div>
          </dl>
          <p class="muted small">Backend is reported only from the real renderer context, not its WebGPURenderer family name. Pending or unknown means the backend has not been established; canvas presence is not proof. A separate browser capability probe, if reported, is not renderer-backend evidence. WebGL2 fallback can be a valid normal result.</p>
          <button class="button inspect-button" type="button" :disabled="!canCommand" @click="sendCommand('inspect')">Refresh observed state</button>
          <div class="run-identity"><span>Current run</span><code>{{ currentRunId || 'Preparing' }}</code><span>{{ currentRun?.startedAt }}</span></div>
          <details v-if="observed" class="runtime-details">
            <summary>Reported runtime &amp; browser</summary>
            <dl class="runtime-list">
              <div><dt>Vue</dt><dd>{{ observed.versions.vue }}</dd></div>
              <div><dt>@tresjs/core</dt><dd>{{ observed.versions.core }}</dd></div>
              <div><dt>Three</dt><dd>{{ observed.versions.three }}</dd></div>
            </dl>
            <p class="small browser-agent">{{ observed.userAgent }}</p>
          </details>
        </section>
      </div>

      <section class="events-panel panel" aria-labelledby="events-title">
        <div class="section-heading events-heading">
          <div><p class="eyebrow">04 / Chronology</p><h2 id="events-title">Events &amp; error details</h2></div>
          <div class="event-tools">
            <span class="muted small">{{ visibleEvents.length }} shown / {{ allEvents.length }} retained · {{ runs.length }} run{{ runs.length === 1 ? '' : 's' }}</span>
            <button class="button" type="button" :disabled="visibleEvents.length === 0" @click="clearEventDisplay">Clear event display</button>
            <button class="button" type="button" :disabled="runs.length === 0" @click="downloadJson">Download JSON</button>
          </div>
        </div>
        <p class="muted small">Oldest first, across retained runs. Frame timestamps are relative to that frame when numeric; shell timestamps are UTC. Expand details for escaped error text and stacks. Errors are not suppressed.</p>
        <ol v-if="visibleEvents.length" class="event-list" tabindex="0" aria-label="Scrollable event chronology">
          <li v-for="event in visibleEvents" :key="event.id" class="event" :class="{ 'event-error': isErrorEvent(event.category) }">
            <div class="event-meta"><span class="event-category">{{ event.category }}</span><time :datetime="event.receivedAt">{{ formatEventTime(event) }}</time><span>{{ event.mode }} / {{ event.runId }}</span></div>
            <p class="event-message">{{ event.message }}</p>
            <details v-if="event.detail !== undefined" class="event-details"><summary>Details / stack</summary><pre tabindex="0" aria-label="Scrollable event details">{{ detailText(event.detail) }}</pre></details>
          </li>
        </ol>
        <p v-else class="empty-events">No events in the display. New events will appear here; clearing never deletes retained export data.</p>
        <details class="raw-details"><summary>Raw diagnostic JSON · all retained runs</summary><p class="muted small">PNG bytes are omitted from this display only; the JSON download includes captured data URLs.</p><pre tabindex="0" aria-label="Scrollable raw diagnostic JSON">{{ rawReport }}</pre></details>
      </section>

      <section class="reading-notes" aria-labelledby="notes-title">
        <div><p class="eyebrow">Interpretation, not a verdict</p><h2 id="notes-title">Read the evidence in context</h2></div>
        <div class="note-grid">
          <div><h3>Normal is untouched</h3><p>The initial run is normal and leaves native GPU and canvas API functions unchanged, without passive wrappers. Other cases deliberately deny adapter, device, or fallback access; the event stream labels interventions. A test-induced denial is not proof that your hardware is unsupported or the recipe is universally broken.</p></div>
          <div><h3>Observe fallback and cleanup</h3><p>Three’s WebGPU renderer may use WebGL2. Cases denying both paths are expected to fail initialization. Inspect component errors and unhandled rejections separately, including after unmount; a visible DOM fallback alone does not establish clean recovery.</p></div>
          <div><h3>Check the actual canvas</h3><p>The live frame above runs the actual recipe, not a screenshot. Browser screenshots can omit a WebGPU canvas. Compare the live scene, direct readback and error chronology rather than treating either image channel alone as a rendering verdict.</p></div>
          <div><h3>Your observations stay here</h3><p>No analytics or result uploads. Logs and images stay in page memory until you download or leave. JSON may include browser and adapter details; inspect it before sharing. Downloads are generated locally in your browser.</p></div>
        </div>
      </section>
      <footer class="provenance">
        <h2>Source provenance</h2>
        <p><code>skills/vue-kit/references/tresjs.md</code> → <strong>SceneHost.vue</strong> and <strong>Experimental WebGPU / SceneCanvas.vue</strong>. The WebGPU host’s mount callback sets <code>ready = true</code> without the WebGL preflight. The lab surrounds that retained recipe with diagnostics and isolated, explicitly selected failure interventions.</p>
        <p class="small">Exact pins: Vue <strong>3.5.44</strong> · @tresjs/core <strong>5.9.3</strong> · Three <strong>0.186.1</strong>. Reported runtime versions appear with the observed state; each export records the source and pins.</p>
        <p class="small">Inspect the read-only served sources and exact hash metadata (links open a new tab):</p>
        <nav class="source-links" aria-label="Recipe source inspection">
          <a :href="provenance.servedSources.host" target="_blank" rel="noopener noreferrer">SceneHost.vue</a>
          <a :href="provenance.servedSources.canvas" target="_blank" rel="noopener noreferrer">SceneCanvas.vue</a>
          <a :href="provenance.servedSources.instrumentation" target="_blank" rel="noopener noreferrer">frame.ts</a>
          <a :href="provenance.servedSources.inspectionUi" target="_blank" rel="noopener noreferrer">App.vue</a>
          <a :href="provenance.servedSources.reference" target="_blank" rel="noopener noreferrer">tresjs.md</a>
          <a :href="provenance.servedSources.hashes" target="_blank" rel="noopener noreferrer">Provenance &amp; hashes</a>
        </nav>
      </footer>
    </main>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style>
:root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #182c37; background: #f2f4f1; font-synthesis: none; }
* { box-sizing: border-box; }
body { margin: 0; }
button, select { font: inherit; }
button, a, select, summary { -webkit-tap-highlight-color: transparent; }
::selection { color: #fff; background: #255c6d; }
</style>

<style scoped>
.lab-shell { max-width: 1440px; margin: 0 auto; padding: 3rem clamp(1rem, 3.4vw, 3rem); }
.skip-link { position: absolute; top: -6rem; left: 1rem; z-index: 10; padding: 1rem; color: #fff; background: #173f4c; }
.skip-link:focus { top: 1rem; }
.masthead { display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; padding-bottom: 2.5rem; }
.eyebrow { margin: 0 0 .6rem; color: #49616a; font-size: .71rem; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(2rem, 4.6vw, 3.8rem); line-height: 1.06; font-weight: 650; letter-spacing: -.05em; }
.title-dot { color: #c35124; }
.intro { max-width: 43rem; margin: 1rem 0 0; color: #49616a; font-size: 1.02rem; line-height: 1.65; }
.version-stamp { display: flex; flex: 0 0 auto; flex-direction: column; gap: .4rem; padding-left: 1.2rem; border-left: 3px solid #c35124; font-size: .76rem; line-height: 1.4; }
.version-stamp > span:first-child { font-size: .65rem; letter-spacing: .12em; }
.version-stamp strong { font-size: 1rem; }
.panel { min-width: 0; margin-bottom: 1.25rem; padding: 1.5rem; border: 1px solid #d4dedb; border-radius: .65rem; background: #fff; }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
h2 { margin: 0; font-size: 1.2rem; font-weight: 650; line-height: 1.3; letter-spacing: -.02em; }
.tag { display: inline-block; flex: 0 1 auto; border: 1px solid #c4ddd5; border-radius: .25rem; padding: .35rem .55rem; color: #225b48; background: #eff8f3; font-size: .72rem; font-weight: 650; line-height: 1.4; }
.tag-warning { border-color: #e5c9ab; background: #fff5e7; color: #805018; }
.case-form { display: flex; align-items: flex-end; gap: 1rem; }
.case-field { flex: 1; min-width: 0; }
.case-field label { display: block; margin-bottom: .45rem; font-size: .85rem; font-weight: 650; }
.case-field select { width: 100%; min-height: 2.9rem; padding: .6rem 2.2rem .6rem .8rem; border: 1px solid #91a5aa; border-radius: .3rem; color: #182c37; background: #fff; }
.button { display: inline-flex; align-items: center; justify-content: center; gap: .65rem; min-height: 2.75rem; border: 1px solid #a4b5b7; border-radius: .3rem; padding: .65rem .9rem; color: #213f4b; background: #fff; font-size: .82rem; line-height: 1.35; font-weight: 650; text-decoration: none; cursor: pointer; }
.button:hover:not(:disabled) { background: #edf3f2; border-color: #456a75; }
.button-primary { flex: 0 0 auto; min-height: 2.9rem; border-color: #174b5c; color: #fff; background: #174b5c; }
.button-primary:hover:not(:disabled) { color: #fff; background: #103846; }
.button:disabled { cursor: not-allowed; border-color: #d6dfdf; background: #f1f4f3; color: #727e82; }
:where(button, a, select, summary, .event-list, pre):focus-visible { outline: 3px solid #c35124; outline-offset: 3px; }
.controls:focus { outline: none; }
.controls:focus-visible { outline: 3px solid #c35124; outline-offset: 3px; }
.case-description { margin: .9rem 0 .35rem; font-size: .9rem; line-height: 1.6; }
.muted { color: #52666e; }
.small { font-size: .78rem; line-height: 1.65; }
.controls .small { margin: 0; }
.inspection-grid { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(17rem, 1fr); gap: 1.25rem; align-items: stretch; }
.scene-panel, .status-panel { display: flex; flex-direction: column; }
.active-case { margin: -.5rem 0 1rem; color: #52666e; font-size: .82rem; overflow-wrap: anywhere; }
.frame-wrap { overflow: hidden; min-height: 25rem; border: 1px solid #cbd6d8; border-radius: .3rem; background: #edf2f4; }
.case-frame { display: block; width: 100%; height: 29rem; border: 0; }
.scene-actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: 1rem; }
.scene-panel > .small { margin-bottom: 0; }
.observations { margin: 0; }
.observations > div { display: flex; justify-content: space-between; gap: 1rem; padding: .85rem 0; border-bottom: 1px solid #e4eae8; font-size: .82rem; line-height: 1.5; }
.observations > div:first-child { align-items: baseline; padding-top: 0; }
.observations dt { color: #52666e; }
.observations dd { margin: 0; font-weight: 650; text-align: right; overflow-wrap: anywhere; }
.observations .backend { color: #174b5c; font-size: 1.55rem; letter-spacing: -.03em; }
.observations .error-text { color: #a02d29; }
.inspect-button { align-self: flex-start; }
.run-identity { display: flex; flex-direction: column; gap: .3rem; margin-top: 1.5rem; color: #52666e; font-size: .7rem; line-height: 1.5; overflow-wrap: anywhere; }
.run-identity code { color: #213f4b; font-size: .8rem; }
.runtime-details { margin-top: 1rem; border-top: 1px solid #e4eae8; padding-top: 1rem; }
summary { color: #244a59; font-size: .8rem; font-weight: 650; line-height: 1.6; cursor: pointer; }
summary:hover { text-decoration: underline; }
.runtime-list { margin: .8rem 0; font-size: .8rem; }
.runtime-list > div { display: flex; gap: 1rem; justify-content: space-between; }
.runtime-list dd { margin: 0; }
.browser-agent { overflow-wrap: anywhere; }
.events-heading { align-items: center; }
.event-tools { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: .6rem; }
.event-tools > span { margin-right: .2rem; }
.event-list { max-height: 38rem; overflow-y: auto; margin: 1rem 0; padding: 0; list-style: none; scrollbar-gutter: stable; }
.event { border-top: 1px solid #e0e7e5; border-left: 3px solid #b8cecd; padding: .9rem .9rem .9rem 1rem; }
.event-error { border-left-color: #b44937; background: #fff8f6; }
.event-meta { display: flex; flex-wrap: wrap; gap: .35rem .9rem; color: #52666e; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .68rem; line-height: 1.7; overflow-wrap: anywhere; }
.event-category { color: #214e5c; font-weight: 750; }
.event-error .event-category { color: #a02d29; }
.event-message { margin: .45rem 0; font-size: .85rem; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.event-details { margin-top: .45rem; }
pre { max-height: 28rem; overflow: auto; margin: .75rem 0 0; padding: .85rem; border: 1px solid #d8e2e1; border-radius: .25rem; color: #233e49; background: #f3f6f5; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .72rem; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.raw-details { border-top: 1px solid #dce5e2; padding-top: 1rem; }
.empty-events { margin: 1.2rem 0; padding: 1.25rem; background: #f3f6f5; color: #52666e; font-size: .85rem; line-height: 1.7; }
.capture-details { margin-top: 1rem; }
.canvas-capture { display: block; max-width: 100%; height: auto; margin-top: .75rem; border: 1px solid #cbd6d8; }
.capture-error { margin-bottom: 0; color: #9b342a; font-size: .85rem; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.reading-notes { margin-top: 2.5rem; }
.note-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem 2.5rem; margin-top: 1rem; }
h3 { margin: .75rem 0 .35rem; font-size: .9rem; font-weight: 650; }
.note-grid p { margin: 0; color: #52666e; font-size: .83rem; line-height: 1.8; }
.provenance { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid #ccd8d4; }
.provenance h2 { font-size: .9rem; }
.provenance p { max-width: 70rem; color: #52666e; font-size: .8rem; line-height: 1.8; overflow-wrap: anywhere; }
.provenance code { font-size: .76rem; }
.source-links { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; }
.source-links a { display: inline-flex; align-items: center; min-height: 2.75rem; color: #174b5c; font-size: .8rem; text-underline-offset: .2em; overflow-wrap: anywhere; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 980px) {
  .masthead { align-items: flex-start; flex-direction: column; gap: 1.5rem; }
  .version-stamp { gap: .25rem; }
  .inspection-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .events-heading { align-items: flex-start; flex-direction: column; }
  .event-tools { justify-content: flex-start; }
}
@media (max-width: 540px) {
  .lab-shell { padding-top: 1.5rem; }
  .masthead { padding-bottom: 1.5rem; }
  .panel { padding: 1rem; }
  .section-heading { flex-wrap: wrap; gap: .75rem; }
  .case-form { flex-direction: column; align-items: stretch; gap: .75rem; }
  .case-field select { font-size: .8rem; }
  .scene-actions > .button { flex: 1 1 100%; }
  .note-grid { grid-template-columns: minmax(0, 1fr); gap: .75rem; }
  .event-tools { width: 100%; }
  .event-tools > span { width: 100%; }
  .event-tools > .button { flex: 1 1 auto; }
  .event { padding-right: .5rem; padding-left: .65rem; }
  .frame-wrap { min-height: 25rem; }
  .case-frame { height: 31rem; }
}
@media (forced-colors: active) {
  .tag, .event, .button { border-color: CanvasText; }
}
</style>
