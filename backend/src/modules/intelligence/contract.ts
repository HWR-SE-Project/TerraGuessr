import { Type, type Static } from '@sinclair/typebox';

const nullableNumber = Type.Union([Type.Number(), Type.Null()]);
export const IntelligenceResponse = Type.Object(
  {
    fetchedAt: Type.String(),
    cached: Type.Boolean(),
    weather: Type.Union([
      Type.Object(
        {
          modelTime: Type.Union([Type.String(), Type.Null()]),
          temperatureC: nullableNumber,
          condition: Type.Union([
            Type.Literal('Clear sky'),
            Type.Literal('Mainly clear'),
            Type.Literal('Partly cloudy'),
            Type.Literal('Overcast'),
            Type.Literal('Fog'),
            Type.Literal('Drizzle'),
            Type.Literal('Freezing drizzle'),
            Type.Literal('Rain'),
            Type.Literal('Freezing rain'),
            Type.Literal('Snow'),
            Type.Literal('Snow grains'),
            Type.Literal('Rain showers'),
            Type.Literal('Snow showers'),
            Type.Literal('Thunderstorm'),
            Type.Null(),
          ]),
          windSpeedKmh: nullableNumber,
          windDirectionDeg: nullableNumber,
          humidityPct: nullableNumber,
          pressureHpa: nullableNumber,
          precipitationMm: nullableNumber,
          precipitationIntervalMinutes: nullableNumber,
          isDay: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
          dewPointC: Type.Optional(nullableNumber),
          cloudCoverPct: Type.Optional(nullableNumber),
          cloudLowPct: Type.Optional(nullableNumber),
          cloudMediumPct: Type.Optional(nullableNumber),
          cloudHighPct: Type.Optional(nullableNumber),
          fogPct: Type.Optional(nullableNumber),
          windGustKmh: Type.Optional(nullableNumber),
          uvIndex: Type.Optional(nullableNumber),
          uvIndexMax24h: Type.Optional(nullableNumber),
          tempMin24hC: Type.Optional(nullableNumber),
          tempMax24hC: Type.Optional(nullableNumber),
          precipitation24hMm: Type.Optional(nullableNumber),
          thunderProbabilityPct: Type.Optional(nullableNumber),
        },
        { additionalProperties: false },
      ),
      Type.Null(),
    ]),
    environment: Type.Object(
      {
        elevationM: nullableNumber,
        reliefM: nullableNumber,
        terrain: Type.Union([
          Type.Literal('Low relief'),
          Type.Literal('Rolling relief'),
          Type.Literal('High relief'),
          Type.Null(),
        ]),
        biome: Type.Null(),
        vegetation: Type.Null(),
      },
      { additionalProperties: false },
    ),
    climate: Type.Null(),
  },
  { additionalProperties: false },
);
export type GeographicIntelligence = Static<typeof IntelligenceResponse>;
