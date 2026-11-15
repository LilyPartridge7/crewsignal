import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import maleUrl from 'open-anatomy-3d/models/anatomy-male.glb?url';
import femaleUrl from 'open-anatomy-3d/models/anatomy-female.glb?url';
import catalog from 'open-anatomy-3d/catalog.json';

/**
 * Loads the open-anatomy-3d models: BodyParts3D anatomy (© DBCLS, CC BY 4.0)
 * split into ~130 named structures. Geometry is converted into "body units"
 * (feet at y = -2, crown at y = 1.79, facing +z, crew member's left at +x)
 * so shaders and hotspots can work in one fixed space.
 */

export const ANATOMY_CREDIT =
  'Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0); female organs: Human Reference Atlas, HuBMAP (CC BY 4.0); female body: MakeHuman (CC0). Modified by open-anatomy-3d, CC BY 4.0.';
export const ANATOMY_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';

export type Sex = 'male' | 'female';
export type BodySystem = 'skin' | 'skeleton' | 'muscles' | 'organs' | 'vessels' | 'nerves';

export interface Structure {
  key: string;
  label: string;
  system: BodySystem;
  geometry: THREE.BufferGeometry;
  box: THREE.Box3;
  center: THREE.Vector3;
}

export interface AnatomyModel {
  sex: Sex;
  structures: Structure[];
  byKey: Map<string, Structure>;
}

interface CatalogEntry {
  key: string;
  label: string;
  system: string;
}
const CATALOG = new Map((catalog as CatalogEntry[]).map((c) => [c.key, c]));
const SYSTEMS: BodySystem[] = ['skin', 'skeleton', 'muscles', 'organs', 'vessels', 'nerves'];

const FEET = -2.0;
const HEIGHT = 3.79;

/** Copy a (possibly quantized or interleaved) geometry into plain float arrays. */
function toFloat(src: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  const copy = (name: string) => {
    const a = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) return;
    const out = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) {
      out[i * 3] = a.getX(i);
      out[i * 3 + 1] = a.getY(i);
      out[i * 3 + 2] = a.getZ(i);
    }
    g.setAttribute(name, new THREE.BufferAttribute(out, 3));
  };
  copy('position');
  copy('normal');
  if (src.index) g.setIndex(new THREE.BufferAttribute(new Uint32Array(src.index.array), 1));
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}

const cache = new Map<Sex, Promise<AnatomyModel>>();

export function loadAnatomyModel(sex: Sex, onProgress?: (fraction: number) => void): Promise<AnatomyModel> {
  const hit = cache.get(sex);
  if (hit) return hit;
  const p = new Promise<AnatomyModel>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      sex === 'male' ? maleUrl : femaleUrl,
      (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const raw: { key: string; system: BodySystem; geometry: THREE.BufferGeometry }[] = [];
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const key = mesh.name || mesh.parent?.name || 'structure';
          let groupName = '';
          for (let q: THREE.Object3D | null = mesh.parent; q; q = q.parent) if (SYSTEMS.includes(q.name as BodySystem)) groupName = q.name;
          const cat = CATALOG.get(key);
          const system = (SYSTEMS.includes(cat?.system as BodySystem) ? cat?.system : groupName || 'organs') as BodySystem;
          const geometry = toFloat(mesh.geometry);
          geometry.applyMatrix4(mesh.matrixWorld);
          raw.push({ key, system, geometry });
        });

        // Normalise: face +z, feet at FEET, height HEIGHT, centred on x and z.
        const centreOf = (k: string) => {
          const r = raw.find((x) => x.key === k);
          if (!r) return null;
          r.geometry.computeBoundingBox();
          return r.geometry.boundingBox!.getCenter(new THREE.Vector3());
        };
        const eye = centreOf('eye_l') ?? centreOf('eye_r');
        const brain = centreOf('brain');
        const all = new THREE.Box3();
        raw.forEach((r) => {
          r.geometry.computeBoundingBox();
          all.union(r.geometry.boundingBox!);
        });
        const size = all.getSize(new THREE.Vector3());
        const mid = all.getCenter(new THREE.Vector3());
        const s = HEIGHT / size.y;
        const m = new THREE.Matrix4().makeTranslation(-mid.x, -all.min.y, -mid.z);
        if (eye && brain && eye.z < brain.z) m.premultiply(new THREE.Matrix4().makeRotationY(Math.PI));
        m.premultiply(new THREE.Matrix4().makeScale(s, s, s));
        m.premultiply(new THREE.Matrix4().makeTranslation(0, FEET, 0));

        const structures: Structure[] = raw.map((r) => {
          r.geometry.applyMatrix4(m);
          r.geometry.computeBoundingBox();
          r.geometry.computeBoundingSphere();
          const box = r.geometry.boundingBox!.clone();
          return { key: r.key, label: CATALOG.get(r.key)?.label ?? r.key.replace(/_/g, ' '), system: r.system, geometry: r.geometry, box, center: box.getCenter(new THREE.Vector3()) };
        });
        resolve({ sex, structures, byKey: new Map(structures.map((x) => [x.key, x])) });
      },
      (e) => {
        if (onProgress && e.total) onProgress(e.loaded / e.total);
      },
      (err) => {
        cache.delete(sex);
        reject(err);
      }
    );
  });
  cache.set(sex, p);
  return p;
}

/**
 * Resolve a hotspot anchor such as "heart" or "carotid_l@0.7" (a point 70%
 * of the way up that structure's bounding box) to a position in body units.
 */
export function anchorPosition(model: AnatomyModel, anchor: string): THREE.Vector3 | null {
  const [key, frac] = anchor.split('@');
  const st = model.byKey.get(key);
  if (!st) return null;
  const p = st.center.clone();
  if (frac !== undefined) p.y = st.box.min.y + (st.box.max.y - st.box.min.y) * Number(frac);
  return p;
}
