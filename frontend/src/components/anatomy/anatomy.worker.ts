/// <reference lib="webworker" />
import { getAnatomyGeometry } from './geometry';
import { packAnatomy } from './pack';

// Sculpting the anatomy takes a moment, so it runs off the main thread.
const packed = packAnatomy(getAnatomyGeometry());
(self as unknown as DedicatedWorkerGlobalScope).postMessage(packed.data, packed.transfer);
