import * as THREE from 'three';

/**
 * Signed distance fields and a surface-nets mesher.
 *
 * The anatomy is sculpted as smooth unions of ellipsoids and tapered
 * capsules (the way a sculptor blocks in muscle masses), then polygonised
 * once on a grid. This gives continuous, organic surfaces instead of the
 * seams you get from stacking primitive meshes.
 */

export type Vec3 = [number, number, number];
type Op = 'add' | 'sub' | 'int';

export interface Prim {
  d: (x: number, y: number, z: number) => number;
  k: number;
  op: Op;
  min: Vec3;
  max: Vec3;
}

const INF: Vec3 = [Infinity, Infinity, Infinity];
const NINF: Vec3 = [-Infinity, -Infinity, -Infinity];

function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function smax(a: number, b: number, k: number) {
  return -smin(-a, -b, k);
}

/** Inverse rotation matrix (row major) for an XYZ Euler rotation. */
function invRot(rot?: Vec3): number[] | null {
  if (!rot || (rot[0] === 0 && rot[1] === 0 && rot[2] === 0)) return null;
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])).invert();
  const e = m.elements; // column major
  return [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
}

function bounds(c: Vec3, ext: number, k: number): [Vec3, Vec3] {
  const m = ext + k + 0.01;
  return [
    [c[0] - m, c[1] - m, c[2] - m],
    [c[0] + m, c[1] + m, c[2] + m],
  ];
}

export function ellipsoid(c: Vec3, r: Vec3, k = 0.03, rot?: Vec3, op: Op = 'add'): Prim {
  const R = invRot(rot);
  const [rx, ry, rz] = r;
  const [min, max] = bounds(c, Math.max(rx, ry, rz), k);
  return {
    k,
    op,
    min,
    max,
    d: (px, py, pz) => {
      let x = px - c[0];
      let y = py - c[1];
      let z = pz - c[2];
      if (R) {
        const nx = R[0] * x + R[1] * y + R[2] * z;
        const ny = R[3] * x + R[4] * y + R[5] * z;
        const nz = R[6] * x + R[7] * y + R[8] * z;
        x = nx;
        y = ny;
        z = nz;
      }
      const ax = x / rx, ay = y / ry, az = z / rz;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const bx = ax / rx, by = ay / ry, bz = az / rz;
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      if (k1 < 1e-9) return -Math.min(rx, ry, rz);
      return (k0 * (k0 - 1)) / k1;
    },
  };
}

export function sphere(c: Vec3, r: number, k = 0.03, op: Op = 'add'): Prim {
  const [min, max] = bounds(c, r, k);
  return {
    k,
    op,
    min,
    max,
    d: (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r,
  };
}

/** Exact round cone (a capsule whose radius tapers from ra to rb). */
export function capsule(a: Vec3, b: Vec3, ra: number, rb = ra, k = 0.03, op: Op = 'add'): Prim {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = ra - rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const R = Math.max(ra, rb) + k + 0.01;
  return {
    k,
    op,
    min: [Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.min(a[2], b[2]) - R],
    max: [Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, Math.max(a[2], b[2]) + R],
    d: (px, py, pz) => {
      const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
      const y = pax * bax + pay * bay + paz * baz;
      const z = y - l2;
      const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
      const x2 = xx * xx + xy * xy + xz * xz;
      const y2 = y * y * l2;
      const z2 = z * z * l2;
      const kk = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(z) * a2 * z2 > kk) return Math.sqrt(x2 + z2) * il2 - rb;
      if (Math.sign(y) * a2 * y2 < kk) return Math.sqrt(x2 + y2) * il2 - ra;
      return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - ra;
    },
  };
}

/** A hollow shell of another primitive. */
export function shell(p: Prim, t: number, k = p.k): Prim {
  return { ...p, k, d: (x, y, z) => Math.abs(p.d(x, y, z)) - t };
}

