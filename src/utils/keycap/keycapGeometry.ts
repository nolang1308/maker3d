/**
 * 키캡 3D 모델 생성 (three.js, 단위 mm, Z-up)
 *
 * 구성: 테이퍼진 둥근 사각 본체(속이 빈 셸) + MX 호환 십자 스템 + 윗면에 양각된 색상 레이어.
 * 본체와 각 색상 레이어는 별도의 Mesh 로 만들어 색상별 STL 내보내기가 가능하다.
 */

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Point, Polygon } from './imageProcessing';

export const KEYCAP_CONSTANTS = {
  /** 키 피치 (1u = 19.05mm) */
  unitPitch: 19.05,
  /** 키캡 바닥 폭 = unitPitch × u − gap */
  unitGap: 1.05,
  /** 바닥 깊이(앞뒤 길이) */
  bottomDepth: 18.0,
  /** 바닥 → 윗면으로 갈수록 한쪽당 줄어드는 폭 */
  taper: 1.5,
  cornerRadiusBottom: 1.2,
  cornerRadiusTop: 1.8,
  wallThickness: 1.2,
  topThickness: 1.6,
  /** MX 스템 외경 Ø5.5 */
  stemOuterRadius: 2.75,
  /** 십자 구멍 길이/폭 (FDM 출력 공차 반영) */
  stemCrossLength: 4.0,
  stemCrossWidth: 1.3,
  /** 스템 바닥이 키캡 바닥에서 떠 있는 높이 */
  stemBottomZ: 1.0,
  cornerSegments: 8,
  circleSegments: 48,
  /** 윗면 가장자리에서 이미지 영역까지의 여백 */
  imageMargin: 0.6,
};

/** 이 각도(라디안)보다 완만하게 꺾이는 면 사이는 법선을 섞어 매끈하게 보이게 한다 */
const CREASE_ANGLE = Math.PI / 5;

export interface KeycapParams {
  /** 키 폭 (1, 1.25, 1.5, 2 ...) */
  widthUnits: number;
  /** 전체 높이 (mm) */
  height: number;
  /** 색상 레이어 양각 높이 (mm) */
  embossHeight: number;
  /** 윗면 가용 영역 대비 이미지 크기 비율 (0.3 ~ 1) */
  imageScale: number;
  /** 본체 색상 hex */
  baseColorHex: string;
}

export interface ColorLayer {
  name: string;
  hex: string;
  polygons: Polygon[];
}

export interface KeycapDimensions {
  bottomWidth: number;
  bottomDepth: number;
  topWidth: number;
  topDepth: number;
  totalHeight: number;
  /** 이미지가 들어갈 수 있는 영역 (imageScale 적용 후) */
  imageAreaWidth: number;
  imageAreaHeight: number;
}

export interface KeycapModel {
  group: THREE.Group;
  body: THREE.Mesh;
  layerMeshes: THREE.Mesh[];
  triangleCount: number;
}

export function getKeycapDimensions(params: KeycapParams): KeycapDimensions {
  const C = KEYCAP_CONSTANTS;
  const bottomWidth = C.unitPitch * params.widthUnits - C.unitGap;
  const bottomDepth = C.bottomDepth;
  const topWidth = bottomWidth - 2 * C.taper;
  const topDepth = bottomDepth - 2 * C.taper;
  const scale = Math.max(0.1, Math.min(1, params.imageScale));
  return {
    bottomWidth,
    bottomDepth,
    topWidth,
    topDepth,
    totalHeight: params.height,
    imageAreaWidth: (topWidth - 2 * C.imageMargin) * scale,
    imageAreaHeight: (topDepth - 2 * C.imageMargin) * scale,
  };
}

// ---------------------------------------------------------------------------
// 2D 프로파일
// ---------------------------------------------------------------------------

function roundedRectRing(w: number, d: number, radius: number, seg: number): THREE.Vector2[] {
  const hw = w / 2;
  const hd = d / 2;
  const r = Math.max(0.05, Math.min(radius, hw - 0.05, hd - 0.05));
  const corners: [number, number, number][] = [
    [hw - r, hd - r, 0],
    [-hw + r, hd - r, Math.PI / 2],
    [-hw + r, -hd + r, Math.PI],
    [hw - r, -hd + r, (3 * Math.PI) / 2],
  ];
  const pts: THREE.Vector2[] = [];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  }
  return pts;
}

