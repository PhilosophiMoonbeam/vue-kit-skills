import { BufferGeometry, Material, Mesh, Object3D, Texture, WebGLRenderTarget } from 'three'
import { reportObservation, type Json } from '../lab-contract'

type Disposable = BufferGeometry | Material | Texture | WebGLRenderTarget
export interface ResourceEntry { kind: string; resource: Disposable }

// Native Three dispose events are observations, not proofs of driver memory reclamation.
export function observeResourceDisposals(entries: ResourceEntry[], owner: Json) {
  const unique = [...new Map(entries.map(entry => [entry.resource, entry])).values()]
  const records = unique.map(({ kind, resource }) => {
    const record = {
      kind,
      uuid: resource instanceof WebGLRenderTarget ? null : resource.uuid,
      targetTextureUuid: resource instanceof WebGLRenderTarget ? resource.texture.uuid : null,
      events: 0,
    }
    const listener = () => {
      record.events += 1
      reportObservation('resource', 'Native Three resource dispose event.', { owner, ...record })
    }
    resource.addEventListener('dispose', listener)
    return { resource, record, listener }
  })
  return {
    snapshot: () => records.map(({ record }) => ({ ...record })),
    stop: () => records.forEach(({ resource, listener }) => resource.removeEventListener('dispose', listener)),
  }
}

// Match the pinned Tres Object3D disposal utility: geometry, material(s), and map.
// Other texture slots require separate owners; this is not a universal GLTF disposer.
export function loaderOwnedResources(root: Object3D): ResourceEntry[] {
  const entries: ResourceEntry[] = []
  root.traverse(object => {
    if (!(object instanceof Mesh)) return
    if (object.geometry) entries.push({ kind: 'geometry', resource: object.geometry })
    const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      entries.push({ kind: 'material', resource: material })
      if ('map' in material && material.map instanceof Texture) entries.push({ kind: 'map', resource: material.map })
    }
  })
  return entries
}
