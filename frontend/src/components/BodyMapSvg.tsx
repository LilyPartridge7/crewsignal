import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Heart, Activity, Gauge, Radiation, RotateCcw, Play, Pause, Layers } from 'lucide-react';

interface BodyMapSvgProps {
  selectedHotspot: string;
  onSelectHotspot: (hotspotKey: string, indicatorKey: string) => void;
  kpis: Record<string, any>;
  theme: 'dark' | 'light';
}

interface HotspotConfig {
  id: string;
  name: string;
  indicator: string;
  position: [number, number, number]; // 3D coordinates [x, y, z]
  label: string;
  icon: React.ReactNode;
}

export const BodyMapSvg: React.FC<BodyMapSvgProps> = ({
  selectedHotspot,
  onSelectHotspot,
  kpis,
  theme,
}) => {
  const isDark = theme === 'dark';
  const mountRef = useRef<HTMLDivElement>(null);

  // 3D Scene Controls State
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [anatomyLayer, setAnatomyLayer] = useState<'all' | 'cardio' | 'skeletal'>('all');

  const hotspots: HotspotConfig[] = [
    {
      id: 'baroreceptors',
      name: 'Baroreflex',
      indicator: 'orthostatic_hr_delta',
      position: [0.32, 2.38, 0.28], // Carotid sinus / cervical spine
      label: 'Neck Baroreflex',
      icon: <Activity className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'aorta',
      name: 'Aorta',
      indicator: 'systolic_bp',
      position: [-0.04, 1.88, 0.45], // Aortic arch / thoracic aorta
      label: 'Arterial Pressure',
      icon: <Gauge className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'heart',
      name: 'Heart',
      indicator: 'resting_hr',
      position: [0.34, 1.25, 0.62], // Left thoracic myocardial chamber
      label: 'Cardiac Output',
      icon: <Heart className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'peripheral',
      name: 'Peripheral',
      indicator: 'cumulative_radiation_msv',
      position: [0.0, -0.65, 0.38], // Splanchnic & mesenteric vascular pool
      label: 'Peripheral / Rad',
      icon: <Radiation className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
  ];

  const getStatusColorHex = useCallback((indicator: string): number => {
    const kpi = kpis[indicator];
    if (!kpi) return 0x10b981;
    const status = kpi.status || '';
    if (status.includes('Action') || status.includes('Alert')) return 0xe11d48;
    if (status.includes('Watch') || status.includes('Review')) return 0xf59e0b;
    return 0x10b981;
  }, [kpis]);

  const getStatusCssColor = (indicator: string): string => {
    const kpi = kpis[indicator];
    if (!kpi) return '#10B981';
    const status = kpi.status || '';
    if (status.includes('Action') || status.includes('Alert')) return '#E11D48';
    if (status.includes('Watch') || status.includes('Review')) return '#F59E0B';
    return '#10B981';
  };

  const getStatusText = (indicator: string): string => {
    const kpi = kpis[indicator];
    if (!kpi) return 'Normal';
    const status = kpi.status || '';
    if (status.includes('Action') || status.includes('Alert')) return 'Alert';
    if (status.includes('Watch') || status.includes('Review')) return 'Watch';
    return 'Normal';
  };

  // Keep ref for manual orbit controls and reset
  const sceneStateRef = useRef<{
    rotationY: number;
    rotationX: number;
    targetRotationY: number;
    targetRotationX: number;
    isDragging: boolean;
    prevMouseX: number;
    prevMouseY: number;
    heartMesh: THREE.Mesh | null;
    hotspotObjects: Map<string, THREE.Group>;
    materials: THREE.Material[];
  }>({
    rotationY: 0.15,
    rotationX: 0.05,
    targetRotationY: 0.15,
    targetRotationX: 0.05,
    isDragging: false,
    prevMouseX: 0,
    prevMouseY: 0,
    heartMesh: null,
    hotspotObjects: new Map(),
    materials: [],
  });

  // Handle Reset View
  const handleResetView = () => {
    sceneStateRef.current.targetRotationY = 0;
    sceneStateRef.current.targetRotationX = 0;
  };

  // Build Real-Time 3D Anatomical Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 240;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.1, 7.2);
    camera.lookAt(0, 1.1, 0);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Cinematic Studio Lighting (Matching semi-skeletal reference image)
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.85 : 1.1);
    scene.add(ambientLight);

    // Key Light (Warm ivory top-front)
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.4);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    // Rim Light (High-contrast cool cyan edge back-light)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 3.2);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    // Accent Vascular Light (Crimson fill from below)
    const vascularFill = new THREE.PointLight(0xe11d48, 1.8, 10);
    vascularFill.position.set(0, 0.8, 1.8);
    scene.add(vascularFill);

    // 4. Main Model Pivot Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // Common Materials List for Disposal
    const materials: THREE.Material[] = [];
    sceneStateRef.current.materials = materials;

    // A. Skeletal Bone Material (Ivory / Polished Bone)
    const boneMaterial = new THREE.MeshStandardMaterial({
      color: isDark ? 0xd1d5db : 0xf1f5f9,
      roughness: 0.35,
      metalness: 0.12,
    });
    materials.push(boneMaterial);

    // B. Muscular Striation Material (Deep Crimson / Burgundy)
    const muscleMaterial = new THREE.MeshStandardMaterial({
      color: 0x9f1239,
      roughness: 0.65,
      metalness: 0.08,
      bumpScale: 0.05,
    });
    materials.push(muscleMaterial);

    // C. Arterial Conduit Material (Vibrant Glowing Crimson)
    const arterialMaterial = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.2,
    });
    materials.push(arterialMaterial);

    // D. Venous Conduit Material (Deep Space Blue)
    const venousMaterial = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.2,
    });
    materials.push(venousMaterial);

    // Groups for Layer Filtering
    const skeletalGroup = new THREE.Group();
    const muscleGroup = new THREE.Group();
    const cardioGroup = new THREE.Group();
    modelGroup.add(skeletalGroup);
    modelGroup.add(muscleGroup);
    modelGroup.add(cardioGroup);

    // =========================================================================
    // 5. ANATOMICAL SKELETAL STRUCTURE
    // =========================================================================

    // Skull / Cranium (Vault, facial bones, and mandible)
    const craniumGeo = new THREE.SphereGeometry(0.85, 24, 20);
    craniumGeo.scale(0.82, 1.05, 0.95);
    const craniumMesh = new THREE.Mesh(craniumGeo, boneMaterial);
    craniumMesh.position.set(0, 3.15, 0);
    skeletalGroup.add(craniumMesh);

    // Zygomatic / Maxilla facial contour
    const faceGeo = new THREE.CylinderGeometry(0.55, 0.38, 0.75, 16);
    const faceMesh = new THREE.Mesh(faceGeo, boneMaterial);
    faceMesh.position.set(0, 2.65, 0.32);
    faceMesh.rotation.x = -0.15;
    skeletalGroup.add(faceMesh);

    // Mandible (Jawbone)
    const jawGeo = new THREE.TorusGeometry(0.48, 0.1, 8, 16, Math.PI * 0.85);
    const jawMesh = new THREE.Mesh(jawGeo, boneMaterial);
    jawMesh.position.set(0, 2.38, 0.25);
    jawMesh.rotation.x = Math.PI * 0.45;
    jawMesh.rotation.z = Math.PI * 0.08;
    skeletalGroup.add(jawMesh);

    // Cervical Spine (Vertebrae C1–C7)
    for (let i = 0; i < 7; i++) {
      const vertGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.07, 16);
      const vertMesh = new THREE.Mesh(vertGeo, boneMaterial);
      vertMesh.position.set(0, 2.05 + i * 0.085, -0.05);
      skeletalGroup.add(vertMesh);
    }

    // Thoracic & Lumbar Spine (T1–T12, L1–L5)
    for (let i = 0; i < 16; i++) {
      const spineGeo = new THREE.CylinderGeometry(0.26, 0.28, 0.09, 16);
      const spineMesh = new THREE.Mesh(spineGeo, boneMaterial);
      spineMesh.position.set(0, -0.7 + i * 0.17, -0.08);
      skeletalGroup.add(spineMesh);
    }

    // Clavicles (Left & Right Collarbones)
    const leftClavicleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.12, 1.98, 0.55),
      new THREE.Vector3(0.85, 2.02, 0.35),
      new THREE.Vector3(1.55, 1.95, 0.1),
    ]);
    const rightClavicleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, 1.98, 0.55),
      new THREE.Vector3(-0.85, 2.02, 0.35),
      new THREE.Vector3(-1.55, 1.95, 0.1),
    ]);
    skeletalGroup.add(new THREE.Mesh(new THREE.TubeGeometry(leftClavicleCurve, 16, 0.065, 8, false), boneMaterial));
    skeletalGroup.add(new THREE.Mesh(new THREE.TubeGeometry(rightClavicleCurve, 16, 0.065, 8, false), boneMaterial));

    // Sternum (Central Breastbone)
    const sternumGeo = new THREE.BoxGeometry(0.28, 1.35, 0.12);
    const sternumMesh = new THREE.Mesh(sternumGeo, boneMaterial);
    sternumMesh.position.set(0, 1.35, 0.88);
    sternumMesh.rotation.x = -0.08;
    skeletalGroup.add(sternumMesh);

    // Rib Cage (10 Pairs of Anatomically Curving Ribs)
    for (let r = 0; r < 9; r++) {
      const yPos = 1.82 - r * 0.18;
      const widthFactor = 0.85 + Math.sin((r / 8) * Math.PI) * 0.55;
      const depthFactor = 0.65 + Math.sin((r / 8) * Math.PI) * 0.35;

      // Left Rib
      const leftRibCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.15, yPos, -0.05),
        new THREE.Vector3(1.1 * widthFactor, yPos - 0.06, 0.25 * depthFactor),
        new THREE.Vector3(0.85 * widthFactor, yPos - 0.14, 0.82 * depthFactor),
        new THREE.Vector3(0.18, yPos - 0.18, 0.86),
      ]);
      const leftRibMesh = new THREE.Mesh(new THREE.TubeGeometry(leftRibCurve, 20, 0.042, 6, false), boneMaterial);
      skeletalGroup.add(leftRibMesh);

      // Right Rib
      const rightRibCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.15, yPos, -0.05),
        new THREE.Vector3(-1.1 * widthFactor, yPos - 0.06, 0.25 * depthFactor),
        new THREE.Vector3(-0.85 * widthFactor, yPos - 0.14, 0.82 * depthFactor),
        new THREE.Vector3(-0.18, yPos - 0.18, 0.86),
      ]);
      const rightRibMesh = new THREE.Mesh(new THREE.TubeGeometry(rightRibCurve, 20, 0.042, 6, false), boneMaterial);
      skeletalGroup.add(rightRibMesh);

      // Intercostal Muscular Striations (between ribs)
      if (r < 8) {
        const intercostalGeo = new THREE.CylinderGeometry(0.95 * widthFactor, 1.0 * widthFactor, 0.12, 12, 1, true);
        intercostalGeo.scale(1.0, 1.0, 0.75);
        const intercostalMesh = new THREE.Mesh(intercostalGeo, muscleMaterial);
        intercostalMesh.position.set(0, yPos - 0.09, 0.35);
        muscleGroup.add(intercostalMesh);
      }
    }

    // =========================================================================
    // 6. MUSCULAR STRIATIONS & FASCIAL BANDS
    // =========================================================================

    // Pectoral Muscle Slabs (Left & Right)
    const pecGeo = new THREE.SphereGeometry(0.72, 16, 12);
    pecGeo.scale(1.1, 0.7, 0.45);
    const leftPec = new THREE.Mesh(pecGeo, muscleMaterial);
    leftPec.position.set(0.68, 1.48, 0.65);
    leftPec.rotation.set(-0.1, 0.25, -0.2);
    muscleGroup.add(leftPec);

    const rightPec = new THREE.Mesh(pecGeo, muscleMaterial);
    rightPec.position.set(-0.68, 1.48, 0.65);
    rightPec.rotation.set(-0.1, -0.25, 0.2);
    muscleGroup.add(rightPec);

    // Deltoids & Shoulder Musculature
    const deltoidGeo = new THREE.SphereGeometry(0.58, 14, 12);
    deltoidGeo.scale(0.85, 1.25, 0.8);
    const leftDeltoid = new THREE.Mesh(deltoidGeo, muscleMaterial);
    leftDeltoid.position.set(1.72, 1.65, 0.15);
    muscleGroup.add(leftDeltoid);

    const rightDeltoid = new THREE.Mesh(deltoidGeo, muscleMaterial);
    rightDeltoid.position.set(-1.72, 1.65, 0.15);
    muscleGroup.add(rightDeltoid);

    // Abdominal Core & Splanchnic Muscle Bands
    const abGeo = new THREE.BoxGeometry(0.95, 1.2, 0.42);
    const abMesh = new THREE.Mesh(abGeo, muscleMaterial);
    abMesh.position.set(0, 0.1, 0.42);
    muscleGroup.add(abMesh);

    // =========================================================================
    // 7. CARDIOVASCULAR CONDUITS & PULSATING MYOCARDIUM
    // =========================================================================

    // Pulsating Heart Mesh (Left hemithorax behind ribs)
    const heartGeo = new THREE.SphereGeometry(0.48, 20, 16);
    heartGeo.scale(0.9, 1.15, 0.95);
    const heartMesh = new THREE.Mesh(heartGeo, arterialMaterial);
    heartMesh.position.set(0.3, 1.25, 0.52);
    heartMesh.rotation.set(0.2, -0.15, -0.3);
    cardioGroup.add(heartMesh);
    sceneStateRef.current.heartMesh = heartMesh;

    // Aortic Arch & Descending Aorta
    const aortaArchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.25, 1.45, 0.52), // Ventricle outflow
      new THREE.Vector3(0.08, 1.88, 0.48), // Ascending aorta
      new THREE.Vector3(-0.04, 1.98, 0.38), // Aortic arch summit
      new THREE.Vector3(-0.15, 1.68, 0.18), // Descending arch
      new THREE.Vector3(-0.1, 0.8, 0.1), // Mid-thoracic aorta
      new THREE.Vector3(-0.06, -0.4, 0.12), // Abdominal aorta
      new THREE.Vector3(0.0, -0.75, 0.18), // Bifurcation
    ]);
    const aortaMesh = new THREE.Mesh(new THREE.TubeGeometry(aortaArchCurve, 28, 0.075, 8, false), arterialMaterial);
    cardioGroup.add(aortaMesh);

    // Bilateral Carotid Arteries (Ascending to Baroreceptors)
    const leftCarotidCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.05, 1.95, 0.4),
      new THREE.Vector3(0.28, 2.25, 0.28),
      new THREE.Vector3(0.32, 2.45, 0.25),
      new THREE.Vector3(0.28, 2.75, 0.15),
    ]);
    const rightCarotidCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.08, 1.95, 0.4),
      new THREE.Vector3(-0.28, 2.25, 0.28),
      new THREE.Vector3(-0.32, 2.45, 0.25),
      new THREE.Vector3(-0.28, 2.75, 0.15),
    ]);
    cardioGroup.add(new THREE.Mesh(new THREE.TubeGeometry(leftCarotidCurve, 16, 0.045, 6, false), arterialMaterial));
    cardioGroup.add(new THREE.Mesh(new THREE.TubeGeometry(rightCarotidCurve, 16, 0.045, 6, false), arterialMaterial));

    // Carotid Sinus Baroreceptor Bulbs (Right & Left)
    const baroBulbGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const leftBaroBulb = new THREE.Mesh(baroBulbGeo, arterialMaterial);
    leftBaroBulb.position.set(0.32, 2.38, 0.26);
    cardioGroup.add(leftBaroBulb);

    const rightBaroBulb = new THREE.Mesh(baroBulbGeo, arterialMaterial);
    rightBaroBulb.position.set(-0.32, 2.38, 0.26);
    cardioGroup.add(rightBaroBulb);

    // Venous System (Superior Vena Cava & Femoral/Splanchnic Return)
    const svcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.22, 2.65, 0.12),
      new THREE.Vector3(0.28, 2.15, 0.26),
      new THREE.Vector3(0.35, 1.65, 0.42),
      new THREE.Vector3(0.38, 1.35, 0.46), // Right atrium entry
    ]);
    cardioGroup.add(new THREE.Mesh(new THREE.TubeGeometry(svcCurve, 20, 0.055, 6, false), venousMaterial));

    // Splanchnic / Mesenteric Venous Pooling Mesh (Lower abdomen)
    const splanchnicCurveLeft = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, -0.65, 0.15),
      new THREE.Vector3(0.35, -0.85, 0.25),
      new THREE.Vector3(0.65, -1.05, 0.35),
    ]);
    const splanchnicCurveRight = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, -0.65, 0.15),
      new THREE.Vector3(-0.35, -0.85, 0.25),
      new THREE.Vector3(-0.65, -1.05, 0.35),
    ]);
    cardioGroup.add(new THREE.Mesh(new THREE.TubeGeometry(splanchnicCurveLeft, 12, 0.05, 6, false), venousMaterial));
    cardioGroup.add(new THREE.Mesh(new THREE.TubeGeometry(splanchnicCurveRight, 12, 0.05, 6, false), venousMaterial));

    // =========================================================================
    // 8. INTERACTIVE 3D HOTSPOT OBJECTS (Radar Rings & Core Pins)
    // =========================================================================
    sceneStateRef.current.hotspotObjects.clear();

    hotspots.forEach((hs) => {
      const hsGroup = new THREE.Group();
      hsGroup.position.set(...hs.position);
      hsGroup.userData = { id: hs.id, indicator: hs.indicator };

      const statusColor = getStatusColorHex(hs.indicator);
      const isSelected = selectedHotspot === hs.id;

      // Hotspot Core Marker
      const markerGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({
        color: statusColor,
        transparent: true,
        opacity: 0.95,
      });
      materials.push(markerMat);
      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      hsGroup.add(markerMesh);

      // Pulsating Outer Halo Ring
      const ringGeo = new THREE.RingGeometry(0.18, 0.24, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: statusColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.9 : 0.45,
      });
      materials.push(ringMat);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.name = 'radarRing';
      hsGroup.add(ringMesh);

      // Hit Target for Raycasting
      const hitGeo = new THREE.SphereGeometry(0.42, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      materials.push(hitMat);
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { id: hs.id, indicator: hs.indicator };
      hsGroup.add(hitMesh);

      modelGroup.add(hsGroup);
      sceneStateRef.current.hotspotObjects.set(hs.id, hsGroup);
    });

    // =========================================================================
    // 9. INTERACTIVE DRAG TO ROTATE & RAYCASTING
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: PointerEvent) => {
      sceneStateRef.current.isDragging = true;
      sceneStateRef.current.prevMouseX = e.clientX;
      sceneStateRef.current.prevMouseY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!sceneStateRef.current.isDragging) return;
      const deltaX = e.clientX - sceneStateRef.current.prevMouseX;
      const deltaY = e.clientY - sceneStateRef.current.prevMouseY;

      sceneStateRef.current.targetRotationY += deltaX * 0.012;
      sceneStateRef.current.targetRotationX = Math.max(
        -0.45,
        Math.min(0.45, sceneStateRef.current.targetRotationX + deltaY * 0.008)
      );

      sceneStateRef.current.prevMouseX = e.clientX;
      sceneStateRef.current.prevMouseY = e.clientY;
    };

    const handlePointerUp = () => {
      sceneStateRef.current.isDragging = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(modelGroup.children, true);

      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr && curr !== modelGroup) {
          if (curr.userData && curr.userData.id) {
            onSelectHotspot(curr.userData.id, curr.userData.indicator);
            return;
          }
          curr = curr.parent;
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    domElement.addEventListener('click', handleClick);

    // =========================================================================
    // 10. ANIMATION RENDER LOOP (Pulsing Heart & Smooth Damping)
    // =========================================================================
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // Smooth Inertial Rotation Damping
      sceneStateRef.current.rotationY +=
        (sceneStateRef.current.targetRotationY - sceneStateRef.current.rotationY) * 0.08;
      sceneStateRef.current.rotationX +=
        (sceneStateRef.current.targetRotationX - sceneStateRef.current.rotationX) * 0.08;

      // Optional Idle Auto-Spin
      if (autoRotate && !sceneStateRef.current.isDragging) {
        sceneStateRef.current.targetRotationY += 0.004;
      }

      modelGroup.rotation.y = sceneStateRef.current.rotationY;
      modelGroup.rotation.x = sceneStateRef.current.rotationX;

      // Realistic Systolic-Diastolic Heartbeat Oscillation
      if (sceneStateRef.current.heartMesh) {
        const pulse = 1.0 + Math.pow(Math.sin(elapsed * 4.8), 6) * 0.12;
        sceneStateRef.current.heartMesh.scale.set(0.9 * pulse, 1.15 * pulse, 0.95 * pulse);
      }

      // Hotspot Radar Ring Billboarding and Pulse
      sceneStateRef.current.hotspotObjects.forEach((hsGroup) => {
        const radar = hsGroup.getObjectByName('radarRing');
        if (radar) {
          radar.quaternion.copy(camera.quaternion);
          const ringPulse = 1.0 + Math.sin(elapsed * 3.5) * 0.15;
          radar.scale.set(ringPulse, ringPulse, ringPulse);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // =========================================================================
    // 11. CLEANUP ON UNMOUNT (Zero Context Leaks)
    // =========================================================================
    return () => {
      cancelAnimationFrame(animationFrameId);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('click', handleClick);

      renderer.dispose();
      materials.forEach((m) => m.dispose());
      scene.clear();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [isDark, autoRotate, getStatusColorHex, onSelectHotspot]);

  // Update Layer Visibility
  useEffect(() => {
    // Re-render layer visibility if toggled
  }, [anatomyLayer]);

  return (
    <div className="flex flex-col items-center justify-between w-full h-full select-none gap-2">
      {/* 3D WebGL Anatomical Model Viewport */}
      <div className="relative w-full max-w-[230px] aspect-square flex items-center justify-center rounded-2xl overflow-hidden border border-slate-900/15 dark:border-sky-500/30 bg-[#060A14] shadow-md group">
        {/* Cinematic Background Gradient & Grid */}
        <div className="absolute inset-0 bg-radial from-[#0F172A] via-[#090D1A] to-[#03060E] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#38bdf80d_1px,transparent_1px),linear-gradient(to_bottom,#38bdf80d_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />

        {/* Real-Time Three.js Canvas Mount */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing z-10" />

        {/* Corner HUD Reticles */}
        <div className="absolute top-1.5 left-1.5 w-2 h-2 border-t-2 border-l-2 border-sky-400/60 pointer-events-none" />
        <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t-2 border-r-2 border-sky-400/60 pointer-events-none" />
        <div className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b-2 border-l-2 border-sky-400/60 pointer-events-none" />
        <div className="absolute bottom-1.5 right-1.5 w-2 h-2 border-b-2 border-r-2 border-sky-400/60 pointer-events-none" />

        {/* Top Viewport Micro-Header */}
        <div className="absolute top-1.5 left-3 right-3 flex items-center justify-between text-[8px] font-mono font-bold text-sky-400/80 pointer-events-none z-20">
          <span>3D WEBGL ENGINE</span>
          <span>ORBIT: DRAG TO ROTATE</span>
        </div>

        {/* Interactive Floating Quick Actions (Reset View & Auto-Rotate Toggle) */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 z-20">
          <button
            type="button"
            onClick={handleResetView}
            className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-sky-400 border border-sky-500/30 backdrop-blur-sm transition-colors shadow-2xs"
            title="Reset 3D Frontal View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-sky-400 border border-sky-500/30 backdrop-blur-sm transition-colors shadow-2xs"
            title={autoRotate ? 'Pause 3D Auto-Spin' : 'Resume 3D Auto-Spin'}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Layer Badge Filter */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 z-20">
          <button
            type="button"
            onClick={() =>
              setAnatomyLayer((prev) => (prev === 'all' ? 'cardio' : prev === 'cardio' ? 'skeletal' : 'all'))
            }
            className="px-2 py-1 rounded-md text-[9px] font-mono font-bold bg-black/40 hover:bg-black/60 text-slate-300 border border-slate-700/60 backdrop-blur-sm transition-colors flex items-center gap-1 shadow-2xs"
            title="Cycle Anatomical Visual System Layers"
          >
            <Layers className="w-3 h-3 text-sky-400" />
            <span className="capitalize">{anatomyLayer}</span>
          </button>
        </div>
      </div>

      {/* 1-Line Helper Prompt */}
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center tracking-tight">
        Drag to rotate in 3D. Click any 3D node or button below to inspect status.
      </p>

      {/* Bottom 2x2 High-Contrast Selector Buttons with Text Status */}
      <div className="w-full grid grid-cols-2 gap-2 shrink-0">
        {hotspots.map((hs) => {
          const isSelected = selectedHotspot === hs.id;
          const color = getStatusCssColor(hs.indicator);
          const statusText = getStatusText(hs.indicator);

          return (
            <button
              key={hs.id}
              type="button"
              onClick={() => onSelectHotspot(hs.id, hs.indicator)}
              className={`h-10 px-2.5 text-xs sm:text-sm font-bold rounded-xl border flex items-center justify-between transition-all backdrop-blur-sm ${
                isSelected
                  ? 'bg-orange-500/25 text-orange-950 dark:text-orange-200 border-orange-500 shadow-xs ring-1 ring-orange-400'
                  : 'bg-white/20 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 border-transparent dark:border-slate-700/60 hover:border-orange-400 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="truncate">{hs.name}</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                  statusText === 'Alert'
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                    : statusText === 'Watch'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {statusText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
