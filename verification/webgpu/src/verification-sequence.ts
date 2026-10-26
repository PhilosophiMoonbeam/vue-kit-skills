import { manualChecks, type Command, type FrameState, type Mode, type SceneId } from './lab-contract'

export type VerificationProfile = 'full' | 'visibility'
export type CheckId = typeof manualChecks[number]['id']
export interface RunEvidence {
  id: string
  scene: SceneId
  mode: Mode
  state: FrameState | null
  events: { category: string; message: string; detail?: unknown }[]
  unmountRequested: boolean
}
export interface VerificationBridge {
  start(scene: SceneId, mode: Mode, checkIds: CheckId[], signal: AbortSignal): Promise<RunEvidence>
  inspect(signal: AbortSignal): Promise<RunEvidence>
  current(): RunEvidence | null
  command(command: Command): boolean
  action(action: 'play' | 'pause' | 'retire-first' | 'retire-final' | 'restart-cycle' | 'ownership-snapshot' | 'select-left' | 'activate-selected' | 'clear-selection', signal: AbortSignal): Promise<void>
  layout(width: 'narrow' | 'wide', hidden: boolean, signal: AbortSignal): Promise<void>
  checkpoint(label: string, signal: AbortSignal): Promise<void>
  reducedMotion(): boolean
}
export interface VerificationObservation { label: string; runId?: string; detail?: unknown }
export interface VerificationCase {
  id: string
  label: string
  checkIds: CheckId[]
  runIds: string[]
  status: 'pending' | 'running' | 'observed' | 'issues' | 'unobserved' | 'cancelled'
  observations: VerificationObservation[]
  issues: string[]
  errors: unknown[]
}
export interface VerificationReport {
  id: string
  profile: VerificationProfile
  startedAt: string
  finishedAt?: string
  status: 'running' | 'completed' | 'cancelled'
  currentLabel: string
  completed: number
  total: number
  cases: VerificationCase[]
  coverage: { checkId: CheckId; runIds: string[]; applicability: 'review-required' | 'not-used'; remainingReview: string[] }[]
}

type RecordValue = Record<string, unknown>
type CaseWork = (entry: VerificationCase) => Promise<void>
const record = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const metrics = (run: RunEvidence) => record(run.state?.metrics)
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const consumer = (event: RunEvidence['events'][number]) => record(record(event.detail).consumerObservation)
const findEvent = (run: RunEvidence, message: string, predicate: (detail: RecordValue) => boolean = () => true) =>
  run.events.find(event => event.message === message && predicate(consumer(event)))
function latestEvent(run: RunEvidence, message: string) {
  for (let index = run.events.length - 1; index >= 0; index -= 1) {
    const event = run.events[index]!
    if (event.message === message) return event
  }
}
const rawError = (event: RunEvidence['events'][number]) => ['component-error', 'unhandled-rejection', 'window-error', 'gpu-validation'].includes(event.category)
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T
const errorDetail = (error: unknown): unknown => error instanceof Error
  ? { name: error.name, message: error.message, stack: error.stack, ...('cause' in error ? { cause: String(error.cause) } : {}) }
  : clone(error)
const abortError = () => new DOMException('Verification sequence cancelled.', 'AbortError')
function checkAbort(signal: AbortSignal): void { if (signal.aborted) throw abortError() }
function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  checkAbort(signal)
  return new Promise((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); reject(abortError()) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve() }, milliseconds)
    signal.addEventListener('abort', aborted, { once: true })
  })
}

const remainingReview: Record<CheckId, string[]> = {
  'gpu-01': ['Review actual canvas and selected-display captures for framing, lighting, DOM description and unexpected raw errors. Metrics and readiness do not prove visible output.'],
  'gpu-02': ['Review actual backend/device and adapter evidence plus output. Normal APIs are untouched; no extra adapter probe or native-hardware certification is made. Masked, absent or software identity remains uncertain.'],
  'gpu-03': ['Review visible fallback output and raw teardown evidence separately for both injected profiles; a real adapter is necessary to exercise requestDevice rejection.'],
  'gpu-04': ['Review the actual host alert and useful alternative under explicit WebGL2 denial; no WebGL1 fallback is inferred.'],
  'gpu-05': ['Both deliberate denial profiles retain initialization and late raw teardown errors. The known pinned async-dispose/init rejection is evidence, never a clean-recovery pass.'],
  'gpu-06': ['Review visible stopped/playing/paused/invalidated states. Counters and rotations are observations, not GPU completion. Scripted button.click is untrusted, not physical input.'],
  'gpu-07': ['Only the actual current OS preference is observed. Human/OS initial reduce and no-preference profiles, live transitions and post-unmount media-query listener release remain unproved; scripts never spoof matchMedia.'],
  'gpu-08': ['Review narrow/wide/hidden/shown captures for camera framing, overflow and DPR on the target display. DOM sizes and DPR metrics do not prove visual quality or absence of competing resize work.'],
  'gpu-09': ['Only untrusted same-origin DOM button.click select/activate/clear is exercised. Trusted Tab/Enter/Space, pointer hover/click/dblclick/miss, hit coordinates, ancestor propagation and stopPropagation require real input review.'],
  'gpu-10': ['Review repeated equal-workload active snapshots and raw teardown timelines; partial renderer counters need not become zero and are not a VRAM certificate. Release of every listener, observer and forwarder is not directly proved.'],
  'gpu-11': ['Review real fixture output and host loader status/errors. Actual local 200/404 fixture requests do not test CORS or offline behavior; inspect retained request evidence where available.'],
  'gpu-12': ['Review loading/unmount/late-success ordering and native disposal counts. The request is not cancelled; native dispose events do not prove driver memory reclamation.'],
  'gpu-13': ['Review second-consumer output after first retirement and final six-kind ownership ledgers. Constructor args remain fixed; ref replacement and implicit cleanup of replaced resources are not exercised.'],
  'gpu-14': ['Review actual native loss event/device.lost, owner retirement and fresh-run recreation. Unsupported loss stays unobserved. Deliberately induced loss/device destruction is not a spontaneous driver failure or automatic recovery.'],
  'gpu-15': ['Not used by the retained examples: no custom node shader is present. Baseline run linkage is context only, not a custom-shader pass.'],
  'gpu-16': ['Not used by the retained examples: no custom postprocessing, render override or shadow pipeline is exercised. The ownership target is an allocation/disposal probe, not postFX.'],
  'gpu-17': ['Review separately retained native canvas PNG and permission-gated selected-display frame channels, their timestamps, dimensions, drawing-buffer settings and explicit capture errors. Display capture is not a full-page screenshot or native canvas readback; disagreement alone is not rendering failure.'],
}

