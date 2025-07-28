// Cấu hình API endpoints
const API_CONFIG = {
  BASE_URL: 'https://api.ltc365.com',
  ENDPOINTS: {
    WEBRTC_HUB: '/hub/webrtc',
    SEND_OFFER: '/api/WebRTC/send-offer',
    SEND_ANSWER: '/api/WebRTC/send-answer',
    SEND_ICE: '/api/WebRTC/send-ice'
  }
};

// Cấu hình ICE servers
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];

// Biến toàn cục
let userId = null;
let peer = null;
let localStream = null;
let isInCall = false;
let webrtcHub = null; // Chỉ cần webrtcHub

// DOM elements
let remoteIdInput = null;
let statusDiv = null;
let videoCallBtn = null;
let audioCallBtn = null;
let hangupBtn = null;

// Call popup elements
let callPopup = null;
let callerNameDiv = null;
let callTypeDiv = null;
let callTimeDiv = null;
let acceptCallBtn = null;
let rejectCallBtn = null;

// Pending call data
let pendingCall = null;
let pendingOffer = null; // Lưu offer đang chờ xử lý
let pendingIceCandidates = []; // Queue ICE candidates khi chưa có peer