function circleRing(radius: number, seg: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(new THREE.Vector2(radius * Math.cos(a), radius * Math.sin(a)));
  }
  return pts;
}

/** MX 십자 단면 (반시계 방향) */
function crossRing(length: number, width: number): THREE.Vector2[] {
  const L = length / 2;
  const W = width / 2;
  const raw: [number, number][] = [
    [W, -L], [W, -W], [L, -W], [L, W], [W, W], [W, L],
    [-W, L], [-W, W], [-L, W], [-L, -W], [-W, -W], [-W, -L],
  ];
  return raw.map(([x, y]) => new THREE.Vector2(x, y));
}

// ---------------------------------------------------------------------------
// 지오메트리 조각
// ---------------------------------------------------------------------------

/** 두 고리를 잇는 측면. outward=true 이면 법선이 바깥(축에서 멀어지는 쪽)을 향한다. */
function loft(ringA: THREE.Vector2[], zA: number, ringB: THREE.Vector2[], zB: number, outward: boolean): THREE.BufferGeometry {
  const n = ringA.length;
  const pos = new Float32Array(n * 2 * 3 * 3);
  let o = 0;
  const push = (x: number, y: number, z: number) => {
    pos[o++] = x;
    pos[o++] = y;
    pos[o++] = z;
  };
  for (let i = 0; i < n; i++) {
    const a0 = ringA[i];
    const a1 = ringA[(i + 1) % n];
    const b0 = ringB[i];
    const b1 = ringB[(i + 1) % n];
    if (outward) {
      push(a0.x, a0.y, zA); push(a1.x, a1.y, zA); push(b1.x, b1.y, zB);
      push(a0.x, a0.y, zA); push(b1.x, b1.y, zB); push(b0.x, b0.y, zB);
    } else {
      push(a0.x, a0.y, zA); push(b1.x, b1.y, zB); push(a1.x, a1.y, zA);
      push(a0.x, a0.y, zA); push(b0.x, b0.y, zB); push(b1.x, b1.y, zB);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

/** 비인덱스 지오메트리의 삼각형 방향을 뒤집는다 */
function flipWinding(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < pos.count; i += 3) {
    const i1 = (i + 1) * 3;
    const i2 = (i + 2) * 3;
    for (let k = 0; k < 3; k++) {
      const t = arr[i1 + k];
      arr[i1 + k] = arr[i2 + k];
      arr[i2 + k] = t;
    }
  }
  pos.needsUpdate = true;
  return g;
}

/** 평면 면 (구멍 포함). facingUp=false 이면 법선이 -Z. */
function planarFace(outer: THREE.Vector2[], holes: THREE.Vector2[][], z: number, facingUp: boolean): THREE.BufferGeometry {
  const shape = new THREE.Shape(outer);
  for (const h of holes) shape.holes.push(new THREE.Path(h));
  let g: THREE.BufferGeometry = new THREE.ShapeGeometry(shape);
  g = g.toNonIndexed();
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g.translate(0, 0, z);
  if (!facingUp) flipWinding(g);
  return g;
}

function stripToPositionOnly(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) {
    if (name !== 'position') out.deleteAttribute(name);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 본체
// ---------------------------------------------------------------------------

function buildBodyGeometry(params: KeycapParams): THREE.BufferGeometry {
  const C = KEYCAP_CONSTANTS;
  const dims = getKeycapDimensions(params);
  const H = dims.totalHeight;
  const ceilZ = H - C.topThickness;
  const seg = C.cornerSegments;

  const widthAt = (z: number) => dims.bottomWidth - 2 * C.taper * (z / H);
  const depthAt = (z: number) => dims.bottomDepth - 2 * C.taper * (z / H);
  const radiusAt = (z: number) => C.cornerRadiusBottom + (C.cornerRadiusTop - C.cornerRadiusBottom) * (z / H);

  const outerBottom = roundedRectRing(dims.bottomWidth, dims.bottomDepth, C.cornerRadiusBottom, seg);
  const outerTop = roundedRectRing(dims.topWidth, dims.topDepth, C.cornerRadiusTop, seg);
  const innerBottom = roundedRectRing(
    dims.bottomWidth - 2 * C.wallThickness,
    dims.bottomDepth - 2 * C.wallThickness,
    Math.max(0.3, C.cornerRadiusBottom - C.wallThickness * 0.5),
    seg,
  );
  const innerCeil = roundedRectRing(
    widthAt(ceilZ) - 2 * C.wallThickness,
    depthAt(ceilZ) - 2 * C.wallThickness,
    Math.max(0.3, radiusAt(ceilZ) - C.wallThickness * 0.5),
    seg,
  );
  const stem = circleRing(C.stemOuterRadius, C.circleSegments);
  const cross = crossRing(C.stemCrossLength, C.stemCrossWidth);

  const parts: THREE.BufferGeometry[] = [
    loft(outerBottom, 0, outerTop, H, true),                 // 바깥 벽
    planarFace(outerTop, [], H, true),                        // 윗면
    planarFace(outerBottom, [innerBottom], 0, false),         // 바닥 테두리
    loft(innerBottom, 0, innerCeil, ceilZ, false),            // 안쪽 벽(공동)
    planarFace(innerCeil, [stem], ceilZ, false),              // 공동 천장 (스템 자리 제외)
    loft(stem, C.stemBottomZ, stem, ceilZ, true),             // 스템 바깥 벽
    planarFace(stem, [cross], C.stemBottomZ, false),          // 스템 바닥 (십자 구멍 제외)
    loft(cross, C.stemBottomZ, cross, ceilZ, false),          // 십자 구멍 벽
    planarFace(cross, [], ceilZ, false),                      // 십자 구멍 천장
  ].map(stripToPositionOnly);

  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('키캡 본체 생성 실패');
  parts.forEach((p) => p.dispose());
  // 곡면(모서리·스템)은 부드럽게, 꺾이는 모서리는 날카롭게 보이도록 각도 기준으로 법선 계산
  const creased = toCreasedNormals(merged, CREASE_ANGLE);
  merged.dispose();
  return creased;
}

// ---------------------------------------------------------------------------
// 색상 레이어
// ---------------------------------------------------------------------------

function polygonToShape(poly: Polygon): THREE.Shape {
  const toV = (p: Point) => new THREE.Vector2(p[0], p[1]);
  const shape = new THREE.Shape(poly.outer.map(toV));
  for (const h of poly.holes) shape.holes.push(new THREE.Path(h.map(toV)));
  return shape;
}

function buildLayerGeometry(layer: ColorLayer, baseZ: number, depth: number): THREE.BufferGeometry | null {
  if (layer.polygons.length === 0) return null;
  const shapes = layer.polygons.map(polygonToShape);
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, steps: 1 });
  const stripped = stripToPositionOnly(g);
  stripped.translate(0, 0, baseZ);
  const out = toCreasedNormals(stripped, CREASE_ANGLE);
  stripped.dispose();
  return out;
}

// ---------------------------------------------------------------------------
// 전체 모델
// ---------------------------------------------------------------------------

function makeMaterial(hex: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.55,
    metalness: 0.0,
  });
}

