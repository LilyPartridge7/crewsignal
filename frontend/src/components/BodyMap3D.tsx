import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { AnatomyGeometry } from './anatomy/geometry';
import { loadAnatomy } from './anatomy/load';
import { muscleMaterial, skinMaterial, tissue } from './anatomy/materials';

/**
 * BodyMap3D: an interactive, anatomical 3D crew body.
 *
 * A sculpted, translucent skin over a striated muscle layer, a full
 * skeleton, the thoracic and abdominal organs, and branching arterial (red),
 * venous (blue) and nerve (yellow) trees. X-ray, Organs, Bones and Skin views
 * peel the layers. The skin and vessels respond to `gravityG`: blood shifts
 * toward the head in 0g and pools in the legs at 1g. The heart beats at the
 * live resting heart rate. Drag to orbit, click a node or a label to select.
 */

export interface BodyHotspot {
  id: string;
  label: string;
  indicator: string;
  value: string;
  status: 'alert' | 'watch' | 'ok';
  position: [number, number, number];
}

interface BodyMap3DProps {
  hotspots: BodyHotspot[];
  selectedHotspot: string;
  onSelectHotspot: (hotspotId: string, indicator: string) => void;
  gravityG: number;
  heartRate?: number;
  theme: 'dark' | 'light';
}

const STATUS_HEX: Record<BodyHotspot['status'], number> = { alert: 0xfb7185, watch: 0xfbbf24, ok: 0x4ade80 };

type ViewMode = 'xray' | 'organs' | 'bones' | 'skin';
const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'xray', label: 'X-ray' },
  { id: 'organs', label: 'Organs' },
  { id: 'bones', label: 'Bones' },
  { id: 'skin', label: 'Skin' },
];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const floorFragment = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 14.0;
    vec2 g = abs(fract(p) - 0.5) / fwidth(p);
    float line = 1.0 - min(min(g.x, g.y), 1.0);
    float fade = smoothstep(0.5, 0.05, length(vUv - 0.5));
    gl_FragColor = vec4(uColor, line * fade * uOpacity);
  }
