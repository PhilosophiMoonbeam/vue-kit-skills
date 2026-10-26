export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type SceneId = 'webgpu' | 'webgl' | 'picking' | 'asset' | 'ownership'
export type Mode = 'normal' | 'adapter-unavailable' | 'device-rejected' | 'both-unavailable' | 'device-and-fallback-unavailable' | 'webgl-unavailable' | 'asset-unavailable' | 'asset-delayed'
export type Command = 'unmount' | 'capture' | 'inspect' | 'invalidate' | 'lose-context'
export type Category = 'capability' | 'component-error' | 'unhandled-rejection' | 'window-error' | 'gpu-validation' | 'lifecycle' | 'asset' | 'resource' | 'picking'

export interface FrameState {
  secureContext: boolean
  scene: SceneId
  mode: Mode
  versions: { vue: string; core: string; three: string }
  userAgent: string
  adapter?: Json
  deviceCreated: boolean
  backend: 'webgpu' | 'webgl2' | 'pending' | 'unknown' | 'unavailable'
  rendererFamily: 'webgpu' | 'webgl' | 'unknown'
  ready: boolean
  canvasMounted: boolean
  unhandledCount: number
  metrics?: Json
}

export const observationChannel = 'vue-kit-lab-observation'

// Consumer fixtures report actual events, never synthetic capability or pass results.
export function reportObservation(category: Category, message: string, detail?: Json): void {
  window.dispatchEvent(new CustomEvent(observationChannel, { detail: { category, message, detail } }))
}

export const scenes: { value: SceneId; label: string; description: string }[] = [
  { value: 'webgpu', label: 'Experimental WebGPU cube', description: 'The verbatim retained alternative canvas and its prescribed client host.' },
  { value: 'webgl', label: 'Ordinary WebGL cube', description: 'The three complete retained SFCs, including opt-in motion and reduced-motion handling.' },
  { value: 'picking', label: 'Picking and keyboard equivalents', description: 'A source-matched verification consumer for stable IDs, pointer propagation and labeled DOM controls.' },
  { value: 'asset', label: 'Box loader and late completion', description: 'A source-matched real Khronos Box loader consumer with observable resource retirement; controlled local missing/delayed asset profiles are explicit.' },
  { value: 'ownership', label: 'Shared resources and final ownership', description: 'A source-matched real two-consumer lifetime, explicit final resource disposal and comparable active-scene snapshots.' },
]

export const modes: { value: Mode; label: string; description: string; scenes: SceneId[] }[] = [
  { value: 'normal', label: 'Normal · no fault injection', description: 'Use actual browser capabilities. Native GPU/canvas methods remain unwrapped; source-derived consumer instrumentation is separately identified.', scenes: ['webgpu','webgl','picking','asset','ownership'] },
  { value: 'adapter-unavailable', label: 'Injected · adapter unavailable', description: 'GPU.requestAdapter resolves null; the real WebGL2 fallback remains available if supported.', scenes: ['webgpu'] },
  { value: 'device-rejected', label: 'Injected · device request rejected', description: 'A real adapter requestDevice is deliberately rejected; the real WebGL2 fallback remains available if supported.', scenes: ['webgpu'] },
  { value: 'both-unavailable', label: 'Injected · adapter + fallback unavailable', description: 'Deliberately deny adapter and WebGL2 acquisition. Initialization and the pinned raw teardown rejection must be recorded, not hidden.', scenes: ['webgpu'] },
  { value: 'device-and-fallback-unavailable', label: 'Injected · device + fallback unavailable', description: 'Deliberately reject a real adapter device request and deny WebGL2. Record initialization and raw teardown errors separately.', scenes: ['webgpu'] },
  { value: 'webgl-unavailable', label: 'Injected · WebGL2 unavailable', description: 'Deny WebGL2 to exercise the ordinary host capability fallback. Do not invent a WebGL1 or WebGPU fallback.', scenes: ['webgl'] },
  { value: 'asset-unavailable', label: 'Controlled · missing Box asset', description: 'Request an intentionally absent local asset and observe the actual HTTP/loader error. This is not an asserted CORS or offline result.', scenes: ['asset'] },
  { value: 'asset-delayed', label: 'Controlled · delayed real Box asset', description: 'Serve real Box bytes after a short bounded server delay. Unmount before completion; no network abort is promised.', scenes: ['asset'] },
]

