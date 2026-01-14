'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.scss';
import Image from 'next/image';

interface CartItem {
  id: string;
  name: string;
  image: string;
  option: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      const items = JSON.parse(savedCart);
      setCartItems(items);
      // 기본적으로 모든 상품 선택
      setSelectedItems(new Set(items.map((_: any, index: number) => index)));
    }
  }, []);

  // 수량 변경
  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    const updatedCart = [...cartItems];
    updatedCart[index].quantity = newQuantity;
    updatedCart[index].totalPrice = updatedCart[index].unitPrice * newQuantity;
    
    setCartItems(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  // 상품 삭제
  const removeItem = (index: number) => {
    const updatedCart = cartItems.filter((_, i) => i !== index);
    setCartItems(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    
    // 선택된 항목에서도 제거
    const newSelectedItems = new Set<number>();
    selectedItems.forEach(selectedIndex => {
      if (selectedIndex < index) {
        newSelectedItems.add(selectedIndex);
      } else if (selectedIndex > index) {
        newSelectedItems.add(selectedIndex - 1);
      }
    });
    setSelectedItems(newSelectedItems);
  };

  // 개별 상품 선택/해제
  const toggleItemSelection = (index: number) => {
    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(index)) {
      newSelectedItems.delete(index);
    } else {
      newSelectedItems.add(index);
    }
    setSelectedItems(newSelectedItems);
  };

  // 전체 선택/해제
  const toggleAllSelection = () => {
    if (selectedItems.size === cartItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(cartItems.map((_, index) => index)));
    }
  };

  // 선택된 상품들의 총 금액 계산
  const selectedTotalAmount = cartItems.reduce((sum, item, index) => {
    return selectedItems.has(index) ? sum + item.totalPrice : sum;
  }, 0);

  // 주문하기
  const handleOrder = () => {
    if (selectedItems.size === 0) {
      alert('주문할 상품을 선택해 주세요.');
      return;
    }

    // 선택된 상품들만 필터링
    const selectedCartItems = cartItems.filter((_, index) => selectedItems.has(index));
    
    // 선택된 상품들을 localStorage에 임시 저장
    localStorage.setItem('cart', JSON.stringify(selectedCartItems));
    
    // 주문서 페이지로 이동
    router.push('/order');
  };

  // 쇼핑 계속하기
  const continueShopping = () => {
    router.push('/store');
  };

  if (cartItems.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.innerContainer}>
          <div className={styles.emptyCart}>
            <h2>장바구니가 비어있습니다</h2>
            <p>마음에 드는 상품을 장바구니에 담아보세요!</p>
            <button onClick={continueShopping}>쇼핑 계속하기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <h1 className={styles.pageTitle}>장바구니</h1>

        <div className={styles.cartContent}>
          {/* 상품 목록 */}
          <div className={styles.cartSection}>
            <div className={styles.cartHeader}>
              <label className={styles.selectAllLabel}>
                <input
                  type="checkbox"
                  checked={selectedItems.size === cartItems.length && cartItems.length > 0}
                  onChange={toggleAllSelection}
                />
                전체선택 ({selectedItems.size}/{cartItems.length})
              </label>
              <button
                className={styles.deleteButton}
                onClick={() => {
                  const indicesToRemove = Array.from(selectedItems).sort((a, b) => b - a);
                  indicesToRemove.forEach(index => removeItem(index));
                }}
                disabled={selectedItems.size === 0}
              >
                선택삭제
              </button>
            </div>

            <div className={styles.cartItems}>
              {cartItems.map((item, index) => (
                <div key={index} className={styles.cartItem}>
                  <label className={styles.itemCheckbox}>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(index)}
                      onChange={() => toggleItemSelection(index)}
                    />
                  </label>
                  
                  <div className={styles.itemInfo}>
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={100}
                      height={100}
                      className={styles.itemImage}
                    />
                    <div className={styles.itemDetails}>
                      <h3>{item.name}</h3>
                      <p className={styles.itemOption}>옵션: {item.option}</p>
                      <p className={styles.itemPrice}>₩{item.unitPrice.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className={styles.quantityControl}>
                    <button 
                      onClick={() => updateQuantity(index, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(index, item.quantity + 1)}>
                      +
                    </button>
                  </div>

                  <div className={styles.itemTotalPrice}>
                    ₩{item.totalPrice.toLocaleString()}
                  </div>

                  <button 
                    className={styles.removeButton}
                    onClick={() => removeItem(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 주문 요약 */}
          <div className={styles.orderSummary}>
            <h3>주문 요약</h3>
            <div className={styles.summaryItem}>
              <span>선택상품 ({selectedItems.size}개)</span>
              <span>₩{selectedTotalAmount.toLocaleString()}</span>
            </div>
            <div className={styles.summaryItem}>
              <span>배송비</span>
              <span>₩3,000</span>
            </div>
            <div className={styles.summaryDivider}></div>
            <div className={styles.summaryTotal}>
              <span>총 결제금액</span>
              <span>₩{(selectedTotalAmount + 3000).toLocaleString()}</span>
            </div>
            
            <button 
              className={styles.orderButton}
              onClick={handleOrder}
              disabled={selectedItems.size === 0}
            >
              주문하기
            </button>
            <button 
              className={styles.continueButton}
              onClick={continueShopping}
            >
              쇼핑 계속하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}