`;
const glowFragment = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
  void main() { float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uColor, pow(max(0.0, 1.0 - d), 2.2) * uOpacity); }
`;
const uvVertex = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const BodyMap3D: React.FC<BodyMap3DProps> = ({
  hotspots,
  selectedHotspot,
  onSelectHotspot,
  gravityG,
  heartRate = 72,
  theme,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onSelectRef = useRef(onSelectHotspot);
  onSelectRef.current = onSelectHotspot;
  const [mode, setMode] = useState<ViewMode>('xray');
  const viewRef = useRef({ zoom: 1, resetAt: 0 });
  const stateRef = useRef({ gravityG, heartRate, selectedHotspot, theme, hotspots, mode });
  stateRef.current = { gravityG, heartRate, selectedHotspot, theme, hotspots, mode };
  const [webglFailed, setWebglFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const hotspotKey = hotspots.map((h) => h.id).join('|');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    loadAnatomy().then((A) => {
      if (cancelled) return;
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setWebglFailed(true);
        return;
      }
      cleanup = buildScene(renderer, mount, A);
      setReady(true);
    });

    const buildScene = (renderer: THREE.WebGLRenderer, mount: HTMLDivElement, A: AnatomyGeometry) => {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      mount.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, { display: 'block', touchAction: 'pan-y' });

      const disposables: { dispose: () => void }[] = [];
      const track = <T extends { dispose: () => void }>(x: T) => {
        disposables.push(x);
        return x;
      };

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      scene.environmentIntensity = 0.55;
      track(envTex);
      track(pmrem);

      const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 60);
      const baseDist = 8.5;
      const target = new THREE.Vector3(0, -0.1, 0);

      scene.add(new THREE.HemisphereLight(0xf3eeff, 0x3a2c48, 0.7));
      const key = new THREE.DirectionalLight(0xfff1e6, 2.4);
      key.position.set(3, 4, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x9fc8ff, 1.6);
      rim.position.set(-4, 2, -4);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(0xffc2b0, 0.6);
      fill.position.set(-3, -1, 3);
      scene.add(fill);

      const pivot = new THREE.Group();
      scene.add(pivot);

      // ---------------- anatomy ----------------
      if (import.meta.env.DEV) console.info(`[BodyMap3D] anatomy built in ${A.buildMs.toFixed(0)} ms`);
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, order = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.renderOrder = order;
        pivot.add(m);
        return m;
      };

      const boneMat = track(tissue({ color: 0xece3d0, bump: 0.18, freq: 70, cavity: 0.12, roughness: 0.62, clearcoat: 0.15, side: THREE.DoubleSide }));
      const cartMat = track(tissue({ color: 0xc9dde6, bump: 0.05, freq: 30, cavity: 0.05, roughness: 0.3, clearcoat: 0.8, opacity: 0.92 }));
      const bones = new THREE.Group();
      bones.add(new THREE.Mesh(A.bones, boneMat), new THREE.Mesh(A.cartilage, cartMat));
      pivot.add(bones);

      const O = A.organs;
      const organGroup = new THREE.Group();
      pivot.add(organGroup);
      const organ = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
        const m = new THREE.Mesh(geo, track(mat));
        m.renderOrder = 1;
        organGroup.add(m);
        return m;
      };
      const brainMat = tissue({ color: 0xe9b3bd, bump: 0.6, freq: 55, ridge: 1, cavity: 0.5, roughness: 0.55, clearcoat: 0.4 });
      const brain = organ(O.brain, brainMat);
      const cerebellum = organ(O.cerebellum, tissue({ color: 0xdc9caa, bump: 0.5, freq: 60, rings: 0.85, cavity: 0.4 }));
      organ(O.eyes, tissue({ color: 0xf4f1ec, bump: 0.02, freq: 20, cavity: 0.05, roughness: 0.15, clearcoat: 1 }));
      const lungMat = tissue({ color: 0xe8919c, bump: 0.35, freq: 90, cavity: 0.3, roughness: 0.6, clearcoat: 0.3, opacity: 0.86 });
      organ(O.lungs, lungMat);
      organ(O.airways, tissue({ color: 0xf1d5cf, bump: 0.4, freq: 30, rings: 0.9, cavity: 0.3 }));
      const heart = organ(O.heart, tissue({ color: 0xb3202f, bump: 0.25, freq: 35, cavity: 0.3, emissive: 0x4a0010, emissiveIntensity: 0.25, clearcoat: 0.8 }));
      heart.position.set(0.03, 0.79, 0.045);
      organ(O.liver, tissue({ color: 0x7c2430, bump: 0.15, freq: 45, cavity: 0.2, clearcoat: 0.9 }));
      organ(O.gallbladder, tissue({ color: 0x5f8f3a, bump: 0.05, clearcoat: 0.9 }));
      organ(O.stomach, tissue({ color: 0xe0a084, bump: 0.35, freq: 40, ridge: 0.3, cavity: 0.3 }));
      organ(O.spleen, tissue({ color: 0x6d2c4c, bump: 0.15, freq: 40 }));
      organ(O.pancreas, tissue({ color: 0xe6bf7c, bump: 0.6, freq: 120, cavity: 0.35 }));
      organ(O.kidneys, tissue({ color: 0x9a3443, bump: 0.15, freq: 40, clearcoat: 0.8 }));
      organ(O.adrenals, tissue({ color: 0xe0b050, bump: 0.3, freq: 80 }));
      organ(O.urinary, tissue({ color: 0xf0d070, bump: 0.05 }));
      organ(O.bladder, tissue({ color: 0xf0c870, bump: 0.08, opacity: 0.85 }));
      organ(O.smallIntestine, tissue({ color: 0xe8a28c, bump: 0.3, freq: 70, cavity: 0.35, clearcoat: 0.8 }));
      organ(O.colon, tissue({ color: 0xcf8670, bump: 0.3, freq: 50, cavity: 0.35, clearcoat: 0.7 }));
      organ(O.thyroid, tissue({ color: 0xb5485a, bump: 0.2, freq: 60 }));
      const heartBase = heart.scale.clone();

      const artMat = track(tissue({ color: 0xd4182f, bump: 0.05, freq: 20, cavity: 0.05, emissive: 0x7a0a1f, emissiveIntensity: 0.45, clearcoat: 1, roughness: 0.3 }));
      const veinMat = track(tissue({ color: 0x2552d6, bump: 0.05, freq: 20, cavity: 0.05, emissive: 0x0b2a6b, emissiveIntensity: 0.45, clearcoat: 1, roughness: 0.3 }));
      const headArt = track(artMat.clone());
      const legVein = track(veinMat.clone());
      const nerveMat = track(tissue({ color: 0xf0d36a, bump: 0.1, freq: 60, emissive: 0x5a4300, emissiveIntensity: 0.2 }));
      const vessels = new THREE.Group();
      vessels.add(new THREE.Mesh(A.arteries, artMat), new THREE.Mesh(A.headArteries, headArt), new THREE.Mesh(A.veins, veinMat), new THREE.Mesh(A.legVeins, legVein));
      const nerves = new THREE.Mesh(A.nerves, nerveMat);
      pivot.add(vessels, nerves);

      const muscleMat = track(muscleMaterial());
      const muscle = add(A.muscle, muscleMat, 2);
      const skinMat = track(skinMaterial());
      add(A.skin, skinMat, 3);

      // ---------------- platform ----------------
      const stage = new THREE.Group();
      stage.position.y = -2.0;
      scene.add(stage);
      const discMat = track(new THREE.MeshPhysicalMaterial({ color: 0x0e0b1c, metalness: 0.1, roughness: 0.7, clearcoat: 0.3, envMapIntensity: 0.1 }));
      const disc = new THREE.Mesh(track(new THREE.CylinderGeometry(0.74, 0.8, 0.07, 96)), discMat);
      disc.position.y = -0.045;
      stage.add(disc);
      const ringDefs = [
        { r: 0.7, w: 0.012, color: 0x9fd0ff, o: 0.8 },
        { r: 0.52, w: 0.016, color: 0xffb59a, o: 0.75 },
        { r: 0.33, w: 0.008, color: 0x9fd0ff, o: 0.45 },
      ];
      const ringMats = ringDefs.map((d) => {
        const m = track(new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: d.o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
        const ring = new THREE.Mesh(track(new THREE.RingGeometry(d.r, d.r + d.w, 128)), m);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.008;
        stage.add(ring);
        return m;
      });
      const glowMat = track(
        new THREE.ShaderMaterial({ vertexShader: uvVertex, fragmentShader: glowFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: new THREE.Color(0xffa070) }, uOpacity: { value: 0.55 } } })
      );
      const glow = new THREE.Mesh(track(new THREE.PlaneGeometry(2.6, 2.6)), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = -0.085;
      stage.add(glow);
      const floorMat = track(
        new THREE.ShaderMaterial({ vertexShader: uvVertex, fragmentShader: floorFragment, transparent: true, depthWrite: false, uniforms: { uColor: { value: new THREE.Color(0x7d8fd6) }, uOpacity: { value: 0.35 } } })
      );
      const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(14, 14)), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.09;
      stage.add(floor);
      // a slow scan halo that travels up and down the body
      const scanMat = track(new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const scan = new THREE.Mesh(track(new THREE.RingGeometry(0.62, 0.635, 128)), scanMat);
      scan.rotation.x = -Math.PI / 2;
      scene.add(scan);

      // ---------------- hotspots ----------------
      const nodeGeo = track(new THREE.SphereGeometry(0.034, 20, 16));
      const haloGeo = track(new THREE.RingGeometry(0.05, 0.066, 40));
      const nodes: { id: string; node: THREE.Mesh; halo: THREE.Mesh }[] = [];
      stateRef.current.hotspots.forEach((h) => {
        const node = new THREE.Mesh(nodeGeo, track(new THREE.MeshBasicMaterial({ color: STATUS_HEX[h.status], depthTest: false })));
        node.position.set(...h.position);
        node.userData.id = h.id;
        node.renderOrder = 5;
        const halo = new THREE.Mesh(haloGeo, track(new THREE.MeshBasicMaterial({ color: STATUS_HEX[h.status], transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false })));
        halo.position.copy(node.position);
        halo.renderOrder = 5;
        pivot.add(node, halo);
        nodes.push({ id: h.id, node, halo });
      });

      // ---------------- interaction ----------------
      const reduced = prefersReducedMotion();
      const YAW0 = -0.25;
      let yaw = YAW0;
      let pitch = 0.04;
      let dragging = false;
      let moved = 0;
      let lastX = 0;
      let lastY = 0;
      let idleSince = performance.now();
      let lastReset = viewRef.current.resetAt;
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const el = renderer.domElement;

      const onDown = (e: PointerEvent) => {
        dragging = true;
        moved = 0;
        lastX = e.clientX;
        lastY = e.clientY;
        el.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        yaw += dx * 0.01;
        pitch = Math.max(-0.35, Math.min(0.35, pitch + dy * 0.005));
        lastX = e.clientX;
        lastY = e.clientY;
        idleSince = performance.now();
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        if (moved > 6) return;
        const rect = el.getBoundingClientRect();
        ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObjects(nodes.map((n) => n.node))[0];
        const h = hit && stateRef.current.hotspots.find((x) => x.id === hit.object.userData.id);
        if (h) onSelectRef.current(h.id, h.indicator);
      };
      const onCancel = () => (dragging = false);
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onCancel);

      // ---------------- sizing ----------------
      let width = 1;
      let height = 1;
      let fitDist = baseDist;
      const resize = () => {
        width = Math.max(1, mount.clientWidth);
        height = Math.max(1, mount.clientHeight);
        renderer.setSize(width, height, false);
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        camera.aspect = width / height;
        fitDist = camera.aspect < 0.62 ? baseDist * (0.62 / Math.max(0.35, camera.aspect)) : baseDist;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(mount);
      resize();

      // ---------------- loop ----------------
      let raf = 0;
      let g = stateRef.current.gravityG;
      let zoom = 1;
      const tmp = new THREE.Vector3();
      const invQ = new THREE.Quaternion();
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const s = stateRef.current;
        const dark = s.theme === 'dark';
        const view = viewRef.current;
        if (view.resetAt !== lastReset) {
          lastReset = view.resetAt;
          yaw = YAW0;
          pitch = 0.04;
          idleSince = now;
        }

        if (!dragging && !reduced && now - idleSince > 3000) yaw += 0.0018;
        pivot.rotation.set(pitch, yaw, 0);

        // camera: zooming in leans the view toward the selected point
        zoom += (view.zoom - zoom) * (reduced ? 1 : 0.12);
        const sel = s.hotspots.find((h) => h.id === s.selectedHotspot);
        const lean = Math.max(0, Math.min(1, (1 - zoom) / 0.55));
        target.set(0, -0.1 + ((sel ? sel.position[1] : -0.1) + 0.1) * lean, 0);
        camera.position.set(0, target.y, fitDist * zoom);
        camera.lookAt(target);

        // view modes
        const m = s.mode;
        muscle.visible = m === 'xray';
        bones.visible = m === 'xray' || m === 'bones';
        organGroup.visible = m === 'xray' || m === 'organs';
        vessels.visible = m === 'xray' || m === 'organs';
        nerves.visible = m === 'xray' || m === 'organs';
        brain.visible = cerebellum.visible = m === 'organs';
        lungMat.opacity = m === 'organs' ? 0.78 : 0.88;
        skinMat.uniforms.uSolid.value = m === 'skin' ? 1 : 0;
        skinMat.side = m === 'skin' ? THREE.DoubleSide : THREE.FrontSide;
        skinMat.uniforms.uAlpha.value = m === 'bones' ? (dark ? 0.03 : 0.06) : dark ? 0.04 : 0.07;
        muscleMat.uniforms.uAlpha.value = dark ? 0.66 : 0.74;

        g += (s.gravityG - g) * 0.08;
        skinMat.uniforms.uGravity.value = g;
        (skinMat.uniforms.uRim.value as THREE.Color).set(dark ? 0xbfe3ff : 0x6d5bd0);
        (skinMat.uniforms.uBase.value as THREE.Color).set(dark ? 0xd9cfee : 0x8a7fb0);
        headArt.emissiveIntensity = 0.3 + (1 - g) * 0.9;
        legVein.emissiveIntensity = 0.25 + g * 1.0;

        discMat.color.set(dark ? 0x0e0b1c : 0xe4dcef);
        ringMats[1].color.set(dark ? 0xffb59a : 0xd9673c);
        ringMats[0].color.set(dark ? 0x9fd0ff : 0x5a7fd6);
        ringMats[2].color.set(dark ? 0x9fd0ff : 0x5a7fd6);
        ringMats.forEach((rm) => (rm.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending));
        glowMat.uniforms.uOpacity.value = dark ? 0.55 : 0.25;
        (floorMat.uniforms.uColor.value as THREE.Color).set(dark ? 0x7d8fd6 : 0x6d5bd0);
        floorMat.uniforms.uOpacity.value = dark ? 0.35 : 0.22;
        scanMat.color.set(dark ? 0x9fd0ff : 0x6d5bd0);
        scanMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;

        const sweep = reduced ? 0.15 : 0.5 - 0.5 * Math.cos((now / 9000) * Math.PI * 2);
        scan.position.y = -1.9 + sweep * 3.55;
        scanMat.opacity = (dark ? 0.55 : 0.35) * Math.sin(Math.PI * Math.min(1, Math.max(0, sweep * 1.05)));

        const beat = reduced ? 0 : Math.pow(Math.max(0, Math.sin((now / 1000) * Math.PI * (s.heartRate / 60))), 10);
        heart.scale.set(heartBase.x * (1 + beat * 0.1), heartBase.y * (1 + beat * 0.08), heartBase.z * (1 + beat * 0.1));

        invQ.copy(pivot.quaternion).invert();
        nodes.forEach(({ id, node, halo }) => {
          const selected = id === s.selectedHotspot;
          const live = s.hotspots.find((h) => h.id === id);
          if (live) {
            (node.material as THREE.MeshBasicMaterial).color.setHex(STATUS_HEX[live.status]);
            (halo.material as THREE.MeshBasicMaterial).color.setHex(STATUS_HEX[live.status]);
          }
          node.scale.setScalar(selected ? 1.4 : 1);
          halo.visible = selected;
          halo.quaternion.copy(invQ).multiply(camera.quaternion);
          halo.scale.setScalar(1 + (reduced ? 0 : 0.25 * Math.sin(now / 280)));
          const label = labelRefs.current[id];
          if (label) {
            node.getWorldPosition(tmp);
            const front = tmp.z > -0.12;
            tmp.project(camera);
            const off = tmp.x < -1.1 || tmp.x > 1.1 || tmp.y < -1.1 || tmp.y > 1.1;
            label.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * width}px, ${(-tmp.y * 0.5 + 0.5) * height}px)`;
            label.style.opacity = off ? '0' : front || selected ? '1' : '0.45';
          }
        });

        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onCancel);
        // anatomy geometry is cached for the page; only per-mount resources are freed
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        if (el.parentNode === mount) mount.removeChild(el);
      };
    };

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // The scene is built once per hotspot set; live values flow through stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspotKey]);

  const zoomBy = (f: number) => {
    viewRef.current.zoom = Math.max(0.42, Math.min(1.3, viewRef.current.zoom * f));
  };
  const resetView = () => {
    viewRef.current.zoom = 1;
    viewRef.current.resetAt = performance.now();
  };

  if (webglFailed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-cs-muted">
        The 3D body needs WebGL, which is turned off in this browser.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" aria-hidden="true" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-cs-muted">Building anatomy…</div>
      )}
      <div className="absolute left-3 top-2 z-20 flex flex-col gap-1 rounded-2xl border border-cs-line bg-cs-panel p-1 backdrop-blur-md" role="group" aria-label="Body layers">
        {VIEW_MODES.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={mode === v.id}
            onClick={() => setMode(v.id)}
            className={`rounded-xl px-3 py-1.5 text-left text-xs font-semibold transition-colors ${
              mode === v.id ? 'bg-cs-accent text-cs-accent-ink' : 'text-cs-muted hover:text-cs-text'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5">
        {[
          { label: 'Zoom in', icon: Plus, run: () => zoomBy(0.8) },
          { label: 'Zoom out', icon: Minus, run: () => zoomBy(1.25) },
          { label: 'Reset view', icon: RotateCcw, run: resetView },
        ].map(({ label, icon: Icon, run }) => (
          <button
            key={label}
            type="button"
            onClick={run}
            aria-label={label}
            title={label}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cs-line bg-cs-panel text-cs-muted backdrop-blur-md transition-colors hover:text-cs-text"
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </button>
        ))}
      </div>
      {hotspots.map((h) => {
        const selected = h.id === selectedHotspot;
        const leftSide = h.position[0] < 0;
        const tone = h.status === 'alert' ? 'text-cs-bad' : h.status === 'watch' ? 'text-cs-warn' : 'text-cs-good';
        return (
          <button
            key={h.id}
            ref={(node) => {
              labelRefs.current[h.id] = node;
            }}
            type="button"
            onClick={() => onSelectHotspot(h.id, h.indicator)}
            className="absolute left-0 top-0 z-10 will-change-transform"
            style={{ transition: 'opacity 200ms' }}
            aria-pressed={selected}
            aria-label={`${h.label}: ${h.value}`}
          >
            <span
              className={`absolute top-0 -translate-y-1/2 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-left leading-tight backdrop-blur-md transition-colors ${
                leftSide ? 'right-4' : 'left-4'
              } ${selected ? 'border-cs-accent bg-cs-panel-strong' : 'border-cs-line bg-cs-panel'}`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-cs-muted">{h.label}</span>
              <span className={`block font-mono text-xs font-medium ${tone}`}>{h.value}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default BodyMap3D;
