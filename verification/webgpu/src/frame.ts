import { cloneVNode, createApp, getCurrentInstance, isVNode, version as vueVersion, type VNodeChild } from 'vue'
import { TresCanvas, type TresContext } from '@tresjs/core'
import WebGpuHost from './SceneHost.vue'
import WebGlHost from './recipes/webgl/SceneHost.vue'
import PickingHost from './consumers/PickingHost.vue'
import AssetHost from './consumers/AssetHost.vue'
import OwnershipHost from './consumers/OwnershipHost.vue'
import { modes, observationChannel, scenes, type Category, type Command, type FrameState, type Json, type Mode, type SceneId } from './lab-contract'

declare const __LAB_CORE_VERSION__: string
declare const __LAB_THREE_VERSION__: string

interface AdapterInfo { vendor?: string; architecture?: string; device?: string; description?: string; isFallbackAdapter?: boolean }
interface ObservedQueue { submit: (...args: unknown[]) => void }
interface ObservedDevice extends EventTarget {
  queue: ObservedQueue
  lost: Promise<{ reason: string; message: string }>
  adapterInfo?: AdapterInfo
  destroy?: () => void
}
interface ObservedAdapter {
  info?: AdapterInfo
  isFallbackAdapter?: boolean
  requestDevice: (...args: unknown[]) => Promise<ObservedDevice>
}
interface ObservedGpu { requestAdapter: (...args: unknown[]) => Promise<ObservedAdapter | null> }
interface ObservedCanvasContext { configure: (...args: unknown[]) => void }
const params = new URLSearchParams(location.search)
const requestedScene = params.get('scene') ?? 'webgpu'
const scene: SceneId = scenes.find(entry => entry.value === requestedScene)?.value ?? 'webgpu'
const requestedMode = params.get('mode') ?? 'normal'
const runId = params.get('run') ?? ''
const mode: Mode = modes.find(entry => entry.value === requestedMode && entry.scenes.includes(scene))?.value ?? 'normal'
const state: FrameState = {
  secureContext: window.isSecureContext,
  mode,
  scene,
  versions: { vue: vueVersion, core: __LAB_CORE_VERSION__, three: __LAB_THREE_VERSION__ },
  userAgent: navigator.userAgent,
  deviceCreated: false,
  backend: mode === 'normal' ? 'unknown' : 'pending',
  canvasMounted: false,
  ready: false,
  rendererFamily: 'unknown',
  unhandledCount: 0,
}
const deniedAdapter = mode === 'adapter-unavailable' || mode === 'both-unavailable'
const deniedDevice = mode === 'device-rejected' || mode === 'device-and-fallback-unavailable'
const deniedWebgl = mode === 'webgl-unavailable' || mode === 'both-unavailable' || mode === 'device-and-fallback-unavailable'
const gpuDenial = deniedAdapter || deniedDevice
let unmounted = false
let submissions = 0
let submissionsAfterUnmount = 0
let seenDeviceQueue = false
let renderEvents = 0
const seenErrors = new WeakSet<object>()
let lastRenderTime: number | null = null
let initializedContext: TresContext | undefined
let ownerRetired = false
let lossRequested: 'webgl' | 'webgpu' | null = null
const observedCanvases = new WeakSet<HTMLCanvasElement>()
const seenAdapters = new WeakSet<ObservedAdapter>()
const seenDevices = new WeakSet<ObservedDevice>()
const seenContexts = new WeakSet<object>()

function post(kind: 'event' | 'state' | 'capture', data: unknown): void {
  window.parent.postMessage({ channel: 'vue-kit-webgpu-lab', runId, kind, data }, location.origin)
}

