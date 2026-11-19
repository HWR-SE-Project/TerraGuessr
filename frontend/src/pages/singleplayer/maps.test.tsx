import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GuessMap } from './GuessMap'
import { StreetViewViewer } from './StreetViewViewer'
import { loadGoogleMaps, onMapsAuthFailure } from './googleMaps'
vi.mock('./googleMaps', () => ({
  browserMapsKey: () => 'test-only-key',
  loadGoogleMaps: vi.fn(),
  onMapsAuthFailure: vi.fn(() => () => {}),
}))

type Handler = (...args: unknown[]) => void
const maps: FakeMap[] = []
const pins: FakeMarker[] = []
const lines: Record<string, unknown>[] = []
const panoramas: FakePanorama[] = []
class Events {
  handlers: Record<string, Handler> = {}
  addListener(name: string, handler: Handler) {
    this.handlers[name] = handler
    return { remove: vi.fn() }
  }
}
class FakeMap extends Events {
  readonly options: Record<string, unknown>
  fitBounds = vi.fn()
  setZoom = vi.fn()
  getZoom = () => 2
  constructor(_element: unknown, options: Record<string, unknown>) {
    super()
    this.options = options
    maps.push(this)
  }
}
class FakeMarker extends Events {
  readonly options: Record<string, unknown>
  setMap = vi.fn()
  setPosition = vi.fn()
  setDraggable = vi.fn()
  constructor(options: Record<string, unknown>) {
    super()
    this.options = options
    pins.push(this)
  }
}
class FakePanorama extends Events {
  readonly options: Record<string, unknown>
  status = 'LOADING'
  setVisible = vi.fn()
  setOptions = vi.fn()
  setPov = vi.fn()
  getStatus = () => this.status
  getPov = () => ({ heading: 45, pitch: 0 })
  getLinks = () => [{ pano: 'test-connected-street' }]
  getPano = () => 'test-only-panorama'
  focus = vi.fn()
  constructor(_element: unknown, options: Record<string, unknown>) {
    super()
    this.options = options
    panoramas.push(this)
  }
}
const sdk = {
  Map: FakeMap,
  Marker: FakeMarker,
  StreetViewPanorama: FakePanorama,
  StreetViewService: class {
    getPanorama = vi
      .fn()
      .mockResolvedValue({
        data: {
          location: { pano: 'test-only-panorama' },
          links: [{ pano: 'test-connected-street' }],
        },
      })
  },
  Polyline: class {
    setMap = vi.fn()
    constructor(options: Record<string, unknown>) {
      lines.push(options)
    }
  },
  LatLngBounds: class {
    extend = vi.fn()
  },
  ControlPosition: { LEFT_TOP: 1, LEFT_CENTER: 2 },
  SymbolPath: { CIRCLE: 1 },
  StreetViewStatus: { OK: 'OK' },
  event: {
    addListenerOnce: vi.fn(),
    trigger: vi.fn(),
    clearInstanceListeners: vi.fn(),
  },
}
beforeEach(() => {
  vi.clearAllMocks()
  maps.length = 0
  pins.length = 0
  lines.length = 0
  panoramas.length = 0
  vi.stubGlobal('google', { maps: sdk })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    },
  )
  vi.mocked(loadGoogleMaps).mockResolvedValue(
    sdk as unknown as typeof google.maps,
  )
  vi.mocked(onMapsAuthFailure).mockReturnValue(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('map and panorama controls (explicit SDK doubles, no imagery)', () => {
  it('places and moves a guess and cleans up event listeners', async () => {
    const change = vi.fn()
    const { rerender, unmount } = render(<GuessMap onChange={change} />)
    await waitFor(() => expect(maps).toHaveLength(1))
    act(() =>
      maps[0]!.handlers.click!({ latLng: { lat: () => 12, lng: () => 34 } }),
    )
    expect(change).toHaveBeenCalledWith({ lat: 12, lon: 34 })
    rerender(<GuessMap onChange={change} guess={{ lat: 12, lon: 34 }} />)
    await waitFor(() => expect(pins).toHaveLength(1))
    expect(pins[0]!.options.draggable).toBe(true)
    act(() =>
      pins[0]!.handlers.dragend!({ latLng: { lat: () => 13, lng: () => 35 } }),
    )
    expect(change).toHaveBeenLastCalledWith({ lat: 13, lon: 35 })
    unmount()
    expect(pins[0]!.setMap).toHaveBeenCalledWith(null)
    expect(sdk.event.clearInstanceListeners).toHaveBeenCalled()
  })
  it('reveals both locations and their geodesic line only in results and prevents selection', async () => {
    const change = vi.fn()
    render(
      <GuessMap
        interactive={false}
        onChange={change}
        results={[
          {
            roundId: 'fixture',
            number: 1,
            score: 1000,
            distanceKm: 3218.88,
            actual: { lat: 50, lon: 10 },
            guess: { lat: 10, lon: 20 },
          },
        ]}
      />,
    )
    await waitFor(() => expect(lines).toHaveLength(1))
    expect(pins).toHaveLength(2)
    expect(lines[0]!.geodesic).toBe(true)
    expect(maps[0]!.fitBounds).toHaveBeenCalled()
    act(() =>
      maps[0]!.handlers.click!({ latLng: { lat: () => 12, lng: () => 34 } }),
    )
    expect(change).not.toHaveBeenCalled()
  })
  it('shows a map loading error instead of a successful fake map', async () => {
    vi.mocked(loadGoogleMaps).mockRejectedValue(new Error('Map network failed'))
    render(<GuessMap />)
    await expect(screen.findByRole('alert')).resolves.toHaveTextContent(
      'Map network failed',
    )
    expect(maps).toHaveLength(0)
  })
  it('enables real panorama controls, gates readiness on provider status, and applies settings', async () => {
    const ready = vi.fn()
    const round = { id: 'test-round', number: 1, panoId: 'test-only-panorama' }
    const { rerender, unmount } = render(
      <StreetViewViewer round={round} onReady={ready} showCompass scrollZoom />,
    )
    await waitFor(() => expect(panoramas).toHaveLength(1))
    expect(ready).toHaveBeenLastCalledWith(false)
    expect(panoramas[0]!.options).toMatchObject({
      pano: 'test-only-panorama',
      linksControl: true,
      clickToGo: true,
      zoomControl: true,
      addressControl: false,
      showRoadLabels: false,
    })
    act(() => {
      panoramas[0]!.status = 'OK'
      panoramas[0]!.handlers.status_changed!()
    })
    expect(ready).toHaveBeenLastCalledWith(true)
    rerender(
      <StreetViewViewer
        round={round}
        onReady={ready}
        showCompass
        scrollZoom={false}
      />,
    )
    expect(panoramas[0]!.setOptions).toHaveBeenLastCalledWith({
      scrollwheel: false,
    })
    act(() => {
      panoramas[0]!.status = 'ZERO_RESULTS'
      panoramas[0]!.handlers.status_changed!()
    })
    expect(ready).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
    unmount()
    expect(panoramas[0]!.setVisible).toHaveBeenCalledWith(false)
  })
})

it('preserves the map instance and selected pin while a guess locks/unlocks', async () => {
  const change = vi.fn()
  const guess = { lat: 12, lon: 34 }
  const { rerender } = render(
    <GuessMap interactive onChange={change} guess={guess} />,
  )
  await waitFor(() => expect(pins).toHaveLength(1))
  rerender(<GuessMap interactive={false} onChange={change} guess={guess} />)
  await waitFor(() => expect(pins[0]!.setDraggable).toHaveBeenCalledWith(false))
  expect(maps).toHaveLength(1)
  act(() =>
    maps[0]!.handlers.click!({ latLng: { lat: () => 1, lng: () => 2 } }),
  )
  expect(change).not.toHaveBeenCalled()
  rerender(<GuessMap interactive onChange={change} guess={guess} />)
  await waitFor(() =>
    expect(pins[0]!.setDraggable).toHaveBeenLastCalledWith(true),
  )
  expect(maps).toHaveLength(1)
  expect(pins).toHaveLength(1)
})
