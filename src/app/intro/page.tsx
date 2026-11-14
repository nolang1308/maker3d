'use client';

import styles from './page.module.scss';
import {useRouter} from 'next/navigation';
import Reveal from '@/components/Reveal';
import ScrollArrow from '@/components/ScrollArrow';
import { ArrowRightIcon, GrowthSection, IntroDiagram, IntroHero } from '@/components/intro/IntroSections';

export default function IntroPage() {
    const router = useRouter();


    return (
        <div className={styles.container}>
            <div className={styles.innerContainer}>
                <IntroHero />

                <div className={styles.scrollArrow}>
                    <ScrollArrow />
                </div>

            </div>
            <GrowthSection />
            <IntroDiagram />

            <div className={styles.innerContainer}>
                <div className={styles.buttonWrapper}>
                    <div className={styles.button}>
                        <p className={styles.buttonTitle}>3D프린팅코리아엑스포 홈페이지</p>
                        <ArrowRightIcon />

                    </div>
                    <div className={styles.button} onClick={() => router.push('/store')} style={{cursor: 'pointer'}}>
                        <p className={styles.buttonTitle}>스토어 바로가기</p>
                        <ArrowRightIcon />

                    </div>
                </div>

                <Reveal className={styles.revealBlock}>
                <p className={styles.come}>오시는길</p>
                <div className={styles.mapWrapper}>
                    <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3220.8962891234567!2d128.3447!3d36.1194!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzbCsDA3JzA5LjgiTiAxMjjCsDIwJzQxLjAiRQ!5e0!3m2!1sko!2skr!4v1234567890123!5m2!1sko!2skr"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen={true}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                </div>
                <div className={styles.boldLine}></div>
                <div className={styles.addressWrapper}>
                    <p className={styles.address}>주소</p>
                    <p className={styles.info}>경상북도 구미시 수출대로 152 세원테크노밸리 301호 ㈜비트텍</p>
                </div>
                <div className={styles.thinLine}></div>
                <div className={styles.addressWrapper}>
                    <p className={styles.address}>TEL / E mail</p>
                    <p className={styles.info}>054-461-4140 / jjy2882@bittech3d.com</p>
                </div>
                <div className={styles.thinLine}></div>
                </Reveal>
                <div className={styles.emptySpace}></div>


            </div>
        </div>
    );
}
