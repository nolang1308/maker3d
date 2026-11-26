/**
 * 키캡 윗면에 올라가는 사진만, 편집 화면에서 맞춘 그대로 잘라 내보내기.
 *
 *  - 키마다 한 장씩 정사각형 PNG 로 만든다 (사진이 없는 곳은 투명).
 *  - PNG 에 실제 크기 정보(pHYs)를 넣어서, 인쇄 · 편집 프로그램에서 열면 인쇄면 크기(mm) 그대로 나온다.
 *  - 키가 여러 개면 ZIP 하나로 묶는다. 모두 브라우저 안에서 처리하며 어디로도 보내지 않는다.
 */

import { ClickerLayout, PhotoMode, PRINT_FACE, PRINT_FACE_RADIUS, faceRect, regionFor } from './layouts';
import { PhotoAsset, Placement, renderFaceCanvas } from './placement';

/** 내보내는 이미지 한 변의 픽셀 수 */
export const EXPORT_PIXELS = 1024;

export interface FaceExport {
  blob: Blob;
  fileName: string;
  /** 내보낸 키 수 */
  count: number;
}

// ---------------------------------------------------------------------------
// CRC-32 (PNG 청크와 ZIP 이 같은 것을 쓴다)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// PNG 에 실제 크기 넣기
// ---------------------------------------------------------------------------

/** IHDR 바로 뒤에 pHYs(1m 당 픽셀 수) 청크를 넣는다. 이미 있으면 바꾼다 */
function withPhysicalSize(png: Uint8Array, pixelsPerMeter: number): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const SIGNATURE = 8;
  const chunks: Uint8Array[] = [png.subarray(0, SIGNATURE)];

  const data = new Uint8Array(13); // 종류 4 + 값 9
  data.set([0x70, 0x48, 0x59, 0x73]); // "pHYs"
  const dataView = new DataView(data.buffer);
  dataView.setUint32(4, pixelsPerMeter);
  dataView.setUint32(8, pixelsPerMeter);
  data[12] = 1; // 단위: 미터
  const physical = new Uint8Array(4 + 13 + 4);
  const physicalView = new DataView(physical.buffer);
  physicalView.setUint32(0, 9);
  physical.set(data, 4);
  physicalView.setUint32(17, crc32(data));

  let offset = SIGNATURE;
  while (offset + 12 <= png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
    const end = offset + 12 + length;
    if (end > png.length) break;
    if (type !== 'pHYs') chunks.push(png.subarray(offset, end));
    if (type === 'IHDR') chunks.push(physical);
    offset = end;
  }
  return concat(chunks);
}

// ---------------------------------------------------------------------------
// ZIP (압축 없이 묶기만 한다. PNG 는 이미 압축돼 있다)
// ---------------------------------------------------------------------------

function makeZip(files: { name: string; data: Uint8Array }[]): Blob {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const UTF8_NAMES = 0x0800;

  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, UTF8_NAMES, true);
    lv.setUint16(8, 0, true); // 압축 안 함
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, file.data.length, true);
    lv.setUint32(22, file.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, UTF8_NAMES, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    parts.push(local, file.data);
    directory.push(central);
    offset += local.length + file.data.length;
  }

  const directorySize = directory.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);

  return new Blob([concat([...parts, ...directory, end])], { type: 'application/zip' });
}

// ---------------------------------------------------------------------------
// 내보내기
// ---------------------------------------------------------------------------

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      resolve(blob ? new Uint8Array(await blob.arrayBuffer()) : null);
    }, 'image/png');
  });
}

export interface KeyFaceImage {
  /** 키 번호 (1부터. 위에서 봤을 때 왼쪽 위부터 오른쪽으로, 그다음 줄 순서) */
  key: number;
  /** 인쇄면 크기 정보가 들어 있는 PNG */
  data: Uint8Array;
}

/**
 * 사진이 들어간 키마다 인쇄면 크기의 PNG 를 만들어 키 번호 순서로 돌려준다.
 * 파일로 저장할 때(exportKeyFaces)와 주문에 붙일 때(order.ts)가 함께 쓴다.
 */
