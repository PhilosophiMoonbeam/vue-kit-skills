import { mkdir, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const reference = resolve(root, '../../skills/vue-kit/references/tresjs.md')
const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
const packageBytes = await Bun.file(resolve(root, 'package.json')).bytes()
const packageJson = JSON.parse(decoder.decode(packageBytes))
const output = resolve(root, 'dist/source')
const sha256 = content => new Bun.CryptoHasher('sha256').update(content).digest('hex')
await mkdir(output, { recursive: true })
const extraction = JSON.parse(decoder.decode(await Bun.file(resolve(root, '.generated/recipe-provenance.json')).bytes()))
const referenceBytes = await Bun.file(reference).bytes()
if (sha256(referenceBytes) !== extraction.referenceSha256) throw new Error('Reference changed after extraction; rerun the complete build.')

async function filesBelow(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix + entry.name
    if (entry.isDirectory()) files.push(...await filesBelow(resolve(directory, entry.name), `${name}/`))
    else if (entry.isFile()) files.push(name)
  }
  return files
}
async function stageSource(name, content, identity, digest = sha256(content)) {
  const destination = resolve(output, name)
  await mkdir(dirname(destination), { recursive: true })
  await Bun.write(destination, content)
  return { ...identity, name, sha256: digest, bytes: content.length, url: `/source/${name}` }
}
const authoredEvidenceSources = {
  'check-guide.ts': {
    kind: 'authored-check-guidance',
    referenceSections: [],
    note: 'Authored concise task guidance for the unchanged manual checks in lab-contract.ts; not a verbatim recipe, observed result or acceptance decision.',
  },
  'display-capture.ts': {
    kind: 'authored-permission-gated-display-capture',
    referenceSections: [],
    note: 'Browser-native user-selected display-stream frames, permissions and capture lifecycle; distinct from recipe canvas readback, full-page screenshots and hardware certification.',
  },
  'verification-sequence.ts': {
    kind: 'authored-automated-evidence-sequence',
    referenceSections: [],
    note: 'Scripted scene/control/resize/lifetime experiments with observed evidence and explicit review limits; not trusted pointer/keyboard input, OS preference changes or automatic human acceptance.',
  },
}
const sources = []
for (const name of await filesBelow(resolve(root, 'src'))) {
  const generated = extraction.generatedSources.find(entry => entry.name === name)
  const content = await Bun.file(resolve(root, 'src', name)).bytes()
  const digest = sha256(content)
  if (generated && generated.sha256 !== digest) throw new Error(`Generated source changed after extraction: ${name}`)
  sources.push(await stageSource(name, content, generated ?? authoredEvidenceSources[name] ?? {
    kind: name.startsWith('consumers/') ? 'authored-source-matched-diagnostic-consumer' : 'authored-lab-infrastructure',
    referenceSections: name.startsWith('consumers/') ? [
      'Picking, propagation, and selection', 'Assets: current loader API and ownership', 'Disposal, performance, and browser failure modes',
    ] : [],
    note: name.startsWith('consumers/') ? 'Authored diagnostic composition of the retained APIs, with real event/resource observations; not a verbatim guide fence and not a native-hardware pass.' : 'Lab code, not the retained recipe.',
  }, digest))
}
for (const name of ['scripts/extract-source.mjs', 'scripts/stage-source.mjs', 'server.mjs', 'package.json', 'vite.config.ts']) {
  const content = name === 'package.json' ? packageBytes : await Bun.file(resolve(root, name)).bytes()
  sources.push(await stageSource(name, content, { kind: 'authored-build-or-server-helper' }))
}
const lockfileBytes = await Bun.file(resolve(root, 'bun.lock')).bytes()
const lockfile = await stageSource('bun.lock', lockfileBytes, { kind: 'bun-dependency-lockfile' })
if (lockfile.sha256 !== extraction.lockfileSha256) throw new Error('Bun lockfile changed after extraction; rerun the complete build.')
sources.push(lockfile)
await Bun.write(resolve(output, 'tresjs.md'), referenceBytes)
await Bun.write(resolve(output, 'recipe-provenance.json'), `${JSON.stringify(extraction, null, 2)}\n`)

