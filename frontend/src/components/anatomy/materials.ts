import * as THREE from 'three';

const NOISE = /* glsl */ `
  float h3(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;

export interface TissueOptions {
  color: number;
  /** Strength of the surface relief. */
  bump?: number;
  /** Spatial frequency of the relief, in cycles per body unit. */
  freq?: number;
  /** 0 = soft mottling, 1 = folded ridges (brain gyri). */
  ridge?: number;
  /** How much the relief darkens the crevices. */
  cavity?: number;
  /** Fine striations along y (0..1), for airway rings or cerebellar folia. */
  rings?: number;
  roughness?: number;
  clearcoat?: number;
  opacity?: number;
  emissive?: number;
  emissiveIntensity?: number;
  side?: THREE.Side;
}

/**
 * A wet-tissue physical material with procedural relief: mottling for the
 * liver and lungs, ridged folds for the brain, rings for the airways.
 */
export function tissue(o: TissueOptions) {
  const m = new THREE.MeshPhysicalMaterial({
    color: o.color,
    roughness: o.roughness ?? 0.48,
    metalness: 0.0,
    clearcoat: o.clearcoat ?? 0.55,
    clearcoatRoughness: 0.35,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xffd6d6),
    transparent: (o.opacity ?? 1) < 1,
    opacity: o.opacity ?? 1,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 0.2,
    side: o.side ?? THREE.FrontSide,
  });
  const u = {
    uBump: { value: o.bump ?? 0.25 },
    uFreq: { value: o.freq ?? 40 },
    uRidge: { value: o.ridge ?? 0 },
    uCavity: { value: o.cavity ?? 0.25 },
    uRings: { value: o.rings ?? 0 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTisP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTisP = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTisP; uniform float uBump; uniform float uFreq; uniform float uRidge; uniform float uCavity; uniform float uRings;
        ${NOISE}
        float tisPat(vec3 q) {
          float n = fbm3(q);
          if (uRidge > 0.0) { float r = 1.0 - abs(2.0 * fbm3(q * 0.55 + 3.1) - 1.0); n = mix(n, smoothstep(0.25, 0.95, r), uRidge); }
          if (uRings > 0.0) { n = mix(n, 0.5 + 0.5 * sin(q.y * 9.0 + n * 2.0), uRings); }
          return n;
        }`
      )
      .replace('#include <color_fragment>', '#include <color_fragment>\n  float tisV = tisPat(vTisP * uFreq);\n  diffuseColor.rgb *= mix(1.0 - uCavity, 1.0 + uCavity * 0.25, tisV);')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec3 q = vTisP * uFreq; float e = 0.12;
          vec3 gr = vec3(tisPat(q + vec3(e, 0, 0)) - tisV, tisPat(q + vec3(0, e, 0)) - tisV, tisPat(q + vec3(0, 0, e)) - tisV) / e;
          normal = normalize(normal - uBump * (gr - dot(gr, normal) * normal));
        }`
      );
  };
  m.customProgramCacheKey = () => `tissue-${o.ridge ?? 0}-${o.rings ?? 0}`;
  return m;
}

/* ------------------------------------------------------------------ */

const shellVertex = /* glsl */ `
  varying vec3 vObj; varying vec3 vWorld; varying vec3 vN; varying vec3 vView;
  void main() {
    vObj = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/** Skin: glassy x-ray shell, or (uSolid = 1) a lit, opaque skin surface. */
export function skinMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: shellVertex,
    fragmentShader: /* glsl */ `
      uniform float uGravity; uniform vec3 uRim; uniform vec3 uBase; uniform float uAlpha; uniform float uSolid; uniform vec3 uTone; uniform vec3 uLight;
      varying vec3 vObj; varying vec3 vWorld; varying vec3 vN; varying vec3 vView;
      ${NOISE}
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(vView);
        float h = clamp((vObj.y + 2.0) / 3.8, 0.0, 1.0);
        float centre = mix(0.80, 0.20, uGravity);
        float head = smoothstep(centre, 1.0, h) * (1.0 - uGravity * 0.85);
        float legs = smoothstep(centre, 0.0, h) * (0.12 + uGravity * 0.88);
        float fres = pow(1.0 - abs(dot(n, v)), 2.2);

        vec3 glass = mix(uBase, vec3(0.30, 0.62, 1.0), head * 0.65);
        glass = mix(glass, vec3(1.0, 0.38, 0.48), legs * 0.55);
        vec3 glassCol = glass * (0.18 + 0.3 * fres) + uRim * fres * 0.8;
        float glassA = uAlpha + fres * 0.5 + (head + legs) * 0.06;

        float pores = fbm3(vObj * 220.0);
        float wrap = clamp((dot(n, normalize(uLight)) + 0.45) / 1.45, 0.0, 1.0);
        float fill = clamp((dot(n, normalize(vec3(-0.6, 0.2, 0.7))) + 0.3) / 1.3, 0.0, 1.0);
        vec3 tone = uTone * (0.92 + pores * 0.12);
        vec3 sss = vec3(0.85, 0.3, 0.25) * pow(1.0 - wrap, 2.0) * 0.18;
        vec3 spec = vec3(1.0) * pow(max(dot(reflect(-normalize(uLight), n), v), 0.0), 24.0) * 0.12;
        vec3 solidCol = tone * (0.28 + 0.72 * wrap + 0.2 * fill) + sss + spec + uRim * fres * 0.15;
        solidCol = mix(solidCol, solidCol * vec3(0.8, 0.9, 1.15), head * 0.35);
        solidCol = mix(solidCol, solidCol * vec3(1.12, 0.85, 0.88), legs * 0.3);

        gl_FragColor = vec4(mix(glassCol, solidCol, uSolid), mix(clamp(glassA, 0.0, 0.85), 1.0, uSolid));
      }
    `,
    uniforms: {
      uGravity: { value: 1 },
      uRim: { value: new THREE.Color(0xbfe3ff) },
      uBase: { value: new THREE.Color(0xd9cfee) },
      uAlpha: { value: 0.04 },
      uSolid: { value: 0 },
      uTone: { value: new THREE.Color(0xe2b9a0) },
      uLight: { value: new THREE.Vector3(0.5, 0.6, 0.7) },
    },
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Skeletal muscle: fibre striations, white tendons at the joints, the
 * linea alba and tendinous bands of the abdomen, and a translucent trunk so
 * the ribcage and organs read through it as on an x-ray plate.
 */
export function muscleMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: shellVertex,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; uniform float uTrunk; uniform vec3 uLight;
      varying vec3 vObj; varying vec3 vWorld; varying vec3 vN; varying vec3 vView;
      ${NOISE}
      void main() {
        vec3 p = vObj; vec3 n = normalize(vN); vec3 v = normalize(vView);
        float ax = abs(p.x);
        float front = smoothstep(0.03, 0.07, p.z);

        // fibre direction: vertical in the limbs, horizontal across the pectorals
        float pec = smoothstep(0.26, 0.2, ax) * smoothstep(0.8, 0.86, p.y) * smoothstep(1.05, 0.98, p.y) * front;
        float vert = vn3(vec3(p.x * 190.0, p.y * 14.0, p.z * 190.0));
        float horz = vn3(vec3(p.x * 12.0 + p.y * 6.0, p.y * 190.0, p.z * 190.0));
        float fib = mix(vert, horz, pec);
        float bands = 1.0 - abs(2.0 * fbm3(p * 26.0) - 1.0);
        float groove = smoothstep(0.9, 0.99, bands) * 0.35;

        vec3 deep = vec3(0.66, 0.18, 0.11);
        vec3 bright = vec3(0.97, 0.5, 0.33);
        vec3 col = mix(deep, bright, 0.35 + fib * 0.45);
        col *= 1.0 - groove * 0.45;

        float tendon = 0.0;
        tendon += smoothstep(0.14, 0.02, p.y) * step(0.37, ax) * step(-0.03, p.y);                     // wrist tendons
        tendon += step(ax, 0.6) * step(0.4, ax) * step(p.y, -0.03);                                      // back of the hand
        tendon += smoothstep(-1.62, -1.8, p.y);                                                          // Achilles and ankle
        tendon += exp(-pow((p.y + 0.95) / 0.045, 2.0)) * front * step(0.08, ax) * step(ax, 0.2);        // patellar tendon
        tendon += exp(-pow(p.x / 0.007, 2.0)) * step(0.12, p.y) * step(p.y, 0.78) * front;               // linea alba
        tendon += (exp(-pow((p.y - 0.36) / 0.007, 2.0)) + exp(-pow((p.y - 0.48) / 0.007, 2.0)) + exp(-pow((p.y - 0.6) / 0.007, 2.0)))
                  * step(ax, 0.1) * front;                                                               // tendinous bands
        tendon += smoothstep(0.03, 0.0, abs(p.y - 1.12)) * step(ax, 0.22) * 0.5;                         // clavicular line
        col = mix(col, vec3(0.93, 0.86, 0.78), clamp(tendon, 0.0, 1.0));

        vec3 L = normalize(uLight);
        float diff = clamp((dot(n, L) + 0.35) / 1.35, 0.0, 1.0);
        float spec = pow(max(dot(reflect(-L, n), v), 0.0), 30.0);
        float fres = pow(1.0 - abs(dot(n, v)), 2.5);
        vec3 lit = col * (0.32 + 0.78 * diff) + vec3(1.0, 0.85, 0.8) * spec * 0.25 + vec3(1.0, 0.6, 0.5) * fres * 0.18;

        float trunk = smoothstep(0.24, 0.16, ax) * smoothstep(-0.06, 0.05, p.y) * smoothstep(1.06, 0.98, p.y);
        float headFade = smoothstep(1.34, 1.43, p.y);
        float handFade = step(0.44, ax) * smoothstep(0.02, -0.04, p.y);
        float footFade = smoothstep(-1.86, -1.92, p.y);
        float a = uAlpha * mix(1.0, uTrunk, trunk) * (1.0 - 0.85 * max(max(headFade, handFade), footFade)) + fres * 0.1;
        gl_FragColor = vec4(lit, clamp(a, 0.0, 1.0));
      }
    `,
    uniforms: {
      uAlpha: { value: 0.66 },
      uTrunk: { value: 0.25 },
      uLight: { value: new THREE.Vector3(0.5, 0.6, 0.7) },
    },
    transparent: true,
    depthWrite: false,
  });
}
