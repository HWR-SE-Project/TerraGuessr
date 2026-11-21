import { useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, Hud, Lightformer, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { useAvatar } from '../state/avatar'
import { useAvatarModel } from './avatar'
import { useHeadTracking } from './useHeadTracking'
import type { PointerState } from './hooks'
import type { HomeLayout } from './HomeScene'

function CharacterLighting() {
  return (
    <>
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
  )
}

export { CharacterLighting }

function Explorer({
  reducedMotion,
  pointerRef,
  layout,
  onFeetPixelY,
}: {
  reducedMotion: boolean
  pointerRef: React.RefObject<PointerState>
  layout: HomeLayout | null
  onFeetPixelY?: (y: number | null) => void
}) {
  const config = useAvatar()
  const { model, bounds, dimensions } = useAvatarModel(config, reducedMotion)
  useHeadTracking(model, dimensions.y, pointerRef, reducedMotion)
  const { size } = useThree()

  const { anchor, scale } = useMemo(() => {
    if (!layout) return { anchor: { x: 0, y: 0 }, scale: 0 }
    const scale = Math.min(layout.width / dimensions.x, layout.height / dimensions.y) * 0.94
    return {
      scale,
      anchor: {
        x: layout.left + layout.width / 2 - size.width / 2,
        y: size.height / 2 - layout.top - layout.height / 2,
      },
    }
  }, [layout, dimensions, size.width, size.height])

  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])
  const feetPixelY = layout ? layout.top + layout.height / 2 + (dimensions.y * scale) / 2 : null

  // Report the real rendered foot line for the planet apex to anchor to.
  useLayoutEffect(() => {
    onFeetPixelY?.(feetPixelY)
  }, [feetPixelY, onFeetPixelY])

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[0, 0, 1000]}
        near={0.1}
        far={2000}
        left={-size.width / 2}
        right={size.width / 2}
        top={size.height / 2}
        bottom={-size.height / 2}
      />
      <CharacterLighting />
      <group name="explorer-fit" position={[anchor.x, anchor.y, 0]} scale={scale}>
        <group name="explorer-motion">
          <primitive object={model} position={[-center.x, -center.y, -center.z]} dispose={null} />
        </group>
      </group>
    </>
  )
}

/** Separate orthographic pass so the explorer reads crisply above the planet. */
export function Character(props: Parameters<typeof Explorer>[0]) {
  return (
    <Hud>
      <Explorer {...props} />
    </Hud>
  )
}
