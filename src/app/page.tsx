'use client';

import styles from './page.module.scss';
import Image from 'next/image';
import {useState} from 'react';
import ReviewCard from "@/components/ReviewCard";

export default function Home() {
    const [activeButton, setActiveButton] = useState<number>(1);
    const [currentReviewIndex, setCurrentReviewIndex] = useState<number>(0);
    const [showModal, setShowModal] = useState<boolean>(true);

    const reviews = [
        {
            review: "너무 마음에 들어요!! 10여년 전, 3D프린터 품질을 생각하고 반신반의하면서 의뢰를 드렸는데 출력물이 너무 잘 나와서 깜짝 놀랐네요. 자주 이용할 것 같아요!",
            name: "김철수"
        },
        {
            review: "정말 빠른 배송에 놀랐습니다. 품질도 기대 이상이었고, 가격도 합리적이었어요. 다음에도 꼭 이용하겠습니다!",
            name: "이영희"
        },
        {
            review: "시제품 제작으로 의뢰했는데 정말 만족스럽습니다. 디테일도 살아있고 마감처리도 깔끔해요.",
            name: "박민수"
        },
        {
            review: "졸업작품용으로 의뢰했는데 기대 이상의 퀄리티가 나왔어요. 교수님도 칭찬해주셨습니다!",
            name: "최지우"
        }
    ];

    const handlePrevReview = () => {
        setCurrentReviewIndex(prev => 
            prev === 0 ? Math.max(0, reviews.length - 2) : Math.max(0, prev - 2)
        );
    };

    const handleNextReview = () => {
        setCurrentReviewIndex(prev => 
            prev + 2 >= reviews.length ? 0 : prev + 2
        );
    };

    const getProcessImage = () => {
        switch (activeButton) {
            case 1:
                return '/process1.svg'; // 실시간 견적 확인
            case 2:
                return '/process2.svg'; // 3D 모델링 파일 드래그
            case 3:
                return '/process3.svg'; // 색상 및 수량 선택
            case 4:
                return '/process4.svg'; // 견적 요청 작성
            case 5:
                return '/process5.svg'; // 온라인 결제
            default:
                return '/process1.svg';
        }
    };

    return (
        <>
            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalContent}>
                            <h2 className={styles.modalTitle}>알림</h2>
                            <p className={styles.modalMessage}>
                                현재 웹페이지 제작 중 입니다.<br/>
                                아직 웹페이지는 온전하지 않으며, <br/>
                                일부기능이 제한됩니다.   <br/>
                            </p>
                            <button 
                                className={styles.modalButton}
                                onClick={() => setShowModal(false)}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className={styles.container}>
            <div className={styles.innerContainer}>
                <Image
                    src="/mainPhoto.png"
                    alt="MAKER 3D Logo"
                    width={1600}
                    height={689}
                    style={{marginTop: "115px"}}
                    className={styles.logoIcon}
                />
                <div className={styles.buttonWrapper}>
                    <div className={styles.storeButton}>
                        <Image
                            src="/store.svg"
                            alt="MAKER 3D Logo"
                            width={19}
                            height={22}
                        />
                        <p className={styles.storeButtonText}>스토어</p>
                    </div>
                    <div className={styles.checkQuoteButton}>
                        <Image
                            src="/checkQuote.svg"
                            alt="MAKER 3D Logo"
                            width={19}
                            height={22}
                        />
                        <p className={styles.storeButtonText}>실시간 견적확인</p>
                    </div>

                    <div className={styles.kakaoRequestButton}>
                        <Image
                            src="/kakao.svg"
                            alt="MAKER 3D Logo"
                            width={19}
                            height={22}
                        />
                        <p className={styles.storeButtonText}>카카오톡 상담하기</p>
                    </div>
                </div>
                <div className={styles.underArrow}>
                    <Image
                        src="/underArrow.svg"
                        alt="MAKER 3D Logo"
                        width={22}
                        height={50}
                    />
                </div>
                <p className={styles.processTitle}>Maker 3D의 간단한 3D 프린팅 견적 진행 방법</p>
                <div className={styles.processButtonWrapper}>
                    <div
                        className={`${styles.processButton} ${activeButton === 1 ? styles.active : ''}`}
                        onClick={() => setActiveButton(1)}
                    >
                        <div className={styles.circle}>1</div>
                        <p className={styles.processButtonText}>실시간 견적 확인하러가기</p>
                    </div>
                    <div
                        className={`${styles.processButton} ${activeButton === 2 ? styles.active : ''}`}
                        onClick={() => setActiveButton(2)}
                    >
                        <div className={styles.circle}>2</div>
                        <p className={styles.processButtonText}>3D 모델링 파일 가져오기</p>
                    </div>
                    <div
                        className={`${styles.processButton} ${activeButton === 3 ? styles.active : ''}`}
                        onClick={() => setActiveButton(3)}
                    >
                        <div className={styles.circle}>3</div>
                        <p className={styles.processButtonText}>색상 및 수량 선택하기</p>
                    </div>
                    <div
                        className={`${styles.processButton} ${activeButton === 4 ? styles.active : ''}`}
                        onClick={() => setActiveButton(4)}
                    >
                        <div className={styles.circle}>4</div>
                        <p className={styles.processButtonText}>견적 요청 작성하기</p>
                    </div>
                    <div
                        className={`${styles.processButton} ${activeButton === 5 ? styles.active : ''}`}
                        onClick={() => setActiveButton(5)}
                    >
                        <div className={styles.circle}>5</div>
                        <p className={styles.processButtonText}>온라인 결제하기</p>
                    </div>
                </div>
                <div className={styles.processView}>
                    <Image
                        src={getProcessImage()}
                        alt={`Process step ${activeButton}`}
                        width={1044}
                        height={587}
                        className={styles.processImage}
                    />
                </div>
                <div className={styles.image}>
                    <Image
                        src="/image.png"
                        alt="MAKER 3D Logo"
                        width={1434}
                        height={701}
                        className={styles.logoIcon}
                    />
                    <div className={styles.blur}></div>
                    <p className={styles.imageTitle}>
                        3D 프린팅<br/>
                        굿즈제작 & 스토어
                    </p>
                    <p className={styles.imageSubTitle}>
                        최신 3D프린터 장비로 출력속도 3배 향상! 고정밀의 출력물을 받아보세요!
                    </p>
                    <div className={styles.goToStore}>
                        <p className={styles.storeButtonText}>스토어 바로가기</p>
                    </div>
                </div>
                <Image
                    src="/mainPhoto2.svg"
                    alt="MAKER 3D Logo"
                    width={1200}
                    height={790}
                    style={{marginTop: 300}}


                />
                <Image
                    src="/mainPhoto3.svg"
                    alt="MAKER 3D Logo"
                    width={874}
                    height={166}
                    style={{marginTop: 290}}
                />
                <div className={styles.columnLine}></div>
                <div className={styles.boxWrapper}>
                    <div className={styles.top}>
                        <div className={styles.box}>
                            <p className={styles.boxTitle}>제품을 대량생산 해야하는 고객</p>
                            <p className={styles.boxSubTitle}>PLA, ABS, PETG, TPU, 레진 소재가 기반이 되는 제품의</p>
                            <p className={styles.boxSubTitle}>대량샌상이 필요한 고객에게 추천합니다.</p>
                        </div>
                        <div className={styles.box}>
                            <p className={styles.boxTitle}>시제품을 제작해야하는 고객</p>
                            <p className={styles.boxSubTitle}>제품 양산 전, 시제품을 제작하여 완제품에 대한 테스트를</p>
                            <p className={styles.boxSubTitle}>행해보고자 하는 고객에게 추천합니다.</p>
                        </div>
                    </div>
                    <div className={styles.top}>
                        <div className={styles.box}>
                            <p className={styles.boxTitle}>학교 과제품, 졸업작품을 만들어야하는 고객</p>
                            <p className={styles.boxSubTitle}>디자인, 설계 도면만이 아닌 실사출력을 통해 학교 과제물이나</p>
                            <p className={styles.boxSubTitle}>졸업작품을 만들어야 하는 고객분에게 추천합니다.</p>
                        </div>
                        <div className={styles.box}>
                            <p className={styles.boxTitle}>나만의 제품을 만들고 싶은 고객</p>
                            <p className={styles.boxSubTitle}>커스텀 제작, 생활용품, 피규어, 촬영소품 등 나만의 제품을</p>
                            <p className={styles.boxSubTitle}>만들고 싶은 고객분들에게 추천합니다.</p>
                        </div>
                    </div>

                </div>
                <Image
                    src="/mainPhoto4.svg"
                    alt="MAKER 3D Logo"
                    width={1198}
                    height={863}
                    style={{marginTop: 202}}
                />

                <div className={styles.reviewWrapper}>
                    <p className={styles.reviewTitle}>고객님들의 생생 리얼 후기!!</p>
                    <div className={styles.reviewBtnWrapper}>

                        <div className={styles.reviewBtn} onClick={handlePrevReview}>
                            <Image
                                src="/arrowLeft.svg"
                                alt="MAKER 3D Logo"
                                width={10}
                                height={19}
                            />

                        </div>
                        <div className={styles.reviewBtn} onClick={handleNextReview}>
                            <Image
                                src="/arrowRight.svg"
                                alt="MAKER 3D Logo"
                                width={10}
                                height={19}
                            />

                        </div>
                    </div>

                </div>
                <div className={styles.reviewCardWrapper}>
                    <div 
                        className={styles.reviewCardTrack}
                        style={{
                            transform: `translateX(-${currentReviewIndex * 672}px)`
                        }}
                    >
                        {reviews.map((review, index) => (
                            <ReviewCard
                                key={index}
                                review={review.review}
                                name={review.name}
                            />
                        ))}
                    </div>
                </div>


            </div>
        </div>
        </>
    );
}
