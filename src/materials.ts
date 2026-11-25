/**
 * The hand-drawn look: flat tonal washes, a grain like toothy paper, a contact
 * shadow where things meet the ground, and a slightly wobbling ink outline (an
 * inverted hull pushed along the normal). No hatching: the stripes read as
 * fabric, not as ink.
 *
 * `uDusk` moves the whole diorama into the evening: colder paper, deeper shade,
 * and the windows and lamps come on.
 */

import * as THREE from 'three';

export const PAPER = 0xf2ede3;
export const NIGHT_PAPER = 0x9ba0b8;
export const INK = 0x3a2f2a;

const NOISE = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash21(i.xy + i.z * 37.0);
    float n100 = hash21(i.xy + vec2(1.0, 0.0) + i.z * 37.0);
    float n010 = hash21(i.xy + vec2(0.0, 1.0) + i.z * 37.0);
    float n110 = hash21(i.xy + vec2(1.0, 1.0) + i.z * 37.0);
    float n001 = hash21(i.xy + (i.z + 1.0) * 37.0);
    float n101 = hash21(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 37.0);
    float n011 = hash21(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 37.0);
    float n111 = hash21(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 37.0);
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z);
  }
`;

export interface InkOptions {
  light?: THREE.Vector3;
  hatchScale?: number;
  alpha?: number;
}

export function inkMaterial({
  light = new THREE.Vector3(-0.55, 0.95, 0.45).normalize(),
  hatchScale = 5.5,
  alpha = 1,
}: InkOptions = {}) {
  return new THREE.ShaderMaterial({
    transparent: alpha < 1,
    depthWrite: alpha >= 1,
    uniforms: {
      uInk: { value: new THREE.Color(INK) },
      uPaper: { value: new THREE.Color(PAPER) },
      uLight: { value: light.clone() },
      uHatch: { value: hatchScale },
      uAlpha: { value: alpha },
      uDusk: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      varying vec3 vColor;
      varying vec3 vNormalW;
      varying vec3 vWorld;

      void main() {
        vColor = aColor;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;

      uniform vec3 uInk;
      uniform vec3 uPaper;
      uniform vec3 uLight;
      uniform float uHatch;
      uniform float uAlpha;
      uniform float uDusk;
      uniform float uTime;

      varying vec3 vColor;
      varying vec3 vNormalW;
      varying vec3 vWorld;

      ${NOISE}

      void main() {
        vec3 n = normalize(vNormalW);
        float lambert = dot(n, normalize(uLight)) * 0.5 + 0.5;

        // Five flat washes, the way ink dries: enough steps to read volume, and
        // none of them a stripe.
        float tone = smoothstep(0.10, 0.92, lambert);
        float band = floor(tone * 5.0) / 5.0;
        vec3 col = vColor * mix(0.68 - uDusk * 0.15, 0.99, band);

        // Shade cools towards blue ink, light warms towards paper.
        col = mix(col, col * vec3(0.93, 0.95, 1.06), (1.0 - band) * 0.5);
        col = mix(col, uPaper, max(0.0, band - 0.8) * 0.05);

        // Contact shadow: the bottom of every shape sits into the ground.
        float ground = smoothstep(0.0, 0.5, vWorld.y);
        col *= mix(0.84, 1.0, ground);

        // A thin ink rim at grazing angles keeps silhouettes solid.
        vec3 toEye = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - abs(dot(n, toEye)), 2.6);
        col = mix(col, uInk, fresnel * (0.10 + uDusk * 0.07));

        // Evening: the paper cools and the ink gets heavier.
        col = mix(col, col * vec3(0.58, 0.66, 0.96), uDusk * 0.85);
        col = mix(col, uPaper * 0.82, uDusk * 0.18);

        // Mottling: a soft blotch so broad flat areas (grass, paper) breathe.
        float mottle = valueNoise(vWorld * 1.7) - 0.5;
        col += mottle * 0.035;

        // Paper tooth.
        float grain = valueNoise(vec3(gl_FragCoord.xy * 0.7, 1.0)) - 0.5;
        col += grain * 0.05;

        // The diorama fades into the paper as it goes away.
        float d = distance(vWorld, cameraPosition);
        col = mix(col, uPaper, smoothstep(38.0, 92.0, d) * 0.55);

        gl_FragColor = vec4(col, uAlpha);
      }
    `,
  });
}

