'use client';

import React, { useEffect, useRef, useState } from 'react';

interface STLViewerProps {
  file: File | null;
  className?: string;
}

export default function STLViewer({ file, className }: STLViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !mountRef.current) return;

    let scene: any = null;
    let camera: any = null;
    let renderer: any = null;
    let mesh: any = null;
    let animationId: number | null = null;

    const loadAndDisplay3D = async () => {
      try {
        setIsLoaded(false);
        setError(null);

        // Three.js 동적 로딩
        const THREE = await import('three');
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');

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

        // 조명 설정
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        scene.add(ambientLight);

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight1.position.set(1, 1, 1);
        scene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-1, -1, -0.5);
        scene.add(directionalLight2);

        // STL 파일 로드
        const loader = new STLLoader();
        const arrayBuffer = await file.arrayBuffer();
        const geometry = loader.parse(arrayBuffer);

        // 지오메트리 정규화
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        if (!boundingBox) return;
        
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        // 스케일링
        const scale = 2 / maxDimension;
        geometry.scale(scale, scale, scale);
        
        // 센터링
        geometry.translate(-center.x * scale, -center.y * scale, -center.z * scale);

        // 머티리얼과 메시 생성
        const material = new THREE.MeshPhongMaterial({
          color: 0x00AA88,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide
        });

        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // 카메라 위치 설정
        camera.position.set(3, 3, 3);
        camera.lookAt(0, 0, 0);

        // 마우스 컨트롤 변수
        let isMouseDown = false;
        let mouseX = 0, mouseY = 0;
        let targetRotationX = 0, targetRotationY = 0;
        let currentRotationX = 0, currentRotationY = 0;

        // 마우스 이벤트
        const onMouseDown = (event: MouseEvent) => {
          isMouseDown = true;
          mouseX = event.clientX;
          mouseY = event.clientY;
        };

        const onMouseMove = (event: MouseEvent) => {
          if (!isMouseDown) return;
          
          const deltaX = event.clientX - mouseX;
          const deltaY = event.clientY - mouseY;
          
          targetRotationY += deltaX * 0.01;
          targetRotationX += deltaY * 0.01;
          
          mouseX = event.clientX;
          mouseY = event.clientY;
        };

        const onMouseUp = () => {
          isMouseDown = false;
        };

        const onWheel = (event: WheelEvent) => {
          const scale = event.deltaY > 0 ? 1.1 : 0.9;
          camera.position.multiplyScalar(scale);
          camera.position.clampLength(1, 10);
        };

        // 이벤트 리스너 추가
        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mouseup', onMouseUp);
        container.addEventListener('wheel', onWheel);

        // 애니메이션 루프
        const animate = () => {
          animationId = requestAnimationFrame(animate);

          // 부드러운 회전
          currentRotationX += (targetRotationX - currentRotationX) * 0.05;
          currentRotationY += (targetRotationY - currentRotationY) * 0.05;

          if (mesh) {
            mesh.rotation.x = currentRotationX;
            mesh.rotation.y = currentRotationY;
          }

          if (renderer && scene && camera) {
            renderer.render(scene, camera);
          }
        };

        animate();
        setIsLoaded(true);

        // 정리 함수 반환
        return () => {
          if (animationId) {
            cancelAnimationFrame(animationId);
          }
          
          if (container) {
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseup', onMouseUp);
            container.removeEventListener('wheel', onWheel);
          }
          
          if (renderer) {
            renderer.dispose();
          }
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
  }, [file]);

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
          <p>STL 파일을 업로드하면</p>
          <p>3D 미리보기가 표시됩니다</p>
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
          overflow: 'hidden',
          cursor: isLoaded ? 'grab' : 'default'
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