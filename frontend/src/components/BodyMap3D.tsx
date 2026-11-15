import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { ANATOMY_CREDIT, ANATOMY_LICENSE_URL, AnatomyModel, BodySystem, Sex, Structure, anchorPosition, loadAnatomyModel } from './anatomy/model';
import { muscleMaterial, skinMaterial, tissue } from './anatomy/materials';

/**
 * BodyMap3D: an interactive 3D crew anatomy built on the open BodyParts3D
 * model (skin, muscles, skeleton, organs, vessels and nerves as ~130 named
 * structures). X-ray, Organs, Bones and Skin views peel the layers; any
 * structure can be tapped to highlight and name it. The skin and vessels
 * respond to `gravityG` (blood toward the head in 0g, pooling in the legs at
 * 1g) and the heart beats at the live resting heart rate. A full-screen view
 * shows only the body.
 */

export interface BodyHotspot {
  id: string;
  label: string;
  indicator: string;
  value: string;
  status: 'alert' | 'watch' | 'ok';
  position: [number, number, number];
  /** Structure the point sits on, e.g. "heart" or "carotid_l@0.7". */
  anchor?: string;
}

interface BodyMap3DProps {
  hotspots: BodyHotspot[];
  selectedHotspot: string;
  onSelectHotspot: (hotspotId: string, indicator: string) => void;
  gravityG: number;
  heartRate?: number;
  theme: 'dark' | 'light';
}

type ViewMode = 'xray' | 'organs' | 'bones' | 'skin';
const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'xray', label: 'X-ray' },
  { id: 'organs', label: 'Organs' },
  { id: 'bones', label: 'Bones' },
  { id: 'skin', label: 'Skin' },
];
const SYSTEM_LABEL: Record<BodySystem, string> = {
  skin: 'Skin',
  skeleton: 'Skeleton',
  muscles: 'Muscles',
  organs: 'Organs',
  vessels: 'Blood vessels',
  nerves: 'Nervous system',
};
const VISIBLE: Record<ViewMode, BodySystem[]> = {
  xray: ['skin', 'muscles', 'skeleton', 'organs', 'vessels', 'nerves'],
  organs: ['skin', 'organs', 'vessels', 'nerves'],
  bones: ['skin', 'skeleton'],
  skin: ['skin'],
};
const STATUS_HEX: Record<BodyHotspot['status'], number> = { alert: 0xfb7185, watch: 0xfbbf24, ok: 0x4ade80 };

const ORGAN_COLORS: [RegExp, number][] = [
  [/^(brain|cerebellum|brainstem|pituitary)/, 0xe6aab6],
  [/^heart/, 0xb3202f],
  [/^lung/, 0xe8919c],
  [/^liver/, 0x7c2430],
  [/^gallbladder/, 0x5f8f3a],
  [/^stomach/, 0xe0a084],
  [/^spleen/, 0x6d2c4c],
  [/^pancreas/, 0xe6bf7c],
  [/^kidney/, 0x9a3443],
  [/^adrenal/, 0xe0b050],
  [/^small_intestine/, 0xe8a28c],
  [/^(colon|appendix)/, 0xcf8670],
  [/^(bladder|ureter)/, 0xf0c870],
  [/^(trachea|bronchi|larynx)/, 0xf1d5cf],
  [/^(esophagus|pharynx)/, 0xd99a8c],
  [/^eye/, 0xf4f1ec],
  [/^tongue/, 0xc85a64],
  [/^(thymus|salivary)/, 0xe8c4a8],
  [/^breast/, 0xf0c8a8],
];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const uvVertex = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
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

interface ViewportProps extends BodyMap3DProps {
  variant: 'panel' | 'full';
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  sex: Sex;
  setSex: (s: Sex) => void;
  picked: { key: string; label: string; system: BodySystem } | null;
  setPicked: (p: { key: string; label: string; system: BodySystem } | null) => void;
  onExpand?: () => void;
  onClose?: () => void;
  /** Stop drawing while another view covers this one. */
  paused?: boolean;
}

