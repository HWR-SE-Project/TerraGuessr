import type { RoundScene } from '../../lib/contracts'

/**
 * Pure R04-safe explorer quips derived strictly from coarse weather, wind,
 * temperature, lighting, and biome cues — never from place names or coordinates.
 */
export function quipsForScene(scene: RoundScene): string[] {
  const lines: string[] = []

  if (scene.weather === 'storm') {
    lines.push('Whoa, thunder! Look at the rain splashing off the ground.')
  } else if (scene.weather === 'snow') {
    lines.push('Fresh snow falling all around — definitely bundle-up weather!')
  } else if (scene.weather === 'rain') {
    lines.push('Steady rain out here. I can see ripples beside my boots.')
  } else if (scene.weather === 'fog') {
    lines.push('Thick fog today — I can barely see across the island.')
  } else if (scene.weather === 'cloudy') {
    lines.push('Overcast skies overhead, keeping the sun tucked away.')
  } else {
    lines.push('Wide open skies — great visibility in every direction.')
  }

  if (scene.temperatureBand === 'freezing') {
    lines.push('Brr! My teeth are chattering — it is freezing out here.')
  } else if (scene.temperatureBand === 'cold') {
    lines.push('Crisp and chilly air today. Definitely jacket weather.')
  } else if (scene.temperatureBand === 'hot') {
    lines.push('Phew, it is scorching! Anyone got cold water?')
  } else if (scene.temperatureBand === 'warm') {
    lines.push('Nice and warm out here — feels great to explore.')
  }

  if (scene.windBand === 'windy') {
    lines.push('Hold onto your hat — strong gusts are blowing through!')
  } else if (scene.windBand === 'breezy') {
    lines.push('A steady breeze is keeping the air moving.')
  }

  if (scene.lighting === 'night') {
    lines.push('Starry skies above — it is nighttime here right now.')
  } else if (scene.lighting === 'dusk') {
    lines.push('Golden hour light — either sunrise or sunset on this side of Earth.')
  }

  const biomeQuip: Record<RoundScene['biome'], string> = {
    desert: 'Dry sands and tough plants — rain feels like a rare guest here.',
    forest: 'Surrounded by tall trees and shady woodland trails.',
    mountains: 'Steep peaks rising up nearby — check the elevation clues!',
    tundra: 'Frosty, windswept ground with hardly a tall tree in sight.',
    coast: 'I can hear waves lapping along the shoreline nearby.',
    grasslands: 'Open plains stretching out under a big sky.',
    urban: 'Busy blocks and rooftops all around — definitely a built-up area.',
  }
  lines.push(biomeQuip[scene.biome])

  return lines
}