function detailOf(value: unknown): Json {
  if (value instanceof Error || value instanceof DOMException) {
    const error: { [key: string]: Json } = { name: value.name, message: value.message }
    if (value.stack) error.stack = value.stack
    if ('code' in value && (typeof value.code === 'string' || typeof value.code === 'number')) error.code = value.code
    if ('cause' in value && value.cause !== undefined && value.cause !== value) error.cause = String(value.cause)
    return error
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (value === undefined) return 'undefined'
  try {
    return String(value)
  } catch {
    return '[unprintable thrown value]'
  }
}

function event(category: Category, message: string, detail?: Json): void {
  post('event', { time: performance.now(), category, message, ...(detail === undefined ? {} : { detail }) })
}

function sendState(): void {
  post('state', { ...state })
}

function intervention(message: string): void {
  event('capability', `Intervention: ${message}`, { injected: true, mode })
}

function componentError(cause: unknown, source: string): void {
  if (typeof cause === 'object' && cause !== null) {
    if (seenErrors.has(cause)) return
    seenErrors.add(cause)
  }
  if (state.backend === 'pending' || state.backend === 'unknown') state.backend = 'unavailable'
  event('component-error', source, detailOf(cause))
  sendState()
}

// These listeners intentionally outlive app.unmount(). Never preventDefault: native
// reporting and unhandled cleanup rejections must remain observable in this iframe.
window.addEventListener('unhandledrejection', (error: PromiseRejectionEvent) => {
  state.unhandledCount += 1
  event('unhandled-rejection', unmounted ? 'Unhandled promise rejection after application unmount.' : 'Unhandled promise rejection.', detailOf(error.reason))
  sendState()
})
window.addEventListener('error', (error: ErrorEvent) => {
  event('window-error', error.message || 'Window error event.', {
    error: detailOf(error.error), filename: error.filename, line: error.lineno, column: error.colno,
  })
})

// This bridge also outlives Vue teardown: a real loader may resolve and retire
// its owned result after the source-derived host has already unmounted.
window.addEventListener(observationChannel, (observation: Event) => {
  const payload = (observation as CustomEvent<{ category: Category; message: string; detail?: Json }>).detail
  if (!payload || typeof payload.message !== 'string') return
  event(payload.category, payload.message, {
    afterUnmount: unmounted,
    consumerObservation: payload.detail ?? null,
  })
})

function adapterInfo(info: AdapterInfo | undefined, fallback?: boolean): Json {
  return {
    vendor: info?.vendor ?? null, architecture: info?.architecture ?? null,
    device: info?.device ?? null, description: info?.description ?? null,
    isFallbackAdapter: info?.isFallbackAdapter ?? fallback ?? null,
    limit: 'Unavailable fields are unknown. Adapter metadata alone does not certify native hardware or visible output.',
  }
}

function observeDevice(device: ObservedDevice, observeQueue: boolean, source: string): void {
  state.deviceCreated = true
  if (device.adapterInfo) {
    state.adapter = adapterInfo(device.adapterInfo)
    event('capability', 'Read GPUDevice.adapterInfo from the actual renderer-owned device; no additional adapter/device request was made.', state.adapter)
  }
  if (seenDevices.has(device)) return
  seenDevices.add(device)
  event('capability', source)
  device.addEventListener('uncapturederror', (error: Event) => {
    const gpuError = (error as Event & { error?: { message?: string; constructor?: { name?: string } } }).error
    event('gpu-validation', 'GPUDevice uncapturederror (not suppressed).', {
      name: gpuError?.constructor?.name ?? 'GPUError', message: gpuError?.message ?? 'No GPU error message provided.',
    })
  })
  void device.lost.then(info => {
    event('capability', 'Real GPUDevice.lost settled.', {
      reason: info.reason, message: info.message, afterUnmount: unmounted,
      requestedByLab: lossRequested === 'webgpu',
      limit: 'A lab-requested device.destroy() is deliberate native device retirement, not an observed hardware failure.',
    })
    if (backendOf(initializedContext)?.device === device && !unmounted) {
      retireOwner('WebGPU device', { reason: info.reason, message: info.message })
    }
    sendState()
  }, cause => {
    event('capability', 'GPUDevice.lost observation rejected.', detailOf(cause))
  })
  if (!observeQueue) {
    sendState()
    return
  }
  const submit = device.queue.submit
  device.queue.submit = function (this: ObservedQueue, ...args: unknown[]): void {
    const result = Reflect.apply(submit, this, args) as void
    submissions += 1
    if (unmounted) submissionsAfterUnmount += 1
    if (submissions === 1 || (unmounted && submissionsAfterUnmount === 1)) {
      event('lifecycle', unmounted ? 'A real GPU queue submission occurred after application unmount.' : 'First native GPUQueue.submit returned without a synchronous exception.', {
        submissions, afterUnmount: unmounted,
        limit: 'Submission acceptance is not proof of GPU completion or visible pixels. Inspect the canvas capture separately.',
      })
      sendState()
    }
    return result
  }
  seenDeviceQueue = true
  sendState()
}

function observeAdapter(adapter: ObservedAdapter): void {
  state.adapter = adapterInfo(adapter.info, adapter.isFallbackAdapter)
  if (seenAdapters.has(adapter)) return
  seenAdapters.add(adapter)
  event('capability', 'Native GPU.requestAdapter resolved with a real adapter.', state.adapter)
  const requestDevice = adapter.requestDevice
  adapter.requestDevice = function (this: ObservedAdapter, ...args: unknown[]): Promise<ObservedDevice> {
    if (deniedDevice) {
      intervention('GPUAdapter.requestDevice returns a rejected NotAllowedError promise instead of calling the native method. This is an injected denial, not evidence of hardware failure.')
      return Promise.reject(new DOMException('Diagnostic intervention: GPUAdapter.requestDevice deliberately denied.', 'NotAllowedError'))
    }
    const promise = Reflect.apply(requestDevice, this, args) as Promise<ObservedDevice>
    // Return the original promise, preserving the renderer's own error path.
    void promise.then(device => observeDevice(device, true, 'Native GPUAdapter.requestDevice resolved with a real GPUDevice.'), cause => event('capability', 'Native GPUAdapter.requestDevice rejected.', detailOf(cause)))
    return promise
  }
  sendState()
}

function instrumentGpu(): void {
  const gpu = (navigator as Navigator & { gpu?: ObservedGpu }).gpu
  if (!gpu) {
    event('capability', 'navigator.gpu is absent in this browser/context. No adapter or device result can be inferred.', { secureContext: state.secureContext })
    if (deniedAdapter || deniedDevice) {
      event('capability', 'The requested WebGPU denial cannot intercept a missing API; no synthetic GPU or adapter is created.')
    }
    return
  }
  const requestAdapter = gpu.requestAdapter
  gpu.requestAdapter = function (this: ObservedGpu, ...args: unknown[]): Promise<ObservedAdapter | null> {
    if (deniedAdapter) {
      intervention('GPU.requestAdapter resolves null instead of calling the native method. This is an injected adapter denial, not a measurement of the real adapter.')
      state.adapter = null
      sendState()
      return Promise.resolve(null)
    }
    const promise = Reflect.apply(requestAdapter, this, args) as Promise<ObservedAdapter | null>
    void promise.then(adapter => {
      if (adapter) observeAdapter(adapter)
      else {
        state.adapter = null
        event('capability', 'Native GPU.requestAdapter resolved null in this browser/context.')
        sendState()
      }
    }, cause => event('capability', 'Native GPU.requestAdapter rejected.', detailOf(cause)))
    return promise
  }
  event('capability', 'navigator.gpu is present; native adapter, device and queue calls are observed when the recipe makes them. Presence alone does not prove rendering support.')
}

function instrumentCanvas(): void {
  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]): RenderingContext | null {
    if (contextId === 'webgl2' && deniedWebgl) {
      intervention("HTMLCanvasElement.getContext('webgl2') returns null instead of calling the native method. Other context types are unchanged; this is an injected fallback denial.")
      state.backend = 'unavailable'
      sendState()
      return null
    }
    const context = Reflect.apply(getContext, this, [contextId, ...args]) as RenderingContext | null
    if (contextId === 'webgl2') {
      event('capability', context ? 'Native canvas WebGL2 context acquisition succeeded.' : 'Native canvas WebGL2 context acquisition returned null.')
      if (context) state.backend = 'webgl2'
      sendState()
    }
    if (gpuDenial && contextId === 'webgpu' && context && !seenContexts.has(context)) {
      seenContexts.add(context)
      event('capability', 'Native canvas WebGPU context acquisition succeeded; configuration and rendering are separate observations.')
      const gpuContext = context as unknown as ObservedCanvasContext
      const configure = gpuContext.configure
      gpuContext.configure = function (this: ObservedCanvasContext, ...configuration: unknown[]): void {
        const result = Reflect.apply(configure, this, configuration) as void
        state.backend = 'webgpu'
        event('capability', 'Native GPUCanvasContext.configure returned without a synchronous exception. This identifies the selected canvas backend, not a completed frame.')
        sendState()
        return result
      }
    } else if (contextId === 'webgpu' && !context) {
      event('capability', 'Native canvas WebGPU context acquisition returned null.')
    }
    return context
  } as typeof getContext
}
// Diagnostic-only access to the initialized r186 backend. These internals are
// version-pinned, not a portable Three API. See WebGPUBackend.js:92,115,296 and
// WebGLBackend.js:59; renderer-family flags do not identify the active backend.
interface DiagnosticBackend {
  isWebGPUBackend?: boolean
  isWebGLBackend?: boolean
  device?: ObservedDevice
}

