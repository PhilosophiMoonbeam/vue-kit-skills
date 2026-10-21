import { cloneVNode, createApp, getCurrentInstance, isVNode, version as vueVersion, type VNodeChild } from 'vue'
import { TresCanvas, type TresContext } from '@tresjs/core'
import SceneHost from './SceneHost.vue'

declare const __LAB_CORE_VERSION__: string
declare const __LAB_THREE_VERSION__: string

type Mode = 'normal' | 'adapter-unavailable' | 'device-rejected' | 'both-unavailable' | 'device-and-fallback-unavailable'
type Category = 'capability' | 'component-error' | 'unhandled-rejection' | 'window-error' | 'gpu-validation' | 'lifecycle'
type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
interface AdapterInfo { vendor?: string; architecture?: string; device?: string; description?: string; isFallbackAdapter?: boolean }
interface ObservedQueue { submit: (...args: unknown[]) => void }
interface ObservedDevice extends EventTarget {
  queue: ObservedQueue
  lost: Promise<{ reason: string; message: string }>
}
interface ObservedAdapter {
  info?: AdapterInfo
  isFallbackAdapter?: boolean
  requestDevice: (...args: unknown[]) => Promise<ObservedDevice>
}
interface ObservedGpu { requestAdapter: (...args: unknown[]) => Promise<ObservedAdapter | null> }
interface ObservedCanvasContext { configure: (...args: unknown[]) => void }
interface State {
  secureContext: boolean
  mode: Mode
  versions: { vue: string; core: string; three: string }
  userAgent: string
  adapter?: Json
  deviceCreated: boolean
  backend: 'webgpu' | 'webgl2' | 'pending' | 'unknown' | 'unavailable'
  canvasMounted: boolean
  unhandledCount: number
}

const modes: readonly string[] = ['normal', 'adapter-unavailable', 'device-rejected', 'both-unavailable', 'device-and-fallback-unavailable']
const params = new URLSearchParams(location.search)
const requestedMode = params.get('mode') ?? 'normal'
const runId = params.get('run') ?? ''
const mode: Mode = modes.includes(requestedMode) ? requestedMode as Mode : 'normal'
const state: State = {
  secureContext: window.isSecureContext,
  mode,
  versions: { vue: vueVersion, core: __LAB_CORE_VERSION__, three: __LAB_THREE_VERSION__ },
  userAgent: navigator.userAgent,
  deviceCreated: false,
  backend: mode === 'normal' ? 'unknown' : 'pending',
  canvasMounted: false,
  unhandledCount: 0,
}
const deniedAdapter = mode === 'adapter-unavailable' || mode === 'both-unavailable'
const deniedDevice = mode === 'device-rejected' || mode === 'device-and-fallback-unavailable'
const deniedWebgl = mode === 'both-unavailable' || mode === 'device-and-fallback-unavailable'
let unmounted = false
let submissions = 0
let submissionsAfterUnmount = 0
let renderEvents = 0
const seenErrors = new WeakSet<object>()
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

function adapterInfo(adapter: ObservedAdapter): Json {
  const info = adapter.info
  return {
    vendor: info?.vendor ?? '', architecture: info?.architecture ?? '',
    device: info?.device ?? '', description: info?.description ?? '',
    ...(typeof (info?.isFallbackAdapter ?? adapter.isFallbackAdapter) === 'boolean'
      ? { isFallbackAdapter: (info?.isFallbackAdapter ?? adapter.isFallbackAdapter) as boolean } : {}),
  }
}

function observeDevice(device: ObservedDevice, observeQueue: boolean, source: string): void {
  state.deviceCreated = true
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
    event('capability', 'Real GPUDevice.lost settled.', { reason: info.reason, message: info.message, afterUnmount: unmounted })
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
  sendState()
}

