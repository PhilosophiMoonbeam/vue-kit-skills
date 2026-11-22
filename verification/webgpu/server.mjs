import { extname, resolve, sep } from 'node:path'

const root = resolve(import.meta.dir, 'dist')
const port = Number(Bun.env.PORT ?? 45875)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.vue': 'text/plain', '.ts': 'text/plain', '.md': 'text/plain', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' }
const commonHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}
function errorResponse(status, message, head, headers = commonHeaders) {
  return new Response(head ? null : message, { status, headers })
}

Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(request) {
    const head = request.method === 'HEAD'
    if (request.method !== 'GET' && !head) {
      return errorResponse(405, 'Method not allowed', false, { ...commonHeaders, Allow: 'GET, HEAD' })
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url).pathname)
      // Fault profiles are local fixture routes, never fake GLTF data or loader outcomes.
      if (pathname === '/fixtures/missing.glb') return errorResponse(404, 'Not found', head)
      const delayedBox = pathname === '/fixtures/Box-delayed.glb'
      const servedPath = delayedBox ? '/fixtures/Box.glb' : pathname
      const path = resolve(root, servedPath === '/' ? 'index.html' : `.${servedPath}`)
      if (!path.startsWith(root + sep)) return errorResponse(403, 'Forbidden', head)
      if (path.includes('\0')) return errorResponse(400, 'Bad request', head)
      const content = Bun.file(path)
      const info = await content.stat()
      if (!info.isFile()) return errorResponse(404, 'Not found', head)
      if (delayedBox) await Bun.sleep(3000)
      const type = mime[extname(path)] ?? 'application/octet-stream'
      const charset = type.startsWith('text/') || type === 'application/json' ? '; charset=utf-8' : ''
      return new Response(head ? null : content, {
        headers: {
          ...commonHeaders,
          'Content-Type': `${type}${charset}`,
          'Content-Length': String(info.size),
        },
      })
    } catch (error) {
      const missing = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
      return missing ? errorResponse(404, 'Not found', head) : errorResponse(400, 'Bad request', head)
    }
  },
})
console.log(`WebGPU verification lab listening on http://127.0.0.1:${port}`)
