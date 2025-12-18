'use client';

import Styles from "./page.module.scss";
import React, {useEffect, useState} from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createNotice, NoticeFormData } from '@/services/noticeService';

const publicOptions = [
    {id: true, text: "공개"},
    {id: false, text: "비공개"},
];

export default function Page(): React.ReactElement {
    const router = useRouter();
    const { user } = useAuth();
    const [savedDialogOpen, setSavedDialogOpen] = useState(false);
    const [markdown, setMarkdown] = useState("");
    const [title, setTitle] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [files, setFiles] = useState<any[]>([]);
    const [password, setPassword] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // 로그인 체크
    useEffect(() => {
        if (!user) {
            alert('로그인이 필요합니다.');
            router.push('/login');
        }
    }, [user, router]);

    const MAX_FILES = 10;

    const handleFileUpload = (newFiles: FileList) => {
        const fileArray = Array.from(newFiles);
        const validFiles: any[] = [];

        fileArray.forEach(file => {
            if (files.length + validFiles.length < MAX_FILES) {
                const fileData = {
                    name: file.name,
                    size: file.size,
                    file,
                    isOverSize: false, // 크기 제한 없음
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
        setFiles(prev => prev.filter(file => file.id !== id));
    };

    const clearAllFiles = () => {
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

            // 크기 제한을 통과한 파일들만 전송
            const validFiles = files.filter(fileData => !fileData.isOverSize).map(fileData => fileData.file);
            
            const noticeData: NoticeFormData = {
                title: title.trim(),
                content: markdown.trim(),
                password: password,
                isPublic: isPublic,
                files: validFiles
            };

            const authorName = user.email?.split('@')[0] || '익명';
            await createNotice(noticeData, user.email!, authorName);

            setSavedDialogOpen(true);
            
            // 3초 후 목록으로 이동
            setTimeout(() => {
                router.push('/admin/notice');
            }, 3000);

        } catch (error) {
            console.error('게시글 저장 에러:', error);
            setError('게시글 저장에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return <div className={Styles.Main}>
        <div className={Styles.InformationContainer}>
            <div className={Styles.Title}>
                <p>공지사항 작성</p>
            </div>

            {error && (
                <div className={Styles.errorMessage}>
                    {error}
                </div>
            )}

            {/* 공개 설정 */}
            <div className={Styles.SectionTitleWrapper}>
                <p className={Styles.SectionTitle}>공개 설정</p>
                <div style={{width: '292px'}} className={Styles.innerWrapper}>
                    <select 
                        value={isPublic.toString()}
                        onChange={(e) => setIsPublic(e.target.value === 'true')}
                        className={Styles.selectInput}
                    >
                        {publicOptions.map(option => (
                            <option key={option.id.toString()} value={option.id.toString()}>
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
                    placeholder={"공지사항 제목을 입력해주세요."}
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
                        placeholder="공지사항 내용을 작성하세요."
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
                                // Reset input value to allow re-uploading same file
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
                                                {/*<input type="checkbox" className={Styles.fileCheckbox} />*/}
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
                                            파일 업로드 중 오류가 발생했습니다.
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={Styles.fileLeftSection}>
                                            {/*<input type="checkbox" className={Styles.fileCheckbox} />*/}
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
                    {loading ? '등록 중...' : '공지사항 등록'}
                </div>
            </div>
        </div>

        {savedDialogOpen && (
            <div className={Styles.modal}>
                <div className={Styles.info}>
                    <p>🎉</p>
                    <p>공지사항 등록이 완료되었습니다.</p>
                    {/*<p>*/}
                    {/*    수정이 필요하시다면 목록창에서<br/>*/}
                    {/*    수정하고자 하는 게시글 우측<br/>*/}
                    {/*    '수정'을 눌러주세요.*/}
                    {/*</p>*/}
                </div>
                <div className={Styles.ButtonWrapper}>
                    <div className={Styles.LeftBtn} onClick={() => router.push('/admin/notice')}>
                        확인
                    </div>
                </div>
            </div>
        )}
    </div>;
}
