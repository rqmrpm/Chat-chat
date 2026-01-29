import { auth, db, isAdmin } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { getUserData, isUserBanned } from './utils.js';

let currentUser = null;
let userData = null;

auth.onAuthStateChanged(async (user) => {
  if(!user) {
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
    userData = await getUserData(user.uid);
    if(userData) {
      displayUserInfo();
      if (isAdmin(user)) {
        showAdminButton();
      }
      listenForAdminBroadcasts();
    }
  } catch (error) {
    console.error("Error loading data:", error);
  }
});

function listenForAdminBroadcasts() {
  const broadcastRef = ref(db, 'adminBroadcasts');
  onValue(broadcastRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const keys = Object.keys(data);
      const lastKey = keys[keys.length - 1];
      const lastMsg = data[lastKey];
      const isRecent = (Date.now() - lastMsg.timestamp) < (24 * 60 * 60 * 1000);
      const seenKey = \`admin_msg_seen_\${lastKey}\`;
      if (isRecent && !localStorage.getItem(seenKey)) {
        showAdminAlert(lastMsg.message, lastKey);
      }
    }
  });
}

function showAdminAlert(message, msgId) {
  const alertDiv = document.createElement('div');
  alertDiv.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#0084FF;color:white;padding:15px 25px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.2);z-index:9999;max-width:90%;text-align:center;';
  alertDiv.innerHTML = \`<div>📢 رسالة من الإدارة</div><div>\${message}</div><button id="closeAdminAlert" style="margin-top:10px;background:white;color:#0084FF;border:none;padding:5px 15px;border-radius:5px;cursor:pointer;font-weight:bold;">فهمت</button>\`;
  document.body.appendChild(alertDiv);
  document.getElementById('closeAdminAlert').onclick = () => {
    localStorage.setItem(\`admin_msg_seen_\${msgId}\`, 'true');
    alertDiv.remove();
  };
}

async function displayUserInfo() {
  const userInfoDiv = document.createElement('div');
  userInfoDiv.className = 'user-info-header';
  userInfoDiv.innerHTML = \`<div class="user-profile">\${userData.profilePic ? \`<img src="\${userData.profilePic}" class="profile-pic-small">\` : \`<div class="profile-pic-placeholder">\${userData.name.charAt(0)}</div>\`}<div class="user-details"><h3>\${userData.name}</h3><div class="user-stats"><span>🍪 \${userData.cookies || 0} كوكيز</span><span>⭐ \${userData.points || 0} نقطة</span></div></div></div>\`;
  const header = document.querySelector('.top-header');
  if (header && !document.querySelector('.user-info-header')) {
    header.appendChild(userInfoDiv);
  }
}

function showAdminButton() {
  const adminBtn = document.createElement('button');
  adminBtn.id = 'adminBtn';
  adminBtn.textContent = '👑 لوحة الأدمن';
  adminBtn.className = 'admin-btn';
  adminBtn.onclick = () => { window.location.href = 'admin.html'; };
  const header = document.querySelector('.top-header');
  if (header && !document.getElementById('adminBtn')) {
    header.appendChild(adminBtn);
  }
}

const tabBtns = document.querySelectorAll('.tab-btn, .bottom-footer button');
const tabContents = document.querySelectorAll('.tab-content');
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    if (!target) return;
    tabContents.forEach(tc => tc.style.display = 'none');
    tabBtns.forEach(b => b.classList.remove('active'));
    const targetTab = document.getElementById(target);
    if (targetTab) {
      targetTab.style.display = 'block';
      btn.classList.add('active');
      loadTabContent(target);
    }
  });
});

function loadTabContent(tabName) {
  const contentDiv = document.getElementById(tabName);
  if (!contentDiv) return;
  switch(tabName) {
    case 'contacts': contentDiv.innerHTML = '<iframe src="contacts.html" style="width:100%;height:100%;border:none;"></iframe>'; break;
    case 'mychats': contentDiv.innerHTML = '<iframe src="mychats.html" style="width:100%;height:100%;border:none;"></iframe>'; break;
    case 'random': contentDiv.innerHTML = '<iframe src="randomchat.html" style="width:100%;height:100%;border:none;"></iframe>'; break;
    case 'games': loadGamesMenu(); break;
  }
}

function loadGamesMenu() {
  const gamesDiv = document.getElementById('games');
  if (!gamesDiv) return;
  gamesDiv.innerHTML = '<div class="games-menu"><h2>🎮 الألعاب المتاحة</h2><div class="games-grid"><div class="game-card" onclick="window.location.href=\\'chess.html\\'"><div class="game-icon">♟️</div><h3>شطرنج</h3><p>10 كوكيز</p><button class="play-btn">العب الآن</button></div><div class="game-card" onclick="window.location.href=\\'billiard.html\\'"><div class="game-icon">🎱</div><h3>بلياردو</h3><p>15 كوكيز</p><button class="play-btn">العب الآن</button></div></div></div>';
}

const defaultTab = document.getElementById('contacts');
if (defaultTab) {
  defaultTab.style.display = 'block';
  loadTabContent('contacts');
}
