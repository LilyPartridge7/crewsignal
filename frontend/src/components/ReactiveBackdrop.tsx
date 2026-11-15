import { useRef, useEffect } from 'react';

export type BackdropMode = 'video' | 'ambient' | 'paused';
export type BackdropFit = 'wide' | 'cover';

interface ReactiveBackdropProps {
  theme: 'light' | 'dark';
  operationalMode?: 'spacecraft' | 'clinic';
  mode?: BackdropMode;
  fit?: BackdropFit;
}

export default function ReactiveBackdrop({
  theme,
  mode = 'video',
  fit = 'cover', // Default to cover for seamless, full-viewport aerospace atmosphere
}: ReactiveBackdropProps) {
  const isDark = theme === 'dark';
  const videoRef = useRef<HTMLVideoElement>(null);

  // Maintain smooth playback control
  useEffect(() => {
    if (!videoRef.current) return;
    if (mode === 'paused') {
      videoRef.current.pause();
    } else if (mode === 'video') {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  }, [mode, theme]);

  return (
    // Fixed full-screen container sent to the back (-z-50), ignoring mouse clicks
    <div
      className={`fixed inset-0 w-full h-full -z-50 overflow-hidden pointer-events-none select-none transition-colors duration-700 ${
        isDark ? 'bg-[#020617]' : 'bg-[#F0F5FA]'
      }`}
    >
      {/* ========================================================================= */}
      {/* TEXTURE LAYER 1: BASE LIVING CELESTIAL MESH (Always visible, zero-latency)*/}
      {/* Ensures the background is NEVER blank, missing, or flickering             */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        {isDark ? (
          // Dark Mode Deep Space Starfield & Nebula Mesh
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.22),transparent_70%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.20),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_90%,rgba(16,185,129,0.15),transparent_50%)]" />
            {/* Fine Starlight Field */}
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(255, 255, 255, 0.7) 1px, transparent 1px), radial-gradient(rgba(56, 189, 248, 0.5) 1px, transparent 1px)',
                backgroundSize: '48px 48px, 96px 96px',
                backgroundPosition: '0 0, 24px 24px',
              }}
            />
          </div>
        ) : (
          // Light Mode High-Altitude Orbital Stratosphere Mesh
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.30),transparent_70%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.15),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_90%,rgba(16,185,129,0.12),transparent_50%)]" />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TEXTURE LAYER 2: ACTIVE AEROSPACE VIDEO LOOP (Vivid & Crisp)              */}
      {/* Loads ONLY 1 active video (Light Earth / Dark Space) with high visibility */}
      {/* ========================================================================= */}
      {mode !== 'ambient' && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            key={isDark ? 'dark-video' : 'light-video'}
            autoPlay={mode === 'video'}
            loop
            muted
            playsInline
            preload="auto"
            className={`transition-opacity duration-700 transform-gpu will-change-transform ${
              fit === 'wide'
                ? 'w-full h-full max-w-full max-h-full object-contain object-center scale-[1.0]'
                : 'w-full h-full object-cover object-center scale-[1.0]'
            } ${
              isDark
                ? 'opacity-85' // Rich deep-space starfield and cosmic dust
                : 'opacity-70' // Vivid Earth orbital horizon, clouds, and blue atmosphere
            }`}
          >
            <source
              src={isDark ? '/dark-space-loop.mp4' : '/light-earth-loop.mp4'}
              type="video/mp4"
            />
          </video>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TEXTURE LAYER 3: AEROSPACE TELEMETRY RETICLE GRID (HUD Coordinate Dots)   */}
      {/* Transparent in light mode for crystal-clear earth views                   */}
      {/* ========================================================================= */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isDark ? 'opacity-25' : 'opacity-0'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(rgba(56, 189, 248, 0.35) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ========================================================================= */}
      {/* TEXTURE LAYER 4: AEROSPACE CUPOLA APERTURE VIGNETTE                       */}
      {/* Softens edges and gives authentic spacecraft observation window depth     */}
      {/* ========================================================================= */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
          isDark
            ? 'bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(2,6,23,0.70)_100%)]'
            : 'bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(15,23,42,0.15)_100%)]'
        }`}
      />

      {/* ========================================================================= */}
      {/* TEXTURE LAYER 5: TRANSLUCENT CONTRAST SHIELD                              */}
      {/* Balances video visibility while guaranteeing perfect text legibility       */}
      {/* ========================================================================= */}
      <div
        className={`absolute inset-0 transition-colors duration-700 pointer-events-none ${
          isDark
            ? 'bg-gradient-to-b from-[#020617]/40 via-transparent to-[#020617]/60'
            : 'bg-gradient-to-b from-sky-50/10 via-transparent to-slate-100/20'
        }`}
      />
    </div>
  );
}

export { ReactiveBackdrop };
