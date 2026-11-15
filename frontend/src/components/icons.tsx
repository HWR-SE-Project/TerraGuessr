interface IconProps {
  size?: number;
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function TemperatureIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z" />
    </svg>
  );
}

export function PrecipitationIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M8 16a4 4 0 0 1-1-7.87A5.5 5.5 0 0 1 17.5 9h.5a4 4 0 1 1 0 8H8Z" />
      <path d="M9 20.5 10 18M13 20.5 14 18M17 20.5 18 18" />
    </svg>
  );
}

export function HumidityIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M12 2.5s6 7 6 11.5a6 6 0 1 1-12 0C6 9.5 12 2.5 12 2.5Z" />
    </svg>
  );
}

export function WindIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M3 8h10.5a2.5 2.5 0 1 0-2.1-3.85" />
      <path d="M3 13h14.5a2.5 2.5 0 1 1-2.1 3.85" />
      <path d="M3 18h7.5a2 2 0 1 1-1.7 3" />
    </svg>
  );
}

export function PressureIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l3 2" />
      <path d="M9 2.5h6" />
    </svg>
  );
}

export function CompassIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.8 9.2-1.6 4.4-4.4 1.6 1.6-4.4Z" />
    </svg>
  );
}

export function UVIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.5 12H2.1M21.9 12h-2.4M6 6l1.7 1.7M16.3 16.3 18 18M6 18l1.7-1.7M16.3 7.7 18 6" />
    </svg>
  );
}

export function SunshineIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <circle cx="12" cy="9" r="4" />
      <path d="M12 2.5v1.6M19 9h1.6M4.4 9H3M17 4l-1.1 1.1M8 4 6.9 5.1" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function ClockIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
