/**
 * 키보드 클리커 주문 넣기.
 *
 * 다른 주문(실시간 견적, 키캡제작)과 같은 길을 따른다:
 *   주문번호 만들기 → 제작에 필요한 파일을 백엔드의 주문 폴더에 올리기 → Firestore orders 에 주문 문서 저장
 * 그래서 관리자 주문관리(/admin/order)에 그대로 나타나고, 거기서 파일을 내려받을 수 있다.
 * 알림 메일은 보내지 않는다.
 *
 * 올리는 파일
 *   key01.png …    : 키캡 윗면에 인쇄할 사진 (키마다 한 장, 인쇄면 크기, 사진이 없는 곳은 투명)
 *   preview.png    : 고객이 본 3D 미리보기
 *   order-info.txt : 종류 · 색상 · 사진이 들어간 키 등 제작 내용
 */

import { ClickerLayout, PhotoMode, PRINT_FACE, PRINT_FACE_RADIUS, getClickerSize } from './layouts';
import type { PhotoAsset, Placement } from './placement';
import { EXPORT_PIXELS, renderKeyFaces } from './exportFaces';
import { ClickerOrderSpec, OrderData, generateOrderNumber, saveOrder, uploadSTLFiles } from '@/utils/orderUtils';

export interface ClickerOrderInput {
  layout: ClickerLayout;
  mode: PhotoMode;
  slots: readonly (Placement | null)[];
  span: Placement | null;
  photos: ReadonlyMap<string, PhotoAsset>;
  caseColor: { name: string; hex: string };
  keycapColor: { name: string; hex: string };
  showRing: boolean;
  /** 3D 미리보기 화면을 찍은 PNG (data URL). 찍지 못했으면 null */
  previewDataUrl: string | null;
  customer: { name: string; phoneNumber: string; email: string };
  /** 로그인한 계정의 이메일 (마이페이지에서 이 값으로 주문을 찾는다) */
  userEmail: string;
}

/** 수량. 지금은 한 번에 한 개만 주문한다 */
const QUANTITY = 1;
/** 백엔드가 한 번에 받는 파일 수 (upload-order-files 의 제한) */
const UPLOAD_BATCH = 10;
const PREVIEW_FILE = 'preview.png';
const INFO_FILE = 'order-info.txt';

/**
 * 주문 폴더에 올릴 파일로 만든다.
 * 백엔드의 주문 파일 업로드는 3D 모델 파일(STL 등)을 받으려고 만든 것이라 파일 이름의 확장자를 검사하는데,
 * 형식을 '일반 파일(application/octet-stream)'로 보내면 그대로 받는다. PNG · TXT 도 그렇게 보낸다.
 * (저장되는 파일 이름과 내용은 그대로다)
 */
const asUpload = (data: BlobPart, name: string) => new File([data], name, { type: 'application/octet-stream' });

const pad = (n: number, length = 2) => String(n).padStart(length, '0');

/** 주문 폴더에 함께 넣는 제작 내용 안내. 관리자가 파일을 내려받으면 같이 들어 있다 */
function buildInfoText(orderNumber: string, orderedAt: string, spec: ClickerOrderSpec): string {
  const side = spec.printFace.toFixed(1);
  // 해당하지 않는 줄은 null 로 두었다가 뺀다 (빈 줄 '' 은 구역을 나누는 줄이라 그대로 둔다)
  const lines = [
    'MAKER3D 키보드 클리커 주문',
    `주문번호: ${orderNumber}`,
    `주문 시각: ${orderedAt}`,
    // 주문자 이름 · 연락처는 여기에 적지 않는다 (관리자 주문관리 화면에서 확인)
    '',
    '[제품]',
    `종류: ${spec.layoutLabel} (${spec.layoutDescription})`,
    spec.custom
      ? `주의: 고객이 직접 입력한 크기(${spec.cols} x ${spec.rows})입니다. 준비된 제작용 모델이 없는 크기입니다.`
      : null,
    `크기: 약 ${spec.size.width} x ${spec.size.depth} x ${spec.size.height} mm`,
    `케이스 색상: ${spec.caseColor.name} (${spec.caseColor.hex})`,
    `키캡 색상: ${spec.keycapColor.name} (${spec.keycapColor.hex})`,
    `키링 고리: ${spec.showRing ? '있음' : '없음'}`,
    `수량: ${QUANTITY}개`,
    '',
    '[키캡 사진]',
    spec.photoMode === 'span'
      ? '배치: 사진 한 장을 모든 키에 이어 붙임 (키 사이 틈에 해당하는 부분은 빠져 있음)'
      : '배치: 키마다 사진 한 장씩',
    `사진이 들어간 키: ${spec.photoKeys.join(', ')} / 전체 ${spec.keyCount}개`,
    spec.photoKeys.length < spec.keyCount ? '사진이 없는 키는 키캡 색 그대로 둡니다.' : null,
    `파일: ${spec.faceFiles.join(', ')}`,
    `키캡 윗면(사진이 올라가는 면): ${side} x ${side} mm, 모서리 반경 ${PRINT_FACE_RADIUS.toFixed(2)} mm`,
    `이미지: 키마다 ${EXPORT_PIXELS} x ${EXPORT_PIXELS} px. 크기 정보가 들어 있어 ${side} x ${side} mm 로 열립니다. 사진이 덮지 않은 곳은 투명입니다.`,
    '키 번호는 위에서 봤을 때 왼쪽 위부터 오른쪽으로, 그다음 줄 순서입니다.',
    spec.previewFile ? `${spec.previewFile}: 고객이 주문할 때 본 3D 미리보기` : null,
  ].filter((line): line is string => line !== null);
  // 메모장에서도 한글이 깨지지 않게 BOM(U+FEFF)을 붙이고 줄 끝은 CRLF 로 둔다
  return `${String.fromCharCode(0xfeff)}${lines.join('\r\n')}\r\n`;
}

