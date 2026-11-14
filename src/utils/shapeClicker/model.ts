/**
 * 쉐이프 클리커 3D 모델 (three.js, 단위 mm, Y-up). 위에서 본 (x, y) 가 그대로 (x, z) 가 된다. 바닥은 y = 0.
 *
 * 부품: 몸체 + 키링 고리 + 스위치 + 누르는 곳(뚜껑).
 *  - 몸체: 로고 모양 기둥. 위에는 뚜껑이 들어가는 자리가 파여 있고, 그 바닥에 스위치 구멍(14mm)과
 *          스위치 몸통이 들어가는 공간이 있다.
 *  - 뚜껑: 로고 모양 그대로. 속이 비어 있고, 스위치 축에 끼우는 십자 기둥이 달려 있다.
 * 몸체와 뚜껑은 각각 빈틈 없이 닫힌 한 덩어리로 만든다. 그래서 그대로 출력용 파일(STL)로 내보낼 수 있다.
 */

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildLugGeometry, buildSwitchGeometry } from '../clicker/clickerModel';
import { CLICKER } from '../clicker/layouts';
import { SHAPE_SPEC, unalign, type Loop, type ShapeDesign } from './shape';

/** 옆면에서 이 각도보다 완만하게 꺾이는 곳은 이어서 매끈하게 보이게 한다 */
const CREASE_ANGLE = THREE.MathUtils.degToRad(40);
const CIRCLE_SEGMENTS = 48;

/** 윗면 그림이 원본 그림의 어느 부분인지 (원본 전체를 0 ~ 1 로 본 좌표) */
export interface ArtRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const WHOLE_IMAGE: ArtRect = { x: 0, y: 0, w: 1, h: 1 };

type V3 = [number, number, number];
type UvOf = (x: number, z: number) => [number, number];
const NO_UV: UvOf = () => [0, 0];

/** 삼각형을 하나씩 모아 두는 통. 꼭짓점을 공유하지 않는다 */
class Soup {
  readonly position: number[] = [];
  readonly normal: number[] = [];
  readonly uv: number[] = [];

  get empty(): boolean {
    return this.position.length === 0;
  }

  /** 삼각형의 앞면이 (wx, wy, wz) 쪽을 보도록 순서를 맞춰 넣는다. flatNormal 이면 그 방향을 법선으로 쓴다 */
  add(a: V3, b: V3, c: V3, wx: number, wy: number, wz: number, uv: UvOf, flatNormal: boolean): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-14) return;
    const order = nx * wx + ny * wy + nz * wz < 0 ? [a, c, b] : [a, b, c];
    for (const p of order) {
      this.position.push(p[0], p[1], p[2]);
      this.uv.push(...uv(p[0], p[2]));
      if (flatNormal) this.normal.push(wx, wy, wz);
    }
  }

  /** 순서를 바꾸지 않고 그대로 넣는다 (법선은 나중에 계산) */
  addOrdered(points: V3[], uv: UvOf): void {
    for (const p of points) {
      this.position.push(p[0], p[1], p[2]);
      this.uv.push(...uv(p[0], p[2]));
    }
  }
}

/** 바깥 선과 안쪽에 뚫린 선들 사이를 삼각형으로 나눈다. 번호는 [바깥, ...안쪽] 을 이어 붙인 순서 */
function triangulate(outer: Loop, holes: Loop[]): { points: Loop; faces: number[][] } {
  const toVectors = (loop: Loop) => loop.map(([x, y]) => new THREE.Vector2(x, y));
  const faces = THREE.ShapeUtils.triangulateShape(toVectors(outer), holes.map(toVectors));
  return { points: [outer, ...holes].flat(), faces };
}

/** 높이 y 에 놓인 평평한 면 */
function addFlat(soup: Soup, outer: Loop, holes: Loop[], y: number, up: boolean, uv: UvOf = NO_UV): void {
  const { points, faces } = triangulate(outer, holes);
  const at = (i: number): V3 => [points[i][0], y, points[i][1]];
  for (const [a, b, c] of faces) soup.add(at(a), at(b), at(c), 0, up ? 1 : -1, 0, uv, true);
}

