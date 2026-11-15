import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Field, Prim, Vec3, capsule, custom, ellipsoid, makeField, mulberry32, shell, sphere, surfaceNets } from './sdf';

/**
 * Procedural anatomy for the crew body, in body units (feet at y = -2,
 * crown at y = 1.79, +x is the crew member's left, +z faces forward).
 *
 * Built once and cached for the page's lifetime: the sculpted SDF layers
 * take a few hundred milliseconds to polygonise.
 */

export interface AnatomyGeometry {
  skin: THREE.BufferGeometry;
  muscle: THREE.BufferGeometry;
  bones: THREE.BufferGeometry;
  cartilage: THREE.BufferGeometry;
  organs: Record<OrganKey, THREE.BufferGeometry>;
  arteries: THREE.BufferGeometry;
  headArteries: THREE.BufferGeometry;
  veins: THREE.BufferGeometry;
  legVeins: THREE.BufferGeometry;
  nerves: THREE.BufferGeometry;
  buildMs: number;
}

export type OrganKey =
  | 'brain'
  | 'cerebellum'
  | 'eyes'
  | 'lungs'
  | 'airways'
  | 'heart'
  | 'liver'
  | 'gallbladder'
  | 'stomach'
  | 'spleen'
  | 'pancreas'
  | 'kidneys'
  | 'adrenals'
  | 'urinary'
  | 'bladder'
  | 'smallIntestine'
  | 'colon'
  | 'thyroid';

const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);
const UP = new THREE.Vector3(0, 1, 0);
const SIDES = [-1, 1] as const;

/** Collects loose geometries and merges them into one draw call. */
class Bucket {
  private geos: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry) {
    const n = g.index ? g.toNonIndexed() : g;
    if (n.getAttribute('uv')) n.deleteAttribute('uv');
    if (!n.getAttribute('normal')) n.computeVertexNormals();
    this.geos.push(n);
    return this;
  }
  merge() {
    const out = this.geos.length ? mergeGeometries(this.geos, false) : new THREE.BufferGeometry();
    this.geos.forEach((g) => g.dispose());
    this.geos = [];
    out.computeBoundingSphere();
    return out;
  }
}

/** Orient a geometry built along +y (from y = 0) so it runs from a to b. */
function orient(g: THREE.BufferGeometry, a: Vec3, b: Vec3) {
  const dir = v3(b).sub(v3(a)).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
  g.translate(a[0], a[1], a[2]);
  return g;
}

/** A long bone with flared, knobbly ends (epiphyses). */
function longBone(a: Vec3, b: Vec3, r: number, knob = 1.9) {
  const L = v3(a).distanceTo(v3(b));
  const e = Math.min(0.065, L * 0.13);
  const prof: [number, number][] = [
    [0, 0],
    [r * knob * 0.75, e * 0.06],
    [r * knob, e * 0.3],
    [r * knob * 0.92, e * 0.65],
    [r * 1.2, e * 1.35],
    [r * 1.0, L * 0.3],
    [r * 0.92, L * 0.5],
    [r * 1.0, L * 0.7],
    [r * 1.2, L - e * 1.35],
    [r * knob * 0.92, L - e * 0.65],
    [r * knob, L - e * 0.3],
    [r * knob * 0.75, L - e * 0.06],
    [0, L],
  ];
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 14);
  return orient(g, a, b);
}

function capsuleGeo(a: Vec3, b: Vec3, r: number, seg = 10) {
  const L = Math.max(0.0001, v3(a).distanceTo(v3(b)));
  const g = new THREE.CapsuleGeometry(r, L, 4, seg);
  g.translate(0, L / 2, 0);
  return orient(g, a, b);
}

function ballGeo(c: Vec3, r: number, scale: Vec3 = [1, 1, 1], rot: Vec3 = [0, 0, 0], seg = 16) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.75)));
  g.scale(scale[0], scale[1], scale[2]);
  g.rotateX(rot[0]);
  g.rotateY(rot[1]);
  g.rotateZ(rot[2]);
  g.translate(c[0], c[1], c[2]);
  return g;
}

