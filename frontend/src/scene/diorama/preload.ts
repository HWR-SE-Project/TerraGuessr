let dioramaModule: Promise<typeof import('./BiomeDiorama')> | null = null

/** Idempotently preload the lazy 3D BiomeDiorama chunk and its GLB avatar asset. */
export function preloadBiomeDiorama(): Promise<typeof import('./BiomeDiorama')> {
  dioramaModule ??= import('./BiomeDiorama')
  return dioramaModule
}