/** 선을 따라 y0 에서 y1 까지 세운 벽. outward 가 false 면 선 안쪽을 본다 (파인 곳의 벽) */
function addWall(soup: Soup, loop: Loop, y0: number, y1: number, outward: boolean, uv: UvOf = NO_UV): void {
  const side = outward ? 1 : -1;
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i];
    const [bx, bz] = loop[(i + 1) % loop.length];
    // 넓이가 양수가 되게 도는 선에서 (dz, -dx) 가 바깥쪽
    const nx = (bz - az) * side;
    const nz = -(bx - ax) * side;
    soup.add([ax, y0, az], [bx, y0, bz], [bx, y1, bz], nx, 0, nz, uv, false);
    soup.add([ax, y0, az], [bx, y1, bz], [ax, y1, az], nx, 0, nz, uv, false);
  }
}

/**
 * 깎은 모서리: 바깥 선(yOuter)과 그 안쪽 선(yInner) 사이를 비스듬히 잇는다.
 * 두 선을 지퍼처럼 번갈아 따라가며 잇는다 — 삼각형마다 양쪽 선의 점이 모두 들어가서 면이 고르게 기운다.
 * (띠를 통째로 삼각형으로 나누면 한쪽 선의 점만 쓰는 납작한 조각이 섞여 모서리가 울퉁불퉁해진다)
 */
function addStrip(
  soup: Soup,
  outer: Loop,
  inner: Loop,
  yOuter: number,
  yInner: number,
  up: boolean,
  uv: UvOf = NO_UV,
): void {
  const n = outer.length;
  const m = inner.length;
  let start = 0;
  let nearest = Infinity;
  for (let j = 0; j < m; j++) {
    const d = (inner[j][0] - outer[0][0]) ** 2 + (inner[j][1] - outer[0][1]) ** 2;
    if (d < nearest) {
      nearest = d;
      start = j;
    }
  }
  const o = (i: number): V3 => [outer[i % n][0], yOuter, outer[i % n][1]];
  const q = (j: number): V3 => [inner[(start + j) % m][0], yInner, inner[(start + j) % m][1]];
  const dist2 = (a: V3, b: V3) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    // 다음 점으로 넘어갔을 때 새로 생기는 대각선이 짧은 쪽으로 나아간다
    const stepOuter = j >= m || (i < n && dist2(o(i + 1), q(j)) <= dist2(o(i), q(j + 1)));
    const a = o(i);
    const b = stepOuter ? o(i + 1) : q(j + 1);
    const c = q(j);
    // 두 선 모두 넓이가 양수가 되게 돌므로 (a, b, c) 는 늘 아래를 본다
    soup.addOrdered(up ? [a, c, b] : [a, b, c], uv);
    if (stepOuter) i++;
    else j++;
  }
}

/**
 * 안쪽 선이 여러 개일 때의 깎은 모서리 (가는 목에서 윗면이 여러 조각으로 나뉜 경우).
 * 위에서 본 띠를 삼각형으로 나눈 뒤 꼭짓점마다 속한 선의 높이를 준다.
 */
function addSlope(
  soup: Soup,
  outer: Loop,
  inners: Loop[],
  yOuter: number,
  yInner: number,
  up: boolean,
  uv: UvOf = NO_UV,
): void {
  const { points, faces } = triangulate(outer, inners);
  const at = (i: number): V3 => [points[i][0], i < outer.length ? yOuter : yInner, points[i][1]];
  for (const [a, b, c] of faces) soup.add(at(a), at(b), at(c), 0, up ? 1 : -1, 0, uv, false);
}

