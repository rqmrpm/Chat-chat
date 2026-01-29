// js/randomchat.js
import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { ref, push, get, set, onValue, remove } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { WebRTCManager } from './webrtc.js';
import { deductCookies, updatePoints, COSTS, REWARDS, showToast } from './utils.js';

// تحقق تسجيل الدخول
auth.onAuthStateChanged(user => {
  if (!user) window.location.href = "index.html";
});

// عناصر DOM
const chatDiv = document.getElementById('chat');
const msgInput = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const settingsBtn = document.getElementById('settingsBtn');
const statusDiv = document.getElementById('status');
const nextBtn = document.getElementById('nextBtn');
const stopBtn = document.getElementById('stopBtn');

let roomId = null;
let webrtc = null;
let isSearching = false;

// إنشاء/الانضمام لغرفة عشوائية
async function joinRandomRoom() {
  if (isSearching) return;
  
  // التحقق من الرصيد
  const canAfford = await deductCookies(auth.currentUser.uid, COSTS.RANDOM_CHAT);
  if (!canAfford) {
    showToast('رصيدك غير كافي! تحتاج ' + COSTS.RANDOM_CHAT + ' كوكيز', 'error');
    return;
  }
  
  isSearching = true;
  updateStatus('🔍 جاري البحث عن شخص...');
  
  const roomsRef = ref(db, 'rooms/');
  const snapshot = await get(roomsRef);
  const rooms = snapshot.val() || {};
  
  let joined = false;
  
  // البحث عن غرفة فارغة (فيها مستخدم واحد فقط)
  for (const key in rooms) {
    const room = rooms[key];
    if (room.user2 === null && room.user1 !== auth.currentUser.uid) {
      // وجدنا غرفة!
      roomId = key;
      
      // الانضمام للغرفة
      await set(ref(db, `rooms/${roomId}`), {
        user1: room.user1,
        user2: auth.currentUser.uid,
        createdAt: room.createdAt
      });
      
      joined = true;
      startWebRTC(false); // نحن المستقبل
      break;
    }
  }
  
  // إذا لم نجد غرفة، ننشئ واحدة جديدة
  if (!joined) {
    const newRoomRef = push(roomsRef);
    roomId = newRoomRef.key;
    
    await set(newRoomRef, {
      user1: auth.currentUser.uid,
      user2: null,
      createdAt: Date.now()
    });
    
    updateStatus('⏳ في انتظار شخص آخر...');
    
    // الاستماع لانضمام شخص آخر
    onValue(ref(db, `rooms/${roomId}/user2`), (snapshot) => {
      if (snapshot.exists() && snapshot.val()) {
        startWebRTC(true); // نحن المبادر
      }
    });
  }
}

// بدء WebRTC
function startWebRTC(isInitiator) {
  updateStatus('🔗 جاري الاتصال...');
  
  webrtc = new WebRTCManager(db, roomId, auth.currentUser.uid);
  
  webrtc.onConnected(() => {
    isSearching = false;
    updateStatus('✅ متصل! يمكنك البدء بالدردشة');
    showToast('تم الاتصال بنجاح!', 'success');
    msgInput.disabled = false;
    sendBtn.disabled = false;
    nextBtn.style.display = 'inline-block';
    stopBtn.style.display = 'inline-block';
  });
  
  webrtc.onMessage((data) => {
    const message = typeof data === 'object' ? data.content : data;
    displayMessage(message, false);
  });
  
  webrtc.onDisconnected(() => {
    updateStatus('⚠️ انقطع الاتصال');
    showToast('انقطع الاتصال مع الطرف الآخر', 'error');
    cleanup();
  });
  
  webrtc.init(isInitiator);
}

// إرسال رسالة
sendBtn.onclick = async () => {
  const text = msgInput.value.trim();
  if (!text) return;
  
  if (webrtc && webrtc.send(text)) {
    displayMessage(text, true);
    msgInput.value = '';
    
    // إضافة نقطة لكل رسالة
    await updatePoints(auth.currentUser.uid, REWARDS.MESSAGE_SENT);
  } else {
    showToast('الاتصال غير جاهز!', 'error');
  }
};

// Enter للإرسال
msgInput.onkeypress = (e) => {
  if (e.key === 'Enter') {
    sendBtn.click();
  }
};

// عرض رسالة
function displayMessage(text, isMine) {
  const div = document.createElement('div');
  div.className = isMine ? 'my-msg' : 'other-msg';
  div.textContent = text;
  chatDiv.appendChild(div);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

// تحديث الحالة
function updateStatus(text) {
  if (statusDiv) {
    statusDiv.textContent = text;
  }
}

// البحث عن شخص آخر
if (nextBtn) {
  nextBtn.onclick = async () => {
    cleanup();
    chatDiv.innerHTML = '';
    await joinRandomRoom();
  };
}

// إيقاف الدردشة
if (stopBtn) {
  stopBtn.onclick = () => {
    cleanup();
    window.location.href = 'dashboard.html';
  };
}

// تنظيف الموارد
async function cleanup() {
  if (webrtc) {
    await webrtc.close();
    webrtc = null;
  }
  
  if (roomId) {
    // حذف الغرفة
    await remove(ref(db, `rooms/${roomId}`));
    roomId = null;
  }
  
  isSearching = false;
  msgInput.disabled = true;
  sendBtn.disabled = true;
  if (nextBtn) nextBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'none';
  updateStatus('');
}

// زر الإعدادات
if (settingsBtn) {
  settingsBtn.onclick = () => {
    if (confirm("تسجيل الخروج؟")) {
      cleanup();
      signOut(auth).then(() => window.location.href = "index.html");
    }
  };
}

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', cleanup);

// البدء تلقائياً
joinRandomRoom();
