import { getDatabase, ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { app } from './firebase/config.js'; // ربط Firebase

const db = getDatabase(app);
const auth = getAuth(app);

const chatListDiv = document.getElementById('chatList');
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

let currentChatId = null;

// تحميل قائمة الدردشات
function loadChats() {
  const user = auth.currentUser;
  if (!user) return;
  
  const chatsRef = ref(db, `userChats/${user.uid}`);
  onChildAdded(chatsRef, snapshot => {
    const chatId = snapshot.key;
    const chatDiv = document.createElement('div');
    chatDiv.textContent = snapshot.val().name || 'دردشة';
    chatDiv.onclick = () => openChat(chatId);
    chatListDiv.appendChild(chatDiv);
  });
}

// فتح دردشة
function openChat(chatId) {
  currentChatId = chatId;
  messagesDiv.innerHTML = '';
  
  const messagesRef = ref(db, `messages/${chatId}`);
  onChildAdded(messagesRef, snapshot => {
    const data = snapshot.val();
    const msgElem = document.createElement('div');
    msgElem.textContent = `${data.senderName}: ${data.text}`;
    messagesDiv.appendChild(msgElem);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// إرسال رسالة
sendBtn.onclick = () => {
  const text = msgInput.value.trim();
  if (!text || !currentChatId) return;
  
  const user = auth.currentUser;
  push(ref(db, `messages/${currentChatId}`), {
    senderId: user.uid,
    senderName: user.displayName || user.email,
    text
  });
  msgInput.value = '';
}

// تهيئة
loadChats();