// Stage the vetted primary bytes offline; the receipt preserves their immutable upstream identity.
const assetRevision = '4995a638c96dbc94376d3d6164e70fee3ac7f7a2'
const assetBase = `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/${assetRevision}/Models/Box/`
const receiptBytes = await Bun.file(resolve(root, 'fixtures/source-provenance.json')).bytes()
const assetReceipt = JSON.parse(decoder.decode(receiptBytes))
const fixtureSources = new Map([['source-provenance.json', { content: receiptBytes }]])
if (assetReceipt.revision !== assetRevision) throw new Error('Vendored Box revision does not match the vetted primary source.')
const fixtureDirectory = resolve(root, 'dist/fixtures')
await mkdir(fixtureDirectory, { recursive: true })
const fixtures = []
for (const [name, primaryPath] of [
  ['Box.glb', 'glTF-Binary/Box.glb'],
  ['Box-LICENSE.md', 'LICENSE.md'],
  ['Box-metadata.json', 'metadata.json'],
  ['Box-README.md', 'README.md'],
]) {
  const primaryUrl = assetBase + primaryPath
  const receipt = assetReceipt.files.find(entry => entry.name === name && entry.primaryPath === primaryPath)
  if (!receipt || receipt.primaryUrl !== primaryUrl) throw new Error(`Missing immutable primary receipt for ${name}.`)
  const storedName = name === 'Box.glb' ? `${name}.base64` : name
  const storedBytes = await Bun.file(resolve(root, 'fixtures', storedName)).bytes()
  const bytes = name === 'Box.glb' ? Buffer.from(decoder.decode(storedBytes), 'base64') : storedBytes
  const gitBlobSha = new Bun.CryptoHasher('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
  const digest = sha256(bytes)
  if (bytes.length !== receipt.bytes || digest !== receipt.sha256 || gitBlobSha !== receipt.gitBlobSha) {
    throw new Error(`Vendored primary bytes do not match their source receipt: ${name}.`)
  }
  if (name === 'Box.glb') {
    if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) {
      throw new Error('The vendored primary Box is not a complete glTF 2 binary; refusing to stage a substitute.')
    }
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'))
    if (!gltf.meshes?.length || [...(gltf.buffers ?? []), ...(gltf.images ?? [])].some(entry => entry.uri && !entry.uri.startsWith('data:'))) {
      throw new Error('The primary Box is not the expected self-contained visible model; stage its real dependencies instead of fabricating any.')
    }
  }
  fixtureSources.set(storedName, { content: storedBytes, digest: bytes === storedBytes ? digest : sha256(storedBytes) })
  await Bun.write(resolve(fixtureDirectory, name), bytes)
  fixtures.push({ name, primaryUrl, revision: assetRevision, gitBlobSha, sha256: digest, bytes: bytes.length, url: `/fixtures/${name}` })
}
for (const name of await filesBelow(resolve(root, 'fixtures'))) {
  const source = fixtureSources.get(name)
  const content = source?.content ?? await Bun.file(resolve(root, 'fixtures', name)).bytes()
  sources.push(await stageSource(`fixtures/${name}`, content, {
    kind: name === 'source-provenance.json' ? 'primary-content-acquisition-receipt' : 'vendored-primary-asset-source',
    storage: name.endsWith('.base64') ? 'Base64 representation of unchanged primary binary bytes.' : 'Primary text bytes or their separately identified acquisition receipt.',
  }, source?.digest))
}
const asset = fixtures.find(fixture => fixture.name === 'Box.glb')
const assetMetadata = JSON.parse(decoder.decode(fixtureSources.get('Box-metadata.json').content))
const attribution = {
  title: 'Box', creator: assetMetadata.legal,
  source: `https://github.com/KhronosGroup/glTF-Sample-Assets/tree/${assetRevision}/Models/Box`,
  changes: 'No changes to the primary GLB, license, metadata or model README bytes. Only local route filenames differ.',
  routes: [
    { url: '/fixtures/Box.glb', status: 200, sha256: asset.sha256 },
    { url: '/fixtures/Box-delayed.glb', status: 200, sha256: asset.sha256, serverDelayMs: 3000, sourceFile: '/fixtures/Box.glb' },
    { url: '/fixtures/missing.glb', status: 404, note: 'Intentionally absent; no fake loader error and no network-abort claim.' },
  ],
}
const attributionBytes = new TextEncoder().encode(`${JSON.stringify(attribution, null, 2)}\n`)
await Bun.write(resolve(fixtureDirectory, 'attribution.json'), attributionBytes)
fixtures.push({ name: 'attribution.json', kind: 'authored-primary-source-attribution', sha256: sha256(attributionBytes), bytes: attributionBytes.length, url: '/fixtures/attribution.json' })

// Hash the actual built HTML/JS/CSS bytes served beside the source copies, not only input SFCs.
const servedBuild = []
for (const name of await filesBelow(resolve(root, 'dist'))) {
  if (name.startsWith('source/') || name.startsWith('fixtures/')) continue
  const content = await Bun.file(resolve(root, 'dist', name)).bytes()
  servedBuild.push({ name, sha256: sha256(content), bytes: content.length, url: `/${name}` })
}
await Bun.write(resolve(output, 'provenance.json'), `${JSON.stringify({
  schemaVersion: 2,
  reference: extraction.reference,
  referenceSha256: extraction.referenceSha256,
  referenceUrl: '/source/tresjs.md',
  transformation: 'All three archived WebGL SFC fences are copied verbatim and built with the current pins. The WebGPU SceneHost receives the archived guide’s documented onMounted replacement. The WebGPU SceneCanvas ports the archived fence to the dedicated Core entry and removes only its redundant pending-init retirement hook; the custom renderer factory and positive-size render guard remain. Authored diagnostics are not guide fences.',
  extraction,
  versions: { ...packageJson.dependencies, ...packageJson.devDependencies },
  lockfile,
  sources, fixtures, attribution, servedBuild,
  acceptance: 'These hashes establish byte identity, not GPU capability or correct visible output. Consult the scoped device-review receipts; a new collection does not assign manual verdicts or inherit hardware acceptance.',
}, null, 2)}\n`)
