// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-storage.js";

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

// تهيئة Firebase
export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// بريد الأدمن الأساسي
export const ADMIN_EMAIL = "mgdwork12119241@gmail.com";

// دالة للتحقق من صلاحيات الأدمن بناءً على البريد الإلكتروني
export function isAdmin(user) {
  return user && user.email === ADMIN_EMAIL;
}
