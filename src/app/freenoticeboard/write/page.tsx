'use client';

import Styles from "./page.module.scss";
import React, {useEffect, useState} from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';

const buttons = [
    {id: "write", text: "게시글"},
    // {id: "INFRA_INFO", text: "시설안내"},
    // {id: "NOTIFICATION", text: "안내사항"},
    // {id: "NEWS_LETTER", text: "뉴스레터"},
];

export default function Page(): React.ReactElement {
    const router = useRouter();
    const [savedDialogOpen, setSavedDialogOpen] = useState(false);
    const [markdown, setMarkdown] = useState("");
    const [title, setTitle] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("EVENT_INFO");
    const [pinned, setPinned] = useState(false);
    const [files, setFiles] = useState<any[]>([]);
    const [password, setPassword] = useState("");
    const [dragActive, setDragActive] = useState(false);

    const MAX_FILES = 10;
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB

    const handleFileUpload = (newFiles: FileList) => {
        const fileArray = Array.from(newFiles);
        const validFiles: any[] = [];
        
        fileArray.forEach(file => {
            if (files.length + validFiles.length < MAX_FILES) {
                const fileData = {
                    name: file.name,
                    size: file.size,
                    file,
                    isOverSize: file.size > MAX_SIZE,
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

    const save = async (publish: boolean) => {
        console.log('저장:', { title, selectedCategory, pinned, markdown, publish });
        setSavedDialogOpen(true);
    };

    return <div className={Styles.Main}>
        <div className={Styles.InformationContainer}>
            <div className={Styles.Title}>

                <p>게시글 작성</p>
            </div>

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
                        placeholder="새로운 게시글을 작성하세요."
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
                                            등록 가능한 파일의 용량을 초과하였습니다. 
                                            {formatFileSize(MAX_SIZE)} 미만의 파일만 등록할 수 있습니다.
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
                    className={Styles.AddBtn}
                    onClick={() => save(true)}
                >
                    게시글 등록
                </div>
            </div>
        </div>

        {savedDialogOpen && (
            <div className={Styles.modal}>
                <div className={Styles.info}>
                    <p>🎉</p>
                    <p>게시글 등록이 완료되었습니다.</p>
                    {/*<p>*/}
                    {/*    수정이 필요하시다면 목록창에서<br/>*/}
                    {/*    수정하고자 하는 게시글 우측<br/>*/}
                    {/*    '수정'을 눌러주세요.*/}
                    {/*</p>*/}
                </div>
                <div className={Styles.ButtonWrapper}>
                    <div className={Styles.LeftBtn} onClick={() => setSavedDialogOpen(false)}>
                        확인
                    </div>
                </div>
            </div>
        )}
    </div>;
}
