import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface StatusEmailData {
  orderNumber: string;
  customerName: string;
  email: string;
  status: 'payment_completed' | 'processing' | 'completed';
}

const statusConfig = {
  payment_completed: {
    subject: '[Maker 3D] 결제가 확인되었습니다',
    message: '결제가 확인되어 작업을 준비 중입니다.',
    statusText: '결제 확인',
    badgeColor: '#10b981',
  },
  processing: {
    subject: '[Maker 3D] 주문 제작이 시작되었습니다',
    message: '주문 제작이 시작되었습니다.',
    statusText: '제작 중',
    badgeColor: '#2493D8',
  },
  completed: {
    subject: '[Maker 3D] 주문이 완료되었습니다',
    message: '주문이 완료되었습니다. 수령 방법을 안내드립니다.',
    statusText: '완료',
    badgeColor: '#6366f1',
  },
};

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

    const config = statusConfig[data.status];

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const emailHtml = `
    <!DOCTYPE html>
    <html>
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
        .message-box { border-left: 4px solid ${config.badgeColor}; padding: 16px 20px; background: #f9fafb; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 15px; }
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
          <div class="message-box">${config.message}</div>
          <div class="order-info">
            <p><span class="label">주문번호:</span> <span class="value">${data.orderNumber}</span></p>
            <p><span class="label">고객명:</span> <span class="value">${data.customerName}</span></p>
          </div>
          <p style="font-size: 14px; color: #6b7280;">문의사항이 있으시면 고객센터로 연락해 주세요.</p>
        </div>
        <div class="footer">
          <p>이 메일은 Maker 3D 자동 발송 시스템에서 발송되었습니다.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: `"Maker 3D" <${emailUser}>`,
      to: data.email,
      subject: `${config.subject} - ${data.orderNumber}`,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: '이메일 발송 완료' });

  } catch (error) {
    console.error('상태 이메일 발송 오류:', error);
    return NextResponse.json(
      { success: false, message: '이메일 발송 실패', error: String(error) },
      { status: 500 }
    );
  }
}