export const manualChecks = [
  {
    "id": "gpu-01",
    "mode": "ordinary WebGL recipe",
    "assertion": "On target browser/device with WebGL2, cube appears framed and lit, parent-sized canvas is nonzero, DOM description remains present, and no unexpected component errors/page errors/unhandled rejections occur.",
    "evidence_to_record": "Browser/OS, exact package pins, actual renderer family/backend, live visual capture and raw console/errors.",
    "scenes": [
      "webgl"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  },
  {
    "id": "gpu-02",
    "mode": "WebGPU normal, no API intervention",
    "assertion": "In a secure context, record actual adapter/device and backend after initialization; WebGPU backend must actually render the cube before claiming native WebGPU support. navigator.gpu and isWebGPU alone are insufficient.",
    "evidence_to_record": "Adapter vendor/architecture/software status, backend identity, ready event, live output; do not call SwiftShader native hardware.",
    "scenes": [
      "webgpu"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  },
  {
    "id": "gpu-03",
    "mode": "WebGPURenderer WebGL2 fallback",
    "assertion": "When WebGPU adapter is unavailable or device creation rejects but WebGL2 remains available, fallback produces visible output and normal unmount without unexpected raw errors.",
    "evidence_to_record": "Separate named fault profiles; actual backend WebGL2; isWebGPU still indicates renderer family; errors/rejections retained.",
    "scenes": [
      "webgpu"
    ],
    "modes": [
      "adapter-unavailable",
      "device-rejected"
    ],
    "conditional": false
  },
  {
    "id": "gpu-04",
    "mode": "default WebGL failure",
    "assertion": "Without WebGL2, ordinary host shows useful unavailable text rather than blank canvas or endless preparing state; no WebGL1 fallback is promised.",
    "evidence_to_record": "Capability probe result and DOM alert/alternative.",
    "scenes": [
      "webgl"
    ],
    "modes": [
      "webgl-unavailable"
    ],
    "conditional": false
  },
  {
    "id": "gpu-05",
    "mode": "double initialization denial",
    "assertion": "Deliberately deny both WebGPU and WebGL2 fallback in a separate fault-injection profile; INITIALIZATION_FAILED must reach host DOM alert. Record all raw teardown rejections, including the known pinned async-dispose/init path; do not suppress or label the profile a clean-recovery pass.",
    "evidence_to_record": "Intervention details, emitted code, alert text, pageerror/unhandledrejection and teardown timeline.",
    "scenes": [
      "webgpu"
    ],
    "modes": [
      "both-unavailable",
      "device-and-fallback-unavailable"
    ],
    "conditional": false
  },
  {
    "id": "gpu-06",
    "mode": "on-demand and opt-in loop",
    "assertion": "Default stopped scene remains visible without self-sustaining rendering; Play starts delta-based motion, Pause stops motion, and direct imperative ref mutation followed by invalidate produces a new frame.",
    "evidence_to_record": "Frame/rotation observations and controls state, without another RAF owner.",
    "scenes": [
      "webgl"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  },
  {
    "id": "gpu-07",
    "mode": "reduced-motion changes",
    "assertion": "Initial reduce preference disables rotation, normal preference never autoplays, live transition to reduce pauses and updates controls, and removal cleans its media-query listener.",
    "evidence_to_record": "Initial and live preference profiles, control state and post-unmount listener behavior.",
    "scenes": [
      "webgl"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  },
  {
    "id": "gpu-08",
    "mode": "resize, hidden host and DPR",
    "assertion": "Narrow/wide/hidden-shown parent sizes yield correct canvas dimensions and camera framing; declared DPR=1 is honored and no competing resize loop or overflow appears.",
    "evidence_to_record": "Parent/canvas sizes, pixel ratio and framing before/after transitions.",
    "scenes": [
      "webgl",
      "webgpu"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  },
  {
    "id": "gpu-09",
    "mode": "picking and DOM equivalents",
    "assertion": "Click/hover/dblclick use declared event names/payload; ordinary hit dispatch/ancestor propagation and stopPropagation work, pointermissed clears app selection, and equivalent labeled DOM controls work by keyboard.",
    "evidence_to_record": "Selected business IDs, hit object, client/screen coordinates, propagation trace and keyboard action.",
    "scenes": [
      "picking"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  },
  {
    "id": "gpu-10",
    "mode": "resource retirement",
    "assertion": "Repeated mount/unmount removes loop hooks, event forwarders, observers, DOM listeners and template resources; comparable active-scene resource counts stabilize across cycles rather than grow without bound. Do not require renderer.info counts to be zero.",
    "evidence_to_record": "Equal workload repeated-cycle geometry/texture/program/render-target counts and raw teardown errors.",
    "scenes": [
      "webgl",
      "ownership"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  },
  {
    "id": "gpu-11",
    "mode": "asset success and errors",
    "assertion": "Real Khronos Box renders at useful scale with configured camera/lights; failure/CORS/offline profiles display host status/error text and no scene HTML is emitted.",
    "evidence_to_record": "Asset URL/status, loaded scene, DOM status/error and resource ownership.",
    "scenes": [
      "asset"
    ],
    "modes": [
      "normal",
      "asset-unavailable"
    ],
    "conditional": false
  },
  {
    "id": "gpu-12",
    "mode": "asset late completion",
    "assertion": "Unmount before asset completes; late success result is disposed exactly by the late-result owner, no abandoned rendered scene remains, and no false network-abort claim is made.",
    "evidence_to_record": "Resolution/unmount ordering, dispose event counts and unchanged network request outcome.",
    "scenes": [
      "asset"
    ],
    "modes": [
      "asset-delayed"
    ],
    "conditional": false
  },
  {
    "id": "gpu-13",
    "mode": "shared resources and replacement",
    "assertion": "Shared geometry/material/texture opt-out does not invalidate a live second consumer; final owner releases all owned map/normalMap/environment/target resources. args changes must not be assumed to change ref identity or release replaced resources.",
    "evidence_to_record": "Consumer lifetimes, object identity and resource-dispose events/counts.",
    "scenes": [
      "ownership"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  },
  {
    "id": "gpu-14",
    "mode": "context/device loss",
    "assertion": "Actual WebGL context loss or WebGPU device loss results in informative DOM fallback and deliberate owner-specific recovery/recreation, never a claim that default WebGL failure automatically switches to WebGPU.",
    "evidence_to_record": "Loss event/device.lost, stopped dependent work, error/alternative and recovery policy/outcome.",
    "scenes": [
      "webgl",
      "webgpu"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  },
  {
    "id": "gpu-15",
    "mode": "TSL/node custom shader, only if used by consumer",
    "assertion": "A real selected-backend node material renders as intended under WebGPU and its WebGL2 fallback; do not use ShaderMaterial/RawShaderMaterial/onBeforeCompile to fake support.",
    "evidence_to_record": "Selected backend, shader/node configuration, compilation diagnostics and output.",
    "scenes": [
      "webgpu"
    ],
    "modes": [
      "normal"
    ],
    "conditional": true
  },
  {
    "id": "gpu-16",
    "mode": "custom postprocessing/shadows, only if used by consumer",
    "assertion": "Renderer-compatible node postprocessing or custom useLoop.render performs actual frame rendering and calls notifySuccess once per successful frame; target/pass disposal is explicit, and r186 shadow mode resolves to PCFShadowMap when soft is requested.",
    "evidence_to_record": "Pipeline/backend, success callback/frame behavior, rendered shadows and target/pass disposal.",
    "scenes": [
      "webgpu"
    ],
    "modes": [
      "normal"
    ],
    "conditional": true
  },
  {
    "id": "gpu-17",
    "mode": "capture provenance",
    "assertion": "Compare live canvas output, timely canvas pixels and page screenshot with declared drawing-buffer persistence; disagreement alone must not be called a rendering failure.",
    "evidence_to_record": "Capture timing, preserveDrawingBuffer/backend, live output plus both channels and raw errors.",
    "scenes": [
      "webgl",
      "webgpu"
    ],
    "modes": [
      "normal"
    ],
    "conditional": false
  }
] as const
