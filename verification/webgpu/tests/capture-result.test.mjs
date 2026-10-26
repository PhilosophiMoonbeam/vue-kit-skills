import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyCanvasCapture } from '../src/capture-result.ts'

test('zero-size empty readback is a completed response with exact value and provenance', () => {
  const provenance = {
    width: 0, height: 0, startedAt: 120, finishedAt: 121, elapsedMs: 1,
    lastRenderNotificationAt: 100, elapsedSinceRenderNotification: 20,
    backend: 'webgpu', rendererFamily: 'webgpu', preserveDrawingBuffer: null,
  }
  const result = classifyCanvasCapture({ dataUrl: 'data:,', provenance })
  assert.equal(result.outcome, 'empty')
  assert.equal(result.dataUrl, undefined)
  assert.equal(result.error, undefined)
  assert.equal(result.returnedDataUrl, 'data:,')
  assert.equal(result.returnedDataUrlLength, 6)
})

test('empty strings and unexpected non-PNG responses are not missing responses', () => {
  const empty = classifyCanvasCapture({ dataUrl: '' })
  assert.equal(empty.outcome, 'empty')
  assert.equal(empty.returnedDataUrl, '')
  assert.equal(empty.returnedDataUrlLength, 0)
  for (const dataUrl of ['data:image/jpeg,returned-value', 'unexpected returned value']) {
    const result = classifyCanvasCapture({ dataUrl })
    assert.equal(result.outcome, 'unexpected')
    assert.equal(result.dataUrl, undefined)
    assert.equal(result.returnedDataUrl, dataUrl)
    assert.equal(result.returnedDataUrlLength, dataUrl.length)
  }
  for (const data of [{}, { dataUrl: null }, { dataUrl: 0 }]) {
    assert.equal(classifyCanvasCapture(data).outcome, 'unexpected')
  }
})

test('large unexpected responses retain length and bounded identity without becoming images', () => {
  const dataUrl = 'unexpected:'.repeat(100)
  const result = classifyCanvasCapture({ dataUrl })
  assert.equal(result.outcome, 'unexpected')
  assert.equal(result.dataUrl, undefined)
  assert.equal(result.returnedDataUrl, undefined)
  assert.equal(result.returnedDataUrlLength, dataUrl.length)
  assert.equal(result.returnedDataUrlPrefix, dataUrl.slice(0, 256))
  assert.equal(result.returnedDataUrlTruncated, true)
})

test('frame errors remain exact, including an empty error string, with readback evidence separate', () => {
  for (const error of ['SecurityError: original canvas readback error', '']) {
    const provenance = { width: 640, height: 480, startedAt: 2, finishedAt: 3 }
    const result = classifyCanvasCapture({ error, dataUrl: 'data:,', provenance })
    assert.equal(result.outcome, 'error')
    assert.equal(result.error, error)
    assert.equal(result.returnedDataUrl, 'data:,')
  }
})
