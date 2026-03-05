import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export const TRANSPARENT_SENTINEL = 'TRANSPARENT';

export interface ColorOption {
  name: string;
  code: string;
  hex: string;
  available: boolean;
}

export const MATERIALS = ['광경화성 레진', 'PLA', 'ABS', 'PETG', 'TPU'];

const DEFAULT_COLORS: Record<string, ColorOption[]> = {
  '광경화성 레진': [
    { name: '화이트',    code: 'W001', hex: '#F5F5F0', available: true },
    { name: '블랙',      code: 'B001', hex: '#1A1A1A', available: true },
    { name: '그레이',    code: 'G001', hex: '#9E9E9E', available: true },
    { name: '다크그레이', code: 'G002', hex: '#424242', available: true },
    { name: '빨강',      code: 'R001', hex: '#D32F2F', available: true },
    { name: '파랑',      code: 'B002', hex: '#1976D2', available: true },
    { name: '네이비',    code: 'N001', hex: '#0D2859', available: true },
    { name: '초록',      code: 'GR01', hex: '#2E7D32', available: true },
    { name: '노랑',      code: 'Y001', hex: '#FDD835', available: true },
    { name: '주황',      code: 'O001', hex: '#F57C00', available: true },
    { name: '보라',      code: 'P001', hex: '#6A1B9A', available: true },
    { name: '청록',      code: 'C001', hex: '#00838F', available: true },
    { name: '투명',      code: 'T001', hex: TRANSPARENT_SENTINEL, available: true },
  ],
  'PLA': [
    { name: '화이트',    code: 'W001', hex: '#F5F5F0', available: true },
    { name: '블랙',      code: 'B001', hex: '#1A1A1A', available: true },
    { name: '그레이',    code: 'G001', hex: '#9E9E9E', available: true },
    { name: '다크그레이', code: 'G002', hex: '#424242', available: true },
    { name: '빨강',      code: 'R001', hex: '#D32F2F', available: true },
    { name: '파랑',      code: 'B002', hex: '#1976D2', available: true },
    { name: '네이비',    code: 'N001', hex: '#0D2859', available: true },
    { name: '초록',      code: 'GR01', hex: '#2E7D32', available: true },
    { name: '노랑',      code: 'Y001', hex: '#FDD835', available: true },
    { name: '주황',      code: 'O001', hex: '#F57C00', available: true },
    { name: '보라',      code: 'P001', hex: '#6A1B9A', available: true },
    { name: '청록',      code: 'C001', hex: '#00838F', available: true },
  ],
  'ABS': [
    { name: '화이트',    code: 'W001', hex: '#F5F5F0', available: true },
    { name: '블랙',      code: 'B001', hex: '#1A1A1A', available: true },
    { name: '그레이',    code: 'G001', hex: '#9E9E9E', available: true },
    { name: '다크그레이', code: 'G002', hex: '#424242', available: true },
    { name: '빨강',      code: 'R001', hex: '#D32F2F', available: true },
    { name: '파랑',      code: 'B002', hex: '#1976D2', available: true },
    { name: '네이비',    code: 'N001', hex: '#0D2859', available: true },
    { name: '초록',      code: 'GR01', hex: '#2E7D32', available: true },
    { name: '노랑',      code: 'Y001', hex: '#FDD835', available: true },
    { name: '주황',      code: 'O001', hex: '#F57C00', available: true },
    { name: '보라',      code: 'P001', hex: '#6A1B9A', available: true },
    { name: '청록',      code: 'C001', hex: '#00838F', available: true },
  ],
  'PETG': [
    { name: '화이트',    code: 'W001', hex: '#F5F5F0', available: true },
    { name: '블랙',      code: 'B001', hex: '#1A1A1A', available: true },
    { name: '그레이',    code: 'G001', hex: '#9E9E9E', available: true },
    { name: '다크그레이', code: 'G002', hex: '#424242', available: true },
    { name: '빨강',      code: 'R001', hex: '#D32F2F', available: true },
    { name: '파랑',      code: 'B002', hex: '#1976D2', available: true },
    { name: '네이비',    code: 'N001', hex: '#0D2859', available: true },
    { name: '초록',      code: 'GR01', hex: '#2E7D32', available: true },
    { name: '노랑',      code: 'Y001', hex: '#FDD835', available: true },
    { name: '주황',      code: 'O001', hex: '#F57C00', available: true },
    { name: '보라',      code: 'P001', hex: '#6A1B9A', available: true },
    { name: '청록',      code: 'C001', hex: '#00838F', available: true },
    { name: '투명',      code: 'T001', hex: TRANSPARENT_SENTINEL, available: true },
  ],
  'TPU': [
    { name: '화이트',    code: 'W001', hex: '#F5F5F0', available: true },
    { name: '블랙',      code: 'B001', hex: '#1A1A1A', available: true },
    { name: '그레이',    code: 'G001', hex: '#9E9E9E', available: true },
    { name: '빨강',      code: 'R001', hex: '#D32F2F', available: true },
    { name: '파랑',      code: 'B002', hex: '#1976D2', available: true },
    { name: '초록',      code: 'GR01', hex: '#2E7D32', available: true },
  ],
};

export async function getMaterialColors(material: string): Promise<ColorOption[]> {
  try {
    const docRef = doc(db, 'materialColors', material);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return (data.colors as ColorOption[]) ?? [];
    }
    // 문서 없으면 기본값 반환 (쓰기 없음 — 비로그인 사용자도 접근)
    return DEFAULT_COLORS[material] ?? [];
  } catch (error) {
    console.error(`색상 조회 에러 (${material}):`, error);
    return DEFAULT_COLORS[material] ?? [];
  }
}

export async function getAllMaterialColors(): Promise<Record<string, ColorOption[]>> {
  const results = await Promise.all(
    MATERIALS.map(async (m) => ({ material: m, colors: await getMaterialColors(m) }))
  );
  return Object.fromEntries(results.map(({ material, colors }) => [material, colors]));
}

export async function setMaterialColors(material: string, colors: ColorOption[]): Promise<void> {
  await setDoc(doc(db, 'materialColors', material), {
    colors,
    updatedAt: Timestamp.now(),
  });
}

export async function toggleColorAvailability(material: string, colorName: string): Promise<void> {
  const colors = await getMaterialColors(material);
  const updated = colors.map((c) =>
    c.name === colorName ? { ...c, available: !c.available } : c
  );
  await setMaterialColors(material, updated);
}

export async function addColor(material: string, color: ColorOption): Promise<void> {
  const colors = await getMaterialColors(material);
  await setMaterialColors(material, [...colors, color]);
}

export async function deleteColor(material: string, colorName: string): Promise<void> {
  const colors = await getMaterialColors(material);
  await setMaterialColors(material, colors.filter((c) => c.name !== colorName));
}
