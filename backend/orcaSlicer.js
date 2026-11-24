// 오르카 슬라이서로 출력 시간 · 재료 무게 계산
//
// 기준: Original Prusa XL, 0.4 노즐, 0.20mm Structural  (orca-profiles/ 의 설정 파일)
// 기준을 바꾸려면 scripts/make-orca-profiles.mjs 를 고쳐 다시 실행합니다.

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

// 셸을 거치지 않고 슬라이서를 직접 실행한다 (파일 이름에 든 글자가 명령으로 실행되지 않게)
const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, 'orca-profiles');

// 슬라이싱 제한 시간. 서버 CPU 가 느리면 SLICE_TIMEOUT_MS 로 늘린다.
const SLICE_TIMEOUT_MS = Number(process.env.SLICE_TIMEOUT_MS) || 60000;

// 소재 → 필라멘트 설정 파일. 여기에 없는 소재(광경화성 레진 등)는 오르카로 계산하지 않는다.
const FILAMENT_PROFILES = {
  PLA: 'PLA.json',
  PETG: 'PETG.json',
  ABS: 'ABS.json',
  TPU: 'TPU.json',
};

// 슬라이서가 "판 안에 들어가지 않는다"고 끝낼 때의 종료 코드
const EXIT_OUTSIDE_PRINT_VOLUME = 206;

function orcaSupports(material) {
  return Object.hasOwn(FILAMENT_PROFILES, material);
}

function orcaSlicerPath() {
  if (process.env.ORCA_SLICER_PATH) {
    return process.env.ORCA_SLICER_PATH;
  }
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\OrcaSlicer\\orca-slicer.exe';
  }
  if (process.platform === 'darwin') {
    return '/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer';
  }
  return '/opt/orca/AppRun';
}

// 슬라이서가 남긴 글에서 오류 설명 줄을 고른다.
// 맨 끝의 "run found error, ..." 는 설명이 아니라 끝맺는 말이라 건너뛴다.
function lastLine(text) {
  const lines = String(text || '').split('\n').map(line => line.trim()).filter(Boolean)
    .filter(line => !line.startsWith('run found error'));
  return lines[lines.length - 1] || '';
}

// 모델을 슬라이싱해서 { seconds: 전체 출력 시간(초), weightGrams: 재료 무게(g) } 를 돌려준다
async function getOrcaEstimate(modelPath, material) {
  const filamentFile = FILAMENT_PROFILES[material];
  if (!filamentFile) {
    throw new Error(`오르카 슬라이서로 계산할 수 없는 소재입니다: ${material}`);
  }

  const tempRoot = path.join(__dirname, 'temp');
  fs.mkdirSync(tempRoot, { recursive: true });
  // 요청마다 따로 쓰는 작업 폴더. G-code · 통계 · 슬라이서 로그가 여기에 생기고, 끝나면 통째로 지운다.
  const workDir = fs.mkdtempSync(path.join(tempRoot, 'orca-'));

  try {
    const args = [
      '--slice', '0',
      '--arrange', '1',        // 모델을 출력판 가운데에 놓는다 (원래 좌표가 어디든 상관없게)
      '--orient', '0',         // 올린 방향 그대로 계산한다
      '--load-settings', `${path.join(PROFILE_DIR, 'machine.json')};${path.join(PROFILE_DIR, 'process.json')}`,
      '--load-filaments', path.join(PROFILE_DIR, filamentFile),
      '--export-statistics',   // 시간 · 무게를 숫자로 담은 plate_1.statistics.json 을 만든다
      '--outputdir', workDir,
      '--datadir', path.join(workDir, 'data'),
      '--debug', '1',
      path.resolve(modelPath),
    ];

    console.log(`OrcaSlicer 실행 중: 소재 ${material}, 파일 ${path.basename(modelPath)}`);

    await execFileAsync(orcaSlicerPath(), args, {
      cwd: workDir,            // 슬라이서가 실행 위치에 로그 파일을 남긴다
      timeout: SLICE_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });

    const statisticsPath = path.join(workDir, 'plate_1.statistics.json');
    if (!fs.existsSync(statisticsPath)) {
      throw new Error('슬라이싱 결과가 만들어지지 않았습니다.');
    }

    const { summary } = JSON.parse(fs.readFileSync(statisticsPath, 'utf8'));
    const seconds = Number(summary?.time);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error('슬라이싱 결과에서 출력 시간을 읽을 수 없습니다.');
    }

    return {
      seconds,
      weightGrams: Number(summary.weight) || 0,
    };

  } catch (error) {
    if (error.killed) {
      throw new Error(`OrcaSlicer 실행 오류: 계산이 ${Math.round(SLICE_TIMEOUT_MS / 1000)}초 안에 끝나지 않았습니다.`);
    }
    if (error.code === 'ENOENT') {
      throw new Error('OrcaSlicer가 설치되지 않았거나 경로를 찾을 수 없습니다. ORCA_SLICER_PATH 환경 변수로 경로를 지정하세요.');
    }
    if (error.code === EXIT_OUTSIDE_PRINT_VOLUME) {
      throw new Error('모델이 출력 가능한 크기(360 x 360 x 360mm)를 벗어납니다.');
    }
    if (typeof error.code === 'number') {
      // 슬라이서가 스스로 오류로 끝낸 경우: 서버 경로가 든 명령줄 대신 슬라이서의 설명만 전한다
      const reason = (lastLine(error.stdout) || lastLine(error.stderr) || '알 수 없는 오류')
        .split(path.resolve(modelPath)).join('올린 파일');
      throw new Error(`OrcaSlicer 실행 오류 (코드 ${error.code}): ${reason}`);
    }
    throw error;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

// 초 → "1d 4h 33m 58s" 형태 (화면과 기존 계산이 쓰는 표기와 같게)
function formatDuration(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${rest}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${rest}s`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

export { getOrcaEstimate, orcaSupports, formatDuration };
