/**
 * 키보드 클리커 3D 모델 (three.js, 단위 mm, Y-up).
 *
 * 위에서 본 좌표(x, y)가 그대로 3D 의 (x, z)가 된다. 바닥은 y = 0.
 * 구성: 케이스 + 키링 + 키마다 [스위치, 키캡 몸통, 사진이 올라가는 윗면].
 * 케이스는 실제 제작용 모델에서 변환한 메시를 쓰고, 직접 입력한 크기처럼 모델이 없으면 같은 규격으로 만든다.
 * 스위치 · 키캡 · 직접 만드는 케이스는 "둥근 사각형 단면을 높이 방향으로 이어 붙인" 형태라 하나의 빌더로 만든다.
 */

import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CASE_SPEC, CLICKER, ClickerLayout, ClickerLug, getKeycapProfile, keycapBaseHeight } from './layouts';
import type { CaseMesh } from './caseMesh';

const CORNER_SEGMENTS = 10;
const FILLET_SEGMENTS = 6;
/** 케이스 메시에서 이 각도보다 완만하게 꺾이는 면은 이어서 매끈하게 보이게 한다 */
const CASE_CREASE_ANGLE = THREE.MathUtils.degToRad(38);

// ---------------------------------------------------------------------------
// 지오메트리 빌더
// ---------------------------------------------------------------------------

interface Ring {
  y: number;
  /** x 방향 절반 폭 */
  hw: number;
  /** z 방향 절반 폭 */
  hd: number;
  /** 모서리 반경 */
  r: number;
  /** 법선의 기울기: 0 = 수평 바깥쪽, +π/2 = 위, -π/2 = 아래 */
  phi: number;
}

class MeshBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private indices: number[] = [];

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, u = 0, v = 0): number {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.uvs.push(u, v);
    return this.positions.length / 3 - 1;
  }

  triangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    return g;
  }
}

/** 둥근 사각형 외곽선. 위에서 볼 때 +x 에서 시작해 +z 쪽으로 돈다 */
function outline(hw: number, hd: number, r: number): { x: number; z: number; nx: number; nz: number }[] {
  const rr = Math.max(0.01, Math.min(r, hw, hd));
  const centers: [number, number][] = [
    [hw - rr, hd - rr],
    [-(hw - rr), hd - rr],
    [-(hw - rr), -(hd - rr)],
    [hw - rr, -(hd - rr)],
  ];
  const points: { x: number; z: number; nx: number; nz: number }[] = [];
  centers.forEach(([cx, cz], quadrant) => {
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const a = ((quadrant + i / CORNER_SEGMENTS) * Math.PI) / 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      points.push({ x: cx + rr * nx, z: cz + rr * nz, nx, nz });
    }
  });
  return points;
}

/**
 * 단면들을 아래에서 위로 잇는 옆면.
 * inward 가 true 면 면이 안쪽(중심 쪽)을 향한다: 파여 있는 공간의 벽을 만들 때 쓴다.
 */
function addLoft(b: MeshBuilder, rings: Ring[], inward = false): void {
  const side = inward ? -1 : 1;
  const rows: number[][] = rings.map((ring) => {
    const cosPhi = Math.cos(ring.phi);
    const sinPhi = Math.sin(ring.phi);
    return outline(ring.hw, ring.hd, ring.r).map((p) =>
      b.vertex(p.x, ring.y, p.z, side * p.nx * cosPhi, sinPhi, side * p.nz * cosPhi),
    );
  });
  for (let k = 0; k < rows.length - 1; k++) {
    const lower = rows[k];
    const upper = rows[k + 1];
    const n = lower.length;
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      if (inward) {
        b.triangle(lower[j], lower[j1], upper[j]);
        b.triangle(lower[j1], upper[j1], upper[j]);
      } else {
        b.triangle(lower[j], upper[j], lower[j1]);
        b.triangle(lower[j1], upper[j], upper[j1]);
      }
    }
  }
}

/** 같은 높이의 바깥 테두리와 안쪽 테두리 사이를 메우는, 위를 향한 평평한 띠 */
function addRim(b: MeshBuilder, outer: Pick<Ring, 'hw' | 'hd' | 'r'>, inner: Pick<Ring, 'hw' | 'hd' | 'r'>, y: number): void {
  const outerRow = outline(outer.hw, outer.hd, outer.r).map((p) => b.vertex(p.x, y, p.z, 0, 1, 0));
  const innerRow = outline(inner.hw, inner.hd, inner.r).map((p) => b.vertex(p.x, y, p.z, 0, 1, 0));
  const n = outerRow.length;
  for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n;
    b.triangle(innerRow[j], outerRow[j1], outerRow[j]);
    b.triangle(innerRow[j], innerRow[j1], outerRow[j1]);
  }
}

