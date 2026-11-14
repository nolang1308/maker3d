'use client';

import { Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.scss';
import Reveal from '@/components/Reveal';
import { useParallax } from '@/components/useParallax';
import {
    ALL_CATEGORY_ID,
    ALL_QUESTIONS,
    findQuestion,
    GUIDE_CATEGORIES,
    POPULAR_KEYWORDS,
    searchQuestions,
    type GuideQuestion,
    type LocatedQuestion,
} from './guideData';

const TALK_URL = 'https://talk.naver.com/ct/w4e4gt?frm=psf';
const DEFAULT_CATEGORY = GUIDE_CATEGORIES[0].id;

/** 가이드의 왼쪽 분류: 기존 분류 뒤에 "전체"를 덧붙인다 */
const CATEGORY_TABS = [
    ...GUIDE_CATEGORIES.map((category) => ({ id: category.id, name: category.name, count: category.questions.length })),
    { id: ALL_CATEGORY_ID, name: '전체 질문', count: ALL_QUESTIONS.length },
];

/** 검색창이 비어 있을 때 번갈아 보여주는 안내 */
const SEARCH_HINTS = ['모든 질문과 답변에서 검색하세요', '예) 최대 출력 사이즈', '예) 소재별 차이', '예) 세금계산서', '예) 배송'];

/** 머리 부분의 대화 그림에 번갈아 나오는 문답. 누르면 그 질문이 열린다 (답은 가이드의 내용을 줄인 것) */
const HERO_TALKS = [
    { questionId: 1, ask: '최대 몇 mm까지 출력되나요?', reply: '360 × 360 × 360 mm 까지 가능해요' },
    { questionId: 2, ask: '1개만 주문해도 되나요?', reply: '네, 1개부터 제작합니다' },
    { questionId: 11, ask: '3D 모델링 파일이 없어요', reply: '설계부터 도와드려요' },
    { questionId: 14, ask: '언제 받을 수 있나요?', reply: '보통 2~4일 뒤에 출하돼요' },
];
const HERO_TALK_MS = 5200;

// ---------------------------------------------------------------------------
// 아이콘
// ---------------------------------------------------------------------------

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
    </svg>
);
const ChatIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z" />
        <path d="M8.5 10.8h.01M12 10.8h.01M15.5 10.8h.01" />
    </svg>
);
const PhoneIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5z" />
    </svg>
);
const MailIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <path d="M4 7l8 6 8-6" />
    </svg>
);
const ArrowIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
    </svg>
);

// ---------------------------------------------------------------------------
// 답변 본문: 빈 줄은 문단, "| a | b |" 는 표
// ---------------------------------------------------------------------------

function renderFormattedText(text: string): ReactNode {
    return text.split('\n').map((line, lineIndex) => {
        if (line.startsWith('**') && line.endsWith('**')) {
            return <h4 key={lineIndex}>{line.slice(2, -2)}</h4>;
        }
        if (line.startsWith('• ')) {
            return (
                <p key={lineIndex} className={styles.bullet}>
                    {line}
                </p>
            );
        }
        const parts = line
            .split(/(\*\*.*?\*\*)/g)
            .map((part, partIndex) =>
                part.startsWith('**') && part.endsWith('**') ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : part,
            );
        return <p key={lineIndex}>{parts}</p>;
    });
}

