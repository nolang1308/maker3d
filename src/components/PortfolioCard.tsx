import styles from './PortfolioCard.module.scss';
import { useRouter } from 'next/navigation';

interface PortfolioCardProps {
    id: string;
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
                <img
                    src={imageUrl}
                    alt={title}
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