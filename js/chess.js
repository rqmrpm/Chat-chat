// js/chess.js
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
let myColor = null; // 'white' or 'black'
let selectedPiece = null;
let gameBoard = [];
let opponentName = 'المنافس';

// تهيئة اللوحة
function initBoard() {
  gameBoard = [
    ['♜','♞','♝','♛','♚','♝','♞','♜'],
    ['♟','♟','♟','♟','♟','♟','♟','♟'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['♙','♙','♙','♙','♙','♙','♙','♙'],
    ['♖','♘','♗','♕','♔','♗','♘','♖']
  ];
  renderBoard();
}

// رسم اللوحة
function renderBoard() {
  const boardDiv = document.getElementById('chessBoard');
  boardDiv.innerHTML = '';
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement('div');
      square.className = 'chess-square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
      square.dataset.row = row;
      square.dataset.col = col;
      
      const piece = gameBoard[row][col];
      if (piece) {
        const pieceDiv = document.createElement('div');
        pieceDiv.className = 'chess-piece';
        pieceDiv.textContent = piece;
        square.appendChild(pieceDiv);
      }
      
      square.onclick = () => handleSquareClick(row, col);
      boardDiv.appendChild(square);
    }
  }
}

// معالجة النقر على المربع
function handleSquareClick(row, col) {
  if (!isMyTurn) {
    showToast('ليس دورك!', 'error');
    return;
  }
  
  const piece = gameBoard[row][col];
  
  if (selectedPiece) {
    // محاولة تحريك القطعة
    const move = {
      from: selectedPiece,
      to: { row, col }
    };
    
    if (isValidMove(move)) {
      makeMove(move);
      sendMove(move);
      selectedPiece = null;
      isMyTurn = false;
      updateTurnIndicator();
    } else {
      showToast('حركة غير صحيحة!', 'error');
      selectedPiece = null;
    }
    
    // إزالة التحديد
    document.querySelectorAll('.chess-square').forEach(sq => sq.classList.remove('selected'));
  } else if (piece && isMyPiece(piece)) {
    // تحديد القطعة
    selectedPiece = { row, col };
    document.querySelector(`[data-row="${row}"][data-col="${col}"]`).classList.add('selected');
  }
}

// التحقق من أن القطعة تخصني
function isMyPiece(piece) {
  const whitePieces = ['♙','♖','♘','♗','♕','♔'];
  const blackPieces = ['♟','♜','♞','♝','♛','♚'];
  
  if (myColor === 'white') {
    return whitePieces.includes(piece);
  } else {
    return blackPieces.includes(piece);
  }
}

// التحقق من صحة الحركة (مبسط - يحتاج تحسين)
function isValidMove(move) {
  const { from, to } = move;
  const piece = gameBoard[from.row][from.col];
  const target = gameBoard[to.row][to.col];
  
  // لا يمكن أكل قطعة من نفس اللون
  if (target && isMyPiece(target)) return false;
  
  // هنا يمكن إضافة قواعد الحركة لكل قطعة
  // حالياً نسمح بأي حركة (مبسط)
  return true;
}

// تنفيذ الحركة
function makeMove(move) {
  const { from, to } = move;
  const piece = gameBoard[from.row][from.col];
  
  gameBoard[to.row][to.col] = piece;
  gameBoard[from.row][from.col] = '';
  
  renderBoard();
  checkGameEnd();
}

// إرسال الحركة عبر WebRTC
function sendMove(move) {
  if (webrtc) {
    webrtc.send({
      type: 'move',
      move: move
    });
  }
}

// استقبال الحركة
function receiveMove(move) {
  makeMove(move);
  isMyTurn = true;
  updateTurnIndicator();
}

// التحقق من نهاية اللعبة
function checkGameEnd() {
  // البحث عن الملوك
  let whiteKing = false;
  let blackKing = false;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (gameBoard[row][col] === '♔') whiteKing = true;
      if (gameBoard[row][col] === '♚') blackKing = true;
    }
  }
  
  if (!whiteKing) {
    endGame('black');
  } else if (!blackKing) {
    endGame('white');
  }
}

