// js/randomchat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, get, child } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

// إعداد Firebase
import { firebaseConfig } from "../firebase/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// تحقق تسجيل الدخول
auth.onAuthStateChanged(user => {
  if (!user) window.location.href = "index.html";
});

// عناصر DOM
const chatDiv = document.getElementById('chat');
const msgInput = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const settingsBtn = document.getElementById('settingsBtn');

let roomId = null;

// إنشاء غرفة عشوائية للمستخدم
function joinRandomRoom() {
  const roomsRef = ref(db, 'randomRooms/');
  
  // نجلب كل الغرف الموجودة
  get(roomsRef).then(snapshot => {
    const rooms = snapshot.val() || {};
    let joined = false;

    // نحاول الانضمام لأي غرفة فيها مستخدمين أقل من 2
    for (const key in rooms) {
      if (Object.keys(rooms[key]).length === 1) { // غرفة فيها مستخدم واحد فقط
        roomId = key;
        push(ref(db, `randomRooms/${roomId}`), auth.currentUser.uid);
        joined = true;
        break;
      }
    }

    // إذا ما وجدنا غرفة، ننشئ واحدة جديدة
    if (!joined) {
      roomId = push(roomsRef).key;
      push(ref(db, `randomRooms/${roomId}`), auth.currentUser.uid);
    }

    listenMessages();
  });
}

// الاستماع للرسائل في الغرفة
function listenMessages() {
  const messagesRef = ref(db, `randomMessages/${roomId}`);
  onChildAdded(messagesRef, snapshot => {
    const data = snapshot.val();
    const div = document.createElement('div');
    div.className = data.uid === auth.currentUser.uid ? 'my-msg' : 'other-msg';
    div.textContent = data.text;
    chatDiv.appendChild(div);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  });
}

// إرسال رسالة
sendBtn.onclick = () => {
  const text = msgInput.value.trim();
  if(!text || !roomId) return;
  push(ref(db, `randomMessages/${roomId}`), {
    uid: auth.currentUser.uid,
    text
  });
  msgInput.value = '';
}

// زر الإعدادات لتسجيل الخروج
settingsBtn.onclick = () => {
  if(confirm("تسجيل الخروج؟")) {
    signOut(auth).then(() => window.location.href = "index.html");
  }
}

// الانضمام عند فتح الصفحة
joinRandomRoom();