/** Any custom distance function, unbounded. */
export function custom(d: Prim['d'], k = 0.02, op: Op = 'add', min: Vec3 = NINF, max: Vec3 = INF): Prim {
  return { d, k, op, min, max };
}

export type Field = ((x: number, y: number, z: number) => number) & {
  /** A field limited to the primitives that can matter within a y slab. */
  forRow?: (y0: number, y1: number) => (x: number, y: number, z: number) => number;
};

/**
 * Only values within this distance of the surface affect the mesh (signs and
 * gradients), so primitives further away than this can be skipped.
 */
const BAND = 0.06;

function evaluate(prims: Prim[]) {
  const n = prims.length;
  return (x: number, y: number, z: number) => {
    let d = 1e9;
    for (let i = 0; i < n; i++) {
      const p = prims[i];
      if (p.op !== 'int') {
        const dx = Math.max(p.min[0] - x, 0, x - p.max[0]);
        const dy = Math.max(p.min[1] - y, 0, y - p.max[1]);
        const dz = Math.max(p.min[2] - z, 0, z - p.max[2]);
        const bd = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (bd > p.k + BAND) continue;
        if (p.op === 'add' && bd - d > p.k) continue;
        if (p.op === 'sub' && bd >= p.k - d) continue;
      }
      const pd = p.d(x, y, z);
      if (p.op === 'add') d = smin(d, pd, p.k);
      else if (p.op === 'sub') d = smax(d, -pd, p.k);
      else d = smax(d, pd, p.k);
    }
    return d;
  };
}

export function makeField(prims: Prim[]): Field {
  const f: Field = evaluate(prims);
  f.forRow = (y0, y1) => evaluate(prims.filter((p) => p.op === 'int' || (p.max[1] >= y0 - p.k - BAND && p.min[1] <= y1 + p.k + BAND)));
  return f;
}

const CORNERS: Vec3[] = [];
for (let c = 0; c < 8; c++) CORNERS.push([c & 1, (c >> 1) & 1, (c >> 2) & 1]);
const EDGES: [number, number][] = [];
for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) if (!(a & bit)) EDGES.push([a, a | bit]);

/**
 * Sample `field` on a grid once and extract one surface per iso level with
 * surface nets. Normals come from the field gradient, then the mesh gets a
 * light Laplacian smoothing pass.
 */
