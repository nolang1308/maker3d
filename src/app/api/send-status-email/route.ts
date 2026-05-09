import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const TRANSPARENT_SENTINEL = 'TRANSPARENT';

interface OrderItem {
  fileName?: string;
  material: string;
  color: string;
  colorHex?: string;
  quantity: number;
  price?: number;
}

interface StatusEmailData {
  orderNumber: string;
  customerName: string;
  email: string;
  status: 'payment_completed' | 'processing' | 'completed';
  orderItems?: OrderItem[];
}

const NAVER_TALK_URL = 'https://talk.naver.com/ct/w4e4gt?frm=psf';

const naverTalkButton = `
  <div style="text-align: center; margin: 24px 0;">
    <a href="${NAVER_TALK_URL}" target="_blank"
      style="display: inline-block; background: #03c75a; color: white; padding: 12px 28px;
             border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
      💬 네이버 톡톡 상담하기
    </a>
  </div>
`;

const statusConfig = {
  payment_completed: {
    subject: '[Maker 3D] 결제가 확인되었습니다',
    statusText: '결제 확인',
    badgeColor: '#10b981',
  },
  processing: {
    subject: '[Maker 3D] 주문 제작이 시작되었습니다',
    statusText: '제작 중',
    badgeColor: '#2493D8',
  },
  completed: {
    subject: '[Maker 3D] 주문이 완료되었습니다',
    statusText: '완료',
    badgeColor: '#6366f1',
  },
};

function buildColorCell(color: string, colorHex?: string): string {
  const isTransparent = colorHex === TRANSPARENT_SENTINEL || !colorHex;

  const circle = isTransparent
    ? `<span style="display:inline-block; width:16px; height:16px; border-radius:50%;
                    border: 2px solid #d1d5db;
                    background: linear-gradient(135deg, #fff 40%, #d1d5db 100%);
                    vertical-align: middle; margin-right: 6px; flex-shrink:0;"></span>`
    : `<span style="display:inline-block; width:16px; height:16px; border-radius:50%;
                    background:${colorHex}; border: 1px solid rgba(0,0,0,0.12);
                    vertical-align: middle; margin-right: 6px; flex-shrink:0;"></span>`;

  const hexLabel = (isTransparent || !colorHex)
    ? ''
    : `<span style="color:#9ca3af; font-size:11px; margin-left:4px;">${colorHex}</span>`;

  return `<span style="display:inline-flex; align-items:center; white-space:nowrap;">
    ${circle}${color}${hexLabel}
  </span>`;
}

