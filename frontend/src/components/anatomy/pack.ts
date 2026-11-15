import * as THREE from 'three';
import type { AnatomyGeometry } from './geometry';

interface PackedGeo {
  position: Float32Array;
  normal: Float32Array;
  index: Uint32Array | null;
}
type Packed = { [K in keyof AnatomyGeometry]: AnatomyGeometry[K] extends THREE.BufferGeometry ? PackedGeo : AnatomyGeometry[K] extends Record<string, THREE.BufferGeometry> ? Record<string, PackedGeo> : AnatomyGeometry[K] };

function packGeo(g: THREE.BufferGeometry, transfer: Transferable[]): PackedGeo {
  const position = new Float32Array((g.getAttribute('position') as THREE.BufferAttribute).array);
  const normal = new Float32Array((g.getAttribute('normal') as THREE.BufferAttribute).array);
  const index = g.index ? new Uint32Array(g.index.array) : null;
  transfer.push(position.buffer, normal.buffer);
  if (index) transfer.push(index.buffer);
  return { position, normal, index };
}

function unpackGeo(p: PackedGeo) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(p.normal, 3));
  if (p.index) g.setIndex(new THREE.BufferAttribute(p.index, 1));
  g.computeBoundingSphere();
  return g;
}

export function packAnatomy(a: AnatomyGeometry) {
  const transfer: Transferable[] = [];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) {
    if (v instanceof THREE.BufferGeometry) out[k] = packGeo(v, transfer);
    else if (v && typeof v === 'object') out[k] = Object.fromEntries(Object.entries(v as Record<string, THREE.BufferGeometry>).map(([n, g]) => [n, packGeo(g, transfer)]));
    else out[k] = v;
  }
  return { data: out as Packed, transfer };
}

export function unpackAnatomy(p: Packed): AnatomyGeometry {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v && typeof v === 'object' && 'position' in v) out[k] = unpackGeo(v as PackedGeo);
    else if (v && typeof v === 'object') out[k] = Object.fromEntries(Object.entries(v as Record<string, PackedGeo>).map(([n, g]) => [n, unpackGeo(g)]));
    else out[k] = v;
  }
  return out as unknown as AnatomyGeometry;
}
