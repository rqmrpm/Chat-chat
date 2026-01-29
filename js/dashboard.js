import { auth, db, isAdmin } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { getUserData, isUserBanned, showToast } from './utils.js';

let currentUser = null;
let userData = null;

// التحقق من تسجيل الدخول
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    currentUser = user;
    try {
        const banned = await isUserBanned(user.uid);
        if (banned) {
            alert('تم حظر حسابك من قبل الإدارة');
            await signOut(auth);
            window.location.href = "index.html";
            return;
        }
        
        // مراقبة بيانات المستخدم بشكل حي
        const userRef = ref(db, `users/${user.uid}`);
        onValue(userRef, (snapshot) => {
            userData = snapshot.val();
            if (userData) {
                displayUserInfo();
                if (isAdmin(user)) {
                    showAdminButton();
                }
            }
        });

        listenForAdminBroadcasts();
        loadTabContent('contacts'); // تحميل التبويب الافتراضي
    } catch (error) {
        console.error("Error:", error);
    }
});

// عرض معلومات المستخدم في الهيدر
function displayUserInfo() {
    const headerActions = document.getElementById('header-actions');
    let userInfoDiv = document.getElementById('user-header-info');
    
    if (!userInfoDiv) {
        userInfoDiv = document.createElement('div');
        userInfoDiv.id = 'user-header-info';
        userInfoDiv.className = 'user-info-header';
        headerActions.prepend(userInfoDiv);
    }

    userInfoDiv.innerHTML = `
        <div class="user-stats">
            <span title="كوكيز"><i class="fas fa-cookie-bite"></i> ${userData.cookies || 0}</span>
            <span title="نقاط"><i class="fas fa-star"></i> ${userData.points || 0}</span>
        </div>
        <div class="user-profile-mini">
            ${userData.profilePic ? 
                `<img src="${userData.profilePic}" class="avatar-mini">` : 
                `<div class="avatar-placeholder">${userData.name.charAt(0)}</div>`
            }
        </div>
    `;
}

function showAdminButton() {
    if (document.getElementById('adminBtn')) return;
    const adminBtn = document.createElement('button');
    adminBtn.id = 'adminBtn';
    adminBtn.className = 'admin-btn';
    adminBtn.innerHTML = '<i class="fas fa-user-shield"></i>';
    adminBtn.title = 'لوحة الإدارة';
    adminBtn.onclick = () => window.location.href = 'admin.html';
    document.getElementById('header-actions').prepend(adminBtn);
}

// التبديل بين التبويبات
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const targetTab = document.getElementById(target);
        if (targetTab) {
            targetTab.classList.add('active');
            loadTabContent(target);
        }
    });
});

function loadTabContent(tabName) {
    const contentDiv = document.getElementById(tabName);
    switch(tabName) {
        case 'contacts': loadContacts(); break;
        case 'mychats': loadMyChats(); break;
        case 'games': loadGamesMenu(); break;
    }
}

function loadGamesMenu() {
    const gamesGrid = document.getElementById('games-grid');
    const games = [
        { id: 'chess', name: 'شطرنج', icon: '♟️', cost: 10, file: 'chess.html' },
        { id: 'billiard', name: 'بلياردو', icon: '🎱', cost: 15, file: 'billiard.html' },
        { id: 'xo', name: 'X-O', icon: '❌', cost: 5, file: 'xo.html' },
        { id: 'rps', name: 'حجر ورقة مقص', icon: '✊', cost: 5, file: 'rps.html' }
    ];

    gamesGrid.innerHTML = games.map(game => `
        <div class="game-card" onclick="window.location.href='${game.file}'">
            <div class="game-icon">${game.icon}</div>
            <h3>${game.name}</h3>
            <p>${game.cost} 🍪</p>
            <button class="play-btn">تحدي</button>
        </div>
    `).join('');
}

function loadContacts() {
    const list = document.getElementById('contacts-list');
    list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
    
    onValue(ref(db, 'users'), (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        
        list.innerHTML = '';
        Object.keys(users).forEach(uid => {
            if (uid === currentUser.uid) return;
            const user = users[uid];
            const item = document.createElement('div');
            item.className = 'contact-item';
            item.innerHTML = `
                <div class="contact-info">
                    ${user.profilePic ? `<img src="${user.profilePic}" class="avatar">` : `<div class="avatar-placeholder">${user.name.charAt(0)}</div>`}
                    <div class="details">
                        <h4>${user.name}</h4>
                        <p>${user.banned ? '🚫 محظور' : '🟢 متصل'}</p>
                    </div>
                </div>
                <div class="contact-actions">
                    <button onclick="startPrivateChat('${uid}')" title="دردشة"><i class="fas fa-comment"></i></button>
                    <button onclick="sendChallenge('${uid}')" title="تحدي"><i class="fas fa-swords"></i></button>
                </div>
            `;
            list.appendChild(item);
        });
    });
}

