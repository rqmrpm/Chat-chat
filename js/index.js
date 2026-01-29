import { app, db, auth, storage } from './firebase-config.js';
import { ref as dbRef, set, get } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-storage.js";

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

async function uploadProfilePicture(file, uid) {
  if (!file) return '';
  try {
    const fileRef = storageRef(storage, `profilePictures/${uid}/${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  } catch (e) { return ''; }
}

signupBtn.onclick = async () => {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const pass = passwordInput.value;
  const age = ageInput.value;
  const gender = genderInput.value;
  const profilePicFile = profilePicInput.files[0];
  if(!name || !email || !pass || !age || !gender) return alert('املأ كل الحقول المطلوبة');
  try {
    userInfoDiv.textContent = 'جاري إنشاء الحساب...';
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;
    let profilePicURL = '';
    if (profilePicFile) {
      userInfoDiv.textContent = 'جاري رفع الصورة...';
      profilePicURL = await uploadProfilePicture(profilePicFile, user.uid);
    }
    await set(dbRef(db, 'users/' + user.uid), { name, email: user.email, age, gender, profilePic: profilePicURL, points: 0, cookies: 50, banned: false, createdAt: Date.now() });
    window.location.href = "dashboard.html";
  } catch(err) { userInfoDiv.textContent = ''; alert('خطأ: ' + err.message); }
};

loginBtn.onclick = async () => {
  const email = emailInput.value.trim();
  const pass = passwordInput.value;
  if(!email || !pass) return alert('املأ البريد وكلمة المرور');
  try {
    userInfoDiv.textContent = 'جاري تسجيل الدخول...';
    await signInWithEmailAndPassword(auth, email, pass);
    window.location.href = "dashboard.html";
  } catch(err) { userInfoDiv.textContent = ''; alert('خطأ: ' + err.message); }
};

googleBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  try {
    userInfoDiv.textContent = 'جاري تسجيل الدخول عبر Google...';
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userSnapshot = await get(dbRef(db, 'users/' + user.uid));
    if (!userSnapshot.exists()) {
      await set(dbRef(db, 'users/' + user.uid), { name: user.displayName || 'مستخدم Google', email: user.email, age: '', gender: '', profilePic: user.photoURL || '', points: 0, cookies: 50, banned: false, createdAt: Date.now() });
    }
    window.location.href = "dashboard.html";
  } catch(err) { userInfoDiv.textContent = ''; alert('خطأ: ' + err.message); }
};
