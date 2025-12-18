import React from "react";
import Styles from "./DownloadAttachment.module.scss";

function NormalChip(params: NormalChip.Params): React.ReactElement {
    const options = {
        ...NormalChip.Defaults,
        ...params,
    };

    return (
        <span
            className={Styles.NormalChip}
        >
      {options.text}
    </span>
    );
}

namespace NormalChip {
    export type Params = {
        text: string;
        backgroundColor: string;
    };
    export const Defaults = {};
}


export function DownloadAttachment(params: DownloadAttachment.Params): React.ReactElement {
    const options = {
        ...DownloadAttachment.Defaults,
        ...params,
    };
    const handleDownload = async () => {
        try {
            // 백엔드 다운로드 API를 통해 파일 다운로드
            // options.path는 이미 /api/download-notice-file/noticeId/filename 형식
            const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
            const downloadUrl = `${BACKEND_URL}${options.path}`;

            // 새 창에서 다운로드 시작
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = options.title;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('다운로드 에러:', error);
            alert('파일 다운로드에 실패했습니다.');
        }
    }
    return (
        <div className={Styles.attachmentList}>
            <NormalChip backgroundColor={"#F9F9F9"} text={options.title}/>
            {/*<div className={Styles.byte}>(24.8MB)</div>*/}
            <button
                className={Styles.viewOriginal}
                onClick={() => handleDownload()}
            >
                다운로드
            </button>
        </div>
    );
}

export namespace DownloadAttachment {
    export type Params = {
        title: string;
        path: string;
    };
    export const Defaults = {};


}
export default DownloadAttachment;