/** A tube along a smooth curve whose radius follows rfn(t). */
function tube(points: Vec3[], rfn: number | ((t: number) => number), tubular = 48, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(v3), false, 'catmullrom', 0.5);
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const f = typeof rfn === 'number' ? () => rfn : rfn;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, c);
    const r = f(t);
    for (let j = 0; j <= radial; j++) {
      const q = i * (radial + 1) + j;
      pos.setXYZ(q, c.x + (pos.getX(q) - c.x) * r, c.y + (pos.getY(q) - c.y) * r, c.z + (pos.getZ(q) - c.z) * r);
    }
  }
  return g;
}
const taper = (a: number, b: number) => (t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* Body surface                                                         */
/* ------------------------------------------------------------------ */

function bodyPrims(): Prim[] {
  const p: Prim[] = [
    // head
    ellipsoid([0, 1.605, -0.01], [0.155, 0.182, 0.185], 0.05),
    ellipsoid([0, 1.46, 0.045], [0.118, 0.13, 0.138], 0.07),
    ellipsoid([0, 1.355, 0.085], [0.05, 0.04, 0.048], 0.04),
    ellipsoid([0, 1.6, 0.145], [0.105, 0.028, 0.04], 0.035),
    ellipsoid([0, 1.505, 0.172], [0.021, 0.045, 0.03], 0.025),
    ellipsoid([0, 1.47, 0.172], [0.03, 0.012, 0.022], 0.02),
    sphere([-0.048, 1.553, 0.17], 0.027, 0.02, 'sub'),
    sphere([0.048, 1.553, 0.17], 0.027, 0.02, 'sub'),
    // neck and trapezius
    capsule([0, 1.18, -0.012], [0, 1.43, -0.025], 0.068, 0.064, 0.06),
    capsule([0, 1.31, -0.07], [-0.28, 1.12, -0.025], 0.045, 0.04, 0.07),
    capsule([0, 1.31, -0.07], [0.28, 1.12, -0.025], 0.045, 0.04, 0.07),
    // trunk
    capsule([-0.27, 1.095, -0.01], [0.27, 1.095, -0.01], 0.068, 0.068, 0.09),
    ellipsoid([0, 0.88, 0], [0.265, 0.27, 0.158], 0.09),
    ellipsoid([0, 0.48, 0.015], [0.205, 0.3, 0.138], 0.11),
    ellipsoid([0, 0.45, 0.075], [0.115, 0.24, 0.07], 0.05),
    ellipsoid([0, 0.2, 0.0], [0.215, 0.18, 0.135], 0.1),
    ellipsoid([0, 0.0, 0.0], [0.245, 0.17, 0.148], 0.08),
  ];
  for (const s of SIDES) {
    p.push(
      ellipsoid([s * 0.155, 1.55, -0.012], [0.02, 0.048, 0.034], 0.015), // ear
      capsule([s * 0.05, 1.42, 0.0], [s * 0.028, 1.17, 0.052], 0.021, 0.019, 0.03), // sternocleidomastoid
      ellipsoid([s * 0.12, 0.92, 0.095], [0.12, 0.085, 0.066], 0.05), // pectoral
      ellipsoid([s * 0.2, 0.78, -0.04], [0.095, 0.22, 0.1], 0.06), // latissimus
      ellipsoid([s * 0.1, -0.06, -0.08], [0.12, 0.14, 0.1], 0.05), // gluteal
      ellipsoid([s * 0.33, 1.05, 0.0], [0.095, 0.112, 0.1], 0.05), // deltoid
      capsule([s * 0.35, 1.02, 0], [s * 0.42, 0.5, -0.01], 0.07, 0.054, 0.04), // upper arm
      ellipsoid([s * 0.385, 0.76, 0.033], [0.048, 0.15, 0.048], 0.03), // biceps
      ellipsoid([s * 0.392, 0.8, -0.036], [0.048, 0.17, 0.048], 0.03), // triceps
      capsule([s * 0.42, 0.5, -0.01], [s * 0.47, 0.0, 0.03], 0.051, 0.032, 0.03), // forearm
      ellipsoid([s * 0.432, 0.38, 0.0], [0.054, 0.13, 0.048], 0.03), // forearm flexors
      ellipsoid([s * 0.485, -0.085, 0.037], [0.023, 0.06, 0.047], 0.025), // palm
      capsule([s * 0.12, -0.06, 0], [s * 0.14, -0.92, 0.01], 0.125, 0.068, 0.06), // thigh
      ellipsoid([s * 0.135, -0.4, 0.05], [0.088, 0.26, 0.068], 0.04), // quadriceps
      ellipsoid([s * 0.13, -0.42, -0.05], [0.078, 0.25, 0.066], 0.04), // hamstrings
      ellipsoid([s * 0.14, -0.95, 0.03], [0.058, 0.06, 0.06], 0.03), // knee
      capsule([s * 0.14, -0.95, 0.0], [s * 0.15, -1.84, -0.01], 0.058, 0.035, 0.04), // shin
      ellipsoid([s * 0.145, -1.2, -0.042], [0.058, 0.18, 0.058], 0.04), // calf
      ellipsoid([s * 0.15, -1.95, -0.03], [0.038, 0.05, 0.048], 0.03), // heel
      capsule([s * 0.15, -1.95, -0.02], [s * 0.155, -1.975, 0.155], 0.044, 0.03, 0.04) // foot
    );
  }
  // flat soles
  p.push(custom((_x, y) => -2.004 - y, 0.01, 'int'));
  return p;
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

const SPINE: [number, number][] = [
  [1.46, -0.035],
  [1.3, -0.03],
  [1.17, -0.055],
  [0.95, -0.1],
  [0.7, -0.095],
  [0.45, -0.07],
  [0.17, -0.075],
];
function spineZ(y: number) {
  if (y >= SPINE[0][0]) return SPINE[0][1];
  for (let i = 1; i < SPINE.length; i++) {
    const [y0, z0] = SPINE[i - 1];
    const [y1, z1] = SPINE[i];
    if (y >= y1) {
      const t = (y0 - y) / (y0 - y1);
      const s = t * t * (3 - 2 * t);
      return z0 + (z1 - z0) * s;
    }
  }
  return SPINE[SPINE.length - 1][1];
}

function skullGeo() {
  const p: Prim[] = [
    ellipsoid([0, 1.625, -0.02], [0.128, 0.146, 0.158], 0.04),
    ellipsoid([0, 1.6, 0.055], [0.108, 0.1, 0.09], 0.04),
    ellipsoid([0, 1.47, 0.083], [0.064, 0.05, 0.06], 0.03),
    ellipsoid([0, 1.437, 0.1], [0.05, 0.014, 0.044], 0.01),
    ellipsoid([0, 1.405, 0.096], [0.047, 0.012, 0.041], 0.008),
    capsule([0, 1.36, 0.098], [-0.05, 1.37, 0.075], 0.013, 0.012, 0.015),
    capsule([0, 1.36, 0.098], [0.05, 1.37, 0.075], 0.013, 0.012, 0.015),
    ellipsoid([0, 1.5, 0.15], [0.014, 0.028, 0.03], 0.008, undefined, 'sub'),
  ];
  for (const s of SIDES) {
    p.push(
      ellipsoid([s * 0.075, 1.515, 0.09], [0.034, 0.024, 0.03], 0.03),
      capsule([s * 0.09, 1.515, 0.07], [s * 0.121, 1.52, -0.01], 0.011, 0.009, 0.02),
      ellipsoid([s * 0.1, 1.49, -0.05], [0.02, 0.03, 0.02], 0.03),
      capsule([s * 0.098, 1.505, -0.03], [s * 0.093, 1.4, -0.02], 0.011, 0.013, 0.01),
      capsule([s * 0.093, 1.4, -0.02], [s * 0.05, 1.37, 0.075], 0.013, 0.012, 0.015),
      sphere([s * 0.044, 1.555, 0.14], 0.03, 0.012, 'sub'),
      ellipsoid([s * 0.136, 1.56, 0.03], [0.02, 0.05, 0.05], 0.02, undefined, 'sub')
    );
  }
  return surfaceNets(makeField(p), [-0.15, 1.33, -0.2], [0.15, 1.79, 0.18], 0.006, [0], 1)[0];
}

function pelvisGeo() {
  const p: Prim[] = [
    ellipsoid([0, 0.04, -0.085], [0.052, 0.095, 0.028], 0.03, [-0.35, 0, 0]), // sacrum
    capsule([0, -0.05, -0.105], [0, -0.09, -0.09], 0.01, 0.005, 0.01), // coccyx
    ellipsoid([0, -0.08, 0.066], [0.02, 0.025, 0.012], 0.015), // symphysis
  ];
  for (const s of SIDES) {
    const bowl = shell(ellipsoid([s * 0.115, 0.07, -0.025], [0.105, 0.115, 0.075]), 0.008, 0.02);
    p.push(
      custom((x, y, z) => Math.max(bowl.d(x, y, z), 0.035 - s * x, -y), 0.02), // iliac wing
      capsule([s * 0.1, 0.02, -0.01], [s * 0.095, -0.03, 0.0], 0.03, 0.03, 0.03),
      capsule([s * 0.085, -0.04, 0.03], [s * 0.02, -0.075, 0.065], 0.016, 0.014, 0.02), // pubis
      capsule([s * 0.095, -0.05, -0.01], [s * 0.075, -0.13, -0.035], 0.02, 0.018, 0.02), // ischium
      capsule([s * 0.075, -0.13, -0.035], [s * 0.022, -0.1, 0.05], 0.011, 0.011, 0.015),
      capsule([s * 0.04, 0.07, -0.085], [s * 0.075, 0.08, -0.07], 0.018, 0.018, 0.02)
    );
  }
  return surfaceNets(makeField(p), [-0.24, -0.18, -0.15], [0.24, 0.22, 0.12], 0.006, [0], 1)[0];
}

function skeleton(bones: Bucket, cart: Bucket) {
  bones.add(skullGeo()).add(pelvisGeo());

  // vertebral column: 7 cervical, 12 thoracic, 5 lumbar
  const levels: { y: number; r: number; spin: number; tilt: number }[] = [];
  for (let i = 0; i < 7; i++) levels.push({ y: 1.44 - i * 0.038, r: 0.013, spin: 0.02, tilt: 0.3 });
  for (let i = 0; i < 12; i++) levels.push({ y: 1.16 - i * 0.046, r: 0.016 + i * 0.0006, spin: 0.036, tilt: 0.7 });
  for (let i = 0; i < 5; i++) levels.push({ y: 0.58 - i * 0.082, r: 0.025 + i * 0.0008, spin: 0.03, tilt: 0.1 });
  levels.forEach((L, i) => {
    const next = levels[i + 1];
    const gap = next ? L.y - next.y : 0.07;
    const h = gap * 0.68;
    const z = spineZ(L.y);
    const body = new THREE.CylinderGeometry(L.r, L.r * 1.05, h, 16);
    body.scale(1, 1, 0.82);
    body.translate(0, L.y, z);
    bones.add(body);
    const sp = new THREE.BoxGeometry(0.008, h * 0.75, L.spin);
    sp.translate(0, 0, -L.spin / 2);
    sp.rotateX(L.tilt);
    sp.translate(0, L.y, z - L.r * 1.3);
    bones.add(sp);
    const tr = new THREE.BoxGeometry(L.r * 2 + 0.045, 0.008, 0.012);
    tr.translate(0, L.y + h * 0.15, z - L.r * 0.9);
    bones.add(tr);
    // vertebral arch around the spinal canal
    const arch = new THREE.TorusGeometry(L.r * 0.65, 0.0045, 6, 14, Math.PI);
    arch.rotateX(Math.PI / 2);
    arch.rotateY(Math.PI);
    arch.translate(0, L.y, z - L.r * 1.05);
    bones.add(arch);
    if (next) {
      const disc = new THREE.CylinderGeometry(L.r * 0.95, L.r * 0.95, gap * 0.3, 14);
      disc.scale(1, 1, 0.82);
      disc.translate(0, L.y - gap / 2, (z + spineZ(next.y)) / 2);
      cart.add(disc);
    }
  });

  // ribcage
  const W = [0.085, 0.13, 0.16, 0.18, 0.195, 0.205, 0.21, 0.21, 0.205, 0.195, 0.18, 0.165];
  const DZF = [0.1, 0.12, 0.13, 0.14, 0.145, 0.145, 0.14, 0.135, 0.125, 0.11, 0.08, 0.06];
  const DROP = [0.04, 0.08, 0.11, 0.13, 0.15, 0.17, 0.18, 0.19, 0.2, 0.2, 0.2, 0.18];
  const zc = -0.015;
  for (let i = 0; i < 12; i++) {
    const ys = 1.13 - i * 0.045;
    const zs = spineZ(ys);
    const end = i < 7 ? 0.82 : i < 10 ? 0.78 : 0.55;
    for (const s of SIDES) {
      const pts: Vec3[] = [];
      for (let q = 0; q <= 14; q++) {
        const th = Math.PI * (0.04 + (end - 0.04) * (q / 14));
        const back = th <= Math.PI / 2;
        const x = s * (0.024 + W[i] * Math.sin(th));
        const y = ys - DROP[i] * Math.pow(th / Math.PI, 1.4);
        const z = back ? zc - (zc - zs) * Math.cos(th) - 0.035 * Math.sin(th * 2) : zc - DZF[i] * Math.cos(th);
        pts.push([x, y, z]);
      }
      bones.add(tube(pts, (t) => 0.0062 + 0.0018 * Math.sin(Math.PI * t), 36, 6));
      const tip = pts[pts.length - 1];
      if (i < 7) cart.add(tube([tip, [s * 0.05, (tip[1] + 1.08 - i * 0.05) / 2, tip[2] + 0.02], [s * 0.022, 1.08 - i * 0.05, zc + DZF[i] * 0.95]], 0.0055, 16, 6));
      else if (i < 10) cart.add(tube([tip, [s * 0.09, 0.72 - (i - 7) * 0.02, 0.12], [s * 0.05, 0.75, 0.128]], 0.0048, 16, 6));
    }
  }
  // sternum and xiphoid
  const st = new THREE.CapsuleGeometry(0.018, 0.3, 4, 12);
  st.scale(1.5, 1, 0.45);
  st.translate(0, 0.15, 0);
  bones.add(orient(st, [0, 1.09, 0.083], [0, 0.77, 0.133]));
  bones.add(new THREE.ConeGeometry(0.012, 0.05, 8).rotateX(Math.PI).scale(1, 1, 0.5).translate(0, 0.735, 0.132));

  for (const s of SIDES) {
    // shoulder girdle
    bones.add(tube([[s * 0.025, 1.115, 0.08], [s * 0.1, 1.13, 0.075], [s * 0.2, 1.135, 0.035], [s * 0.3, 1.125, 0.0]], 0.0085, 24, 6));
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(0.12, 0.005);
    sh.quadraticCurveTo(0.1, -0.08, 0.025, -0.175);
    sh.quadraticCurveTo(0.0, -0.09, 0, 0);
    const scap = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1, curveSegments: 8 });
    scap.rotateY(Math.PI);
    scap.rotateY(s > 0 ? Math.PI - 0.35 : 0.35);
    if (s < 0) scap.scale(-1, 1, 1);
    scap.translate(s * 0.07, 1.11, -0.13);
    bones.add(scap);
    bones.add(tube([[s * 0.08, 1.07, -0.14], [s * 0.18, 1.1, -0.13], [s * 0.3, 1.11, -0.05]], 0.0055, 16, 6)); // scapular spine

    // arm
    bones.add(ballGeo([s * 0.325, 1.065, -0.015], 0.03));
    bones.add(longBone([s * 0.33, 1.05, -0.01], [s * 0.42, 0.51, -0.015], 0.013, 2.2));
    bones.add(longBone([s * 0.43, 0.49, 0.005], [s * 0.478, 0.005, 0.04], 0.0072, 2.0));
    bones.add(longBone([s * 0.408, 0.53, -0.03], [s * 0.462, 0.0, 0.012], 0.0075, 2.1));
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) bones.add(ballGeo([s * (0.473 + r * 0.01), -0.02 - r * 0.018, 0.012 + c * 0.014], 0.0085, [1, 1, 1], [0, 0, 0], 8));

    // hand: palm faces the thigh, fingers point down with a gentle curl
    const kz = [0.068, 0.046, 0.025, 0.006];
    const bz = [0.055, 0.042, 0.03, 0.018];
    const lens = [
      [0.042, 0.026, 0.02],
      [0.047, 0.03, 0.022],
      [0.044, 0.028, 0.021],
      [0.034, 0.02, 0.018],
    ];
    for (let f = 0; f < 4; f++) {
      const base: Vec3 = [s * 0.482, -0.045, bz[f]];
      let p: Vec3 = [s * 0.485, -0.125, kz[f]];
      bones.add(longBone(base, p, 0.0042, 1.7));
      let curl = 0.12;
      for (let ph = 0; ph < 3; ph++) {
        const L = lens[f][ph];
        const q: Vec3 = [p[0] - s * Math.sin(curl) * L, p[1] - Math.cos(curl) * L, p[2]];
        bones.add(longBone(p, q, 0.0034 - ph * 0.0004, 1.6));
        p = q;
        curl += 0.16;
      }
    }
    const thumb: Vec3[] = [[s * 0.478, -0.035, 0.06], [s * 0.47, -0.08, 0.095], [s * 0.465, -0.115, 0.115], [s * 0.462, -0.142, 0.125]];
    for (let t = 0; t < 3; t++) bones.add(longBone(thumb[t], thumb[t + 1], 0.0042 - t * 0.0005, 1.6));

    // leg
    bones.add(ballGeo([s * 0.095, -0.025, 0.005], 0.026));
    bones.add(longBone([s * 0.155, -0.05, -0.005], [s * 0.097, -0.026, 0.005], 0.012, 1.0));
    bones.add(ballGeo([s * 0.165, -0.05, -0.01], 0.02));
    bones.add(longBone([s * 0.152, -0.065, -0.005], [s * 0.14, -0.925, 0.0], 0.016, 2.1));
    bones.add(ballGeo([s * 0.14, -0.92, 0.056], 0.022, [1, 1.2, 0.5]));
    bones.add(longBone([s * 0.14, -0.95, 0.008], [s * 0.148, -1.86, 0.0], 0.014, 2.1));
    bones.add(longBone([s * 0.172, -0.97, -0.012], [s * 0.18, -1.865, -0.01], 0.0058, 1.8));
    // foot
    bones.add(ballGeo([s * 0.15, -1.9, -0.005], 0.02));
    bones.add(ballGeo([s * 0.15, -1.955, -0.035], 0.02, [1, 1.1, 1.75]));
    bones.add(ballGeo([s * 0.145, -1.935, 0.025], 0.016, [1.4, 0.8, 1]));
    const off0 = [-0.025, -0.01, 0.005, 0.02, 0.032];
    const off1 = [-0.03, -0.012, 0.005, 0.02, 0.034];
    const tip = [0.178, 0.17, 0.163, 0.155, 0.145];
    for (let t = 0; t < 5; t++) {
      const a: Vec3 = [s * (0.15 + off0[t]), -1.95, 0.035];
      const b: Vec3 = [s * (0.15 + off1[t]), -1.985, 0.12];
      bones.add(longBone(a, b, t === 0 ? 0.0058 : 0.0042, 1.6));
      bones.add(longBone(b, [s * (0.15 + off1[t] * 1.05), -1.992, tip[t]], t === 0 ? 0.005 : 0.0034, 1.5));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Organs                                                               */
/* ------------------------------------------------------------------ */

function lungGeo(s: number) {
  const p: Prim[] = [
    ellipsoid([s * 0.12, 0.89, -0.015], [0.1, 0.235, 0.115], 0.03),
    ellipsoid([s * 0.1, 1.07, -0.01], [0.058, 0.08, 0.058], 0.05),
    custom((x) => 0.032 - s * x, 0.02, 'int'),
    sphere([s * 0.11, 0.5, 0.0], 0.19, 0.03, 'sub'),
    // oblique fissure
    custom((_x, y, z) => Math.abs((y - 0.86) * 0.85 + z * 0.53) - 0.0022, 0.004, 'sub', [s > 0 ? 0 : -0.3, 0.5, -0.2], [s > 0 ? 0.3 : 0, 1.2, 0.2]),
  ];
  if (s > 0) p.push(ellipsoid([0.05, 0.8, 0.07], [0.07, 0.09, 0.07], 0.03, undefined, 'sub'));
  else p.push(custom((_x, y, z) => Math.max(Math.abs(y - 0.94) - 0.0022, -(z + 0.0)), 0.004, 'sub'));
  const lo: Vec3 = [s > 0 ? 0.0 : -0.24, 0.6, -0.14];
  const hi: Vec3 = [s > 0 ? 0.24 : 0.0, 1.17, 0.13];
  return surfaceNets(makeField(p), lo, hi, 0.0065, [0], 1)[0];
}

function heartGeo() {
  const p: Prim[] = [
    ellipsoid([0.045, 0.775, 0.045], [0.052, 0.072, 0.05], 0.03, [0, 0, 0.6]),
    ellipsoid([0.012, 0.785, 0.075], [0.05, 0.062, 0.04], 0.03, [0, 0, 0.5]),
    ellipsoid([-0.03, 0.83, 0.045], [0.035, 0.04, 0.035], 0.025),
    ellipsoid([0.04, 0.845, 0.0], [0.04, 0.03, 0.035], 0.025),
    ellipsoid([0.075, 0.72, 0.06], [0.025, 0.03, 0.025], 0.03),
    // interventricular groove
    custom((x, y, z) => Math.max(Math.abs((x - 0.03) * 0.75 + (y - 0.78) * 0.66) - 0.003, 0.085 - z), 0.006, 'sub'),
  ];
  const g = surfaceNets(makeField(p), [-0.1, 0.67, -0.06], [0.14, 0.91, 0.14], 0.0045, [0], 1)[0];
  // centre on the heart so it can beat in place
  g.translate(-0.03, -0.79, -0.045);
  return g;
}

function liverGeo() {
  const p: Prim[] = [
    ellipsoid([-0.085, 0.6, 0.015], [0.13, 0.075, 0.105], 0.04, [0, 0, -0.25]),
    ellipsoid([0.04, 0.625, 0.05], [0.085, 0.04, 0.06], 0.04, [0, 0, 0.2]),
    ellipsoid([-0.03, 0.48, 0.03], [0.18, 0.07, 0.15], 0.03, undefined, 'sub'),
  ];
  return surfaceNets(makeField(p), [-0.25, 0.47, -0.12], [0.16, 0.73, 0.15], 0.005, [0], 1)[0];
}

function kidneyGeo(s: number) {
  const p: Prim[] = [
    ellipsoid([s * 0.085, 0.44, -0.085], [0.03, 0.055, 0.022], 0.02, [0, 0, s * 0.15]),
    sphere([s * 0.052, 0.44, -0.08], 0.02, 0.012, 'sub'),
  ];
  return surfaceNets(makeField(p), [s * 0.085 - 0.05, 0.37, -0.12], [s * 0.085 + 0.05, 0.51, -0.05], 0.003, [0], 1)[0];
}

function organs(rng: () => number): Record<OrganKey, THREE.BufferGeometry> {
  const brain = new Bucket();
  for (const s of SIDES) brain.add(ballGeo([s * 0.054, 1.642, -0.02], 0.1, [0.57, 0.88, 1.38], [0, 0, 0], 48));
  brain.add(capsuleGeo([0, 1.565, -0.05], [0, 1.43, -0.065], 0.016));

  const eyes = new Bucket();
  for (const s of SIDES) {
    eyes.add(ballGeo([s * 0.044, 1.555, 0.128], 0.023, [1, 1, 1], [0, 0, 0], 20));
    eyes.add(tube([[s * 0.044, 1.555, 0.11], [s * 0.03, 1.56, 0.06], [s * 0.012, 1.57, 0.02]], 0.004, 12, 6)); // optic nerve
  }

  const lungs = new Bucket().add(lungGeo(-1)).add(lungGeo(1));

  // airway tree: larynx, trachea, bronchi and a few generations of branches
  const air = new Bucket();
  air.add(ballGeo([0, 1.285, 0.048], 0.022, [1, 1.1, 0.8]));
  air.add(tube([[0, 1.27, 0.045], [0, 1.15, 0.04], [0, 1.02, 0.02], [0, 0.95, 0.005]], 0.0105, 24, 10));
  const branch = (start: Vec3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
    const end: Vec3 = [start[0] + dir.x * len, start[1] + dir.y * len, start[2] + dir.z * len];
    air.add(tube([start, [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + 0.004, (start[2] + end[2]) / 2], end], taper(r, r * 0.75), 8, 6));
    if (depth <= 0) return;
    for (let b = 0; b < 2; b++) {
      const d = dir.clone();
      d.x += (rng() - 0.5) * 0.9 + (b ? 0.25 : -0.25) * Math.sign(dir.x || 1);
      d.y += (rng() - 0.6) * 0.8;
      d.z += (rng() - 0.5) * 0.9;
      d.normalize();
      branch(end, d, len * 0.72, r * 0.7, depth - 1);
    }
  };
  for (const s of SIDES) {
    air.add(tube([[0, 0.95, 0.005], [s * 0.04, 0.925, -0.005], [s * 0.075, 0.9, -0.01]], taper(0.0085, 0.0065), 12, 8));
    branch([s * 0.075, 0.9, -0.01], new THREE.Vector3(s * 0.4, 0.75, 0.1).normalize(), 0.05, 0.005, 3);
    branch([s * 0.075, 0.9, -0.01], new THREE.Vector3(s * 0.45, -0.85, 0.05).normalize(), 0.06, 0.0055, 3);
    branch([s * 0.075, 0.9, -0.01], new THREE.Vector3(s * 0.6, -0.4, -0.5).normalize(), 0.05, 0.0048, 3);
  }

  const kidneys = new Bucket().add(kidneyGeo(-1)).add(kidneyGeo(1));
  const adrenals = new Bucket();
  const urinary = new Bucket();
  for (const s of SIDES) {
    adrenals.add(ballGeo([s * 0.08, 0.5, -0.085], 0.018, [1, 0.55, 0.65], [0, 0, -s * 0.4], 12));
    urinary.add(tube([[s * 0.055, 0.42, -0.075], [s * 0.07, 0.25, -0.06], [s * 0.06, 0.05, -0.03], [s * 0.025, -0.02, 0.03]], 0.0028, 40, 6));
  }

  // small intestine: a long, densely folded tube packed into the abdomen
  const gut: Vec3[] = [];
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const y = 0.39 - (r * 0.29) / (rows - 1);
    const dirn = r % 2 ? -1 : 1;
    for (let c = 0; c <= 6; c++) {
      const t = c / 6;
      const x = (dirn > 0 ? -0.1 + 0.21 * t : 0.11 - 0.21 * t) + (rng() - 0.5) * 0.02;
      gut.push([x, y + Math.sin(c * 2.1 + r) * 0.016, 0.012 + (c % 2 ? 0.06 : 0.0) + rng() * 0.012]);
    }
  }
  const small = tube(gut, 0.0135, 700, 8);

  const colonPts: Vec3[] = [
    [-0.1, 0.08, 0.04], [-0.135, 0.15, 0.04], [-0.145, 0.32, 0.03], [-0.135, 0.45, 0.05], [-0.07, 0.465, 0.09],
    [0.0, 0.41, 0.1], [0.07, 0.45, 0.09], [0.14, 0.48, 0.04], [0.15, 0.35, 0.0], [0.145, 0.15, 0.01],
    [0.12, 0.05, 0.04], [0.06, 0.02, 0.05], [0.02, 0.03, 0.0], [0.0, -0.04, -0.05], [0.0, -0.1, -0.06],
  ];
  const colon = new Bucket()
    .add(tube(colonPts, (t) => (0.024 - 0.009 * t) * (1 + 0.17 * Math.abs(Math.sin(t * Math.PI * 40))), 320, 12))
    .add(ballGeo([-0.105, 0.07, 0.04], 0.026))
    .add(tube([[-0.11, 0.05, 0.045], [-0.1, 0.02, 0.06], [-0.085, 0.01, 0.06]], 0.004, 8, 6));

  const stomach = new Bucket()
    .add(tube([[0, 1.3, 0.0], [0, 1.1, -0.012], [0.005, 0.9, -0.04], [0.02, 0.75, -0.03], [0.055, 0.68, 0.0]], 0.0085, 48, 8)) // oesophagus
    .add(
      tube(
        [[0.055, 0.68, 0.0], [0.1, 0.69, 0.0], [0.135, 0.64, 0.025], [0.13, 0.57, 0.05], [0.09, 0.53, 0.07], [0.04, 0.53, 0.07], [0.0, 0.55, 0.06], [-0.025, 0.56, 0.05]],
        (t) => 0.012 + 0.04 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.12)), 0.7) * (1 - 0.4 * t),
        64,
        16
      )
    );

  const thyroid = new Bucket();
  for (const s of SIDES) thyroid.add(ballGeo([s * 0.017, 1.225, 0.05], 0.012, [1, 1.7, 0.8]));
  thyroid.add(capsuleGeo([-0.012, 1.215, 0.058], [0.012, 1.215, 0.058], 0.005));

  return {
    brain: brain.merge(),
    cerebellum: ballGeo([0, 1.535, -0.1], 0.06, [1.5, 0.65, 0.9], [0.25, 0, 0], 32),
    eyes: eyes.merge(),
    lungs: lungs.merge(),
    airways: air.merge(),
    heart: heartGeo(),
    liver: liverGeo(),
    gallbladder: ballGeo([-0.06, 0.54, 0.085], 0.015, [1, 1.7, 0.9], [0, 0, 0.4]),
    stomach: stomach.merge(),
    spleen: ballGeo([0.16, 0.6, -0.06], 0.04, [0.65, 1.2, 1.0], [0.2, 0, -0.3]),
    pancreas: tube([[-0.04, 0.5, 0.03], [0.02, 0.51, 0.0], [0.08, 0.53, -0.02], [0.14, 0.56, -0.04]], taper(0.017, 0.008), 32, 10),
    kidneys: kidneys.merge(),
    adrenals: adrenals.merge(),
    urinary: urinary.merge(),
    bladder: ballGeo([0, -0.03, 0.05], 0.035, [1.2, 1, 1]),
    smallIntestine: small,
    colon: colon.merge(),
    thyroid: thyroid.merge(),
  };
}

