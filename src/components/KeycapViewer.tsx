'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface KeycapViewerProps {
  /** Z-up(mm) 좌표계의 키캡 그룹. 뷰어가 Y-up으로 회전해 표시한다. */
  model: THREE.Group | null;
  className?: string;
}

function makeGroundTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.22)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function KeycapViewer({ model, className }: KeycapViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const fittedRef = useRef(false);

  // 렌더러/장면 초기화 (한 번)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f5f7);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 500);
    camera.position.set(34, 30, 42);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb9c2cc, 1.4);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(25, 45, 30);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.9);
    fill.position.set(-35, 20, -20);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(0, 15, -45);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshBasicMaterial({ map: makeGroundTexture(), transparent: true, depthWrite: false }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    // Z-up 모델을 Y-up 장면에 맞추는 홀더
    const holder = new THREE.Group();
    holder.rotation.x = -Math.PI / 2;
    scene.add(holder);
    holderRef.current = holder;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 12;
    controls.maxDistance = 160;
    controls.target.set(0, 4, 0);
    controlsRef.current = controls;

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      ground.geometry.dispose();
      (ground.material as THREE.MeshBasicMaterial).map?.dispose();
      (ground.material as THREE.MeshBasicMaterial).dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      holderRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  // 모델 교체
  useEffect(() => {
    const holder = holderRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!holder || !camera || !controls) return;

    while (holder.children.length) holder.remove(holder.children[0]);
    if (!model) return;
    holder.add(model);

    // 최초 모델에만 카메라를 맞추고, 이후엔 사용자가 돌려 놓은 시점을 유지
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    controls.target.copy(center);
    if (!fittedRef.current) {
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const dist = maxDim * 2.4;
      camera.position.set(center.x + dist * 0.65, center.y + dist * 0.6, center.z + dist * 0.8);
      fittedRef.current = true;
    }
    controls.update();
  }, [model]);

  return <div ref={mountRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