/** 평평한 뚜껑. UV 는 위에서 내려다본 방향으로 0~1 (캔버스 위쪽 = 뒤쪽) */
function addCap(b: MeshBuilder, ring: Pick<Ring, 'y' | 'hw' | 'hd' | 'r'>, up: boolean): void {
  const ny = up ? 1 : -1;
  const uv = (x: number, z: number): [number, number] => [0.5 + x / (2 * ring.hw), 0.5 - z / (2 * ring.hd)];
  const center = b.vertex(0, ring.y, 0, 0, ny, 0, 0.5, 0.5);
  const rim = outline(ring.hw, ring.hd, ring.r).map((p) => {
    const [u, v] = uv(p.x, p.z);
    return b.vertex(p.x, ring.y, p.z, 0, ny, 0, u, v);
  });
  for (let j = 0; j < rim.length; j++) {
    const j1 = (j + 1) % rim.length;
    if (up) b.triangle(center, rim[j1], rim[j]);
    else b.triangle(center, rim[j], rim[j1]);
  }
}

// ---------------------------------------------------------------------------
// 부품
// ---------------------------------------------------------------------------

/** 변환해 둔 실제 케이스 모델 */
function buildCaseGeometry(mesh: CaseMesh): THREE.BufferGeometry {
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  indexed.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  // 원본에는 면 단위 법선뿐이라, 둥근 모서리는 부드럽게 · 꺾이는 모서리는 또렷하게 다시 계산한다
  const geometry = toCreasedNormals(indexed, CASE_CREASE_ANGLE);
  indexed.dispose();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * 공통 규격대로 만드는 케이스: 직접 입력한 크기이거나 모델 파일을 불러오지 못했을 때 쓴다.
 * 제작용 모델과 같은 모양이다 — 옆면은 가운데보다 조금 위에서 가장 넓고 위아래로 좁아지며,
 * 윗면에는 테두리 벽을 남기고 키캡이 들어갈 자리가 파여 있다. (스위치 구멍은 스위치에 가려져 생략)
 */
function buildProceduralCaseGeometry(layout: ClickerLayout): THREE.BufferGeometry {
  const S = CASE_SPEC;
  const H = layout.caseHeight;
  const hw = layout.caseWidth / 2;
  const hd = layout.caseDepth / 2;
  const edge = { hw: hw - S.taperInset, hd: hd - S.taperInset, r: S.edgeCornerRadius };
  const lowerTilt = -Math.atan(S.taperInset / S.widestHeight);
  const upperTilt = Math.atan(S.taperInset / (H - S.widestHeight));

  const b = new MeshBuilder();
  // 바깥 옆면: 바닥 → 가장 넓은 곳 → 윗면
  addLoft(b, [
    { y: 0, ...edge, phi: lowerTilt },
    { y: S.widestHeight, hw, hd, r: layout.cornerRadius, phi: (lowerTilt + upperTilt) / 2 },
    { y: H, ...edge, phi: upperTilt },
  ]);
  addCap(b, { y: 0, ...edge }, false);

  // 윗면 테두리와, 키캡이 들어가는 안쪽 공간
  const well = {
    hw: layout.well.w / 2,
    hd: layout.well.h / 2,
    r: S.wellCornerRadius,
  };
  const floorY = layout.plateHeight + S.wellFloorAbovePlate;
  addRim(b, edge, well, H);
  addLoft(
    b,
    [
      { y: floorY, ...well, phi: 0 },
      { y: H, ...well, phi: 0 },
    ],
    true,
  );
  addCap(b, { y: floorY, ...well }, true);
  return b.build();
}

/** 키링을 거는 고리: 옆면에 세로로 선 작은 고리. 구멍은 옆면과 나란한 방향으로 뚫린다 */
export function buildLugGeometry(lug: ClickerLug): THREE.BufferGeometry {
  const { hole } = lug;
  const outerRadius = lug.length - hole.offset;
  // (바깥 방향, 높이) 평면에 그린 모양을 두께만큼 밀어낸다. 안쪽 끝은 몸체 속으로 조금 들어가게 한다
  const shape = new THREE.Shape();
  shape.moveTo(-1.2, hole.height - outerRadius);
  shape.lineTo(hole.offset, hole.height - outerRadius);
  shape.absarc(hole.offset, hole.height, outerRadius, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-1.2, hole.height + outerRadius);
  shape.closePath();
  const opening = new THREE.Path();
  opening.absarc(hole.offset, hole.height, hole.radius, 0, Math.PI * 2, true);
  shape.holes.push(opening);

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: lug.thickness, bevelEnabled: false, curveSegments: 28 });
  geometry.translate(0, 0, -lug.thickness / 2);
  // 도형의 +x 를 고리의 바깥 방향으로 돌리고 부착점으로 옮긴다
  geometry.rotateY(Math.atan2(-lug.dy, lug.dx));
  geometry.translate(lug.x, 0, lug.y);
  return geometry;
}

