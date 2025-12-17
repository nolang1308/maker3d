import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

// ES module에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getPrintTime(stlFilePath) {
  const tempDir = path.join(__dirname, 'temp');
  const outputFileName = `output-${Date.now()}.gcode`;
  const outputFilePath = path.join(tempDir, outputFileName);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // 환경 변수로 경로가 지정된 경우 우선 사용
    let prusaSlicerPath = process.env.PRUSA_SLICER_PATH;

    // 환경 변수가 없으면 OS별 기본 경로 사용
    if (!prusaSlicerPath) {
      const platform = process.platform;

      if (platform === 'win32') {
        // Windows
        prusaSlicerPath = 'C:\\Program Files\\Prusa3D\\PrusaSlicer\\prusa-slicer-console.exe';
      } else if (platform === 'darwin') {
        // macOS
        prusaSlicerPath = '/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer';
      } else {
        // Linux (production)
        prusaSlicerPath = '/opt/prusaslicer/prusaslicer/bin/prusa-slicer';
      }
    }

    // 설정 파일이 있으면 사용, 없으면 개별 설정 사용
    const configFile = path.join(__dirname, 'prusa-config.ini');
    let command;

    if (fs.existsSync(configFile)) {
      command = `"${prusaSlicerPath}" --export-gcode --output "${outputFilePath}" --load "${configFile}" "${stlFilePath}"`;
    } else {
      command = `"${prusaSlicerPath}" --export-gcode --output "${outputFilePath}" --print-settings "0.20mm STRUCTURAL @XLIS 0.4" --fill-density 100% "${stlFilePath}"`;
    }

    console.log(`PrusaSlicer 실행 중: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000
    });

    if (stderr && !stderr.includes('Loading')) {
      console.warn('PrusaSlicer stderr:', stderr);
    }

    if (!fs.existsSync(outputFilePath)) {
      throw new Error('G-code 파일이 생성되지 않았습니다.');
    }

    console.log('G-code 파일 생성 완료, 시간 정보 추출 중...');

    const printTime = await extractPrintTimeFromGcode(outputFilePath);

    // 디버깅을 위해 임시로 파일을 남겨둠
    // fs.unlinkSync(outputFilePath);
    console.log('임시 G-code 파일:', outputFilePath);

    return printTime;

  } catch (error) {
    if (fs.existsSync(outputFilePath)) {
      fs.unlinkSync(outputFilePath);
    }

    if (error.code === 'ENOENT') {
      const platform = process.platform;
      let errorMsg = 'PrusaSlicer가 설치되지 않았거나 경로를 찾을 수 없습니다.';

      if (platform === 'win32') {
        errorMsg += '\nWindows 기본 경로: C:\\Program Files\\Prusa3D\\PrusaSlicer\\prusa-slicer-console.exe';
      } else if (platform === 'darwin') {
        errorMsg += '\nmacOS 기본 경로: /Applications/PrusaSlicer.app';
      } else {
        errorMsg += '\nLinux 기본 경로: /opt/prusaslicer/prusaslicer/bin/prusa-slicer';
      }

      errorMsg += '\n또는 PRUSA_SLICER_PATH 환경 변수로 경로를 지정하세요.';
      throw new Error(errorMsg);
    }

    throw new Error(`PrusaSlicer 실행 오류: ${error.message}`);
  }
}

async function extractPrintTimeFromGcode(gcodeFilePath) {
  try {
    const gcodeContent = fs.readFileSync(gcodeFilePath, 'utf8');
    console.log('G-code 파일 크기:', gcodeContent.length);

    // G-code 파일 시작 부분 로깅
    const lines = gcodeContent.split('\n');
    console.log('G-code 파일 첫 50줄:');
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      if (lines[i].includes(';') && (lines[i].toLowerCase().includes('time') || lines[i].toLowerCase().includes('estimated'))) {
        console.log(`Line ${i}: ${lines[i]}`);
      }
    }

    const timePatterns = [
      /estimated printing time \(normal mode\)=(.+)/i,
      /estimated printing time \(silent mode\)=(.+)/i,
      /; estimated printing time \(normal mode\) = (.+)/i,
      /; estimated total print time: (.+)/i,
      /; TIME:(\d+)/i,
      /; Print time: (.+)/i,
      /; Estimated print time: (.+)/i,
      /; total print time: (.+)/i,
      /; printing time: (.+)/i,
      /; est\. printing time: (.+)/i
    ];

    for (const pattern of timePatterns) {
      const match = gcodeContent.match(pattern);
      if (match) {
        let timeString = match[1].trim();
        console.log(`시간 패턴 매치: ${pattern.source} -> ${timeString}`);

        if (pattern.source.includes('TIME:')) {
          const seconds = parseInt(timeString);
          return formatTime(seconds);
        }

        return timeString;
      }
    }

    // 모든 시간 관련 주석 라인 찾기
    console.log('시간 관련 주석 라인들:');
    for (let i = 0; i < Math.min(200, lines.length); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes(';') && (line.includes('time') || line.includes('duration') || line.includes('estimated'))) {
        console.log(`Line ${i}: ${lines[i]}`);
      }
    }

    return '시간 정보를 찾을 수 없음';

  } catch (error) {
    throw new Error(`G-code 파일 분석 오류: ${error.message}`);
  }
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

export { getPrintTime };
