// js/admin.js
import { auth, db, isAdmin } from './firebase-config.js';
import { ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { updateCookies, toggleBanUser, showToast } from './utils.js';

let allUsers = {};

// التحقق من صلاحيات الأدمن
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  
  if (!isAdmin(user)) {
    alert('ليس لديك صلاحيات الأدمن!');
    window.location.href = "dashboard.html";
    return;
  }
  
  console.log('مرحباً أيها الأدمن!');
  loadUsers();
  loadStats();
});

// تحميل المستخدمين
async function loadUsers() {
  const usersRef = ref(db, 'users/');
  
  onValue(usersRef, (snapshot) => {
    allUsers = snapshot.val() || {};
    displayUsers(allUsers);
  });
}

// عرض المستخدمين
function displayUsers(users) {
  const usersList = document.getElementById('usersList');
  usersList.innerHTML = '';
  
  Object.keys(users).forEach(uid => {
    const user = users[uid];
    
    const userCard = document.createElement('div');
    userCard.className = 'user-card';
    userCard.innerHTML = `
      <div class="user-info">
        ${user.profilePic ? 
          `<img src="${user.profilePic}" alt="صورة" class="user-avatar">` : 
          `<div class="user-avatar-placeholder">${user.name.charAt(0)}</div>`
        }
        <div class="user-details">
          <h4>${user.name}</h4>
          <p>${user.email}</p>
          <small>UID: ${uid}</small>
        </div>
      </div>
      <div class="user-stats">
        <span>🍪 ${user.cookies || 0}</span>
        <span>⭐ ${user.points || 0}</span>
      </div>
      <div class="user-actions">
        <button onclick="viewUser('${uid}')" class="btn-view">👁️ عرض</button>
        <button onclick="addCookiesToUser('${uid}')" class="btn-add">➕ شحن</button>
        <button onclick="toggleBan('${uid}', ${!user.banned})" 
                class="btn-ban ${user.banned ? 'banned' : ''}">
          ${user.banned ? '✅ إلغاء الحظر' : '🚫 حظر'}
        </button>
      </div>
    `;
    
    usersList.appendChild(userCard);
  });
}

// عرض تفاصيل المستخدم
window.viewUser = function(uid) {
  const user = allUsers[uid];
  if (!user) return;
  
  const modal = document.getElementById('userModal');
  const details = document.getElementById('userDetails');
  
  details.innerHTML = `
    <h2>${user.name}</h2>
    ${user.profilePic ? `<img src="${user.profilePic}" class="modal-avatar">` : ''}
    <div class="detail-row"><strong>البريد:</strong> ${user.email}</div>
    <div class="detail-row"><strong>UID:</strong> ${uid}</div>
    <div class="detail-row"><strong>العمر:</strong> ${user.age || 'غير محدد'}</div>
    <div class="detail-row"><strong>الجنس:</strong> ${user.gender || 'غير محدد'}</div>
    <div class="detail-row"><strong>الكوكيز:</strong> ${user.cookies || 0}</div>
    <div class="detail-row"><strong>النقاط:</strong> ${user.points || 0}</div>
    <div class="detail-row"><strong>الحالة:</strong> ${user.banned ? '🚫 محظور' : '✅ نشط'}</div>
    <div class="detail-row"><strong>تاريخ التسجيل:</strong> ${new Date(user.createdAt).toLocaleDateString('ar-SA')}</div>
  `;
  
  modal.style.display = 'block';
};

// إضافة كوكيز لمستخدم
window.addCookiesToUser = async function(uid) {
  const amount = prompt('كم عدد الكوكيز التي تريد إضافتها؟');
  if (!amount || isNaN(amount)) return;
  
  const success = await updateCookies(uid, parseInt(amount));
  if (success) {
    showToast(`تم إضافة ${amount} كوكيز بنجاح!`, 'success');
  } else {
    showToast('فشل في إضافة الكوكيز', 'error');
  }
};

// حظر/إلغاء حظر مستخدم
window.toggleBan = async function(uid, ban) {
  const action = ban ? 'حظر' : 'إلغاء حظر';
  if (!confirm(`هل أنت متأكد من ${action} هذا المستخدم؟`)) return;
  
  await toggleBanUser(uid, ban);
  showToast(`تم ${action} المستخدم بنجاح!`, 'success');
};

// تحميل الإحصائيات
async function loadStats() {
  const usersRef = ref(db, 'users/');
  const snapshot = await get(usersRef);
  const users = snapshot.val() || {};
  
  let totalUsers = 0;
  let activeUsers = 0;
  let totalCookies = 0;
  let totalPoints = 0;
  
  Object.values(users).forEach(user => {
    totalUsers++;
    if (!user.banned) activeUsers++;
    totalCookies += user.cookies || 0;
    totalPoints += user.points || 0;
  });
  
  document.getElementById('totalUsers').textContent = totalUsers;
  document.getElementById('activeUsers').textContent = activeUsers;
  document.getElementById('totalCookies').textContent = totalCookies;
  document.getElementById('totalPoints').textContent = totalPoints;
}

// البحث عن مستخدمين
document.getElementById('searchUsers').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  
  if (!query) {
    displayUsers(allUsers);
    return;
  }
  
  const filtered = {};
  Object.keys(allUsers).forEach(uid => {
    const user = allUsers[uid];
    if (user.name.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query) ||
        uid.includes(query)) {
      filtered[uid] = user;
    }
  });
  
  displayUsers(filtered);
});

// شحن كوكيز من النموذج
document.getElementById('addCookiesBtn').onclick = async () => {
  const uid = document.getElementById('targetUserId').value.trim();
  const amount = parseInt(document.getElementById('cookiesAmount').value);
  
  if (!uid || !amount) {
    showToast('املأ جميع الحقول!', 'error');
    return;
  }
  
  const success = await updateCookies(uid, amount);
  if (success) {
    showToast(`تم إضافة ${amount} كوكيز بنجاح!`, 'success');
    document.getElementById('targetUserId').value = '';
    document.getElementById('cookiesAmount').value = '';
  } else {
    showToast('فشل في إضافة الكوكيز - تحقق من UID', 'error');
  }
};

// إضافة كوكيز للجميع
document.getElementById('addCookiesAllBtn').onclick = async () => {
  if (!confirm('هل تريد إضافة 10 كوكيز لجميع المستخدمين؟')) return;
  
  const promises = Object.keys(allUsers).map(uid => updateCookies(uid, 10));
  await Promise.all(promises);
  
  showToast('تم إضافة 10 كوكيز لجميع المستخدمين!', 'success');
};

// إعادة تعيين النقاط
document.getElementById('resetPointsBtn').onclick = async () => {
  if (!confirm('هل تريد إعادة تعيين نقاط جميع المستخدمين إلى 0؟')) return;
  
  const promises = Object.keys(allUsers).map(uid => 
    update(ref(db, `users/${uid}`), { points: 0 })
  );
  await Promise.all(promises);
  
  showToast('تم إعادة تعيين النقاط للجميع!', 'success');
};

// التبديل بين التبويبات
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // إزالة active من الجميع
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // إضافة active للمختار
    btn.classList.add('active');
    const target = btn.dataset.tab;
    document.getElementById(target).classList.add('active');
    
    // تحديث الإحصائيات عند فتح التبويب
    if (target === 'stats') {
      loadStats();
    }
  });
});

// إغلاق النافذة المنبثقة
document.querySelector('.close').onclick = () => {
  document.getElementById('userModal').style.display = 'none';
};

window.onclick = (e) => {
  const modal = document.getElementById('userModal');
  if (e.target === modal) {
    modal.style.display = 'none';
  }
};
