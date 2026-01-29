import { auth, db, isAdmin } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { getUserData, isUserBanned, showToast } from './utils.js';

let currentUser = null;
let userData = null;

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
        listenForChallenges();
        loadTabContent('contacts');
    } catch (error) {
        console.error("Error:", error);
    }
});

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
            ${userData.profilePic ? `<img src="${userData.profilePic}" class="avatar-mini">` : `<div class="avatar-placeholder">${userData.name.charAt(0)}</div>`}
        </div>
    `;
}

function showAdminButton() {
    if (document.getElementById('adminBtn')) return;
    const adminBtn = document.createElement('button');
    adminBtn.id = 'adminBtn';
    adminBtn.className = 'admin-btn';
    adminBtn.innerHTML = '<i class="fas fa-user-shield"></i>';
    adminBtn.onclick = () => window.location.href = 'admin.html';
    document.getElementById('header-actions').prepend(adminBtn);
}

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
    switch(tabName) {
        case 'contacts': loadContacts(); break;
        case 'games': loadGamesMenu(); break;
    }
}

function loadGamesMenu() {
    const gamesGrid = document.getElementById('games-grid');
    gamesGrid.innerHTML = `
        <div class="game-section">
            <h3>⚔️ تحديات P2P (رهانات)</h3>
            <div class="games-row">
                <div class="game-card" onclick="window.location.href='xo.html'">
                    <div class="game-icon">❌</div>
                    <h4>X-O</h4>
                    <p>5 🍪</p>
                </div>
                <div class="game-card" onclick="window.location.href='chess.html'">
                    <div class="game-icon">♟️</div>
                    <h4>شطرنج</h4>
                    <p>10 🍪</p>
                </div>
            </div>
        </div>
        <div class="game-section" style="margin-top:20px;">
            <h3>🕹️ ألعاب أركيد (فردي)</h3>
            <div class="games-row">
                <div class="game-card arcade" onclick="window.location.href='snake.html'">
                    <div class="game-icon">🐍</div>
                    <h4>الثعبان</h4>
                    <p>مجاني</p>
                </div>
                <div class="game-card arcade" onclick="window.location.href='breakout.html'">
                    <div class="game-icon">🧱</div>
                    <h4>تحطيم القوالب</h4>
                    <p>مجاني</p>
                </div>
            </div>
        </div>
    `;
}

function loadContacts() {
    const list = document.getElementById('contacts-list');
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
                    <div class="details"><h4>${user.name}</h4><p>${user.banned ? '🚫 محظور' : '🟢 متصل'}</p></div>
                </div>
                <div class="contact-actions">
                    <button onclick="sendChallenge('${uid}')"><i class="fas fa-swords"></i></button>
                </div>
            `;
            list.appendChild(item);
        });
    });
}

window.sendChallenge = async (targetUid) => {
    const amount = prompt('أدخل مبلغ الرهان (كوكيز):', '5');
    if (!amount || isNaN(amount) || amount < 0) return;
    if (userData.cookies < amount) return showToast('رصيدك غير كافي!', 'error');
    await set(ref(db, `challenges/${targetUid}/${currentUser.uid}`), { fromName: userData.name, amount: parseInt(amount), timestamp: Date.now(), status: 'pending' });
    showToast('تم إرسال طلب التحدي!', 'success');
};

function listenForChallenges() {
    onValue(ref(db, `challenges/${currentUser.uid}`), (snapshot) => {
        const challenges = snapshot.val();
        if (challenges) {
            Object.keys(challenges).forEach(fromUid => {
                if (challenges[fromUid].status === 'pending') showChallengeAlert(fromUid, challenges[fromUid]);
            });
        }
    });
}

function showChallengeAlert(fromUid, challenge) {
    const div = document.createElement('div');
    div.className = 'admin-alert-overlay';
    div.innerHTML = `
        <div class="admin-alert-card">
            <i class="fas fa-swords" style="color:#e74c3c"></i>
            <h3>تحدي جديد! 💸</h3>
            <p>المستخدم <b>${challenge.fromName}</b> يتحداك في X-O</p>
            <p>الرهان: <b>${challenge.amount} 🍪</b></p>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="acceptChallenge('${fromUid}', ${challenge.amount})" style="background:#2ecc71">قبول</button>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:#e74c3c">رفض</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

window.acceptChallenge = async (fromUid, amount) => {
    const gameId = `game_${fromUid}_${currentUser.uid}`;
    await set(ref(db, `challenges/${currentUser.uid}/${fromUid}`), { status: 'accepted' });
    window.location.href = `xo.html?gameId=${gameId}&bet=${amount}`;
};

function listenForAdminBroadcasts() {
    onValue(ref(db, 'adminBroadcasts'), (snapshot) => {
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
    div.innerHTML = `<div class="admin-alert-card"><i class="fas fa-bullhorn"></i><h3>إعلان من الإدارة</h3><p>${message}</p><button onclick="this.parentElement.parentElement.remove(); localStorage.setItem('seen_${id}', 'true')">فهمت</button></div>`;
    document.body.appendChild(div);
}

document.getElementById('settingsBtn').onclick = () => {
    if (confirm('هل تريد تسجيل الخروج؟')) signOut(auth).then(() => window.location.href = 'index.html');
};
