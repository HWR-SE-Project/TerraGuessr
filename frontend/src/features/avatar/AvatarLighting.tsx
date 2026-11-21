import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import type { Texture } from 'three'

/** Identical local lighting for the original explorer and the editor preview. */
export function AvatarLighting() {
  const scene = useThree(state => state.scene)
  const reflection = useRef<Texture | null>(null)
  useFrame(() => {
    if (scene.environment && reflection.current !== scene.environment) {
      reflection.current = scene.environment
      // Three r187's initial PMREM path registers source-disposal cleanup.
      reflection.current.pmremVersion = 0
    }
  })
  useEffect(() => () => { reflection.current?.dispose() }, [])
  return <>
    <hemisphereLight args={['#e7efff', '#394353', 0.7]} />
    <directionalLight position={[5, 5, 8]} color="#fff3df" intensity={2.1} />
    <directionalLight position={[-4, 2, 6]} color="#e0eaff" intensity={0.8} />
    <directionalLight position={[-3, 4, -5]} color="#b8d9ff" intensity={1.2} />
    <Environment resolution={64} frames={1} environmentIntensity={0.65}>
      <Lightformer position={[4, 5, 5]} rotation={[0, -Math.PI / 4, 0]} scale={[5, 5, 1]} intensity={2} color="#fff3df" />
      <Lightformer position={[-4, 2, 3]} rotation={[0, Math.PI / 4, 0]} scale={[4, 5, 1]} intensity={1} color="#e0eaff" />
      <Lightformer position={[0, 4, -4]} scale={[4, 3, 1]} intensity={1.5} color="#b8d9ff" />
    </Environment>
  </>
}