function keycapRings(): Ring[] {
  const C = CLICKER;
  const P = getKeycapProfile();
  const f = C.keycapTopFillet;
  const half = C.keycapBottom / 2;
  const rings: Ring[] = [
    { y: 0, hw: half, hd: half, r: C.keycapCornerBottom, phi: P.taper },
    { y: P.filletStartY, hw: P.filletStartHalf, hd: P.filletStartHalf, r: P.filletStartRadius, phi: P.taper },
  ];
  for (let i = 1; i <= FILLET_SEGMENTS; i++) {
    const phi = P.taper + (Math.PI / 2 - P.taper) * (i / FILLET_SEGMENTS);
    const out = f * Math.cos(phi);
    rings.push({
      y: C.keycapHeight - f + f * Math.sin(phi),
      hw: P.faceHalf + out,
      hd: P.faceHalf + out,
      r: P.faceRadius + out,
      phi,
    });
  }
  return rings;
}

/** 키캡 몸통 (옆면 + 윗면 라운드 + 바닥) */
function buildKeycapBodyGeometry(): THREE.BufferGeometry {
  const rings = keycapRings();
  const b = new MeshBuilder();
  addLoft(b, rings);
  addCap(b, rings[0], false);
  return b.build();
}

/** 사진이 올라가는 키캡 윗면 */
function buildKeycapFaceGeometry(): THREE.BufferGeometry {
  const P = getKeycapProfile();
  const b = new MeshBuilder();
  addCap(b, { y: CLICKER.keycapHeight, hw: P.faceHalf, hd: P.faceHalf, r: P.faceRadius }, true);
  return b.build();
}

export function buildSwitchGeometry(): THREE.BufferGeometry {
  const C = CLICKER;
  const base = C.switchBase / 2;
  const shoulder = base - 0.8;
  const top = C.switchTop / 2;
  const flange = 0.9;
  const slope = Math.atan((shoulder - top) / (C.switchHeight - flange));
  const square = (y: number, half: number, r: number, phi: number): Ring => ({ y, hw: half, hd: half, r, phi });
  const rings: Ring[] = [
    square(0, base, 0.8, 0),
    square(flange, base, 0.8, 0),
    square(flange, base, 0.8, Math.PI / 2),
    square(flange, shoulder, 0.8, Math.PI / 2),
    square(flange, shoulder, 0.8, slope),
    square(C.switchHeight, top, 1.0, slope),
  ];
  const b = new MeshBuilder();
  addLoft(b, rings);
  addCap(b, rings[rings.length - 1], true);
  return b.build();
}

// ---------------------------------------------------------------------------
// 모델
// ---------------------------------------------------------------------------

export interface ClickerKeyPart {
  index: number;
  /** 누를 때 위아래로 움직이는 키캡 묶음 */
  group: THREE.Group;
  restY: number;
  /** 0(올라옴) ~ 1(끝까지 눌림) */
  press: number;
  pressTarget: number;
  /** 눌린 상태를 유지할 남은 시간 (초) */
  hold: number;
}

export interface ClickerModel {
  group: THREE.Group;
  keys: ClickerKeyPart[];
  setColors(caseHex: string, keycapHex: string): void;
  /** 키마다 윗면 그림을 바꾼다 (null 이면 키캡 색 그대로) */
  setFaces(canvases: readonly (HTMLCanvasElement | null)[], anisotropy: number): void;
  dispose(): void;
}

export interface ClickerModelOptions {
  caseColor: string;
  keycapColor: string;
  showRing: boolean;
}

