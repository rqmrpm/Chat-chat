import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCeM8ll_jksTk5DX7aUjjgMtbsKmWL5c-8",
  authDomain: "mmmm-78a14.firebaseapp.com",
  databaseURL: "https://mmmm-78a14-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mmmm-78a14",
  storageBucket: "mmmm-78a14.firebasestorage.app",
  messagingSenderId: "628960654552",
  appId: "1:628960654552:web:dd2b9292df41f4cad913ad",
  measurementId: "G-XT96SY6067"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// التحقق من تسجيل الدخول
auth.onAuthStateChanged(user => {
  if(!user) window.location.href = "index.html";
  else {
    console.log("مسجل دخول:", user.uid);
    // ممكن جلب بيانات المستخدم هنا
    get(ref(db, 'users/' + user.uid)).then(snapshot => {
      if(snapshot.exists()){
        console.log(snapshot.val());
      }
    });
  }
});

// نظام التبديل بين التبويبات
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabContents.forEach(tc => tc.style.display = 'none');
    document.getElementById(target).style.display = 'block';
  });
});

// عرض أول تبويب تلقائيًا
document.getElementById('contacts').style.display = 'block';

// زر الإعدادات: تسجيل خروج (يمكن إضافة باقي الخيارات لاحقًا)
document.getElementById('settingsBtn').onclick = () => {
  if(confirm("تسجيل الخروج؟")) signOut(auth).then(()=>window.location.href="index.html");
};
