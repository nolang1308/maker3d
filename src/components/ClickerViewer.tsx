'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CLICKER, ClickerLayout, getClickerSize } from '@/utils/clicker/layouts';
import { buildClickerModel, ClickerModel } from '@/utils/clicker/clickerModel';
import { CaseMesh, loadCaseMesh } from '@/utils/clicker/caseMesh';

export interface ClickerViewerApi {
  /** 현재 화면을 PNG data URL 로 돌려준다 */
  capture: () => string | null;
  resetView: () => void;
}

interface ClickerViewerProps {
  layout: ClickerLayout;
  caseColor: string;
  keycapColor: string;
  showRing: boolean;
  /** 키마다 윗면 그림 (없으면 null) */
  faces: readonly (HTMLCanvasElement | null)[];
  className?: string;
  onApi?: (api: ClickerViewerApi | null) => void;
}

const BACKGROUND = 0xf3f5f7;
const VIEW_AZIMUTH = THREE.MathUtils.degToRad(26);
const VIEW_POLAR = THREE.MathUtils.degToRad(41);
const INTRO_DURATION = 1.5;
const FIT_MARGIN = 1.14;

interface Intro {
  elapsed: number;
  fromAzimuth: number;
  fromPolar: number;
  fromDistance: number;
}

interface ViewerState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  keyLight: THREE.DirectionalLight;
  contact: THREE.Mesh;
  model: ClickerModel | null;
  /** 화면 맞춤 기준: 회전 중심과 모델을 감싸는 상자 */
  center: THREE.Vector3;
  box: THREE.Box3;
  intro: Intro | null;
  userMoved: boolean;
  /** 지금 보여주고 있는 클리커 종류 (종류가 바뀔 때만 시점을 처음으로 돌린다) */
  layoutId: string | null;
  dirty: boolean;
}

function makeContactTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(20,28,40,0.30)');
    grad.addColorStop(0.55, 'rgba(20,28,40,0.10)');
    grad.addColorStop(1, 'rgba(20,28,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 회전 중심에서 카메라를 향하는 단위 벡터 */
function viewDirection(azimuth: number, polar: number): THREE.Vector3 {
  const sinPolar = Math.sin(polar);
  return new THREE.Vector3(sinPolar * Math.sin(azimuth), Math.cos(polar), sinPolar * Math.cos(azimuth));
}

/** 기본 시점에서 모델 전체가 화면에 들어오는 가장 가까운 거리 (여백 포함) */
function fitDistance(state: ViewerState): number {
  const { camera, box, center } = state;
  const toCamera = viewDirection(VIEW_AZIMUTH, VIEW_POLAR);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toCamera).normalize();
  const up = new THREE.Vector3().crossVectors(toCamera, right);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;
  const corner = new THREE.Vector3();
  let distance = 1;
  for (let i = 0; i < 8; i++) {
    corner
      .set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
      .sub(center);
    const depth = corner.dot(toCamera);
    distance = Math.max(
      distance,
      Math.abs(corner.dot(right)) / tanH + depth,
      Math.abs(corner.dot(up)) / tanV + depth,
    );
  }
  return distance * FIT_MARGIN;
}

function placeCamera(state: ViewerState, azimuth: number, polar: number, distance: number): void {
  state.camera.position.copy(state.center).addScaledVector(viewDirection(azimuth, polar), distance);
  state.camera.lookAt(state.center);
}

