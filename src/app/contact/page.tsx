'use client';

import { useState, ReactElement } from 'react';
import styles from './page.module.scss';
import QnACard from '@/components/QnACard';

interface GuideQuestion {
    id: number;
    question: string;
    answer: string;
    keywords?: string[];
}

interface GuideCategory {
    id: string;
    name: string;
    questions: GuideQuestion[];
}

export default function ContactPage() {
    const [activeCategory, setActiveCategory] = useState('질문TOP');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedItems, setExpandedItems] = useState<number[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<GuideQuestion | null>(null);

    const guideCategories: GuideCategory[] = [
        {
            id: '질문TOP',
            name: '질문TOP',
            questions: [
                {
                    id: 1,
                    question: '최대 출력 사이즈가 어떻게 되나요?',
                    answer: '현재 저희가 보유중은 3D프린터 최대 출력 사이즈는 360 x 360 x 360 mm입니다.\n\n형상에 따라 다르나, +/- 5mm 정도로 보시면 됩니다.\n\n이 크기를 초과할 시에는 분할 출력 후, 접합하는 방식으로 진행되어야 합니다.\n\n접합은 일반 강력접착제로 충분합니다.',
                    keywords: ['최대출력', '사이즈', '크기']
                },
                {
                    id: 2,
                    question: '몇 개부터 제작이 가능하나요?',
                    answer: '최소 주문수량(MOQ)은 없습니다.\n\n크기에 상관없이 1개도 제작이 가능합니다.\n\n많은 장비를 보유하고 있어, 대량생산까지도 가능합니다.\n\n대량생산시에는 단가를 할인해드리고 있습니다.',
                    keywords: ['최소주문', 'MOQ', '대량생산']
                },
                {
                    id: 3,
                    question: '실시간 견적 확인의 금액으로 결제하나요?',
                    answer: '실시간 견적 확인은 프로그램 상에서 자동으로 계상되는 금액으로, 실제 견적과는 차이가 있습니다.\n\n실시간 견적에 적용된 프로그램에는 디테일한 3D프린팅 세팅값이 반영되지 않아, 반드시 실시간 견적 확인 이후에 전문가와 상담을 통해 정확한 출력 안내와 견적을 전달받으신 후에 결제를 해주셔야 합니다.',
                    keywords: ['실시간견적', '결제', '상담']
                },
                {
                    id: 4,
                    question: '대량생산이 가능한가요?',
                    answer: '네 물론 가능합니다.\n\nMaker 3D 는 많은 장비를 보유하고 있어, 대량생산이 가능하며, 상담을 통해 납기일자를 안내해주시면 가능 여부를 안내드리고 있습니다.\n\n대량생산 시에는 단가를 할인해드립니다.',
                    keywords: ['대량생산', '장비', '할인']
                }
            ]
        },
        {
            id: '재료가이드',
            name: '재료가이드',
            questions: [
                {
                    id: 5,
                    question: '소재별로 차이를 알고싶습니다.',
                    answer: '| 소재명 | 상세 설명 |\n|--------|----------|\n| PLA(고강도) | 저희는 일반 PLA가 아닌, 고강도 PLA를 사용하고 있습니다. 고강도 PLA는 강성이 높으며, 출력품질이 가장 우수하게 나옵니다. 열변형점은 50~60도 사이이며, 높은 온도에 꾸준히 노출되는게 아니라면, PLA(고강도)가 가장 좋습니다. |\n| ABS | ABS는 높은 내열성을 지닌 소재입니다. 출력품질은 보통수준이며, 열변형점은 70~80도입니다. 높은 온도에 꾸준히 노출되는 출력물이라면 ABS 소재가 적합합니다. |\n| PETG | PETG 소재는 PLA와 ABS 중간에 위치한 소재입니다. 출력품질은 보통수준이며, 열변형점은 60~70도 사이입니다. |\n| PC | PC 소재는 높은 내열성과 강성을 지니고 있으며, 다른 소재와 비교하여 단가가 높습니다. 열변형점은 90도 이며, 출력품질은 보통 수준입니다. |\n| 레진 | 피규어나 캐릭터와 같이 곡선이 많은 형태의 출력물을 출력하는데 가장 적합한 소재입니다. 다만, 높은 위치에서 떨어뜨렸을 때, 플라스틱과 다르게 깨지기 쉽습니다. |\n\n위 소재 외에 다른 소재도 진행하고 있으며, 상담과정에서 요청하시면 안내드립니다.',
                    keywords: ['소재', '재료', 'PLA', 'ABS', 'PETG', 'PC', '레진']
                }
            ]
        },
        {
            id: '대형 및 대량 가이드',
            name: '대형 및 대량 가이드',
            questions: [
                {
                    id: 6,
                    question: '출력물 크기 수정이 되나요?',
                    answer: '가로, 세로, 높이 사이즈를 정확히 안내해주시면 크기 수정이 가능합니다.\n\n가로, 세로, 높이 사이즈를 모르셔도 1.5배, 2배 정도 크기를 키우거나 줄여달라고 해도 원 비율을 유지한채로 크기 수정이 가능합니다.\n\n다만, 파츠 내 일부분의 크기를 수정하셔야 할 때는 설계가 수정되어야 하기에 별도의 설계수정비용이 발생할 수 있습니다.',
                    keywords: ['크기수정', '비율', '설계']
                },
                {
                    id: 7,
                    question: '조립되는 파츠인데 공차는 어떻게 해야하나요?',
                    answer: '조립되는 파츠인 경우 공차가 반드시 적용되어야 합니다. 아래를 참조하시어 설정하시면 됩니다.\n\n| 공차 | 조립 특성 |\n|------|----------|\n| 0.1~0.2mm | 레고 조립과 같이 뻑뻑하게 조립되는 정도 |\n| 0.3mm | 뻑뻑한 느낌없이 부드럽게 조립되는 정도 |\n| 0.4mm | 헐렁하게 조립되는 정도 |',
                    keywords: ['공차', '조립', '결합']
                }
            ]
        },
        {
            id: '출력가이드',
            name: '출력가이드',
            questions: [
                {
                    id: 8,
                    question: '출력이 안되는 경우가 있을까요?',
                    answer: 'FDM 방식으로 출력하는 경우, 너무 얇으면 출력이 되지 않습니다.\n\n최소 0.4mm의 두께나 길이가 나와야 하며, 높은 품질을 위해 권장드리는 치수는 최소 1mm입니다.\n\n얇으면 얇을수록 강성이 떨어져 파손 위험이 높다는 점 참고바랍니다.',
                    keywords: ['출력불가', '최소두께', 'FDM']
                },
                {
                    id: 9,
                    question: '서포터가 뭐에요?',
                    answer: '서포터란, 출력중에 발생되는 지지대입니다.\n\nFDM 방식은 아래에서부터 소재를 쌓아 적층을 통해 제작하는 방식입니다.\n\n서있는 사람을 출력한다고 예를 들었을 때, 다리부분은 땅과 닿아있어 출력이 되지만, 손부분은 땅에서부터 떨어진 상태입니다.\n\n이 손을 출력하기 위해 바닥에서부터 손까지 서포터(지지대)가 발생합니다.\n\n출력물을 안정되게 출력할 수 있도록 도움을 주는게 서포터(지지대)입니다.\n\n서포터는 저희가 무료로 모두 제거해드리나, 제거하기 어려운 부분은 그대로 출하됩니다.\n\n서포터가 제거된 면은 다른 면에 비해 품질이 조금 떨어진다는 점 참고바랍니다.',
                    keywords: ['서포터', '지지대', '적층']
                },
                {
                    id: 10,
                    question: '적층결(물결무늬)이 뭐에요?',
                    answer: 'FDM 방식은 아래에서부터 소재를 적층하여 쌓아올려 제작하는 방식입니다.\n\n이로인해, 출력물에 적층결이 보일 수 있습니다.\n\nMaker 3D는 최고의 장비를 엄선해 사용하여 적층결을 눈에 띄지 않게끔 서비스를 진행하고 있으나, 어느정도는 육안으로 확인이 됩니다.\n\n이는 후가공을 통해서만 없앨 수 있으며, 구형태는 적층결이 크게 보이는 편입니다.',
                    keywords: ['적층결', '물결무늬', '후가공']
                }
            ]
        },
        {
            id: '모델링가이드',
            name: '모델링가이드',
            questions: [
                {
                    id: 11,
                    question: '3D모델링파일(STL, STEP, OBJ 등)이 없이도 의뢰가 되나요?',
                    answer: '네 가능합니다.\n\n3D모델링파일이 없는 경우, 설계부터 출력(제작)까지 모두 도와드리고 있으며, 설계비용과 출력비용이 각각 발생합니다.\n\n상담과정에서 3D모델링파일이 없다고 말씀주시면 자세한 안내 도와드립니다.',
                    keywords: ['3D모델링', 'STL', '설계']
                },
                {
                    id: 12,
                    question: '데이터가 업로드 되지 않습니다.',
                    answer: '데이터 용량이 크거나, 파일에 문제가 있거나 하는 이유로 데이터가 업로드되지 않는 경우, 3dstore@bittech3d.com 으로 파일을 보내주시면, 파일 확인 후 자세한 안내 도와드립니다.',
                    keywords: ['업로드', '데이터', '파일']
                }
            ]
        },
        {
            id: '결제 가이드',
            name: '결제 가이드',
            questions: [
                {
                    id: 13,
                    question: '세금계산서 발행이 가능한가요?',
                    answer: '네 가능합니다.\n\n상담과정에서 세금계산서 발행을 요청하시면, 자세하게 안내드리고 있습니다.\n\n계산서 발행에 필요한 사업자등록증과 계산서 발행 메일을 안내해주시면 발행을 도와드리며, 고객님께서 필요한 자료는 상담과정에서 말씀주시면 모두 준비해서 메일로 보내드리고 있습니다.',
                    keywords: ['세금계산서', '발행', '사업자등록증']
                }
            ]
        },
        {
            id: '고객 지원 가이드',
            name: '고객 지원 가이드',
            questions: [
                {
                    id: 14,
                    question: '출하는 어떻게 진행되나요?',
                    answer: '보통은 한진택배를 통해 출하되며, 13:00 이전 주문건에 한해, 출하는 휴일을 제외하고 2~4일정도 소요됩니다.\n\n출력물 크기나 수량에 따라 출하일은 달라질 수 있으며, 선 주문건부터 출력이 진행되기에 주문이 많으면 출하일이 조금은 변동될 수 있습니다.\n\n일반 택배 외에 다른 수령방법을 원하시는 경우, 사전에 말씀주시면 확인 도와드립니다.\n\n긴급으로 받아야 되는 건은 상담과정에서 말씀주시면 스케줄 확인 후 자세한 안내드립니다.',
                    keywords: ['출하', '배송', '택배']
                },
                {
                    id: 15,
                    question: '후가공은 어떻게 진행되나요?',
                    answer: '현재 Maker 3D 는 출력중에 발생하는 서포터(지지대)를 무료로 제거해드리는 것 외의 후가공(도색, 표면처리 등)은 따로 서비스하고 있지 않습니다.',
                    keywords: ['후가공', '서포터제거', '도색']
                }
            ]
        }
    ];

    const qnaData = [
        {
            question: "테스트 질문입니다. 테스트 질문입니다.",
            answer: "테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. ",
            date: "00.00.00"
        },
        {
            question: "테스트 질문입니다. 테스트 질문입니다.",
            answer: "테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. ",
            date: "00.00.00"
        },
        {
            question: "테스트 질문입니다. 테스트 질문입니다.",
            answer: "테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. ",
            date: "00.00.00"
        },
        {
            question: "테스트 질문입니다. 테스트 질문입니다.",
            answer: "테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. ",
            date: "00.00.00"
        },

    ];

    const getCurrentQuestions = () => {
        const currentCategory = guideCategories.find(cat => cat.id === activeCategory);
        return currentCategory?.questions || [];
    };

    const getFilteredQuestions = () => {
        if (!searchTerm.trim()) {
            return getCurrentQuestions().map(q => ({ ...q, categoryName: null }));
        }
        
        // 검색어가 있으면 모든 카테고리에서 검색
        const allQuestionsWithCategory = guideCategories.flatMap(category => 
            category.questions.map(q => ({ ...q, categoryName: category.name }))
        );
        
        return allQuestionsWithCategory.filter(q => 
            q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.keywords?.some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    };

    const handleCategorySelect = (categoryId: string) => {
        setActiveCategory(categoryId);
        setSelectedQuestion(null);
        // 검색어는 유지하되, 검색 중이 아닐 때만 초기화
        if (!searchTerm.trim()) {
            setSearchTerm('');
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setSelectedQuestion(null);
    };

    const handleQuestionSelect = (question: GuideQuestion) => {
        setSelectedQuestion(question);
    };

    const handleBackToList = () => {
        setSelectedQuestion(null);
    };

    const renderAnswerContent = (answer: string) => {
        const lines = answer.split('\n');
        const elements: ReactElement[] = [];
        let tableLines: string[] = [];
        let isInTable = false;
        let currentParagraph: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.includes('|') && line.split('|').length > 2) {
                if (currentParagraph.length > 0) {
                    elements.push(
                        <div key={`p-${i}`}>{renderFormattedText(currentParagraph.join('\n'))}</div>
                    );
                    currentParagraph = [];
                }
                
                if (!isInTable) {
                    isInTable = true;
                    tableLines = [];
                }
                tableLines.push(line);
            } else {
                if (isInTable && tableLines.length > 0) {
                    const tableElement = renderTable(tableLines, i);
                    if (tableElement) elements.push(tableElement);
                    tableLines = [];
                    isInTable = false;
                }
                
                if (line === '') {
                    if (currentParagraph.length > 0) {
                        elements.push(
                            <div key={`p-${i}`}>{renderFormattedText(currentParagraph.join('\n'))}</div>
                        );
                        currentParagraph = [];
                    }
                } else {
                    currentParagraph.push(line);
                }
            }
        }

        if (isInTable && tableLines.length > 0) {
            const tableElement = renderTable(tableLines, lines.length);
            if (tableElement) elements.push(tableElement);
        }

        if (currentParagraph.length > 0) {
            elements.push(
                <div key={`p-final`}>{renderFormattedText(currentParagraph.join('\n'))}</div>
            );
        }

        return elements;
    };

    const renderFormattedText = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, lineIndex) => {
            if (line.startsWith('**') && line.endsWith('**')) {
                return <h4 key={lineIndex} style={{fontWeight: 'bold', margin: '16px 0 8px 0'}}>{line.slice(2, -2)}</h4>;
            }
            
            if (line.startsWith('• ')) {
                return <p key={lineIndex} style={{margin: '4px 0', paddingLeft: '16px'}}>{line}</p>;
            }
            
            const parts = line.split(/(\*\*.*?\*\*)/g);
            const formattedParts = parts.map((part, partIndex) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
                }
                return part;
            });
            
            return <p key={lineIndex}>{formattedParts}</p>;
        });
    };

    const renderTable = (tableLines: string[], key: number) => {
        if (tableLines.length < 2) return null;

        const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h !== '');
        const separatorExists = tableLines[1].includes('---');
        const dataStart = separatorExists ? 2 : 1;
        
        const rows = tableLines.slice(dataStart).map(line => 
            line.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
        ).filter(row => row.length > 0);

        return (
            <table key={`table-${key}`}>
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
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.contactContainer}>
                <p className={styles.title_1}>안녕하세요?</p>
                <p className={styles.title_2}>Maker 3D는 고객 입장으로 생각합니다.</p>
                <p className={styles.title_3}>무엇을 도와드릴까요?</p>
                <div className={styles.line}></div>

                <div className={styles.guideSection}>
                    <h2 className={styles.guideTitle}>가이드</h2>
                    
                    <div className={styles.searchBox}>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="모든 질문과 답변에서 검색하세요"
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>

                    <div className={styles.guideContent}>
                        <div className={styles.categoryList}>
                            {guideCategories.map((category) => (
                                <button
                                    key={category.id}
                                    className={`${styles.categoryButton} ${activeCategory === category.id ? styles.active : ''}`}
                                    onClick={() => handleCategorySelect(category.id)}
                                >
                                    {category.name}
                                </button>
                            ))}
                        </div>

                        <div className={styles.questionContent}>
                            {selectedQuestion ? (
                                <div className={styles.questionDetail}>
                                    <button 
                                        className={styles.backButton} 
                                        onClick={handleBackToList}
                                    >
                                        ← 질문목록
                                    </button>
                                    
                                    <div className={styles.questionDetailContent}>
                                        <h3 className={styles.detailQuestion}>
                                            {selectedQuestion.question}
                                        </h3>
                                        
                                        <div className={styles.questionTags}>
                                            {selectedQuestion.keywords?.map((keyword, index) => (
                                                <span key={index} className={styles.tag}>
                                                    {keyword}
                                                </span>
                                            ))}
                                        </div>
                                        
                                        <div className={styles.answerSection}>
                                            <div className={styles.answerContent}>
                                                {renderAnswerContent(selectedQuestion.answer)}
                                            </div>
                                            
                                            <div className={styles.answerActions}>
                                                <button className={styles.shareButton}>
                                                    공유
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.questionList}>
                                    {getFilteredQuestions().map((question) => (
                                        <div 
                                            key={question.id} 
                                            className={styles.questionItem}
                                            onClick={() => handleQuestionSelect(question)}
                                        >
                                            <span className={styles.questionIcon}>Q</span>
                                            <div className={styles.questionContent}>
                                                <span className={styles.questionText}>
                                                    {question.question}
                                                </span>
                                                {question.categoryName && (
                                                    <span className={styles.categoryTag}>
                                                        {question.categoryName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/*<div className={styles.qnaSection}>*/}
                {/*    <div className={styles.qnaList}>*/}
                {/*        {qnaData.map((qna, index) => (*/}
                {/*            <QnACard*/}
                {/*                key={index}*/}
                {/*                question={qna.question}*/}
                {/*                answer={qna.answer}*/}
                {/*                date={qna.date}*/}
                {/*            />*/}
                {/*        ))}*/}
                {/*    </div>*/}
                {/*</div>*/}

                <div className={styles.customerServiceSection}>
                    <div className={styles.serviceHeader}>
                        <span className={styles.serviceTitle}>고객센터</span>
                        <span className={styles.serviceTime}>08:00 ~ 18:00</span>
                    </div>
                    
                    <div className={styles.serviceContent}>
                        <div className={styles.contactInfo}>
                            <div className={styles.contactItem}>
                                <span className={styles.contactLabel}>E-Mail</span>
                                <span className={styles.contactValue}>3dstore@bittech3d.com</span>
                            </div>
                            <div className={styles.contactItem}>
                                <span className={styles.contactLabel}>상담문의</span>
                                <span className={styles.contactValue}>054-462-4140</span>
                            </div>
                            <div className={styles.contactItem}>
                                <span className={styles.contactLabel}>기술문의</span>
                                <span className={styles.contactValue}>010-4141-2882</span>
                            </div>
                        </div>
                        
                        <div className={styles.serviceButtons}>
                            <button className={styles.consultButton}>
                                1:1 문의
                            </button>
                        </div>
                    </div>

                    <div className={styles.serviceNotice}>
                        <div className={styles.noticeItem}>
                            • 주말/공휴일에는 원활한 상담이 어려울 수 있습니다.
                        </div>
                        <div className={styles.noticeItem}>
                            • 점심시간(11:30 ~ 12:30)에도 고객센터는 운영하나, 원활하지 않을 수 있습니다.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}