function backendOf(context: TresContext | undefined): DiagnosticBackend | undefined {
  const renderer = context?.renderer.instance
  return renderer && 'backend' in renderer ? renderer.backend as DiagnosticBackend : undefined
}

function existingGl(context: TresContext | undefined): WebGL2RenderingContext | undefined {
  if (!context) return
  const renderer = context.renderer.instance
  const ordinary = 'isWebGLRenderer' in renderer && renderer.isWebGLRenderer === true
  if (!ordinary && backendOf(context)?.isWebGLBackend !== true) return
  // Both renderer families expose getContext(); this returns the already-owned
  // context. It never acquires another canvas context or requests a GPU adapter.
  const nativeContext: unknown = renderer.getContext()
  if (typeof WebGL2RenderingContext !== 'undefined' && nativeContext instanceof WebGL2RenderingContext) return nativeContext
}

function retireOwner(api: string, detail: Json): void {
  if (unmounted || ownerRetired) return
  ownerRetired = true
  state.ready = false
  initializedContext?.renderer.loop.stop()
  const alternative = document.createElement('p')
  alternative.setAttribute('role', 'alert')
  alternative.dataset.labLoss = 'true'
  alternative.textContent = `${api} was lost. Choose Run check to create a new scene.`
  mount?.insertAdjacentElement('beforebegin', alternative)
  event('lifecycle', 'Actual native loss retired the lab-owned renderer; dependent Tres rendering was stopped.', {
    api, rendererFamily: state.rendererFamily, backend: state.backend, detail,
    policy: state.rendererFamily === 'webgl'
      ? 'Although ordinary Three WebGLRenderer has native restoration handlers, this lab deliberately retires the owner. Start a fresh iframe run to recreate it; WebGL loss does not switch to WebGPU.'
      : 'Retire this WebGPURenderer owner, including its WebGL2 fallback. A fresh iframe run creates a new renderer and lets its real initialization choose a backend. No automatic device recovery is promised.',
  })
  sendState()
  unmountApplication('Actual native loss: retiring the scene, renderer, controls and component-owned work.')
}