const BodyViewport: React.FC<ViewportProps> = (props) => {
  const { hotspots, selectedHotspot, onSelectHotspot, gravityG, heartRate = 72, theme, variant, mode, setMode, sex, setSex, picked, setPicked, onExpand, onClose, paused = false } = props;
  const full = variant === 'full';
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cb = useRef({ onSelectHotspot, setPicked });
  cb.current = { onSelectHotspot, setPicked };
  const viewRef = useRef({ zoom: 1, resetAt: 0 });
  const stateRef = useRef({ gravityG, heartRate, selectedHotspot, theme, hotspots, mode, picked, paused });
  stateRef.current = { gravityG, heartRate, selectedHotspot, theme, hotspots, mode, picked, paused };
  const [status, setStatus] = useState<{ phase: 'loading' | 'ready' | 'failed' | 'nogl'; progress: number }>({ phase: 'loading', progress: 0 });

  const hotspotKey = hotspots.map((h) => `${h.id}:${h.anchor ?? ''}`).join('|');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    setStatus({ phase: 'loading', progress: 0 });

    loadAnatomyModel(sex, (f) => !cancelled && setStatus({ phase: 'loading', progress: f }))
      .then((model) => {
        if (cancelled) return;
        let renderer: THREE.WebGLRenderer;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch {
          setStatus({ phase: 'nogl', progress: 1 });
          return;
        }
        cleanup = buildScene(renderer, mount, model);
        setStatus({ phase: 'ready', progress: 1 });
      })
      .catch(() => !cancelled && setStatus({ phase: 'failed', progress: 0 }));

    const buildScene = (renderer: THREE.WebGLRenderer, mount: HTMLDivElement, model: AnatomyModel) => {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      mount.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, { display: 'block', touchAction: full ? 'none' : 'pan-y' });

      const disposables: { dispose: () => void }[] = [];
      const track = <T extends { dispose: () => void }>(x: T) => {
        disposables.push(x);
        return x;
      };

      const scene = new THREE.Scene();
      const pmrem = track(new THREE.PMREMGenerator(renderer));
      scene.environment = track(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
      scene.environmentIntensity = 0.55;

      const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 60);
      const baseDist = 8.5;
      const target = new THREE.Vector3(0, -0.1, 0);
      scene.add(new THREE.HemisphereLight(0xf3eeff, 0x3a2c48, 0.7));
      const key = new THREE.DirectionalLight(0xfff1e6, 2.4);
      key.position.set(3, 4, 5);
      const rim = new THREE.DirectionalLight(0x9fc8ff, 1.6);
      rim.position.set(-4, 2, -4);
      const fill = new THREE.DirectionalLight(0xffc2b0, 0.6);
      fill.position.set(-3, -1, 3);
      scene.add(key, rim, fill);

      const pivot = new THREE.Group();
      scene.add(pivot);

      // ---------------- anatomy ----------------
      const skinMat = track(skinMaterial());
      const muscleMat = track(muscleMaterial());
      const boneMat = track(tissue({ color: 0xece3d0, bump: 0.12, freq: 70, cavity: 0.1, roughness: 0.6, clearcoat: 0.2 }));
      const teethMat = track(tissue({ color: 0xf8f4ea, bump: 0.02, roughness: 0.25, clearcoat: 0.9 }));
      const artMat = track(tissue({ color: 0xd4182f, bump: 0.04, cavity: 0.05, emissive: 0x7a0a1f, emissiveIntensity: 0.45, clearcoat: 1, roughness: 0.3 }));
      const veinMat = track(tissue({ color: 0x2552d6, bump: 0.04, cavity: 0.05, emissive: 0x0b2a6b, emissiveIntensity: 0.45, clearcoat: 1, roughness: 0.3 }));
      const headArt = track(artMat.clone());
      const legVein = track(veinMat.clone());
      const nerveMat = track(tissue({ color: 0xf0d36a, bump: 0.1, freq: 60, emissive: 0x5a4300, emissiveIntensity: 0.2 }));
      const organMats = new Map<number, THREE.Material>();
      const organMat = (k: string) => {
        const color = ORGAN_COLORS.find(([re]) => re.test(k))?.[1] ?? 0xd09080;
        let m = organMats.get(color);
        if (!m) {
          const lung = color === 0xe8919c;
          const airway = color === 0xf1d5cf;
          m = track(tissue({ color, bump: lung ? 0.3 : 0.12, freq: lung ? 90 : 45, rings: airway ? 0.85 : 0, cavity: lung ? 0.25 : 0.15, clearcoat: 0.8, opacity: lung ? 0.86 : 1 }));
          organMats.set(color, m);
        }
        return m;
      };
      const materialFor = (st: Structure): THREE.Material => {
        const k = st.key;
        switch (st.system) {
          case 'skin':
            return skinMat;
          case 'muscles':
            return muscleMat;
          case 'skeleton':
            return k === 'teeth' ? teethMat : boneMat;
          case 'nerves':
            return nerveMat;
          case 'vessels':
            if (/^(veins|vena|pulmonary)/.test(k)) return /^veins_leg/.test(k) ? legVein : veinMat;
            return /^(arteries_head|carotid)/.test(k) ? headArt : artMat;
          default:
            return organMat(k);
        }
      };

      const groups = new Map<BodySystem, THREE.Group>();
      const meshes: THREE.Mesh[] = [];
      let heart: THREE.Mesh | null = null;
      for (const st of model.structures) {
        let g = groups.get(st.system);
        if (!g) {
          g = new THREE.Group();
          groups.set(st.system, g);
          pivot.add(g);
        }
        const mesh = new THREE.Mesh(st.geometry, materialFor(st));
        mesh.userData = { key: st.key, label: st.label, system: st.system };
        mesh.renderOrder = st.system === 'skin' ? 3 : st.system === 'muscles' ? 2 : st.key.startsWith('lung') ? 1 : 0;
        if (st.key === 'heart') {
          // pivot the heart on its own centre so it can beat in place
          mesh.geometry = st.geometry.clone().translate(-st.center.x, -st.center.y, -st.center.z);
          track(mesh.geometry);
          mesh.position.copy(st.center);
          heart = mesh;
        }
        g.add(mesh);
        meshes.push(mesh);
      }

      const pickMat = track(new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
      const pickMesh = new THREE.Mesh(new THREE.BufferGeometry(), pickMat);
      pickMesh.renderOrder = 6;
      pickMesh.visible = false;
      pivot.add(pickMesh);

      // ---------------- platform ----------------
      const stage = new THREE.Group();
      stage.position.y = -2.0;
      scene.add(stage);
      const discMat = track(new THREE.MeshPhysicalMaterial({ color: 0x0e0b1c, metalness: 0.1, roughness: 0.7, clearcoat: 0.3, envMapIntensity: 0.1 }));
      const disc = new THREE.Mesh(track(new THREE.CylinderGeometry(0.74, 0.8, 0.07, 96)), discMat);
      disc.position.y = -0.045;
      stage.add(disc);
      const ringMats = [
        { r: 0.7, w: 0.012, o: 0.8 },
        { r: 0.52, w: 0.016, o: 0.75 },
        { r: 0.33, w: 0.008, o: 0.45 },
      ].map((d) => {
        const m = track(new THREE.MeshBasicMaterial({ transparent: true, opacity: d.o, side: THREE.DoubleSide, depthWrite: false }));
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
      const scanMat = track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
      const scan = new THREE.Mesh(track(new THREE.RingGeometry(0.62, 0.635, 128)), scanMat);
      scan.rotation.x = -Math.PI / 2;
      scene.add(scan);

      // ---------------- hotspots ----------------
      const nodeGeo = track(new THREE.SphereGeometry(0.034, 20, 16));
      const haloGeo = track(new THREE.RingGeometry(0.05, 0.066, 40));
      const nodes: { id: string; node: THREE.Mesh; halo: THREE.Mesh }[] = [];
      stateRef.current.hotspots.forEach((h) => {
        const pos = (h.anchor && anchorPosition(model, h.anchor)) || new THREE.Vector3(...h.position);
        const node = new THREE.Mesh(nodeGeo, track(new THREE.MeshBasicMaterial({ color: STATUS_HEX[h.status], depthTest: false })));
        node.position.copy(pos);
        node.userData.id = h.id;
        node.renderOrder = 7;
        const halo = new THREE.Mesh(haloGeo, track(new THREE.MeshBasicMaterial({ color: STATUS_HEX[h.status], transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false })));
        halo.position.copy(pos);
        halo.renderOrder = 7;
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
        pitch = Math.max(-0.5, Math.min(0.5, pitch + dy * 0.005));
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
        const nodeHit = raycaster.intersectObjects(nodes.map((n) => n.node))[0];
        const h = nodeHit && stateRef.current.hotspots.find((x) => x.id === nodeHit.object.userData.id);
        if (h) {
          cb.current.onSelectHotspot(h.id, h.indicator);
          return;
        }
        // pick an anatomical structure; the skin only counts in the skin view
        const m = stateRef.current.mode;
        const pickable = meshes.filter((x) => x.parent?.visible && (m === 'skin' || x.userData.system !== 'skin'));
        const hit = raycaster.intersectObjects(pickable, false)[0];
        if (!hit) {
          cb.current.setPicked(null);
          return;
        }
        const { key: k, label, system } = hit.object.userData as { key: string; label: string; system: BodySystem };
        cb.current.setPicked({ key: k, label, system });
        const linked = stateRef.current.hotspots.find((x) => x.anchor?.split('@')[0] === k);
        if (linked) cb.current.onSelectHotspot(linked.id, linked.indicator);
      };
      const onCancel = () => (dragging = false);
      const onWheel = (e: WheelEvent) => {
        if (!full) return;
        e.preventDefault();
        viewRef.current.zoom = Math.max(0.3, Math.min(1.3, viewRef.current.zoom * (e.deltaY > 0 ? 1.08 : 0.92)));
      };
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onCancel);
      el.addEventListener('wheel', onWheel, { passive: false });

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
      let shownPick = '';
      const tmp = new THREE.Vector3();
      const invQ = new THREE.Quaternion();
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const s = stateRef.current;
        if (s.paused) return;
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

        // zooming in leans toward the picked structure, or the selected point
        zoom += (view.zoom - zoom) * (reduced ? 1 : 0.12);
        const pickedSt = s.picked ? model.byKey.get(s.picked.key) : undefined;
        const sel = s.hotspots.find((h) => h.id === s.selectedHotspot);
        const focusY = pickedSt ? pickedSt.center.y : sel ? (nodes.find((n) => n.id === sel.id)?.node.position.y ?? -0.1) : -0.1;
        const lean = Math.max(0, Math.min(1, (1 - zoom) / 0.6));
        target.set(0, -0.1 + (focusY + 0.1) * lean, 0);
        camera.position.set(0, target.y, fitDist * zoom);
        camera.lookAt(target);

        const vis = VISIBLE[s.mode];
        groups.forEach((grp, sys) => (grp.visible = vis.includes(sys)));
        skinMat.uniforms.uSolid.value = s.mode === 'skin' ? 1 : 0;
        skinMat.side = s.mode === 'skin' ? THREE.DoubleSide : THREE.FrontSide;
        skinMat.uniforms.uAlpha.value = dark ? 0.035 : 0.06;
        muscleMat.uniforms.uAlpha.value = dark ? 0.7 : 0.78;

        if ((s.picked?.key ?? '') !== shownPick) {
          shownPick = s.picked?.key ?? '';
          const st = shownPick ? model.byKey.get(shownPick) : undefined;
          pickMesh.visible = !!st;
          if (st) pickMesh.geometry = st.key === 'heart' && heart ? heart.geometry : st.geometry;
        }
        if (pickMesh.visible && heart && shownPick === 'heart') {
          pickMesh.position.copy(heart.position);
          pickMesh.scale.copy(heart.scale);
        } else {
          pickMesh.position.set(0, 0, 0);
          pickMesh.scale.set(1, 1, 1);
        }
        pickMat.color.set(dark ? 0x5ee7ff : 0x2563eb);
        pickMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        pickMat.opacity = (dark ? 0.6 : 0.45) + (reduced ? 0 : 0.12 * Math.sin(now / 300));

        g += (s.gravityG - g) * 0.08;
        skinMat.uniforms.uGravity.value = g;
        (skinMat.uniforms.uRim.value as THREE.Color).set(dark ? 0xbfe3ff : 0x6d5bd0);
        (skinMat.uniforms.uBase.value as THREE.Color).set(dark ? 0xd9cfee : 0x8a7fb0);
        headArt.emissiveIntensity = 0.3 + (1 - g) * 0.9;
        legVein.emissiveIntensity = 0.25 + g * 1.0;

        discMat.color.set(dark ? 0x0e0b1c : 0xe4dcef);
        const cool = dark ? 0x9fd0ff : 0x5a7fd6;
        ringMats[0].color.set(cool);
        ringMats[1].color.set(dark ? 0xffb59a : 0xd9673c);
        ringMats[2].color.set(cool);
        ringMats.forEach((rm) => (rm.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending));
        glowMat.uniforms.uOpacity.value = dark ? 0.55 : 0.25;
        (floorMat.uniforms.uColor.value as THREE.Color).set(dark ? 0x7d8fd6 : 0x6d5bd0);
        floorMat.uniforms.uOpacity.value = dark ? 0.35 : 0.22;
        scanMat.color.set(dark ? 0x9fd0ff : 0x6d5bd0);
        scanMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        const sweep = reduced ? 0.15 : 0.5 - 0.5 * Math.cos((now / 9000) * Math.PI * 2);
        scan.position.y = -1.9 + sweep * 3.55;
        scanMat.opacity = (dark ? 0.55 : 0.35) * Math.sin(Math.PI * Math.min(1, Math.max(0, sweep * 1.05)));

        if (heart) {
          const beat = reduced ? 0 : Math.pow(Math.max(0, Math.sin((now / 1000) * Math.PI * (s.heartRate / 60))), 10);
          heart.scale.setScalar(1 + beat * 0.08);
        }

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
        el.removeEventListener('wheel', onWheel);
        // model geometry is cached for the page; only per-view resources are freed
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        if (el.parentNode === mount) mount.removeChild(el);
      };
    };

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // The scene is built once per model and hotspot set; live values flow through stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspotKey, sex]);

  const zoomBy = (f: number) => {
    viewRef.current.zoom = Math.max(0.3, Math.min(1.3, viewRef.current.zoom * f));
  };
  const resetView = () => {
    viewRef.current.zoom = 1;
    viewRef.current.resetAt = performance.now();
  };

  const pickedHotspot = picked && hotspots.find((h) => h.anchor?.split('@')[0] === picked.key);
  const roundBtn = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-cs-line bg-cs-panel text-cs-muted backdrop-blur-md transition-colors hover:text-cs-text';

  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" aria-hidden="true" />

      {status.phase !== 'ready' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm font-medium text-cs-muted">
          {status.phase === 'loading' && (
            <>
              <span>Loading anatomy model…</span>
              <span className="h-1 w-40 overflow-hidden rounded-full bg-cs-line">
                <span className="block h-full rounded-full bg-cs-accent transition-[width]" style={{ width: `${Math.round(status.progress * 100)}%` }} />
              </span>
            </>
          )}
          {status.phase === 'failed' && <span>The anatomy model didn't load. Check the connection and reload the page.</span>}
          {status.phase === 'nogl' && <span>The 3D body needs WebGL, which is turned off in this browser.</span>}
        </div>
      )}

      {/* layer and model controls */}
      <div className={`absolute left-3 z-20 flex flex-col gap-2 ${full ? 'top-20' : 'top-2'}`}>
        <div className="flex gap-1 rounded-2xl border border-cs-line bg-cs-panel p-1 backdrop-blur-md" role="group" aria-label="Body model">
          {(['male', 'female'] as Sex[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sex === s}
              onClick={() => setSex(s)}
              className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${sex === s ? 'bg-cs-text text-cs-ground' : 'text-cs-muted hover:text-cs-text'}`}
            >
              {s === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-cs-line bg-cs-panel p-1 backdrop-blur-md" role="group" aria-label="Body layers">
          {VIEW_MODES.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={mode === v.id}
              onClick={() => setMode(v.id)}
              className={`rounded-xl px-3 py-1.5 text-left text-xs font-semibold transition-colors ${mode === v.id ? 'bg-cs-accent text-cs-accent-ink' : 'text-cs-muted hover:text-cs-text'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5">
        {!full && onExpand && (
          <button type="button" onClick={onExpand} aria-label="Show the body full screen" title="Full screen" className={roundBtn}>
            <Maximize2 className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
        <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom in" title="Zoom in" className={roundBtn}>
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom out" title="Zoom out" className={roundBtn}>
          <Minus className="h-4 w-4" strokeWidth={2} />
        </button>
        <button type="button" onClick={resetView} aria-label="Reset view" title="Reset view" className={roundBtn}>
          <RotateCcw className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {full && (
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-cs-text">Crew anatomy</h2>
            <p className="text-xs text-cs-muted">Drag to turn, scroll to zoom, tap any structure to name it.</p>
          </div>
          <button type="button" onClick={onClose} className="cs-btn cs-btn-ghost inline-flex items-center gap-2">
            <X className="h-4 w-4" strokeWidth={2} />
            Close
          </button>
        </div>
      )}

      {picked && (
        <div className={`absolute z-20 max-w-[16rem] rounded-2xl border border-cs-line bg-cs-panel-strong px-3 py-2 backdrop-blur-md ${full ? 'bottom-12 left-4 sm:left-6' : 'bottom-7 left-3'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold capitalize text-cs-text">{picked.label}</p>
              <p className="text-xs text-cs-muted">{SYSTEM_LABEL[picked.system]}</p>
            </div>
            <button type="button" onClick={() => setPicked(null)} aria-label="Clear selection" className="-mr-1 rounded-full p-1 text-cs-muted hover:text-cs-text">
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          {pickedHotspot && (
            <p className="mt-1 text-xs text-cs-muted">
              {pickedHotspot.label}: <span className="font-mono text-cs-text">{pickedHotspot.value}</span>
            </p>
          )}
        </div>
      )}

      <a
        href={ANATOMY_LICENSE_URL}
        target="_blank"
        rel="noreferrer"
        title={ANATOMY_CREDIT}
        className={`absolute z-20 text-[10px] text-cs-muted underline-offset-2 hover:underline ${full ? 'bottom-3 left-4 right-4 sm:left-6' : 'bottom-1 right-3'}`}
      >
        {full ? ANATOMY_CREDIT : 'Model: BodyParts3D © DBCLS, CC BY 4.0'}
      </a>

      {status.phase === 'ready' &&
        hotspots.map((h) => {
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

export const BodyMap3D: React.FC<BodyMap3DProps> = (props) => {
  const [mode, setMode] = useState<ViewMode>('xray');
  const [sex, setSex] = useState<Sex>('male');
  const [picked, setPicked] = useState<ViewportProps['picked']>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  const shared = { ...props, mode, setMode, sex, setSex, picked, setPicked };
  return (
    <>
      <BodyViewport {...shared} variant="panel" paused={full} onExpand={() => setFull(true)} />
      {full &&
        createPortal(
          <div className={`fixed inset-0 z-[80] bg-cs-ground ${props.theme === 'dark' ? 'dark' : ''}`} role="dialog" aria-modal="true" aria-label="Crew anatomy, full screen">
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(255,181,154,0.10), transparent 60%)' }} />
            <BodyViewport {...shared} variant="full" onClose={() => setFull(false)} />
          </div>,
          document.body
        )}
    </>
  );
};

export default BodyMap3D;
