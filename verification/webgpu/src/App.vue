<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch, type Raw } from 'vue'
import { manualChecks, modes, scenes, type Command, type FrameState, type Mode, type SceneId } from './lab-contract'
import { checkGuide } from './check-guide'
import { createDisplayCapture, type DisplayEvidence } from './display-capture'
import { runVerification, type RunEvidence, type VerificationBridge, type VerificationProfile, type VerificationReport } from './verification-sequence'
import { classifyCanvasCapture, type CanvasCaptureResult } from './capture-result'

type JsonRecord = Record<string, unknown>
type ManualStatus = 'pending' | 'pass' | 'fail' | 'not-applicable'
type CheckId = typeof manualChecks[number]['id']

interface ManualEntry {
  id: CheckId
  status: ManualStatus
  evidenceNotes: string
  profileNotes: string
  runIds: string[]
  updatedAt: string | null
}

interface LabEvent {
  id: number
  runId: string
  mode: Mode
  scene: SceneId
  receivedAt: string
  time: string | number
  category: string
  message: string
  detail?: unknown
}

interface Capture extends CanvasCaptureResult {
  id: string
  requestedAt: string
  receivedAt: string
  association: string
}

interface Run {
  id: string
  scene: SceneId
  mode: Mode
  startedAt: string
  state: Raw<FrameState> | null
  events: LabEvent[]
  captures: Capture[]
  unmountRequested: boolean
}

const provenance = {
  source: 'skills/vue-kit/references/tresjs.md',
  pins: { vue: '3.5.44', core: '5.9.3', three: '0.186.1' },
  isolation: 'Fresh same-origin case.html iframe on every run. Normal does not wrap native GPU/canvas APIs.',
  servedSources: {
    host: '/source/SceneHost.vue',
    canvas: '/source/SceneCanvas.vue',
    instrumentation: '/source/frame.ts',
    inspectionUi: '/source/App.vue',
    reference: '/source/tresjs.md',
    hashes: '/source/provenance.json',
  },
}

const guidance = Object.fromEntries(Object.entries(checkGuide).map(([id, guide]) => [id, guide.steps])) as Record<CheckId, string[]>
const checkGroups: { label: string; ids: CheckId[] }[] = [
  { label: 'Rendering', ids: ['gpu-01', 'gpu-02', 'gpu-03', 'gpu-04', 'gpu-05'] },
  { label: 'Motion and input', ids: ['gpu-06', 'gpu-07', 'gpu-08', 'gpu-09'] },
  { label: 'Resources', ids: ['gpu-10', 'gpu-11', 'gpu-12', 'gpu-13', 'gpu-14'] },
  { label: 'Effects and capture', ids: ['gpu-15', 'gpu-16', 'gpu-17'] },
]

const selectedScene = shallowRef<SceneId>('webgl')

const selectedMode = shallowRef<Mode>('normal')
const runs = ref<Run[]>([])
const currentRunId = shallowRef('')
const frameSrc = shallowRef('')
const frameLoaded = shallowRef(false)
const capturePending = shallowRef(false)
const announcement = shallowRef('')
const hiddenThroughEventId = shallowRef(0)
const parentWidth = shallowRef<'narrow' | 'wide'>('wide')
const parentHidden = shallowRef(false)
const lossArmed = shallowRef(false)
const manualStatusError = shallowRef('')
const selectedCheckId = shallowRef<CheckId>('gpu-01')
const manualEntries = ref<ManualEntry[]>(manualChecks.map((check) => ({
  id: check.id, status: 'pending', evidenceNotes: '', profileNotes: '', runIds: [], updatedAt: null,
})))
const observer = ref({ name: '', browserOs: '', device: '', profile: '' })
const provenanceFetch = ref<{ status: 'loading' | 'loaded' | 'failed'; fetchedAt: string | null; metadata: unknown; error: string | null }>({
  status: 'loading', fetchedAt: null, metadata: null, error: null,
})
const frame = useTemplateRef<HTMLIFrameElement>('case-frame')
let runSequence = 0
let eventSequence = 0
let captureTimeout: ReturnType<typeof setTimeout> | undefined
let captureSequence = 0
let pendingCapture: { id: string; requestedAt: string } | null = null
const metadataAbort = new AbortController()
const manualView = shallowRef(false)
const automationBusy = shallowRef(false)
const verificationProfile = shallowRef<VerificationProfile>('visibility')
const automationPhase = shallowRef<'idle' | 'permission' | 'running' | 'stopping' | 'capture-unavailable' | 'completed' | 'cancelled' | 'error'>('idle')
const automationError = shallowRef('')
const activeVerification = shallowRef<VerificationReport | null>(null)
const verificationHistory = shallowRef<VerificationReport[]>([])
const displayEvidence = shallowRef<DisplayEvidence>({ currentSessionId: null, sessions: [], captures: [] })
const displayCapture = createDisplayCapture(() => { displayEvidence.value = displayCapture.snapshot() })
const checkpoints = shallowRef<{
  runId: string; label: string; requestedAt: string; finishedAt?: string
  viewport: { width: number; height: number; dpr: number; visibility: DocumentVisibilityState }
  frameRect: DOMRect | null; canvasRect: DOMRect | null
  canvasCaptureIds: string[]; displayCaptureId?: string; errors: string[]
}[]>([])
let verificationAbort: AbortController | null = null
const captureSession = computed(() => displayEvidence.value.sessions.at(-1))
const displayImagePending = computed(() => {
  const image = displayEvidence.value.captures.at(-1)
  return Boolean(image && !image.dataUrl && !image.error)
})
const missingDisplayImages = computed(() => displayEvidence.value.captures.filter((image) => image.error
  && activeVerification.value?.cases.some((item) => item.runIds.includes(image.runId))).length)
const automationHeading = computed(() => ({
  idle: verificationProfile.value === 'visibility' ? 'Recheck resize and visibility' : 'Verify your browser', permission: 'Choose this tab to capture', running: 'Verification in progress',
  stopping: 'Stopping verification', 'capture-unavailable': 'Tab capture is unavailable',
  completed: 'Evidence is ready for review', cancelled: 'Verification stopped', error: 'Verification interrupted',
})[automationPhase.value])
const automatedIssues = computed(() => activeVerification.value?.cases.filter((item) => item.status === 'issues' || item.status === 'unobserved').length ?? 0)

const currentRun = computed(() => runs.value.find((run) => run.id === currentRunId.value) ?? null)
const observed = computed(() => currentRun.value?.state ?? null)
const frameStyle = computed(() => {
  const metrics = observed.value?.metrics
  const mount = isRecord(metrics) ? metrics.mountCss : undefined
  const height = isRecord(mount) ? mount.height : undefined
  const pixels = typeof height === 'number' && Number.isFinite(height) && height > 0
    ? Math.max(480, Math.ceil(height) + 48)
    : 480
  return `height: ${pixels}px`
})
const compatibleModes = computed(() => modes.filter((item) => item.scenes.includes(selectedScene.value)))
const pendingSelection = computed(() => currentRun.value?.scene !== selectedScene.value || currentRun.value?.mode !== selectedMode.value)
const selectedCheck = computed(() => manualChecks.find((check) => check.id === selectedCheckId.value)!)
const selectedEntry = computed(() => manualEntries.value.find((entry) => entry.id === selectedCheckId.value)!)
const checkIndex = computed(() => manualChecks.findIndex((check) => check.id === selectedCheckId.value))
const suggestedCases = computed(() => {
  const sceneIds: readonly SceneId[] = selectedCheck.value.scenes
  const modeIds: readonly Mode[] = selectedCheck.value.modes
  return scenes.filter((scene) => sceneIds.includes(scene.value)).flatMap((scene) =>
    modes.filter((mode) => modeIds.includes(mode.value) && mode.scenes.includes(scene.value))
      .map((mode) => ({ scene: scene.value, mode: mode.value })))
})
const servedSourceLinks = computed(() => {
  const metadata = provenanceFetch.value.metadata
  if (!isRecord(metadata) || !Array.isArray(metadata.sources)) return []
  return metadata.sources.filter((source): source is JsonRecord & { name: string; url: string } =>
    isRecord(source) && typeof source.name === 'string' && typeof source.url === 'string'
    && source.url.startsWith('/source/') && !source.url.startsWith('//'))
})
const allEvents = computed(() => runs.value.flatMap((run) => run.events))
const visibleEvents = computed(() => allEvents.value.filter((event) => event.id > hiddenThroughEventId.value))
const capture = computed(() => currentRun.value?.captures.at(-1) ?? null)
const canCommand = computed(() => frameLoaded.value && currentRun.value !== null)
const rawReport = computed(() => JSON.stringify(report(false), null, 2))
const reviewOpen = shallowRef(false)
const taskTitle = useTemplateRef<HTMLHeadingElement>('task-title')
const reviewTitle = useTemplateRef<HTMLHeadingElement>('review-title')
const diagnostics = useTemplateRef<HTMLDetailsElement>('diagnostics')
const diagnosticsOpen = shallowRef(false)
const deviceDetails = useTemplateRef<HTMLDetailsElement>('device-details')
const currentGuide = computed(() => checkGuide[selectedCheckId.value])
const recordedCount = computed(() => manualEntries.value.filter((entry) => entry.status !== 'pending').length)
const runErrors = computed(() => currentRun.value?.events.filter((event) => isErrorEvent(event.category)).length ?? 0)
const sceneNames: Record<SceneId, string> = { webgl: 'WebGL', webgpu: 'WebGPU', picking: 'Picking', asset: 'Box model', ownership: 'Shared resources' }
const modeNames: Record<Mode, string> = {
  normal: 'Normal', 'adapter-unavailable': 'No adapter', 'device-rejected': 'Device denied',
  'both-unavailable': 'Adapter and WebGL2 denied', 'device-and-fallback-unavailable': 'Device and WebGL2 denied',
  'webgl-unavailable': 'No WebGL2', 'asset-unavailable': 'Missing model', 'asset-delayed': 'Delayed model',
}
const statusNames: Record<ManualStatus, string> = { pending: 'Pending', pass: 'Pass', fail: 'Fail', 'not-applicable': 'Not applicable' }
const backendLabel = computed(() => {
  const backend = observed.value?.backend
  return backend === 'webgpu' ? 'WebGPU' : backend === 'webgl2' ? 'WebGL2' : backend === 'unavailable' ? 'Unavailable' : backend === 'unknown' ? 'Unknown' : 'Starting'
})
const sceneState = computed(() => {
  if (manualView.value && pendingSelection.value) return 'Previous scene'
  if (currentRun.value?.unmountRequested) return observed.value?.canvasMounted ? 'Removing' : 'Scene removed'
  if (observed.value?.ready) return 'Live scene'
  if (observed.value?.backend === 'unavailable') return 'Unavailable'
  if (observed.value && !observed.value.canvasMounted && ['webgl2', 'webgpu'].includes(observed.value.backend)) return 'Renderer stopped'
  return 'Starting'
})
const guidedCase = computed({
  get: () => `${selectedScene.value}:${selectedMode.value}`,
  set: (value: string) => {
    const choice = suggestedCases.value.find((item) => `${item.scene}:${item.mode}` === value)
    if (choice) { selectedScene.value = choice.scene; selectedMode.value = choice.mode }
  },
})
const showRemove = computed(() => ['gpu-03', 'gpu-05', 'gpu-07', 'gpu-10', 'gpu-12'].includes(selectedCheckId.value))

