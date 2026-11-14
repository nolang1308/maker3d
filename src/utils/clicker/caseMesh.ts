/**
 * 3D 미리보기용 케이스 메시 불러오기.
 *
 * 파일은 scripts/build-clicker-models.mjs 가 만든 정적 파일(public/clicker-models/*.bin)이다.
 *   'CLKM' | 버전 u32 | 꼭짓점 수 u32 | 삼각형 수 u32 | 인덱스 바이트 수 u32 | float32 위치 | 인덱스
 * 좌표는 mm, (x, 바닥에서의 높이, 앞쪽) 순서이며 몸체 중심이 원점이다.
 */

export interface CaseMesh {
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
}

const HEADER_BYTES = 20;
const cache = new Map<string, Promise<CaseMesh>>();

async function fetchCaseMesh(url: string): Promise<CaseMesh> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`케이스 모델을 불러오지 못했습니다 (${response.status}): ${url}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < HEADER_BYTES) throw new Error(`케이스 모델 파일이 너무 짧습니다: ${url}`);

  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const version = view.getUint32(4, true);
  const vertexCount = view.getUint32(8, true);
  const triangleCount = view.getUint32(12, true);
  const indexSize = view.getUint32(16, true);
  const indexOffset = HEADER_BYTES + vertexCount * 12;
  const expected = indexOffset + triangleCount * 3 * indexSize;
  if (magic !== 'CLKM' || version !== 1 || (indexSize !== 2 && indexSize !== 4) || expected !== buffer.byteLength) {
    throw new Error(`케이스 모델 형식이 올바르지 않습니다: ${url}`);
  }

  // 값을 하나씩 읽어 옮긴다 (기기의 바이트 순서나 정렬에 기대지 않기 위해)
  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = view.getFloat32(HEADER_BYTES + i * 4, true);
  const indices = indexSize === 4 ? new Uint32Array(triangleCount * 3) : new Uint16Array(triangleCount * 3);
  for (let i = 0; i < indices.length; i++) {
    indices[i] = indexSize === 4 ? view.getUint32(indexOffset + i * 4, true) : view.getUint16(indexOffset + i * 2, true);
  }
  return { positions, indices };
}

/** 같은 모델은 한 번만 내려받는다 */
export function loadCaseMesh(url: string): Promise<CaseMesh> {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetchCaseMesh(url);
    cache.set(url, pending);
    // 실패한 요청은 다음에 다시 시도할 수 있게 지운다
    pending.catch(() => cache.delete(url));
  }
  return pending;
}
