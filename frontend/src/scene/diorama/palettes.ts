import type { Biome, SceneLighting, SceneWeather } from '../../lib/contracts'

export interface LightingPalette {
  skyGradient: string
  fogColor: string
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  sunColor: string
  sunIntensity: number
  sunPosition: [number, number, number]
  rimColor: string
  rimIntensity: number
  stars: boolean
  windowGlow: boolean
}

export const LIGHTING_PALETTES: Record<SceneLighting, LightingPalette> = {
  day: {
    skyGradient: 'linear-gradient(180deg, #3b74c4 0%, #7db2e8 52%, #cfe4f7 100%)',
    fogColor: '#a6ccf0',
    hemiSky: '#e8f4ff',
    hemiGround: '#546175',
    hemiIntensity: 1.05,
    sunColor: '#fff5e0',
    sunIntensity: 2.2,
    sunPosition: [8, 12, 7],
    rimColor: '#9fd0ff',
    rimIntensity: 0.7,
    stars: false,
    windowGlow: false,
  },
  dusk: {
    skyGradient: 'linear-gradient(180deg, #221d4f 0%, #7d4779 48%, #f09b6c 100%)',
    fogColor: '#b56e78',
    hemiSky: '#ffd6ba',
    hemiGround: '#32294d',
    hemiIntensity: 0.9,
    sunColor: '#ffb578',
    sunIntensity: 2.0,
    sunPosition: [10, 5.5, -4],
    rimColor: '#a78bfa',
    rimIntensity: 0.9,
    stars: true,
    windowGlow: true,
  },
  night: {
    skyGradient: 'linear-gradient(180deg, #070b1f 0%, #141f46 56%, #243668 100%)',
    fogColor: '#19254a',
    hemiSky: '#a8c8ff',
    hemiGround: '#1c2444',
    hemiIntensity: 0.95,
    sunColor: '#cfe2ff',
    sunIntensity: 1.65,
    sunPosition: [-7, 11, 6],
    rimColor: '#8ea8ff',
    rimIntensity: 1.0,
    stars: true,
    windowGlow: true,
  },
}

export function skyForWeather(lighting: SceneLighting, weather: SceneWeather): {
  gradient: string
  fogColor: string
  fogNear: number
  fogFar: number
} {
  const base = LIGHTING_PALETTES[lighting]
  if (weather === 'storm') {
    return {
      gradient:
        lighting === 'night'
          ? 'linear-gradient(180deg, #050712 0%, #151b31 60%, #242c44 100%)'
          : 'linear-gradient(180deg, #273046 0%, #44516c 55%, #67758e 100%)',
      fogColor: lighting === 'night' ? '#171f33' : '#53617a',
      fogNear: 12,
      fogFar: 28,
    }
  }
  if (weather === 'fog') {
    return {
      gradient:
        lighting === 'night'
          ? 'linear-gradient(180deg, #172038 0%, #2b3852 60%, #41506a 100%)'
          : 'linear-gradient(180deg, #8fa2b8 0%, #b7c6d4 55%, #d9e2ea 100%)',
      fogColor: lighting === 'night' ? '#303e59' : '#c4d1dd',
      fogNear: 7.5,
      fogFar: 21,
    }
  }
  if (weather === 'rain' || weather === 'cloudy' || weather === 'snow') {
    return {
      gradient:
        lighting === 'night'
          ? 'linear-gradient(180deg, #0c1229 0%, #1d2948 58%, #2d3c5c 100%)'
          : lighting === 'dusk'
            ? 'linear-gradient(180deg, #2a244c 0%, #6d5575 52%, #b78d89 100%)'
            : 'linear-gradient(180deg, #647f9e 0%, #9ab0c7 55%, #cbd8e5 100%)',
      fogColor: lighting === 'night' ? '#23304f' : lighting === 'dusk' ? '#8c6d7b' : '#b2c4d6',
      fogNear: 13,
      fogFar: 32,
    }
  }
  return {
    gradient: base.skyGradient,
    fogColor: base.fogColor,
    fogNear: 18,
    fogFar: 42,
  }
}

export interface BiomePalette {
  label: string
  ground: string
  snowyGround: string
  underside: string
  accentA: string
  accentB: string
  rock: string
}

export const BIOME_PALETTES: Record<Biome, BiomePalette> = {
  desert: {
    label: 'Desert',
    ground: '#e2b676',
    snowyGround: '#dcd7c9',
    underside: '#9e6844',
    accentA: '#5f9c62',
    accentB: '#c97f4c',
    rock: '#b9784e',
  },
  forest: {
    label: 'Forest',
    ground: '#5d9b61',
    snowyGround: '#dce7ef',
    underside: '#6b5344',
    accentA: '#2f6e49',
    accentB: '#3e8554',
    rock: '#78808a',
  },
  mountains: {
    label: 'Mountains',
    ground: '#7f8c7a',
    snowyGround: '#dbe6f0',
    underside: '#565c6b',
    accentA: '#6c7686',
    accentB: '#eef5fb',
    rock: '#636c7c',
  },
  tundra: {
    label: 'Tundra',
    ground: '#dbe8f4',
    snowyGround: '#e8f2fa',
    underside: '#687d96',
    accentA: '#9ed2f2',
    accentB: '#c5e2f6',
    rock: '#7e93aa',
  },
  coast: {
    label: 'Coast',
    ground: '#e6ca8a',
    snowyGround: '#dce6ee',
    underside: '#8a6d56',
    accentA: '#4ba363',
    accentB: '#3ab3c6',
    rock: '#868d94',
  },
  grasslands: {
    label: 'Grasslands',
    ground: '#9ec45b',
    snowyGround: '#dce7ef',
    underside: '#7a5f46',
    accentA: '#78a642',
    accentB: '#c7b854',
    rock: '#8d877a',
  },
  urban: {
    label: 'Urban',
    ground: '#7e8494',
    snowyGround: '#cdd6e0',
    underside: '#4b505e',
    accentA: '#9ba4b8',
    accentB: '#e0a96d',
    rock: '#5f6675',
  },
}