/** 새 모델에 맞춰 회전 중심 · 조명 · 그림자 · 카메라를 잡는다 */
function frame(state: ViewerState, layout: ClickerLayout, model: ClickerModel): void {
  // 몸체가 주인공이므로 회전 중심은 케이스 쪽에 두되,
  // 한쪽으로 튀어나온 키링 때문에 화면이 치우치지 않게 전체 중심 쪽으로 조금 옮긴다
  model.group.updateMatrixWorld(true);
  state.box.setFromObject(model.group);
  const boxCenter = state.box.getCenter(new THREE.Vector3());
  state.center.set(boxCenter.x * 0.4, getClickerSize(layout).height * 0.45, boxCenter.z * 0.4);

  const reach = state.box.getSize(new THREE.Vector3()).length() * 0.75;
  state.keyLight.position.set(state.center.x - reach * 0.75, reach * 1.7, state.center.z + reach * 0.65);
  state.keyLight.target.position.copy(state.center);
  const shadowCamera = state.keyLight.shadow.camera;
  shadowCamera.left = -reach;
  shadowCamera.right = reach;
  shadowCamera.top = reach;
  shadowCamera.bottom = -reach;
  shadowCamera.near = 1;
  shadowCamera.far = reach * 5;
  shadowCamera.updateProjectionMatrix();

  state.contact.scale.set(layout.caseWidth * 1.9, layout.caseDepth * 1.9, 1);

  const distance = fitDistance(state);
  state.controls.minDistance = distance * 0.4;
  state.controls.maxDistance = distance * 3;

  const sameLayout = state.layoutId === layout.id;
  state.layoutId = layout.id;
  if (sameLayout && state.userMoved) {
    // 키링만 켜고 끈 경우: 돌려 놓은 시점을 그대로 둔다
  } else if (sameLayout) {
    state.controls.target.copy(state.center);
    if (!state.intro) placeCamera(state, VIEW_AZIMUTH, VIEW_POLAR, distance);
  } else {
    // 새 종류: 옆에서 돌아 들어오며 기본 시점에 멈춘다
    state.controls.target.copy(state.center);
    state.userMoved = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      state.intro = null;
      placeCamera(state, VIEW_AZIMUTH, VIEW_POLAR, distance);
    } else {
      state.intro = {
        elapsed: 0,
        fromAzimuth: VIEW_AZIMUTH - THREE.MathUtils.degToRad(64),
        fromPolar: VIEW_POLAR + THREE.MathUtils.degToRad(24),
        fromDistance: distance * 1.3,
      };
      placeCamera(state, state.intro.fromAzimuth, state.intro.fromPolar, state.intro.fromDistance);
    }
  }
  state.dirty = true;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function ClickerViewer({
  layout,
  caseColor,
  keycapColor,
  showRing,
  faces,
  className,
  onApi,
}: ClickerViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ViewerState | null>(null);

  // 색과 그림은 모델을 다시 만들지 않고 갱신하므로, 모델을 새로 만들 때 쓸 최신 값을 따로 들고 있는다
  const latest = useRef({ caseColor, keycapColor, faces });
  useEffect(() => {
    latest.current = { caseColor, keycapColor, faces };
  });

  // 렌더러와 장면 (한 번만)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      // WebGL 을 쓸 수 없는 환경: 빈 화면 대신 안내 문구를 보여준다
      console.error('3D 미리보기를 시작할 수 없습니다:', err);
      const message = document.createElement('p');
      message.textContent = '이 브라우저에서는 3D 미리보기를 표시할 수 없습니다.';
      message.style.cssText = 'margin:0;padding:24px;text-align:center;color:#6b7280;font-size:14px;';
      container.appendChild(message);
      return () => {
        if (message.parentNode === container) container.removeChild(message);
      };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'grab';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04).texture;
    scene.environment = environment;
    // 조명의 합이 윗면에서 1 안팎이 되도록 맞춘다. 더 밝으면 사진이 원본보다 뿌옇고 밝게 보인다
    scene.environmentIntensity = 0.5;
    room.dispose();
    pmrem.dispose();

    // 화각을 좁혀 멀리서 당겨 찍은 것처럼 보이게 한다 (앞뒤 키의 크기 차이가 줄어 제품 사진에 가깝다)
    const camera = new THREE.PerspectiveCamera(24, 1, 1, 4000);

    // 주광은 왼쪽 위 앞에서 비춘다. 기본 시점(오른쪽 앞)과 방향이 달라야 윗면·앞면·옆면의 밝기가 갈려 입체감이 산다
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.06;
    keyLight.shadow.radius = 7;
    keyLight.shadow.blurSamples = 16;
    scene.add(keyLight);
    scene.add(keyLight.target);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(70, 60, -80);
    scene.add(rim);

    // 바닥: 조명 그림자 + 은은한 접지 그림자
    const shadowMaterial = new THREE.ShadowMaterial({ color: 0x1a2433, opacity: 0.2 });
    shadowMaterial.depthWrite = false;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), shadowMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const contactTexture = makeContactTexture();
    const contactMaterial = new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false });
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), contactMaterial);
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.02;
    contact.renderOrder = -1;
    scene.add(contact);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = THREE.MathUtils.degToRad(86);
    controls.zoomSpeed = 0.8;

    const state: ViewerState = {
      renderer,
      scene,
      camera,
      controls,
      keyLight,
      contact,
      model: null,
      center: new THREE.Vector3(),
      box: new THREE.Box3(new THREE.Vector3(-20, 0, -20), new THREE.Vector3(20, 24, 20)),
      intro: null,
      userMoved: false,
      layoutId: null,
      dirty: true,
    };
    stateRef.current = state;

    controls.addEventListener('start', () => {
      state.intro = null;
      state.userMoved = true;
      renderer.domElement.style.cursor = 'grabbing';
    });
    controls.addEventListener('end', () => {
      renderer.domElement.style.cursor = 'grab';
    });
    // 휠·두 손가락 확대는 컨트롤이 그 자리에서 카메라를 옮겨 버려서, 아래 루프의 controls.update() 는
    // "더 바뀐 게 없다"고 답한다. 카메라가 바뀔 때마다 직접 다시 그리도록 표시해 둔다
    controls.addEventListener('change', () => {
      state.dirty = true;
    });

    // 키캡 찾기 (눌러보기 / 커서 표시)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickKey = (clientX: number, clientY: number): number | null => {
      if (!state.model) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(state.model.group, true)[0];
      let obj: THREE.Object3D | null = hit?.object ?? null;
      while (obj) {
        if (typeof obj.userData.keyIndex === 'number') return obj.userData.keyIndex;
        obj = obj.parent;
      }
      return null;
    };

    let down: { x: number; y: number; time: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, time: performance.now() };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.time < 500;
      down = null;
      if (moved > 6 || !quick) return;
      const index = pickKey(e.clientX, e.clientY);
      const key = state.model?.keys.find((k) => k.index === index);
      if (key) {
        key.pressTarget = 1;
        key.hold = 0.11;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons !== 0) return;
      renderer.domElement.style.cursor = pickKey(e.clientX, e.clientY) !== null ? 'pointer' : 'grab';
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!state.userMoved && !state.intro && state.model) {
        placeCamera(state, VIEW_AZIMUTH, VIEW_POLAR, fitDistance(state));
      }
      // 크기를 바꾸면 그림이 지워진다. 다음 프레임을 기다리지 않고 바로 다시 그려야,
      // 단계가 넘어가며 화면 폭이 계속 바뀌는 동안에도 3D 가 깜빡이지 않는다
      renderer.render(scene, camera);
      state.dirty = false;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      let animating = false;

      if (state.intro) {
        const intro = state.intro;
        intro.elapsed += dt;
        const t = easeOutCubic(Math.min(1, intro.elapsed / INTRO_DURATION));
        const target = fitDistance(state);
        placeCamera(
          state,
          THREE.MathUtils.lerp(intro.fromAzimuth, VIEW_AZIMUTH, t),
          THREE.MathUtils.lerp(intro.fromPolar, VIEW_POLAR, t),
          THREE.MathUtils.lerp(intro.fromDistance, target, t),
        );
        if (intro.elapsed >= INTRO_DURATION) state.intro = null;
        animating = true;
      }

      for (const key of state.model?.keys ?? []) {
        if (key.pressTarget > 0) {
          if (key.press > 0.92) key.hold -= dt;
          if (key.hold <= 0) key.pressTarget = 0;
        }
        const diff = key.pressTarget - key.press;
        if (Math.abs(diff) > 0.001) {
          const speed = key.pressTarget > key.press ? 42 : 20;
          key.press += diff * (1 - Math.exp(-dt * speed));
          animating = true;
        } else if (key.press !== key.pressTarget) {
          key.press = key.pressTarget;
          animating = true;
        }
        key.group.position.y = key.restY - key.press * CLICKER.keyTravel;
      }

      const moved = controls.update();
      if (moved || animating || state.dirty) {
        state.dirty = false;
        renderer.render(scene, camera);
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      controls.dispose();
      if (state.model) {
        scene.remove(state.model.group);
        state.model.dispose();
        state.model = null;
      }
      floor.geometry.dispose();
      shadowMaterial.dispose();
      contact.geometry.dispose();
      contactMaterial.dispose();
      contactTexture.dispose();
      environment.dispose();
      keyLight.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // 모델 만들기 (종류나 키링이 바뀔 때).
  // 케이스 메시는 처음 한 번만 내려받고, 새 모델이 준비될 때까지는 이전 모델을 그대로 보여준다
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    let cancelled = false;

    const build = (caseMesh: CaseMesh | null) => {
      if (cancelled || stateRef.current !== state) return;
      if (state.model) {
        state.scene.remove(state.model.group);
        state.model.dispose();
      }
      const model = buildClickerModel(
        layout,
        { caseColor: latest.current.caseColor, keycapColor: latest.current.keycapColor, showRing },
        caseMesh,
      );
      model.setFaces(latest.current.faces, state.renderer.capabilities.getMaxAnisotropy());
      state.scene.add(model.group);
      state.model = model;
      frame(state, layout, model);
    };

    // 직접 입력한 크기는 모델 파일이 없다: 같은 규격으로 바로 만든다
    const pending = layout.meshUrl ? loadCaseMesh(layout.meshUrl) : Promise.resolve(null);
    pending.then(build, (err) => {
      console.error(err);
      build(null);
    });

    return () => {
      cancelled = true;
    };
  }, [layout, showRing]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state?.model) return;
    state.model.setColors(caseColor, keycapColor);
    state.dirty = true;
  }, [caseColor, keycapColor]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state?.model) return;
    state.model.setFaces(faces, state.renderer.capabilities.getMaxAnisotropy());
    state.dirty = true;
  }, [faces]);

  useEffect(() => {
    if (!onApi) return;
    onApi({
      capture: () => {
        const state = stateRef.current;
        if (!state) return null;
        state.renderer.render(state.scene, state.camera);
        return state.renderer.domElement.toDataURL('image/png');
      },
      resetView: () => {
        const state = stateRef.current;
        if (!state) return;
        state.intro = null;
        state.userMoved = false;
        state.controls.target.copy(state.center);
        placeCamera(state, VIEW_AZIMUTH, VIEW_POLAR, fitDistance(state));
        state.dirty = true;
      },
    });
    return () => onApi(null);
  }, [onApi]);

  return <div ref={mountRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