function toGeometry(flat: Soup, side: Soup): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (!side.empty) {
    const raw = new THREE.BufferGeometry();
    raw.setAttribute('position', new THREE.Float32BufferAttribute(side.position, 3));
    raw.setAttribute('uv', new THREE.Float32BufferAttribute(side.uv, 2));
    parts.push(toCreasedNormals(raw, CREASE_ANGLE));
  }
  if (!flat.empty) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(flat.position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(flat.normal, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(flat.uv, 2));
    parts.push(g);
  }
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (parts.length > 1) parts.forEach((part) => part.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** 모서리가 둥근 바른 네모 (넓이가 양수가 되는 방향) */
function squareLoop(cx: number, cy: number, half: number, radius: number): Loop {
  if (radius <= 0.01) {
    return [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx + half, cy + half],
      [cx - half, cy + half],
    ];
  }
  const r = Math.min(radius, half);
  const loop: Loop = [];
  const corners: [number, number, number][] = [
    [cx + half - r, cy - half + r, -Math.PI / 2],
    [cx + half - r, cy + half - r, 0],
    [cx - half + r, cy + half - r, Math.PI / 2],
    [cx - half + r, cy - half + r, Math.PI],
  ];
  const steps = 6;
  for (const [x, y, start] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = start + (i / steps) * (Math.PI / 2);
      loop.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    }
  }
  return loop;
}

function circleLoop(cx: number, cy: number, radius: number): Loop {
  const loop: Loop = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    loop.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  return loop;
}

/** 스위치 축(MX 십자)이 들어가는 구멍 */
function crossLoop(cx: number, cy: number): Loop {
  const a = SHAPE_SPEC.stemCrossLength / 2;
  const b = SHAPE_SPEC.stemCrossWidth / 2;
  const points: [number, number][] = [
    [-b, -a],
    [b, -a],
    [b, -b],
    [a, -b],
    [a, b],
    [b, b],
    [b, a],
    [-b, a],
    [-b, b],
    [-a, b],
    [-a, -b],
    [-b, -b],
  ];
  return points.map(([x, y]) => [cx + x, cy + y]);
}

/** 몸체: 바닥 → 옆면 → 윗면 테두리 → 뚜껑 자리 → 스위치 구멍 → 스위치 몸통이 들어가는 공간 */
export function buildBodyGeometry(design: ShapeDesign): THREE.BufferGeometry {
  const S = SHAPE_SPEC;
  const top = S.bodyHeight;
  const plate = S.plateHeight;
  const under = plate - S.plateThickness;
  const { x, y } = design.switchAt;
  const hole = unalign(squareLoop(x, y, S.switchHole / 2, 0), 101);
  const pocket = unalign(squareLoop(x, y, S.pocket / 2, S.pocketRadius), 102);

  const flat = new Soup();
  const side = new Soup();
  addFlat(flat, design.bodyInset, [], 0, false);
  addStrip(side, design.body, design.bodyInset, S.bodyBevel, 0, false);
  addWall(side, design.body, S.bodyBevel, top - S.bodyBevel, true);
  addStrip(side, design.body, design.bodyInset, top - S.bodyBevel, top, true);
  addFlat(flat, design.bodyInset, [design.well], top, true);
  addWall(side, design.well, plate, top, false);
  addFlat(flat, design.well, [hole], plate, true);
  addWall(side, hole, under, plate, false);
  addFlat(flat, pocket, [hole], under, false);
  addWall(side, pocket, S.floorThickness, under, false);
  addFlat(flat, pocket, [], S.floorThickness, true);
  return toGeometry(flat, side);
}

/**
 * 뚜껑(누르는 곳). 바닥이 y = 0 이다.
 * face 는 그림이 올라가는 윗면과 깎은 모서리, shell 은 나머지(옆면 · 속 · 스위치 축 기둥).
 */
