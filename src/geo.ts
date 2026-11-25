/** Geometry helpers: every building is merged into one buffer, in vertex colours. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Vec3 = [number, number, number];

const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const tint = new THREE.Color();

/** A spot that glows at dusk: a window, a lamp, a forge. */
export interface Light {
  x: number;
  y: number;
  z: number;
  size: number;
}

/** Adds primitives in world-ish local space, keeping their colour per vertex. */
export class GeoBuilder {
  readonly lights: Light[] = [];
  private parts: THREE.BufferGeometry[] = [];

  /** Registers a light in the builder's local space. */
  light(x: number, y: number, z: number, size = 1): this {
    this.lights.push({ x, y, z, size });
    return this;
  }

  add(
    geometry: THREE.BufferGeometry,
    color: number,
    at: Vec3 = [0, 0, 0],
    rot: Vec3 = [0, 0, 0],
    size: Vec3 = [1, 1, 1],
  ): this {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    flat.deleteAttribute('uv');
    flat.deleteAttribute('normal');
    flat.computeVertexNormals();

    euler.set(rot[0], rot[1], rot[2]);
    quaternion.setFromEuler(euler);
    matrix.compose(
      position.set(at[0], at[1], at[2]),
      quaternion,
      scale.set(size[0], size[1], size[2]),
    );
    flat.applyMatrix4(matrix);

    tint.setHex(color);
    const count = flat.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    flat.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.parts.push(flat);
    return this;
  }

  build(): THREE.BufferGeometry | null {
    if (this.parts.length === 0) return null;
    const merged = mergeGeometries(this.parts, false);
    for (const part of this.parts) part.dispose();
    this.parts = [];
    if (!merged) return null;
    merged.computeBoundingSphere();
    return merged;
  }
}

export const cube = (): THREE.BoxGeometry => new THREE.BoxGeometry(1, 1, 1);
export const plate = (): THREE.CylinderGeometry => new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
export const post = (): THREE.CylinderGeometry => new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
export const blob = (): THREE.IcosahedronGeometry => new THREE.IcosahedronGeometry(0.5, 0);
/** A rounder ball, for heads and hats that should not look faceted. */
export const ball = (): THREE.SphereGeometry => new THREE.SphereGeometry(0.5, 12, 8);

/** A square pyramid, rotated so its faces line up with the axes. */
export function pyramid(): THREE.ConeGeometry {
  const geo = new THREE.ConeGeometry(1, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.translate(0, 0.5, 0);
  return geo;
}

/** A cone that starts at its base (y = 0) rather than its centre. */
export function cone(): THREE.ConeGeometry {
  const geo = new THREE.ConeGeometry(0.5, 1, 8, 1);
  geo.translate(0, 0.5, 0);
  return geo;
}

/** Half a sphere, for domes and roofs that sit on a wall. */
export function dome(): THREE.SphereGeometry {
  const geo = new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  return geo;
}

/** A torus, for wheels and rims. It lies in the XY plane, axis along z. */
export function ring(): THREE.TorusGeometry {
  return new THREE.TorusGeometry(0.5, 0.06, 5, 14);
}

/** A flat quad lying on the ground. */
export function quad(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** A vertical quad, useful for cliffs and walls. */
export function panel(): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(1, 1);
}
