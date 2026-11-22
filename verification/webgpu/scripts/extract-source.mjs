import { mkdir } from 'node:fs/promises'

const sourceUrl = new URL('../../../skills/vue-kit/references/tresjs.md', import.meta.url)
const outputUrl = new URL('../src/', import.meta.url)
const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
const sourceBytes = await Bun.file(sourceUrl).bytes()
const source = decoder.decode(sourceBytes)
const lockfile = await Bun.file(new URL('../bun.lock', import.meta.url)).bytes()

function exactlyOne(values, description) {
  if (values.length !== 1) {
    throw new Error(`Expected exactly one ${description}; found ${values.length}. No recipe was generated.`)
  }
  return values[0]
}

function section(title) {
  const headings = [...source.matchAll(/^## (.+)\r?$/gm)]
  const heading = exactlyOne(headings.filter(match => match[1] === title), `section named ${JSON.stringify(title)}`)
  const next = headings.find(match => match.index > heading.index)
  return source.slice(heading.index, next?.index ?? source.length)
}

function vueFences(markdown) {
  return [...markdown.matchAll(/^```([^\r\n]*)\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)]
    .filter(match => match[1].trim() === 'vue')
    .map(match => match[2])
}

const allFences = vueFences(source)
const host = exactlyOne(
  allFences.filter(body => /^<!-- SceneHost\.vue -->\r?\n/.test(body)),
  'Vue fence named SceneHost.vue',
)
const experimental = section('Experimental WebGPU and custom rendering')
// The guide names the alternative SceneCanvas.vue in its prose, not a fence comment.
// Require that association and one Vue fence; never silently select the earlier WebGL canvas.
if (!experimental.includes('`SceneCanvas.vue`')) {
  throw new Error('The experimental section no longer names SceneCanvas.vue. No recipe was generated.')
}
const canvas = exactlyOne(vueFences(experimental), 'experimental SceneCanvas.vue fence')
const explicitCanvasNames = allFences.filter(body => /^<!-- SceneCanvas\.vue -->\r?\n/.test(body))
if (explicitCanvasNames.length > 1 || /^<!-- (?!SceneCanvas\.vue -->)[^\r\n]+ -->/.test(canvas)) {
  throw new Error('Ambiguous SceneCanvas.vue fence names. No recipe was generated.')
}
const coreImport = exactlyOne(
  [...canvas.matchAll(/^import \{[^}]*\} from (['"])@tresjs\/core\1(?=\r?$)/gm)],
  'root Core import in the archived WebGPU SceneCanvas.vue fence',
)
const webgpuImport = coreImport[0].replace('@tresjs/core', '@tresjs/core/webgpu')
const retirement = exactlyOne(
  [...canvas.matchAll(/^ {2}onBeforeUnmount\(\(\) => \{\r?\n {4}\/\/ Tres disposes normally\. If init is still pending, release its late result too\.\r?\n[\s\S]*?^ {2}\}\)\r?\n/gm)],
  'archived renderer factory retirement hook',
)
// Three r187 dispose() waits for init, and Core 5.12 already calls it on unmount.
const webgpuCanvas = canvas
  .replace(coreImport[0], () => webgpuImport)
  .replace(retirement[0], '')
const replacement = exactlyOne(
  [...experimental.matchAll(/`(onMounted\(\(\) => \{ ready\.value = true \}\))`/g)].map(match => match[1]),
  'documented WebGPU onMounted replacement',
)
const mounted = exactlyOne(
  [...host.matchAll(/^onMounted\(\(\) => \{\r?\n[\s\S]*?^\}\)/gm)],
  'SceneHost.vue onMounted callback',
)
const webgpuHost = host.slice(0, mounted.index) + replacement + host.slice(mounted.index + mounted[0].length)

const ordinary = vueFences(section('Complete WebGLRenderer compatibility example: client boundary, controls, and animated scene'))
const webgl = ['SceneHost.vue', 'SceneCanvas.vue', 'SpinningCube.vue'].map(name => [
  `recipes/webgl/${name}`,
  exactlyOne(
    ordinary.filter(body => body.startsWith(`<!-- ${name} -->\n`) || body.startsWith(`<!-- ${name} -->\r\n`)),
    `ordinary ${name} fence`,
  ),
])

const sha256 = content => new Bun.CryptoHasher('sha256').update(content).digest('hex')
const generatedSources = [
  { name: 'SceneHost.vue', kind: 'prescribed-host-transformation', body: webgpuHost, sourceFence: host, section: 'Complete WebGLRenderer compatibility example: client boundary, controls, and animated scene', transformation: { prescribedBy: 'Experimental WebGPU and custom rendering', removed: mounted[0], replacement } },
  {
    name: 'SceneCanvas.vue', kind: 'archived-webgpu-fence-migration', body: webgpuCanvas, sourceFence: canvas, section: 'Experimental WebGPU and custom rendering',
    transformations: [
      { kind: 'core-webgpu-entry', removed: coreImport[0], replacement: webgpuImport },
      { kind: 'remove-redundant-renderer-retirement', removed: retirement[0], replacement: '', reason: 'Core 5.12 calls dispose() on unmount; Three r187 dispose() waits for pending init.' },
    ],
  },
  ...webgl.map(([name, body]) => ({ name, kind: 'verbatim-source-fence', body, sourceFence: body, section: 'Complete WebGLRenderer compatibility example: client boundary, controls, and animated scene' })),
]
await mkdir(outputUrl, { recursive: true })
for (const { name, body: content } of generatedSources) {
  const destination = new URL(name, outputUrl)
  await mkdir(new URL('.', destination), { recursive: true })
  let previous
  try {
    previous = decoder.decode(await Bun.file(destination).bytes())
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (previous !== content) await Bun.write(destination, content)
  console.log(`Extracted ${Bun.fileURLToPath(destination)} from ${Bun.fileURLToPath(sourceUrl)}`)
}
const metadataUrl = new URL('../.generated/recipe-provenance.json', import.meta.url)
await mkdir(new URL('.', metadataUrl), { recursive: true })
await Bun.write(metadataUrl, `${JSON.stringify({
  schemaVersion: 2,
  reference: 'skills/vue-kit/references/tresjs.md',
  referenceSha256: sha256(sourceBytes),
  lockfileSha256: sha256(lockfile),
  generatedSources: generatedSources.map(({ body, sourceFence, ...entry }) => ({
    ...entry,
    sourceStartLine: source.slice(0, source.indexOf(sourceFence)).split('\n').length,
    sourceFenceSha256: sha256(sourceFence),
    sha256: sha256(body),
  })),
}, null, 2)}\n`)
