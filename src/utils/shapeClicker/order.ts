/**
 * 쉐이프 클리커 주문 넣기.
 *
 * 키보드 클리커(utils/clicker/order) · 실시간 견적과 같은 길을 따른다:
 *   주문번호 만들기 → 제작에 필요한 파일을 백엔드의 주문 폴더에 올리기 → Firestore orders 에 주문 문서 저장
 * 그래서 관리자 주문관리(/admin/order)에 그대로 나타나고, 거기서 파일을 내려받을 수 있다.
 * 알림 메일은 보내지 않는다.
 *
 * 올리는 파일
 *   <주문번호>-body.stl : 몸체 (출력용, 높이가 Z)
 *   <주문번호>-cap.stl  : 누르는 곳 (출력용, 높이가 Z)
 *   logo.png            : 누르는 곳 윗면에 올리는 로고 그림 (배경은 투명)
 *   preview.png         : 고객이 본 3D 미리보기
 *   order-info.txt      : 크기 · 색상 등 제작 내용
 *
 * 출력용 파일은 화면에 보이던 것(끄는 동안은 빠른 계산)이 아니라 정밀하게 다시 계산해서 만든다.
 */

import { computeShape, SHAPE_SPEC, type ShapeParams } from './shape';
import type { LogoAsset } from './logo';
import {
  OrderData,
  ShapeClickerOrderSpec,
  generateOrderNumber,
  saveOrder,
  uploadSTLFiles,
} from '@/utils/orderUtils';

export interface ShapeClickerOrderInput {
  logo: LogoAsset;
  /** 올린 로고가 아니라 예시 모양으로 만든 것인지 */
  sample: boolean;
  /** 화면에서 고른 값 (크기 · 여백 · 스위치 자리 · 고리) */
  params: ShapeParams;
  bodyColor: { name: string; hex: string };
  capColor: { name: string; hex: string };
  /** 3D 미리보기 화면을 찍은 PNG (data URL). 찍지 못했으면 null */
  previewDataUrl: string | null;
  customer: { name: string; phoneNumber: string; email: string };
  /** 로그인한 계정의 이메일 (마이페이지에서 이 값으로 주문을 찾는다) */
  userEmail: string;
}

/** 수량. 지금은 한 번에 한 개만 주문한다 */
const QUANTITY = 1;
const LOGO_FILE = 'logo.png';
const PREVIEW_FILE = 'preview.png';
const INFO_FILE = 'order-info.txt';

const pad = (n: number, length = 2) => String(n).padStart(length, '0');
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * 주문 폴더에 올릴 파일로 만든다.
 * 백엔드의 주문 파일 업로드는 3D 모델 파일(STL 등)을 받으려고 만든 것이라 파일 이름의 확장자를 검사하는데,
 * 형식을 '일반 파일(application/octet-stream)'로 보내면 그대로 받는다. PNG · TXT 도 그렇게 보낸다.
 */
const asUpload = (data: BlobPart, name: string) => new File([data], name, { type: 'application/octet-stream' });

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('로고 그림을 만들지 못했습니다.'))), 'image/png');
  });
}

/** 주문 폴더에 함께 넣는 제작 내용 안내. 관리자가 파일을 내려받으면 같이 들어 있다 */
function buildInfoText(orderNumber: string, orderedAt: string, spec: ShapeClickerOrderSpec): string {
  const { size } = spec;
  // 해당하지 않는 줄은 null 로 두었다가 뺀다 (빈 줄 '' 은 구역을 나누는 줄이라 그대로 둔다)
  const lines = [
    'MAKER3D 쉐이프 클리커 주문',
    `주문번호: ${orderNumber}`,
    `주문 시각: ${orderedAt}`,
    // 주문자 이름 · 연락처는 여기에 적지 않는다 (관리자 주문관리 화면에서 확인)
    '',
    '[제품]',
    spec.sample ? `모양: 예시 모양 (${spec.logoName})` : `로고: ${spec.logoName} (고객이 올린 그림)`,
    `크기: 약 ${size.width} x ${size.depth} x ${size.height} mm (긴 쪽 ${spec.sizeMm} mm, 로고 둘레 여백 ${spec.marginMm} mm)`,
    `몸체 색상: ${spec.bodyColor.name} (${spec.bodyColor.hex})`,
    `누르는 곳 색상: ${spec.capColor.name} (${spec.capColor.hex})`,
    spec.showRing ? `키링 고리: 있음 (방향 ${Math.round(spec.lugAngle)}°, 위쪽이 0° · 시계 방향)` : '키링 고리: 없음',
    `스위치: MX 규격 1개, 구멍 ${SHAPE_SPEC.switchHole} x ${SHAPE_SPEC.switchHole} mm`,
    `수량: ${QUANTITY}개`,
    spec.joined ? '모양 보정: 떨어져 있던 조각을 다리로 이어 붙였습니다.' : null,
    spec.seatAdded ? '모양 보정: 스위치가 들어갈 자리가 모자라 그 부분을 넓혔습니다.' : null,
    '',
    '[파일]',
    `${spec.bodyFile}: 몸체 (출력용. 높이가 Z, 단위 mm)`,
    `${spec.capFile}: 누르는 곳 (출력용. 높이가 Z, 단위 mm)`,
    `${spec.logoFile}: 누르는 곳 윗면에 올리는 로고 그림. 가로 ${spec.logoSize.width} x 세로 ${spec.logoSize.height} mm 로 들어갑니다. 배경은 투명입니다.`,
    spec.previewFile ? `${spec.previewFile}: 고객이 주문할 때 본 3D 미리보기` : null,
  ].filter((line): line is string => line !== null);
  // 메모장에서도 한글이 깨지지 않게 BOM(U+FEFF)을 붙이고 줄 끝은 CRLF 로 둔다
  return `${String.fromCharCode(0xfeff)}${lines.join('\r\n')}\r\n`;
}

