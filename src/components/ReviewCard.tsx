import styles from './ReviewCard.module.scss';
import Image from "next/image";

interface ReviewCardProps {
  review: string;
  name: string;
}

const ReviewCard = ({ review, name }: ReviewCardProps) => {
  const formatName = (fullName: string) => {
    if (!fullName) return '';
    
    const firstChar = fullName.charAt(0);
    const restChars = 'X'.repeat(fullName.length - 1);
    
    return `${firstChar}${restChars}`;
  };

  return (
    <div className={styles.reviewCard}>
      <div className={styles.columnLine}></div>
      <p className={styles.reviewText}>{review}</p>
      <Image
          src="/reviewMark.svg"
          alt="MAKER 3D Logo"
          width={95}
          height={75}
          style={{position: 'absolute', top: '230px', left: '513px' }}
      />
        <div className={styles.profileImage}></div>
        <div className={styles.userName}>{formatName(name)} 고객님</div>
        <Image
            src="/star.svg"
            alt="MAKER 3D Logo"
            width={96}
            height={16}
            style={{position: 'absolute', top: '279px', left: '108px' }}

        />
    </div>
  );
};

export default ReviewCard;