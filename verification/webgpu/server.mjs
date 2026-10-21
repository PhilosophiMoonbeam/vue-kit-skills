import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'dist')
const port = Number(process.env.PORT ?? 45875)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.vue': 'text/plain', '.ts': 'text/plain', '.md': 'text/plain', '.png': 'image/png', '.svg': 'image/svg+xml' }
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed')
    return
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    const path = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`)
    if (!path.startsWith(root + sep)) { response.writeHead(403).end('Forbidden'); return }
    if (!(await stat(path)).isFile()) { response.writeHead(404).end('Not found'); return }
    const content = await readFile(path)
    response.writeHead(200, { 'Content-Type': `${mime[extname(path)] ?? 'application/octet-stream'}; charset=utf-8`, 'Content-Length': content.length })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch (error) {
    const missing = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
    response.writeHead(missing ? 404 : 400).end(missing ? 'Not found' : 'Bad request')
  }
})
server.listen(port, '127.0.0.1', () => console.log(`WebGPU verification lab listening on http://127.0.0.1:${port}`))
