import { AppError } from '../../plugins/errors.js';

export type PanoramaErrorCode =
  | 'MISSING_SERVER_KEY'
  | 'PROVIDER_NETWORK_ERROR'
  | 'PROVIDER_INVALID_RESPONSE'
  | 'PROVIDER_KEY_INVALID'
  | 'PROVIDER_API_DISABLED'
  | 'PROVIDER_BILLING_DISABLED'
  | 'PROVIDER_QUOTA_EXCEEDED'
  | 'PROVIDER_ACCESS_DENIED'
  | 'PANORAMA_UNAVAILABLE'
  | 'WEATHER_UNAVAILABLE';

export class PanoramaError extends AppError {
  constructor(
    readonly reason: string,
    code: PanoramaErrorCode = 'PANORAMA_UNAVAILABLE',
  ) {
    super(503, reason, code);
  }
}

/** Classify Google diagnostics without returning its response text or key. */
export function providerFailure(
  status: string | undefined,
  message = '',
): PanoramaError {
  const details = message.toLowerCase();
  if (status === 'OVER_QUERY_LIMIT' || status === 'OVER_DAILY_LIMIT') {
    return new PanoramaError(
      'Google Street View quota is exhausted. Check the project quota and billing limits, then retry.',
      'PROVIDER_QUOTA_EXCEEDED',
    );
  }
  if (details.includes('billing')) {
    return new PanoramaError(
      'Billing is not enabled for the Google Maps project. Enable billing before starting a game.',
      'PROVIDER_BILLING_DISABLED',
    );
  }
  if (
    details.includes('api key') &&
    (details.includes('invalid') || details.includes('expired'))
  ) {
    return new PanoramaError(
      'The server Google Maps key is invalid or expired. Replace GOOGLE_MAPS_SERVER_API_KEY and restart the backend.',
      'PROVIDER_KEY_INVALID',
    );
  }
  if (
    details.includes('not activated') ||
    details.includes('not enabled') ||
    details.includes('not authorized to use this api')
  ) {
    return new PanoramaError(
      'Street View Static API is not enabled or allowed for the server key. Enable the API and check API restrictions.',
      'PROVIDER_API_DISABLED',
    );
  }
  if (status === 'REQUEST_DENIED') {
    return new PanoramaError(
      'Google denied the server Street View request. Check the server key, its IP/API restrictions, and project billing.',
      'PROVIDER_ACCESS_DENIED',
    );
  }
  if (status === 'ZERO_RESULTS' || status === 'NOT_FOUND') {
    return new PanoramaError(
      'This Street View panorama is no longer available. Retry loading the location.',
      'PANORAMA_UNAVAILABLE',
    );
  }
  return new PanoramaError(
    'Google Street View returned an invalid or unavailable response. Please retry.',
    'PROVIDER_INVALID_RESPONSE',
  );
}
