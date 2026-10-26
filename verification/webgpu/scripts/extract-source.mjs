import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const sourceUrl = new URL('../../../skills/vue-kit/references/tresjs.md', import.meta.url)
const outputUrl = new URL('../src/', import.meta.url)
const source = await readFile(sourceUrl, 'utf8')

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

const sha256 = content => createHash('sha256').update(content).digest('hex')
const generatedSources = [
  { name: 'SceneHost.vue', kind: 'prescribed-host-transformation', body: webgpuHost, sourceFence: host, section: 'Complete WebGLRenderer compatibility example: client boundary, controls, and animated scene', transformation: { prescribedBy: 'Experimental WebGPU and custom rendering', removed: mounted[0], replacement } },
  { name: 'SceneCanvas.vue', kind: 'verbatim-source-fence', body: canvas, sourceFence: canvas, section: 'Experimental WebGPU and custom rendering' },
  ...webgl.map(([name, body]) => ({ name, kind: 'verbatim-source-fence', body, sourceFence: body, section: 'Complete WebGLRenderer compatibility example: client boundary, controls, and animated scene' })),
]
await mkdir(outputUrl, { recursive: true })
for (const { name, body: content } of generatedSources) {
  const destination = new URL(name, outputUrl)
  await mkdir(new URL('.', destination), { recursive: true })
  let previous
  try {
    previous = await readFile(destination, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (previous !== content) await writeFile(destination, content, 'utf8')
  console.log(`Extracted ${fileURLToPath(destination)} from ${fileURLToPath(sourceUrl)}`)
}
const metadataUrl = new URL('../.generated/recipe-provenance.json', import.meta.url)
await mkdir(new URL('.', metadataUrl), { recursive: true })
await writeFile(metadataUrl, JSON.stringify({
  reference: 'skills/vue-kit/references/tresjs.md',
  referenceSha256: sha256(source),
  generatedSources: generatedSources.map(({ body, sourceFence, ...entry }) => ({
    ...entry,
    sourceStartLine: source.slice(0, source.indexOf(sourceFence)).split('\n').length,
    sourceFenceSha256: sha256(sourceFence),
    sha256: sha256(body),
  })),
}, null, 2) + '\n')