/* ------------------------------------------------------------------ */
/* Vessels and nerves                                                   */
/* ------------------------------------------------------------------ */

function vessels(field: Field, rng: () => number) {
  const art = new Bucket();
  const head = new Bucket();
  const vein = new Bucket();
  const leg = new Bucket();
  const nerve = new Bucket();

  /** Fine branches sprouting from a vessel, kept inside the skin. */
  const twigs = (bucket: Bucket, path: Vec3[], count: number, r: number, reach = 0.05) => {
    const curve = new THREE.CatmullRomCurve3(path.map(v3));
    for (let i = 0; i < count; i++) {
      const p = curve.getPoint(0.06 + 0.9 * rng());
      const pts: Vec3[] = [[p.x, p.y, p.z]];
      const dir = new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 1.4, rng() - 0.5).normalize();
      for (let k = 0; k < 3; k++) {
        const last = pts[pts.length - 1];
        dir.x += (rng() - 0.5) * 0.7;
        dir.y += (rng() - 0.5) * 0.7;
        dir.z += (rng() - 0.5) * 0.7;
        dir.normalize();
        const step = reach * (0.5 + rng() * 0.5);
        const q: Vec3 = [last[0] + dir.x * step, last[1] + dir.y * step, last[2] + dir.z * step];
        if (field(q[0], q[1], q[2]) > -0.006) break;
        pts.push(q);
      }
      if (pts.length >= 3) bucket.add(tube(pts, taper(r, r * 0.45), 10, 5));
    }
  };

  // aorta: ascending, arch, descending
  const aorta: Vec3[] = [[0.025, 0.84, 0.055], [0.03, 0.9, 0.05], [0.015, 0.955, 0.02], [0.01, 0.95, -0.04], [0.015, 0.88, -0.065], [0.015, 0.7, -0.07], [0.01, 0.5, -0.055], [0.005, 0.3, -0.045], [0.0, 0.15, -0.04]];
  art.add(tube(aorta, taper(0.015, 0.01), 80, 12));
  // pulmonary trunk and arteries (deoxygenated, drawn blue)
  vein.add(tube([[0.01, 0.84, 0.085], [0.02, 0.89, 0.07], [0.0, 0.915, 0.03]], 0.011, 16, 10));
  for (const s of SIDES) vein.add(tube([[0.0, 0.915, 0.03], [s * 0.05, 0.91, 0.0], [s * 0.09, 0.9, -0.02]], taper(0.008, 0.006), 16, 8));
  // coronary arteries on the heart surface
  art.add(tube([[0.03, 0.835, 0.095], [0.045, 0.795, 0.12], [0.065, 0.745, 0.105], [0.08, 0.705, 0.075]], 0.0028, 20, 5));
  art.add(tube([[0.02, 0.835, 0.09], [-0.02, 0.81, 0.095], [-0.045, 0.77, 0.06], [-0.03, 0.74, 0.02]], 0.0026, 20, 5));
  vein.add(tube([[0.06, 0.82, 0.03], [0.09, 0.78, 0.04], [0.095, 0.73, 0.06]], 0.0026, 16, 5));

  // arch branches
  art.add(tube([[0.0, 0.955, 0.025], [-0.025, 1.02, 0.03], [-0.035, 1.07, 0.03]], 0.0085, 16, 8));
  const neckArt = (s: number): Vec3[] => (s < 0 ? [[-0.035, 1.07, 0.03]] : [[0.012, 0.955, 0.015], [0.035, 1.07, 0.03]]);
  for (const s of SIDES) {
    const car: Vec3[] = [...neckArt(s), [s * 0.04, 1.2, 0.035], [s * 0.045, 1.35, 0.03], [s * 0.05, 1.42, 0.02]];
    head.add(tube(car, taper(0.0068, 0.0058), 32, 8));
    head.add(tube([[s * 0.05, 1.42, 0.02], [s * 0.07, 1.47, 0.07], [s * 0.065, 1.52, 0.125]], taper(0.0042, 0.0028), 16, 6));
    head.add(tube([[s * 0.05, 1.42, 0.02], [s * 0.1, 1.5, 0.0], [s * 0.135, 1.6, 0.0], [s * 0.115, 1.7, 0.03], [s * 0.06, 1.75, 0.05]], taper(0.0035, 0.002), 24, 5));
    head.add(tube([[s * 0.05, 1.42, 0.02], [s * 0.03, 1.5, -0.01], [s * 0.02, 1.56, 0.0]], 0.0042, 16, 6));
    head.add(tube([[s * 0.02, 1.56, 0.0], [s * 0.07, 1.6, 0.03], [s * 0.1, 1.66, -0.02], [s * 0.08, 1.72, -0.07]], taper(0.0028, 0.0016), 20, 5));
    head.add(tube([[s * 0.02, 1.56, 0.0], [s * 0.015, 1.66, 0.06], [s * 0.01, 1.74, 0.0]], taper(0.0025, 0.0015), 16, 5));
    head.add(tube([[s * 0.06, 1.47, 0.07], [s * 0.04, 1.43, 0.12], [s * 0.01, 1.415, 0.13]], 0.002, 12, 5));

    // subclavian and the arm
    const sub: Vec3[] = s < 0 ? [[-0.035, 1.07, 0.03], [-0.12, 1.1, 0.02]] : [[0.015, 0.955, -0.01], [0.06, 1.06, 0.0], [0.14, 1.1, 0.01]];
    const brachial: Vec3[] = [...sub, [s * 0.24, 1.08, 0.0], [s * 0.32, 1.0, 0.0], [s * 0.36, 0.85, 0.02], [s * 0.395, 0.65, 0.02], [s * 0.42, 0.52, 0.01]];
    art.add(tube(brachial, taper(0.0075, 0.0052), 48, 8));
    const radial: Vec3[] = [[s * 0.42, 0.52, 0.01], [s * 0.44, 0.35, 0.035], [s * 0.465, 0.12, 0.045], [s * 0.478, 0.0, 0.05]];
    const ulnar: Vec3[] = [[s * 0.42, 0.52, 0.01], [s * 0.425, 0.35, 0.0], [s * 0.45, 0.12, 0.015], [s * 0.47, 0.0, 0.02]];
    art.add(tube(radial, taper(0.0042, 0.0032), 32, 6));
    art.add(tube(ulnar, taper(0.0042, 0.0032), 32, 6));
    art.add(tube([[s * 0.478, 0.0, 0.05], [s * 0.49, -0.08, 0.055], [s * 0.49, -0.085, 0.02], [s * 0.475, -0.02, 0.02]], 0.0024, 16, 5));
    twigs(art, brachial.slice(-4), 7, 0.0026);
    twigs(art, radial, 4, 0.0022, 0.04);
    twigs(art, ulnar, 4, 0.0022, 0.04);

    // abdomen
    art.add(tube([[0.0, 0.45, -0.05], [s * 0.035, 0.45, -0.065], [s * 0.06, 0.445, -0.077]], 0.0042, 10, 6));
    vein.add(tube([[-0.022, 0.44, -0.04], [s * 0.03, 0.44, -0.06], [s * 0.06, 0.435, -0.072]], 0.0048, 10, 6));

    // iliac, femoral, popliteal and tibial arteries
    const femA: Vec3[] = [[0.0, 0.15, -0.04], [s * 0.05, 0.08, -0.02], [s * 0.085, 0.0, 0.03], [s * 0.11, -0.12, 0.055], [s * 0.12, -0.4, 0.04], [s * 0.125, -0.7, 0.0], [s * 0.14, -0.93, -0.04]];
    art.add(tube(femA, taper(0.0095, 0.0068), 64, 8));
    const antTib: Vec3[] = [[s * 0.14, -0.93, -0.04], [s * 0.155, -1.0, 0.0], [s * 0.16, -1.4, 0.025], [s * 0.155, -1.85, 0.03], [s * 0.155, -1.95, 0.08], [s * 0.16, -1.97, 0.14]];
    const postTib: Vec3[] = [[s * 0.14, -0.93, -0.04], [s * 0.135, -1.2, -0.035], [s * 0.135, -1.6, -0.025], [s * 0.14, -1.88, -0.01], [s * 0.145, -1.97, 0.04]];
    art.add(tube(antTib, taper(0.0048, 0.0028), 48, 6));
    art.add(tube(postTib, taper(0.0048, 0.003), 48, 6));
    art.add(tube([[s * 0.11, -0.15, 0.05], [s * 0.15, -0.3, 0.0], [s * 0.155, -0.6, -0.03]], taper(0.0055, 0.0035), 24, 6));
    art.add(tube([[s * 0.05, 0.08, -0.02], [s * 0.07, -0.02, -0.05], [s * 0.06, -0.08, -0.04]], 0.0035, 12, 6));
    twigs(art, femA.slice(3), 9, 0.003, 0.06);
    twigs(art, antTib, 6, 0.0024, 0.05);
    twigs(art, postTib, 5, 0.0024, 0.05);

    // digital arteries along the fingers
    const kz = [0.068, 0.046, 0.025, 0.006];
    for (let f = 0; f < 4; f++) art.add(tube([[s * 0.49, -0.085, kz[f] * 0.9 + 0.005], [s * 0.488, -0.13, kz[f]], [s * 0.475, -0.18, kz[f]], [s * 0.46, -0.215 + f * 0.012, kz[f]]], 0.0016, 12, 4));

    // veins: jugulars, subclavian, arm
    vein.add(tube([[s * 0.055, 1.065, 0.04], [s * 0.06, 1.2, 0.035], [s * 0.06, 1.35, 0.02], [s * 0.06, 1.42, 0.0]], taper(0.0085, 0.006), 32, 8));
    vein.add(tube([[s * 0.06, 1.12, 0.042], [s * 0.075, 1.25, 0.04], [s * 0.085, 1.4, 0.02], [s * 0.1, 1.5, 0.02]], 0.0028, 24, 5));
    vein.add(tube([[s * 0.055, 1.065, 0.04], [s * 0.14, 1.09, 0.03], [s * 0.25, 1.06, 0.015], [s * 0.33, 0.98, 0.015]], 0.0062, 24, 8));
    const basilic: Vec3[] = [[s * 0.33, 0.98, 0.015], [s * 0.36, 0.8, -0.02], [s * 0.405, 0.55, -0.015], [s * 0.43, 0.3, -0.01], [s * 0.46, 0.02, 0.0]];
    const cephalic: Vec3[] = [[s * 0.3, 1.1, 0.03], [s * 0.38, 0.95, 0.04], [s * 0.415, 0.7, 0.035], [s * 0.44, 0.48, 0.04], [s * 0.455, 0.25, 0.05], [s * 0.475, 0.02, 0.055]];
    vein.add(tube(basilic, taper(0.0048, 0.0032), 40, 6));
    vein.add(tube(cephalic, taper(0.004, 0.003), 40, 6));
    vein.add(tube([[s * 0.415, 0.5, 0.035], [s * 0.42, 0.48, 0.01], [s * 0.425, 0.45, -0.012]], 0.0028, 8, 5));
    twigs(vein, cephalic, 5, 0.0022, 0.045);

    // leg veins: femoral and the great and small saphenous
    const femV: Vec3[] = [[-0.01, 0.14, -0.035], [s * 0.055, 0.07, -0.025], [s * 0.095, 0.0, 0.02], [s * 0.125, -0.12, 0.045], [s * 0.135, -0.4, 0.025], [s * 0.14, -0.7, -0.01], [s * 0.15, -0.93, -0.045], [s * 0.15, -1.2, -0.045], [s * 0.145, -1.6, -0.03], [s * 0.15, -1.88, -0.015]];
    leg.add(tube(femV, taper(0.0105, 0.005), 90, 8));
    const gsv: Vec3[] = [[s * 0.11, -0.1, 0.065], [s * 0.085, -0.4, 0.045], [s * 0.095, -0.8, 0.0], [s * 0.11, -1.0, -0.02], [s * 0.115, -1.4, 0.0], [s * 0.125, -1.82, 0.02], [s * 0.13, -1.94, 0.06]];
    leg.add(tube(gsv, taper(0.0038, 0.0028), 80, 6));
    leg.add(tube([[s * 0.15, -0.95, -0.05], [s * 0.155, -1.2, -0.085], [s * 0.16, -1.5, -0.06], [s * 0.17, -1.88, -0.03]], taper(0.0032, 0.0024), 48, 5));
    leg.add(tube([[s * 0.13, -1.94, 0.06], [s * 0.16, -1.955, 0.1], [s * 0.19, -1.94, 0.05]], 0.0022, 12, 5));
    twigs(leg, gsv, 9, 0.0024, 0.05);
    twigs(leg, femV.slice(3), 6, 0.0026, 0.05);

    // nerves: brachial plexus to the median nerve, sciatic to the tibial nerve
    nerve.add(tube([[s * 0.03, 1.22, -0.05], [s * 0.15, 1.08, 0.0], [s * 0.3, 1.0, 0.005], [s * 0.37, 0.8, 0.01], [s * 0.42, 0.52, 0.02], [s * 0.45, 0.25, 0.03], [s * 0.48, 0.0, 0.035], [s * 0.488, -0.08, 0.04]], taper(0.004, 0.0025), 64, 6));
    nerve.add(tube([[s * 0.04, 0.05, -0.09], [s * 0.11, -0.12, -0.075], [s * 0.13, -0.5, -0.06], [s * 0.14, -0.9, -0.05], [s * 0.14, -1.3, -0.04], [s * 0.145, -1.85, -0.02]], taper(0.0055, 0.0028), 64, 6));
    nerve.add(tube([[s * 0.14, -0.9, -0.05], [s * 0.175, -1.0, -0.02], [s * 0.17, -1.4, 0.02], [s * 0.16, -1.9, 0.05]], 0.0022, 32, 5));
    nerve.add(tube([[s * 0.04, 0.42, -0.08], [s * 0.12, 0.3, -0.03], [s * 0.13, 0.05, 0.04], [s * 0.12, -0.2, 0.06], [s * 0.12, -0.6, 0.05]], taper(0.0035, 0.002), 40, 5));
  }

  // venae cavae
  vein.add(tube([[-0.025, 0.84, 0.04], [-0.03, 0.93, 0.03], [-0.03, 1.0, 0.03]], 0.011, 16, 10));
  vein.add(tube([[-0.03, 1.0, 0.03], [-0.05, 1.06, 0.04]], 0.008, 8, 8));
  vein.add(tube([[-0.03, 1.0, 0.03], [0.02, 1.04, 0.045], [0.055, 1.065, 0.04]], 0.008, 12, 8));
  vein.add(tube([[-0.02, 0.82, 0.03], [-0.03, 0.72, 0.0], [-0.025, 0.5, -0.04], [-0.022, 0.3, -0.04], [-0.01, 0.14, -0.035]], 0.012, 48, 10));
  vein.add(tube([[0, 1.72, 0.06], [0, 1.775, -0.03], [0, 1.72, -0.135], [0, 1.6, -0.165], [0, 1.5, -0.12]], 0.004, 32, 6)); // sagittal sinus

  // intercostal arteries under each rib
  for (let i = 1; i < 11; i++) {
    const ys = 1.13 - i * 0.045 - 0.012;
    for (const s of SIDES) {
      const pts: Vec3[] = [];
      for (let q = 0; q <= 8; q++) {
        const th = Math.PI * (0.08 + 0.6 * (q / 8));
        const W = 0.13 + Math.min(i, 6) * 0.013;
        pts.push([s * (0.024 + W * Math.sin(th)), ys - 0.15 * Math.pow(th / Math.PI, 1.4), -0.015 - (th <= Math.PI / 2 ? 0.085 * Math.cos(th) + 0.035 * Math.sin(th * 2) : 0.13 * Math.cos(th))]);
      }
      art.add(tube(pts, 0.0016, 20, 4));
    }
  }

  // spinal cord with the cauda equina
  const cord: Vec3[] = [];
  for (let y = 1.47; y >= 0.5; y -= 0.06) cord.push([0, y, spineZ(y) - 0.032]);
  nerve.add(tube(cord, taper(0.0065, 0.0045), 60, 8));
  for (const s of SIDES) for (let i = 0; i < 3; i++) nerve.add(tube([[0, 0.5, spineZ(0.5) - 0.032], [s * 0.008 * (i + 1), 0.3, spineZ(0.3) - 0.03], [s * (0.015 + i * 0.01), 0.1, -0.09]], 0.0018, 12, 4));

  return { arteries: art.merge(), headArteries: head.merge(), veins: vein.merge(), legVeins: leg.merge(), nerves: nerve.merge() };
}

