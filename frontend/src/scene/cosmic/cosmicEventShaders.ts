import { COSMIC_SAFE_ZONE } from './cosmicShaders'

export const TRAIL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const TRAIL_FRAGMENT = /* glsl */ `
  ${COSMIC_SAFE_ZONE}
  uniform float uOpacity;
  uniform float uAspect;
  uniform float uComet;
  uniform vec3 uTint;
  varying vec2 vUv;
  void main() {
    float behind = 1.0 - vUv.x;
    float spread = mix(0.05, 0.075 + behind * 0.22, uComet);
    float tail = exp(-pow((vUv.y - 0.5) / spread, 2.0) * 2.0)
      * pow(vUv.x, 1.6) * smoothstep(0.0, 0.2, vUv.x)
      * (1.0 - smoothstep(0.91, 0.99, vUv.x));
    vec2 nucleus = vec2((vUv.x - 0.94) * uAspect, vUv.y - 0.5);
    float r2 = dot(nucleus, nucleus);
    float core = exp(-r2 * 320.0);
    float halo = exp(-r2 * 35.0) * 0.35;
    // The comet has a cool ion veil and a thinner, warmer dust tail.
    float filament = exp(-pow((vUv.y - 0.5 - behind * behind * 0.07) / 0.025, 2.0))
      * pow(vUv.x, 1.8) * (1.0 - smoothstep(0.9, 0.99, vUv.x));
    float light = tail * mix(0.65, 0.48, uComet) + core + halo + filament * uComet * 0.18;
    vec3 color = mix(uTint, vec3(1.0, 0.94, 0.8), core * 0.7 + filament * uComet * 0.18);
    float alpha = light * uOpacity * eventVisibility(gl_FragCoord.xy / uResolution);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
export const DUST_VERTEX = /* glsl */ `
  uniform float uAge;
  uniform float uLength;
  uniform float uWidth;
  uniform float uPixelRatio;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float life = fract(position.x + uAge * 0.14);
    vec3 p = vec3(-life * uLength, (position.y - 0.5) * uWidth * (0.2 + life), 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (1.4 + position.z * 2.0) * uPixelRatio;
    vAlpha = sin(life * 3.14159265) * (1.0 - life) * uOpacity * 0.24;
  }
`
export const DUST_FRAGMENT = /* glsl */ `
  ${COSMIC_SAFE_ZONE}
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float alpha = exp(-dot(p, p) * 22.0) * vAlpha
      * eventVisibility(gl_FragCoord.xy / uResolution);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(0.64, 0.8, 1.0, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
export const SATELLITE_VERTEX = /* glsl */ `
  attribute vec3 color;
  attribute float aSurface;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vSurface;
  void main() {
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-p.xyz);
    vColor = color;
    vUv = uv;
    vSurface = aSurface;
    gl_Position = projectionMatrix * p;
  }
`
export const SATELLITE_FRAGMENT = /* glsl */ `
  ${COSMIC_SAFE_ZONE}
  uniform float uOpacity;
  uniform float uAge;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vSurface;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 light = normalize(vec3(0.5, 0.7, 1.0));
    float diffuse = max(0.0, dot(n, light));
    float specular = pow(max(0.0, dot(n, normalize(light + vView))), 32.0);
    vec3 color = vColor * (0.38 + diffuse * 0.75) + vec3(0.48, 0.6, 0.8) * specular * 0.55;
    if (vSurface > 0.5 && vSurface < 1.5) {
      vec2 cell = abs(fract(vUv * vec2(4.0, 3.0)) - 0.5);
      float grid = smoothstep(0.42, 0.49, max(cell.x, cell.y));
      color = mix(color, vec3(0.24, 0.37, 0.53), grid * 0.7);
    }
    if (vSurface > 1.5) color = vColor * (0.65 + 0.2 * sin(uAge * 2.0));
    float alpha = uOpacity * eventVisibility(gl_FragCoord.xy / uResolution);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
