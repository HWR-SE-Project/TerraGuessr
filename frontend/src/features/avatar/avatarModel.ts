import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

/** Measure actual skinned vertices over the idle cycle, including outlines.
 * Only the hierarchy/skeleton is cloned; cached geometry, materials and maps stay shared. */
export function prepareModel(source: THREE.Group, clips: THREE.AnimationClip[]) {
  const model = clone(source)
  // SkeletonUtils clones a skeleton for every mesh, even when the GLB shares
  // one skin. Reuse that cloned skin so 18 meshes need only one bone texture.
  const sharedSkeletons = new Map<THREE.Skeleton, THREE.Skeleton>()
  model.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh)) return
    const original = source.getObjectByName(node.name)
    if (!(original instanceof THREE.SkinnedMesh)) return
    const shared = sharedSkeletons.get(original.skeleton)
    if (shared) node.skeleton = shared
    else sharedSkeletons.set(original.skeleton, node.skeleton)
  })
  const idle = clips.find((clip) => /^idle$/i.test(clip.name))
  const bounds = new THREE.Box3()
  const measure = () => {
    model.updateMatrixWorld(true)
    model.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh) node.skeleton.update()
    })
    bounds.union(new THREE.Box3().setFromObject(model, true))
  }
  if (idle) {
    const mixer = new THREE.AnimationMixer(model)
    mixer.clipAction(idle).play()
    for (let sample = 0; sample <= 24; sample++) {
      mixer.setTime((sample / 24) * idle.duration)
      measure()
    }
    mixer.stopAllAction()
    mixer.uncacheRoot(model)
  } else measure()
  return { model, idle, bounds, dimensions: bounds.getSize(new THREE.Vector3()) }
}

