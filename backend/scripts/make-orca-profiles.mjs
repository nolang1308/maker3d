// 오르카 슬라이서용 견적 기준 프로필 만들기
//
// 사용: node backend/scripts/make-orca-profiles.mjs
// 결과: backend/orca-profiles/ 에 machine.json, process.json, 소재별 json 을 새로 씁니다.
//
// 왜 필요한가
//   오르카의 프로필은 "inherits" 로 부모 설정을 물려받는 여러 파일로 나뉘어 있는데,
//   명령줄로 슬라이싱할 때는 한 파일에 값이 다 들어 있어야 합니다.
//   그래서 OrcaSlicer 저장소에서 프로필을 받아 부모를 따라 올라가며 한 파일로 합칩니다.
//
// 기준을 바꾸려면 (다른 프린터, 다른 층 높이, 다른 필라멘트)
//   아래 PRESETS 의 name 을 오르카 화면에 보이는 프로필 이름으로 바꾸고 다시 실행하세요.
//   바꾸면 견적 금액이 달라집니다. 실행 뒤 backend/orca-profiles/ 의 변경을 커밋 · 배포해야 반영됩니다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ORCA_TAG = 'v2.5.2';     // backend/Dockerfile 의 ORCA_VERSION 과 맞춥니다
const VENDOR = 'Prusa';
const BASE = `https://raw.githubusercontent.com/OrcaSlicer/OrcaSlicer/${ORCA_TAG}/resources/profiles/${VENDOR}`;

// 견적의 기준: Original Prusa XL, 0.4 노즐, 0.20mm Structural
const PRESETS = [
  { kind: 'machine',  name: 'Prusa XL 0.4 nozzle',             file: 'machine.json' },
  { kind: 'process',  name: '0.20mm Structural @Prusa XL 0.4', file: 'process.json' },
  { kind: 'filament', name: 'Prusament PLA @XL',               file: 'PLA.json' },
  { kind: 'filament', name: 'Prusament PETG @XL',              file: 'PETG.json' },
  { kind: 'filament', name: 'Generic ABS @Prusa XL',           file: 'ABS.json' },
  { kind: 'filament', name: 'Generic TPU @Prusa',              file: 'TPU.json' },  // XL 전용 TPU 프로필은 없음
];

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'orca-profiles');
const fetched = new Map();

async function fetchPreset(kind, name) {
  const key = `${kind}/${name}`;
  if (!fetched.has(key)) {
    const url = `${BASE}/${kind}/${encodeURIComponent(name)}.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`프로필을 받지 못했습니다 (${response.status}): ${kind} / ${name}`);
    }
    fetched.set(key, await response.json());
  }
  return fetched.get(key);
}

// 부모(inherits) → 끼워 넣는 설정(include) → 자기 값 순서로 덮어쓴다
async function resolve(kind, name, chain) {
  const preset = await fetchPreset(kind, name);
  chain.push(name);
  let merged = {};
  if (preset.inherits) {
    merged = { ...merged, ...(await resolve(kind, preset.inherits, chain)) };
  }
  for (const included of preset.include || []) {
    merged = { ...merged, ...(await resolve(kind, included, chain)) };
  }
  return { ...merged, ...preset };
}

fs.mkdirSync(outDir, { recursive: true });
for (const { kind, name, file } of PRESETS) {
  const chain = [];
  const flat = await resolve(kind, name, chain);
  flat.inherits = '';
  flat.from = 'system';
  delete flat.include;
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(flat, null, 2) + '\n');
  console.log(`${file.padEnd(13)} ← ${name}  (항목 ${Object.keys(flat).length}개, 상속 ${chain.length}단계)`);
}
console.log(`\n${outDir} 에 저장했습니다. (OrcaSlicer ${ORCA_TAG})`);
