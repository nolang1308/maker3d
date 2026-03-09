'use client';

import React, { useEffect, useRef, useState } from 'react';

interface STLViewerProps {
  file: File | null;
  className?: string;
  onDimensions?: (dims: { x: number; y: number; z: number }) => void;
  modelColor?: string; // hex string (e.g. '#F5F5F0') or 'TRANSPARENT'
}

export default function STLViewer({ file, className, onDimensions, modelColor }: STLViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupportedPreview, setUnsupportedPreview] = useState(false);

  useEffect(() => {
    if (!file || !mountRef.current) return;

    // .stp / .step 파일은 Three.js 미지원 → placeholder 표시
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'stp' || ext === 'step') {
      setUnsupportedPreview(true);
      setIsLoaded(false);
      setError(null);
      return;
    }

    setUnsupportedPreview(false);

    let scene: any = null;
    let camera: any = null;
    let renderer: any = null;
    let animationId: number | null = null;

    const loadAndDisplay3D = async () => {
      try {
        setIsLoaded(false);
        setError(null);

        // Three.js 동적 로딩
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        const container = mountRef.current;
        if (!container) return;

        // 기존 내용 제거
        container.innerHTML = '';

        // Scene 생성
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);

        // Camera 설정
        camera = new THREE.PerspectiveCamera(
          75,
          container.clientWidth / container.clientHeight,
          0.1,
          1000
        );

        // Renderer 설정
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // 그리드 추가 (바닥)
        const gridHelper = new THREE.GridHelper(10, 20, 0x888888, 0xcccccc);
        gridHelper.position.y = -1;
        scene.add(gridHelper);

        // 조명 설정
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambientLight);

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight1.position.set(1, 2, 1.5);
        scene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
        directionalLight2.position.set(-1, -1, -0.5);
        scene.add(directionalLight2);

        const isTransparentColor = modelColor === 'TRANSPARENT';
        const initialColor = isTransparentColor ? 0xffffff : (modelColor ?? '#00AA88');
        const initialOpacity = isTransparentColor ? 0.25 : 0.9;
        const material = new THREE.MeshPhongMaterial({
          color: initialColor,
          transparent: true,
          opacity: initialOpacity,
          side: THREE.DoubleSide
        });
        materialRef.current = material;

        if (ext === 'obj') {
          // OBJLoader 사용
          const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
          const objText = await file.text();
          const loader = new OBJLoader();
          const object = loader.parse(objText);

          // Group 내 Mesh들의 bounding box를 합산해 정규화
          const box = new THREE.Box3().setFromObject(object);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDimension = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDimension;

          // 모델 치수(mm) 콜백 전달
          onDimensions?.({ x: size.x, y: size.y, z: size.z });

          object.position.sub(center.multiplyScalar(scale));
          object.scale.setScalar(scale);

          object.traverse((child: any) => {
            if (child.isMesh) {
              child.material = material;
            }
          });

          scene.add(object);
        } else {
          // 기존 STLLoader 로직
          const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
          const loader = new STLLoader();
          const arrayBuffer = await file.arrayBuffer();
          const geometry = loader.parse(arrayBuffer);

          geometry.computeBoundingBox();
          const boundingBox = geometry.boundingBox;
          if (!boundingBox) return;

          const center = new THREE.Vector3();
          boundingBox.getCenter(center);

          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          const maxDimension = Math.max(size.x, size.y, size.z);

          // 모델 치수(mm) 콜백 전달
          onDimensions?.({ x: size.x, y: size.y, z: size.z });

          const scale = 2 / maxDimension;
          geometry.scale(scale, scale, scale);
          geometry.translate(-center.x * scale, -center.y * scale, -center.z * scale);

          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotation.x = -Math.PI / 2; // STL은 Z-up 좌표계, Three.js는 Y-up
          // 회전 후 모델 바닥을 그리드(y=-1)에 맞춤
          mesh.position.y = (size.z * scale) / 2 - 1;
          scene.add(mesh);
        }

        // 카메라 위치 설정
        camera.position.set(3, 3, 3);
        camera.lookAt(0, 0, 0);

        // OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 1;
        controls.maxDistance = 10;
        controls.maxPolarAngle = Math.PI / 2;

        const animate = () => {
          animationId = requestAnimationFrame(animate);
          controls.update();
          if (renderer && scene && camera) {
            renderer.render(scene, camera);
          }
        };

        animate();
        setIsLoaded(true);

        return () => {
          if (animationId) cancelAnimationFrame(animationId);
          controls.dispose();
          if (renderer) renderer.dispose();
        };

      } catch (err) {
        console.error('3D 모델 로딩 오류:', err);
        setError('3D 모델을 로드할 수 없습니다.');
        setIsLoaded(false);
      }
    };

    const cleanup = loadAndDisplay3D();

    return () => {
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  // 색상 변경 시 material만 업데이트 (모델 재로딩 없음)
  useEffect(() => {
    if (!materialRef.current) return;
    const mat = materialRef.current;
    if (modelColor === 'TRANSPARENT') {
      mat.color.set(0xffffff);
      mat.opacity = 0.25;
    } else if (modelColor) {
      mat.color.set(modelColor);
      mat.opacity = 0.9;
    } else {
      mat.color.set(0x00AA88);
      mat.opacity = 0.9;
    }
    mat.needsUpdate = true;
  }, [modelColor]);

  if (!file) {
    return (
      <div className={className} style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: '10px',
        color: '#6c757d'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p>3D 파일을 업로드하면</p>
          <p>미리보기가 표시됩니다</p>
        </div>
      </div>
    );
  }

  if (unsupportedPreview) {
    return (
      <div className={className} style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: '10px',
        color: '#6c757d'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📐</div>
          <p style={{ fontWeight: 600 }}>{file.name}</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>STP/STEP 파일은 미리보기를 지원하지 않습니다</p>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>파일은 정상적으로 업로드됩니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '10px',
          overflow: 'hidden'
        }}
      />

      {!isLoaded && !error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255,255,255,0.9)',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div>3D 모델 로딩 중...</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            {file.name}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255,0,0,0.1)',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          color: 'red'
        }}>
          <div>{error}</div>
        </div>
      )}
    </div>
  );
}
