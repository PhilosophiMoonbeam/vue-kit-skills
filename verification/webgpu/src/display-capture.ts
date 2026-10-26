export interface DisplaySession {
  id: string
  status: 'requesting' | 'active' | 'denied' | 'unsupported' | 'ended' | 'stopped' | 'error'
  requestedAt: string
  endedAt?: string
  error?: string
  settings?: MediaTrackSettings
  settingsObservedAt?: string
  source: 'user-selected-display-stream'
  displaySurface?: string
  identityVerified: false
  limitations: string[]
}

export interface DisplayImage {
  id: string
  sessionId: string | null
  runId: string
  label: string
  requestedAt: string
  capturedAt?: string
  dataUrl?: string
  pngAvailable?: boolean
  error?: string
  originalWidth?: number
  originalHeight?: number
  outputWidth?: number
  outputHeight?: number
  scale?: number
  settings?: MediaTrackSettings
  frame?: {
    callbackAt: number
    requestedAfter: number
    presentationTime: number
    expectedDisplayTime: number
    mediaTime: number
    presentedFrames: number
    width: number
    height: number
    processingDuration?: number
    captureTime?: number
    receiveTime?: number
    rtpTimestamp?: number
  }
}

export interface DisplayEvidence {
  currentSessionId: string | null
  sessions: DisplaySession[]
  captures: DisplayImage[]
}

type SessionStatus = DisplaySession['status']

interface LiveSession {
  evidence: DisplaySession
  lifetime: AbortController
  stream?: MediaStream
  video?: HTMLVideoElement
  removeListeners: (() => void)[]
  closed: boolean
}

const frameTimeoutMs = 8000
const longestImageSide = 1920
const sourceLimitations = [
  'Images are frames from the user-selected display stream, not native canvas readback or full-page screenshots.',
  'The browser does not identify the exact selected tab or prove that it is this verification page; the current-tab preference is only a chooser hint.',
  'A new frame submitted for composition after the image request is required; source acquisition time is known only if the browser exposes captureTime.',
  'Display images and browser-reported track settings are not hardware certification.',
]

function timestamp(): string {
  return new Date().toISOString()
}

function abortError(message = 'Display capture was aborted.'): DOMException {
  return new DOMException(message, 'AbortError')
}

function errorText(error: unknown): string {
  if (error instanceof Error || error instanceof DOMException) return `${error.name}: ${error.message}`
  return String(error)
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

// The chooser has no AbortSignal option. Race our own lifetime while retaining
// handlers on its native promise so that any subsequently granted tracks stop.
function waitFor<T>(promise: Promise<T>, signal: AbortSignal, timeoutMs?: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const finish = (error: unknown, value?: T) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      clearTimeout(timer)
      if (error !== undefined) reject(error)
      else resolve(value as T)
    }
    const onAbort = () => finish(signal.reason ?? abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(value => finish(undefined, value), error => finish(error))
    if (signal.aborted) onAbort()
    if (!settled && timeoutMs !== undefined) {
      timer = setTimeout(() => finish(new DOMException('Display video playback did not start within the bounded wait.', 'TimeoutError')), timeoutMs)
    }
  })
}

/**
 * Permission is always requested from the calling user gesture, never on mount.
 * API semantics: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
 * Fresh-frame semantics: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
 */