function focusCheck() {
  void nextTick(() => {
    taskTitle.value?.focus()
    if (frameLoaded.value) sendCommand('inspect')
  })
}

function chooseCheck(id: CheckId) {
  reviewOpen.value = false
  selectedCheckId.value = id
  focusCheck()
}

function openReview() {
  reviewOpen.value = true
  void nextTick(() => reviewTitle.value?.focus())
}

function openDiagnostics() {
  if (diagnostics.value) {
    diagnostics.value.open = true
    diagnostics.value.scrollIntoView({ block: 'start' })
    diagnostics.value.querySelector('summary')?.focus()
  }
}

function openDeviceDetails() {
  if (deviceDetails.value) {
    deviceDetails.value.open = true
    deviceDetails.value.scrollIntoView({ block: 'start' })
    document.getElementById('observer-device')?.focus()
  }
}

watch(selectedScene, () => {
  if (!compatibleModes.value.some((item) => item.value === selectedMode.value)) selectedMode.value = 'normal'
})

function waitForEvidence<T>(read: () => T | undefined, signal: AbortSignal, label: string, timeout = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const deadline = performance.now() + timeout
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort) }
    const abort = () => { cleanup(); reject(signal.reason ?? new DOMException('Verification stopped.', 'AbortError')) }
    const check = () => {
      if (signal.aborted) { abort(); return }
      try {
        const value = read()
        if (value !== undefined) { cleanup(); resolve(value); return }
        if (performance.now() >= deadline) throw new Error(`Timed out waiting for ${label}.`)
        timer = setTimeout(check, 40)
      } catch (error) { cleanup(); reject(error) }
    }
    signal.addEventListener('abort', abort, { once: true })
    check()
  })
}

async function waitForPaint(signal: AbortSignal) {
  await nextTick()
  await new Promise<void>((resolve, reject) => {
    let first = 0
    let second = 0
    const cleanup = () => {
      clearTimeout(timer)
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      signal.removeEventListener('abort', abort)
    }
    const abort = () => { cleanup(); reject(signal.reason ?? new DOMException('Verification stopped.', 'AbortError')) }
    const timer = setTimeout(() => { cleanup(); reject(new Error('No foreground paint observed within five seconds.')) }, 5000)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); return }
    first = requestAnimationFrame(() => { second = requestAnimationFrame(() => { cleanup(); resolve() }) })
  })
}

function runEvidence(run: Run): RunEvidence {
  // Keep image bytes out of the runner's repeatedly sampled state snapshots.
  return { id: run.id, scene: run.scene, mode: run.mode, state: run.state, events: run.events, unmountRequested: run.unmountRequested }
}

const verificationBridge: VerificationBridge = {
  async start(scene, mode, checkIds, signal) {
    selectedScene.value = scene
    await nextTick()
    selectedMode.value = mode
    await nextTick()
    signal.throwIfAborted()
    startRun()
    const run = currentRun.value!
    for (const id of checkIds) {
      const entry = manualEntries.value.find((item) => item.id === id)
      if (entry && !entry.runIds.includes(run.id)) entry.runIds.push(run.id)
    }
    return waitForEvidence(() => {
      if (currentRun.value?.id !== run.id) throw new Error('The verification scene was replaced externally.')
      return frameLoaded.value && run.state && (run.state.ready || run.state.backend === 'unavailable') ? runEvidence(run) : undefined
    }, signal, `${scene} / ${mode} initialization`, 30_000)
  },
  async inspect(signal) {
    signal.throwIfAborted()
    const run = currentRun.value
    if (!run) throw new Error('No current verification scene.')
    const previous = run.state
    if (!sendCommand('inspect')) throw new Error('The verification frame is not available.')
    return waitForEvidence(() => {
      if (currentRun.value?.id !== run.id) throw new Error('The verification scene was replaced externally.')
      return run.state && run.state !== previous ? runEvidence(run) : undefined
    }, signal, 'a fresh scene inspection')
  },
  current: () => currentRun.value ? runEvidence(currentRun.value) : null,
  command(command) {
    if (!canCommand.value) return false
    if (command === 'unmount') { unmountScene(); return true }
    if (command === 'lose-context') { lossArmed.value = true; loseCurrentContext(); return true }
    if (command === 'invalidate') { invalidateScene(); return true }
    return sendCommand(command)
  },
  async action(action, signal) {
    signal.throwIfAborted()
    const labels = {
      play: 'Start rotation', pause: 'Pause rotation', 'retire-first': '1. Retire first cube',
      'retire-final': '2. Release final owner', 'restart-cycle': '3. Restart cycle',
      'ownership-snapshot': 'Record snapshot', 'select-left': 'Select Left cube',
      'activate-selected': 'Activate selected', 'clear-selection': 'Clear selection',
    }
    const button = Array.from(frame.value?.contentDocument?.querySelectorAll('button') ?? [])
      .find((item) => item.textContent?.trim() === labels[action])
    if (!button || button.disabled) throw new Error(`Scene control is unavailable: ${labels[action]}.`)
    appendEvent(currentRun.value!, 'automation', 'Script invoked a DOM control; this is not trusted keyboard or pointer input.', { action, isTrusted: false })
    button.click()
    await waitForPaint(signal)
  },
  async layout(width, hidden, signal) {
    setParentWidth(width)
    if (parentHidden.value !== hidden) toggleParentVisibility()
    await waitForPaint(signal)
  },
  async checkpoint(label, signal) {
    const evidence = await verificationBridge.inspect(signal)
    const run = currentRun.value
    if (!run || run.id !== evidence.id) throw new Error('Checkpoint scene was replaced.')
    if (!parentHidden.value) frame.value?.scrollIntoView({ block: 'center' })
    await waitForPaint(signal)
    const frameRect = frame.value?.getBoundingClientRect() ?? null
    const canvasRect = frame.value?.contentDocument?.querySelector('canvas')?.getBoundingClientRect() ?? null
    const checkpoint: typeof checkpoints.value[number] = {
      runId: run.id, label, requestedAt: new Date().toISOString(),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, visibility: document.visibilityState },
      frameRect, canvasRect, canvasCaptureIds: [], errors: [],
    }
    checkpoints.value = [...checkpoints.value, checkpoint]
    if (run.state?.canvasMounted) {
      const before = run.captures.length
      requestCapture()
      try {
        await waitForEvidence(() => run.captures.length > before ? true : undefined, signal, 'canvas readback response', 11_000)
        checkpoint.canvasCaptureIds = run.captures.slice(before).map((item) => item.id)
        checkpoint.errors.push(...run.captures.slice(before).flatMap((item) => item.outcome === 'png' ? [] : [item.message]))
      } catch (error) {
        signal.throwIfAborted()
        checkpoint.errors.push(String(error))
      }
    } else {
      checkpoint.errors.push('No mounted canvas at this checkpoint; no canvas PNG is claimed.')
    }
    const image = await displayCapture.capture(run.id, label, signal)
    checkpoint.displayCaptureId = image.id
    if (image.error) checkpoint.errors.push(image.error)
    checkpoint.finishedAt = new Date().toISOString()
    checkpoints.value = [...checkpoints.value]
  },
  reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
}