function buildOrderItemsTable(items: OrderItem[]): string {
  const rows = items.map((item) => {
    const subtotal = item.price != null
      ? (item.price * item.quantity).toLocaleString('ko-KR') + '원'
      : '-';

    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">
          ${item.fileName ? `<span style="font-weight:600; display:block; margin-bottom:2px; font-size:13px; color:#111827;">${item.fileName}</span>` : ''}
          ${item.material}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">
          ${buildColorCell(item.color, item.colorHex)}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px; text-align: center;">${item.quantity}개</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px; text-align: right;">${subtotal}</td>
      </tr>
    `;
  }).join('');

  const total = items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const totalRow = `
    <tr style="background: #f3f4f6;">
      <td colspan="3" style="padding: 10px 12px; font-weight: 700; font-size: 14px; color: #111827; text-align: right;">합계</td>
      <td style="padding: 10px 12px; font-weight: 700; font-size: 14px; color: #111827; text-align: right;">${total.toLocaleString('ko-KR')}원</td>
    </tr>
  `;

  return `
    <div style="margin: 20px 0;">
      <p style="font-weight: 700; color: #111827; margin-bottom: 8px; font-size: 15px;">주문 상세</p>
      <table style="width:100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #e5e7eb;">
            <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #6b7280;">소재</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #6b7280;">색상</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 13px; color: #6b7280;">수량</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: #6b7280;">금액</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${totalRow}
        </tbody>
      </table>
    </div>
  `;
}

function buildStatusContent(data: StatusEmailData, badgeColor: string): string {
  const itemsTable = data.orderItems && data.orderItems.length > 0
    ? buildOrderItemsTable(data.orderItems)
    : '';

  switch (data.status) {
    case 'payment_completed':
      return `
        <div style="border-left: 4px solid ${badgeColor}; padding: 16px 20px; background: #f9fafb; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 15px;">
          결제가 확인되었습니다. 감사합니다!
        </div>
        ${itemsTable}
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin: 20px 0; font-size: 14px; color: #374151; line-height: 1.8;">
          ⚠️ 제작 중에는 소재나 색상 변경이 어렵습니다.<br/>
          변동사항이 있으신 경우 네이버 톡톡 상담 주세요!
        </div>
        ${naverTalkButton}
      `;

    case 'processing':
      return `
        <div style="border-left: 4px solid ${badgeColor}; padding: 16px 20px; background: #f9fafb; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 15px;">
          요청하신 주문이 현재 제작 중입니다.
        </div>
        ${itemsTable}
        ${naverTalkButton}
      `;

    case 'completed':
      return `
        <div style="border-left: 4px solid ${badgeColor}; padding: 16px 20px; background: #f9fafb; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 15px;">
          주문이 완료되었습니다!
        </div>
        ${itemsTable}
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin: 20px 0; font-size: 14px; color: #374151; line-height: 1.8;">
          📦 출하는 보통 주문일(오후 4시 이전) 기준, 휴일을 제외하고 <strong>2~5일</strong> 정도 소요됩니다.<br/>
          형상이나 크기, 수량에 따라 출하일이 변동될 수 있습니다.
        </div>
        <p style="font-size: 14px; color: #374151; margin: 16px 0;">문의사항은 네이버 톡톡 상담 주세요!</p>
        ${naverTalkButton}
      `;
  }
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function POST(request: NextRequest) {
  try {
    const data: StatusEmailData = await request.json();

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.error('이메일 환경 변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { success: false, message: '이메일 설정이 필요합니다.' },
        { status: 500 }
      );
    }

    if (!statusConfig[data.status]) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 상태값입니다.' },
        { status: 400 }
      );
    }

    const config = statusConfig[data.status];
    const statusContent = buildStatusContent(data, config.badgeColor);

    const emailHtml = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2493D8 0%, #1a7bb8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .status-badge { display: inline-block; background: ${config.badgeColor}; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; }
        .order-info { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .order-info p { margin: 8px 0; }
        .label { color: #6b7280; font-size: 14px; }
        .value { color: #111827; font-weight: 600; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">주문 현황 안내</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Maker 3D</p>
        </div>
        <div class="content">
          <p style="font-size: 16px;">안녕하세요, <strong>${data.customerName}</strong> 고객님.</p>
          <p>주문 현황이 업데이트 되었습니다.</p>
          <div style="text-align: center; margin: 24px 0;">
            <span class="status-badge">${config.statusText}</span>
          </div>
          ${statusContent}
          <div class="order-info">
            <p><span class="label">주문번호:</span> <span class="value">${data.orderNumber}</span></p>
            <p><span class="label">고객명:</span> <span class="value">${data.customerName}</span></p>
          </div>
        </div>
        <div class="footer">
          <p>이 메일은 Maker 3D 자동 발송 시스템에서 발송되었습니다.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    await transporter.sendMail({
      from: `"Maker 3D" <${emailUser}>`,
      to: data.email,
      subject: `${config.subject} - ${data.orderNumber}`,
      html: emailHtml,
    });

    return NextResponse.json({ success: true, message: '이메일 발송 완료' });

  } catch (error) {
    console.error('상태 이메일 발송 오류:', error);
    return NextResponse.json(
      { success: false, message: '이메일 발송 실패' },
      { status: 500 }
    );
  }
}