// إنهاء اللعبة
async function endGame(winner) {
  const iWon = (winner === myColor);
  
  document.getElementById('gameStatus').textContent = 
    iWon ? '🎉 فزت!' : '😢 خسرت!';
  
  if (iWon) {
    await updatePoints(auth.currentUser.uid, REWARDS.CHESS_WIN);
    showToast(`فزت! حصلت على ${REWARDS.CHESS_WIN} نقطة!`, 'success');
  }
  
  setTimeout(() => {
    window.location.href = 'dashboard.html';
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
  // خصم الكوكيز
  const canAfford = await deductCookies(auth.currentUser.uid, COSTS.CHESS_GAME);
  if (!canAfford) {
    showToast('رصيدك غير كافي! تحتاج ' + COSTS.CHESS_GAME + ' كوكيز', 'error');
    setTimeout(() => window.location.href = 'dashboard.html', 2000);
    return;
  }
  
  const roomsRef = ref(db, 'chessRooms/');
  const snapshot = await get(roomsRef);
  const rooms = snapshot.val() || {};
  
  let joined = false;
  
  // البحث عن غرفة فارغة
  for (const key in rooms) {
    const room = rooms[key];
    if (room.player2 === null && room.player1 !== auth.currentUser.uid) {
      roomId = key;
      
      await set(ref(db, `chessRooms/${roomId}`), {
        player1: room.player1,
        player2: auth.currentUser.uid,
        createdAt: room.createdAt
      });
      
      myColor = 'black';
      joined = true;
      startGame(false);
      break;
    }
  }
  
  // إنشاء غرفة جديدة
  if (!joined) {
    const newRoomRef = push(roomsRef);
    roomId = newRoomRef.key;
    
    await set(newRoomRef, {
      player1: auth.currentUser.uid,
      player2: null,
      createdAt: Date.now()
    });
    
    myColor = 'white';
    
    document.getElementById('gameStatus').textContent = '⏳ في انتظار منافس...';
    
    onValue(ref(db, `chessRooms/${roomId}/player2`), (snapshot) => {
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
    document.getElementById('drawBtn').style.display = 'inline-block';
    
    // الأبيض يبدأ
    isMyTurn = (myColor === 'white');
    updateTurnIndicator();
    
    document.getElementById('yourColor').textContent = myColor === 'white' ? '⚪' : '⚫';
  });
  
  webrtc.onMessage((data) => {
    if (data.type === 'move') {
      receiveMove(data.move);
    } else if (data.type === 'chat') {
      displayChatMessage(data.message, false);
    } else if (data.type === 'resign') {
      endGame(myColor);
    } else if (data.type === 'draw_offer') {
      if (confirm('المنافس يطلب التعادل. هل توافق؟')) {
        webrtc.send({ type: 'draw_accept' });
        drawGame();
      }
    } else if (data.type === 'draw_accept') {
      drawGame();
    }
  });
  
  webrtc.onDisconnected(() => {
    showToast('انقطع الاتصال مع المنافس', 'error');
    setTimeout(() => window.location.href = 'dashboard.html', 2000);
  });
  
  webrtc.init(isInitiator);
  initBoard();
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
    endGame(myColor === 'white' ? 'black' : 'white');
  }
};

// طلب تعادل
document.getElementById('drawBtn').onclick = () => {
  webrtc.send({ type: 'draw_offer' });
  showToast('تم إرسال طلب التعادل', 'info');
};

// تعادل
async function drawGame() {
  document.getElementById('gameStatus').textContent = '🤝 تعادل!';
  await updatePoints(auth.currentUser.uid, REWARDS.CHESS_DRAW);
  showToast(`تعادل! حصلت على ${REWARDS.CHESS_DRAW} نقطة`, 'success');
  
  setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 3000);
}

// تنظيف عند الخروج
window.addEventListener('beforeunload', async () => {
  if (webrtc) await webrtc.close();
  if (roomId) await remove(ref(db, `chessRooms/${roomId}`));
});

// البدء
findOpponent();
