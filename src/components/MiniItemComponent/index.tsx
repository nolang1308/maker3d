'use client';

import styles from './index.module.scss';
import Image from 'next/image';

interface MiniItemComponentProps {
    image: string;
    title: string;
    originalPrice: number;
    discountRate: number;
    finalPrice: number;
    onClick?: () => void;
}

export default function MiniItemComponent({
    image,
    title,
    originalPrice,
    discountRate,
    finalPrice,
    onClick
}: MiniItemComponentProps) {
    return (
        <div className={styles.container} onClick={onClick}>
            <div className={styles.imageWrapper}>
                <Image
                    src={image}
                    alt={title}
                    width={150}
                    height={150}
                    className={styles.productImage}
                />
            </div>
            <div className={styles.contentWrapper}>
                <h3 className={styles.title}>{title}</h3>
                <div className={styles.priceWrapper}>
                    <span className={styles.discountRate}>{discountRate}%</span>
                    <span className={styles.finalPrice}>{finalPrice.toLocaleString()}원</span>
                    <Image
                        src={'/cart_icon.svg'}
                        alt={``}
                        width={20}
                        height={20}
                        className={styles.cartIcon}
                    />
                </div>
            </div>
        </div>
    );
}