function retainVerification(report: VerificationReport) {
  activeVerification.value = report
  const prior = verificationHistory.value.findIndex((item) => item.id === report.id)
  const history = [...verificationHistory.value]
  if (prior < 0) history.push(report)
  else history[prior] = report
  verificationHistory.value = history
}

async function startVerification(withDisplay = true) {
  if (automationBusy.value) return
  const abort = new AbortController()
  verificationAbort = abort
  automationBusy.value = true
  manualView.value = false
  reviewOpen.value = false
  activeVerification.value = null
  automationError.value = ''
  automationPhase.value = withDisplay ? 'permission' : 'running'
  try {
    // Invoke the permission request before any asynchronous work consumes click activation.
    if (withDisplay) await displayCapture.request(abort.signal)
    abort.signal.throwIfAborted()
    automationPhase.value = 'running'
    await nextTick()
    const result = await runVerification(verificationBridge, abort.signal, retainVerification, verificationProfile.value)
    retainVerification(result)
    automationPhase.value = result.status === 'cancelled' ? 'cancelled' : 'completed'
    announcement.value = result.status === 'cancelled' ? 'Verification stopped. Partial evidence is retained.' : 'Evidence collection completed. Download the report for review.'
  } catch (error) {
    if (abort.signal.aborted) automationPhase.value = 'cancelled'
    else {
      automationError.value = String(error)
      automationPhase.value = automationPhase.value === 'permission' ? 'capture-unavailable' : 'error'
    }
  } finally {
    displayCapture.stop()
    if (abort.signal.aborted) {
      unmountScene()
      automationPhase.value = 'cancelled'
    }
    parentHidden.value = false
    parentWidth.value = 'wide'
    verificationAbort = null
    automationBusy.value = false
    await nextTick()
    if (!manualView.value) document.getElementById('automation-title')?.focus()
  }
}

function cancelVerification() {
  if (!verificationAbort || verificationAbort.signal.aborted) return
  automationPhase.value = 'stopping'
  verificationAbort.abort(new DOMException('Stopped by user; completed evidence is retained.', 'AbortError'))
  displayCapture.stop()
  unmountScene()
}

function showManualChecks() {
  if (automationBusy.value) return
  manualView.value = true
  chooseCheck(selectedCheckId.value)
}

function showAutomatedRun() {
  if (automationBusy.value) return
  manualView.value = false
  reviewOpen.value = false
  void nextTick(() => document.getElementById('automation-title')?.focus())
}

function releaseVerification() {
  verificationAbort?.abort(new DOMException('Page closed.', 'AbortError'))
  displayCapture.stop()
}

function report(includePng = true) {
  return {
    exportedAt: new Date().toISOString(),
    acceptance: 'Human hardware acceptance remains pending. Manual statuses are observer declarations, never automatic certification.',
    note: 'Browser-local evidence only; nothing uploaded. Injected denials are interventions, not hardware diagnoses. Automated DOM clicks are untrusted; visuals and native hardware remain review decisions. Display captures contain the user-selected visible tab surface, not full-page screenshots.',
    collectionLimits: [
      'Only observed page, component, window/rejection and exposed GPU events are retained. Browser/driver-only console output is not available to in-page scripts.',
      'Display frames cover the selected visible tab surface. Viewport coordinates and display pixels can differ; actual dimensions and frame timestamps are retained.',
      'Masked or absent adapter/driver identity remains unknown. No additional adapter/device/context probe or automatic native-hardware verdict is made.',
      'Completed empty or non-PNG canvas readbacks are distinct from missing responses. Exact short returned values, original errors, dimensions and readback timing are retained; PNG encoding (including transparent pixels) is not a rendering verdict.',
    ],
    provenance,
    fetchedProvenance: provenanceFetch.value,
    observer: observer.value,
    pendingSelection: { scene: selectedScene.value, mode: selectedMode.value },
    currentRunId: currentRunId.value,
    parentLayout: { width: parentWidth.value, hidden: parentHidden.value },
    automatedVerification: verificationHistory.value,
    displayEvidence: displayCapture.snapshot(includePng),
    checkpoints: checkpoints.value,
    manualChecks: manualChecks.map((check) => ({ ...check, guidance: guidance[check.id], observation: manualEntries.value.find((entry) => entry.id === check.id) })),
    runs: includePng ? runs.value : runs.value.map((run) => ({
      ...run,
      captures: run.captures.map((item) => ({ ...item, dataUrl: undefined, pngAvailable: Boolean(item.dataUrl) })),
    })),
  }
}