function observeCanvas(canvas: HTMLCanvasElement): void {
  if (observedCanvases.has(canvas)) return
  observedCanvases.add(canvas)
  canvas.addEventListener('webglcontextlost', (nativeEvent: Event) => {
    const contextEvent = nativeEvent as WebGLContextEvent
    event('capability', 'Canvas emitted webglcontextlost; the lab observer does not suppress the event.', {
      statusMessage: contextEvent.statusMessage ?? null, trustedNativeEvent: nativeEvent.isTrusted,
      requestedByLab: lossRequested === 'webgl', afterUnmount: unmounted,
      limit: 'An explicitly requested WEBGL_lose_context operation is not a spontaneous hardware failure.',
    })
    if (nativeEvent.isTrusted) retireOwner('WebGL2 context', { statusMessage: contextEvent.statusMessage ?? null })
  })
  canvas.addEventListener('webglcontextrestored', (nativeEvent: Event) => {
    event('capability', 'Canvas emitted webglcontextrestored. A native restoration notification is not proof of a recovered rendered scene.', {
      trustedNativeEvent: nativeEvent.isTrusted, ownerRetired, afterUnmount: unmounted,
      policy: 'This run remains retired; use a fresh iframe run for an explicit new owner.',
    })
  })
  canvas.addEventListener('webglcontextcreationerror', (nativeEvent: Event) => {
    event('capability', 'Canvas emitted its real webglcontextcreationerror.', {
      statusMessage: (nativeEvent as WebGLContextEvent).statusMessage ?? null, afterUnmount: unmounted,
    })
  })
}

function rendererReady(context: TresContext): void {
  initializedContext = context
  const renderer = context.renderer.instance
  const flags = renderer as unknown as { isWebGLRenderer?: boolean; isWebGPURenderer?: boolean }
  const backend = backendOf(context)
  state.rendererFamily = flags.isWebGLRenderer === true ? 'webgl' : flags.isWebGPURenderer === true ? 'webgpu' : 'unknown'
  if (backend?.isWebGPUBackend === true) state.backend = 'webgpu'
  else if (existingGl(context)) state.backend = 'webgl2'
  else state.backend = 'unknown'
  state.ready = !unmounted && !ownerRetired
  observeCanvas(renderer.domElement)
  if (ownerRetired) context.renderer.loop.stop()
  event('lifecycle', 'TresCanvas emitted its actual ready event.', {
    rendererFamily: state.rendererFamily, backend: state.backend, afterUnmount: unmounted,
    backendFlags: backend ? { isWebGPUBackend: backend.isWebGPUBackend ?? null, isWebGLBackend: backend.isWebGLBackend ?? null } : null,
    limit: 'Ready reports renderer initialization, not GPU completion or pixel correctness. Ordinary WebGL2 is identified from its existing initialized context; WebGPURenderer family is distinct from its active backend.',
  })
  if (backend?.device) {
    observeDevice(backend.device, gpuDenial, 'A real GPUDevice was exposed by the initialized renderer backend.')
  } else {
    event('capability', 'Ready context did not expose a GPUDevice. No additional adapter/device probe is made; deviceCreated=false means no device was observed.')
  }
  inspect()
}

