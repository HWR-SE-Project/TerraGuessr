import type { LatLon } from '../../lib/contracts'
import { locationById } from './data'

// Resolves a round's panoId to a panorama position. In Phase 1 the panoId is a
// mock location id from the catalogue; in Phase 2 this becomes a real Google
// Street View panorama lookup (server-side, since it requires the server key).

export const geoMock = {
  async resolvePano(panoId: string): Promise<LatLon> {
    const location = locationById(panoId)
    return { lat: location.lat, lon: location.lon }
  },
}