async function fetchProvenance() {
  provenanceFetch.value.status = 'loading'
  provenanceFetch.value.error = null
  try {
    const response = await fetch(provenance.servedSources.hashes, { cache: 'no-store', signal: metadataAbort.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
    const metadata: unknown = await response.json()
    if (!isRecord(metadata)) throw new Error('Provenance response was not a JSON object.')
    if (typeof metadata.referenceSha256 !== 'string' || !/^[a-f\d]{64}$/i.test(metadata.referenceSha256)
      || !Array.isArray(metadata.sources) || metadata.sources.length === 0
      || !metadata.sources.every((source) => isRecord(source) && typeof source.sha256 === 'string' && /^[a-f\d]{64}$/i.test(source.sha256))) {
      throw new Error('Provenance JSON does not contain the expected reference and served-source SHA-256 metadata.')
    }
    provenanceFetch.value = { status: 'loaded', fetchedAt: new Date().toISOString(), metadata, error: null }
  } catch (error) {
    provenanceFetch.value = { status: 'failed', fetchedAt: new Date().toISOString(), metadata: provenanceFetch.value.metadata, error: String(error) }
  }
}


function touchManualEntry() {
  selectedEntry.value.updatedAt = new Date().toISOString()
  if (selectedEntry.value.evidenceNotes.trim()) manualStatusError.value = ''
}

function recordStatus(event: Event) {
  const status = (event.target as HTMLSelectElement).value as ManualStatus
  if (status !== 'pending' && !selectedEntry.value.evidenceNotes.trim()) {
    (event.target as HTMLSelectElement).value = selectedEntry.value.status
    manualStatusError.value = 'Add an observation before selecting a result.'
    announcement.value = manualStatusError.value
    document.getElementById('evidence-notes')?.focus()
    return
  }
  manualStatusError.value = ''
  selectedEntry.value.status = status
  touchManualEntry()
  announcement.value = `${currentGuide.value.title}: ${statusNames[status]}.`
}

watch(selectedCheckId, () => {
  manualStatusError.value = ''
  reviewOpen.value = false
  const first = suggestedCases.value[0]
  if (first) { selectedScene.value = first.scene; selectedMode.value = first.mode }
})

function checkLabel(id: CheckId) {
  const entry = manualEntries.value.find((item) => item.id === id)!
  return `${Number(id.slice(4))}. ${checkGuide[id].title} — ${statusNames[entry.status]}`
}

function changeCheck(offset: number) {
  if (selectedEntry.value.status !== 'pending' && !selectedEntry.value.evidenceNotes.trim()) {
    manualStatusError.value = 'Add an observation or return the result to Pending.'
    document.getElementById('evidence-notes')?.focus()
    return
  }
  const check = manualChecks[checkIndex.value + offset]
  if (check) chooseCheck(check.id)
  else if (offset > 0) openReview()
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFrameState(value: unknown): value is FrameState {
  if (!isRecord(value) || !isRecord(value.versions)) return false
  return typeof value.secureContext === 'boolean'
    && value.mode === currentRun.value?.mode
    && value.scene === currentRun.value?.scene
    && typeof value.ready === 'boolean'
    && ['webgpu', 'webgl', 'unknown'].includes(String(value.rendererFamily))
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
  run.events.push({ id: ++eventSequence, runId: run.id, scene: run.scene, mode: run.mode, receivedAt: new Date().toISOString(), time, category, message, detail })
}

function clearCaptureTimeout() {
  if (captureTimeout !== undefined) clearTimeout(captureTimeout)
  captureTimeout = undefined
}

function startRun() {
  const previousRun = currentRun.value
  if (previousRun && capturePending.value && pendingCapture) {
    const error = 'The iframe was replaced before a capture response arrived.'
    retainCapture(previousRun, { ...pendingCapture, outcome: 'interrupted', message: error, receivedAt: new Date().toISOString(), association: 'Pending request interrupted by Start.', error })
  }
  clearCaptureTimeout()
  capturePending.value = false
  frameLoaded.value = false
  pendingCapture = null
  lossArmed.value = false
  parentHidden.value = false
  parentWidth.value = 'wide'
  const id = `${Date.now().toString(36)}-${++runSequence}`
  const run: Run = {
    id, scene: selectedScene.value, mode: selectedMode.value, startedAt: new Date().toISOString(), state: null,
    events: [], captures: [], unmountRequested: false,
  }
  runs.value.push(run)
  currentRunId.value = id
  if (selectedCheck.value.scenes.some((scene) => scene === run.scene)
    && selectedCheck.value.modes.some((mode) => mode === run.mode)) {
    selectedEntry.value.runIds.push(run.id)
    touchManualEntry()
  }
  const url = new URL('/case.html', window.location.origin)
  url.searchParams.set('scene', run.scene)
  url.searchParams.set('mode', run.mode)
  url.searchParams.set('run', id)
  frameSrc.value = url.href
  appendEvent(run, 'shell', `Started ${run.scene} / ${run.mode} in a fresh iframe.`, { intervention: run.mode !== 'normal', parentWidth: 'wide', parentHidden: false })
  announcement.value = `${sceneNames[run.scene]} started. Previous results are retained.`
}

function sendCommand(command: Command) {
  const run = currentRun.value
  const target = frame.value?.contentWindow
  if (!run || !target || !frameLoaded.value) return false
  target.postMessage({ channel: 'vue-kit-webgpu-lab-command', runId: run.id, command }, window.location.origin)
  if (command === 'inspect') appendEvent(run, 'shell', 'Observed-state refresh requested.')
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
  announcement.value = 'Scene removal requested. Keep this case open for late events.'
}

function invalidateScene() {
  const run = currentRun.value
  if (!run || !sendCommand('invalidate')) return
  appendEvent(run, 'shell', 'Imperative mutation/invalidate requested; inspect the actual response and new frame, not this request as proof.')
  announcement.value = 'Scene mutation requested. Refresh to inspect the new frame.'
}

function loseCurrentContext() {
  const run = currentRun.value
  if (!run || !lossArmed.value || !sendCommand('lose-context')) return
  lossArmed.value = false
  appendEvent(run, 'shell', 'Destructive experiment: current context/device loss requested. This request is not proof that loss is supported or occurred.')
  announcement.value = 'Context loss requested. Run the check again to restart.'
}

function setParentWidth(width: 'narrow' | 'wide') {
  parentWidth.value = width
  const run = currentRun.value
  if (run) appendEvent(run, 'shell', `Parent width changed to ${width}.`, { width, hidden: parentHidden.value })
  announcement.value = `Parent width: ${width}.`
}

function toggleParentVisibility() {
  parentHidden.value = !parentHidden.value
  const run = currentRun.value
  if (run) appendEvent(run, 'shell', `Parent ${parentHidden.value ? 'hidden' : 'shown'} without unmounting.`, { width: parentWidth.value })
  announcement.value = parentHidden.value ? 'Scene hidden.' : 'Scene shown.'
}

function retainCapture(run: Run, result: Capture) {
  run.captures.push(result)
  appendEvent(run, 'capture', result.message, {
    id: result.id, requestedAt: result.requestedAt, receivedAt: result.receivedAt, association: result.association,
    outcome: result.outcome, error: result.error, returnedDataUrlLength: result.returnedDataUrlLength, provenance: result.provenance,
  })
}

function requestCapture() {
  const run = currentRun.value
  if (!run || capturePending.value || !sendCommand('capture')) return
  capturePending.value = true
  const request = { id: `${run.id}-capture-${++captureSequence}`, requestedAt: new Date().toISOString() }
  pendingCapture = request
  appendEvent(run, 'shell', 'Canvas PNG requested. Previous captures and errors remain retained.', request)
  announcement.value = 'Reading the current canvas as PNG inside the case frame.'
  clearCaptureTimeout()
  captureTimeout = setTimeout(() => {
    if (currentRunId.value !== run.id) return
    capturePending.value = false
    const error = 'No capture response received within 10 seconds. The frame may still be initializing; you can capture again. A later response cannot be correlated conclusively after a retry.'
    retainCapture(run, { ...request, outcome: 'timeout', message: error, error, receivedAt: new Date().toISOString(), association: 'Timeout for this request; a late response may still arrive.' })
    announcement.value = error
  }, 10_000)
}

function receiveMessage(event: MessageEvent<unknown>) {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  const payload = event.data
  const run = currentRun.value
  if (!run || !isRecord(payload) || payload.channel !== 'vue-kit-webgpu-lab' || payload.runId !== run.id) return
  const data = payload.data
  if (payload.kind === 'state' && isFrameState(data)) {
    // PostMessage states are immutable snapshots replaced wholesale, not deep reactive graphs.
    run.state = markRaw(data)
  } else if (payload.kind === 'event' && isRecord(data)
    && typeof data.category === 'string' && typeof data.message === 'string'
    && (typeof data.time === 'string' || typeof data.time === 'number')) {
    appendEvent(run, data.category, data.message, data.detail, data.time)
  } else if (payload.kind === 'capture' && isRecord(data)) {
    const result = classifyCanvasCapture(data)
    clearCaptureTimeout()
    capturePending.value = false
    const request = pendingCapture
    retainCapture(run, {
      id: `${run.id}-response-${++captureSequence}`,
      requestedAt: request?.requestedAt ?? 'Unknown',
      ...result, receivedAt: new Date().toISOString(),
      association: `Capture replies have no request token; associated with latest request ${request?.id ?? '(none)'}. After a timeout/retry this association is uncertain.`,
    })
    pendingCapture = null
    announcement.value = result.message
  }
}

function downloadJson() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report(), null, 2)], { type: 'application/json' }))
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
  window.addEventListener('pagehide', releaseVerification)
  void fetchProvenance()
  startRun()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', receiveMessage)
  window.removeEventListener('pagehide', releaseVerification)
  releaseVerification()
  clearCaptureTimeout()
  metadataAbort.abort()
})
</script>

