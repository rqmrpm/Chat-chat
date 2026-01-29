// js/billiard.js
import { auth, db } from './firebase-config.js';
import { ref, push, get, set, onValue, remove } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import { WebRTCManager } from './webrtc.js';
import { deductCookies, updatePoints, COSTS, REWARDS, showToast } from './utils.js';

// التحقق من تسجيل الدخول
auth.onAuthStateChanged(user => {
  if (!user) window.location.href = "index.html";
});

let roomId = null;
let webrtc = null;
let isMyTurn = false;
let myBalls = null; // 'solid' (1-7) or 'striped' (9-15)
let canvas, ctx;
let balls = [];
let cueBall = null;
let myScore = 0;
let opponentScore = 0;
let isAiming = false;
let aimAngle = 0;
let power = 50;

// تهيئة Canvas
function initCanvas() {
  canvas = document.getElementById('billiardCanvas');
  ctx = canvas.getContext('2d');
  
  // تهيئة الكرات
  initBalls();
  
  // رسم اللعبة
  drawGame();
  
  // معالجة الماوس للتصويب
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('click', handleCanvasClick);
}

// تهيئة الكرات
function initBalls() {
  // الكرة البيضاء (cue ball)
  cueBall = {
    x: 200,
    y: 200,
    vx: 0,
    vy: 0,
    radius: 10,
    color: 'white',
    type: 'cue'
  };
  
  // ترتيب الكرات (مثلث)
  const startX = 600;
  const startY = 200;
  const colors = ['red', 'yellow', 'blue', 'purple', 'orange', 'green', 'brown', 'black'];
  
  let ballNum = 1;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      if (ballNum <= 8) {
        balls.push({
          x: startX + row * 22,
          y: startY + (col - row/2) * 22,
          vx: 0,
          vy: 0,
          radius: 10,
          color: colors[ballNum - 1],
          number: ballNum,
          type: ballNum === 8 ? 'eight' : (ballNum <= 7 ? 'solid' : 'striped'),
          pocketed: false
        });
        ballNum++;
      }
    }
  }
}

// رسم اللعبة
function drawGame() {
  // مسح Canvas
  ctx.fillStyle = '#0a5f0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // رسم الجيوب
  drawPockets();
  
  // رسم الكرات
  balls.forEach(ball => {
    if (!ball.pocketed) {
      drawBall(ball);
    }
  });
  
  // رسم الكرة البيضاء
  drawBall(cueBall);
  
  // رسم خط التصويب
  if (isAiming && isMyTurn) {
    drawAimLine();
  }
  
  // تحديث الفيزياء
  updatePhysics();
  
  requestAnimationFrame(drawGame);
}

// رسم الكرة
function drawBall(ball) {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // رسم الرقم
  if (ball.number) {
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ball.number, ball.x, ball.y);
  }
}

// رسم الجيوب
function drawPockets() {
  const pockets = [
    {x: 10, y: 10}, {x: 400, y: 10}, {x: 790, y: 10},
    {x: 10, y: 390}, {x: 400, y: 390}, {x: 790, y: 390}
  ];
  
  pockets.forEach(pocket => {
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
  });
}

