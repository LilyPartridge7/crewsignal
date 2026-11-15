import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * BodyMap3D: an interactive, anatomical 3D crew body.
 *
 * A translucent skin (built from lathed anatomical profiles, not capsules)
 * sits over the organs that matter for orthostatic tolerance: brain, lungs,
 * heart, liver, stomach, kidneys, intestines and bladder, plus the arterial
 * (red) and venous (blue) trees. The skin and vessels tint with `gravityG`:
 * blood shifts toward the head in 0g and pools in the legs at 1g. The heart
 * beats at the live resting heart rate. Drag to orbit, click a node or a
 * label to select it.
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

const skinVertex = /* glsl */ `
  varying vec3 vWorld; varying vec3 vNormal; varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const skinFragment = /* glsl */ `
  uniform float uGravity; uniform vec3 uRim; uniform vec3 uBase; uniform float uAlpha;
  varying vec3 vWorld; varying vec3 vNormal; varying vec3 vView;
  void main() {
    float h = clamp((vWorld.y + 2.0) / 3.75, 0.0, 1.0);          // 0 feet .. 1 crown
    float centre = mix(0.80, 0.20, uGravity);
    float head = smoothstep(centre, 1.0, h) * (1.0 - uGravity * 0.85);
    float legs = smoothstep(centre, 0.0, h) * (0.12 + uGravity * 0.88);
    vec3 col = uBase;
    col = mix(col, vec3(0.30, 0.62, 1.0), head * 0.7);
    col = mix(col, vec3(1.0, 0.38, 0.48), legs * 0.6);
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
    vec3 outCol = col * (0.25 + 0.35 * fres) + uRim * fres * 0.75;
    float alpha = uAlpha + fres * 0.55 + (head + legs) * 0.10;
    gl_FragColor = vec4(outCol, clamp(alpha, 0.0, 0.9));
  }
