/** Geometry helpers: every building is merged into one buffer, in vertex colours. */

import * as THREE from 'three';

export type Vec3 = [number, number, number];

const matrix = new THREE.Matrix4();
const normalMatrix = new THREE.Matrix3();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler();
const at3 = new THREE.Vector3();
const size3 = new THREE.Vector3();
const vertex = new THREE.Vector3();
const normal = new THREE.Vector3();
const tint = new THREE.Color();

/**
 * Every primitive is handed out as the same instance, and its triangles are
 * read once into plain arrays. Building a town then costs one pass over the
 * vertices per shape, with no BufferGeometry allocation per part.
 */
interface Template {
  position: Float32Array;
  normal: Float32Array;
}

const templates = new WeakMap<THREE.BufferGeometry, Template>();

function template(geometry: THREE.BufferGeometry): Template {
  const cached = templates.get(geometry);
  if (cached) return cached;
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (!flat.getAttribute('normal')) flat.computeVertexNormals();
  const data: Template = {
    position: Float32Array.from(flat.getAttribute('position').array as ArrayLike<number>),
    normal: Float32Array.from(flat.getAttribute('normal').array as ArrayLike<number>),
  };
  if (flat !== geometry) flat.dispose();
  templates.set(geometry, data);
  return data;
}

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
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private vertices = 0;

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
    const shape = template(geometry);

    euler.set(rot[0], rot[1], rot[2]);
    quaternion.setFromEuler(euler);
    matrix.compose(at3.set(at[0], at[1], at[2]), quaternion, size3.set(size[0], size[1], size[2]));
    normalMatrix.getNormalMatrix(matrix);

    tint.setHex(color);
    const r = tint.r;
    const g = tint.g;
    const b = tint.b;
    const positions = this.positions;
    const normals = this.normals;
    const colors = this.colors;
    const source = shape.position;
    const sourceNormals = shape.normal;
    for (let i = 0; i < source.length; i += 3) {
      vertex.set(source[i], source[i + 1], source[i + 2]).applyMatrix4(matrix);
      positions.push(vertex.x, vertex.y, vertex.z);
      normal.set(sourceNormals[i], sourceNormals[i + 1], sourceNormals[i + 2]).applyMatrix3(normalMatrix).normalize();
      normals.push(normal.x, normal.y, normal.z);
      colors.push(r, g, b);
    }
    this.vertices += source.length / 3;
    return this;
  }

  build(): THREE.BufferGeometry | null {
    if (this.vertices === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingSphere();
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.vertices = 0;
    return geometry;
  }
}

const CUBE = new THREE.BoxGeometry(1, 1, 1);
export const cube = (): THREE.BoxGeometry => CUBE;

const PLATE = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
export const plate = (): THREE.CylinderGeometry => PLATE;

const POST = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
export const post = (): THREE.CylinderGeometry => POST;

const BLOB = new THREE.IcosahedronGeometry(0.5, 0);
export const blob = (): THREE.IcosahedronGeometry => BLOB;

/** A rounder ball, for heads and hats that should not look faceted. */
const BALL = new THREE.SphereGeometry(0.5, 12, 8);
export const ball = (): THREE.SphereGeometry => BALL;

/** A square pyramid, rotated so its faces line up with the axes. */
const PYRAMID = (() => {
  const geometry = new THREE.ConeGeometry(1, 1, 4, 1);
  geometry.rotateY(Math.PI / 4);
  geometry.translate(0, 0.5, 0);
  return geometry;
})();
export function pyramid(): THREE.ConeGeometry {
  return PYRAMID;
}

/** A cone that starts at its base (y = 0) rather than its centre. */
const CONE = (() => {
  const geometry = new THREE.ConeGeometry(0.5, 1, 8, 1);
  geometry.translate(0, 0.5, 0);
  return geometry;
})();
export function cone(): THREE.ConeGeometry {
  return CONE;
}

/** Half a sphere, for domes and roofs that sit on a wall. */
const DOME = new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
export function dome(): THREE.SphereGeometry {
  return DOME;
}

/** A torus, for wheels and rims. It lies in the XY plane, axis along z. */
const RING = new THREE.TorusGeometry(0.5, 0.06, 5, 14);
export function ring(): THREE.TorusGeometry {
  return RING;
}

/** A flat quad lying on the ground. */
const QUAD = (() => {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
})();
export function quad(): THREE.PlaneGeometry {
  return QUAD;
}

/** A vertical quad, useful for cliffs and walls. */
const PANEL = new THREE.PlaneGeometry(1, 1);
export function panel(): THREE.PlaneGeometry {
  return PANEL;
}