export function surfaceNets(field: Field, min: Vec3, max: Vec3, step: number, isos: number[] = [0], smooth = 2): THREE.BufferGeometry[] {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const F = new Float32Array(nx * ny * nz);
  for (let j = 0; j < ny; j++) {
    const y = min[1] + j * step;
    const row = field.forRow ? field.forRow(y, y) : field;
    for (let k = 0; k < nz; k++) {
      const z = min[2] + k * step;
      let o = nx * (j + ny * k);
      for (let i = 0; i < nx; i++) F[o++] = row(min[0] + i * step, y, z);
    }
  }
  const at = (i: number, j: number, k: number) => {
    i = i < 0 ? 0 : i >= nx ? nx - 1 : i;
    j = j < 0 ? 0 : j >= ny ? ny - 1 : j;
    k = k < 0 ? 0 : k >= nz ? nz - 1 : k;
    return F[i + nx * (j + ny * k)];
  };
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;

  return isos.map((iso) => {
    const cellV = new Int32Array(cx * cy * cz).fill(-1);
    const pos: number[] = [];
    const nor: number[] = [];
    const v = new Float32Array(8);
    for (let k = 0; k < cz; k++)
      for (let j = 0; j < cy; j++)
        for (let i = 0; i < cx; i++) {
          let inside = 0;
          for (let c = 0; c < 8; c++) {
            const cc = CORNERS[c];
            v[c] = F[i + cc[0] + nx * (j + cc[1] + ny * (k + cc[2]))] - iso;
            if (v[c] < 0) inside++;
          }
          if (inside === 0 || inside === 8) continue;
          let sx = 0, sy = 0, sz = 0, n = 0;
          for (const [a, b] of EDGES) {
            if (v[a] < 0 === v[b] < 0) continue;
            const t = v[a] / (v[a] - v[b]);
            const A = CORNERS[a], B = CORNERS[b];
            sx += A[0] + (B[0] - A[0]) * t;
            sy += A[1] + (B[1] - A[1]) * t;
            sz += A[2] + (B[2] - A[2]) * t;
            n++;
          }
          sx /= n;
          sy /= n;
          sz /= n;
          // trilinear blend of central-difference gradients at the 8 corners
          let gx = 0, gy = 0, gz = 0;
          for (let c = 0; c < 8; c++) {
            const cc = CORNERS[c];
            const w = (cc[0] ? sx : 1 - sx) * (cc[1] ? sy : 1 - sy) * (cc[2] ? sz : 1 - sz);
            const I = i + cc[0], J = j + cc[1], K = k + cc[2];
            gx += w * (at(I + 1, J, K) - at(I - 1, J, K));
            gy += w * (at(I, J + 1, K) - at(I, J - 1, K));
            gz += w * (at(I, J, K + 1) - at(I, J, K - 1));
          }
          const gl = Math.hypot(gx, gy, gz) || 1;
          cellV[i + cx * (j + cy * k)] = pos.length / 3;
          pos.push(min[0] + (i + sx) * step, min[1] + (j + sy) * step, min[2] + (k + sz) * step);
          nor.push(gx / gl, gy / gl, gz / gl);
        }

    const idx: number[] = [];
    const cell = (i: number, j: number, k: number) => cellV[i + cx * (j + cy * k)];
    // Cells around an edge are listed counter-clockwise about +x, -y and +z
    // respectively, so the winding follows from which end of the edge is inside.
    const quad = (a: number, b: number, c: number, d: number, keep: boolean) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (keep) idx.push(a, b, c, a, c, d);
      else idx.push(a, c, b, a, d, c);
    };
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const v0 = at(i, j, k) - iso < 0;
          if (i < cx && j > 0 && k > 0 && j < cy && k < cz) {
            const v1 = at(i + 1, j, k) - iso < 0;
            if (v0 !== v1) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), v0);
          }
          if (j < cy && i > 0 && k > 0 && i < cx && k < cz) {
            const v1 = at(i, j + 1, k) - iso < 0;
            if (v0 !== v1) quad(cell(i - 1, j, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i - 1, j, k), !v0);
          }
          if (k < cz && i > 0 && j > 0 && i < cx && j < cy) {
            const v1 = at(i, j, k + 1) - iso < 0;
            if (v0 !== v1) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), v0);
          }
        }

    const P = new Float32Array(pos);
    // Laplacian smoothing to soften the grid steps
    if (smooth > 0) {
      const nv = P.length / 3;
      const acc = new Float32Array(P.length);
      const cnt = new Uint16Array(nv);
      for (let it = 0; it < smooth; it++) {
        acc.fill(0);
        cnt.fill(0);
        for (let t = 0; t < idx.length; t += 3) {
          for (let e = 0; e < 3; e++) {
            const a = idx[t + e], b = idx[t + ((e + 1) % 3)];
            acc[a * 3] += P[b * 3]; acc[a * 3 + 1] += P[b * 3 + 1]; acc[a * 3 + 2] += P[b * 3 + 2]; cnt[a]++;
            acc[b * 3] += P[a * 3]; acc[b * 3 + 1] += P[a * 3 + 1]; acc[b * 3 + 2] += P[a * 3 + 2]; cnt[b]++;
          }
        }
        for (let q = 0; q < nv; q++) {
          if (!cnt[q]) continue;
          for (let e = 0; e < 3; e++) P[q * 3 + e] += (acc[q * 3 + e] / cnt[q] - P[q * 3 + e]) * 0.5;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  });
}

/** Small deterministic RNG so the anatomy is identical on every load. */
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