// رسم خط التصويب
function drawAimLine() {
  const length = power * 2;
  const endX = cueBall.x + Math.cos(aimAngle) * length;
  const endY = cueBall.y + Math.sin(aimAngle) * length;
  
  ctx.beginPath();
  ctx.moveTo(cueBall.x, cueBall.y);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// معالجة حركة الماوس
function handleMouseMove(e) {
  if (!isMyTurn || !isAiming) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  aimAngle = Math.atan2(mouseY - cueBall.y, mouseX - cueBall.x);
}

// معالجة النقر
function handleCanvasClick(e) {
  if (!isMyTurn) {
    showToast('ليس دورك!', 'error');
    return;
  }
  
  if (!isAiming) {
    isAiming = true;
    document.querySelector('.power-bar-container').style.display = 'block';
    document.getElementById('shootBtn').style.display = 'inline-block';
  }
}

// الضرب
document.getElementById('shootBtn').onclick = () => {
  if (!isMyTurn || !isAiming) return;
  
  power = parseInt(document.getElementById('powerBar').value);
  
  // تطبيق القوة على الكرة البيضاء
  cueBall.vx = Math.cos(aimAngle) * power / 10;
  cueBall.vy = Math.sin(aimAngle) * power / 10;
  
  isAiming = false;
  document.querySelector('.power-bar-container').style.display = 'none';
  document.getElementById('shootBtn').style.display = 'none';
  
  // إرسال الضربة للمنافس
  sendShot({ angle: aimAngle, power });
  
  // انتظار توقف الكرات ثم تبديل الدور
  setTimeout(() => {
    if (areAllBallsStopped()) {
      isMyTurn = false;
      updateTurnIndicator();
    }
  }, 3000);
};

// تحديث الفيزياء
function updatePhysics() {
  const friction = 0.98;
  const minSpeed = 0.1;
  
  // تحديث الكرة البيضاء
  cueBall.x += cueBall.vx;
  cueBall.y += cueBall.vy;
  cueBall.vx *= friction;
  cueBall.vy *= friction;
  
  if (Math.abs(cueBall.vx) < minSpeed) cueBall.vx = 0;
  if (Math.abs(cueBall.vy) < minSpeed) cueBall.vy = 0;
  
  // حدود الطاولة
  if (cueBall.x < cueBall.radius || cueBall.x > canvas.width - cueBall.radius) {
    cueBall.vx *= -1;
    cueBall.x = Math.max(cueBall.radius, Math.min(canvas.width - cueBall.radius, cueBall.x));
  }
  if (cueBall.y < cueBall.radius || cueBall.y > canvas.height - cueBall.radius) {
    cueBall.vy *= -1;
    cueBall.y = Math.max(cueBall.radius, Math.min(canvas.height - cueBall.radius, cueBall.y));
  }
  
  // تحديث الكرات الأخرى
  balls.forEach(ball => {
    if (ball.pocketed) return;
    
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= friction;
    ball.vy *= friction;
    
    if (Math.abs(ball.vx) < minSpeed) ball.vx = 0;
    if (Math.abs(ball.vy) < minSpeed) ball.vy = 0;
    
    // حدود الطاولة
    if (ball.x < ball.radius || ball.x > canvas.width - ball.radius) {
      ball.vx *= -1;
      ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x));
    }
    if (ball.y < ball.radius || ball.y > canvas.height - ball.radius) {
      ball.vy *= -1;
      ball.y = Math.max(ball.radius, Math.min(canvas.height - ball.radius, ball.y));
    }
    
    // التصادم مع الكرة البيضاء
    checkCollision(cueBall, ball);
    
    // التصادم مع الكرات الأخرى
    balls.forEach(other => {
      if (other !== ball && !other.pocketed) {
        checkCollision(ball, other);
      }
    });
    
    // التحقق من الجيوب
    checkPocket(ball);
  });
}

// التحقق من التصادم
function checkCollision(ball1, ball2) {
  const dx = ball2.x - ball1.x;
  const dy = ball2.y - ball1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < ball1.radius + ball2.radius) {
    // تصادم!
    const angle = Math.atan2(dy, dx);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    
    // نقل السرعات
    const vx1 = ball1.vx * cos + ball1.vy * sin;
    const vy1 = ball1.vy * cos - ball1.vx * sin;
    const vx2 = ball2.vx * cos + ball2.vy * sin;
    const vy2 = ball2.vy * cos - ball2.vx * sin;
    
    // تبادل السرعات
    const temp = vx1;
    ball1.vx = vx2 * cos - vy1 * sin;
    ball1.vy = vy1 * cos + vx2 * sin;
    ball2.vx = temp * cos - vy2 * sin;
    ball2.vy = vy2 * cos + temp * sin;
    
    // فصل الكرات
    const overlap = ball1.radius + ball2.radius - distance;
    ball1.x -= overlap * cos / 2;
    ball1.y -= overlap * sin / 2;
    ball2.x += overlap * cos / 2;
    ball2.y += overlap * sin / 2;
  }
}

// التحقق من الجيوب
function checkPocket(ball) {
  const pockets = [
    {x: 10, y: 10}, {x: 400, y: 10}, {x: 790, y: 10},
    {x: 10, y: 390}, {x: 400, y: 390}, {x: 790, y: 390}
  ];
  
  pockets.forEach(pocket => {
    const dx = ball.x - pocket.x;
    const dy = ball.y - pocket.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 15) {
      ball.pocketed = true;
      myScore++;
      document.getElementById('yourScore').textContent = myScore;
      
      if (ball.number === 8) {
        endGame(true); // فزت!
      }
    }
  });
}

// التحقق من توقف جميع الكرات
function areAllBallsStopped() {
  if (cueBall.vx !== 0 || cueBall.vy !== 0) return false;
  
  for (let ball of balls) {
    if (!ball.pocketed && (ball.vx !== 0 || ball.vy !== 0)) {
      return false;
    }
  }
  
  return true;
}

// إرسال الضربة
function sendShot(shot) {
  if (webrtc) {
    webrtc.send({
      type: 'shot',
      shot: shot
    });
  }
}

// استقبال الضربة
function receiveShot(shot) {
  // تطبيق الضربة
  cueBall.vx = Math.cos(shot.angle) * shot.power / 10;
  cueBall.vy = Math.sin(shot.angle) * shot.power / 10;
  
  setTimeout(() => {
    if (areAllBallsStopped()) {
      isMyTurn = true;
      updateTurnIndicator();
    }
  }, 3000);
}

