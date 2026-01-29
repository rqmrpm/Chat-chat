// js/webrtc.js
import { ref, set, onValue, push, onChildAdded, remove, get } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

export class WebRTCManager {
  constructor(db, roomId, userId) {
    this.db = db;
    this.roomId = roomId;
    this.userId = userId;
    this.peerConnection = null;
    this.dataChannel = null;
    this.onMessageCallback = null;
    this.onConnectedCallback = null;
    this.onDisconnectedCallback = null;
    this.isInitiator = false;
    
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
  }
  
  // تهيئة الاتصال
  async init(isInitiator) {
    this.isInitiator = isInitiator;
    this.peerConnection = new RTCPeerConnection(this.config);
    
    // معالجة حالة الاتصال
    this.peerConnection.onconnectionstatechange = () => {
      console.log('حالة الاتصال:', this.peerConnection.connectionState);
      
      if (this.peerConnection.connectionState === 'connected') {
        console.log('✅ متصل عبر P2P!');
      } else if (this.peerConnection.connectionState === 'disconnected' || 
                 this.peerConnection.connectionState === 'failed') {
        console.log('⚠️ انقطع الاتصال');
        if (this.onDisconnectedCallback) {
          this.onDisconnectedCallback();
        }
      }
    };
    
    // معالجة ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        push(ref(this.db, `signaling/${this.roomId}/ice/${this.userId}`), {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });
      }
    };
    
    if (isInitiator) {
      await this.createOffer();
    } else {
      await this.waitForOffer();
    }
    
    // استقبال ICE Candidates
    this.listenForICECandidates();
  }
  
  // إنشاء Offer (المبادر)
  async createOffer() {
    // إنشاء Data Channel
    this.dataChannel = this.peerConnection.createDataChannel('chat');
    this.setupDataChannel();
    
    // إنشاء Offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    // إرسال Offer إلى Firebase
    await set(ref(this.db, `signaling/${this.roomId}/offer`), {
      type: offer.type,
      sdp: offer.sdp,
      from: this.userId
    });
    
    console.log('✅ تم إرسال Offer');
    
    // الاستماع للـ Answer
    onValue(ref(this.db, `signaling/${this.roomId}/answer`), async (snapshot) => {
      if (snapshot.exists() && !this.peerConnection.currentRemoteDescription) {
        const answer = snapshot.val();
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('✅ تم استقبال Answer');
      }
    });
  }
  
  // انتظار Offer (المستقبل)
  async waitForOffer() {
    // الاستماع للـ Offer
    onValue(ref(this.db, `signaling/${this.roomId}/offer`), async (snapshot) => {
      if (snapshot.exists() && !this.peerConnection.currentRemoteDescription) {
        const offer = snapshot.val();
        
        // تجاهل إذا كان من نفس المستخدم
        if (offer.from === this.userId) return;
        
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('✅ تم استقبال Offer');
        
        // إنشاء Answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        // إرسال Answer إلى Firebase
        await set(ref(this.db, `signaling/${this.roomId}/answer`), {
          type: answer.type,
          sdp: answer.sdp,
          from: this.userId
        });
        
        console.log('✅ تم إرسال Answer');
      }
    });
    
    // استقبال Data Channel
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
      console.log('✅ تم استقبال Data Channel');
    };
  }
  
  // إعداد Data Channel
  setupDataChannel() {
    this.dataChannel.onopen = () => {
      console.log('✅ Data Channel مفتوح!');
      if (this.onConnectedCallback) {
        this.onConnectedCallback();
      }
    };
    
    this.dataChannel.onmessage = (event) => {
      if (this.onMessageCallback) {
        try {
          const data = JSON.parse(event.data);
          this.onMessageCallback(data);
        } catch (e) {
          // رسالة نصية عادية
          this.onMessageCallback({ type: 'text', content: event.data });
        }
      }
    };
    
    this.dataChannel.onerror = (error) => {
      console.error('❌ خطأ في Data Channel:', error);
    };
    
    this.dataChannel.onclose = () => {
      console.log('⚠️ تم إغلاق Data Channel');
      if (this.onDisconnectedCallback) {
        this.onDisconnectedCallback();
      }
    };
  }
  
  // الاستماع لـ ICE Candidates
  async listenForICECandidates() {
    // جلب معلومات الغرفة لمعرفة المستخدم الآخر
    const roomSnapshot = await get(ref(this.db, `rooms/${this.roomId}`));
    if (!roomSnapshot.exists()) return;
    
    const roomData = roomSnapshot.val();
    const otherUserId = roomData.user1 === this.userId ? roomData.user2 : roomData.user1;
    
    if (!otherUserId) return;
    
    // الاستماع لـ ICE Candidates من المستخدم الآخر
    onChildAdded(ref(this.db, `signaling/${this.roomId}/ice/${otherUserId}`), async (snapshot) => {
      const candidateData = snapshot.val();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
        console.log('✅ تم إضافة ICE Candidate');
      } catch (e) {
        console.error('❌ خطأ في إضافة ICE Candidate:', e);
      }
    });
  }
  
  // إرسال رسالة
  send(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.dataChannel.send(message);
      return true;
    }
    return false;
  }
  
  // تسجيل callback للرسائل
  onMessage(callback) {
    this.onMessageCallback = callback;
  }
  
  // تسجيل callback للاتصال
  onConnected(callback) {
    this.onConnectedCallback = callback;
  }
  
  // تسجيل callback للانقطاع
  onDisconnected(callback) {
    this.onDisconnectedCallback = callback;
  }
  
  // التحقق من حالة الاتصال
  isConnected() {
    return this.dataChannel && this.dataChannel.readyState === 'open';
  }
  
  // إغلاق الاتصال
  async close() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    // حذف بيانات Signaling من Firebase
    try {
      await remove(ref(this.db, `signaling/${this.roomId}`));
    } catch (e) {
      console.error('خطأ في حذف بيانات Signaling:', e);
    }
  }
}