function rendererRendered(): void {
  renderEvents += 1
  lastRenderTime = performance.now()
  if (renderEvents === 1) {
    event('lifecycle', 'TresCanvas emitted its actual render event.', {
      limit: 'This is the component render notification, not proof of GPU work completion or correct pixels. Inspect the real canvas capture.',
    })
    inspect()
  }
}


// cloneVNode merges the observer after existing onError listeners, retaining
// Vue's normal listener-array ordering, arguments and exception handling. No source
// template, listener, renderer factory, or component error boundary is replaced.
function observeVNodes(child: VNodeChild): void {
  if (Array.isArray(child)) {
    child.forEach(observeVNodes)
    return
  }
  if (!isVNode(child)) return
  if (child.props?.onError) {
    child.props = cloneVNode(child, {
      onError: (cause: unknown) => componentError(cause, 'Component emitted error; existing vnode listener was preserved.'),
    }).props
  }
  if (child.type === TresCanvas) {
    child.props = cloneVNode(child, { onReady: rendererReady, onRender: rendererRendered }).props
  }
  // Retain each vnode's identity: compiler block dynamicChildren refer to these
  // same nodes. Only the new vnode's listener props are merged, never its children.
  if (Array.isArray(child.children)) child.children.forEach(observeVNodes)
}

type ObservedRender = (this: unknown, ...args: unknown[]) => VNodeChild
const hosts = { webgpu: WebGpuHost, webgl: WebGlHost, picking: PickingHost, asset: AssetHost, ownership: OwnershipHost } as const
const app = createApp(hosts[scene])
app.mixin({
  created() {
    // Vue exposes the current internal instance, but render is intentionally not
    // public API. Keep this one diagnostic-only internal boundary narrowly typed.
    const instance = getCurrentInstance() as unknown as { render: ObservedRender | null } | null
    if (!instance?.render) return
    const render = instance.render
    instance.render = function (this: unknown, ...args: unknown[]): VNodeChild {
      const result = Reflect.apply(render, this, args) as VNodeChild
      observeVNodes(result)
      return result
    }
  },
  errorCaptured(cause, _instance, info) {
    componentError(cause, `Vue errorCaptured observer: ${info}`)
    // Do not return false. The extracted host retains its original boundary.
  },
})

const mount = document.querySelector<HTMLElement>('#app')
if (!mount) throw new Error('The diagnostic case page requires an #app mount container.')
const observer = new MutationObserver(() => {
  const mounted = Boolean(mount.querySelector('canvas'))
  const canvas = mount.querySelector('canvas')
  if (canvas) observeCanvas(canvas)
  if (mounted === state.canvasMounted) return
  state.canvasMounted = mounted
  event('lifecycle', mounted ? 'A real canvas element entered the recipe DOM. Canvas presence alone does not prove a rendered frame.' : 'The recipe canvas left the DOM.')
  sendState()
})
observer.observe(mount, { childList: true, subtree: true })

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function numericFields(value: unknown, keys: readonly string[]): Record<string, number | null> {
  // Renderer info is an in-process, pinned SDK object; validate each scalar
  // rather than serializing its live objects or treating missing fields as zero.
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : undefined
  return Object.fromEntries(keys.map(key => [key, finiteNumber(source?.[key])]))
}

