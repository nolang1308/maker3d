import styles from './ScrollArrow.module.scss';

/** 아래로 내려 보라는 화살표: 세 개의 꺾쇠가 위에서부터 차례로 밝아진다 */
export default function ScrollArrow() {
  return (
    <svg className={styles.scrollArrow} width="23" height="50" viewBox="0 0 23 50" fill="none" role="img" aria-label="아래로 스크롤">
      <path d="M22.2986 0V6.68957L10.9015 18.4582L10.406 17.9627L0 7.06121V0.371643L10.6538 11.5209L22.2986 0Z" fill="#2493D8" />
      <path d="M22.2986 15.6094V22.2989L10.9015 34.0676L10.406 33.5721L0 22.7945V16.1049L10.6538 27.2542L22.2986 15.6094Z" fill="#2493D8" />
      <path d="M22.2986 31.3438V38.0333L10.9015 49.802L10.406 49.3065L0 38.405V31.7154L10.6538 42.8647L22.2986 31.3438Z" fill="#2493D8" />
    </svg>
  );
}