export function buildCapGeometries(
  design: ShapeDesign,
  artRect: ArtRect = WHOLE_IMAGE,
): { face: THREE.BufferGeometry; shell: THREE.BufferGeometry } {
  const S = SHAPE_SPEC;
  const top = S.capHeight;
  const shoulder = top - S.capBevel;
  const ceiling = top - S.capTop;
  // 윗면 그림은 원본에서 로고가 있는 부분만 잘라 낸 것이라, 그 부분이 놓이는 자리에 맞춰 입힌다.
  // 그림의 위쪽이 뒤쪽(-z)에 온다
  const rect = design.imageRect;
  const left = rect.x + artRect.x * rect.w;
  const back = rect.y + artRect.y * rect.h;
  const spanX = artRect.w * rect.w;
  const spanZ = artRect.h * rect.h;
  const uv: UvOf = (x, z) => [(x - left) / spanX, 1 - (z - back) / spanZ];

  const faceFlat = new Soup();
  const faceSide = new Soup();
  for (const loop of design.capTop) addFlat(faceFlat, loop, [], top, true, uv);
  if (design.capTop.length === 1) addStrip(faceSide, design.cap, design.capTop[0], shoulder, top, true, uv);
  else addSlope(faceSide, design.cap, design.capTop, shoulder, top, true, uv);

  const flat = new Soup();
  const side = new Soup();
  addWall(side, design.cap, 0, shoulder, true);
  addFlat(flat, design.cap, design.hollows, 0, false);
  const { x, y } = design.switchAt;
  design.hollows.forEach((hollow, index) => {
    addWall(side, hollow, 0, ceiling, false);
    if (index !== design.switchHollow) {
      addFlat(flat, hollow, [], ceiling, false);
      return;
    }
    // 스위치 축에 끼우는 기둥: 속의 천장에서 내려오고, 아래쪽에 십자 구멍이 있다
    const stem = unalign(circleLoop(x, y, S.stemRadius), 103);
    const cross = unalign(crossLoop(x, y), 104);
    const crossTop = S.stemBottom + S.stemCrossDepth;
    addFlat(flat, hollow, [stem], ceiling, false);
    addWall(side, stem, S.stemBottom, ceiling, true);
    addFlat(flat, stem, [cross], S.stemBottom, false);
    addWall(side, cross, S.stemBottom, crossTop, false);
    addFlat(flat, cross, [], crossTop, false);
  });
  return { face: toGeometry(faceFlat, faceSide), shell: toGeometry(flat, side) };
}

// ---------------------------------------------------------------------------
// 모델
// ---------------------------------------------------------------------------

export interface ShapeClickerModel {
  group: THREE.Group;
  /** 누르는 곳. 누르거나 분해해서 볼 때 위아래로 움직인다 */
  cap: THREE.Group;
  capRestY: number;
  switchPart: THREE.Mesh;
  switchRestY: number;
  /** 키링 (분해해서 볼 때는 숨긴다) */
  ring: THREE.Mesh | null;
  setColors(bodyHex: string, capHex: string): void;
  /** 뚜껑 윗면 그림 (null 이면 뚜껑 색 그대로) */
  setFace(canvas: HTMLCanvasElement | null, anisotropy: number): void;
  dispose(): void;
}

export interface ShapeClickerOptions {
  bodyColor: string;
  capColor: string;
  showRing: boolean;
  /** 윗면 그림이 원본의 어느 부분인지. 없으면 원본 전체 */
  artRect?: ArtRect;
}

