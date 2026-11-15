import { useRef, useEffect } from 'react';

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
export default function ReactiveBackdrop({ theme, mode = 'video', fit = 'cover' }: ReactiveBackdropProps) {
  const isDark = theme === 'dark';
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (mode === 'paused' || reduced) v.pause();
    else if (mode === 'video') v.play().catch(() => undefined);
  }, [mode, theme]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-50 overflow-hidden select-none" aria-hidden="true">
      {/* Painted stand-in: shows instantly, and is the whole backdrop in "ambient" mode */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 70% 60% at 55% 45%, #16203f 0%, #0a0c1c 55%, #05060f 100%)'
            : 'radial-gradient(circle at 92% 30%, rgba(255,233,240,0.9) 0 18%, transparent 19%), linear-gradient(180deg, #2a2346 0%, #6a4f72 55%, #c48a92 100%)',
        }}
      />

      {mode !== 'ambient' && (
        <video
          ref={videoRef}
          key={isDark ? 'dark' : 'light'}
          autoPlay={mode === 'video'}
          loop
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 h-full w-full ${fit === 'wide' ? 'object-contain' : 'object-cover'} object-center`}
        >
          <source src={isDark ? '/dark-space-loop.mp4' : '/light-earth-loop.mp4'} type="video/mp4" />
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
