'use client';

import Styles from "../../write/page.module.scss";
import React, { useEffect, useState } from "react";
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getNotice, updateNotice, NoticeFormData } from '@/services/noticeService';

const publicOptions = [
    {id: true, text: "공개"},
    {id: false, text: "비공개"},
];

export default function EditPage(): React.ReactElement {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const [savedDialogOpen, setSavedDialogOpen] = useState(false);
    const [markdown, setMarkdown] = useState("");
    const [title, setTitle] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [newFiles, setNewFiles] = useState<any[]>([]); // 새로 추가하는 파일들
    const [existingFiles, setExistingFiles] = useState<any[]>([]); // 기존 첨부파일들
    const [deletedFileIds, setDeletedFileIds] = useState<string[]>([]); // 삭제된 기존 파일들의 ID
    const [password, setPassword] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [initialLoading, setInitialLoading] = useState(true);

    const MAX_FILES = 10;
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB

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

                const notice = await getNotice(postId);
                if (notice) {
                    setTitle(notice.title);
                    setMarkdown(notice.content);
                    setIsPublic(notice.isPublic);
                    setPassword(notice.password || "");
                    
                    // 기존 첨부파일 로드
                    if (notice.attachments && notice.attachments.length > 0) {
                        const existingFileData = notice.attachments.map((attachment, index) => ({
                            id: `existing_${index}`,
                            name: attachment.name,
                            url: attachment.url,
                            size: attachment.size,
                            type: attachment.type || 'application/octet-stream',
                            isExisting: true
                        }));
                        setExistingFiles(existingFileData);
                    }
                } else {
                    setError('공지사항을 찾을 수 없습니다.');
                    setTimeout(() => router.push('/admin/notice'), 2000);
                }
            } catch (error) {
                console.error('공지사항 로드 에러:', error);
                setError('공지사항을 불러오는데 실패했습니다.');
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

    const handleFileUpload = (uploadedFiles: FileList) => {
        const fileArray = Array.from(uploadedFiles);
        const validFiles: any[] = [];
        
        const totalExistingFiles = existingFiles.length - deletedFileIds.length + newFiles.length;
        
        fileArray.forEach(file => {
            if (totalExistingFiles + validFiles.length < MAX_FILES) {
                const fileData = {
                    name: file.name,
                    size: file.size,
                    file,
                    isOverSize: file.size > MAX_SIZE,
                    id: `new_${Date.now()}_${Math.random()}`,
                    isExisting: false
                };
                validFiles.push(fileData);
            }
        });
        
        setNewFiles(prev => [...prev, ...validFiles]);
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
        // 기존 파일인지 새 파일인지 확인
        if (id.startsWith('existing_')) {
            // 기존 파일은 삭제 대상으로 표시
            const fileToDelete = existingFiles.find(file => file.id === id);
            if (fileToDelete) {
                setDeletedFileIds(prev => [...prev, fileToDelete.url]); // url을 삭제 ID로 사용
                setExistingFiles(prev => prev.filter(file => file.id !== id));
            }
        } else {
            // 새 파일은 바로 제거
            setNewFiles(prev => prev.filter(file => file.id !== id));
        }
    };

    const clearAllFiles = () => {
        // 모든 기존 파일을 삭제 대상으로 표시
        const allExistingUrls = existingFiles.map(file => file.url);
        setDeletedFileIds(prev => [...prev, ...allExistingUrls]);
        setExistingFiles([]);
        setNewFiles([]);
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

        const noticeId = params.id as string;
        if (!noticeId) {
            setError('잘못된 공지사항 ID입니다.');
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

            // 1. 먼저 삭제된 기존 파일들을 삭제
            if (deletedFileIds.length > 0) {
                console.log('Deleting removed files:', deletedFileIds);
                const deletePromises = deletedFileIds.map(async (filePath) => {
                    try {
                        const deleteResponse = await fetch(`/api/upload?filePath=${encodeURIComponent(filePath)}`, {
                            method: 'DELETE'
                        });
                        if (!deleteResponse.ok) {
                            console.error(`Failed to delete file: ${filePath}`);
                        }
                    } catch (error) {
                        console.error(`Error deleting file ${filePath}:`, error);
                    }
                });
                
                await Promise.allSettled(deletePromises);
            }

            // 2. 새로운 파일들 업로드
            let newAttachments: { name: string; url: string; size: number; type?: string; }[] = [];
            
            if (newFiles.length > 0) {
                try {
                    console.log('Preparing to upload new files:', newFiles);
                    const formData = new FormData();
                    formData.append('noticeId', noticeId);
                    
                    newFiles.forEach(fileData => {
                        if (fileData.file && !fileData.isOverSize) {
                            console.log('Adding file to FormData:', fileData.name);
                            formData.append('files', fileData.file);
                        }
                    });

                    const fileCount = formData.getAll('files').length;
                    console.log('Total files to upload:', fileCount);

                    if (fileCount > 0) {
                        const uploadResponse = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData
                        });

                        if (uploadResponse.ok) {
                            const uploadResult = await uploadResponse.json();
                            newAttachments = uploadResult.files || [];
                            console.log('File upload successful:', newAttachments);
                        } else {
                            const errorData = await uploadResponse.json();
                            console.error('File upload failed:', uploadResponse.status, errorData);
                        }
                    }
                } catch (uploadError) {
                    console.error('File upload error:', uploadError);
                }
            }

            // 3. 최종 첨부파일 목록 생성 (기존 파일 + 새 파일)
            const remainingExistingFiles = existingFiles.map(file => ({
                name: file.name,
                url: file.url,
                size: file.size,
                type: file.type
            }));

            const finalAttachments = [...remainingExistingFiles, ...newAttachments];

            // 4. 공지사항 업데이트
            const updateData: Partial<NoticeFormData> & { attachments?: any[] } = {
                title: title.trim(),
                content: markdown.trim(),
                password: password,
                isPublic: isPublic,
                attachments: finalAttachments
            };

            await updateNotice(noticeId, updateData);

            setSavedDialogOpen(true);
            
            // 3초 후 공지사항 관리 페이지로 이동
            setTimeout(() => {
                router.push('/admin/notice');
            }, 3000);

        } catch (error) {
            console.error('공지사항 수정 에러:', error);
            setError('공지사항 수정에 실패했습니다. 다시 시도해주세요.');
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
                <p>공지사항 수정</p>
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
                        placeholder="공지사항 내용을 입력하세요."
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
                        disabled={(existingFiles.length - deletedFileIds.length + newFiles.length) >= MAX_FILES}
                    />
                    <p>첨부할 파일을 여기에 끌어다 놓거나. 파일 선택 버튼을 직접 선택해주세요.</p>
                    <button className={Styles.fileSelectBtn} type="button">
                        파일선택
                    </button>
                </div>

                <div className={Styles.fileUploadFooter}>
                    <div className={Styles.fileCounter}>
                        <span className={Styles.currentCount}>{existingFiles.length + newFiles.length}개</span>
                        <span className={Styles.maxCount}> / {MAX_FILES}개</span>
                    </div>
                    {(existingFiles.length + newFiles.length) > 0 && (
                        <button 
                            className={Styles.clearAllBtn}
                            onClick={clearAllFiles}
                            type="button"
                        >
                            전체 파일 삭제 &gt;
                        </button>
                    )}
                </div>

                {(existingFiles.length > 0 || newFiles.length > 0) && (
                    <div className={Styles.fileList}>
                        {/* 기존 파일들 표시 */}
                        {existingFiles.map((file) => (
                            <div 
                                key={file.id} 
                                className={`${Styles.fileItem} ${Styles.existingFile}`}
                            >
                                <div className={Styles.fileLeftSection}>
                                    <span className={Styles.fileName}>{file.name}</span>
                                    <span className={Styles.fileInfo}> (기존 파일, {formatFileSize(file.size)})</span>
                                </div>
                                <button 
                                    className={Styles.deleteBtn}
                                    onClick={() => removeFile(file.id)}
                                    type="button"
                                >
                                    삭제 ×
                                </button>
                            </div>
                        ))}

                        {/* 새로 추가된 파일들 표시 */}
                        {newFiles.map((file) => (
                            <div 
                                key={file.id} 
                                className={`${Styles.fileItem} ${file.isOverSize ? Styles.oversizeFile : ''}`}
                            >
                                {file.isOverSize ? (
                                    <>
                                        <div className={Styles.fileMainRow}>
                                            <div className={Styles.fileLeftSection}>
                                                <span className={Styles.fileName}>{file.name}</span>
                                                <span className={Styles.fileInfo}> (새 파일)</span>
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
                                            <span className={Styles.fileInfo}> (새 파일, {formatFileSize(file.size)})</span>
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
                    {loading ? '수정 중...' : '공지사항 수정'}
                </div>
            </div>
        </div>

        {savedDialogOpen && (
            <div className={Styles.modal}>
                <div className={Styles.info}>
                    <p>🎉</p>
                    <p>공지사항 수정이 완료되었습니다.</p>
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