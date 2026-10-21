import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const reference = resolve(root, '../../skills/vue-kit/references/tresjs.md')
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const output = resolve(root, 'dist/source')
await mkdir(output, { recursive: true })
const sources = []
for (const name of ['SceneHost.vue', 'SceneCanvas.vue', 'frame.ts', 'App.vue']) {
  const content = await readFile(resolve(root, 'src', name), 'utf8')
  await writeFile(resolve(output, name), content)
  sources.push({ name, sha256: createHash('sha256').update(content).digest('hex'), url: `/source/${name}` })
}
const referenceText = await readFile(reference, 'utf8')
await writeFile(resolve(output, 'tresjs.md'), referenceText)
await writeFile(resolve(output, 'provenance.json'), JSON.stringify({
  reference: 'skills/vue-kit/references/tresjs.md',
  referenceSha256: createHash('sha256').update(referenceText).digest('hex'),
  referenceUrl: '/source/tresjs.md',
  transformation: 'The experimental SceneCanvas fence is copied verbatim. SceneHost uses the WebGPU-specific onMounted replacement prescribed by the reference; no dependency patches or error suppression.',
  versions: packageJson.dependencies,
  sources,
}, null, 2) + '\n')
