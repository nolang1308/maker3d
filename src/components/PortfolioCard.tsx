import styles from './PortfolioCard.module.scss';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface PortfolioCardProps {
    id: number;
    title: string;
    imageUrl: string;
    date: string;
}

export default function PortfolioCard({ id, title, imageUrl, date }: PortfolioCardProps) {
    const router = useRouter();
    
    const handleClick = () => {
        router.push(`/portfolio/${id}`);
    };
    
    return (
        <div className={styles.portfolioCard} onClick={handleClick}>
            <div className={styles.imageWrapper}>
                <Image
                    src={imageUrl}
                    alt={title}
                    width={400}
                    height={300}
                    className={styles.portfolioImage}
                />
            </div>
            <div className={styles.contentWrapper}>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.date}>{date}</p>
            </div>
        </div>
    );
}