/** caseMesh 가 null 이면(직접 입력한 크기이거나 불러오기 실패) 공통 규격대로 케이스를 만든다 */
export function buildClickerModel(
  layout: ClickerLayout,
  options: ClickerModelOptions,
  caseMesh: CaseMesh | null,
): ClickerModel {
  const C = CLICKER;
  const group = new THREE.Group();
  group.name = 'clicker';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const material = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const addMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const caseMaterial = material(
    new THREE.MeshStandardMaterial({ color: options.caseColor, roughness: 0.46, metalness: 0 }),
  );
  const keycapMaterial = material(
    new THREE.MeshStandardMaterial({ color: options.keycapColor, roughness: 0.6, metalness: 0 }),
  );
  const switchMaterial = material(new THREE.MeshStandardMaterial({ color: '#24262b', roughness: 0.38, metalness: 0 }));

  // 케이스. 제작용 모델은 키링 고리까지 한 덩어리이고, 직접 만드는 경우에는 고리를 따로 붙인다
  const { lug } = layout;
  if (caseMesh) {
    addMesh(group, track(buildCaseGeometry(caseMesh)), caseMaterial);
  } else {
    addMesh(group, track(buildProceduralCaseGeometry(layout)), caseMaterial);
    if (lug) addMesh(group, track(buildLugGeometry(lug)), caseMaterial);
  }

  // 키링: 고리의 구멍을 지나 바깥으로 늘어져 끝이 바닥에 닿는다
  if (options.showRing && lug) {
    const metal = material(new THREE.MeshStandardMaterial({ color: '#d9dce1', roughness: 0.2, metalness: 1 }));
    const ring = addMesh(group, track(new THREE.TorusGeometry(C.ringRadius, C.ringTube, 20, 96)), metal);
    const out = new THREE.Vector3(lug.dx, 0, lug.dy);
    /** 구멍이 뚫린 방향 (몸체 옆면과 나란한 방향) */
    const axis = new THREE.Vector3(-lug.dy, 0, lug.dx);
    const hole = new THREE.Vector3(
      lug.x + lug.dx * lug.hole.offset,
      lug.hole.height,
      lug.y + lug.dy * lug.hole.offset,
    );
    const droop = -Math.asin(Math.min(1, Math.max(0, (hole.y - C.ringTube) / (2 * C.ringRadius))));
    const reach = new THREE.Vector3(0, Math.sin(droop), 0).addScaledVector(out, Math.cos(droop));
    ring.matrixAutoUpdate = false;
    ring.matrix.makeBasis(reach, axis, new THREE.Vector3().crossVectors(reach, axis));
    ring.matrix.setPosition(hole.addScaledVector(reach, C.ringRadius));
  }

  // 키
  const switchGeometry = track(buildSwitchGeometry());
  const bodyGeometry = track(buildKeycapBodyGeometry());
  const faceGeometry = track(buildKeycapFaceGeometry());
  const faceMaterials: THREE.MeshStandardMaterial[] = [];
  const textures: (THREE.CanvasTexture | null)[] = [];
  let keycapHex = options.keycapColor;

  const keys: ClickerKeyPart[] = layout.keys.map((key) => {
    const sw = addMesh(group, switchGeometry, switchMaterial);
    sw.position.set(key.cx, layout.plateHeight, key.cy);

    const cap = new THREE.Group();
    const restY = keycapBaseHeight(layout);
    cap.position.set(key.cx, restY, key.cy);
    cap.userData.keyIndex = key.index;
    group.add(cap);
    addMesh(cap, bodyGeometry, keycapMaterial);

    // 인쇄면은 반사를 낮춰 사진 색이 뿌옇게 뜨지 않게 한다
    const faceMaterial = material(
      new THREE.MeshStandardMaterial({ color: options.keycapColor, roughness: 0.68, metalness: 0 }),
    );
    faceMaterial.envMapIntensity = 0.4;
    const face = addMesh(cap, faceGeometry, faceMaterial);
    face.castShadow = false;
    faceMaterials.push(faceMaterial);
    textures.push(null);

    return { index: key.index, group: cap, restY, press: 0, pressTarget: 0, hold: 0 };
  });

  const applyFaceColor = (i: number) => {
    // 그림이 있으면 캔버스에 이미 키캡 색이 깔려 있으므로 재질 색은 흰색으로 둔다
    faceMaterials[i].color.set(textures[i] ? '#ffffff' : keycapHex);
  };

  return {
    group,
    keys,
    setColors(caseHex, nextKeycapHex) {
      keycapHex = nextKeycapHex;
      caseMaterial.color.set(caseHex);
      keycapMaterial.color.set(nextKeycapHex);
      faceMaterials.forEach((_, i) => applyFaceColor(i));
    },
    setFaces(canvases, anisotropy) {
      faceMaterials.forEach((faceMaterial, i) => {
        textures[i]?.dispose();
        const canvas = canvases[i] ?? null;
        if (canvas) {
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = anisotropy;
          textures[i] = texture;
        } else {
          textures[i] = null;
        }
        faceMaterial.map = textures[i];
        faceMaterial.needsUpdate = true;
        applyFaceColor(i);
      });
    },
    dispose() {
      textures.forEach((t) => t?.dispose());
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