/* ------------------------------------------------------------------ */

let cache: AnatomyGeometry | null = null;

export function getAnatomyGeometry(): AnatomyGeometry {
  if (cache) return cache;
  const t0 = performance.now();
  const rng = mulberry32(7);
  const field = makeField(bodyPrims());
  const [skin, muscle] = surfaceNets(field, [-0.62, -2.03, -0.25], [0.62, 1.82, 0.25], 0.0145, [0, -0.011], 2);

  // fingers and thumbs are thinner than the grid, so they are added as capsules
  const skinB = new Bucket().add(skin);
  for (const s of SIDES) {
    const kz = [0.068, 0.046, 0.025, 0.006];
    const len = [0.088, 0.099, 0.093, 0.072];
    for (let f = 0; f < 4; f++) {
      let p: Vec3 = [s * 0.486, -0.12, kz[f]];
      let curl = 0.12;
      for (let ph = 0; ph < 3; ph++) {
        const L = len[f] * [0.48, 0.3, 0.22][ph];
        const q: Vec3 = [p[0] - s * Math.sin(curl) * L, p[1] - Math.cos(curl) * L, p[2]];
        skinB.add(capsuleGeo(p, q, 0.0112 - ph * 0.001, 8));
        p = q;
        curl += 0.16;
      }
    }
    const th: Vec3[] = [[s * 0.48, -0.04, 0.062], [s * 0.471, -0.085, 0.097], [s * 0.465, -0.118, 0.117], [s * 0.461, -0.146, 0.127]];
    for (let t = 0; t < 3; t++) skinB.add(capsuleGeo(th[t], th[t + 1], 0.0135 - t * 0.0012, 8));
    const toeOff = [-0.03, -0.012, 0.005, 0.02, 0.034];
    const toeTip = [0.185, 0.176, 0.168, 0.16, 0.15];
    for (let t = 0; t < 5; t++) skinB.add(capsuleGeo([s * (0.15 + toeOff[t]), -1.988, 0.13], [s * (0.15 + toeOff[t] * 1.05), -1.99, toeTip[t]], t === 0 ? 0.012 : 0.0085, 8));
  }

  const bones = new Bucket();
  const cart = new Bucket();
  skeleton(bones, cart);

  const out: AnatomyGeometry = {
    skin: skinB.merge(),
    muscle,
    bones: bones.merge(),
    cartilage: cart.merge(),
    organs: organs(rng),
    ...vessels(field, rng),
    buildMs: 0,
  };
  out.buildMs = performance.now() - t0;
  cache = out;
  return out;
}
