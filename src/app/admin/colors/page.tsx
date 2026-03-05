'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './page.module.scss';
import {
  MATERIALS,
  TRANSPARENT_SENTINEL,
  ColorOption,
  getAllMaterialColors,
  toggleColorAvailability,
  addColor,
  deleteColor,
} from '@/services/colorService';

export default function AdminColorsPage() {
  const [selectedMaterial, setSelectedMaterial] = useState(MATERIALS[0]);
  const [colorsMap, setColorsMap] = useState<Record<string, ColorOption[]>>({});
  const [loading, setLoading] = useState(true);

  // 추가 폼 상태
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#');
  const [newCode, setNewCode] = useState('');
  const [newIsTransparent, setNewIsTransparent] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const data = await getAllMaterialColors();
      setColorsMap(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(colorName: string) {
    try {
      await toggleColorAvailability(selectedMaterial, colorName);
      setColorsMap((prev) => ({
        ...prev,
        [selectedMaterial]: (prev[selectedMaterial] ?? []).map((c) =>
          c.name === colorName ? { ...c, available: !c.available } : c
        ),
      }));
    } catch (error) {
      console.error('토글 에러:', error);
      alert('상태 변경에 실패했습니다.');
    }
  }

  async function handleDelete(colorName: string) {
    if (!confirm(`"${colorName}" 색상을 삭제하시겠습니까?`)) return;
    try {
      await deleteColor(selectedMaterial, colorName);
      setColorsMap((prev) => ({
        ...prev,
        [selectedMaterial]: (prev[selectedMaterial] ?? []).filter((c) => c.name !== colorName),
      }));
    } catch (error) {
      console.error('삭제 에러:', error);
      alert('색상 삭제에 실패했습니다.');
    }
  }

  async function handleAdd() {
    const trimmedName = newName.trim();
    const trimmedCode = newCode.trim();
    const hex = newIsTransparent ? TRANSPARENT_SENTINEL : newHex.trim();

    if (!trimmedName) { alert('색상 이름을 입력해주세요.'); return; }
    if (!trimmedCode) { alert('색상 코드를 입력해주세요.'); return; }
    if (!newIsTransparent && !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      alert('HEX 코드는 #XXXXXX 형식으로 입력해주세요. (예: #FF5733)');
      return;
    }

    const currentColors = colorsMap[selectedMaterial] ?? [];
    if (currentColors.some((c) => c.name === trimmedName)) {
      alert('이미 동일한 이름의 색상이 존재합니다.');
      return;
    }

    setAdding(true);
    try {
      const newColor: ColorOption = { name: trimmedName, code: trimmedCode, hex, available: true };
      await addColor(selectedMaterial, newColor);
      setColorsMap((prev) => ({
        ...prev,
        [selectedMaterial]: [...(prev[selectedMaterial] ?? []), newColor],
      }));
      setNewName('');
      setNewHex('#');
      setNewCode('');
      setNewIsTransparent(false);
    } catch (error) {
      console.error('추가 에러:', error);
      alert('색상 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  }

  const currentColors = colorsMap[selectedMaterial] ?? [];

  return (
    <div className={styles.container}>
      <div className={styles.ManagerSignatureBar}>
        <Image src="/Icon_smile.svg" width={24} height={24} alt="" />
        <p>관리자</p>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>색상관리</h1>
        </div>

        {/* 소재 탭 */}
        <div className={styles.materialTabs}>
          {MATERIALS.map((m) => (
            <button
              key={m}
              className={`${styles.materialTab} ${selectedMaterial === m ? styles.active : ''}`}
              onClick={() => setSelectedMaterial(m)}
            >
              {m}
            </button>
          ))}
        </div>

        {/* 2열 레이아웃 */}
        <div className={styles.columns}>

          {/* 왼쪽: 등록된 색상 목록 */}
          <div className={styles.colorListPanel}>
            {loading ? (
              <div className={styles.stateText}>색상 정보를 불러오는 중...</div>
            ) : currentColors.length === 0 ? (
              <div className={styles.stateText}>등록된 색상이 없습니다.</div>
            ) : (
              <div className={styles.colorListScroll}>
                {currentColors.map((c) => {
                  const isTransparent = c.hex === TRANSPARENT_SENTINEL;
                  return (
                    <div key={c.code} className={styles.colorItem}>
                      <div className={styles.colorLeft}>
                        <div
                          className={`${styles.colorPreview} ${isTransparent ? styles.transparent : ''}`}
                          style={isTransparent ? undefined : { backgroundColor: c.hex }}
                        />
                        <div className={styles.colorMeta}>
                          <span className={styles.colorName}>{c.name}</span>
                          <span className={styles.colorHex}>
                            {isTransparent ? '투명' : c.hex} · {c.code}
                          </span>
                        </div>
                      </div>
                      <div className={styles.colorActions}>
                        <label className={styles.toggleWrapper}>
                          <span className={`${styles.toggleLabel} ${c.available ? styles.on : ''}`}>
                            {c.available ? '판매중' : '품절'}
                          </span>
                          <span className={styles.toggle}>
                            <input
                              type="checkbox"
                              checked={c.available}
                              onChange={() => handleToggle(c.name)}
                            />
                            <span className={styles.toggleSlider} />
                          </span>
                        </label>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(c.name)}
                          aria-label={`${c.name} 삭제`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 오른쪽: 색상 추가 폼 */}
          <div className={styles.addForm}>
          <h2>색상 추가</h2>
          <div className={styles.formRow}>
            <label htmlFor="colorName">색상 이름</label>
            <input
              id="colorName"
              type="text"
              placeholder="예: 화이트"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="colorCode">색상 코드</label>
            <input
              id="colorCode"
              type="text"
              placeholder="예: W001"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="colorHex">HEX 코드</label>
            <div className={styles.hexInputRow}>
              <input
                id="colorHex"
                type="text"
                placeholder="#F5F5F0"
                value={newIsTransparent ? TRANSPARENT_SENTINEL : newHex}
                onChange={(e) => setNewHex(e.target.value)}
                disabled={newIsTransparent}
              />
              <div
                className={`${styles.hexPreview} ${newIsTransparent ? styles.transparent : ''}`}
                style={
                  newIsTransparent
                    ? undefined
                    : /^#[0-9A-Fa-f]{6}$/.test(newHex)
                    ? { backgroundColor: newHex }
                    : { backgroundColor: '#E5E5EA' }
                }
              />
            </div>
          </div>
          <div className={styles.checkboxRow}>
            <input
              id="transparentCheck"
              type="checkbox"
              checked={newIsTransparent}
              onChange={(e) => setNewIsTransparent(e.target.checked)}
            />
            <label htmlFor="transparentCheck">투명 색상</label>
          </div>
          <button className={styles.addBtn} onClick={handleAdd} disabled={adding}>
            {adding ? '추가 중...' : '추가하기'}
          </button>
          </div>

        </div>{/* columns */}
      </div>
    </div>
  );
}