export function buildShapeClickerModel(design: ShapeDesign, options: ShapeClickerOptions): ShapeClickerModel {
  const S = SHAPE_SPEC;
  const group = new THREE.Group();
  group.name = 'shape-clicker';

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

  // 재질은 /cliker 의 케이스 · 키캡 · 스위치와 같게 맞춘다
  const bodyMaterial = material(new THREE.MeshStandardMaterial({ color: options.bodyColor, roughness: 0.46, metalness: 0 }));
  const capMaterial = material(new THREE.MeshStandardMaterial({ color: options.capColor, roughness: 0.6, metalness: 0 }));
  const faceMaterial = material(new THREE.MeshStandardMaterial({ color: options.capColor, roughness: 0.68, metalness: 0 }));
  faceMaterial.envMapIntensity = 0.4;
  const switchMaterial = material(new THREE.MeshStandardMaterial({ color: '#24262b', roughness: 0.38, metalness: 0 }));

  addMesh(group, track(buildBodyGeometry(design)), bodyMaterial);

  const { lug } = design;
  let ring: THREE.Mesh | null = null;
  if (lug) {
    addMesh(group, track(buildLugGeometry(lug)), bodyMaterial);
    if (options.showRing) {
      // 키링: 고리의 구멍을 지나 바깥으로 늘어져 끝이 바닥에 닿는다
      const metal = material(new THREE.MeshStandardMaterial({ color: '#d9dce1', roughness: 0.2, metalness: 1 }));
      ring = addMesh(group, track(new THREE.TorusGeometry(CLICKER.ringRadius, CLICKER.ringTube, 20, 96)), metal);
      const out = new THREE.Vector3(lug.dx, 0, lug.dy);
      const axis = new THREE.Vector3(-lug.dy, 0, lug.dx);
      const hole = new THREE.Vector3(lug.x + lug.dx * lug.hole.offset, lug.hole.height, lug.y + lug.dy * lug.hole.offset);
      const droop = -Math.asin(Math.min(1, Math.max(0, (hole.y - CLICKER.ringTube) / (2 * CLICKER.ringRadius))));
      const reach = new THREE.Vector3(0, Math.sin(droop), 0).addScaledVector(out, Math.cos(droop));
      ring.matrixAutoUpdate = false;
      ring.matrix.makeBasis(reach, axis, new THREE.Vector3().crossVectors(reach, axis));
      ring.matrix.setPosition(hole.addScaledVector(reach, CLICKER.ringRadius));
    }
  }

  const switchPart = addMesh(group, track(buildSwitchGeometry()), switchMaterial);
  const switchRestY = S.plateHeight;
  switchPart.position.set(design.switchAt.x, switchRestY, design.switchAt.y);

  const cap = new THREE.Group();
  const capRestY = S.plateHeight + S.capSeat;
  cap.position.y = capRestY;
  cap.userData.pressable = true;
  group.add(cap);
  const capGeometries = buildCapGeometries(design, options.artRect);
  addMesh(cap, track(capGeometries.shell), capMaterial);
  // 인쇄면은 반사를 낮춰 그림 색이 뿌옇게 뜨지 않게 한다
  const face = addMesh(cap, track(capGeometries.face), faceMaterial);
  face.castShadow = false;

  let texture: THREE.CanvasTexture | null = null;
  let capHex = options.capColor;
  // 그림이 있으면 캔버스에 이미 뚜껑 색이 깔려 있으므로 재질 색은 흰색으로 둔다
  const applyFaceColor = () => faceMaterial.color.set(texture ? '#ffffff' : capHex);

  return {
    group,
    cap,
    capRestY,
    switchPart,
    switchRestY,
    ring,
    setColors(bodyHex, nextCapHex) {
      capHex = nextCapHex;
      bodyMaterial.color.set(bodyHex);
      capMaterial.color.set(nextCapHex);
      applyFaceColor();
    },
    setFace(canvas, anisotropy) {
      texture?.dispose();
      texture = null;
      if (canvas) {
        texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = anisotropy;
      }
      faceMaterial.map = texture;
      faceMaterial.needsUpdate = true;
      applyFaceColor();
    },
    dispose() {
      texture?.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

// ---------------------------------------------------------------------------
// 출력용 파일
// ---------------------------------------------------------------------------

/** 출력용 좌표(Z 가 위)로 돌린 부품들. 몸체에는 고리가 함께 들어간다 */
export function buildPrintParts(design: ShapeDesign): { body: THREE.Group; cap: THREE.Group; dispose: () => void } {
  const geometries: THREE.BufferGeometry[] = [];
  const material = new THREE.MeshBasicMaterial();
  const part = (...sources: THREE.BufferGeometry[]): THREE.Group => {
    const group = new THREE.Group();
    for (const geometry of sources) {
      // (x, y, z) → (x, -z, y): 높이가 Z 로 가고 위에서 본 모양은 그대로다
      geometry.rotateX(Math.PI / 2);
      geometries.push(geometry);
      group.add(new THREE.Mesh(geometry, material));
    }
    return group;
  };
  const cap = buildCapGeometries(design);
  return {
    body: part(buildBodyGeometry(design), ...(design.lug ? [buildLugGeometry(design.lug)] : [])),
    cap: part(cap.shell, cap.face),
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      material.dispose();
    },
  };
}
