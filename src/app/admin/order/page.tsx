'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import styles from './page.module.scss';
import Pagination from '../../../components/Pagination';
import {getNotices, deleteNotice, Notice} from '@/services/noticeService';
import Image from "next/image";

interface NoticeItem extends Notice {
    isSelected: boolean; // 선택 체크박스 상태
}

export default function NoticePage() {
    const router = useRouter();



    return (
        <div className={styles.container}>
            <div className={styles.ManagerSignatureBar}>
                <Image src={"/Icon_smile.svg"} width={24} height={24} alt={""}/>
                <p>관리자</p>
            </div>
            <div className={styles.menuBar}>
                <Image
                    src="/logo.svg"
                    alt="MAKER 3D Logo"
                    width={32}
                    height={32}
                    className={styles.logoIcon}
                />
                <div className={styles.orderBtn}>신규 주문</div>
                <div className={styles.completeBtn}>배송 완료</div>

            </div>
            <div className={styles.mainWrapper}>
                ㅇㄹㅇ
            </div>



        </div>
    );
}