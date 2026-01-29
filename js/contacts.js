// js/contacts.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

// إعداد Firebase (نسخة موحدة لكل الملفات)
import { firebaseConfig } from "../firebase/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// تحقق من تسجيل الدخول
auth.onAuthStateChanged(user => {
  if (!user) window.location.href = "index.html";
});

// عناصر DOM
const contactsList = document.getElementById('contactsList');
const settingsBtn = document.getElementById('settingsBtn');

// تحميل جهات الاتصال من قاعدة البيانات
function loadContacts() {
  const usersRef = ref(db, 'users/');
  onValue(usersRef, snapshot => {
    contactsList.innerHTML = '';
    snapshot.forEach(child => {
      const data = child.val();
      if (data.uid !== auth.currentUser.uid) { // لا نعرض المستخدم الحالي
        const div = document.createElement('div');
        div.className = 'contact-item';
        div.textContent = `${data.name} (${data.email})`;

        // عند النقر على جهة الاتصال نبدأ دردشة خاصة
        div.onclick = () => {
          // يمكن حفظ UID المستخدم المختار مؤقتًا في localStorage للفتح في صفحة دردشة خاصة
          localStorage.setItem('chatWithUID', child.key);
          window.location.href = 'mychats.html';
        };

        contactsList.appendChild(div);
      }
    });
  });
}

// زر الإعدادات لتسجيل الخروج
settingsBtn.onclick = () => {
  if(confirm("تسجيل الخروج؟")) {
    signOut(auth).then(() => window.location.href = "index.html");
  }
};

// تنفيذ التحميل عند فتح الصفحة
loadContacts();
