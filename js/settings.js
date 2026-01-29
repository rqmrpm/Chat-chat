import { getAuth, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { app } from './firebase/config.js';

const auth = getAuth(app);
const db = getDatabase(app);

const userNameP = document.getElementById('userName');
const userUIDP = document.getElementById('userUID');
const userBalanceP = document.getElementById('userBalance');

const logoutBtn = document.getElementById('logoutBtn');
const deleteBtn = document.getElementById('deleteBtn');
const supportBtn = document.getElementById('supportBtn');

// تحميل بيانات المستخدم
function loadUserInfo() {
  const user = auth.currentUser;
  if (!user) return;

  userNameP.textContent = `الاسم: ${user.displayName || user.email}`;
  userUIDP.textContent = `UID: ${user.uid}`;

  const userRef = ref(db, `users/${user.uid}`);
  get(userRef).then(snapshot => {
    if(snapshot.exists()) {
      const data = snapshot.val();
      userBalanceP.textContent = `رصيد: ${data.cookies || 0} كوكيز`;
    }
  });
}

// تسجيل خروج
logoutBtn.onclick = () => {
  signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
};

// حذف الحساب
deleteBtn.onclick = () => {
  const user = auth.currentUser;
  if(!user) return alert('لم يتم تسجيل الدخول');
  if(confirm('هل أنت متأكد أنك تريد حذف الحساب؟')) {
    deleteUser(user).then(() => {
      alert('تم حذف الحساب');
      window.location.href = 'index.html';
    }).catch(err => alert(err.message));
  }
};

// فريق الدعم
supportBtn.onclick = () => {
  alert('للتواصل مع الدعم، أرسل بريد إلكتروني إلى support@chatchat.com');
};

// تهيئة
loadUserInfo();
