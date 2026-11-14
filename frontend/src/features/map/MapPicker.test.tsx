import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAP_ATTRIBUTION, DEFAULT_TILE_URL, MapPicker } from './MapPicker';

interface ClickLike {
  latlng: { lat: number; lng: number };
}

interface DragEndLike {
  target: { getLatLng: () => { lat: number; lng: number } };
}

interface MarkerMockProps {
  position: [number, number];
  draggable?: boolean;
  eventHandlers?: { dragend?: (event: DragEndLike) => void };
}

const mocks = vi.hoisted(() => ({
  clickHandlers: [] as Array<{ click?: (event: ClickLike) => void }>,
  tileLayerProps: [] as Array<{ url: string; attribution?: string }>,
  markerProps: [] as Array<MarkerMockProps>,
}));

vi.mock('react-leaflet', () => {
  const MapContainer = ({ children }: { children?: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  );

  const TileLayer = ({ url, attribution }: { url: string; attribution?: string }) => {
    mocks.tileLayerProps.push({ url, attribution });
    return <div data-testid="tile-layer" data-url={url} data-attribution={attribution ?? ''} />;
  };

  const Marker = ({ position, draggable, eventHandlers }: MarkerMockProps) => {
    const [lat, lng] = position;
    mocks.markerProps.push({ position, draggable, eventHandlers });
    return (
      <div data-testid="marker" data-lat={lat} data-lon={lng} data-draggable={draggable ? 'true' : 'false'} />
    );
  };

  const useMapEvents = (handlers: { click?: (event: ClickLike) => void }) => {
    mocks.clickHandlers.push(handlers);
    return null;
  };

  return { MapContainer, TileLayer, Marker, useMapEvents };
});

describe('MapPicker', () => {
  beforeEach(() => {
    mocks.clickHandlers.length = 0;
    mocks.tileLayerProps.length = 0;
    mocks.markerProps.length = 0;
  });

  it('renders a map with the dev tile layer and no marker until a guess exists', () => {
    render(<MapPicker guess={null} onChange={vi.fn()} />);

    expect(screen.getByTestId('map-picker')).toBeInTheDocument();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toHaveAttribute('data-url', DEFAULT_TILE_URL);
    expect(screen.getByTestId('tile-layer')).toHaveAttribute(
      'data-attribution',
      DEFAULT_MAP_ATTRIBUTION,
    );
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
  });

  it('renders a draggable marker at the current guess', () => {
    render(<MapPicker guess={{ lat: 52.52, lon: 13.405 }} onChange={vi.fn()} />);

    const marker = screen.getByTestId('marker');
    expect(marker).toHaveAttribute('data-lat', '52.52');
    expect(marker).toHaveAttribute('data-lon', '13.405');
    expect(marker).toHaveAttribute('data-draggable', 'true');
  });

  it('emits {lat, lon} when the map is clicked', () => {
    const onChange = vi.fn();
    render(<MapPicker guess={null} onChange={onChange} />);

    mocks.clickHandlers.at(-1)?.click?.({ latlng: { lat: 48.8566, lng: 2.3522 } });

    expect(onChange).toHaveBeenCalledWith({ lat: 48.8566, lon: 2.3522 });
  });

  it('emits the updated {lat, lon} when the marker is dragged', () => {
    const onChange = vi.fn();
    render(<MapPicker guess={{ lat: 52.52, lon: 13.405 }} onChange={onChange} />);

    mocks.markerProps.at(-1)?.eventHandlers?.dragend?.({
      target: { getLatLng: () => ({ lat: 40.4168, lng: -3.7038 }) },
    });

    expect(onChange).toHaveBeenCalledWith({ lat: 40.4168, lon: -3.7038 });
  });
});
