import { MATERIALS } from '@/services/colorService';

export interface MaterialOption {
  value: string;
  label: string;
  hint: string;
}

// 소재 한 줄 설명. 고객 문의의 "소재별로 차이를 알고싶습니다" 답변에서 간추렸다
// (TPU 는 그 답변에 없어 소재의 일반적인 성질만 적었다)
const MATERIAL_HINTS: Record<string, string> = {
  '광경화성 레진': '곡선이 많은 피규어 · 캐릭터에 적합, 충격에는 약함',
  PLA: '출력 품질이 가장 좋은 기본 소재, 열변형 50~60℃',
  ABS: '열에 강한 소재, 열변형 70~80℃',
  PETG: 'PLA와 ABS의 중간 성질, 열변형 60~70℃',
  TPU: '말랑하고 잘 휘는 탄성 소재',
};

// 고를 수 있는 소재는 색상관리(관리자)와 같은 목록에서 가져온다.
// 여기에 따로 적어 두면 한쪽에만 추가돼 선택 상자에서 빠지는 일이 생긴다
export const MATERIAL_OPTIONS: MaterialOption[] = MATERIALS.map((name) => ({
  value: name,
  label: name,
  hint: MATERIAL_HINTS[name] ?? '',
}));

// 고객 문의 > 재료가이드 > "소재별로 차이를 알고싶습니다"
export const MATERIAL_GUIDE_URL = '/contact?questionId=5';

export const FILE_SIZE_LIMIT_MB = 64;
export const PRINT_SIZE_LIMIT_MM = 350;

// 슬라이서가 돌려주는 "1d 2h 30m 15s" 꼴을 "1일 2시간 30분"으로 바꾼다
export function formatPrintTime(raw: string): string {
  const pick = (unit: string) => {
    const found = raw.match(new RegExp(`(\\d+)\\s*${unit}`));
    return found ? parseInt(found[1], 10) : 0;
  };
  const days = pick('d');
  const hours = pick('h');
  const minutes = pick('m');
  const seconds = pick('s');

  if (days + hours + minutes + seconds === 0) return raw;
  if (days + hours + minutes === 0) return '1분 미만';

  const parts: string[] = [];
  if (days) parts.push(`${days}일`);
  if (hours) parts.push(`${hours}시간`);
  if (minutes) parts.push(`${minutes}분`);
  return parts.join(' ');
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

export function fileExtension(name: string): string {
  const ext = name.split('.').pop() ?? '';
  return ext.length > 0 && ext.length <= 4 ? ext.toUpperCase() : '3D';
}
