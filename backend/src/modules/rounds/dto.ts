/**
 * Round response DTO (R04). This file is the ONLY place a round response is
 * built. Its input type carries no actual-location coordinate fields, so a
 * `RoundView` structurally cannot leak `actualLat`/`actualLon`.
 */

import type { AdditionalDataAccess, RoundView } from '../../contracts/rounds.js';
import type { Difficulty, SelectionMode } from '../../domain/selection.js';

/** A list-mode candidate as exposed to the client (R07). */
export interface RoundCandidate {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  region: string;
}

/** The round's own persisted metadata — deliberately coordinate-free. */
export interface RoundMeta {
  roundId: string;
  roundNumber: number;
  attemptsTotal: number;
  difficulty: Difficulty;
  selectionMode: SelectionMode;
  additionalData: AdditionalDataAccess;
}

/** Weather values exposed on the round (R03/R06). */
export interface RoundWeather {
  temperatureC: number;
  precipitationMm: number;
  humidityPct: number;
  windSpeedKmh: number;
  airPressureHpa?: number | null;
  windDirectionDeg?: number | null;
  uvIndex?: number | null;
  sunshineDurationSeconds?: number | null;
  localTime?: string | null;
}

/** Everything the DTO needs to build a round response. */
export interface RoundViewInput {
  round: RoundMeta;
  weather: RoundWeather;
  /** Present only for list mode; omitted entirely for map mode. */
  candidates?: readonly RoundCandidate[];
}

/** Build the round response. `candidates` is attached only when provided. */
export function toRoundView(input: RoundViewInput): RoundView {
  const view: RoundView = {
    roundId: input.round.roundId,
    roundNumber: input.round.roundNumber,
    attemptsTotal: input.round.attemptsTotal,
    difficulty: input.round.difficulty,
    selectionMode: input.round.selectionMode,
    weather: {
      temperatureC: input.weather.temperatureC,
      precipitationMm: input.weather.precipitationMm,
      humidityPct: input.weather.humidityPct,
      windSpeedKmh: input.weather.windSpeedKmh,
      airPressureHpa: input.weather.airPressureHpa ?? null,
      windDirectionDeg: input.weather.windDirectionDeg ?? null,
      uvIndex: input.round.additionalData.unlocked ? input.weather.uvIndex ?? null : null,
      sunshineDurationSeconds: input.round.additionalData.unlocked ? input.weather.sunshineDurationSeconds ?? null : null,
      localTime: input.round.additionalData.unlocked ? input.weather.localTime ?? null : null,
    },
    additionalData: input.round.additionalData,
  };

  if (input.candidates !== undefined) {
    view.candidates = input.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      lat: candidate.lat,
      lon: candidate.lon,
      region: candidate.region,
    }));
  }

  return view;
}
