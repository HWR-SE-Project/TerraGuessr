import { AvatarLighting } from '../../features/avatar/AvatarLighting'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Hud, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { PointerState } from '../hooks'
import { useHeadTracking } from './useHeadTracking'
import { useAvatarModel } from '../../features/avatar/useAvatarModel'
import { useSavedAvatar } from '../../features/avatar/avatarConfigService'
import type { HomeLayout } from './useHomeLayout'

export type CharacterStatus = 'loading' | 'ready' | 'error'


function Explorer({ reducedMotion, pointerRef, onStatus, onFeetPixelY, layout }: {
  reducedMotion: boolean
  layout: HomeLayout | null
  pointerRef: React.RefObject<PointerState>
  onStatus: (status: CharacterStatus) => void
  /** Reports the character's sole contact line (bottom of its animated bounding
   * box), in CSS pixels measured from the top of the canvas — the real
   * rendered foot position, not a DOM container's edge — so the planet in the
   * main scene can be anchored to where the feet actually are. */
  onFeetPixelY?: (y: number | null) => void
}) {
  const config = useSavedAvatar()
  const { model, bounds, dimensions } = useAvatarModel(config, reducedMotion)
  useHeadTracking(model, dimensions.y, pointerRef, reducedMotion)
  const { size, invalidate } = useThree()
  const scale = layout ? Math.min(layout.width / dimensions.x, layout.height / dimensions.y) * 0.94 : 0
  const anchor = {
    x: layout ? layout.left + layout.width / 2 - size.width / 2 : 0,
    y: layout ? size.height / 2 - layout.top - layout.height / 2 : 0,
    scale,
  }
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])

  useLayoutEffect(() => {
    onFeetPixelY?.(layout ? layout.top + layout.height / 2 + dimensions.y * scale / 2 : null)
    invalidate()
  }, [layout, scale, dimensions.y, onFeetPixelY, invalidate])

  useEffect(() => {
    onStatus('ready')
    invalidate()
  }, [onStatus, invalidate])

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 1000]} near={0.1} far={2000}
        left={-size.width / 2} right={size.width / 2} top={size.height / 2} bottom={-size.height / 2} />
      <AvatarLighting />
      <group name="home-explorer-fit" position={[anchor.x, anchor.y, 0]} scale={anchor.scale}>
        <group name="home-explorer-motion">
          <primitive object={model} position={[-center.x, -center.y, -center.z]} dispose={null} />
        </group>
      </group>
    </>
  )
}

/** Separate depth pass in the existing WebGL context: a human-scale explorer
 * sits above the cinematic Earth without intersecting its huge mesh. */
export function CharacterModel(props: Parameters<typeof Explorer>[0]) {
  return <Hud><Explorer {...props} /></Hud>
}