/** 주문을 넣고 주문번호를 돌려준다. 도중에 실패하면 오류를 던진다 (주문 문서는 파일을 다 올린 뒤에 만든다) */
export async function placeShapeClickerOrder(input: ShapeClickerOrderInput): Promise<string> {
  const { logo, bodyColor, capColor } = input;

  // 3D 를 다루는 코드는 크므로 주문할 때 불러온다
  const [{ buildPrintParts }, { exportSTL }] = await Promise.all([
    import('@/utils/shapeClicker/model'),
    import('@/utils/keycap/keycapGeometry'),
  ]);

  const design = computeShape(logo.source, { ...input.params, draft: false });
  const parts = buildPrintParts(design);
  let bodyStl: Blob;
  let capStl: Blob;
  try {
    bodyStl = await exportSTL(parts.body);
    capStl = await exportSTL(parts.cap);
  } finally {
    parts.dispose();
  }

  const logoPng = await canvasToPng(logo.art);

  let preview: Blob | null = null;
  if (input.previewDataUrl) {
    try {
      preview = await (await fetch(input.previewDataUrl)).blob();
    } catch {
      // 미리보기는 참고용이라, 만들지 못해도 주문은 그대로 넣는다
    }
  }

  const orderNumber = await generateOrderNumber();
  const now = new Date();
  const orderDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const orderTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  // 출력용 파일은 주문번호를 이름에 넣는다 (슬라이서와 프린터 화면에서 어느 주문의 것인지 보이게)
  const bodyFile = `${orderNumber}-body.stl`;
  const capFile = `${orderNumber}-cap.stl`;

  const spec: ShapeClickerOrderSpec = {
    logoName: logo.name,
    sample: input.sample,
    sizeMm: round1(input.params.sizeMm),
    marginMm: round1(input.params.marginMm),
    size: {
      width: round1(design.size.width),
      depth: round1(design.size.depth),
      height: round1(design.size.height),
    },
    bodyColor: { name: bodyColor.name, hex: bodyColor.hex },
    capColor: { name: capColor.name, hex: capColor.hex },
    showRing: design.lug !== null,
    lugAngle: round1(design.lugAngle),
    joined: design.notes.joined,
    seatAdded: design.notes.seatAdded,
    // 로고 그림(art)은 원본 그림의 일부이고, 원본 그림 전체가 놓이는 자리는 design.imageRect 다
    logoSize: {
      width: round1(design.imageRect.w * logo.artRect.w),
      height: round1(design.imageRect.h * logo.artRect.h),
    },
    bodyFile,
    capFile,
    logoFile: LOGO_FILE,
    previewFile: preview ? PREVIEW_FILE : null,
    infoFile: INFO_FILE,
  };

  const uploads: File[] = [
    new File([bodyStl], bodyFile, { type: 'model/stl' }),
    new File([capStl], capFile, { type: 'model/stl' }),
    asUpload(logoPng, LOGO_FILE),
    ...(preview ? [asUpload(preview, PREVIEW_FILE)] : []),
    asUpload(buildInfoText(orderNumber, `${orderDate} ${orderTime}`, spec), INFO_FILE),
  ];
  // 다섯 개라 한 번에 올린다 (백엔드는 한 번에 10개까지 받는다)
  const fileUrls = await uploadSTLFiles(uploads, orderNumber);

  const orderData: OrderData = {
    customerName: input.customer.name,
    phoneNumber: input.customer.phoneNumber,
    orderEmail: input.customer.email,
    userEmail: input.userEmail,
    fileUrls,
    // 관리자 목록의 색상 칸과 고객 안내에 한 줄로 보이는 항목
    files: [
      {
        fileName: `쉐이프 클리커 ${Math.round(spec.sizeMm)}mm`,
        material: '쉐이프 클리커',
        color: `쉐이프 클리커 · 몸체 ${bodyColor.name} / 누르는 곳 ${capColor.name}${spec.showRing ? '' : ' / 고리 없음'}`,
        colorHex: bodyColor.hex,
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
    orderType: 'shapeclicker',
    shapeClickerSpec: spec,
  };
  await saveOrder(orderNumber, orderData);

  return orderNumber;
}
