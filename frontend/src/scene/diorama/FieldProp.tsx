import type { Activity } from './fieldActivity'

export function FieldProp({ activity }: { activity: Activity }) {
  if (activity === 'ripple') {
    return (
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.17, 0.19, 28]} />
        <meshBasicMaterial color="#c5eaff" transparent opacity={0.65} depthWrite={false} />
      </mesh>
    )
  }
  if (activity === 'leaf') {
    return (
      <mesh scale={[1, 0.28, 0.5]}>
        <octahedronGeometry args={[0.12]} />
        <meshStandardMaterial color="#d39947" />
      </mesh>
    )
  }
  return (
    <mesh>
      <icosahedronGeometry args={[0.12, 1]} />
      <meshStandardMaterial color="#f4fbff" flatShading />
    </mesh>
  )
}