function rectangle(element: Element | null | undefined): Json {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

interface DiagnosticInfo {
  memory?: unknown
  render?: unknown
  programs?: unknown
  frame?: unknown
  calls?: unknown
  autoReset?: boolean
}
let previousResources: { renderer: TresContext['renderer']['instance']; signature: string; time: number; counters: Record<string, number | null> } | undefined

function inspect(): void {
  const canvas = mount?.querySelector('canvas')
  state.canvasMounted = Boolean(canvas)
  const context = initializedContext
  const renderer = context?.renderer.instance
  // The public renderer.info schemas differ between the two pinned families.
  const info = renderer?.info as DiagnosticInfo | undefined
  const counters = numericFields(info?.memory, ['geometries', 'textures', 'programs', 'attributes', 'renderTargets', 'total', 'texturesSize', 'attributesSize'])
  const meshSamples: Json[] = []
  const objectIdentities: string[] = []
  let meshCount: number | null = context ? 0 : null
  context?.scene.value.traverse(object => {
    objectIdentities.push(object.uuid)
    if (!('isMesh' in object) || object.isMesh !== true) return
    meshCount = (meshCount ?? 0) + 1
    if (meshSamples.length >= 16) return
    meshSamples.push({
      uuid: object.uuid, name: object.name, type: object.type,
      rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z, order: object.rotation.order },
      position: { x: object.position.x, y: object.position.y, z: object.position.z },
    })
  })
  const camera = context?.camera.activeCamera.value
  const active = Boolean(context && state.ready && canvas?.isConnected && !unmounted && !ownerRetired)
  const signature = JSON.stringify({ scene, mode, backend: state.backend, family: state.rendererFamily, width: canvas?.width, height: canvas?.height, objectIdentities })
  const comparable = Boolean(active && previousResources && previousResources.renderer === renderer && previousResources.signature === signature)
  const now = performance.now()
  const deltas = Object.fromEntries(Object.entries(counters).map(([key, value]) => {
    const previous = previousResources?.counters[key]
    return [key, comparable && value !== null && previous !== null && previous !== undefined ? value - previous : null]
  }))
  const gl = existingGl(context)
  // Read only the standard identity strings on the renderer's existing context.
  // Do not request WEBGL_debug_renderer_info or infer unmasked GPU/hardware type.
  const glVendor: unknown = gl?.getParameter(gl.VENDOR)
  const glRenderer: unknown = gl?.getParameter(gl.RENDERER)
  const glVersion: unknown = gl?.getParameter(gl.VERSION)
  state.metrics = {
    observedAt: now, applicationUnmounted: unmounted, ownerRetired,
    canvas: canvas ? {
      width: canvas.width, height: canvas.height, connected: canvas.isConnected,
      css: rectangle(canvas), parentCss: rectangle(canvas.parentElement),
    } : null,
    mountCss: rectangle(mount),
    windowDpr: finiteNumber(window.devicePixelRatio),
    rendererDpr: renderer ? finiteNumber(renderer.getPixelRatio()) : null,
    rendererInitialized: context?.renderer.isInitialized.value ?? null,
    renderMode: context?.renderer.mode ?? null,
    loopActive: context?.renderer.loop.isActive.value ?? null,
    canBeInvalidated: context?.renderer.canBeInvalidated.value ?? null,
    renderEvents, lastRenderNotificationAt: lastRenderTime,
    submissions: gpuDenial && seenDeviceQueue ? submissions : null,
    submissionsAfterUnmount: gpuDenial && seenDeviceQueue ? submissionsAfterUnmount : null,
    contextLost: gl ? gl.isContextLost() : null,
    preserveDrawingBuffer: gl?.getContextAttributes()?.preserveDrawingBuffer ?? null,
    webglIdentity: gl ? {
      vendor: typeof glVendor === 'string' ? glVendor : null,
      renderer: typeof glRenderer === 'string' ? glRenderer : null,
      version: typeof glVersion === 'string' ? glVersion : null,
      limit: 'Actual standard WebGL identity strings may be masked/generic. No debug extension, extra context or adapter probe is requested, and no hardware/software classification is inferred.',
    } : null,
    camera: camera ? {
      uuid: camera.uuid, type: camera.type,
      ...numericFields(camera, ['aspect', 'fov', 'zoom', 'near', 'far']),
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    } : null,
    scene: { meshCount, meshSamples, samplesTruncated: meshCount === null ? null : meshCount > meshSamples.length },
    rendererInfo: info ? {
      memory: counters,
      render: numericFields(info.render, ['frame', 'calls', 'frameCalls', 'drawCalls', 'triangles', 'lines', 'points']),
      frame: finiteNumber(info.frame), calls: finiteNumber(info.calls),
      programCount: Array.isArray(info.programs) ? info.programs.length : counters.programs ?? null,
      autoReset: info.autoReset ?? null,
    } : null,
    resourceComparison: {
      activeSnapshot: active, comparableToPrevious: comparable,
      previousObservedAt: previousResources?.time ?? null, counterDeltas: deltas,
      basis: 'Same live renderer owner, scene object identities, backend, mode and drawing-buffer dimensions. Compare equivalent warmed active-scene snapshots across runs manually; changed lifetimes/contents are not directly comparable.',
      limit: 'Renderer counters are partial implementation statistics, not a zero-counter cleanup criterion, automatic stability verdict or VRAM certificate. Missing counters and unobserved queue activity are null, not zero.',
    },
  }
  if (active && renderer) previousResources = { renderer, signature, time: now, counters }
  event('lifecycle', 'Inspection of the actual canvas, initialized renderer and current scene state.', {
    metrics: state.metrics,
    alert: document.querySelector('[data-lab-loss]')?.textContent ?? mount?.querySelector('[role="alert"]')?.textContent ?? null,
    limit: 'Normal native API identities remain untouched. Introspection does not request another adapter/device or canvas context; dimensions, rotations and renderer counters cannot establish visible correctness or GPU completion.',
  })
  sendState()
}

