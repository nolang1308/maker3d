'use client';

import Styles from "./page.module.scss";
import React, {useEffect, useState} from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createPortfolio, PortfolioFormData } from '@/services/portfolioService';

const categoryOptions = [
    {id: "피규어", text: "피규어"},
    {id: "부품", text: "부품"},
    {id: "외주 개발", text: "외주 개발"},
];

export default function PortfolioWritePage(): React.ReactElement {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [savedDialogOpen, setSavedDialogOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("피규어");
    const [content, setContent] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // 로그인 체크
    useEffect(() => {
        // authLoading이 false이고 user가 없으면 로그인 페이지로
        if (!authLoading && !user) {
            alert('로그인이 필요합니다.');
            router.push('/login');
        }
    }, [user, authLoading, router]);

    const handleImageUpload = (file: File) => {
        // 이미지 파일만 허용
        if (!file.type.startsWith('image/')) {
            setError('이미지 파일만 업로드할 수 있습니다.');
            return;
        }

        setImageFile(file);

        // 미리보기 생성
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        setError('');
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageUpload(e.dataTransfer.files[0]);
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview('');
    };

    const save = async () => {
        if (!user) {
            alert('로그인이 필요합니다.');
            router.push('/login');
            return;
        }

        // 유효성 검사
        if (!title.trim()) {
            setError('제목을 입력해주세요.');
            return;
        }

        if (!content.trim()) {
            setError('내용을 입력해주세요.');
            return;
        }

        if (!imageFile) {
            setError('이미지를 업로드해주세요.');
            return;
        }

        try {
            setLoading(true);
            setError('');

            console.log('=== 포트폴리오 저장 시작 ===');
            console.log('제목:', title);
            console.log('카테고리:', category);
            console.log('이미지 파일:', imageFile?.name, imageFile?.size);
            console.log('사용자:', user?.email);

            const portfolioData: PortfolioFormData = {
                title: title.trim(),
                category: category,
                content: content.trim(),
                imageFile: imageFile
            };

            const writerName = user.email?.split('@')[0] || '관리자';

            console.log('createPortfolio 호출 시작...');
            const result = await createPortfolio(portfolioData, user.email!, writerName);
            console.log('포트폴리오 생성 성공:', result);

            setSavedDialogOpen(true);

            // 3초 후 목록으로 이동
            setTimeout(() => {
                router.push('/admin/portfolio');
            }, 3000);

        } catch (error) {
            console.error('=== 포트폴리오 저장 에러 ===');
            console.error('에러:', error);
            console.error('에러 메시지:', (error as Error).message);
            console.error('에러 스택:', (error as Error).stack);
            setError(`포트폴리오 저장에 실패했습니다: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    return <div className={Styles.Main}>
        <div className={Styles.InformationContainer}>
            <div className={Styles.Title}>
                <p>포트폴리오 작성</p>
            </div>

            {error && (
                <div className={Styles.errorMessage}>
                    {error}
                </div>
            )}

            {/* 카테고리 선택 */}
            <div className={Styles.SectionTitleWrapper}>
                <p className={Styles.SectionTitle}>카테고리</p>
                <div style={{width: '292px'}} className={Styles.innerWrapper}>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={Styles.selectInput}
                    >
                        {categoryOptions.map(option => (
                            <option key={option.id} value={option.id}>
                                {option.text}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 제목 */}
            <div className={Styles.SectionTitleWrapper}>
                <p className={Styles.SectionTitle}>제목</p>
                <input
                    className={Styles.PostTitle}
                    type="text"
                    placeholder={"포트폴리오 제목을 입력해주세요."}
                    value={title}
                    onChange={(ev) => setTitle(ev.target.value)}
                />
            </div>

            {/* 히어로 이미지 업로드 */}
            <div className={Styles.imageUploadSection}>
                <div className={Styles.SubTitle}>히어로 이미지 업로드</div>

                {!imagePreview ? (
                    <div
                        className={`${Styles.imageUploadArea} ${dragActive ? Styles.dragActive : ''}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    handleImageUpload(e.target.files[0]);
                                    e.target.value = '';
                                }
                            }}
                            className={Styles.imageInput}
                        />
                        <div className={Styles.uploadIcon}>📷</div>
                        <p>이미지를 여기에 끌어다 놓거나 파일 선택 버튼을 클릭해주세요.</p>
                        <button className={Styles.fileSelectBtn} type="button">
                            파일선택
                        </button>
                    </div>
                ) : (
                    <div className={Styles.imagePreviewContainer}>
                        <img src={imagePreview} alt="미리보기" className={Styles.imagePreview} />
                        <button
                            className={Styles.removeImageBtn}
                            onClick={removeImage}
                            type="button"
                        >
                            이미지 삭제
                        </button>
                    </div>
                )}
            </div>

            {/* 내용 */}
            <div className={Styles.SectionTitleWrapper}>
                <p className={Styles.SectionTitle}>내용</p>
                <div className={Styles.textEditorWrapper}>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="포트폴리오 내용을 작성하세요."
                        className={Styles.textEditor}
                    />
                </div>
            </div>

            {/* 저장 버튼 */}
            <div className={Styles.AddBtnWrapper}>
                <div
                    className={`${Styles.AddBtn} ${loading ? Styles.loading : ''}`}
                    onClick={loading ? undefined : save}
                >
                    {loading ? '등록 중...' : '포트폴리오 등록'}
                </div>
            </div>
        </div>

        {savedDialogOpen && (
            <div className={Styles.modal}>
                <div className={Styles.info}>
                    <p>🎉</p>
                    <p>포트폴리오 등록이 완료되었습니다.</p>
                </div>
                <div className={Styles.ButtonWrapper}>
                    <div className={Styles.LeftBtn} onClick={() => router.push('/admin/portfolio')}>
                        확인
                    </div>
                </div>
            </div>
        )}
    </div>;
}