<template>
  <div class="lab-shell">
    <a class="skip-link" :href="!manualView ? '#automation-title' : reviewOpen ? '#review-title' : '#check-title'">Skip to main content</a>
    <header class="topbar">
      <a class="brand" href="#" :aria-disabled="automationBusy" @click.prevent="showAutomatedRun"><span class="brand-mark" aria-hidden="true"></span>Vue Kit<span class="brand-divider">/</span><span class="brand-label">GPU verification</span></a>
      <div class="header-actions">
        <span class="save-note">Download before closing.</span>
        <button class="button button-quiet" type="button" :disabled="automationBusy" @click="manualView ? showAutomatedRun() : showManualChecks()">{{ manualView ? 'Automated run' : 'Manual checks' }}</button>
        <button v-if="manualView" class="button button-quiet" type="button" @click="openReview">Review</button>
        <button class="button" type="button" :disabled="automationBusy || !runs.length || provenanceFetch.status === 'loading'" @click="downloadJson">Download report</button>
      </div>
    </header>

    <div class="app-layout" :class="{ 'automation-layout': !manualView }">
      <aside v-if="manualView" class="sidebar">
        <div class="progress-heading"><strong>Checks</strong><span>{{ recordedCount }} / {{ manualChecks.length }} recorded</span></div>
        <progress :value="recordedCount" :max="manualChecks.length" aria-label="Recorded checks"></progress>
        <nav aria-label="Verification checks">
          <section v-for="group in checkGroups" :key="group.label" class="check-group">
            <h2>{{ group.label }}</h2>
            <button v-for="id in group.ids" :key="id" type="button" class="check-link" :class="{ 'is-current': id === selectedCheckId && !reviewOpen }" :aria-current="id === selectedCheckId && !reviewOpen ? 'step' : undefined" @click="chooseCheck(id)">
              <span class="check-number">{{ Number(id.slice(4)).toString().padStart(2, '0') }}</span>
              <span class="check-name">{{ checkGuide[id].title }}</span>
              <span class="status-mark" :class="`status-${manualEntries.find((entry) => entry.id === id)!.status}`" :aria-label="statusNames[manualEntries.find((entry) => entry.id === id)!.status]">{{ manualEntries.find((entry) => entry.id === id)!.status === 'pending' ? '○' : manualEntries.find((entry) => entry.id === id)!.status === 'pass' ? '✓' : manualEntries.find((entry) => entry.id === id)!.status === 'fail' ? '!' : '—' }}</span>
            </button>
          </section>
        </nav>
      </aside>

      <main>
        <section v-if="!manualView" class="automation-panel" :class="{ 'is-running': automationBusy }" aria-labelledby="automation-title">
          <div class="automation-summary">
            <div>
              <p class="step-label">{{ automationBusy ? 'Collecting local evidence' : 'Target-browser verification' }}</p>
              <h1 id="automation-title" tabindex="-1">{{ automationHeading }}</h1>
              <p v-if="automationPhase === 'idle'" class="automation-intro">{{ verificationProfile === 'visibility' ? 'Checks WebGL and WebGPU across resize, hide and show. Share this tab when prompted.' : 'Runs scene and failure checks, including deliberate renderer loss and recreation. Share this tab when prompted.' }}</p>
              <p v-else-if="automationPhase === 'permission'" class="automation-intro">Select this browser tab, not a window or display.</p>
              <p v-else-if="automationPhase === 'running'" class="automation-current" aria-live="polite">{{ activeVerification?.currentLabel ?? 'Starting the first scene…' }}</p>
              <p v-else-if="automationPhase === 'stopping'" class="automation-intro">Completed evidence is retained. Close the capture prompt if it is still open.</p>
              <p v-else-if="automationPhase === 'completed'" class="automation-intro">{{ activeVerification?.completed }} scenarios collected · {{ automatedIssues }} need attention · {{ missingDisplayImages }} tab images unavailable. Download the report for review.</p>
              <p v-else-if="automationPhase === 'cancelled'" class="automation-intro">Completed evidence is retained. Download it or start another run.</p>
              <p v-if="automationError" class="field-error" role="alert">{{ automationError }}</p>
            </div>
            <div class="automation-actions">
              <div v-if="!automationBusy" class="case-field sequence-field">
                <label for="verification-profile">Check</label>
                <select id="verification-profile" v-model="verificationProfile">
                  <option value="visibility">Resize and visibility · 2 scenarios</option>
                  <option value="full">Full verification · 18 scenarios</option>
                </select>
              </div>
              <button v-if="!automationBusy" id="start-verification" class="button button-primary" type="button" @click="startVerification(true)">{{ verificationProfile === 'visibility' ? 'Run focused recheck' : 'Run full verification' }}</button>
              <button v-else class="button button-danger" type="button" :disabled="automationPhase === 'stopping'" @click="cancelVerification">Stop verification</button>
              <button v-if="automationPhase === 'capture-unavailable'" class="button" type="button" @click="startVerification(false)">Continue without tab capture</button>
              <button v-if="activeVerification && !automationBusy" class="button" type="button" :disabled="provenanceFetch.status === 'loading'" @click="downloadJson">Download report</button>
            </div>
          </div>
          <div v-if="activeVerification && automationBusy" class="automation-progress">
            <progress :value="activeVerification.completed" :max="activeVerification.total" aria-label="Collected verification scenarios"></progress>
            <span>{{ activeVerification.completed }} / {{ activeVerification.total }}</span>
          </div>
          <p class="capture-status">{{ automationBusy ? `Tab capture: ${captureSession?.status ?? 'not requested'}` : 'Nothing is uploaded.' }}<span v-if="automationBusy" :style="{ visibility: displayImagePending ? 'visible' : 'hidden' }"> · Capturing tab image…</span></p>
          <p v-if="automationBusy && captureSession && captureSession.status !== 'active' && automationPhase === 'running'" class="capture-warning" role="status">No active tab capture. Canvas images and diagnostics continue; missing tab images are recorded.</p>
          <details v-if="activeVerification && !automationBusy" class="automation-evidence">
            <summary>Collected evidence and review limits</summary>
            <p>Images and native hardware require review. Scripted DOM controls are not trusted pointer or keyboard input; OS-preference changes are not simulated.</p>
            <ol class="scenario-results"><li v-for="item in activeVerification.cases" :key="item.id"><strong>{{ item.label }}</strong><span>{{ item.status }}</span><p v-for="issue in item.issues" :key="issue">{{ issue }}</p></li></ol>
            <h2>Original check coverage</h2>
            <details v-for="coverage in activeVerification.coverage" :key="coverage.checkId"><summary>{{ coverage.checkId }} · {{ checkGuide[coverage.checkId].title }}</summary><p v-for="limit in coverage.remainingReview" :key="limit">{{ limit }}</p></details>
          </details>
        </section>

        <div v-if="manualView" class="mobile-navigation">
          <label for="manual-check">Choose check</label>
          <select id="manual-check" v-model="selectedCheckId" @change="focusCheck"><optgroup v-for="group in checkGroups" :key="group.label" :label="group.label"><option v-for="id in group.ids" :key="id" :value="id">{{ checkLabel(id) }}</option></optgroup></select>
        </div>

        <section v-if="manualView && reviewOpen" class="review-view" aria-labelledby="review-title">
          <p class="step-label">Review</p>
          <h1 id="review-title" ref="review-title" tabindex="-1">Your verification report</h1>
          <p class="review-intro">{{ recordedCount }} of {{ manualChecks.length }} checks recorded. Add your device details, then download the report.</p>
          <div class="review-actions"><button class="button" type="button" @click="openDeviceDetails">Device details</button><button class="button button-primary" type="button" :disabled="!runs.length || provenanceFetch.status === 'loading'" @click="downloadJson">Download report</button></div>
          <p class="notice">Results reflect your observations. Unrecorded checks remain pending.</p>
          <ol class="review-list">
            <li v-for="(check, index) in manualChecks" :key="check.id">
              <span class="check-number">{{ (index + 1).toString().padStart(2, '0') }}</span>
              <button class="review-check" type="button" @click="chooseCheck(check.id)">{{ checkGuide[check.id].title }}</button>
              <span class="result-tag" :class="`result-${manualEntries[index]!.status}`">{{ statusNames[manualEntries[index]!.status] }}</span>
              <button class="button button-quiet" type="button" :aria-label="`Edit ${checkGuide[check.id].title}`" @click="chooseCheck(check.id)">Edit</button>
            </li>
          </ol>
        </section>

        <section v-show="manualView ? !reviewOpen : automationBusy || automationPhase === 'idle' || automationPhase === 'capture-unavailable'" class="workflow" :aria-labelledby="manualView ? 'check-title' : 'automation-title'">
          <header v-if="manualView" class="task-heading">
            <div><p class="step-label">Check {{ checkIndex + 1 }} of {{ manualChecks.length }}</p><h1 id="check-title" ref="task-title" tabindex="-1">{{ currentGuide.title }}</h1></div>
            <button class="button button-quiet previous-check" type="button" :disabled="checkIndex === 0" @click="changeCheck(-1)">Previous</button>
          </header>

          <div class="task-grid" :class="{ 'automated-scene': !manualView }">
            <section class="experiment" aria-label="Instructions and live scene">
              <ol v-if="manualView" class="task-steps"><li v-for="step in currentGuide.steps" :key="step">{{ step }}</li></ol>
              <p v-if="manualView && !selectedCheck.conditional" class="expected"><strong>Expected</strong>{{ currentGuide.expect }}</p>
              <p v-if="manualView && currentGuide.caution && !selectedCheck.conditional" class="caution">{{ currentGuide.caution }}</p>

              <div v-show="!manualView || !selectedCheck.conditional">
                <form v-show="manualView" class="run-toolbar" @submit.prevent="startRun">
                  <div v-if="suggestedCases.length > 1" class="case-field">
                    <label for="guided-case">Case</label>
                    <select id="guided-case" v-model="guidedCase"><option v-for="item in suggestedCases" :key="`${item.scene}:${item.mode}`" :value="`${item.scene}:${item.mode}`">{{ sceneNames[item.scene] }} / {{ modeNames[item.mode] }}</option></select>
                  </div>
                  <button id="run-check" class="button button-primary" type="submit"><span aria-hidden="true">▶</span>Run check</button>
                  <div class="task-tools">
                    <template v-if="selectedCheckId === 'gpu-08'">
                      <button class="button" type="button" :aria-pressed="parentWidth === 'narrow'" @click="setParentWidth('narrow')">Narrow</button>
                      <button class="button" type="button" :aria-pressed="parentWidth === 'wide'" @click="setParentWidth('wide')">Wide</button>
                      <button class="button" type="button" :aria-pressed="parentHidden" @click="toggleParentVisibility">{{ parentHidden ? 'Show' : 'Hide' }}</button>
                    </template>
                    <button v-if="selectedCheckId === 'gpu-06'" class="button" type="button" :disabled="!canCommand || currentRun?.unmountRequested" @click="invalidateScene">Rotate once</button>
                    <button v-if="showRemove" class="button" type="button" :disabled="!canCommand || currentRun?.unmountRequested" @click="unmountScene">Remove scene</button>
                  </div>
                </form>
                <div v-if="manualView && selectedCheckId === 'gpu-14'" class="loss-controls">
                  <label class="checkbox-label"><input v-model="lossArmed" type="checkbox" :disabled="!canCommand || currentRun?.unmountRequested" /> Allow context or device loss</label>
                  <button class="button button-danger" type="button" :disabled="!canCommand || !lossArmed || currentRun?.unmountRequested" @click="loseCurrentContext">Lose context</button>
                </div>

                <div class="live-heading">
                  <span class="live-label"><span class="live-dot" :class="{ 'is-ready': observed?.ready && (!manualView || !pendingSelection) }" aria-hidden="true"></span>{{ sceneState }}</span>
                  <div class="live-badges"><span class="backend-tag">{{ backendLabel }}</span><button class="error-link" :class="{ 'no-errors': !runErrors }" type="button" :disabled="automationBusy" @click="openDiagnostics">{{ runErrors }} error event{{ runErrors === 1 ? '' : 's' }}</button></div>
                  <div v-if="manualView" class="evidence-tools">
                    <button class="button button-quiet inspect-button" type="button" :disabled="!canCommand" @click="sendCommand('inspect')">Refresh</button>
                    <button class="button button-quiet" type="button" :disabled="!canCommand || capturePending || !observed?.canvasMounted" @click="requestCapture">{{ capturePending ? 'Capturing…' : 'Capture PNG' }}</button>
                    <a v-if="capture?.dataUrl" class="button" :href="capture.dataUrl" :download="`${capture.id}.png`">Save PNG</a>
                  </div>
                </div>
                <p v-if="manualView && pendingSelection" class="scene-notice">Run this check to replace the previous scene.</p>
                <p v-if="currentRun?.mode !== 'normal'" class="scene-notice">Controlled case: {{ currentRun ? modeNames[currentRun.mode] : '' }}.</p>
                <div id="live-case-parent" v-show="!parentHidden" class="frame-wrap" :class="{ 'parent-narrow': parentWidth === 'narrow' }">
                  <iframe v-if="frameSrc" :key="currentRunId" ref="case-frame" class="case-frame" :class="{ 'automation-locked': automationBusy }" :tabindex="automationBusy ? -1 : undefined" :src="frameSrc" :style="frameStyle" :title="`Live ${currentRun ? sceneNames[currentRun.scene] : ''} verification scene`" @load="frameDidLoad" />
                </div>
                <p v-if="parentHidden" class="hidden-scene">{{ automationBusy ? 'Scene hidden for verification.' : 'Scene hidden. Choose Show to restore it.' }}</p>
                <p v-if="capture && capture.outcome !== 'png'" :class="capture.outcome === 'error' || capture.outcome === 'timeout' ? 'field-error' : 'capture-status'" role="status">{{ capture.message }}<span v-if="typeof capture.provenance?.width === 'number' && typeof capture.provenance?.height === 'number'"> · {{ capture.provenance.width }} × {{ capture.provenance.height }}</span></p>
                <details v-if="manualView && capture?.dataUrl" class="capture-preview"><summary>View captured PNG</summary><img :src="capture.dataUrl" alt="Direct canvas PNG readback" /></details>
              </div>
            </section>

            <aside v-if="manualView" class="result-panel" aria-labelledby="result-title">
              <h2 id="result-title">Your result</h2>
              <form @submit.prevent="changeCheck(1)">
                <div class="case-field"><label for="evidence-notes">Observation</label><textarea id="evidence-notes" v-model="selectedEntry.evidenceNotes" rows="3" placeholder="Describe what you saw." :aria-invalid="Boolean(manualStatusError)" aria-describedby="manual-record-error" @input="touchManualEntry" /><p v-if="manualStatusError" id="manual-record-error" class="field-error" role="alert">{{ manualStatusError }}</p></div>
                <div class="case-field"><label for="manual-status">Result</label><select id="manual-status" :value="selectedEntry.status" @change="recordStatus"><option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option><option value="not-applicable">Not applicable</option></select></div>
                <p v-if="selectedEntry.status !== 'pending' && !selectedEntry.evidenceNotes.trim()" class="field-error">Add an observation or return the result to Pending.</p>
                <button class="button button-primary next-check" type="submit">{{ checkIndex === manualChecks.length - 1 ? 'Review results' : 'Next check' }}<span aria-hidden="true">→</span></button>
              </form>
              <details class="check-details">
                <summary>Check details</summary>
                <h3>Full criteria</h3><p>{{ selectedCheck.assertion }}</p>
                <h3>Evidence</h3><p>{{ selectedCheck.evidence_to_record }}</p>
                <div class="case-field"><label for="check-profile">Profile differences</label><textarea id="check-profile" v-model="selectedEntry.profileNotes" rows="2" @input="touchManualEntry" /></div>
                <fieldset class="run-associations"><legend>Evidence runs</legend><p v-if="!runs.length">Run this check to add evidence.</p><label v-for="run in runs" :key="run.id" class="checkbox-label"><input v-model="selectedEntry.runIds" type="checkbox" :value="run.id" @change="touchManualEntry" /><span>{{ sceneNames[run.scene] }} / {{ modeNames[run.mode] }}<code>{{ run.id }}</code></span></label></fieldset>
              </details>
            </aside>
          </div>
        </section>

        <footer class="supporting-details" :inert="automationBusy">
          <details ref="device-details" class="device-details">
            <summary>Device details</summary>
            <p>Include your GPU and driver version. These details are added to the report.</p>
            <div class="device-grid">
              <div class="case-field"><label for="observer-name">Name or session</label><input id="observer-name" v-model="observer.name" autocomplete="off" /></div>
              <div class="case-field"><label for="observer-browser">Browser and OS</label><input id="observer-browser" v-model="observer.browserOs" autocomplete="off" /></div>
              <div class="case-field"><label for="observer-device">GPU and driver</label><textarea id="observer-device" v-model="observer.device" rows="2" /></div>
              <div class="case-field"><label for="observer-profile">Browser settings or profile</label><textarea id="observer-profile" v-model="observer.profile" rows="2" /></div>
            </div>
          </details>

          <details id="diagnostics" ref="diagnostics" class="diagnostics" @toggle="diagnosticsOpen = ($event.target as HTMLDetailsElement).open">
            <summary>Diagnostics <span class="detail-count">{{ allEvents.length }} events</span></summary>
            <template v-if="diagnosticsOpen && !automationBusy">
            <div class="diagnostic-actions"><button class="button" type="button" :disabled="!canCommand" @click="sendCommand('inspect')">Refresh</button><button class="button" type="button" :disabled="!visibleEvents.length" @click="clearEventDisplay">Clear display</button></div>
            <dl class="observations">
              <div><dt>Backend</dt><dd>{{ observed?.backend ?? 'Waiting' }}</dd></div>
              <div><dt>Renderer family</dt><dd>{{ observed?.rendererFamily ?? 'Waiting' }}</dd></div>
              <div><dt>Ready</dt><dd>{{ observed?.ready ? 'Yes' : 'No' }}</dd></div>
              <div><dt>Secure context</dt><dd>{{ observed?.secureContext ? 'Yes' : 'No' }}</dd></div>
              <div><dt>WebGPU device</dt><dd>{{ observed?.deviceCreated ? 'Observed' : 'Not observed' }}</dd></div>
              <div><dt>Unhandled rejections</dt><dd>{{ observed?.unhandledCount ?? 'Waiting' }}</dd></div>
            </dl>
            <details v-if="observed?.metrics !== undefined"><summary>Scene metrics</summary><pre tabindex="0" aria-label="Reported scene metrics">{{ detailText(observed.metrics) }}</pre></details>
            <details v-if="observed"><summary>Adapter and runtime</summary><pre tabindex="0">{{ detailText({ adapter: observed.adapter, versions: observed.versions, browser: observed.userAgent, run: currentRunId }) }}</pre></details>
            <details class="custom-case">
              <summary>Custom case controls</summary>
              <form class="custom-case-form" @submit.prevent="startRun"><div class="case-field"><label for="case-scene">Scene</label><select id="case-scene" v-model="selectedScene"><option v-for="item in scenes" :key="item.value" :value="item.value">{{ sceneNames[item.value] }}</option></select></div><div class="case-field"><label for="case-mode">Profile</label><select id="case-mode" v-model="selectedMode"><option v-for="item in compatibleModes" :key="item.value" :value="item.value">{{ modeNames[item.value] }}</option></select></div><button class="button" type="submit">Run custom case</button></form>
              <div class="diagnostic-actions"><button class="button" type="button" :disabled="!canCommand || currentRun?.unmountRequested" @click="unmountScene">Remove scene</button><button class="button" type="button" :disabled="!canCommand || currentRun?.unmountRequested" @click="invalidateScene">Rotate once</button><button class="button" type="button" @click="setParentWidth('narrow')">Narrow</button><button class="button" type="button" @click="setParentWidth('wide')">Wide</button><button class="button" type="button" @click="toggleParentVisibility">{{ parentHidden ? 'Show' : 'Hide' }}</button></div>
            </details>
            <details v-if="runs.some((run) => run.captures.length)" class="capture-history"><summary>Capture history</summary><template v-for="run in runs" :key="run.id"><ul v-if="run.captures.length" class="capture-list"><li v-for="item in run.captures" :key="item.id"><code>{{ item.id }}</code><p>{{ item.message }}<span v-if="typeof item.provenance?.width === 'number' && typeof item.provenance?.height === 'number'"> · {{ item.provenance.width }} × {{ item.provenance.height }}</span></p><a v-if="item.dataUrl" class="button" :href="item.dataUrl" :download="`${item.id}.png`">Save PNG</a></li></ul></template></details>
            <ol v-if="visibleEvents.length" class="event-list" tabindex="0" aria-label="Event log"><li v-for="event in visibleEvents" :key="event.id" :class="{ 'event-error': isErrorEvent(event.category) }"><div class="event-meta"><span>{{ event.category }}</span><time :datetime="event.receivedAt">{{ formatEventTime(event) }}</time><code>{{ event.runId }}</code></div><p>{{ event.message }}</p><details v-if="event.detail !== undefined"><summary>Details</summary><pre tabindex="0">{{ detailText(event.detail) }}</pre></details></li></ol>
            <p v-else class="empty-events">No events shown. The report retains earlier events.</p>
            <details class="raw-details"><summary>Raw report</summary><p>The download includes all captures. PNG bytes are omitted from this preview.</p><pre tabindex="0" aria-label="Scrollable raw diagnostic JSON">{{ rawReport }}</pre></details>
            </template>
          </details>

          <details id="source-provenance" class="source-details">
            <summary>Source and versions</summary>
            <p>Vue 3.5.44 · TresJS 5.9.3 · Three 0.186.1</p>
            <p>The WebGL and WebGPU recipes are extracted unchanged. The other scenes are verification examples.</p>
            <p v-if="provenanceFetch.status === 'loading'" role="status">Loading source details…</p>
            <p v-else-if="provenanceFetch.status === 'failed'" class="field-error" role="alert">Source details could not load: {{ provenanceFetch.error }}. The report includes this error.</p>
            <button class="button" type="button" :disabled="provenanceFetch.status === 'loading'" @click="fetchProvenance">Reload source details</button>
            <nav class="source-links" aria-label="Source files"><a :href="provenance.servedSources.reference" target="_blank" rel="noopener noreferrer">Reference</a><a :href="provenance.servedSources.hashes" target="_blank" rel="noopener noreferrer">Source hashes</a><a v-for="source in servedSourceLinks" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }}</a></nav>
            <details v-if="provenanceFetch.metadata"><summary>Source metadata</summary><pre tabindex="0">{{ detailText(provenanceFetch.metadata) }}</pre></details>
          </details>
          <p class="privacy-note">Results stay in this page. Download the report before closing or reloading.</p>
          <p v-if="provenanceFetch.status === 'failed'" class="field-error" role="alert">Source details are unavailable. The report includes the fetch error.</p>
        </footer>
      </main>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style>
