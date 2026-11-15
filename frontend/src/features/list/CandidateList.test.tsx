import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CandidateDTO } from '../../api/types';
import {
  CandidateList,
  EMPTY_CANDIDATES_MESSAGE,
  UNNAMED_CANDIDATE_LABEL,
  formatRegion,
} from './CandidateList';

const CANDIDATES: CandidateDTO[] = [
  { id: 'c1', name: 'Berlin', lat: 52.52, lon: 13.405, region: 'EUROPE' },
  { id: 'c2', name: 'Lima', lat: -12.0464, lon: -77.0428, region: 'SOUTH_AMERICA' },
  { id: 'c3', name: 'Osaka', lat: 34.6937, lon: 135.5023, region: 'ASIA' },
];

describe('CandidateList', () => {
  it('renders every candidate with its name and region', () => {
    render(<CandidateList candidates={CANDIDATES} onChange={vi.fn()} />);

    const items = screen.getAllByTestId('candidate-item');
    expect(items).toHaveLength(CANDIDATES.length);

    expect(screen.getByText('Berlin')).toBeInTheDocument();
    expect(screen.getByText('Europe')).toBeInTheDocument();
    expect(screen.getByText('Lima')).toBeInTheDocument();
    expect(screen.getByText('South America')).toBeInTheDocument();
    expect(screen.getByText('Osaka')).toBeInTheDocument();
    expect(screen.getByText('Asia')).toBeInTheDocument();
  });

  it('emits {lat, lon} for the clicked candidate (MapPicker contract)', () => {
    const onChange = vi.fn();
    render(<CandidateList candidates={CANDIDATES} onChange={onChange} />);

    fireEvent.click(screen.getByText('Lima'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ lat: -12.0464, lon: -77.0428 });
  });

  it('emits only the selected candidate, not its neighbours', () => {
    const onChange = vi.fn();
    render(<CandidateList candidates={CANDIDATES} onChange={onChange} />);

    fireEvent.click(screen.getByText('Osaka'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ lat: 34.6937, lon: 135.5023 });
  });

  it('shows an empty state when there are no candidates', () => {
    const onChange = vi.fn();
    render(<CandidateList candidates={[]} onChange={onChange} />);

    expect(screen.getByTestId('candidate-list-empty')).toHaveTextContent(EMPTY_CANDIDATES_MESSAGE);
    expect(screen.queryByTestId('candidate-item')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the controlled selection with aria-pressed', () => {
    render(<CandidateList candidates={CANDIDATES} onChange={vi.fn()} selectedId="c2" />);

    const items = screen.getAllByTestId('candidate-item');
    expect(items[0]).toHaveAttribute('aria-pressed', 'false');
    expect(items[1]).toHaveAttribute('aria-pressed', 'true');
    expect(items[2]).toHaveAttribute('aria-pressed', 'false');
  });

  it('falls back to a neutral label when a candidate has no name', () => {
    const unnamed: CandidateDTO[] = [
      { id: 'c4', name: null, lat: 0, lon: 0, region: 'AFRICA' },
    ];
    render(<CandidateList candidates={unnamed} onChange={vi.fn()} />);

    expect(screen.getByText(UNNAMED_CANDIDATE_LABEL)).toBeInTheDocument();
    expect(screen.getByText('Africa')).toBeInTheDocument();
  });

  it('formats region codes as readable labels', () => {
    expect(formatRegion('NORTH_AMERICA')).toBe('North America');
    expect(formatRegion('OCEANIA')).toBe('Oceania');
    expect(formatRegion('')).toBe('');
  });
});