// نظام التحديات والرهانات
window.sendChallenge = async (targetUid) => {
    const amount = prompt('أدخل مبلغ الرهان (كوكيز):', '5');
    if (!amount || isNaN(amount) || amount < 0) return;
    
    if (userData.cookies < amount) {
        showToast('رصيدك غير كافي!', 'error');
        return;
    }

    const challengeRef = ref(db, `challenges/${targetUid}/${currentUser.uid}`);
    await set(challengeRef, {
        fromName: userData.name,
        amount: parseInt(amount),
        timestamp: Date.now(),
        status: 'pending'
    });
    showToast('تم إرسال طلب التحدي!', 'success');
};

// الاستماع لرسائل الإدارة
function listenForAdminBroadcasts() {
    const broadcastRef = ref(db, 'adminBroadcasts');
    onValue(broadcastRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        const lastKey = Object.keys(data).pop();
        const lastMsg = data[lastKey];
        if ((Date.now() - lastMsg.timestamp) < 86400000 && !localStorage.getItem(`seen_${lastKey}`)) {
            showAdminAlert(lastMsg.message, lastKey);
        }
    });
}

function showAdminAlert(message, id) {
    const div = document.createElement('div');
    div.className = 'admin-alert-overlay';
    div.innerHTML = `
        <div class="admin-alert-card">
            <i class="fas fa-bullhorn"></i>
            <h3>إعلان من الإدارة</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.parentElement.remove(); localStorage.setItem('seen_${id}', 'true')">فهمت</button>
        </div>
    `;
    document.body.appendChild(div);
}

document.getElementById('settingsBtn').onclick = () => {
    const action = confirm('هل تريد تسجيل الخروج؟');
    if (action) signOut(auth).then(() => window.location.href = 'index.html');
};

// زر بدء الدردشة العشوائية
const startRandomBtn = document.getElementById('startRandomBtn');
if (startRandomBtn) {
    startRandomBtn.onclick = () => window.location.href = 'randomchat.html';
}

// الاستماع لطلبات التحدي الواردة
auth.onAuthStateChanged((user) => {
    if (user) {
        const challengesRef = ref(db, `challenges/${user.uid}`);
        onValue(challengesRef, (snapshot) => {
            const challenges = snapshot.val();
            if (challenges) {
                Object.keys(challenges).forEach(fromUid => {
                    const challenge = challenges[fromUid];
                    if (challenge.status === 'pending') {
                        showChallengeAlert(fromUid, challenge);
                    }
                });
            }
        });
    }
});

function showChallengeAlert(fromUid, challenge) {
    const div = document.createElement('div');
    div.className = 'admin-alert-overlay';
    div.innerHTML = `
        <div class="admin-alert-card">
            <i class="fas fa-swords" style="color:#e74c3c"></i>
            <h3>تحدي جديد! 💸</h3>
            <p>المستخدم <b>${challenge.fromName}</b> يتحداك في لعبة X-O</p>
            <p>الرهان: <b>${challenge.amount} 🍪</b></p>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="acceptChallenge('${fromUid}', ${challenge.amount})" style="background:#2ecc71">قبول</button>
                <button onclick="rejectChallenge('${fromUid}')" style="background:#e74c3c">رفض</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

window.acceptChallenge = async (fromUid, amount) => {
    if (userData.cookies < amount) {
        alert('رصيدك غير كافي لقبول التحدي!');
        return;
    }
    const gameId = `game_${fromUid}_${currentUser.uid}`;
    await set(ref(db, `challenges/${currentUser.uid}/${fromUid}`), { status: 'accepted' });
    window.location.href = `xo.html?gameId=${gameId}&bet=${amount}`;
};

window.rejectChallenge = async (fromUid) => {
    await set(ref(db, `challenges/${currentUser.uid}/${fromUid}`), { status: 'rejected' });
    document.querySelector('.admin-alert-overlay').remove();
};
