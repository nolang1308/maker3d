import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  phoneNumber: string;
  email: string;
  totalPrice: number;
  files: {
    fileName: string;
    material: string;
    color: string;
    quantity: number;
    price: number;
  }[];
  orderDate: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: OrderEmailData = await request.json();

    // 환경 변수 확인
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const adminEmail = process.env.ADMIN_EMAIL || emailUser;

    if (!emailUser || !emailPass) {
      console.error('이메일 환경 변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { success: false, message: '이메일 설정이 필요합니다.' },
        { status: 500 }
      );
    }

    // Gmail SMTP 설정
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    // 파일 목록 HTML 생성
    const filesHtml = data.files.map((file, index) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${file.fileName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${file.material}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${file.color}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${file.quantity}개</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">₩${file.price.toLocaleString()}</td>
      </tr>
    `).join('');

    // 이메일 HTML 템플릿
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
        .order-info { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .order-info p { margin: 8px 0; }
        .label { color: #6b7280; font-size: 14px; }
        .value { color: #111827; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 14px; color: #374151; }
        .total { background: #2493D8; color: white; padding: 20px; border-radius: 8px; text-align: right; margin-top: 20px; }
        .total-price { font-size: 24px; font-weight: 700; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">새로운 견적 요청</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Maker 3D</p>
        </div>

        <div class="content">
          <h2 style="color: #111827; margin-top: 0;">주문 정보</h2>

          <div class="order-info">
            <p><span class="label">주문번호:</span> <span class="value">${data.orderNumber}</span></p>
            <p><span class="label">주문일시:</span> <span class="value">${data.orderDate}</span></p>
            <p><span class="label">고객명:</span> <span class="value">${data.customerName}</span></p>
            <p><span class="label">연락처:</span> <span class="value">${data.phoneNumber}</span></p>
            <p><span class="label">이메일:</span> <span class="value">${data.email}</span></p>
          </div>

          <h3 style="color: #111827;">주문 파일 목록</h3>
          <table>
            <thead>
              <tr>
                <th>번호</th>
                <th>파일명</th>
                <th>소재</th>
                <th>색상</th>
                <th>수량</th>
                <th>가격</th>
              </tr>
            </thead>
            <tbody>
              ${filesHtml}
            </tbody>
          </table>

          <div class="total">
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">총 결제 금액</p>
            <p class="total-price" style="margin: 5px 0 0 0;">₩${data.totalPrice.toLocaleString()}</p>
          </div>
        </div>

        <div class="footer">
          <p>이 메일은 Maker 3D 자동 발송 시스템에서 발송되었습니다.</p>
          <p>관리자 페이지에서 주문을 확인하고 처리해주세요.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // 이메일 발송
    const mailOptions = {
      from: `"Maker 3D" <${emailUser}>`,
      to: adminEmail,
      subject: `[Maker 3D] 새로운 견적 요청 - ${data.orderNumber}`,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: '이메일 발송 완료' });

  } catch (error) {
    console.error('이메일 발송 오류:', error);
    return NextResponse.json(
      { success: false, message: '이메일 발송 실패', error: String(error) },
      { status: 500 }
    );
  }
}