:root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1c3039; background: #f5f6f3; font-synthesis: none; }
* { box-sizing: border-box; }
body { margin: 0; }
button, select, input, textarea { font: inherit; }
button, a, select, input, textarea, summary { -webkit-tap-highlight-color: transparent; }
::selection { color: #fff; background: #255c6d; }
</style>

<style scoped>
.lab-shell { max-width: 1600px; margin: 0 auto; padding: 0 32px 32px; }
.skip-link { position: fixed; top: -80px; left: 16px; z-index: 10; padding: 12px 20px; color: #fff; background: #174b5c; }
.skip-link:focus { top: 12px; }
.topbar { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 1px solid #d5dedb; }
.brand { display: flex; align-items: center; gap: 10px; color: #1c3039; font-size: 17px; font-weight: 720; text-decoration: none; white-space: nowrap; }
.brand-mark { width: 7px; height: 7px; border-radius: 50%; background: #c35124; }
.brand-divider { color: #a1afad; margin: 0 2px; font-weight: 400; }
.brand-label { font-size: 14px; font-weight: 500; color: #53666e; }
.header-actions, .review-actions, .diagnostic-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.save-note { font-size: 12px; color: #53666e; margin-right: 8px; }
.app-layout { display: grid; grid-template-columns: 216px minmax(0, 1fr); gap: 32px; padding-top: 32px; }
.app-layout.automation-layout { grid-template-columns: minmax(0, 1100px); justify-content: center; }
.automation-panel { margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #d3ded8; }
.automation-panel.is-running { position: sticky; top: 0; z-index: 2; padding-top: 16px; padding-bottom: 12px; background: #f5f6f3; }
.automation-panel.is-running h1 { font-size: 20px; letter-spacing: -.02em; }
.automation-summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.automation-summary > div:first-child { min-width: 0; }
.automation-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex-shrink: 0; max-width: 340px; }
.automation-actions > .sequence-field { flex: 0 0 100%; }
.automation-intro, .automation-current { max-width: 65ch; margin: 12px 0 0; font-size: 14px; line-height: 1.65; }
.automation-current { font-weight: 600; }
.automation-progress { display: flex; align-items: center; gap: 12px; margin-top: 12px; font-size: 12px; font-variant-numeric: tabular-nums; }
.automation-progress progress { flex: 1; width: auto; margin: 0; }
.capture-status { margin: 12px 0 0; color: #53666e; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.capture-warning { margin: 8px 0 0; color: #765225; font-size: 12px; line-height: 1.6; }
.automation-evidence { margin-top: 16px; border-top: 1px solid #d3ded8; }
.automation-evidence p { max-width: 80ch; font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; }
.scenario-results { padding-left: 20px; font-size: 13px; }
.scenario-results li { padding: 8px 0; }
.scenario-results span { margin-left: 12px; color: #53666e; }
.task-grid.automated-scene { grid-template-columns: minmax(0, 1fr); }
.case-frame.automation-locked { pointer-events: none; }
main { min-width: 0; }
.sidebar { position: sticky; top: 24px; align-self: start; max-height: calc(100dvh - 48px); overflow-y: auto; padding-right: 12px; scrollbar-width: thin; }
.progress-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13px; }
.progress-heading span { font-size: 11px; color: #53666e; font-variant-numeric: tabular-nums; }
progress { display: block; width: 100%; height: 4px; margin: 10px 0 24px; border: 0; border-radius: 4px; overflow: hidden; background: #dce4df; accent-color: #286f61; }
progress::-webkit-progress-bar { background: #dce4df; }
progress::-webkit-progress-value { background: #286f61; }
.check-group { margin-bottom: 20px; }
.check-group h2 { margin: 0 0 7px 9px; font-size: 11px; line-height: 1.5; font-weight: 650; color: #53666e; }
.check-link { display: grid; width: 100%; grid-template-columns: 20px minmax(0, 1fr) 15px; align-items: center; gap: 8px; padding: 9px 8px; min-height: 42px; border: 1px solid transparent; border-radius: 5px; text-align: left; color: #3e515a; background: transparent; cursor: pointer; }
.check-link:hover { background: #eaf0ec; }
.check-link.is-current { background: #e4eeea; border-color: #c9dcd4; color: #144d46; }
.check-number { font-size: 11px; color: #65777e; font-variant-numeric: tabular-nums; }
.check-name { font-size: 12px; line-height: 1.4; font-weight: 550; }
.status-mark { font-size: 16px; text-align: center; }
.status-pending { color: #71837f; }
.status-pass { color: #176447; }
.status-fail { color: #a8392c; }
.status-not-applicable { color: #65777e; }
.mobile-navigation { display: none; }
.task-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.step-label { margin: 0 0 8px; color: #53666e; font-size: 12px; line-height: 1.4; font-variant-numeric: tabular-nums; }
h1 { margin: 0; font-size: clamp(24px, 2.3vw, 34px); line-height: 1.2; font-weight: 650; letter-spacing: -.035em; }
h1:focus { outline: none; }
h2 { margin: 0; font-size: 16px; line-height: 1.4; font-weight: 650; }
h3 { margin: 20px 0 8px; font-size: 13px; }
.task-grid { display: grid; grid-template-columns: minmax(0, 1fr) 252px; gap: 28px; align-items: start; }
.experiment { min-width: 0; }
.task-steps { margin: 0 0 16px; padding-left: 22px; font-size: 14px; line-height: 1.65; }
.task-steps li { padding-left: 3px; }
.task-steps li + li { margin-top: 8px; }
.expected { margin: 0 0 16px; padding: 12px 14px; border-left: 3px solid #78a499; color: #36574f; background: #edf3ef; font-size: 13px; line-height: 1.6; }
.expected strong { display: block; margin-bottom: 2px; font-size: 11px; font-weight: 650; }
.caution { margin: 0 0 16px; color: #765225; font-size: 12px; line-height: 1.6; }
.run-toolbar { display: flex; gap: 12px; align-items: flex-end; margin: 20px 0; }
.run-toolbar > .case-field { max-width: 340px; }
.run-toolbar .button-primary { min-width: 132px; gap: 18px; }
.button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 9px 13px; border: 1px solid #9aacae; border-radius: 5px; color: #284b58; background: #fff; font-size: 12px; font-weight: 600; line-height: 1.4; text-decoration: none; cursor: pointer; }
.button:hover:not(:disabled) { border-color: #426975; background: #edf3ef; }
.button-primary { color: #fff; background: #174b5c; border-color: #174b5c; }
.button-primary:hover:not(:disabled) { color: #fff; background: #103c4b; }
.button-quiet { background: transparent; border-color: transparent; }
.button-quiet:hover:not(:disabled) { border-color: #b3c1bd; }
.button-danger { color: #9b342a; border-color: #c58e82; }
.button:disabled { cursor: not-allowed; opacity: .5; }
.button[aria-pressed="true"] { color: #174b5c; border-color: #699083; background: #e4eeea; }
.live-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; padding: 0 0 9px; }
.live-label { display: inline-flex; align-items: center; gap: 7px; color: #53666e; font-size: 11px; }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: #8c9c9b; }
.live-dot.is-ready { background: #2a7d60; }
.live-badges { display: flex; align-items: center; gap: 10px; }
.backend-tag { padding: 3px 7px; border: 1px solid #cedbd6; border-radius: 4px; color: #3c6257; background: #edf3ef; font-size: 10px; line-height: 1.4; font-weight: 650; }
.error-link { padding: 3px 0; border: 0; color: #a8392c; background: transparent; font-size: 11px; text-decoration: underline; cursor: pointer; }
.error-link.no-errors { color: #53666e; }
.scene-notice { margin: 0; padding: 10px 12px; color: #765225; background: #fff2df; border: 1px solid #e3cfaf; font-size: 12px; line-height: 1.5; }
.frame-wrap { overflow: hidden; border: 1px solid #ccd8d4; border-radius: 6px; background: #edf2f4; }
.case-frame { display: block; width: 100%; border: 0; }
.parent-narrow { width: min(320px, 100%); }
.task-tools, .evidence-tools { display: flex; flex-wrap: wrap; gap: 4px; }
.task-tools .button, .evidence-tools .button { min-height: 36px; padding: 7px 10px; font-size: 11px; }
.hidden-scene, .notice { padding: 14px; color: #765225; background: #fff2df; font-size: 13px; line-height: 1.6; }
.loss-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 0 0 16px; padding: 12px; border: 1px solid #dfc7bf; border-radius: 5px; }
.capture-preview { margin-top: 12px; }
.capture-preview img { display: block; width: 100%; height: auto; margin-top: 12px; }
.result-panel { min-width: 0; padding: 20px; border: 1px solid #d3ded8; border-radius: 7px; background: #fff; }
.result-panel h2 { margin-bottom: 20px; }
.result-panel .case-field + .case-field { margin-top: 16px; }
.case-field { flex: 1; min-width: 0; }
.case-field label, .mobile-navigation > label { display: block; margin-bottom: 6px; color: #3d535b; font-size: 12px; font-weight: 600; line-height: 1.5; }
.case-field :is(select, input, textarea), .mobile-navigation select { display: block; width: 100%; min-width: 0; min-height: 42px; padding: 9px 10px; color: #1c3039; background: #fff; border: 1px solid #91a5a6; border-radius: 4px; font-size: 13px; line-height: 1.6; }
.case-field select, .mobile-navigation select { padding-right: 28px; }
.case-field textarea { resize: vertical; }
.next-check { margin-top: 20px; width: 100%; justify-content: space-between; }
.field-error { margin: 8px 0 0; color: #a8392c; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.check-details { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e7e2; }
.check-details p, .check-details legend { font-size: 12px; line-height: 1.65; overflow-wrap: anywhere; }
.check-details .case-field { margin-top: 16px; }
.run-associations { min-width: 0; max-height: 240px; overflow: auto; margin: 16px 0 0; padding: 8px; border: 1px solid #d3ded8; }
.checkbox-label { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; font-size: 12px; line-height: 1.5; cursor: pointer; }
.checkbox-label input { flex-shrink: 0; width: 16px; height: 16px; accent-color: #174b5c; }
.checkbox-label code { display: block; font-size: 10px; overflow-wrap: anywhere; }
.supporting-details { margin-top: 32px; padding-top: 8px; border-top: 1px solid #d3ded8; }
summary { padding: 12px 0; color: #385461; font-size: 12px; font-weight: 600; line-height: 1.6; cursor: pointer; }
summary:hover { color: #174b5c; }
.supporting-details > details { border-bottom: 1px solid #dce4df; }
.supporting-details > details > p, .raw-details > p, .source-details p { margin: 4px 0 16px; font-size: 12px; line-height: 1.65; color: #53666e; }
.device-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 4px 0 20px; }
.detail-count { margin-left: 10px; color: #667a80; font-size: 10px; font-weight: 400; }
.diagnostic-actions { margin: 8px 0 16px; }
.observations { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 24px; margin: 16px 0; }
.observations div { min-width: 0; }
.observations dt { color: #53666e; font-size: 11px; }
.observations dd { margin: 4px 0 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.custom-case-form { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
.custom-case-form > .case-field { flex-basis: 180px; }
.capture-list { padding: 0; list-style: none; }
.capture-list li { margin: 12px 0; padding: 12px; border: 1px solid #d3ded8; }
.capture-list code { font-size: 11px; overflow-wrap: anywhere; }
.capture-list p { font-size: 12px; line-height: 1.6; }
.event-list { max-height: 420px; overflow: auto; margin: 16px 0; padding: 0; list-style: none; }
.event-list > li { padding: 12px; border-top: 1px solid #dce4df; border-left: 3px solid #bdd0c8; }
.event-list > li.event-error { background: #fff4ef; border-left-color: #b44937; }
.event-meta { display: flex; flex-wrap: wrap; gap: 8px; color: #64787e; font-size: 10px; font-variant-numeric: tabular-nums; }
.event-list p { margin: 8px 0 0; font-size: 12px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
pre { max-height: 360px; overflow: auto; margin: 4px 0 16px; padding: 14px; border: 1px solid #d6e0da; border-radius: 4px; background: #edf2ef; color: #294650; font: 11px/1.7 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.empty-events { font-size: 12px; color: #53666e; }
.source-links { display: flex; flex-wrap: wrap; gap: 4px 20px; margin: 16px 0; }
.source-links a { display: inline-flex; align-items: center; min-height: 32px; color: #174b5c; font-size: 12px; overflow-wrap: anywhere; text-underline-offset: 3px; }
.privacy-note { display: none; margin: 20px 0 0; color: #53666e; font-size: 12px; line-height: 1.6; }
.review-intro { margin: 16px 0; color: #53666e; font-size: 14px; line-height: 1.6; }
.review-actions { margin: 20px 0; }
.review-list { margin: 24px 0 0; padding: 0; list-style: none; border-top: 1px solid #d3ded8; }
.review-list li { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid #dce4df; }
.review-check { padding: 8px 0; color: #284b58; background: none; border: 0; text-align: left; font-size: 13px; line-height: 1.5; cursor: pointer; }
.result-tag { padding: 4px 8px; color: #53666e; border-radius: 4px; background: #eaf0ec; font-size: 10px; white-space: nowrap; }
.result-pass { color: #176447; background: #e6f3e9; }
.result-fail { color: #a8392c; background: #fff0ea; }
:where(button, a, select, input, textarea, summary, .event-list, pre):focus-visible { outline: 3px solid #c35124; outline-offset: 3px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 1200px) {
  .lab-shell { padding-inline: 24px; }
  .app-layout { grid-template-columns: 190px minmax(0, 1fr); gap: 24px; }
  .task-grid { grid-template-columns: minmax(0, 1fr) 232px; gap: 20px; }
  .result-panel { padding: 16px; }
}
@media (max-width: 980px) {
  .app-layout { display: block; padding-top: 24px; }
  .sidebar { display: none; }
  .mobile-navigation { display: block; margin-bottom: 24px; }
  .save-note { display: none; }
  .privacy-note { display: block; }
}
@media (max-width: 700px) {
  .lab-shell { padding-inline: 16px; }
  .topbar { min-height: 96px; flex-wrap: wrap; align-content: center; gap: 10px; padding-block: 14px; }
  .brand { flex-basis: 100%; font-size: 16px; }
  .header-actions { width: 100%; justify-content: space-between; }
  .header-actions .button { min-height: 40px; }
  .header-actions .button-quiet { padding-left: 0; }
  .task-grid { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .task-heading { align-items: flex-start; margin-bottom: 20px; }
  .previous-check { padding: 6px 0 6px 10px; min-width: 60px; }
  h1 { font-size: 26px; }
  .task-steps { font-size: 14px; }
  .run-toolbar { flex-wrap: wrap; }
  .run-toolbar .case-field { flex-basis: 100%; max-width: none; }
  .run-toolbar .button-primary { width: 100%; justify-content: center; }
  .task-tools .button, .evidence-tools .button { min-height: 44px; padding: 9px 10px; }
  .result-panel { padding: 20px; }
  .device-grid { grid-template-columns: minmax(0, 1fr); }
  .observations { grid-template-columns: 1fr 1fr; }
  .case-field :is(select, input, textarea), .mobile-navigation select { font-size: 16px; }
  .review-list li { grid-template-columns: 20px minmax(0, 1fr) auto; gap: 8px; }
  .review-list li > .button { grid-column: 2; justify-self: start; min-height: 32px; padding-left: 0; }
  .result-tag { font-size: 10px; }
  .automation-summary { flex-direction: column; gap: 16px; }
  .automation-actions { width: 100%; max-width: none; }
  .automation-panel.is-running .automation-summary { gap: 8px; }
}
@media (forced-colors: active) {
  .button, .backend-tag, .result-tag, .check-link.is-current { border: 1px solid CanvasText; }
  .live-dot { background: CanvasText; }
}
</style>
