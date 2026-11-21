import type { LatLon } from '../../lib/contracts'
import { loadGoogleMaps } from '../../components/game/googleMaps'

// Resolves a round's panoId to a panorama position via the Street View JS
// API's own lookup-by-id (no server round-trip needed: panoId is already a
// real, non-secret Google Street View pano ID once the backend is wired up).

export const geoHttp = {
  async resolvePano(panoId: string): Promise<LatLon> {
    const maps = await loadGoogleMaps()
    const service = new maps.StreetViewService()
    return new Promise<LatLon>((resolve, reject) => {
      service.getPanorama({ pano: panoId }, (data, status) => {
        if (status === 'OK' && data?.location?.latLng) {
          resolve({ lat: data.location.latLng.lat(), lon: data.location.latLng.lng() })
        } else {
          reject(new Error('Panorama could not be resolved.'))
        }
      })
    })
  },
}
