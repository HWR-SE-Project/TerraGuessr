import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { PointerState } from '../hooks'

const MAX_YAW = Math.PI / 6
const MAX_PITCH = Math.PI / 12

interface BoneOffsetScratch {
  euler: THREE.Euler
  rootRotation: THREE.Quaternion
  inverseRoot: THREE.Quaternion
  parentRotation: THREE.Quaternion
  worldOffset: THREE.Quaternion
  localOffset: THREE.Quaternion
}

function applyBoneOffset(bone: THREE.Bone, weight: number, yaw: number, pitch: number, scratch: BoneOffsetScratch) {
  scratch.euler.set(pitch * weight, yaw * weight, 0, 'YXZ')
  scratch.worldOffset.setFromEuler(scratch.euler).premultiply(scratch.rootRotation).multiply(scratch.inverseRoot)
  bone.parent!.getWorldQuaternion(scratch.parentRotation)
  scratch.localOffset.copy(scratch.parentRotation).invert().multiply(scratch.worldOffset).multiply(scratch.parentRotation)
  bone.quaternion.premultiply(scratch.localOffset)
  bone.updateWorldMatrix(false, true)
}

/** Add camera-aware gaze to this GLB's actual head/neck rig. The neck's bind
 * rotation is about -60° around X, so adding local Euler Y directly is wrong. */
export function useHeadTracking(model: THREE.Object3D, height: number, pointerRef: React.RefObject<PointerState>, reducedMotion: boolean) {
  const { camera, gl, size } = useThree()
  const viewport = useRef({ left: 0, top: 0, width: 1, height: 1 })
  const angles = useRef({ yaw: 0, pitch: 0 })
  const rig = useMemo(() => {
    const head = model.getObjectByName('Head_06')
    const neck = model.getObjectByName('Neck_05')
    if (!(head instanceof THREE.Bone) || !(neck instanceof THREE.Bone)) return null
    return {
      head, neck,
      headBase: head.quaternion.clone(), neckBase: neck.quaternion.clone(),
      ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(),
      eye: new THREE.Vector3(), eyeOffset: new THREE.Vector3(),
      target: new THREE.Vector3(), normal: new THREE.Vector3(), direction: new THREE.Vector3(),
      rootRotation: new THREE.Quaternion(), inverseRoot: new THREE.Quaternion(),
      parentRotation: new THREE.Quaternion(), worldOffset: new THREE.Quaternion(),
      localOffset: new THREE.Quaternion(), euler: new THREE.Euler(0, 0, 0, 'YXZ'),
    }
  }, [model])

  useLayoutEffect(() => {
    const update = () => {
      const rect = gl.domElement.getBoundingClientRect()
      Object.assign(viewport.current, { left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [gl, size.width, size.height])

  // Restore the previous authored pose before Drei's mixer runs (priority 0).
  // This prevents additive feedback, including for bones with no animation track.
  useFrame(() => {
    if (!rig) return
    rig.head.quaternion.copy(rig.headBase)
    rig.neck.quaternion.copy(rig.neckBase)
  }, -0.5)

  useFrame((_, delta) => {
    if (!rig) return
    rig.headBase.copy(rig.head.quaternion)
    rig.neckBase.copy(rig.neck.quaternion)
    let yaw = 0
    let pitch = 0
    if (!reducedMotion && pointerRef.current.active) {
      const pointer = pointerRef.current
      const rect = viewport.current
      rig.ndc.set(((pointer.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((pointer.clientY - rect.top) / rect.height) * 2)
      model.updateWorldMatrix(true, true)
      rig.head.getWorldPosition(rig.eye)
      model.getWorldQuaternion(rig.rootRotation)
      rig.inverseRoot.copy(rig.rootRotation).invert()
      // Head_06 pivots at the base of the skull. Aim from eye height above it,
      // rather than from the neck; all offsets follow the actual model scale.
      const worldScale = model.getWorldScale(rig.direction).y
      rig.eyeOffset.set(0, height * 0.24 * worldScale, 0).applyQuaternion(rig.rootRotation)
      rig.eye.add(rig.eyeOffset)
      camera.getWorldDirection(rig.normal)
      rig.target.copy(rig.normal).multiplyScalar(-height * worldScale * 1.35).add(rig.eye)
      rig.plane.setFromNormalAndCoplanarPoint(rig.normal, rig.target)
      rig.ray.setFromCamera(rig.ndc, camera)
      if (rig.ray.ray.intersectPlane(rig.plane, rig.target)) {
        rig.direction.copy(rig.target).sub(rig.eye).applyQuaternion(rig.inverseRoot)
        yaw = THREE.MathUtils.clamp(Math.atan2(rig.direction.x, rig.direction.z), -MAX_YAW, MAX_YAW)
        pitch = THREE.MathUtils.clamp(-Math.atan2(rig.direction.y, Math.hypot(rig.direction.x, rig.direction.z)), -MAX_PITCH, MAX_PITCH)
      }
    }
    const dt = Math.min(delta, 0.1)
    const gaze = angles.current
    gaze.yaw = reducedMotion ? 0 : THREE.MathUtils.damp(gaze.yaw, yaw, 6, dt)
    gaze.pitch = reducedMotion ? 0 : THREE.MathUtils.damp(gaze.pitch, pitch, 6, dt)
    model.getWorldQuaternion(rig.rootRotation)
    rig.inverseRoot.copy(rig.rootRotation).invert()
    // Share a small part of the turn with the neck. Convert each world-space
    // offset into the bone's animated parent frame before composing it.
    applyBoneOffset(rig.neck, 0.2, gaze.yaw, gaze.pitch, rig)
    applyBoneOffset(rig.head, 0.8, gaze.yaw, gaze.pitch, rig)
  }, 0.5) // After animation, before Hud's render pass at priority 1.
}
