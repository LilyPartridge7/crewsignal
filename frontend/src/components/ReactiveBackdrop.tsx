import { useRef, useEffect, useState } from 'react';

export type BackdropMode = 'video' | 'ambient' | 'paused';
export type BackdropFit = 'wide' | 'cover';

interface ReactiveBackdropProps {
  theme: 'light' | 'dark';
  operationalMode?: 'spacecraft' | 'clinic';
  mode?: BackdropMode;
  fit?: BackdropFit;
}

/**
 * Full-screen background footage.
 * Dark theme: warp-speed starfield. Light theme: crewed station over a dusk planet.
 * The footage plays at full strength; a single directional scrim keeps text legible
 * on the left, where headlines sit, and leaves the rest of the frame clear.
 */
type Quality = '720' | '1080' | 'none';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
}

/**
 * Pick the lightest footage that still looks sharp on this screen:
 * - Data saver or a 2G link: no video, the poster and painted backdrop only.
 * - A 3G link, under ~5 Mbps, or a screen that needs fewer than 1000 device
 *   pixels of height: the 720p file (1.4–3.2 MB).
 * - Otherwise the 1080p file (4–8 MB). Nothing heavier is ever sent, since the
 *   footage sits behind a scrim and frosted panels.
 */
function pickQuality(): Quality {
  if (typeof window === 'undefined') return '720';
  const net = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (net?.saveData || /(^|-)2g$/.test(net?.effectiveType ?? '')) return 'none';
  const slow = net?.effectiveType === '3g' || (net?.downlink !== undefined && net.downlink > 0 && net.downlink < 5);
  const devicePx = Math.max(window.innerHeight, window.innerWidth * (9 / 16)) * Math.min(window.devicePixelRatio || 1, 2);
  return slow || devicePx < 1000 ? '720' : '1080';
}

export default function ReactiveBackdrop({ theme, mode = 'video', fit = 'cover' }: ReactiveBackdropProps) {
  const isDark = theme === 'dark';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [quality] = useState<Quality>(pickQuality);
  const [ready, setReady] = useState(false);
  const name = isDark ? 'dark-space-loop' : 'light-earth-loop';
  const poster = `/bg/${name}-poster.webp`;

  // Fetch the other theme's poster when the browser is idle, so switching themes never flashes.
  useEffect(() => {
    const other = `/bg/${isDark ? 'light-earth-loop' : 'dark-space-loop'}-poster.webp`;
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => {
      const img = new Image();
      img.src = other;
    });
  }, [isDark]);

  useEffect(() => setReady(false), [isDark]);

  // Play only while it is wanted and visible: paused mode, reduced motion and a hidden tab all stop decoding.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const sync = () => {
      if (mode === 'paused' || reduced || document.hidden) v.pause();
      else if (mode === 'video') v.play().catch(() => undefined);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [mode, theme, quality]);

  const showVideo = mode !== 'ambient' && quality !== 'none';

  return (
    <div className="pointer-events-none fixed inset-0 -z-50 overflow-hidden select-none [transform:translateZ(0)] [contain:strict]" aria-hidden="true">
      {/* Painted stand-in: shows instantly, and is the whole backdrop in "ambient" mode */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 70% 60% at 55% 45%, #16203f 0%, #0a0c1c 55%, #05060f 100%)'
            : 'radial-gradient(circle at 92% 30%, rgba(255,233,240,0.9) 0 18%, transparent 19%), linear-gradient(180deg, #2a2346 0%, #6a4f72 55%, #c48a92 100%)',
        }}
      />

      {/* First frame as a 14–50 KB still: on screen at once, while the footage streams in behind it */}
      {mode !== 'ambient' && (
        <img src={poster} alt="" decoding="async" className={`absolute inset-0 h-full w-full ${fit === 'wide' ? 'object-contain' : 'object-cover'} object-center`} />
      )}

      {showVideo && (
        <video
          ref={videoRef}
          key={`${name}-${quality}`}
          autoPlay={mode === 'video'}
          loop
          muted
          playsInline
          preload="auto"
          poster={poster}
          onPlaying={() => setReady(true)}
          className={`absolute inset-0 h-full w-full ${fit === 'wide' ? 'object-contain' : 'object-cover'} object-center transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
        >
          <source src={`/bg/${name}-${quality}.mp4`} type="video/mp4" />
        </video>
      )}

      {/* One scrim, strongest behind the content column on the left */}
      <div
        className="absolute inset-0 transition-[background] duration-700"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, rgba(8,8,22,0.62) 0%, rgba(8,8,22,0.28) 45%, rgba(8,8,22,0.10) 100%), linear-gradient(180deg, rgba(8,8,22,0.25) 0%, transparent 25%, transparent 70%, rgba(8,8,22,0.55) 100%)'
            : 'linear-gradient(90deg, rgba(243,238,247,0.55) 0%, rgba(243,238,247,0.18) 45%, rgba(243,238,247,0) 100%), linear-gradient(180deg, rgba(243,238,247,0.25) 0%, transparent 30%, transparent 75%, rgba(243,238,247,0.35) 100%)',
        }}
      />
    </div>
  );
}

export { ReactiveBackdrop };
