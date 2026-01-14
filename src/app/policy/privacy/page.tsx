'use client';

import styles from './page.module.scss';

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <h1 className={styles.pageTitle}>개인정보처리방침</h1>
        
        <div className={styles.policyContent}>
          <div className={styles.section}>
            <h2>제1조 (개인정보 처리목적)</h2>
            <p>주식회사 비트텍('https://maker3d.co.kr' 이하 'Maker 3D')은(는) 다음의 목적을 위하여 개인정보를 처리하고 있으며, 다음의 목적 이외의 용도로는 이용하지 않습니다.</p>
            <ul>
              <li>회원가입 및 관리: 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 각종 고지·통지</li>
              <li>상품 또는 서비스 제공: 주문 제작(3D프린팅) 서비스 제공, 계약서·청구서 발송, 콘텐츠 제공, 맞춤서비스 제공, 본인인증</li>
              <li>고충처리: 민원인의 신원 확인, 민원사항 확인, 사실조사를 위한 연락·통지, 처리결과 통보</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>제2조 (개인정보의 처리 및 보유기간)</h2>
            <p>① 회사는 정보주체로부터 개인정보를 수집할 때 동의받은 개인정보 보유·이용기간 또는 법령에 따른 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
            
            <div className={styles.subsection}>
              <h3>각각의 개인정보 처리 및 보유 기간은 다음과 같습니다:</h3>
              <ul>
                <li>회원가입 및 관리: 회원탈퇴일로부터 5년</li>
                <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
                <li>대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
                <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년</li>
                <li>웹사이트 방문기록: 3개월</li>
              </ul>
            </div>
          </div>

          <div className={styles.section}>
            <h2>제3조 (개인정보의 제3자 제공)</h2>
            <p>① 회사는 정보주체의 개인정보를 제1조(개인정보 처리목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보보호법 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</p>
            
            <div className={styles.subsection}>
              <h3>회사는 다음과 같이 개인정보를 제3자에게 제공하고 있습니다:</h3>
              <ul>
                <li>제공받는 자: 네이버 주식회사 (결제처리를 위한 필수 정보만 제공)</li>
                <li>제공받는 자의 개인정보 이용목적: 네이버페이 결제 서비스 제공</li>
                <li>제공하는 개인정보 항목: 주문자명, 결제금액, 상품정보</li>
                <li>제공받는 자의 보유·이용기간: 결제 완료 후 5년</li>
              </ul>
            </div>
          </div>

          <div className={styles.section}>
            <h2>제4조 (개인정보처리 위탁)</h2>
            <p>① 회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
            
            <div className={styles.subsection}>
              <h3>1. Google Cloud Platform</h3>
              <ul>
                <li>위탁받는 자 (수탁자): Google LLC</li>
                <li>위탁하는 업무의 내용: 파일 저장 및 관리</li>
                <li>위탁기간: 서비스 이용계약 종료시까지</li>
              </ul>
            </div>
          </div>

          <div className={styles.section}>
            <h2>제5조 (정보주체의 권리·의무 및 그 행사방법)</h2>
            <p>① 정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
            <ul>
              <li>개인정보 처리현황 통지요구</li>
              <li>개인정보 열람요구</li>
              <li>개인정보 정정·삭제요구</li>
              <li>개인정보 처리정지요구</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2>제6조 (처리하는 개인정보의 항목 작성)</h2>
            <p>① 회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
            
            <div className={styles.subsection}>
              <h3>1. 회원가입 및 관리</h3>
              <ul>
                <li>필수항목: 이메일, 비밀번호, 이름</li>
                <li>선택항목: 휴대전화번호</li>
              </ul>
            </div>

            <div className={styles.subsection}>
              <h3>2. 주문 제작 서비스 제공</h3>
              <ul>
                <li>필수항목: 주문자명, 연락처, 주소, 결제정보</li>
                <li>선택항목: 배송 요청사항</li>
              </ul>
            </div>
          </div>

          <div className={styles.section}>
            <h2>제7조 (개인정보의 파기)</h2>
            <p>① 회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>
            <p>② 정보주체로부터 동의받은 개인정보 보유기간이 경과하거나 처리목적이 달성되었음에도 불구하고 다른 법령에 따라 개인정보를 계속 보존하여야 하는 경우에는, 해당 개인정보를 별도의 데이터베이스(DB)로 옮기거나 보관장소를 달리하여 보존합니다.</p>
            
            <div className={styles.subsection}>
              <h3>개인정보 파기의 절차 및 방법은 다음과 같습니다:</h3>
              <ul>
                <li>파기절차: 회사는 파기 사유가 발생한 개인정보를 선정하고, 회사의 개인정보 보호책임자의 승인을 받아 개인정보를 파기합니다.</li>
                <li>파기방법: 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다.</li>
              </ul>
            </div>
          </div>

          <div className={styles.section}>
            <h2>제8조 (개인정보 보호책임자)</h2>
            <p>① 회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
            
            <div className={styles.subsection}>
              <h3>개인정보 보호책임자</h3>
              <ul>
                <li>성명: 황수민</li>
                <li>직책: 대표이사</li>
                <li>연락처: 054-462-4140, suminhwang1308@gmail.com</li>
              </ul>
            </div>
            
            <p>② 정보주체께서는 회사의 서비스(또는 사업)을 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다. 회사는 정보주체의 문의에 대해 지체 없이 답변 및 처리해드릴 것입니다.</p>
          </div>

          <div className={styles.section}>
            <h2>제9조 (개인정보 처리방침 변경)</h2>
            <p>① 이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.</p>
          </div>

          <div className={styles.section}>
            <h2>부칙</h2>
            <p>본 방침은 2025년 12월 30일부터 시행합니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}