function capture(): void {
  const startedAt = performance.now()
  const canvas = mount?.querySelector('canvas')
  const gl = canvas ? existingGl(initializedContext) : null
  const provenance: Json = {
    startedAt, lastRenderNotificationAt: lastRenderTime,
    elapsedSinceRenderNotification: lastRenderTime === null ? null : startedAt - lastRenderTime,
    renderEvents, rendererFamily: state.rendererFamily, backend: state.backend,
    width: canvas?.width ?? null, height: canvas?.height ?? null,
    preserveDrawingBuffer: gl?.getContextAttributes()?.preserveDrawingBuffer ?? null,
    applicationUnmounted: unmounted, ownerRetired,
  }
  if (!canvas) {
    const finishedAt = performance.now()
    post('capture', {
      error: 'No recipe canvas is currently mounted.',
      provenance: { ...provenance, finishedAt, elapsedMs: finishedAt - startedAt },
    })
    return
  }
  try {
    const dataUrl = canvas.toDataURL('image/png')
    const finishedAt = performance.now()
    const completedProvenance = { ...provenance, finishedAt, elapsedMs: finishedAt - startedAt }
    post('capture', { dataUrl, provenance: completedProvenance })
    event('lifecycle', 'Captured the real canvas with HTMLCanvasElement.toDataURL.', {
      provenance: completedProvenance, finishedAt, returnedEmptyDataUrl: dataUrl === 'data:,',
      limit: 'Compare live output, timely canvas pixels and a page screenshot separately. WebGL drawing-buffer persistence may be false; WebGPU presentation has different readback timing. Blank/different channels or successful encoding alone do not establish a render failure or pass.',
    })
  } catch (cause) {
    const finishedAt = performance.now()
    const completedProvenance = { ...provenance, finishedAt, elapsedMs: finishedAt - startedAt }
    post('capture', { error: cause instanceof Error ? cause.message : String(cause), provenance: completedProvenance })
    event('lifecycle', 'Real canvas readback failed.', { provenance: completedProvenance, error: detailOf(cause) })
  }
}

function unmountApplication(reason: string): void {
  if (unmounted) {
    event('lifecycle', 'Application is already unmounted; persistent error and consumer observers remain active.')
    return
  }
  event('lifecycle', `${reason} Calling the real Vue app.unmount(); all raw error and consumer observers remain installed.`)
  unmounted = true
  state.ready = false
  try {
    app.unmount()
    event('lifecycle', 'Vue app.unmount() returned; this does not guarantee that asynchronous cleanup or pending loader work has completed.')
  } catch (cause) {
    event('lifecycle', 'Vue app.unmount() threw; the original exception is rethrown for native reporting.', detailOf(cause))
    throw cause
  } finally {
    state.canvasMounted = Boolean(mount?.querySelector('canvas'))
    sendState()
  }
}

function invalidate(): void {
  const context = initializedContext
  if (!context || !state.ready || unmounted || ownerRetired) {
    event('lifecycle', 'Imperative nudge/invalidate unsupported in this state: no live initialized lab-owned renderer.', {
      ready: state.ready, applicationUnmounted: unmounted, ownerRetired,
    })
    return
  }
  const target = context.scene.value.getObjectByProperty('isMesh', true)
  if (!target) {
    event('lifecycle', 'Imperative mesh nudge unsupported: the actual initialized scene currently contains no mesh. No object was fabricated.')
    return
  }
  const before = { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }
  const renderEventsBefore = renderEvents
  target.rotation.y += Math.PI / 12
  context.renderer.invalidate()
  event('lifecycle', 'Mutated the first actual scene mesh rotation and called its owner Tres renderer.invalidate().', {
    object: { uuid: target.uuid, name: target.name },
    before, after: { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z },
    renderMode: context.renderer.mode ?? null, renderEventsBefore,
    limit: 'This is an imperative object mutation and real invalidation request, not proof of a new visible frame. Compare later render notifications, rotation inspection and live output; no extra RAF or renderer is created.',
  })
  inspect()
}

