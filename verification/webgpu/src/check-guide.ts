import { manualChecks } from './lab-contract'

type CheckId = typeof manualChecks[number]['id']

// Authored task guidance; exact assertions remain in lab-contract.ts.
export const checkGuide: Record<CheckId, { title: string; steps: string[]; expect: string; caution?: string }> = {
  'gpu-01': {
    title: 'Render the WebGL scene',
    steps: [
      'Choose Run check and inspect the cube, lighting, framing and DOM description.',
      'Use Refresh and review errors in Diagnostics.',
    ],
    expect: 'A lit blue cube, correct framing, a text description and no unexpected errors.',
  },
  'gpu-02': {
    title: 'Identify the live GPU backend',
    steps: [
      'Choose Run check in a secure context and wait for ready.',
      'Inspect live output and Diagnostics; record the backend, adapter and browser GPU details.',
    ],
    expect: 'The recorded backend matches visible output and identifies whether rendering uses hardware or software.',
    caution: 'WebGL2 fallback, navigator.gpu and the WebGPU renderer family do not prove live WebGPU output. Software rendering is not native hardware.',
  },
  'gpu-03': {
    title: 'Check WebGL2 fallback',
    steps: [
      'Run both cases: No adapter, then Device denied.',
      'Confirm visible WebGL2 output in each case, then choose Remove scene and inspect late errors.',
    ],
    expect: 'Both injected profiles render through WebGL2 and remove the scene without unexpected errors.',
    caution: 'These profiles inject WebGPU failures; record both cases, not only the renderer family.',
  },
  'gpu-04': {
    title: 'Check unavailable WebGL2',
    steps: [
      'Choose Run check to deny WebGL2.',
      'Read the scene alternative and inspect the capability result in Diagnostics.',
    ],
    expect: 'Useful unavailable text replaces preparation; no blank canvas or endless wait remains.',
    caution: 'WebGL2 denial is injected. This scene does not provide a WebGL1 fallback.',
  },
  'gpu-05': {
    title: 'Deny both rendering paths',
    steps: [
      'Run both cases: Adapter and WebGL2 denied, then Device and WebGL2 denied.',
      'Inspect the host alert and error details, choose Remove scene and retain late errors from both cases.',
    ],
    expect: 'Both cases show the host alert, with initialization and teardown errors recorded separately.',
    caution: 'These injected failures include a known asynchronous teardown rejection; do not record clean recovery.',
  },
  'gpu-06': {
    title: 'Control rendering and motion',
    steps: [
      'Choose Run check; confirm the initially paused scene stays visible.',
      'Start and pause rotation; use Refresh to compare rotation and render events while playing and after pausing.',
      'Choose Rotate once and confirm a new frame.',
    ],
    expect: 'Motion and draws advance together, settle after pause, and update once invalidated without another animation loop.',
  },
  'gpu-07': {
    title: 'Respect reduced motion',
    steps: [
      'Set reduced motion before Run check; repeat with no preference and confirm neither autoplays.',
      'Start rotation with no preference, then switch to reduced motion and inspect the paused controls.',
      'Choose Remove scene, change the preference again and inspect listener cleanup in browser tools.',
    ],
    expect: 'Initial reduced motion blocks rotation, live changes pause it, and removal releases the preference listener.',
  },
  'gpu-08': {
    title: 'Resize both renderers',
    steps: [
      'Choose each Case, WebGL and WebGPU, and use Run check separately.',
      'Use Narrow, Wide, Hide and Show; choose Refresh at each size.',
      'Record parent and canvas dimensions, DPR and framing in Diagnostics.',
    ],
    expect: 'Both scenes fit their parent with DPR=1, correct framing and no overflow or competing resize loop.',
  },
  'gpu-09': {
    title: 'Select by pointer and keyboard',
    steps: [
      'Choose Run check; hover, click and double-click objects, then click empty canvas.',
      'Toggle Stop events at the hit cube; inspect IDs, hit objects, coordinates, propagation and pointermissed in Diagnostics.',
      'Use Tab and Enter or Space with Select, Activate selected and Clear selection.',
    ],
    expect: 'Pointer events carry the declared data, propagation behaves correctly, and keyboard controls provide equivalent selection.',
  },
  'gpu-10': {
    title: 'Compare repeated resource use',
    steps: [
      'Repeat Run check and Remove scene for the WebGL and Shared resources cases with equal workloads; retain the run IDs.',
      'Compare active-scene geometry, texture, program and render-target counts in Diagnostics.',
      'Inspect cleanup events, errors and retained loops, listeners and observers with browser tools.',
    ],
    expect: 'Comparable active-scene counts stabilize and removal releases hooks, listeners, observers and scene resources.',
  },
  'gpu-11': {
    title: 'Load the real Box asset',
    steps: [
      'Run check separately for Normal and Missing model; record actual HTTP 200 and 404 responses.',
      'Inspect the loaded Box scale, camera and lighting, then the host status and error text.',
      'Use browser networking controls or a controlled origin for any separate offline or CORS case; record the setup.',
    ],
    expect: 'The real Box renders at useful scale; failures show host text outside the scene rather than scene HTML.',
    caution: 'The local 404 checks an HTTP failure, not offline or CORS behavior.',
  },
  'gpu-12': {
    title: 'Remove a loading scene',
    steps: [
      'Choose Run check; wait for the delayed request to start, then choose Remove scene before its roughly three-second response.',
      'Keep the current case open until late completion; record request outcome, removal order and disposal counts in Diagnostics.',
    ],
    expect: 'Late success is disposed exactly once by its owner and leaves no abandoned rendered scene.',
    caution: 'Do not run another case before completion. Repeat if loading finished before removal; removal does not promise a network abort.',
  },
  'gpu-13': {
    title: 'Release shared resources safely',
    steps: [
      'Choose Run check; record both consumers and their resource identities.',
      'Choose Retire first cube and confirm the second survives, then choose Release final owner.',
      'Use Record snapshot and inspect native disposal events for geometry, material, map, normalMap, environment and target resources.',
    ],
    expect: 'Sharing preserves the live consumer, and the final owner releases its resources. Stable constructor args do not demonstrate replacement cleanup.',
  },
  'gpu-14': {
    title: 'Lose and recreate a renderer',
    steps: [
      'Run check for the WebGL or WebGPU case; select Allow context or device loss, then choose Lose context.',
      'Inspect the real loss event, stopped work and DOM alternative in Diagnostics.',
      'Run check again to recreate the scene and record the recovery outcome.',
    ],
    expect: 'Actual loss produces useful fallback text; deliberate recreation creates a fresh scene with its own renderer.',
    caution: 'Loss destroys the current context or device. Unsupported requests are not a pass; recreation is not automatic recovery or a WebGL-to-WebGPU switch.',
  },
  'gpu-15': {
    title: 'Check custom shader applicability',
    steps: [
      'Choose Not applicable and note: the retained examples use no custom TSL/node shader.',
    ],
    expect: 'Not applicable records the absence of a custom shader, not a successful shader check.',
    caution: 'A real custom shader requires its configuration, compilation diagnostics and visible output under WebGPU and WebGL2 fallback.',
  },
  'gpu-16': {
    title: 'Check custom effects applicability',
    steps: [
      'Choose Not applicable and note: the retained examples use no custom postprocessing or shadow pipeline.',
    ],
    expect: 'Not applicable records the absent pipeline; it does not establish frame callbacks, shadows or disposal behavior.',
    caution: 'A real pipeline requires rendered output, notifySuccess once per successful frame, target/pass disposal and the r186 soft-to-PCFShadowMap result.',
  },
  'gpu-17': {
    title: 'Compare capture channels',
    steps: [
      'Choose Run check; inspect live output and use Capture PNG promptly.',
      'Take a separate page screenshot with browser or OS tools; record timing, backend and drawing-buffer persistence.',
    ],
    expect: 'Live output, canvas pixels and the page screenshot are recorded as distinct evidence channels.',
    caution: 'Readback and screenshot disagreement alone is not a rendering failure. Page screenshots are not collected automatically.',
  },
}