export async function renderKeyFaces(
  layout: ClickerLayout,
  mode: PhotoMode,
  slots: readonly (Placement | null)[],
  span: Placement | null,
  photos: ReadonlyMap<string, PhotoAsset>,
): Promise<KeyFaceImage[]> {
  const pixelsPerMeter = Math.round(EXPORT_PIXELS / (PRINT_FACE / 1000));
  const images: KeyFaceImage[] = [];

  for (const key of layout.keys) {
    const placement = mode === 'span' ? span : (slots[key.index] ?? null);
    const photo = placement ? photos.get(placement.photoId) : undefined;
    if (!placement || !photo) continue;
    // 바탕을 칠하지 않는다: 사진이 덮지 않는 곳은 투명하게 남아야 인쇄할 때 키캡 색이 그대로 보인다
    const canvas = renderFaceCanvas(EXPORT_PIXELS, faceRect(key), regionFor(layout, mode, key.index), photo, placement, null);
    const png = await canvasToPng(canvas);
    canvas.width = 0;
    canvas.height = 0;
    if (png) images.push({ key: key.index + 1, data: withPhysicalSize(png, pixelsPerMeter) });
  }
  return images;
}

/**
 * 사진이 들어간 키마다 인쇄면 크기의 PNG 를 만든다.
 * 한 장이면 PNG 그대로, 여러 장이면 ZIP 으로 돌려준다. 사진이 하나도 없으면 null.
 */
export async function exportKeyFaces(
  layout: ClickerLayout,
  mode: PhotoMode,
  slots: readonly (Placement | null)[],
  span: Placement | null,
  photos: ReadonlyMap<string, PhotoAsset>,
): Promise<FaceExport | null> {
  const images = await renderKeyFaces(layout, mode, slots, span, photos);
  if (images.length === 0) return null;

  const base = `maker3d-clicker-${layout.label}`;
  if (images.length === 1 && layout.keys.length === 1) {
    return {
      blob: new Blob([images[0].data as Uint8Array<ArrayBuffer>], { type: 'image/png' }),
      fileName: `${base}-키캡사진.png`,
      count: 1,
    };
  }

  const side = PRINT_FACE.toFixed(1);
  const info = [
    `MAKER3D 키보드 클리커 · ${layout.label} (${layout.description})`,
    '',
    `키캡 윗면(사진이 올라가는 면): ${side} × ${side} mm, 모서리 반경 ${PRINT_FACE_RADIUS.toFixed(2)} mm`,
    `이미지: 키마다 ${EXPORT_PIXELS} × ${EXPORT_PIXELS} px. 크기 정보가 들어 있어 ${side} × ${side} mm 로 열립니다.`,
    '사진이 덮지 않은 곳은 투명입니다.',
    mode === 'span' ? '사진 한 장을 모든 키에 이어 붙인 배치입니다 (키 사이 틈에 해당하는 부분은 빠져 있습니다).' : '',
    '',
    '키 번호는 위에서 봤을 때 왼쪽 위부터 오른쪽으로, 그다음 줄 순서입니다.',
    `들어 있는 키: ${images.map((image) => image.key).join(', ')} / 전체 ${layout.keys.length}개`,
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\r\n');

  const files = images.map((image) => ({ name: `key${image.key}.png`, data: image.data }));
  // 안내 파일. 압축 푸는 프로그램에 따라 한글 파일 이름에서 멈추는 경우가 있어 이름은 영문으로 둔다.
  // 내용 앞에는 메모장에서도 한글이 깨지지 않게 BOM(U+FEFF)을 붙인다
  const bom = String.fromCharCode(0xfeff);
  files.push({ name: 'README.txt', data: new TextEncoder().encode(`${bom}${info}\r\n`) });

  return { blob: makeZip(files), fileName: `${base}-키캡사진.zip`, count: images.length };
}