// تحديث مؤشر الدور
function updateTurnIndicator() {
  const indicator = document.getElementById('turnIndicator');
  indicator.style.display = 'block';
  indicator.textContent = isMyTurn ? '🟢 دورك' : '🔴 دور المنافس';
  indicator.className = 'turn-indicator ' + (isMyTurn ? 'my-turn' : 'opponent-turn');
}

// البحث عن منافس
async function findOpponent() {
  const canAfford = await deductCookies(auth.currentUser.uid, COSTS.BILLIARD_GAME);
  if (!canAfford) {
    showToast('رصيدك غير كافي! تحتاج ' + COSTS.BILLIARD_GAME + ' كوكيز', 'error');
    setTimeout(() => window.location.href = 'dashboard.html', 2000);
    return;
  }
  
  const roomsRef = ref(db, 'billiardRooms/');
  const snapshot = await get(roomsRef);
  const rooms = snapshot.val() || {};
  
  let joined = false;
  
  for (const key in rooms) {
    const room = rooms[key];
    if (room.player2 === null && room.player1 !== auth.currentUser.uid) {
      roomId = key;
      
      await set(ref(db, `billiardRooms/${roomId}`), {
        player1: room.player1,
        player2: auth.currentUser.uid,
        createdAt: room.createdAt
      });
      
      myBalls = 'striped';
      joined = true;
      startGame(false);
      break;
    }
  }
  
  if (!joined) {
    const newRoomRef = push(roomsRef);
    roomId = newRoomRef.key;
    
    await set(newRoomRef, {
      player1: auth.currentUser.uid,
      player2: null,
      createdAt: Date.now()
    });
    
    myBalls = 'solid';
    
    document.getElementById('gameStatus').textContent = '⏳ في انتظار منافس...';
    
    onValue(ref(db, `billiardRooms/${roomId}/player2`), (snapshot) => {
      if (snapshot.exists() && snapshot.val()) {
        startGame(true);
      }
    });
  }
}

// بدء اللعبة
function startGame(isInitiator) {
  document.getElementById('gameStatus').textContent = '🔗 جاري الاتصال...';
  
  webrtc = new WebRTCManager(db, roomId, auth.currentUser.uid);
  
  webrtc.onConnected(() => {
    document.getElementById('gameStatus').textContent = '✅ اللعبة بدأت!';
    showToast('تم الاتصال! اللعبة بدأت', 'success');
    
    document.getElementById('chatInput').disabled = false;
    document.getElementById('sendChatBtn').disabled = false;
    document.getElementById('resignBtn').style.display = 'inline-block';
    
    isMyTurn = isInitiator;
    updateTurnIndicator();
    
    document.getElementById('yourBalls').textContent = myBalls === 'solid' ? '🔴' : '🔵';
  });
  
  webrtc.onMessage((data) => {
    if (data.type === 'shot') {
      receiveShot(data.shot);
    } else if (data.type === 'chat') {
      displayChatMessage(data.message, false);
    } else if (data.type === 'resign') {
      endGame(true);
    }
  });
  
  webrtc.onDisconnected(() => {
    showToast('انقطع الاتصال مع المنافس', 'error');
    setTimeout(() => window.location.href = 'dashboard.html', 2000);
  });
  
  webrtc.init(isInitiator);
  initCanvas();
}

// إنهاء اللعبة
async function endGame(iWon) {
  document.getElementById('gameStatus').textContent = 
    iWon ? '🎉 فزت!' : '😢 خسرت!';
  
  if (iWon) {
    await updatePoints(auth.currentUser.uid, REWARDS.BILLIARD_WIN);
    showToast(`فزت! حصلت على ${REWARDS.BILLIARD_WIN} نقطة!`, 'success');
  }
  
  setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 3000);
}

// الدردشة
document.getElementById('sendChatBtn').onclick = () => {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  
  if (webrtc) {
    webrtc.send({ type: 'chat', message });
    displayChatMessage(message, true);
    input.value = '';
  }
};

document.getElementById('chatInput').onkeypress = (e) => {
  if (e.key === 'Enter') {
    document.getElementById('sendChatBtn').click();
  }
};

function displayChatMessage(message, isMine) {
  const chatDiv = document.getElementById('chatMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = isMine ? 'chat-msg-mine' : 'chat-msg-other';
  msgDiv.textContent = message;
  chatDiv.appendChild(msgDiv);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

// الاستسلام
document.getElementById('resignBtn').onclick = () => {
  if (confirm('هل تريد الاستسلام؟')) {
    webrtc.send({ type: 'resign' });
    endGame(false);
  }
};

// شريط القوة
document.getElementById('powerBar').oninput = (e) => {
  document.getElementById('powerValue').textContent = e.target.value;
};

// تنظيف
window.addEventListener('beforeunload', async () => {
  if (webrtc) await webrtc.close();
  if (roomId) await remove(ref(db, `billiardRooms/${roomId}`));
});

// البدء
findOpponent();
