export interface CanvasCaptureResult {
  outcome: 'png' | 'empty' | 'unexpected' | 'error' | 'timeout' | 'interrupted'
  /** Only PNG responses are offered as images/downloads; transparency is not a failure. */
  dataUrl?: string
  /** The frame's original error, never replaced by a readback classification. */
  error?: string
  message: string
  returnedDataUrlLength?: number
  /** Exact non-PNG response when bounded; PNG identity is retained in dataUrl instead. */
  returnedDataUrl?: string
  returnedDataUrlPrefix?: string
  returnedDataUrlTruncated?: true
  provenance?: Record<string, unknown>
}

/** Every received capture object is a completed response, including empty/unexpected readback. */
export function classifyCanvasCapture(data: Record<string, unknown>): CanvasCaptureResult {
  const raw = typeof data.dataUrl === 'string' ? data.dataUrl : undefined
  const dataUrl = raw?.startsWith('data:image/png;base64,') ? raw : undefined
  const error = typeof data.error === 'string' ? data.error : undefined
  const outcome = error !== undefined ? 'error' : dataUrl !== undefined ? 'png'
    : raw === 'data:,' || raw === '' ? 'empty' : 'unexpected'
  const result: CanvasCaptureResult = {
    outcome, dataUrl, error,
    message: outcome === 'error' ? `Canvas readback failed: ${error}`
      : outcome === 'png' ? 'Canvas PNG received.'
        : outcome === 'empty' ? 'Canvas readback returned no image.'
          : 'Canvas readback returned a non-PNG response.',
  }
  if (raw !== undefined) {
    result.returnedDataUrlLength = raw.length
    if (!dataUrl) {
      if (raw.length <= 256) result.returnedDataUrl = raw
      else {
        result.returnedDataUrlPrefix = raw.slice(0, 256)
        result.returnedDataUrlTruncated = true
      }
    }
  }
  if (data.provenance !== null && typeof data.provenance === 'object' && !Array.isArray(data.provenance)) {
    result.provenance = data.provenance as Record<string, unknown>
  }
  return result
}