function loseContext(): void {
  const context = initializedContext
  if (!context || !state.ready || unmounted || ownerRetired) {
    event('capability', 'Native loss command unsupported in this state: no live initialized lab-owned renderer/device.', {
      ready: state.ready, applicationUnmounted: unmounted, ownerRetired,
    })
    return
  }
  const gl = existingGl(context)
  if (gl) {
    // This optional native capability is requested only by the explicit loss
    // command, never as a normal-startup probe and never on a scratch context.
    const extension = gl.getExtension('WEBGL_lose_context')
    if (!extension || typeof extension.loseContext !== 'function') {
      event('capability', 'Native context loss unsupported: WEBGL_lose_context is unavailable on the initialized renderer-owned WebGL2 context. No synthetic event or loss was created.')
      return
    }
    lossRequested = 'webgl'
    event('capability', 'Calling WEBGL_lose_context.loseContext() on the actual initialized renderer-owned WebGL2 context; awaiting its real native loss event.', {
      rendererFamily: state.rendererFamily, backend: state.backend,
      limit: 'Explicitly induced native context loss is not a spontaneous hardware/driver failure. The command returning is not the loss observation.',
    })
    extension.loseContext()
    return
  }
  const device = backendOf(context)?.device
  if (state.backend === 'webgpu' && device && typeof device.destroy === 'function') {
    lossRequested = 'webgpu'
    event('capability', 'Calling GPUDevice.destroy() on the actual initialized renderer-owned device; awaiting its real device.lost settlement.', {
      limit: 'Explicit device retirement is not a spontaneous hardware failure. This lab handles the real destroyed reason; r186 itself deliberately ignores that reason in its onDeviceLost path.',
    })
    device.destroy()
    return
  }
  event('capability', 'Native loss command unsupported: no initialized WebGL2 context with the required extension or directly exposed destroyable WebGPU device was available. No loss, device or fallback was simulated.')
}

const commandHandlers: Record<Command, () => void> = {
  inspect, capture, invalidate, 'lose-context': loseContext,
  unmount: () => unmountApplication('Unmount command received.'),
}
window.addEventListener('message', (message: MessageEvent<unknown>) => {
  if (message.origin !== location.origin || message.source !== window.parent) return
  const data = message.data
  if (typeof data !== 'object' || data === null) return
  if (!('channel' in data) || data.channel !== 'vue-kit-webgpu-lab-command' || !('runId' in data) || data.runId !== runId) return
  if (!('command' in data) || typeof data.command !== 'string' || !Object.hasOwn(commandHandlers, data.command)) return
  const handler: unknown = Reflect.get(commandHandlers, data.command)
  if (typeof handler === 'function') handler()
})

sendState()
if (requestedScene !== scene) event('capability', `Unknown scene ${JSON.stringify(requestedScene)}; using the actual ${scene} host.`)
if (requestedMode !== mode) event('capability', `Mode ${JSON.stringify(requestedMode)} is unknown or inapplicable to ${scene}; using normal with no capability denial.`)
if (gpuDenial) {
  intervention(`Selected ${mode}. ${deniedAdapter ? 'Adapter requests will resolve null.' : 'Device requests on a real adapter will reject.'} ${deniedWebgl ? 'WebGL2 context requests will also return null.' : 'WebGL2 fallback is not denied.'} A fresh iframe resets all overrides.`)
  intervention('Only this explicit GPU-denial run wraps GPU.requestAdapter, real-adapter requestDevice, real-device queue.submit, canvas.getContext and acquired WebGPU-context configure methods when available. Non-denied calls retain native receiver, arguments and result; request promises retain identity. No synthetic adapter or device is created.')
  instrumentGpu()
  instrumentCanvas()
} else if (mode === 'webgl-unavailable') {
  intervention("Only canvas.getContext is intercepted to return null for WebGL2. The ordinary retained host's own real preflight will see this denial; navigator.gpu, adapters, devices and all other context types are unchanged.")
  instrumentCanvas()
} else {
  event('capability', `${mode === 'normal' ? 'Normal mode' : 'Controlled asset-path mode'}: native GPU and canvas APIs are not replaced, wrapped, or separately capability-probed. Existing renderer state, native loss/error events and requested readback/commands are observed; unobserved activity remains unknown.`)
  if (mode === 'asset-unavailable' || mode === 'asset-delayed') {
    event('asset', 'The source-derived loader consumer uses the actual selected server route; no GPU capability or loader result is overridden.', {
      path: mode === 'asset-unavailable' ? '/fixtures/missing.glb' : '/fixtures/Box-delayed.glb',
      limit: 'An actual missing response or delayed real asset is not an asserted CORS/offline/abort result.',
    })
  }
  event('capability', 'navigator.gpu presence check only (no capability request made).', {
    present: 'gpu' in navigator, secureContext: state.secureContext,
  })
}
event('lifecycle', 'Mounting the selected real scene host.', {
  scene, mode, provenance: scenes.find(entry => entry.value === scene)?.description ?? null,
  limit: 'Generated recipe SFCs preserve their retained source; bounded verification consumers explicitly report their real derived behavior. Human GPU acceptance remains pending.',
})
app.mount(mount)
event('lifecycle', 'Vue app.mount() returned; asynchronous renderer initialization may still be pending.')
inspect()
