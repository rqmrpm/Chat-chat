import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

// إعداد Firebase
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
const db = getDatabase(app);
const auth = getAuth(app);

// عناصر الصفحة
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const ageInput = document.getElementById('age');
const genderInput = document.getElementById('gender');
const profilePicInput = document.getElementById('profilePic');

const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const googleBtn = document.getElementById('googleSign');
const userInfoDiv = document.getElementById('userInfo');

// إنشاء حساب
signupBtn.onclick = () => {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const pass = passwordInput.value;
  const age = ageInput.value;
  const gender = genderInput.value;
  const profilePic = profilePicInput.files[0] ? profilePicInput.files[0].name : '';

  if(!name || !email || !pass || !age || !gender) return alert('املأ كل الحقول');

  createUserWithEmailAndPassword(auth, email, pass)
    .then(userCredential => {
      const user = userCredential.user;
      set(ref(db, 'users/' + user.uid), {
        name: name,
        email: user.email,
        age: age,
        gender: gender,
        profilePic: profilePic,
        points: 0,
        cookies: 10
      });
      userInfoDiv.textContent = `مرحبًا ${name}, UID: ${user.uid}`;
      window.location.href = "dashboard.html"; // الانتقال للصفحة الرئيسية بعد تسجيل الدخول
    })
    .catch(err => alert(err.message));
};

// تسجيل دخول
loginBtn.onclick = () => {
  const email = emailInput.value.trim();
  const pass = passwordInput.value;
  if(!email || !pass) return alert('املأ كل الحقول');

  signInWithEmailAndPassword(auth, email, pass)
    .then(userCredential => {
      const user = userCredential.user;
      userInfoDiv.textContent = `مرحبًا ${user.email}, UID: ${user.uid}`;
      window.location.href = "dashboard.html";
    })
    .catch(err => alert(err.message));
};

// تسجيل دخول Google
googleBtn.onclick = () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .then(result => {
      const user = result.user;
      set(ref(db, 'users/' + user.uid), {
        name: user.displayName || 'Google User',
        email: user.email,
        age: '',
        gender: '',
        profilePic: '',
        points: 0,
        cookies: 10
      });
      userInfoDiv.textContent = `مرحبًا ${user.displayName || user.email}, UID: ${user.uid}`;
      window.location.href = "dashboard.html";
    })
    .catch(err => alert(err.message));
};
