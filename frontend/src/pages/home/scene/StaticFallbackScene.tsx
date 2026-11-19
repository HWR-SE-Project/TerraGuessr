import earth from '../../../assets/home/official/earth-horizon.webp'
import character from '../../../assets/home/official/explorer.webp'

/**
 * Flat-image composition — identical to the pre-3D design. Used while the
 * 3D scene chunk is still downloading, and as the permanent view when WebGL
 * isn't available.
 */
export function StaticFallbackScene() {
  return (
    <>
      <div className="th-earth" aria-hidden="true">
        <img src={earth} alt="" fetchPriority="high" />
      </div>
      <img
        src={character}
        className="th-character-static"
        alt=""
        aria-hidden="true"
        width="200"
        height="300"
        fetchPriority="high"
      />
    </>
  )
}
