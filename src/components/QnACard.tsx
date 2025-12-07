'use client';

import { useState } from 'react';
import styles from './QnACard.module.scss';

interface QnACardProps {
  question: string;
  answer: string;
  date: string;
}

export default function QnACard({ question, answer, date }: QnACardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const truncatedAnswer = answer.length > 80 ? answer.slice(0, 80) + '...' : answer;

  return (
    <div className={styles.qnaCard} onClick={toggleExpanded}>
      <div className={styles.questionSection}>
        <h3 className={`${styles.question} ${isExpanded ? styles.questionExpanded : ''}`}>Q. {question}</h3>
      </div>
      <div className={styles.answerSection}>
        <p className={styles.answer}>
          {isExpanded ? answer : truncatedAnswer}
        </p>
        <div className={styles.date}>{date}</div>
      </div>
    </div>
  );
}