/** The inverted hull: an ink contour that wanders a little, like a real pen. */
export function inkOutlineMaterial(thickness = 0.034) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uInk: { value: new THREE.Color(INK) }, uThickness: { value: thickness } },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      ${NOISE}

      void main() {
        vec3 local = position;
        vec3 n = normalize(normal);
        // A wobble that follows the shape, so the line is never mechanical.
        float wobble = valueNoise(local * 6.5) - 0.5;
        local += n * (uThickness * (1.0 + wobble * 0.9));
        vec4 world = modelMatrix * vec4(local, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uInk;
      void main() {
        gl_FragColor = vec4(uInk, 1.0);
      }
    `,
  });
}

/** Water: pale, with slow wide swells and a glint, never a hatch. */
export function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInk: { value: new THREE.Color(INK) },
      uPaper: { value: new THREE.Color(PAPER) },
      uShallow: { value: new THREE.Color(0xd6e4e1) },
      uDeep: { value: new THREE.Color(0xb2cecd) },
      uDusk: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uInk;
      uniform vec3 uPaper;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform float uDusk;
      uniform float uTime;
      varying vec3 vWorld;

      ${NOISE}

      void main() {
        vec2 p = vWorld.xz;
        // Slow drift, so the water breathes without ever shouting.
        float drift = sin(p.x * 0.35 + uTime * 0.25) * 0.35 + sin(p.y * 0.28 - uTime * 0.2) * 0.35;
        float deep = smoothstep(0.0, 22.0, length(p));
        vec3 col = mix(uShallow, uDeep, deep * 0.5);

        vec2 uv = gl_FragCoord.xy;
        // Two long swells: soft bands of light, no line work.
        float swell = sin(p.x * 0.55 + p.y * 0.42 + uTime * 0.22 + drift) * 0.5
          + sin(p.x * -0.31 + p.y * 0.7 - uTime * 0.16) * 0.5;
        col = mix(col, uPaper, smoothstep(0.45, 1.0, swell) * 0.10);
        col = mix(col, uInk, smoothstep(-0.25, -0.95, swell) * 0.035);

        float grain = valueNoise(vec3(uv * 0.6, 2.0)) - 0.5;
        col += grain * 0.03;

        // Evening water: colder and darker.
        col = mix(col, col * vec3(0.5, 0.6, 0.92), uDusk * 0.9);

        // The sea is a small saucer around the island: it fades into the paper.
        float radius = length(p);
        col = mix(col, uPaper, smoothstep(9.0, 15.5, radius));
        float d = distance(vWorld, cameraPosition);
        col = mix(col, uPaper, smoothstep(40.0, 110.0, d) * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/** A soft ink shadow on the ground, drawn instead of computed. */
export function shadowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uInk: { value: new THREE.Color(INK) }, uAlpha: { value: 0.13 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uInk;
      uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.3, d) * uAlpha;
        gl_FragColor = vec4(uInk, a);
      }
    `,
  });
}

/** A flat ink line, used for the ghost of the block about to be placed. */
export function ghostMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uInk: { value: new THREE.Color(INK) }, uAlpha: { value: 0.5 } },
    vertexShader: /* glsl */ `
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uInk;
      uniform float uAlpha;
      void main() { gl_FragColor = vec4(uInk, uAlpha); }
    `,
  });
}

/**
 * Every lit window and street lamp in one Points cloud: one draw call, soft
 * round glows that fade in with dusk. Point size is attenuated by distance.
 */
export function glowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uDusk: { value: 0 },
      uTime: { value: 0 },
      uWarm: { value: new THREE.Color(0xffcf7a) },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      varying float vAlpha;
      uniform float uDusk;
      uniform float uTime;

      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float flicker = 0.82 + 0.18 * sin(uTime * 2.3 + aPhase * 6.283);
        gl_PointSize = aSize * 130.0 * flicker / max(2.0, -mv.z);
        vAlpha = uDusk * flicker;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uWarm;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uWarm, a);
      }
    `,
  });
}

/**
 * Chimney smoke as one Points cloud: each point rises, grows and fades on its
 * own clock, all computed in the vertex shader.
 */
export function smokeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uInk: { value: new THREE.Color(INK) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aOrigin;
      attribute float aPhase;
      attribute float aLife;
      attribute float aDrift;
      attribute float aSeed;
      uniform float uTime;
      varying float vAlpha;

      void main() {
        float t = fract((uTime + aPhase) / aLife);
        vec3 pos = aOrigin + vec3(t * aDrift * 0.7, t * 0.95, t * aDrift * 0.45);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = 0.12 + t * 0.42;
        gl_PointSize = size * 260.0 * (0.8 + aSeed * 0.4) / max(2.0, -mv.z);
        vAlpha = sin(3.14159 * t) * 0.34;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uInk;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uInk, a);
      }
    `,
  });
}

/** A soft ring, drawn once on a canvas: the wake a boat leaves. */
export function ringTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.strokeStyle = 'rgba(58, 47, 42, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 47, 42, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 11, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