function renderTable(tableLines: string[], key: number): ReactElement | null {
    if (tableLines.length < 2) return null;
    const cells = (line: string) =>
        line
            .split('|')
            .map((cell) => cell.trim())
            .filter((cell) => cell !== '');
    const headers = cells(tableLines[0]);
    const dataStart = tableLines[1].includes('---') ? 2 : 1;
    const rows = tableLines
        .slice(dataStart)
        .map(cells)
        .filter((row) => row.length > 0);
    return (
        <div key={`table-${key}`} className={styles.tableWrap}>
            <table>
                <thead>
                    <tr>
                        {headers.map((header, index) => (
                            <th key={index}>{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function renderAnswerContent(answer: string): ReactElement[] {
    const lines = answer.split('\n');
    const elements: ReactElement[] = [];
    let tableLines: string[] = [];
    let paragraph: string[] = [];
    const flushParagraph = (key: string) => {
        if (paragraph.length === 0) return;
        elements.push(<div key={key}>{renderFormattedText(paragraph.join('\n'))}</div>);
        paragraph = [];
    };
    const flushTable = (key: number) => {
        if (tableLines.length === 0) return;
        const table = renderTable(tableLines, key);
        if (table) elements.push(table);
        tableLines = [];
    };

    lines.forEach((raw, i) => {
        const line = raw.trim();
        if (line.includes('|') && line.split('|').length > 2) {
            flushParagraph(`p-${i}`);
            tableLines.push(line);
            return;
        }
        flushTable(i);
        if (line === '') flushParagraph(`p-${i}`);
        else paragraph.push(line);
    });
    flushTable(lines.length);
    flushParagraph('p-final');
    return elements;
}

/** 질문 글에서 검색어와 같은 부분을 표시한다 */
function highlight(text: string, term: string): ReactNode {
    const needle = term.trim();
    if (!needle) return text;
    const at = text.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0) return text;
    return (
        <>
            {text.slice(0, at)}
            <mark>{text.slice(at, at + needle.length)}</mark>
            {text.slice(at + needle.length)}
        </>
    );
}

// ---------------------------------------------------------------------------
// 머리 부분의 대화 그림: 실제 가이드의 문답이 번갈아 나온다
// ---------------------------------------------------------------------------

function HeroTalk({ onOpen }: { onOpen: (questionId: number) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    useParallax(ref);

    useEffect(() => {
        if (paused) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const timer = setInterval(() => setIndex((i) => (i + 1) % HERO_TALKS.length), HERO_TALK_MS);
        return () => clearInterval(timer);
    }, [paused]);

    const talk = HERO_TALKS[index];
    return (
        <div
            ref={ref}
            className={styles.heroTalk}
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
        >
            <span className={`${styles.heroShape} ${styles.heroShapeRing}`} aria-hidden="true" />
            <span className={`${styles.heroShape} ${styles.heroShapeDot}`} aria-hidden="true" />
            <span className={`${styles.heroShape} ${styles.heroShapeCube}`} aria-hidden="true" />
            {/* 문답이 바뀔 때마다 새로 그려서 말풍선이 차례로 다시 나타나게 한다 */}
            <button
                key={index}
                type="button"
                className={styles.heroBubbles}
                onClick={() => onOpen(talk.questionId)}
                aria-label={`가이드에서 보기: ${talk.ask}`}
            >
                <span className={styles.bubbleAsk}>{talk.ask}</span>
                <span className={styles.bubbleTyping} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                </span>
                <span className={styles.bubbleReply}>
                    <span className={styles.bubbleName}>Maker 3D</span>
                    {talk.reply}
                    <span className={styles.bubbleMore}>
                        자세히 보기 <ArrowIcon />
                    </span>
                </span>
            </button>
            <div className={styles.heroDots} aria-hidden="true">
                {HERO_TALKS.map((item, i) => (
                    <span key={item.questionId} className={i === index ? styles.heroDotOn : ''} />
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------

function ContactContent() {
    const [activeCategory, setActiveCategory] = useState(DEFAULT_CATEGORY);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [hintIndex, setHintIndex] = useState(0);
    const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
    const searchParams = useSearchParams();

    const searchRef = useRef<HTMLInputElement>(null);
    const guideRef = useRef<HTMLDivElement>(null);
    const centerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const categoryListRef = useRef<HTMLDivElement>(null);
    const pillRef = useRef<HTMLSpanElement>(null);

    // 열려 있는 질문은 주소(?questionId=)가 정한다: 링크로 바로 열 수 있고, 뒤로 가기로 목록에 돌아온다
    const selectedQuestion = findQuestion(Number(searchParams.get('questionId')));
    const searching = searchTerm.trim() !== '';
    // 질문이 열려 있으면 그 질문의 분류를, 검색 중이면 아무 분류도 고르지 않은 것으로 보여준다
    const shownCategory = selectedQuestion ? selectedQuestion.categoryId : searching ? null : activeCategory;

    const questions: LocatedQuestion[] = searching
        ? searchQuestions(searchTerm)
        : activeCategory === ALL_CATEGORY_ID
          ? ALL_QUESTIONS
          : ALL_QUESTIONS.filter((question) => question.categoryId === activeCategory);
    const showCategoryTag = searching || activeCategory === ALL_CATEGORY_ID;

    const setQuestionInUrl = (questionId: number | null) => {
        window.history.pushState(null, '', questionId === null ? window.location.pathname : `?questionId=${questionId}`);
    };

    /** 답이 목록보다 위에서 시작하면 그 자리가 보이도록 올린다 */
    const bringContentIntoView = () => {
        requestAnimationFrame(() => {
            const el = contentRef.current;
            if (el && el.getBoundingClientRect().top < 90) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    const openQuestion = (question: GuideQuestion) => {
        setQuestionInUrl(question.id);
        bringContentIntoView();
    };

    const handleBackToList = () => {
        // 링크로 바로 들어온 경우에도 그 질문이 속한 분류의 목록으로 돌아간다
        if (selectedQuestion && !searching) setActiveCategory(selectedQuestion.categoryId);
        setQuestionInUrl(null);
        bringContentIntoView();
    };

    const handleCategorySelect = (categoryId: string) => {
        setActiveCategory(categoryId);
        setSearchTerm('');
        if (selectedQuestion) setQuestionInUrl(null);
    };

    const runSearch = (term: string) => {
        setSearchTerm(term);
        if (selectedQuestion) setQuestionInUrl(null);
    };

    const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const openGuideFromHero = (questionId: number) => {
        setSearchTerm('');
        setQuestionInUrl(questionId);
        scrollTo(guideRef.current);
    };

    const notify = (text: string) => setToast({ id: Date.now(), text });

    const handleShare = async (question: GuideQuestion) => {
        const url = `${window.location.origin}/contact?questionId=${question.id}`;
        try {
            await navigator.clipboard.writeText(url);
            notify('링크가 복사됐습니다');
        } catch {
            notify('링크를 복사하지 못했어요. 주소창의 주소를 복사해 주세요.');
        }
    };

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2200);
        return () => clearTimeout(timer);
    }, [toast]);

    // 검색창이 비어 있고 쓰고 있지 않을 때만 안내 문구를 번갈아 보여준다
    const hintRunning = !searching && !searchFocused;
    useEffect(() => {
        if (!hintRunning) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const timer = setInterval(() => setHintIndex((i) => (i + 1) % SEARCH_HINTS.length), 2600);
        return () => clearInterval(timer);
    }, [hintRunning]);

    // 고른 분류 뒤의 색 띠를 그 자리로 미끄러지게 옮긴다 (분류가 바뀌거나 줄바꿈이 달라질 때)
    useLayoutEffect(() => {
        const list = categoryListRef.current;
        const pill = pillRef.current;
        if (!list || !pill) return;
        const place = () => {
            const active = list.querySelector<HTMLElement>('[aria-pressed="true"]');
            if (!active) {
                pill.style.opacity = '0';
                return;
            }
            pill.style.opacity = '1';
            pill.style.width = `${active.offsetWidth}px`;
            pill.style.height = `${active.offsetHeight}px`;
            pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
        };
        place();
        const observer = new ResizeObserver(place);
        observer.observe(list);
        return () => observer.disconnect();
    }, [shownCategory]);

    // 좁은 화면에서는 분류가 옆으로 넘기는 한 줄이라, 고른 분류가 보이는 자리로 끌어온다
    useEffect(() => {
        const list = categoryListRef.current;
        const active = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (!list || !active || list.scrollWidth <= list.clientWidth) return;
        list.scrollTo({ left: active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
    }, [shownCategory]);

    const related = selectedQuestion
        ? ALL_QUESTIONS.filter(
              (question) => question.categoryId === selectedQuestion.categoryId && question.id !== selectedQuestion.id,
          ).slice(0, 4)
        : [];

    return (
        <div className={styles.container}>
            {toast && (
                <div key={toast.id} className={styles.toast} role="status">
                    {toast.text}
                </div>
            )}
            <div className={styles.contactContainer}>
                {/* ---------------- 머리 부분 ---------------- */}
                <div className={styles.hero}>
                    <div className={styles.heroText}>
                        <p className={styles.title_1}>안녕하세요?</p>
                        <p className={styles.title_2}>Maker 3D는 고객 입장으로 생각합니다.</p>
                        <p className={styles.title_3}>무엇을 도와드릴까요?</p>

                        <div className={styles.quickRow}>
                            <button
                                type="button"
                                className={`${styles.quickButton} ${styles.quickPrimary}`}
                                onClick={() => {
                                    scrollTo(guideRef.current);
                                    searchRef.current?.focus({ preventScroll: true });
                                }}
                            >
                                <SearchIcon />
                                가이드에서 찾기
                            </button>
                            <a className={styles.quickButton} href={TALK_URL} target="_blank" rel="noopener noreferrer">
                                <ChatIcon />
                                1:1 문의
                            </a>
                            <button type="button" className={styles.quickButton} onClick={() => scrollTo(centerRef.current)}>
                                <PhoneIcon />
                                전화 · 메일
                            </button>
                        </div>
                    </div>
                    <HeroTalk onOpen={openGuideFromHero} />
                </div>
                <div className={styles.line}></div>

                {/* ---------------- 가이드 ---------------- */}
                <div ref={guideRef} className={styles.guideSection}>
                    <Reveal>
                        <h2 className={styles.guideTitle}>가이드</h2>

                        <div className={styles.searchBox}>
                            <div className={`${styles.searchField} ${searchFocused ? styles.searchFocused : ''}`}>
                                <span className={styles.searchIcon}>
                                    <SearchIcon />
                                </span>
                                <input
                                    ref={searchRef}
                                    type="search"
                                    className={styles.searchInput}
                                    aria-label="가이드 검색: 모든 질문과 답변에서 찾습니다"
                                    value={searchTerm}
                                    onChange={(e) => runSearch(e.target.value)}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setSearchFocused(false)}
                                    enterKeyHint="search"
                                />
                                {searchTerm === '' && (
                                    <span key={hintIndex} className={styles.searchHint} aria-hidden="true">
                                        {SEARCH_HINTS[hintIndex]}
                                    </span>
                                )}
                                {searchTerm !== '' && (
                                    <button
                                        type="button"
                                        className={styles.searchClear}
                                        aria-label="검색어 지우기"
                                        onClick={() => {
                                            runSearch('');
                                            searchRef.current?.focus();
                                        }}
                                    >
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M6 6l12 12M18 6L6 18" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className={styles.keywordRow}>
                            <span className={styles.keywordLabel}>많이 찾는 검색어</span>
                            {POPULAR_KEYWORDS.map((keyword, i) => (
                                <button
                                    key={keyword}
                                    type="button"
                                    aria-pressed={searchTerm === keyword}
                                    className={`${styles.keyword} ${searchTerm === keyword ? styles.keywordOn : ''}`}
                                    style={{ '--i': i } as CSSProperties}
                                    onClick={() => runSearch(searchTerm === keyword ? '' : keyword)}
                                >
                                    #{keyword}
                                </button>
                            ))}
                        </div>
                    </Reveal>

                    <Reveal delay={0.12}>
                        <div className={styles.guideContent}>
                            <div ref={categoryListRef} className={styles.categoryList}>
                                <span ref={pillRef} className={styles.categoryPill} aria-hidden="true" />
                                {CATEGORY_TABS.map((category) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        aria-pressed={shownCategory === category.id}
                                        className={`${styles.categoryButton} ${shownCategory === category.id ? styles.active : ''}`}
                                        onClick={() => handleCategorySelect(category.id)}
                                    >
                                        {category.name}
                                        <span className={styles.categoryCount}>{category.count}</span>
                                    </button>
                                ))}
                            </div>

                            <div ref={contentRef} className={styles.questionContent}>
                                {selectedQuestion ? (
                                    <div key={selectedQuestion.id} className={styles.questionDetail}>
                                        <button type="button" className={styles.backButton} onClick={handleBackToList}>
                                            ← 질문목록
                                        </button>

                                        <div className={styles.questionDetailContent}>
                                            <span className={styles.detailCategory}>{selectedQuestion.categoryName}</span>
                                            <h3 className={styles.detailQuestion}>{selectedQuestion.question}</h3>

                                            <div className={styles.questionTags}>
                                                {selectedQuestion.keywords?.map((keyword) => (
                                                    <button
                                                        key={keyword}
                                                        type="button"
                                                        className={styles.tag}
                                                        title={`'${keyword}' 로 검색`}
                                                        onClick={() => runSearch(keyword)}
                                                    >
                                                        #{keyword}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className={styles.answerSection}>
                                                <div className={styles.answerContent}>
                                                    {renderAnswerContent(selectedQuestion.answer)}
                                                </div>

                                                <div className={styles.answerActions}>
                                                    <p className={styles.answerHelp}>
                                                        더 궁금한 점은{' '}
                                                        <a href={TALK_URL} target="_blank" rel="noopener noreferrer">
                                                            1:1 문의
                                                        </a>
                                                        로 물어봐 주세요.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className={styles.shareButton}
                                                        onClick={() => handleShare(selectedQuestion)}
                                                    >
                                                        공유
                                                    </button>
                                                </div>
                                            </div>

                                            {related.length > 0 && (
                                                <div className={styles.related}>
                                                    <p className={styles.relatedTitle}>같은 분류의 다른 질문</p>
                                                    {related.map((question) => (
                                                        <button
                                                            key={question.id}
                                                            type="button"
                                                            className={styles.relatedItem}
                                                            onClick={() => openQuestion(question)}
                                                        >
                                                            <span className={styles.relatedQ}>Q</span>
                                                            {question.question}
                                                            <ArrowIcon />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {searching && (
                                            <p className={styles.resultSummary} role="status">
                                                <strong>&lsquo;{searchTerm.trim()}&rsquo;</strong> 검색 결과{' '}
                                                <strong>{questions.length}개</strong>
                                                <span>모든 분류에서 찾았습니다</span>
                                            </p>
                                        )}
                                        {questions.length > 0 ? (
                                            // 분류를 바꾸면 목록을 새로 그려 차례로 나타나게 하고, 검색 중에는 새로 걸린 질문만 나타나게 한다
                                            <div key={searching ? 'search' : activeCategory} className={styles.questionList}>
                                                {questions.map((question, i) => (
                                                    <button
                                                        key={question.id}
                                                        type="button"
                                                        className={styles.questionItem}
                                                        style={{ '--i': Math.min(i, 8) } as CSSProperties}
                                                        onClick={() => openQuestion(question)}
                                                    >
                                                        <span className={styles.questionIcon}>Q</span>
                                                        <span className={styles.questionBody}>
                                                            <span className={styles.questionText}>
                                                                {highlight(question.question, searchTerm)}
                                                            </span>
                                                            {showCategoryTag && (
                                                                <span className={styles.categoryTag}>{question.categoryName}</span>
                                                            )}
                                                        </span>
                                                        <span className={styles.questionArrow}>
                                                            <ArrowIcon />
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={styles.emptyResult}>
                                                <p className={styles.emptyTitle}>찾는 내용이 없어요</p>
                                                <p className={styles.emptyText}>
                                                    다른 낱말로 검색하거나, 1:1 문의로 바로 물어봐 주세요.
                                                </p>
                                                <div className={styles.emptyActions}>
                                                    <button type="button" className={styles.emptyButton} onClick={() => runSearch('')}>
                                                        검색어 지우기
                                                    </button>
                                                    <a
                                                        className={`${styles.emptyButton} ${styles.emptyPrimary}`}
                                                        href={TALK_URL}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        1:1 문의하기
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </Reveal>
                </div>

                {/* 고객 질문(Q&A) 목록 자리 — 아직 쓰지 않는다. 쓰게 되면 QnACard 로 보여준다 (스타일 .qnaSection · .qnaList 는 남겨 두었다):
                <div className={styles.qnaSection}>
                    <div className={styles.qnaList}>
                        {qnaData.map((qna, index) => (
                            <QnACard key={index} question={qna.question} answer={qna.answer} date={qna.date} />
                        ))}
                    </div>
                </div>
                */}

                {/* ---------------- 고객센터 ---------------- */}
                <div ref={centerRef} className={styles.centerAnchor}>
                    <Reveal plain className={styles.customerServiceSection}>
                        <div className={styles.serviceHeader}>
                            <span className={styles.serviceTitle}>고객센터</span>
                            <span className={styles.serviceTime}>08:00 ~ 18:00</span>
                        </div>

                        <div className={styles.serviceContent}>
                            <div className={styles.contactInfo}>
                                <a className={styles.contactItem} href="mailto:3dstore@bittech3d.com">
                                    <span className={styles.contactIcon}>
                                        <MailIcon />
                                    </span>
                                    <span className={styles.contactLabel}>E-Mail</span>
                                    <span className={styles.contactValue}>3dstore@bittech3d.com</span>
                                </a>
                                <a className={styles.contactItem} href="tel:054-462-4140">
                                    <span className={styles.contactIcon}>
                                        <PhoneIcon />
                                    </span>
                                    <span className={styles.contactLabel}>상담문의</span>
                                    <span className={styles.contactValue}>054-462-4140</span>
                                </a>
                                <a className={styles.contactItem} href="tel:010-4141-2882">
                                    <span className={styles.contactIcon}>
                                        <PhoneIcon />
                                    </span>
                                    <span className={styles.contactLabel}>기술문의</span>
                                    <span className={styles.contactValue}>010-4141-2882</span>
                                </a>
                            </div>

                            <div className={styles.serviceButtons}>
                                <button className={styles.consultButton} onClick={() => window.open(TALK_URL, '_blank')}>
                                    <ChatIcon />
                                    1:1 문의
                                </button>
                                <span className={styles.consultNote}>네이버 톡톡으로 연결됩니다</span>
                            </div>
                        </div>

                        <div className={styles.serviceNotice}>
                            <div className={styles.noticeItem}>• 주말/공휴일에는 원활한 상담이 어려울 수 있습니다.</div>
                            <div className={styles.noticeItem}>
                                • 점심시간(11:30 ~ 12:30)에도 고객센터는 운영하나, 원활하지 않을 수 있습니다.
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </div>
    );
}

export default function ContactPage() {
    return (
        <Suspense>
            <ContactContent />
        </Suspense>
    );
}