export function createDisplayCapture(onChange: () => void) {
  const sessions: DisplaySession[] = []
  const captures: DisplayImage[] = []
  let current: LiveSession | null = null
  let sessionSequence = 0
  let imageSequence = 0

  function close(live: LiveSession, status: SessionStatus, error?: unknown): void {
    if (live.closed) return
    live.closed = true
    live.evidence.status = status
    live.evidence.endedAt = timestamp()
    if (error !== undefined) live.evidence.error = errorText(error)
    if (current === live) current = null
    for (const remove of live.removeListeners) remove()
    live.removeListeners.length = 0
    live.lifetime.abort(error ?? abortError(`Display capture ${status}.`))
    if (live.stream) stopTracks(live.stream)
    live.stream = undefined
    if (live.video) {
      live.video.pause()
      live.video.srcObject = null
      live.video.removeAttribute('src')
      live.video.load()
      live.video.remove()
      live.video = undefined
    }
    onChange()
  }

  function observeSettings(live: LiveSession): MediaTrackSettings {
    const track = live.stream?.getVideoTracks()[0]
    if (!track || track.readyState !== 'live') throw new DOMException('The display video track is no longer live.', 'InvalidStateError')
    const settings = { ...track.getSettings() }
    const surface = (settings as MediaTrackSettings & { displaySurface?: string }).displaySurface
    const changed = JSON.stringify(settings) !== JSON.stringify(live.evidence.settings)
    if (changed) {
      live.evidence.settings = settings
      live.evidence.settingsObservedAt = timestamp()
      live.evidence.displaySurface = surface
      live.evidence.limitations = [...sourceLimitations]
      if (!surface) live.evidence.limitations.push('The browser did not report displaySurface; even the selected source category cannot be verified.')
      onChange()
    }
    if (surface && surface !== 'browser') {
      throw new DOMException(`Only a browser-tab capture is accepted; the browser reported displaySurface=${JSON.stringify(surface)}. Its tracks have been stopped.`, 'SecurityError')
    }
    return settings
  }

  async function request(signal?: AbortSignal): Promise<void> {
    stop()
    const evidence: DisplaySession = {
      id: `display-${Date.now()}-${++sessionSequence}`,
      status: 'requesting',
      requestedAt: timestamp(),
      source: 'user-selected-display-stream',
      identityVerified: false,
      limitations: [...sourceLimitations, 'The browser has not yet reported displaySurface; the source category is unobserved.'],
    }
    const live: LiveSession = { evidence, lifetime: new AbortController(), removeListeners: [], closed: false }
    sessions.push(evidence)
    current = live
    const onAbort = () => close(live, 'stopped', signal?.reason ?? abortError())
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
      live.removeListeners.push(() => signal.removeEventListener('abort', onAbort))
    }
    onChange()
    try {
      if (signal?.aborted) onAbort()
      if (live.closed) throw live.lifetime.signal.reason
      if (typeof navigator === 'undefined' || typeof document === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        const error = new DOMException('getDisplayMedia is unavailable. Display capture requires a supporting browser and a secure context.', 'NotSupportedError')
        close(live, 'unsupported', error)
        throw error
      }
      // These are preferences, not restrictions on the native source chooser.
      // Reject an exposed non-browser source after permission, before playback.
      const options: DisplayMediaStreamOptions & {
        preferCurrentTab: boolean
        selfBrowserSurface: 'include'
        monitorTypeSurfaces: 'exclude'
        surfaceSwitching: 'exclude'
        systemAudio: 'exclude'
      } = {
        video: { displaySurface: 'browser' } as MediaTrackConstraints,
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        monitorTypeSurfaces: 'exclude',
        surfaceSwitching: 'exclude',
        systemAudio: 'exclude',
      }
      // No await precedes the permission call: preserve transient click activation.
      const permission = navigator.mediaDevices.getDisplayMedia(options).then(stream => {
        if (live.closed) stopTracks(stream)
        else live.stream = stream
        return stream
      })
      const stream = await waitFor(permission, live.lifetime.signal)
      if (live.closed) {
        stopTracks(stream)
        throw live.lifetime.signal.reason
      }
      // audio:false is requested; do not retain audio even if a browser supplies it.
      for (const track of stream.getAudioTracks()) track.stop()
      observeSettings(live)
      const onEnded = () => close(live, 'ended')
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', onEnded, { once: true })
        live.removeListeners.push(() => track.removeEventListener('ended', onEnded))
      }
      stream.addEventListener('inactive', onEnded, { once: true })
      live.removeListeners.push(() => stream.removeEventListener('inactive', onEnded))
      const video = document.createElement('video')
      live.video = video
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      // Keep the video detached: it is only a frame decoder, never a live preview.
      const onVideoError = () => close(live, 'error', new Error(`Display video playback failed (media error ${video.error?.code ?? 'unknown'}): ${video.error?.message ?? 'No browser error message.'}`))
      video.addEventListener('error', onVideoError)
      live.removeListeners.push(() => video.removeEventListener('error', onVideoError))
      await waitFor(video.play(), live.lifetime.signal, frameTimeoutMs)
      if (live.closed) throw live.lifetime.signal.reason
      evidence.status = 'active'
      onChange()
    } catch (error) {
      if (!live.closed) {
        const name = error instanceof Error || error instanceof DOMException ? error.name : ''
        close(live, name === 'NotAllowedError' ? 'denied' : name === 'NotSupportedError' ? 'unsupported' : 'error', error)
      }
      throw error
    }
  }

  function freshFrame(live: LiveSession, image: DisplayImage, signal?: AbortSignal): Promise<void> {
    const video = live.video
    if (!video || typeof video.requestVideoFrameCallback !== 'function' || typeof video.cancelVideoFrameCallback !== 'function') {
      return Promise.reject(new DOMException('Fresh display-frame capture requires requestVideoFrameCallback and cancelVideoFrameCallback; no stale-frame substitute is used.', 'NotSupportedError'))
    }
    return new Promise((resolve, reject) => {
      const requestedAfter = performance.now()
      let callbackId: number | undefined
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const finish = (error?: unknown) => {
        if (settled) return
        settled = true
        if (callbackId !== undefined) video.cancelVideoFrameCallback(callbackId)
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        live.lifetime.signal.removeEventListener('abort', onStopped)
        if (error !== undefined) reject(error)
        else resolve()
      }
      const onAbort = () => finish(signal?.reason ?? abortError())
      const onStopped = () => finish(live.lifetime.signal.reason ?? abortError())
      const onFrame: VideoFrameRequestCallback = (now, metadata) => {
        callbackId = undefined
        if (settled) return
        if (!Number.isFinite(metadata.presentationTime)) {
          finish(new Error('The browser did not expose a frame presentationTime; a fresh frame cannot be established.'))
          return
        }
        if (metadata.presentationTime < requestedAfter) {
          try {
            callbackId = video.requestVideoFrameCallback(onFrame)
          } catch (error) {
            finish(error)
          }
          return
        }
        let canvas: HTMLCanvasElement | undefined
        try {
          image.frame = {
            callbackAt: now,
            requestedAfter,
            presentationTime: metadata.presentationTime,
            expectedDisplayTime: metadata.expectedDisplayTime,
            mediaTime: metadata.mediaTime,
            presentedFrames: metadata.presentedFrames,
            width: metadata.width,
            height: metadata.height,
          }
          for (const key of ['processingDuration', 'captureTime', 'receiveTime', 'rtpTimestamp'] as const) {
            const value = metadata[key]
            if (typeof value === 'number' && Number.isFinite(value)) image.frame[key] = value
          }
          if (live.closed || current !== live) throw abortError('The display session changed before its frame could be captured.')
          image.settings = observeSettings(live)
          const width = video.videoWidth
          const height = video.videoHeight
          if (video.readyState < 2 || width <= 0 || height <= 0 || metadata.width <= 0 || metadata.height <= 0) {
            throw new Error('The new display frame has no drawable video dimensions or current data.')
          }
          const scale = Math.min(1, longestImageSide / Math.max(width, height))
          image.originalWidth = width
          image.originalHeight = height
          image.outputWidth = Math.max(1, Math.round(width * scale))
          image.outputHeight = Math.max(1, Math.round(height * scale))
          image.scale = scale
          canvas = document.createElement('canvas')
          canvas.width = image.outputWidth
          canvas.height = image.outputHeight
          const context = canvas.getContext('2d')
          if (!context) throw new Error('A 2D context could not be created for the display-frame PNG.')
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/png')
          if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('The browser did not return a PNG for the captured display frame.')
          image.dataUrl = dataUrl
          image.capturedAt = timestamp()
          finish()
        } catch (error) {
          if (error instanceof DOMException && error.name === 'SecurityError') close(live, 'error', error)
          finish(error)
        } finally {
          // All drawing/export is synchronous in this callback; retain no canvas.
          if (canvas) {
            canvas.width = 0
            canvas.height = 0
          }
        }
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      live.lifetime.signal.addEventListener('abort', onStopped, { once: true })
      if (signal?.aborted) onAbort()
      else if (live.lifetime.signal.aborted) onStopped()
      if (settled) return
      timer = setTimeout(() => finish(new DOMException('No fresh display video frame arrived within 8000 ms; no previous frame was substituted.', 'TimeoutError')), frameTimeoutMs)
      try {
        callbackId = video.requestVideoFrameCallback(onFrame)
      } catch (error) {
        finish(error)
      }
    })
  }

  async function capture(runId: string, label: string, signal?: AbortSignal): Promise<DisplayImage> {
    const live = current
    const image: DisplayImage = {
      id: `display-image-${Date.now()}-${++imageSequence}`,
      sessionId: live?.evidence.id ?? null,
      runId,
      label,
      requestedAt: timestamp(),
    }
    captures.push(image)
    onChange()
    try {
      if (signal?.aborted) throw signal.reason ?? abortError()
      if (!live || live.closed || live.evidence.status !== 'active') {
        throw new DOMException('There is no active, permission-granted display capture session.', 'InvalidStateError')
      }
      await freshFrame(live, image, signal)
    } catch (error) {
      image.error = errorText(error)
      if (signal?.aborted || (live?.lifetime.signal.aborted && live.evidence.status === 'stopped')) throw error
    } finally {
      onChange()
    }
    return { ...image, settings: image.settings ? { ...image.settings } : undefined, frame: image.frame ? { ...image.frame } : undefined }
  }

  function stop(): void {
    if (current) {
      const error = current.evidence.status === 'requesting'
        ? abortError('Display capture was stopped while permission or playback was pending.')
        : undefined
      close(current, 'stopped', error)
    }
  }

  function snapshot(includePng = true): DisplayEvidence {
    return {
      currentSessionId: current?.evidence.id ?? null,
      sessions: sessions.map(session => ({
        ...session,
        settings: session.settings ? { ...session.settings } : undefined,
        limitations: [...session.limitations],
      })),
      captures: captures.map(image => {
        const copy = { ...image, settings: image.settings ? { ...image.settings } : undefined, frame: image.frame ? { ...image.frame } : undefined }
        if (!includePng) {
          delete copy.dataUrl
          copy.pngAvailable = Boolean(image.dataUrl)
        }
        return copy
      }),
    }
  }

  return { request, capture, stop, snapshot }
}