/** Observations only: this runner never changes manual verdicts or certifies GPU hardware. */
export async function runVerification(bridge: VerificationBridge, signal: AbortSignal, onUpdate: (report: VerificationReport) => void, profile: VerificationProfile = 'full'): Promise<VerificationReport> {
  const report: VerificationReport = {
    id: `sequence-${Date.now().toString(36)}`, profile, startedAt: new Date().toISOString(), status: 'running', currentLabel: 'Preparing sequence',
    completed: 0, total: 0, cases: [],
    coverage: manualChecks
      .filter(check => profile === 'full' || ['gpu-08', 'gpu-17'].includes(check.id))
      .map(check => ({ checkId: check.id, runIds: [], applicability: check.id === 'gpu-15' || check.id === 'gpu-16' ? 'not-used' : 'review-required', remainingReview: [...remainingReview[check.id]] })),
  }
  const runs = new Map<string, RunEvidence>()
  const works: CaseWork[] = []
  function publish(): VerificationReport {
    const snapshot: VerificationReport = {
      ...report,
      cases: report.cases.map(entry => ({ ...entry, checkIds: [...entry.checkIds], runIds: [...entry.runIds], observations: [...entry.observations], issues: [...entry.issues], errors: [...entry.errors] })),
      coverage: report.coverage.map(entry => ({ ...entry, runIds: [...entry.runIds], remainingReview: [...entry.remainingReview] })),
    }
    onUpdate(snapshot)
    return snapshot
  }
  function add(id: string, label: string, checkIds: CheckId[], work: CaseWork): void {
    if (profile === 'visibility' && id !== 'webgl-layout' && id !== 'webgpu-layout') return
    report.cases.push({ id, label, checkIds, runIds: [], status: 'pending', observations: [], issues: [], errors: [] })
    works.push(work)
  }
  function link(entry: VerificationCase, run: RunEvidence): RunEvidence {
    runs.set(run.id, run)
    if (!entry.runIds.includes(run.id)) entry.runIds.push(run.id)
    for (const coverage of report.coverage) {
      if (entry.checkIds.includes(coverage.checkId) && !coverage.runIds.includes(run.id)) coverage.runIds.push(run.id)
    }
    return run
  }
  function observe(entry: VerificationCase, label: string, detail?: unknown): void {
    const run = bridge.current()
    entry.observations.push({ label, ...(run ? { runId: run.id } : {}), ...(detail === undefined ? {} : { detail: clone(detail) }) })
    publish()
  }
  function issue(entry: VerificationCase, message: string): void { entry.issues.push(message); publish() }
  function requireObservation(entry: VerificationCase, condition: boolean, message: string): void { if (!condition) issue(entry, message) }
  async function bounded<T>(label: string, operation: (child: AbortSignal) => Promise<T>, timeout = 15_000): Promise<T> {
    checkAbort(signal)
    const controller = new AbortController()
    let timer: number | undefined
    let cancel: (() => void) | undefined
    const interruption = new Promise<never>((_resolve, reject) => {
      cancel = () => { controller.abort(); reject(abortError()) }
      signal.addEventListener('abort', cancel, { once: true })
      timer = window.setTimeout(() => { controller.abort(); reject(new Error(`${label}: no completion within ${timeout} ms.`)) }, timeout)
    })
    try { return await Promise.race([operation(controller.signal), interruption]) }
    finally { clearTimeout(timer); if (cancel) signal.removeEventListener('abort', cancel); controller.abort() }
  }
  async function inspect(entry: VerificationCase): Promise<RunEvidence> {
    return link(entry, await bounded('Fresh inspection', child => bridge.inspect(child), 4_000))
  }
  async function start(entry: VerificationCase, scene: SceneId, mode: Mode = 'normal'): Promise<RunEvidence> {
    const oldId = bridge.current()?.id
    try { return link(entry, await bounded(`Start ${scene}/${mode}`, child => bridge.start(scene, mode, entry.checkIds, child), 20_000)) }
    finally {
      const current = bridge.current()
      if (current && current.id !== oldId) link(entry, current)
    }
  }
  async function waitFor(entry: VerificationCase, label: string, predicate: (run: RunEvidence) => boolean, timeout = 10_000): Promise<RunEvidence> {
    const until = Date.now() + timeout
    let last: RunEvidence | undefined
    do {
      checkAbort(signal)
      last = await inspect(entry)
      if (predicate(last)) return last
      await delay(Math.min(120, Math.max(1, until - Date.now())), signal)
    } while (Date.now() < until)
    observe(entry, `${label}: final observed state at timeout`, last)
    throw new Error(`${label}: required observation did not arrive within ${timeout} ms.`)
  }
  async function windowOf(entry: VerificationCase, label: string, duration = 650): Promise<RunEvidence[]> {
    const samples: RunEvidence[] = []
    const until = Date.now() + duration
    do {
      samples.push(await inspect(entry))
      if (Date.now() < until) await delay(Math.min(120, until - Date.now()), signal)
    } while (Date.now() < until)
    observe(entry, label, samples.map(run => ({ id: run.id, state: run.state })))
    return samples
  }
  async function step(entry: VerificationCase, label: string, work: () => Promise<void>): Promise<void> {
    checkAbort(signal)
    report.currentLabel = `${entry.label} · ${label}`
    publish()
    try { await work() }
    catch (error) {
      if (signal.aborted) throw error
      entry.errors.push({ label, error: errorDetail(error) })
      issue(entry, `${label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  async function checkpoint(entry: VerificationCase, label: string): Promise<void> {
    await step(entry, label, async () => {
      const run = await inspect(entry)
      observe(entry, `${label}: actual state before capture`, run.state)
      await bounded(`Checkpoint ${label}`, child => bridge.checkpoint(`${entry.id}: ${label}`, child), 18_000)
      observe(entry, `${label}: checkpoint requested through the real canvas/display channels; retained channel results must be reviewed separately.`)
    })
  }
  async function ready(entry: VerificationCase): Promise<RunEvidence> {
    const run = await waitFor(entry, 'Initialized renderer and actual render notification', current => current.state?.ready === true && (number(metrics(current).renderEvents) ?? 0) > 0)
    observe(entry, 'Actual initialized renderer, capability state and render notification', run.state)
    return run
  }
  function command(command: Command): void { if (!bridge.command(command)) throw new Error(`The ${command} command could not be delivered to the current iframe.`) }
  async function action(name: Parameters<VerificationBridge['action']>[0]): Promise<void> {
    await bounded(`DOM ${name}`, child => bridge.action(name, child), 5_000)
  }
  async function unmount(entry: VerificationCase): Promise<void> {
    command('unmount')
    const run = await waitFor(entry, 'Actual application unmount', current => metrics(current).applicationUnmounted === true && current.state?.canvasMounted === false, 5_000)
    observe(entry, 'Explicit unmount requested; actual application/canvas state', { unmountRequested: run.unmountRequested, state: run.state })
  }
  function rotation(run: RunEvidence): unknown { return record(list(record(metrics(run).scene).meshSamples)[0]).rotation }
  function unexpected(entry: VerificationCase, run: RunEvidence): void {
    const errors = run.events.filter(rawError)
    if (errors.length) issue(entry, `${errors.length} raw error/validation event(s) observed in a non-denial scenario; inspect the retained raw errors.`)
  }
  function disposalRecords(detail: RecordValue): RecordValue[] { return list(detail.resources).map(record) }
  function onceOnly(records: RecordValue[]): boolean { return records.length > 0 && records.every(resource => resource.events === 1) }
  function ownSnapshot(run: RunEvidence, predicate: (detail: RecordValue) => boolean) {
    for (let index = run.events.length - 1; index >= 0; index -= 1) {
      const event = run.events[index]!
      if (event.message === 'Comparable active-scene ownership snapshot.' && predicate(consumer(event))) return event
    }
  }

  for (const scene of ['webgl', 'webgpu'] as const) {
    add(`${scene}-baseline`, `${scene === 'webgl' ? 'WebGL' : 'WebGPU'}: baseline and on-demand rendering`, scene === 'webgl' ? ['gpu-01', 'gpu-06', 'gpu-07', 'gpu-17'] : ['gpu-02', 'gpu-15', 'gpu-16', 'gpu-17'], async entry => {
      await start(entry, scene)
      const initial = await ready(entry)
      requireObservation(entry, initial.state?.rendererFamily === scene, `Expected renderer family ${scene}; actual family is ${initial.state?.rendererFamily}.`)
      requireObservation(entry, initial.state?.backend === 'webgl2' || initial.state?.backend === 'webgpu', 'No actual initialized backend was identified.')
      if (scene === 'webgl') observe(entry, 'Actual current OS reduced-motion preference; no preference mutation', { reducedMotion: bridge.reducedMotion() })
      await checkpoint(entry, 'initial stopped output')
      const stopped = await windowOf(entry, 'Bounded default stopped render/rotation observations')
      requireObservation(entry, stopped.every(run => JSON.stringify(rotation(run)) === JSON.stringify(rotation(stopped[0]!))), 'Rotation changed in the default stopped observation window.')
      requireObservation(entry, stopped.every(run => metrics(run).renderEvents === metrics(stopped[0]!).renderEvents), 'Render notifications continued in the default stopped window; review on-demand behavior.')
      await step(entry, 'imperative rotation plus explicit invalidation', async () => {
        const before = await inspect(entry)
        command('invalidate')
        const after = await waitFor(entry, 'Changed rotation and a later real render notification', run => (number(metrics(run).renderEvents) ?? 0) > (number(metrics(before).renderEvents) ?? 0) && JSON.stringify(rotation(run)) !== JSON.stringify(rotation(before)))
        observe(entry, 'Explicit invalidation before/after', { before: before.state, after: after.state })
        await checkpoint(entry, 'imperatively rotated output')
      })
      if (scene === 'webgl') {
        if (bridge.reducedMotion()) observe(entry, 'Play skipped: the actual current reduced-motion preference disables the retained control; initial/live alternate OS profiles remain review work.')
        else await step(entry, 'untrusted DOM play and pause', async () => {
          const before = await inspect(entry)
          await action('play')
          const playing = await waitFor(entry, 'Real play motion and render notifications', run => JSON.stringify(rotation(run)) !== JSON.stringify(rotation(before)) && (number(metrics(run).renderEvents) ?? 0) > (number(metrics(before).renderEvents) ?? 0))
          observe(entry, 'Playing rotation/render observation; button.click is not trusted user input', playing.state)
          await checkpoint(entry, 'playing output')
          await action('pause')
          await windowOf(entry, 'Pause transition settling observations', 250)
          const paused = await windowOf(entry, 'Bounded paused render/rotation observations')
          requireObservation(entry, paused.every(run => JSON.stringify(rotation(run)) === JSON.stringify(rotation(paused[0]!))), 'Rotation continued during the paused observation window.')
          requireObservation(entry, paused.every(run => metrics(run).renderEvents === metrics(paused[0]!).renderEvents), 'Render notifications continued during the paused observation window.')
          await checkpoint(entry, 'paused output')
        })
      }
      await unmount(entry)
      const final = (await windowOf(entry, 'Post-unmount raw error observation window')).at(-1)!
      unexpected(entry, final)
    })
    add(`${scene}-layout`, `${scene === 'webgl' ? 'WebGL' : 'WebGPU'}: narrow, wide, hidden and shown`, ['gpu-08', 'gpu-17'], async entry => {
      await start(entry, scene)
      await ready(entry)
      const widths: Record<string, number | undefined> = {}
      for (const state of [{ width: 'narrow', hidden: false }, { width: 'wide', hidden: false }, { width: 'wide', hidden: true }, { width: 'wide', hidden: false }] as const) {
        await step(entry, `${state.width}/${state.hidden ? 'hidden' : 'shown'}`, async () => {
          await bounded('Real DOM layout change', child => bridge.layout(state.width, state.hidden, child), 5_000)
          let previousSize: string | undefined
          let stableSamples = 0
          const run = await waitFor(entry, 'Actual host size response', current => {
            const canvas = record(metrics(current).canvas)
            const css = record(canvas.css)
            if (state.hidden) return css.width === 0 && css.height === 0
            const width = number(css.width)
            const height = number(css.height)
            const parent = record(canvas.parentCss)
            const aspect = number(record(metrics(current).camera).aspect)
            const fitted = width !== undefined && height !== undefined && width > 0 && height > 0
              && Math.abs(width - (number(parent.width) ?? NaN)) <= 2
              && Math.abs(height - (number(parent.height) ?? NaN)) <= 2
              && Math.abs(width - (number(canvas.width) ?? NaN)) <= 2
              && Math.abs(height - (number(canvas.height) ?? NaN)) <= 2
              && aspect !== undefined && Math.abs(aspect - width / height) < 0.01
            if (!fitted) { previousSize = undefined; stableSamples = 0; return false }
            const size = `${width}:${height}:${aspect}`
            stableSamples = size === previousSize ? stableSamples + 1 : 1
            previousSize = size
            return stableSamples >= 2
          }, 5_000)
          observe(entry, 'Layout response and camera/DPR state', run.state)
          if (!state.hidden) {
            widths[state.width] = number(record(record(metrics(run).canvas).css).width)
            requireObservation(entry, metrics(run).rendererDpr === 1, 'Observed renderer DPR does not equal the declared DPR=1.')
            const canvas = record(metrics(run).canvas)
            const css = record(canvas.css)
            requireObservation(entry, Math.abs((number(canvas.width) ?? NaN) - (number(css.width) ?? NaN)) <= 2 && Math.abs((number(canvas.height) ?? NaN) - (number(css.height) ?? NaN)) <= 2, 'Drawing-buffer and CSS dimensions do not match DPR=1 within rounding tolerance.')
          }
          await checkpoint(entry, `${state.width} ${state.hidden ? 'hidden' : 'shown'} output`)
        })
      }
      requireObservation(entry, widths.wide !== undefined && widths.narrow !== undefined && widths.wide > widths.narrow, 'Narrow/wide actual canvas widths did not establish an increasing size transition.')
      if (profile === 'visibility') {
        await step(entry, 'repeated hide/show and width changes', async () => {
          for (const width of ['narrow', 'wide', 'narrow', 'wide'] as const) {
            await bounded('Hide mounted host', child => bridge.layout(width, true, child), 5_000)
            await inspect(entry)
            await bounded('Show mounted host', child => bridge.layout(width, false, child), 5_000)
          }
          const restored = await waitFor(entry, 'Positive-size output after repeated visibility changes', current => {
            const canvas = record(metrics(current).canvas)
            const css = record(canvas.css)
            const width = number(css.width)
            const height = number(css.height)
            const aspect = number(record(metrics(current).camera).aspect)
            return width !== undefined && height !== undefined && width > 0 && height > 0
              && Math.abs(width - (number(canvas.width) ?? NaN)) <= 2
              && Math.abs(height - (number(canvas.height) ?? NaN)) <= 2
              && aspect !== undefined && Math.abs(aspect - width / height) < 0.01
          }, 5_000)
          observe(entry, 'Restored dimensions, camera and actual selected backend', restored.state)
          await checkpoint(entry, 'restored output after repeated visibility changes')
        })
      }
      unexpected(entry, await inspect(entry))
      await unmount(entry)
    })
  }

  for (const mode of ['adapter-unavailable', 'device-rejected'] as const) {
    add(`fallback-${mode}`, `WebGL2 fallback: ${mode === 'adapter-unavailable' ? 'adapter unavailable' : 'device denied'}`, ['gpu-03', 'gpu-17'], async entry => {
      await start(entry, 'webgpu', mode)
      const run = await ready(entry)
      requireObservation(entry, run.state?.rendererFamily === 'webgpu' && run.state.backend === 'webgl2', 'Injected fallback did not establish WebGPURenderer family with an actual WebGL2 backend.')
      const injected = run.events.filter(event => event.message.startsWith('Intervention:'))
      observe(entry, 'Actual fault-profile intervention events', injected)
      requireObservation(entry, injected.some(event => event.message.startsWith(mode === 'device-rejected' ? 'Intervention: GPUAdapter.requestDevice returns a rejected' : 'Intervention: GPU.requestAdapter resolves null')), 'The intended adapter/device intervention was not observed; unavailable native adapters cannot prove device rejection.')
      await checkpoint(entry, 'actual fallback output')
      await unmount(entry)
      unexpected(entry, (await windowOf(entry, 'Fallback post-unmount raw error window')).at(-1)!)
    })
  }
  add('ordinary-webgl-denial', 'Ordinary WebGL2 unavailable host alternative', ['gpu-04'], async entry => {
    await start(entry, 'webgl', 'webgl-unavailable')
    const run = await waitFor(entry, 'Actual ordinary unavailable DOM alert', current => current.events.some(event => event.message === 'Inspection of the actual canvas, initialized renderer and current scene state.' && typeof record(event.detail).alert === 'string' && String(record(event.detail).alert).trim().length > 0))
    observe(entry, 'Actual unavailable state and DOM alert', { state: run.state, inspection: latestEvent(run, 'Inspection of the actual canvas, initialized renderer and current scene state.') })
    requireObservation(entry, !run.state?.ready && !run.state?.canvasMounted, 'Ordinary unavailable profile unexpectedly retained a ready or mounted canvas.')
    await checkpoint(entry, 'ordinary unavailable DOM alternative')
    await unmount(entry)
    await windowOf(entry, 'Ordinary denial post-unmount raw error window')
  })
  for (const mode of ['both-unavailable', 'device-and-fallback-unavailable'] as const) {
    add(`double-denial-${mode}`, mode === 'both-unavailable' ? 'Adapter and WebGL2 denied' : 'Device and WebGL2 denied', ['gpu-05'], async entry => {
      await start(entry, 'webgpu', mode)
      await step(entry, 'actual INITIALIZATION_FAILED host alert', async () => {
        const run = await waitFor(entry, 'INITIALIZATION_FAILED error and actual host alert', current => {
          const alert = record(latestEvent(current, 'Inspection of the actual canvas, initialized renderer and current scene state.')?.detail).alert
          return typeof alert === 'string' && alert.trim().length > 0 && current.events.some(event => rawError(event) && String(JSON.stringify(event.detail)).includes('INITIALIZATION_FAILED'))
        })
        observe(entry, 'Actual initialization error, DOM alert and intervention details', { state: run.state, events: run.events.filter(event => rawError(event) || event.message.startsWith('Intervention:')), inspection: latestEvent(run, 'Inspection of the actual canvas, initialized renderer and current scene state.') })
        if (mode === 'device-and-fallback-unavailable') requireObservation(entry, run.events.some(event => event.message.startsWith('Intervention: GPUAdapter.requestDevice returns a rejected')), 'Real requestDevice rejection was not reached on this device; profile intent alone is not device-rejection evidence.')
      })
      await checkpoint(entry, 'double-denial DOM and initialization evidence')
      await step(entry, 'explicit unmount and raw late error retention', async () => {
        await unmount(entry)
        const samples = await windowOf(entry, 'Bounded post-unmount raw teardown error timeline; known pinned failure is not clean recovery', 2_000)
        const run = samples.at(-1)!
        observe(entry, 'Raw teardown errors retained without suppression', run.events.filter(rawError))
        if (!run.events.some(event => event.category === 'unhandled-rejection' && event.message === 'Unhandled promise rejection after application unmount.')) observe(entry, 'No late unhandled rejection was observed in this bounded window; absence is not a clean-recovery certification.')
      })
    })
  }

  for (const mode of ['normal', 'asset-unavailable'] as const) {
    add(`asset-${mode}`, `Real Box asset: ${mode === 'normal' ? 'local success fixture' : 'local missing/404 fixture'}`, ['gpu-11', 'gpu-17'], async entry => {
      await start(entry, 'asset', mode)
      const run = await waitFor(entry, 'Real loader terminal observation', current => mode === 'normal'
        ? !!findEvent(current, 'Real GLTF loader success.', detail => detail.alive === true)
        : !!findEvent(current, 'Reactive loader state.', detail => typeof detail.error === 'string' && detail.error.length > 0))
      observe(entry, 'Actual fixture request and loader result; no CORS/offline claim', run.events.filter(event => event.category === 'asset'))
      if (mode === 'normal') {
        const success = consumer(findEvent(run, 'Real GLTF loader success.', detail => detail.alive === true)!)
        requireObservation(entry, typeof success.sceneUuid === 'string' && list(success.bounds).length === 3 && list(success.bounds).every(value => (number(value) ?? 0) > 0), 'Real Box success did not report an actual scene identity and nonzero three-dimensional bounds.')
        await ready(entry)
        const loaded = await waitFor(entry, 'Real loaded scene mesh attached', current => (number(record(metrics(current).scene).meshCount) ?? 0) > 0)
        command('invalidate')
        const rendered = await waitFor(entry, 'Real render notification with loaded scene attached', current => (number(record(metrics(current).scene).meshCount) ?? 0) > 0 && (number(metrics(current).renderEvents) ?? 0) > (number(metrics(loaded).renderEvents) ?? 0))
        observe(entry, 'Loaded scene mesh and subsequent actual render notification', rendered.state)
      } else {
        const status = consumer(findEvent(run, 'Reactive loader state.', detail => typeof detail.error === 'string' && detail.error.length > 0)!)
        requireObservation(entry, String(status.message).startsWith('Model load failed:'), 'Missing asset did not expose the consumer failure status.')
        requireObservation(entry, /\b404\b/.test(String(status.error)), 'An actual loader error was observed, but its retained error did not establish HTTP 404.')
      }
      await checkpoint(entry, mode === 'normal' ? 'real Box loaded output' : 'missing asset host status')
      await unmount(entry)
      await windowOf(entry, 'Asset retirement and raw error window')
      if (mode === 'normal') unexpected(entry, await inspect(entry))
    })
  }
  add('asset-late-completion', 'Remove a loading scene and inspect late cleanup', ['gpu-12'], async entry => {
    const started = Date.now()
    await start(entry, 'asset', 'asset-delayed')
    const loading = await waitFor(entry, 'Actual loading state before success', current => {
      const loaderEvent = latestEvent(current, 'Reactive loader state.')
      const loader = loaderEvent ? consumer(loaderEvent) : {}
      if (loader.error) throw new Error(`Delayed fixture request failed before removal: ${String(loader.error)}`)
      return loader.isLoading === true && loader.hasScene === false && !findEvent(current, 'Real GLTF loader success.')
    }, 2_000)
    observe(entry, 'Actual pending loader state before explicit unmount', loading.events.filter(event => event.category === 'asset'))
    // Do not capture before teardown: a permission/frame wait could consume the three-second server delay.
    command('unmount')
    const requestedAfterMs = Date.now() - started
    observe(entry, 'Unmount command timing from fresh run start', { requestedAfterMs, beforeThreeSeconds: requestedAfterMs < 3_000 })
    requireObservation(entry, requestedAfterMs < 3_000, 'Unmount request was not delivered within three seconds of run start.')
    await waitFor(entry, 'Actual unmounted loader before its late success', current => metrics(current).applicationUnmounted === true && !!findEvent(current, 'Box loader unmounted.', detail => detail.loadingAtUnmount === true && detail.resolvedAtUnmount === false), 4_000)
    const run = await waitFor(entry, 'Actual late loader success and cleanup', current => !!findEvent(current, 'Real GLTF loader success.', detail => detail.alive === false) && !!findEvent(current, 'Late-result cleanup completed.'), 10_000)
    const success = findEvent(run, 'Real GLTF loader success.', detail => detail.alive === false)!
    const cleanup = findEvent(run, 'Late-result cleanup completed.')!
    const unmounted = findEvent(run, 'Box loader unmounted.', detail => detail.loadingAtUnmount === true)!
    requireObservation(entry, run.events.indexOf(unmounted) < run.events.indexOf(success) && run.events.indexOf(success) < run.events.indexOf(cleanup), 'The retained consumer event order did not establish unmount then late success then cleanup.')
    const resources = disposalRecords(consumer(cleanup))
    const native = run.events.filter(event => event.message === 'Native Three resource dispose event.' && record(consumer(event).owner).scene === 'asset')
    requireObservation(entry, onceOnly(resources), 'Late-result resource ledger is missing or contains native disposal counts other than one.')
    requireObservation(entry, native.length === resources.length && resources.every(resource => native.filter(event => consumer(event).kind === resource.kind && consumer(event).uuid === resource.uuid).length === 1), 'Late-result native disposal event counts did not match each unique returned resource exactly once.')
    requireObservation(entry, run.state?.canvasMounted === false, 'An abandoned canvas remained mounted after late asset completion.')
    observe(entry, 'Actual late success, native disposal events and final owner ledger', { unmounted, success, native, cleanup, state: run.state })
    await checkpoint(entry, 'late result retired; no abandoned canvas')
    unexpected(entry, run)
  })

  add('ownership-lifetimes', 'Shared resources: retire consumers and restart', ['gpu-13', 'gpu-10', 'gpu-17'], async entry => {
    await start(entry, 'ownership')
    await ready(entry)
    const both = await waitFor(entry, 'Both actual consumers sharing owned resources', current => !!ownSnapshot(current, detail => detail.cycle === 1 && detail.bothShareGeometry === true && detail.bothShareMaterial === true && record(detail.first).attached === true && record(detail.second).attached === true))
    const bothDetail = consumer(ownSnapshot(both, detail => detail.cycle === 1 && detail.bothShareGeometry === true)!)
    observe(entry, 'Initial real shared identities and native disposal ledger', bothDetail)
    requireObservation(entry, disposalRecords(bothDetail).every(resource => resource.events === 0), 'A shared resource was disposed before either consumer retired.')
    await checkpoint(entry, 'both shared consumers')
    await action('retire-first')
    const one = await waitFor(entry, 'Second consumer still live after first retirement', current => !!ownSnapshot(current, detail => detail.cycle === 1 && detail.first === null && record(detail.second).attached === true && detail.liveMeshes === 1))
    const oneDetail = consumer(ownSnapshot(one, detail => detail.cycle === 1 && detail.first === null && record(detail.second).attached === true)!)
    requireObservation(entry, record(oneDetail.second).geometryUuid === record(bothDetail.second).geometryUuid && record(oneDetail.second).materialUuid === record(bothDetail.second).materialUuid && record(oneDetail.second).meshUuid === record(bothDetail.second).meshUuid, 'The surviving consumer did not retain its actual mesh/geometry/material identities.')
    requireObservation(entry, disposalRecords(oneDetail).every(resource => resource.events === 0), 'Shared native disposal was observed while the second consumer remained live.')
    observe(entry, 'First retired; actual second consumer and unchanged shared identities', oneDetail)
    await checkpoint(entry, 'second consumer remains intact')
    await action('retire-final')
    const retired = await waitFor(entry, 'Actual final owner six-kind release', current => !!findEvent(current, 'Final explicit owner released all six owned resource kinds.', detail => detail.cycle === 1) && !!ownSnapshot(current, detail => detail.cycle === 1 && detail.liveMeshes === 0))
    const release = consumer(findEvent(retired, 'Final explicit owner released all six owned resource kinds.', detail => detail.cycle === 1)!)
    const kinds = ['geometry', 'material', 'map', 'normalMap', 'environment', 'render-target']
    const resources = disposalRecords(release)
    requireObservation(entry, resources.length === 6 && onceOnly(resources) && kinds.every(kind => resources.filter(resource => resource.kind === kind).length === 1), 'Final owner ledger did not show exactly one native disposal for all six owned resource kinds.')
    observe(entry, 'Actual final owner release and ledger', release)
    await checkpoint(entry, 'all consumers retired')
    await action('restart-cycle')
    const restarted = await waitFor(entry, 'Fresh two-consumer ownership cycle', current => !!ownSnapshot(current, detail => detail.cycle === 2 && detail.bothShareGeometry === true && detail.liveMeshes === 2))
    const restartedDetail = consumer(ownSnapshot(restarted, detail => detail.cycle === 2 && detail.bothShareGeometry === true)!)
    requireObservation(entry, record(restartedDetail.second).geometryUuid !== record(bothDetail.second).geometryUuid, 'Fresh ownership cycle did not establish a new geometry owner identity.')
    observe(entry, 'Explicit fresh cycle actual identities and equivalent workload', restartedDetail)
    await checkpoint(entry, 'fresh shared-owner cycle')
    await unmount(entry)
    unexpected(entry, (await windowOf(entry, 'Ownership post-unmount raw errors')).at(-1)!)
  })

  for (const scene of ['webgl', 'ownership'] as const) {
    add(`${scene}-repeated-workload`, `${scene === 'webgl' ? 'WebGL' : 'Shared resources'}: three matching resource-use cycles`, ['gpu-10'], async entry => {
      const snapshots: unknown[] = []
      for (let cycle = 1; cycle <= 3; cycle += 1) {
        await step(entry, `equal-workload cycle ${cycle}`, async () => {
          await start(entry, scene)
          await ready(entry)
          // Keep identical width, scene contents, mode and invalidation workload in every fresh owner.
          await bounded('Comparable wide layout', child => bridge.layout('wide', false, child), 5_000)
          const before = await inspect(entry)
          command('invalidate')
          await waitFor(entry, 'Equal-workload warm render', current => (number(metrics(current).renderEvents) ?? 0) > (number(metrics(before).renderEvents) ?? 0))
          if (scene === 'ownership') {
            const previousCount = bridge.current()?.events.filter(event => event.message === 'Comparable active-scene ownership snapshot.').length ?? 0
            await action('ownership-snapshot')
            await waitFor(entry, 'Fresh actual ownership resource snapshot', current => current.events.filter(event => event.message === 'Comparable active-scene ownership snapshot.').length > previousCount)
          }
          const run = await inspect(entry)
          const sample = { cycle, runId: run.id, scene, mode: run.mode, metrics: metrics(run), ownership: scene === 'ownership' ? consumer(latestEvent(run, 'Comparable active-scene ownership snapshot.')!) : null }
          snapshots.push(sample)
          observe(entry, 'Equal-workload warmed active-scene snapshot; counts need not become zero', sample)
          await checkpoint(entry, `equal-workload cycle ${cycle}`)
          await unmount(entry)
          const after = (await windowOf(entry, `Cycle ${cycle} retirement observations`)).at(-1)!
          unexpected(entry, after)
          if (scene === 'ownership') {
            const released = findEvent(after, 'Final explicit owner released all six owned resource kinds.')
            requireObservation(entry, !!released && onceOnly(disposalRecords(consumer(released))), 'Repeated owner teardown did not observe its once-only native resource ledger.')
          }
        })
      }
      observe(entry, 'Repeated matching active-workload snapshots retained for stability review; no automatic VRAM or listener-release certification', snapshots)
    })
  }

  for (const scene of ['webgl', 'webgpu'] as const) {
    add(`${scene}-native-loss`, `${scene === 'webgl' ? 'WebGL' : 'WebGPU'}: native loss and explicit recreation`, ['gpu-14', 'gpu-17'], async entry => {
      await start(entry, scene)
      const initial = await ready(entry)
      await checkpoint(entry, 'before destructive native loss')
      const previousEvents = initial.events.length
      command('lose-context')
      const result = await waitFor(entry, 'Actual native loss or explicit unsupported observation', current => current.events.slice(previousEvents).some(event => event.message.startsWith('Native context loss unsupported:') || event.message.startsWith('Native loss command unsupported') || event.message === 'Real GPUDevice.lost settled.' || event.message === 'Canvas emitted webglcontextlost; the lab observer does not suppress the event.'))
      const loss = result.events.slice(previousEvents).find(event => event.message === 'Real GPUDevice.lost settled.' || event.message === 'Canvas emitted webglcontextlost; the lab observer does not suppress the event.')
      if (!loss) {
        entry.status = 'unobserved'
        observe(entry, 'Native loss unsupported/unobserved; no synthetic event and no successful-loss claim', result.events.slice(previousEvents))
        await unmount(entry)
      } else {
        observe(entry, 'Actual native loss event/device.lost (deliberate experiment, not spontaneous hardware failure)', loss)
        if (loss.message.startsWith('Canvas emitted')) requireObservation(entry, record(loss.detail).trustedNativeEvent === true, 'Observed context-loss event was not trusted native evidence.')
        const retired = await waitFor(entry, 'Actual retired owner and informative loss DOM fallback', current => metrics(current).ownerRetired === true && metrics(current).applicationUnmounted === true && current.state?.canvasMounted === false && typeof record(latestEvent(current, 'Inspection of the actual canvas, initialized renderer and current scene state.')?.detail).alert === 'string')
        observe(entry, 'Loss stopped dependent work, retired owner and exposed actual DOM alternative', { state: retired.state, inspection: latestEvent(retired, 'Inspection of the actual canvas, initialized renderer and current scene state.') })
        await checkpoint(entry, 'actual loss alternative after owner retirement')
        await windowOf(entry, 'Raw native loss teardown observations')
      }
      // An explicit new owner is recreation, never an assertion of automatic restoration.
      const oldRunId = result.id
      await start(entry, scene)
      const recreated = await ready(entry)
      requireObservation(entry, recreated.id !== oldRunId, 'Recreation did not create a distinct run/owner.')
      observe(entry, 'Explicit fresh-run recreation with actual selected backend; no automatic fallback/recovery claim', recreated.state)
      await checkpoint(entry, 'explicit fresh owner after loss experiment')
      await unmount(entry)
    })
  }

  add('picking-dom-equivalents', 'Selection controls: scripted selection, activation and clearing', ['gpu-09', 'gpu-17'], async entry => {
    await start(entry, 'picking')
    await ready(entry)
    observe(entry, 'Evidence boundary: same-origin button.click uses isTrusted=false; no trusted keyboard, raycast pointer, hit-coordinate or propagation claim.')
    for (const actionName of ['select-left', 'activate-selected', 'clear-selection'] as const) {
      const message = actionName === 'select-left' ? 'Stable business ID selected.' : actionName === 'activate-selected' ? 'Cube activated.' : 'Selection cleared.'
      const count = bridge.current()?.events.length ?? 0
      await action(actionName)
      const run = await waitFor(entry, `Actual DOM consumer observation: ${actionName}`, current => current.events.slice(count).some(event => event.message === message && consumer(event).input === 'keyboard-or-dom' && (actionName === 'clear-selection' || consumer(event).id === 'cube-west')))
      observe(entry, 'Actual stable-ID DOM consumer event (untrusted input)', run.events.slice(count).filter(event => event.category === 'picking'))
      await checkpoint(entry, `${actionName} DOM and canvas state`)
    }
    await unmount(entry)
    unexpected(entry, (await windowOf(entry, 'Picking post-unmount raw error observations')).at(-1)!)
  })

  report.total = report.cases.length
  publish()
  for (let index = 0; index < works.length; index += 1) {
    const entry = report.cases[index]!
    if (signal.aborted) break
    entry.status = 'running'
    report.currentLabel = entry.label
    publish()
    try {
      await works[index]!(entry)
    } catch (error) {
      entry.errors.push({ label: report.currentLabel, error: errorDetail(error) })
      if (signal.aborted) entry.status = 'cancelled'
      else { entry.status = 'issues'; entry.issues.push(error instanceof Error ? error.message : String(error)) }
    } finally {
      const active = bridge.current()
      if (!signal.aborted && active && entry.runIds.includes(active.id) && metrics(active).applicationUnmounted !== true) {
        try {
          await step(entry, 'final explicit owner retirement', async () => {
            await unmount(entry)
            await windowOf(entry, 'Finalization raw teardown observation window')
          })
        } catch (error) {
          entry.errors.push({ label: 'Final owner retirement interrupted', error: errorDetail(error) })
        }
      }
      if (signal.aborted) entry.status = 'cancelled'
      else if (entry.issues.length) entry.status = 'issues'
      else if (entry.status === 'running') entry.status = 'observed'
      const current = bridge.current()
      if (current && entry.runIds.includes(current.id)) runs.set(current.id, current)
      for (const runId of entry.runIds) {
        const run = runs.get(runId)
        if (run) entry.errors.push(...clone(run.events.filter(rawError).map(event => ({ runId, source: 'raw-frame-event', ...event }))))
      }
      if (entry.status !== 'cancelled') report.completed += 1
      publish()
    }
    if (signal.aborted) break
  }
  if (signal.aborted) {
    // No further asynchronous work after cancellation. The bridge preserves the iframe/error history.
    try { bridge.command('unmount') } catch (error) {
      const entry = report.cases.find(item => item.status === 'cancelled')
      entry?.errors.push({ label: 'Cancellation unmount request', error: errorDetail(error) })
    }
    report.status = 'cancelled'
    report.currentLabel = 'Cancelled; partial observations and errors retained'
  } else {
    report.status = 'completed'
    report.currentLabel = 'Sequence completed; evidence requires review, not hardware acceptance'
  }
  report.finishedAt = new Date().toISOString()
  return publish()
}
