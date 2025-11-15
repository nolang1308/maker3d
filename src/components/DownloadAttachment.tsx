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
    const handleDownload=()=> {
        const fileName = options.title

        const link = document.createElement("a");
        link.href = options.path;
        link.download = fileName; // 확장자 포함해서 다운로드
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
