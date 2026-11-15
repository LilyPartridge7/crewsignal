import type { AnatomyGeometry } from './geometry';
import { unpackAnatomy } from './pack';

let pending: Promise<AnatomyGeometry> | null = null;

/** Build the anatomy once per page, in a worker when the browser allows it. */
export function loadAnatomy(): Promise<AnatomyGeometry> {
  if (pending) return pending;
  pending = new Promise<AnatomyGeometry>((resolve, reject) => {
    const fallback = () => import('./geometry').then((m) => resolve(m.getAnatomyGeometry()), reject);
    if (typeof Worker === 'undefined') {
      fallback();
      return;
    }
    try {
      const worker = new Worker(new URL('./anatomy.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        resolve(unpackAnatomy(e.data));
        worker.terminate();
      };
      worker.onerror = () => {
        worker.terminate();
        fallback();
      };
    } catch {
      fallback();
    }
  });
  return pending;
}
