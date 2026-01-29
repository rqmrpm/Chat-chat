// js/utils.js
import { db, auth } from './firebase-config.js';
import { ref, get, set, update } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

// جلب بيانات المستخدم
export async function getUserData(uid) {
  const snapshot = await get(ref(db, `users/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
}

// تحديث رصيد الكوكيز
export async function updateCookies(uid, amount) {
  const userData = await getUserData(uid);
  if (!userData) return false;
  
  const newCookies = (userData.cookies || 0) + amount;
  if (newCookies < 0) return false; // لا يمكن أن يكون الرصيد سالب
  
  await update(ref(db, `users/${uid}`), {
    cookies: newCookies
  });
  
  return true;
}

// تحديث النقاط
export async function updatePoints(uid, amount) {
  const userData = await getUserData(uid);
  if (!userData) return false;
  
  const newPoints = (userData.points || 0) + amount;
  
  await update(ref(db, `users/${uid}`), {
    points: newPoints
  });
  
  return true;
}

// خصم كوكيز (للألعاب والدردشة)
export async function deductCookies(uid, cost) {
  const userData = await getUserData(uid);
  if (!userData) return false;
  
  const currentCookies = userData.cookies || 0;
  if (currentCookies < cost) {
    return false; // رصيد غير كافي
  }
  
  await update(ref(db, `users/${uid}`), {
    cookies: currentCookies - cost
  });
  
  return true;
}

// حظر/إلغاء حظر مستخدم
export async function toggleBanUser(uid, banned) {
  await update(ref(db, `users/${uid}`), {
    banned: banned,
    bannedAt: banned ? Date.now() : null
  });
}

// التحقق من حظر المستخدم
export async function isUserBanned(uid) {
  const userData = await getUserData(uid);
  return userData ? (userData.banned || false) : false;
}

// تنسيق التاريخ
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('ar-SA') + ' ' + date.toLocaleTimeString('ar-SA');
}

// عرض رسالة Toast
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// تكاليف الألعاب والدردشة
export const COSTS = {
  RANDOM_CHAT: 5,      // كوكيز للدردشة العشوائية
  CHESS_GAME: 10,      // كوكيز للعبة الشطرنج
  BILLIARD_GAME: 15,   // كوكيز للعبة البلياردو
  PRIVATE_CHAT: 0      // الدردشة الخاصة مجانية
};

// مكافآت الألعاب
export const REWARDS = {
  CHESS_WIN: 20,       // نقاط للفوز بالشطرنج
  CHESS_DRAW: 10,      // نقاط للتعادل
  BILLIARD_WIN: 30,    // نقاط للفوز بالبلياردو
  MESSAGE_SENT: 1      // نقطة لكل رسالة
};