function observeAdapter(adapter: ObservedAdapter): void {
  state.adapter = adapterInfo(adapter)
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
      return null
    }
    const context = Reflect.apply(getContext, this, [contextId, ...args]) as RenderingContext | null
    if (contextId === 'webgl2') {
      event('capability', context ? 'Native canvas WebGL2 context acquisition succeeded.' : 'Native canvas WebGL2 context acquisition returned null.')
      if (context) state.backend = 'webgl2'
      sendState()
    }
    if (contextId === 'webgpu' && context && !seenContexts.has(context)) {
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
interface DiagnosticBackend {
  isWebGPUBackend?: boolean
  isWebGLBackend?: boolean
  device?: ObservedDevice
}

function rendererReady(context: TresContext): void {
  const renderer = context.renderer.instance
  const backend = 'backend' in renderer ? renderer.backend as DiagnosticBackend : undefined
  if (backend?.isWebGPUBackend === true) state.backend = 'webgpu'
  else if (backend?.isWebGLBackend === true) state.backend = 'webgl2'
  else state.backend = 'unknown'
  event('lifecycle', 'TresCanvas emitted its actual ready event.', {
    backend: state.backend,
    limit: 'Ready reports renderer initialization, not GPU completion or pixel correctness. Backend is read from the real renderer backend flags, not the WebGPURenderer family flag.',
  })
  if (backend?.device) {
    observeDevice(backend.device, mode !== 'normal', 'A real GPUDevice was exposed by the initialized renderer backend.')
  } else if (mode === 'normal') {
    event('capability', 'Ready context did not expose a GPUDevice. No native API is wrapped or separately probed; deviceCreated=false means no device was observed.')
  }
  sendState()
}

function rendererRendered(): void {
  renderEvents += 1
  if (renderEvents === 1) {
    event('lifecycle', 'TresCanvas emitted its actual render event.', {
      limit: 'This is the component render notification, not proof of GPU work completion or correct pixels. Inspect the real canvas capture.',
    })
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
const app = createApp(SceneHost)
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
  if (mounted === state.canvasMounted) return
  state.canvasMounted = mounted
  event('lifecycle', mounted ? 'A real canvas element entered the recipe DOM. Canvas presence alone does not prove a rendered frame.' : 'The recipe canvas left the DOM.')
  sendState()
})
observer.observe(mount, { childList: true, subtree: true })

function inspect(): void {
  state.canvasMounted = Boolean(mount?.querySelector('canvas'))
  const canvas = mount?.querySelector('canvas')
  event('lifecycle', 'Inspection of current DOM and actual component notifications.', {
    applicationUnmounted: unmounted,
    canvas: canvas ? { width: canvas.width, height: canvas.height, connected: canvas.isConnected } : null,
    alert: mount?.querySelector('[role="alert"]')?.textContent ?? null,
    submissions: mode === 'normal' ? null : submissions,
    submissionsAfterUnmount: mode === 'normal' ? null : submissionsAfterUnmount,
    renderEvents,
    limit: 'Normal mode leaves native API identities untouched; queue submission counts are unknown, not zero. Only actual ready/render notifications are recorded. Canvas dimensions cannot establish pixel correctness or GPU completion.',
  })
  sendState()
}

function capture(): void {
  const canvas = mount?.querySelector('canvas')
  if (!canvas) {
    post('capture', { error: 'No recipe canvas is currently mounted.' })
    return
  }
  try {
    const dataUrl = canvas.toDataURL('image/png')
    post('capture', { dataUrl })
    event('lifecycle', 'Captured the real canvas with HTMLCanvasElement.toDataURL.', {
      width: canvas.width, height: canvas.height,
      limit: 'The captured image must be inspected for expected pixels; successful encoding alone is not a rendering pass.',
    })
  } catch (cause) {
    post('capture', { error: cause instanceof Error ? cause.message : String(cause) })
    event('lifecycle', 'Real canvas readback failed.', detailOf(cause))
  }
}

window.addEventListener('message', (message: MessageEvent<unknown>) => {
  if (message.origin !== location.origin || message.source !== window.parent) return
  const data = message.data
  if (typeof data !== 'object' || data === null) return
  const command = data as { channel?: unknown; runId?: unknown; command?: unknown }
  if (command.channel !== 'vue-kit-webgpu-lab-command' || command.runId !== runId) return
  if (command.command === 'inspect') inspect()
  else if (command.command === 'capture') capture()
  else if (command.command === 'unmount') {
    if (unmounted) {
      event('lifecycle', 'Application is already unmounted; persistent error observers remain active.')
      return
    }
    event('lifecycle', 'Unmount command received; calling the real Vue app.unmount(). Observers remain installed for cleanup failures.')
    unmounted = true
    app.unmount()
    state.canvasMounted = Boolean(mount?.querySelector('canvas'))
    event('lifecycle', 'Vue app.unmount() returned; this is not a guarantee that asynchronous cleanup has completed.')
    sendState()
  }
})

sendState()
if (requestedMode !== mode) event('capability', `Unknown mode ${JSON.stringify(requestedMode)}; using normal with no capability denial.`)
if (mode === 'normal') {
  event('capability', 'Normal mode: native GPU and canvas APIs are not replaced, wrapped, or separately probed. Only real Vue events, DOM changes, error events and requested canvas readback are observed. Unobserved backend or queue activity is unknown, not failure.')
} else {
  intervention(`Selected ${mode}. ${deniedAdapter ? 'Adapter requests will resolve null.' : 'Device requests on a real adapter will reject.'} ${deniedWebgl ? 'WebGL2 context requests will also return null.' : 'WebGL2 fallback is not denied.'} A fresh iframe resets all overrides.`)
  intervention('For this injected run only, diagnostic wrappers replace GPU.requestAdapter, real-adapter requestDevice, real-device queue.submit, canvas.getContext and acquired WebGPU-context configure methods when available. Non-denied calls retain the native receiver, arguments and return value; request promises retain identity. Only the named denial changes a capability result. No synthetic adapter or device is created.')
}
if (mode !== 'normal') {
  instrumentGpu()
  instrumentCanvas()
} else {
  event('capability', 'navigator.gpu presence check only (no capability request made).', {
    present: 'gpu' in navigator, secureContext: state.secureContext,
  })
}
event('lifecycle', 'Mounting the extracted recipe. Its WebGPU-specific host onMounted replacement is exactly the one prescribed by the guide.')
app.mount(mount)
event('lifecycle', 'Vue app.mount() returned; asynchronous renderer initialization may still be pending.')
inspect()
