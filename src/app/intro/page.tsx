'use client';

import styles from './page.module.scss';
import Image from 'next/image';
import {useState} from 'react';

export default function IntroPage() {


    return (
        <div className={styles.container}>
            <div className={styles.innerContainer}>
                <Image
                    src="/introLogo.svg"
                    alt="MAKER 3D Logo"
                    width={1364}
                    height={650}
                    style={{marginTop: 137}}

                />
                <Image
                    src="/underArrow.svg"
                    alt="MAKER 3D Logo"
                    width={22}
                    height={50}
                    style={{marginTop: 138}}
                />

            </div>
            <div className={styles.graphWrapper}>
                <Image
                    src="/graph.svg"
                    alt="MAKER 3D Logo"
                    width={1600}
                    height={689}
                    className={styles.graph}
                />
                <div className={styles.graphInfoWrapper}>
                    <Image
                        src="/graphInfo.svg"
                        alt="MAKER 3D Logo"
                        width={1277}
                        height={644}
                        className={styles.graphInfo}
                    />
                </div>


            </div>
            <Image
                src="/introPhoto3.svg"
                alt="MAKER 3D Logo"
                width={1600}
                height={689}
                className={styles.introPhoto3}
            />


            <div className={styles.innerContainer}>
                <div className={styles.buttonWrapper}>
                    <div className={styles.button}>
                        <p className={styles.buttonTitle}>3D프린팅코리아엑스포 홈페이지</p>
                        <Image
                            src="/arrow-right.svg"
                            alt="MAKER 3D Logo"
                            width={32}
                            height={32}
                        />

                    </div>
                    <div className={styles.button}>
                        <p className={styles.buttonTitle}>스토어 바로가기</p>
                        <Image
                            src="/arrow-right.svg"
                            alt="MAKER 3D Logo"
                            width={32}
                            height={32}
                        />

                    </div>
                </div>

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
                    <p className={styles.info}>경상북도 구미시 수출대로 225-40 ㈜비트텍</p>
                </div>
                <div className={styles.thinLine}></div>
                <div className={styles.addressWrapper}>
                    <p className={styles.address}>TEL / E mail</p>
                    <p className={styles.info}>054-461-4140 / jjy2882@bittech3d.com</p>
                </div>
                <div className={styles.thinLine}></div>
                <div className={styles.emptySpace}></div>


            </div>
        </div>
    );
}
