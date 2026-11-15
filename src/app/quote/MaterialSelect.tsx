'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, Ref } from 'react';
import styles from './MaterialSelect.module.scss';
import type { MaterialOption } from './quoteOptions';

interface MaterialSelectProps {
  options: MaterialOption[];
  value: string;
  onChange: (value: string) => void;
  /** 이 선택 상자의 이름표가 되는 요소의 id */
  labelledBy: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}

// 브라우저 기본 select 대신 쓰는 선택 상자.
// 모양은 사이트 색에 맞추고, 키보드(위 · 아래 · Home · End · Enter · Esc · 글자 입력)로도 고를 수 있다
export default function MaterialSelect({
  options,
  value,
  onChange,
  labelledBy,
  placeholder = '선택해주세요',
  disabled = false,
  invalid = false,
  buttonRef,
}: MaterialSelectProps) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const valueId = `${baseId}-value`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  const isOpen = open && !disabled;

  const openList = (index?: number) => {
    if (disabled) return;
    setActiveIndex(index ?? (selectedIndex >= 0 ? selectedIndex : 0));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    setOpen(false);
    if (option.value !== value) onChange(option.value);
  };

  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  // 키보드로 옮긴 항목이 목록 안에서 보이게 한다
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const item = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, activeIndex]);

  const move = (step: number) => {
    if (!isOpen) {
      openList();
      return;
    }
    setActiveIndex((index) => Math.min(options.length - 1, Math.max(0, index + step)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        return;
      case 'Home':
        if (!isOpen) return;
        event.preventDefault();
        setActiveIndex(0);
        return;
      case 'End':
        if (!isOpen) return;
        event.preventDefault();
        setActiveIndex(options.length - 1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen) choose(activeIndex);
        else openList();
        return;
      case 'Escape':
        if (!isOpen) return;
        event.preventDefault();
        setOpen(false);
        return;
      case 'Tab':
        setOpen(false);
        return;
    }

    // 글자를 치면 그 글자로 시작하는 소재로 옮긴다
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - typed.current.at > 700 ? '' : typed.current.text) + event.key.toLowerCase();
      typed.current = { text, at: now };
      const found = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
      if (found >= 0) {
        if (isOpen) setActiveIndex(found);
        else openList(found);
      }
    }
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''} ${invalid ? styles.triggerInvalid : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-labelledby={`${labelledBy} ${valueId}`}
        aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (isOpen ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
      >
        <span id={valueId} className={styles.triggerText}>
          {selected ? (
            <>
              <span className={styles.triggerLabel}>{selected.label}</span>
              {selected.hint && <span className={styles.triggerHint}>{selected.hint}</span>}
            </>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </span>
        <svg className={styles.chevron} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <ul ref={listRef} id={listId} role="listbox" aria-labelledby={labelledBy} className={styles.list}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${index === activeIndex ? styles.optionActive : ''} ${isSelected ? styles.optionSelected : ''}`}
                // 누르는 동안 버튼이 초점을 잃지 않게 한다
                onPointerDown={(event) => event.preventDefault()}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.hint && <span className={styles.optionHint}>{option.hint}</span>}
                </span>
                <svg className={styles.check} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
