'use client';

import Styles from "../../write/page.module.scss";
import React, { useEffect, useState } from "react";
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPost, updatePost, PostFormData } from '@/services/postService';

const buttons = [
    {id: "write", text: "게시글"},
];

export default function EditPage(): React.ReactElement {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const [savedDialogOpen, setSavedDialogOpen] = useState(false);
    const [markdown, setMarkdown] = useState("");
    const [title, setTitle] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("write");
    const [files, setFiles] = useState<any[]>([]);
    const [password, setPassword] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [initialLoading, setInitialLoading] = useState(true);
    const [deletedFileUrls, setDeletedFileUrls] = useState<string[]>([]); // 삭제할 파일 URL 추적

    const MAX_FILES = 10;
    // 파일 용량 제한 제거 (무제한)
    const MAX_SIZE = Infinity;

    // 게시글 데이터 로드
    useEffect(() => {
        const loadPostData = async () => {
            try {
                const postId = params.id as string;
                if (!postId) {
                    setError('잘못된 게시글 ID입니다.');
                    setInitialLoading(false);
                    return;
                }

                const post = await getPost(postId);
                if (post) {
                    setTitle(post.title);
                    setMarkdown(post.content);
                    setSelectedCategory(post.category || "write");
                    setPassword(post.password || "");

                    // 기존 첨부파일 불러오기
                    if (post.attachments && post.attachments.length > 0) {
                        const existingFiles = post.attachments.map((attachment, index) => ({
                            name: attachment.name,
                            size: attachment.size,
                            url: attachment.url,
                            isExisting: true, // 기존 파일 표시
                            isOverSize: false,
                            id: `existing-${index}`
                        }));
                        setFiles(existingFiles);
                    }
                } else {
                    setError('게시글을 찾을 수 없습니다.');
                    setTimeout(() => router.push('/freenoticeboard'), 2000);
                }
            } catch (error) {
                console.error('게시글 로드 에러:', error);
                setError('게시글을 불러오는데 실패했습니다.');
            } finally {
                setInitialLoading(false);
            }
        };

        loadPostData();
    }, [params.id, router]);

    // 로그인 체크
    useEffect(() => {
        if (!user && !initialLoading) {
            alert('로그인이 필요합니다.');
            router.push('/login');
        }
    }, [user, router, initialLoading]);

    const handleFileUpload = (newFiles: FileList) => {
        const fileArray = Array.from(newFiles);
        const validFiles: any[] = [];

        fileArray.forEach(file => {
            if (files.length + validFiles.length < MAX_FILES) {
                const fileData = {
                    name: file.name,
                    size: file.size,
                    file,
                    isOverSize: false, // 용량 제한 제거
                    id: Date.now() + Math.random()
                };
                validFiles.push(fileData);
            }
        });

        setFiles(prev => [...prev, ...validFiles]);
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
            handleFileUpload(e.dataTransfer.files);
        }
    };

    const removeFile = (id: any) => {
        // 삭제하려는 파일 찾기
        const fileToRemove = files.find(file => file.id === id);

        // 기존 파일이면 삭제할 URL 목록에 추가
        if (fileToRemove?.isExisting && fileToRemove.url) {
            setDeletedFileUrls(prev => [...prev, fileToRemove.url]);
        }

        // UI에서 파일 제거
        setFiles(prev => prev.filter(file => file.id !== id));
    };

    const clearAllFiles = () => {
        // 기존 파일들의 URL을 모두 삭제 목록에 추가
        const existingFileUrls = files
            .filter(file => file.isExisting && file.url)
            .map(file => file.url);

        setDeletedFileUrls(prev => [...prev, ...existingFileUrls]);
        setFiles([]);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const save = async () => {
        if (!user) {
            alert('로그인이 필요합니다.');
            router.push('/login');
            return;
        }

        const postId = params.id as string;
        if (!postId) {
            setError('잘못된 게시글 ID입니다.');
            return;
        }

        // 유효성 검사
        if (!title.trim()) {
            setError('제목을 입력해주세요.');
            return;
        }

        if (!markdown.trim()) {
            setError('내용을 입력해주세요.');
            return;
        }

        if (!password.trim()) {
            setError('비밀번호를 입력해주세요.');
            return;
        }

        if (password.length !== 4) {
            setError('비밀번호는 4자리로 입력해주세요.');
            return;
        }

        try {
            setLoading(true);
            setError('');

            // 새로 추가된 파일만 추출 (기존 파일 제외)
            const newFiles = files
                .filter(file => !file.isExisting && file.file)
                .map(file => file.file);

            // 남아있는 기존 파일들
            const remainingExistingFiles = files
                .filter(file => file.isExisting)
                .map(file => ({
                    name: file.name,
                    url: file.url,
                    size: file.size
                }));

            const updateData: Partial<PostFormData> = {
                title: title.trim(),
                content: markdown.trim(),
                category: selectedCategory,
                password: password,
                files: newFiles.length > 0 ? newFiles : undefined,
                deletedFileUrls: deletedFileUrls.length > 0 ? deletedFileUrls : undefined,
                existingFiles: remainingExistingFiles
            };

            await updatePost(postId, updateData);

            setSavedDialogOpen(true);

            // 3초 후 상세 페이지로 이동
            setTimeout(() => {
                router.push(`/freenoticeboard/${postId}`);
            }, 3000);

        } catch (error) {
            console.error('게시글 수정 에러:', error);
            setError('게시글 수정에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div className={Styles.Main}>
                <div className={Styles.InformationContainer}>
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        로딩 중...
                    </div>
                </div>
            </div>
        );
    }

    if (error && !title) {
        return (
            <div className={Styles.Main}>
                <div className={Styles.InformationContainer}>
                    <div style={{ textAlign: 'center', padding: '40px', color: '#FF4444' }}>
                        {error}
                    </div>
                </div>
            </div>
        );
    }

    return <div className={Styles.Main}>
        <div className={Styles.InformationContainer}>
            <div className={Styles.Title}>
                <p>게시글 수정</p>
            </div>

            {error && (
                <div className={Styles.errorMessage}>
                    {error}
                </div>
            )}

            {/* 카테고리 */}
            <div className={Styles.SectionTitleWrapper}>
                <p className={Styles.SectionTitle}>카테고리</p>
                <div style={{width: '292px'}} className={Styles.innerWrapper}>
                    <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className={Styles.selectInput}
                    >
                        {buttons.map(button => (
                            <option key={button.id} value={button.id}>
                                {button.text}
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
                    placeholder={"제목을 입력해주세요."}
                    value={title}
                    onChange={(ev) => setTitle(ev.target.value)}
                />
            </div>

            {/* 내용 */}
            <div className={Styles.SectionTitleWrapper}>
                <p className={Styles.SectionTitle}>내용</p>
                <div className={Styles.textEditorWrapper}>
                    <textarea
                        value={markdown}
                        onChange={(e) => setMarkdown(e.target.value)}
                        placeholder="게시글 내용을 입력하세요."
                        className={Styles.textEditor}
                    />
                </div>
            </div>

            {/* 비밀번호 */}
            <div className={Styles.SectionTitleWrapper}>
                <p className={Styles.SectionTitle}>비밀번호</p>
                <div style={{width: '292px', height: '42px'}} className={Styles.innerWrapper}>
                    <input
                        className={Styles.PostTitle}
                        type="password"
                        placeholder={"비밀번호 네자리를 입력해주세요."}
                        value={password}
                        onChange={(ev) => setPassword(ev.target.value)}
                    />
                </div>
            </div>

            <div className={Styles.fileUploadSection}>
                <div className={Styles.SubTitle}>첨부파일 등록</div>
                
                <div 
                    className={`${Styles.fileUploadArea} ${dragActive ? Styles.dragActive : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input 
                        type="file" 
                        multiple
                        onChange={(e) => {
                            if (e.target.files) {
                                handleFileUpload(e.target.files);
                                e.target.value = '';
                            }
                        }}
                        className={Styles.fileInput}
                        disabled={files.length >= MAX_FILES}
                    />
                    <p>첨부할 파일을 여기에 끌어다 놓거나. 파일 선택 버튼을 직접 선택해주세요.</p>
                    <button className={Styles.fileSelectBtn} type="button">
                        파일선택
                    </button>
                </div>

                <div className={Styles.fileUploadFooter}>
                    <div className={Styles.fileCounter}>
                        <span className={Styles.currentCount}>{files.length}개</span>
                        <span className={Styles.maxCount}> / {MAX_FILES}개</span>
                    </div>
                    {files.length > 0 && (
                        <button 
                            className={Styles.clearAllBtn}
                            onClick={clearAllFiles}
                            type="button"
                        >
                            전체 파일 삭제 &gt;
                        </button>
                    )}
                </div>

                {files.length > 0 && (
                    <div className={Styles.fileList}>
                        {files.map((file) => (
                            <div 
                                key={file.id} 
                                className={`${Styles.fileItem} ${file.isOverSize ? Styles.oversizeFile : ''}`}
                            >
                                {file.isOverSize ? (
                                    <>
                                        <div className={Styles.fileMainRow}>
                                            <div className={Styles.fileLeftSection}>
                                                <span className={Styles.fileName}>{file.name}</span>
                                            </div>
                                            <button 
                                                className={Styles.deleteBtn}
                                                onClick={() => removeFile(file.id)}
                                                type="button"
                                            >
                                                삭제 ×
                                            </button>
                                        </div>
                                        <div className={Styles.errorMessage}>
                                            <span className={Styles.errorIcon}>⚠</span>
                                            등록 가능한 파일의 용량을 초과하였습니다. 
                                            {formatFileSize(MAX_SIZE)} 미만의 파일만 등록할 수 있습니다.
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={Styles.fileLeftSection}>
                                            <span className={Styles.fileName}>{file.name}</span>
                                        </div>
                                        <button 
                                            className={Styles.deleteBtn}
                                            onClick={() => removeFile(file.id)}
                                            type="button"
                                        >
                                            삭제 ×
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 저장 버튼 */}
            <div className={Styles.AddBtnWrapper}>
                <div
                    className={`${Styles.AddBtn} ${loading ? Styles.loading : ''}`}
                    onClick={loading ? undefined : save}
                >
                    {loading ? '수정 중...' : '게시글 수정'}
                </div>
            </div>
        </div>

        {savedDialogOpen && (
            <div className={Styles.modal}>
                <div className={Styles.info}>
                    <p>🎉</p>
                    <p>게시글 수정이 완료되었습니다.</p>
                </div>
                <div className={Styles.ButtonWrapper}>
                    <div className={Styles.LeftBtn} onClick={() => router.push(`/freenoticeboard/${params.id}`)}>
                        확인
                    </div>
                </div>
            </div>
        )}
    </div>;
}