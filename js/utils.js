import { db } from './firebase-config.js';
import { ref, get, update, increment, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

// --- النظام المالي المؤمن ---
export async function updateCookies(uid, amount) {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, { cookies: increment(amount) });
}

export async function deductCookies(uid, amount) {
    const userRef = ref(db, `users/${uid}`);
    const snapshot = await get(userRef);
    const currentCookies = snapshot.val().cookies || 0;
    if (currentCookies < amount) throw new Error("رصيدك غير كافي!");
    await update(userRef, { cookies: increment(-amount) });
}

export async function updatePoints(uid, amount) {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, { points: increment(amount) });
}

// --- نظام المراسلة الفورية ---
export async function sendMessage(fromUid, toUid, text, gameId = null) {
    const chatPath = gameId ? `gameChats/${gameId}` : `directChats/${[fromUid, toUid].sort().join('_')}`;
    const chatRef = ref(db, chatPath);
    await push(chatRef, {
        sender: fromUid,
        text: text,
        timestamp: serverTimestamp()
    });
}

// --- وظائف مساعدة ---
export async function getUserData(uid) {
    const snapshot = await get(ref(db, `users/${uid}`));
    return snapshot.val();
}

export async function isUserBanned(uid) {
    const snapshot = await get(ref(db, `users/${uid}/banned`));
    return snapshot.val() === true;
}

export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
