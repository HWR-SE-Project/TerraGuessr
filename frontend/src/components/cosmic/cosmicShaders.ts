/** Shared screen-space quiet zone follows the actual heading, including mobile wrapping. */
export const COSMIC_SAFE_ZONE = /* glsl */ `
  uniform vec2 uResolution;
  uniform vec4 uQuietRect;
  uniform vec4 uFaceRect;
  uniform vec4 uControlsRect;
  float rectDistance(vec2 uv, vec4 rect) {
    vec2 outside = max(rect.xy - uv, uv - rect.zw);
    return max(outside.x, outside.y);
  }
  float quietZone(vec2 uv) {
    return smoothstep(-0.025, 0.075, rectDistance(uv, uQuietRect));
  }
  float eventVisibility(vec2 uv) {
    return smoothstep(0.0, 0.018, rectDistance(uv, uQuietRect))
      * smoothstep(0.0, 0.018, rectDistance(uv, uFaceRect))
      * smoothstep(0.0, 0.018, rectDistance(uv, uControlsRect))
      * (1.0 - smoothstep(0.88, 0.96, uv.y));
  }
`

export const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;
  attribute vec3 aTint;
  attribute vec3 aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uDepth;
  uniform float uAspect;
  uniform vec2 uDriftAmplitude;
  uniform float uDriftSpeed;
  uniform vec2 uParallax;
  varying float vLight;
  varying vec3 vTint;
  void main() {
    vec3 p = position;
    // Individual velocities create visible travel, with a gentle curved component.
    float rate = (0.015 + aPhase.z * 0.025) * uDriftSpeed;
    vec2 direction = vec2(cos(aPhase.x), sin(aPhase.y));
    vec2 curve = vec2(sin(uTime * rate * 0.4 + aPhase.y) - sin(aPhase.y),
      cos(uTime * rate * 0.3 + aPhase.x) - cos(aPhase.x));
    p.xy += (direction * uTime * rate + curve * 0.18) * uDriftAmplitude;
    // Recycling is entirely beyond the visible frustum, including pointer travel.
    float halfHeight = (10.0 - p.z) * 0.2679491924;
    vec2 bounds = vec2(halfHeight * uAspect, halfHeight) * 1.3;
    p.xy = mod(p.xy + bounds, bounds * 2.0) - bounds;
    p.xy += uParallax;
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * uPixelRatio * uDepth / -viewPosition.z;
    float twinkle = sin(uTime * aPhase.z + aPhase.x) * 0.075
      + sin(uTime * aPhase.z * 0.37 + aPhase.y) * 0.035;
    float glimmer = pow(max(0.0, sin(uTime * 0.18 + aPhase.y)), 24.0) * 0.13;
    vLight = aBrightness * (1.0 + twinkle + glimmer);
    vTint = aTint;
  }
`

export const STAR_FRAGMENT = /* glsl */ `
  ${COSMIC_SAFE_ZONE}
  varying float vLight;
  varying vec3 vTint;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r2 = dot(p, p);
    // A tiny photographic core inside a very faint, wide halo. No bloom pass.
    float core = exp(-r2 * 125.0);
    float halo = exp(-r2 * 19.0) * 0.085;
    vec2 uv = gl_FragCoord.xy / uResolution;
    float restraint = mix(0.08, 1.0, quietZone(uv));
    restraint *= mix(0.09, 1.0, smoothstep(-0.015, 0.06, rectDistance(uv, uFaceRect)));
    restraint *= mix(0.2, 1.0, smoothstep(-0.015, 0.04, rectDistance(uv, uControlsRect)));
    restraint *= mix(0.36, 1.0, 1.0 - smoothstep(0.72, 0.87, uv.y));
    float alpha = (core + halo) * vLight * restraint;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(vTint, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export const NEBULA_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const NEBULA_FRAGMENT = /* glsl */ `
  ${COSMIC_SAFE_ZONE}
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uParallax;
  varying vec2 vUv;
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float cloud(vec2 p) {
    float n = 0.0, weight = 0.52;
    for (int i = 0; i < 4; i++) {
      n += weight * noise(p);
      p = mat2(1.6, -1.2, 1.2, 1.6) * p + 8.3;
      weight *= 0.48;
    }
    return n;
  }
  void main() {
    vec2 uv = vUv + uParallax;
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
    vec2 drift = vec2(uTime * 0.0007, uTime * 0.0003);
    float warp = cloud(p * 2.5 + drift);
    float detail = cloud(p * 5.0 + warp * 2.2 + drift);
    // Two asymmetric atmospheric banks leave a dark, calm opening for the hero.
    vec2 bankPosition = uv - 0.5;
    float leftBank = exp(-dot((bankPosition - vec2(-0.35, 0.02)) * vec2(3.0, 2.8),
      (bankPosition - vec2(-0.35, 0.02)) * vec2(3.0, 2.8)));
    float rightBank = exp(-dot((bankPosition - vec2(0.36, 0.2)) * vec2(3.3, 3.1),
      (bankPosition - vec2(0.36, 0.2)) * vec2(3.3, 3.1)));
    float veil = smoothstep(0.23, 0.79, detail) * (0.45 + warp * 0.65);
    float quiet = mix(0.4, 1.0, quietZone(vUv));
    float horizon = exp(-dot(p * vec2(1.1, 1.8) + vec2(0, 0.5),
      p * vec2(1.1, 1.8) + vec2(0, 0.5)));
    vec3 color = mix(vec3(0.0016, 0.003, 0.007), vec3(0.004, 0.009, 0.019), horizon);
    color += vec3(0.012, 0.021, 0.058) * leftBank * veil * quiet;
    color += vec3(0.027, 0.014, 0.061) * rightBank * veil * quiet;
    // The broad vignette keeps the periphery and navigation in deep navy.
    color *= 1.0 - 0.38 * smoothstep(0.25, 0.85, length(p * vec2(0.6, 1.0)));
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
