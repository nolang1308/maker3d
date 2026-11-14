/** 2D 편집 화면에서 입체감을 내는 데 쓰는 간단한 색 계산 */

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** hex 색을 target 쪽으로 amount(0~1)만큼 섞는다 */
export function mixHex(hex: string, target: string, amount: number): string {
  const a = parseHex(hex);
  const b = parseHex(target);
  const t = Math.min(1, Math.max(0, amount));
  const mixed = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** 체감 밝기 (0 어두움 ~ 1 밝음) */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
