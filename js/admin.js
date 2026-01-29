import { auth, db, isAdmin } from './firebase-config.js';
import { ref, onValue, update, get, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

auth.onAuthStateChanged((user) => {
    if (!isAdmin(user)) {
        alert('غير مصرح لك بالدخول!');
        window.location.href = 'dashboard.html';
    } else {
        loadUsers();
        loadStats();
    }
});

function loadUsers() {
    const list = document.getElementById('users-list');
    onValue(ref(db, 'users'), (snapshot) => {
        const users = snapshot.val();
        list.innerHTML = '';
        if (users) {
            Object.keys(users).forEach(uid => {
                const u = users[uid];
                const div = document.createElement('div');
                div.className = 'user-admin-card';
                div.innerHTML = `
                    <div class="u-info">
                        <b>${u.name}</b> (${u.email})
                        <p>رصيد: ${u.cookies || 0} 🍪 | نقاط: ${u.points || 0}</p>
                    </div>
                    <div class="u-actions">
                        <button onclick="rechargeUser('${uid}')" class="btn-recharge">شحن 🍪</button>
                        <button onclick="toggleBan('${uid}', ${u.banned})" class="${u.banned ? 'btn-unban' : 'btn-ban'}">
                            ${u.banned ? 'إلغاء حظر' : 'حظر'}
                        </button>
                    </div>
                `;
                list.appendChild(div);
            });
        }
    });
}

window.rechargeUser = async (uid) => {
    const amount = prompt('أدخل كمية الكوكيز للشحن:');
    if (amount && !isNaN(amount)) {
        await update(ref(db, `users/${uid}`), { cookies: (await get(ref(db, `users/${uid}/cookies`))).val() + parseInt(amount) });
        alert('تم الشحن بنجاح!');
    }
};

window.toggleBan = async (uid, currentStatus) => {
    if (confirm(`هل أنت متأكد من ${currentStatus ? 'إلغاء حظر' : 'حظر'} هذا المستخدم؟`)) {
        await update(ref(db, `users/${uid}`), { banned: !currentStatus });
    }
};

document.getElementById('send-broadcast').onclick = async () => {
    const msg = document.getElementById('broadcast-msg').value.trim();
    if (msg) {
        await push(ref(db, 'adminBroadcasts'), {
            message: msg,
            timestamp: serverTimestamp()
        });
        alert('تم إرسال الإعلان للجميع!');
        document.getElementById('broadcast-msg').value = '';
    }
};

function loadStats() {
    onValue(ref(db, 'users'), (snapshot) => {
        const users = snapshot.val();
        if (users) {
            document.getElementById('total-users').textContent = Object.keys(users).length;
            let totalCookies = 0;
            Object.values(users).forEach(u => totalCookies += (u.cookies || 0));
            document.getElementById('total-cookies').textContent = totalCookies;
        }
    });
}