/** 주문을 넣고 주문번호를 돌려준다. 도중에 실패하면 오류를 던진다 (주문 문서는 파일을 다 올린 뒤에 만든다) */
export async function placeClickerOrder(input: ClickerOrderInput): Promise<string> {
  const { layout, mode, caseColor, keycapColor, showRing } = input;

  const faces = await renderKeyFaces(layout, mode, input.slots, input.span, input.photos);
  if (faces.length === 0) throw new Error('사진이 들어간 키가 없습니다.');

  const orderNumber = await generateOrderNumber();
  const now = new Date();
  const orderDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const orderTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const size = getClickerSize(layout);
  const round1 = (value: number) => Math.round(value * 10) / 10;
  const faceFiles = faces.map((face) => `key${pad(face.key)}.png`);

  let preview: Blob | null = null;
  if (input.previewDataUrl) {
    try {
      preview = await (await fetch(input.previewDataUrl)).blob();
    } catch {
      // 미리보기는 참고용이라, 만들지 못해도 주문은 그대로 넣는다
    }
  }

  const spec: ClickerOrderSpec = {
    layoutId: layout.id,
    layoutLabel: layout.label,
    layoutDescription: layout.description,
    cols: layout.cols,
    rows: layout.rows,
    keyCount: layout.keys.length,
    custom: layout.custom,
    size: { width: round1(size.width), depth: round1(size.depth), height: round1(size.height) },
    caseColor: { name: caseColor.name, hex: caseColor.hex },
    keycapColor: { name: keycapColor.name, hex: keycapColor.hex },
    showRing,
    photoMode: mode,
    photoKeys: faces.map((face) => face.key),
    printFace: round1(PRINT_FACE),
    faceFiles,
    previewFile: preview ? PREVIEW_FILE : null,
    infoFile: INFO_FILE,
  };

  const uploads: File[] = [
    ...faces.map((face, index) => asUpload(face.data as Uint8Array<ArrayBuffer>, faceFiles[index])),
    ...(preview ? [asUpload(preview, PREVIEW_FILE)] : []),
    asUpload(buildInfoText(orderNumber, `${orderDate} ${orderTime}`, spec), INFO_FILE),
  ];

  // 키가 많으면 파일도 많으므로 나눠서 올린다 (같은 주문 폴더에 차례로 쌓인다)
  const fileUrls: string[] = [];
  for (let start = 0; start < uploads.length; start += UPLOAD_BATCH) {
    fileUrls.push(...(await uploadSTLFiles(uploads.slice(start, start + UPLOAD_BATCH), orderNumber)));
  }

  const orderData: OrderData = {
    customerName: input.customer.name,
    phoneNumber: input.customer.phoneNumber,
    orderEmail: input.customer.email,
    userEmail: input.userEmail,
    fileUrls,
    // 관리자 목록의 색상 칸과 고객 안내에 한 줄로 보이는 항목
    files: [
      {
        fileName: `키보드 클리커 ${layout.label}`,
        material: '키보드 클리커',
        color: `클리커 ${layout.label} · 케이스 ${caseColor.name} / 키캡 ${keycapColor.name}${showRing ? '' : ' / 고리 없음'}`,
        colorHex: caseColor.hex,
        quantity: QUANTITY,
        // 가격은 아직 정해져 있지 않다. 상담하면서 정한다
        price: 0,
      },
    ],
    totalPrice: 0,
    paymentStatus: 'pending',
    orderDate: `${orderDate} ${orderTime}`,
    orderTime,
    workStatus: 'pending',
    orderType: 'clicker',
    clickerSpec: spec,
  };
  await saveOrder(orderNumber, orderData);

  return orderNumber;
}