export function buildKeycapModel(params: KeycapParams, layers: ColorLayer[]): KeycapModel {
  const group = new THREE.Group();
  group.name = 'keycap';

  const bodyGeom = buildBodyGeometry(params);
  const body = new THREE.Mesh(bodyGeom, makeMaterial(params.baseColorHex));
  body.name = 'body';
  body.userData = { kind: 'body', hex: params.baseColorHex };
  group.add(body);

  let triangleCount = bodyGeom.getAttribute('position').count / 3;
  const layerMeshes: THREE.Mesh[] = [];
  layers.forEach((layer, i) => {
    const geom = buildLayerGeometry(layer, params.height, params.embossHeight);
    if (!geom) return;
    const mesh = new THREE.Mesh(geom, makeMaterial(layer.hex));
    mesh.name = `layer_${i + 1}`;
    mesh.userData = { kind: 'layer', hex: layer.hex, name: layer.name };
    group.add(mesh);
    layerMeshes.push(mesh);
    triangleCount += geom.getAttribute('position').count / 3;
  });

  return { group, body, layerMeshes, triangleCount };
}

export function disposeKeycapModel(model: KeycapModel | null): void {
  if (!model) return;
  model.group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

/**
 * 객체를 바이너리 STL(Blob)로 내보낸다. 부모 변환(뷰어의 회전 등)은 무시하고 모델 좌표(Z-up) 그대로 쓴다.
 */
export async function exportSTL(object: THREE.Object3D): Promise<Blob> {
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
  const clone = object.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.updateMatrixWorld(true);
  const exporter = new STLExporter();
  const result = exporter.parse(clone, { binary: true }) as DataView;
  return new Blob([result.buffer as ArrayBuffer], { type: 'model/stl' });
}