`;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Lathe an anatomical profile given as [radius, y] pairs, scaled in x and z. */
function lathe(profile: [number, number][], sx = 1, sz = 1) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 40);
  g.scale(sx, 1, sz);
  g.computeVertexNormals();
  return g;
}

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
  const stateRef = useRef({ gravityG, heartRate, selectedHotspot, theme, hotspots });
  stateRef.current = { gravityG, heartRate, selectedHotspot, theme, hotspots };
  const [webglFailed, setWebglFailed] = useState(false);

  const hotspotKey = hotspots.map((h) => h.id).join('|');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { display: 'block', touchAction: 'pan-y' });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    const baseDist = 8.5;
    camera.position.set(0, 0.0, baseDist);
    camera.lookAt(0, -0.1, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a3a5a, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 4, 5);
    scene.add(key);

    const pivot = new THREE.Group();
    scene.add(pivot);

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(x: T) => {
      disposables.push(x);
      return x;
    };

    // ---------------- organs ----------------
    const organMat = (color: number, opacity = 0.95, emissive = 0x000000) =>
      track(new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, transparent: opacity < 1, opacity, emissive, emissiveIntensity: 0.25 }));
    const organ = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) => {
      track(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      m.scale.set(...scale);
      m.rotation.set(...rot);
      m.renderOrder = 1;
      pivot.add(m);
      return m;
    };
    const sphere = (r: number) => new THREE.SphereGeometry(r, 32, 24);

    // brain: two hemispheres with a midline gap
    const brainMat = organMat(0xf2b8c6, 0.95, 0x40121c);
    organ(sphere(0.1), brainMat, [-0.052, 1.56, -0.01], [0.95, 0.85, 1.35]);
    organ(sphere(0.1), brainMat, [0.052, 1.56, -0.01], [0.95, 0.85, 1.35]);
    organ(sphere(0.06), organMat(0xe79aab), [0, 1.45, -0.09], [1.4, 0.7, 0.9]); // cerebellum

    // lungs: tall, tapered lobes either side of the heart
    const lungMat = organMat(0xf28c9e, 0.85, 0x3a0d18);
    const lungGeo = () => lathe([[0, 0.34], [0.07, 0.31], [0.11, 0.22], [0.13, 0.06], [0.13, -0.08], [0.1, -0.14], [0, -0.15]], 1, 0.75);
    organ(lungGeo(), lungMat, [-0.15, 0.6, -0.02]);
    organ(lungGeo(), lungMat, [0.155, 0.6, -0.02], [0.9, 0.95, 1]);

    // heart: tilted, slightly conical
    const heartGeo = new THREE.SphereGeometry(0.085, 32, 24);
    heartGeo.translate(0, -0.02, 0);
    const heart = organ(heartGeo, organMat(0xd7263d, 1, 0x5a0010), [0.04, 0.55, 0.06], [1, 1.2, 0.9], [0, 0, 0.45]);
    const heartBase = heart.scale.clone();

    // liver (person's right = -x), stomach (left), kidneys (back), intestines, bladder
    organ(sphere(0.14), organMat(0x8e2f3d), [-0.1, 0.3, 0.02], [1.3, 0.6, 0.85], [0, 0, -0.25]);
    organ(sphere(0.085), organMat(0xe8a27c), [0.13, 0.3, 0.04], [1.1, 0.75, 0.75], [0, 0, 0.5]);
    const kidneyMat = organMat(0xa3404f);
    organ(sphere(0.05), kidneyMat, [-0.11, 0.14, -0.1], [0.75, 1.3, 0.6]);
    organ(sphere(0.05), kidneyMat, [0.11, 0.16, -0.1], [0.75, 1.3, 0.6]);
    organ(new THREE.TorusKnotGeometry(0.075, 0.026, 120, 12, 3, 5), organMat(0xe9b896), [0, -0.04, 0.03], [1.25, 0.9, 0.6]);
    organ(sphere(0.05), organMat(0xf2c94c, 0.85), [0, -0.3, 0.05], [1.1, 0.85, 0.9]);

    // ---------------- vessels ----------------
    const artMat = track(new THREE.MeshStandardMaterial({ color: 0xe11d48, emissive: 0x7a0a1f, emissiveIntensity: 0.5, roughness: 0.4 }));
    const veinMat = track(new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x0b2a6b, emissiveIntensity: 0.5, roughness: 0.4 }));
    const headArt = track(artMat.clone());
    const legVein = track(veinMat.clone());
    const vessel = (pts: [number, number, number][], r: number, mat: THREE.Material) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      organ(new THREE.TubeGeometry(curve, 64, r, 8, false), mat, [0, 0, 0]);
    };
    // aorta: arch over the heart, down the spine, splits into the femorals
    vessel([[0.04, 0.6, 0.06], [0.05, 0.74, 0.03], [0.0, 0.79, -0.02], [-0.03, 0.7, -0.07], [-0.02, 0.35, -0.08], [-0.01, 0.0, -0.07], [0, -0.3, -0.04]], 0.022, artMat);
    vessel([[0.02, 0.52, 0.02], [0.04, 0.3, -0.04], [0.035, 0.0, -0.05], [0.03, -0.3, -0.03]], 0.024, veinMat); // vena cava
    [-1, 1].forEach((s) => {
      vessel([[s * 0.01, 0.78, -0.01], [s * 0.05, 1.0, 0.02], [s * 0.06, 1.25, 0.03], [s * 0.05, 1.45, 0.0]], 0.012, headArt); // carotid
      vessel([[s * 0.03, 0.7, 0.0], [s * 0.08, 1.0, 0.0], [s * 0.085, 1.25, -0.01]], 0.013, veinMat); // jugular
      vessel([[0, -0.3, -0.04], [s * 0.12, -0.5, 0.02], [s * 0.18, -0.9, 0.04], [s * 0.19, -1.35, 0.0], [s * 0.2, -1.85, 0.02]], 0.014, artMat); // femoral a.
      vessel([[0.03, -0.3, -0.03], [s * 0.15, -0.5, 0.0], [s * 0.21, -0.9, 0.02], [s * 0.21, -1.35, -0.03], [s * 0.22, -1.85, -0.01]], 0.017, legVein); // femoral v.
      vessel([[s * 0.04, 0.72, 0.0], [s * 0.26, 0.83, 0.0], [s * 0.42, 0.8, 0.01], [s * 0.47, 0.5, 0.02], [s * 0.52, 0.2, 0.02], [s * 0.56, -0.06, 0.02]], 0.009, artMat); // arm
    });

    // ---------------- skin ----------------
    const skinMat = track(
      new THREE.ShaderMaterial({
        vertexShader: skinVertex,
        fragmentShader: skinFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uGravity: { value: gravityG },
          uRim: { value: new THREE.Color(0xbfe3ff) },
          uBase: { value: new THREE.Color(0xd9cfee) },
          uAlpha: { value: 0.05 },
        },
      })
    );
    const skin = (geo: THREE.BufferGeometry, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) => {
      track(geo);
      const m = new THREE.Mesh(geo, skinMat);
      m.position.set(...pos);
      m.rotation.set(...rot);
      m.scale.set(...scale);
      m.renderOrder = 3;
      pivot.add(m);
    };
    // head and jaw
    skin(new THREE.SphereGeometry(0.2, 40, 32), [0, 1.53, 0], [0, 0, 0], [0.82, 1.0, 0.95]);
    skin(new THREE.SphereGeometry(0.13, 32, 24), [0, 1.38, 0.035], [0, 0, 0], [0.95, 0.85, 1.0]);
    // neck
    skin(lathe([[0.075, 1.3], [0.07, 1.18], [0.08, 1.05], [0.11, 0.98]], 1, 0.95), [0, 0, 0]);
    // torso: pelvis to shoulders, flattened front-to-back
    skin(
      lathe(
        [[0.02, -0.5], [0.24, -0.47], [0.33, -0.38], [0.34, -0.22], [0.29, -0.02], [0.27, 0.12], [0.3, 0.32], [0.34, 0.55], [0.36, 0.76], [0.32, 0.9], [0.2, 0.98], [0.1, 1.0]],
        1,
        0.56
      ),
      [0, 0, 0]
    );
    // shoulders (deltoids) and limbs
    [-1, 1].forEach((s) => {
      skin(new THREE.SphereGeometry(0.11, 24, 18), [s * 0.36, 0.84, 0], [0, 0, 0], [1.1, 0.95, 0.95]);
      const arm = lathe([[0.0, 0.0], [0.085, -0.03], [0.09, -0.15], [0.075, -0.4], [0.06, -0.5], [0.065, -0.6], [0.058, -0.8], [0.04, -0.97], [0.0, -1.0]], 1, 0.9);
      skin(arm, [s * 0.42, 0.86, 0], [0, 0, s * 0.16]);
      skin(new THREE.SphereGeometry(0.06, 20, 16), [s * 0.6, -0.2, 0.02], [0, 0, s * 0.16], [0.75, 1.5, 0.45]); // hand
      const leg = lathe(
        [[0.0, 0.0], [0.15, -0.04], [0.165, -0.2], [0.15, -0.45], [0.11, -0.72], [0.1, -0.8], [0.11, -0.95], [0.105, -1.08], [0.075, -1.35], [0.06, -1.42], [0.0, -1.45]],
        1,
        0.95
      );
      skin(leg, [s * 0.17, -0.44, 0], [0, 0, s * -0.025]);
      skin(new THREE.SphereGeometry(0.07, 20, 16), [s * 0.2, -1.9, 0.07], [0, 0, 0], [0.8, 0.45, 1.8]); // foot
    });

    // ground rings
    const rings = new THREE.Group();
    rings.position.y = -2.0;
    rings.rotation.x = -Math.PI / 2;
    const ringMats: THREE.MeshBasicMaterial[] = [];
    [0.9, 1.3].forEach((r, i) => {
      const m = track(new THREE.MeshBasicMaterial({ color: 0xffb59a, transparent: true, opacity: i ? 0.18 : 0.35, side: THREE.DoubleSide }));
      ringMats.push(m);
      rings.add(new THREE.Mesh(track(new THREE.RingGeometry(r, r + 0.012, 96)), m));
    });
    scene.add(rings);

    // ---------------- hotspots ----------------
    const nodeGeo = track(new THREE.SphereGeometry(0.05, 20, 16));
    const haloGeo = track(new THREE.RingGeometry(0.075, 0.1, 40));
    const nodes: { id: string; node: THREE.Mesh; halo: THREE.Mesh }[] = [];
    stateRef.current.hotspots.forEach((h) => {
      const node = new THREE.Mesh(nodeGeo, track(new THREE.MeshBasicMaterial({ color: STATUS_HEX[h.status], depthTest: false })));
      node.position.set(...h.position);
      node.userData.id = h.id;
      node.renderOrder = 5;
      const halo = new THREE.Mesh(haloGeo, track(new THREE.MeshBasicMaterial({ color: STATUS_HEX[h.status], transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthTest: false })));
      halo.position.copy(node.position);
      halo.renderOrder = 5;
      pivot.add(node, halo);
      nodes.push({ id: h.id, node, halo });
    });

    // ---------------- interaction ----------------
    const reduced = prefersReducedMotion();
    let yaw = -0.3;
    let pitch = 0.04;
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let idleSince = performance.now();
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
    const resize = () => {
      width = Math.max(1, mount.clientWidth);
      height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.position.z = camera.aspect < 0.62 ? baseDist * (0.62 / Math.max(0.35, camera.aspect)) : baseDist;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    // ---------------- loop ----------------
    let raf = 0;
    let g = gravityG;
    const tmp = new THREE.Vector3();
    const invQ = new THREE.Quaternion();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = stateRef.current;
      const dark = s.theme === 'dark';

      if (!dragging && !reduced && now - idleSince > 2500) yaw += 0.0022;
      pivot.rotation.set(pitch, yaw, 0);

      g += (s.gravityG - g) * 0.08;
      skinMat.uniforms.uGravity.value = g;
      (skinMat.uniforms.uRim.value as THREE.Color).set(dark ? 0xbfe3ff : 0x6d5bd0);
      (skinMat.uniforms.uBase.value as THREE.Color).set(dark ? 0xd9cfee : 0x8a7fb0);
      skinMat.uniforms.uAlpha.value = dark ? 0.05 : 0.08;
      headArt.emissiveIntensity = 0.3 + (1 - g) * 0.9;
      legVein.emissiveIntensity = 0.25 + g * 1.0;
      ringMats.forEach((m) => m.color.set(dark ? 0xffb59a : 0xb4532f));

      const beat = reduced ? 0 : Math.pow(Math.max(0, Math.sin((now / 1000) * Math.PI * (s.heartRate / 60))), 10);
      heart.scale.set(heartBase.x * (1 + beat * 0.16), heartBase.y * (1 + beat * 0.12), heartBase.z * (1 + beat * 0.16));

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
          label.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * width}px, ${(-tmp.y * 0.5 + 0.5) * height}px)`;
          label.style.opacity = front || selected ? '1' : '0.45';
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
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
    };
    // The scene is built once per hotspot set; live values flow through stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspotKey]);

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
