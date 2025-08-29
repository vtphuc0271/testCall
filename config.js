// config.js
// Cấu hình API endpoints
const API_CONFIG = {
  BASE_URL: 'https://api.ltc365.com',
  ENDPOINTS: {
    WEBRTC_HUB: '/hub/webrtc',
    NOTIFY_HUB: '/hub/notification',
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
let webrtcHub = null;
let notifyHub = null;

// DOM elements
let remoteIdInput = null;
let groupIdInput = null;
let statusDiv = null;
let videoCallBtn = null;
let audioCallBtn = null;
let hangupBtn = null;
let createGroupBtn = null;
let joinGroupBtn = null;
let leaveGroupBtn = null;
let currentGroupIdSpan = null;
let memberCountSpan = null;

// Call popup elements
let callPopup = null;
let callerNameDiv = null;
let callTypeDiv = null;
let callTimeDiv = null;
let acceptCallBtn = null;
let rejectCallBtn = null;

// Pending call data
let pendingCall = null;
let pendingOffer = null;
let pendingIceCandidates = [];

// Group call variables - THÊM vào đây
let currentGroupId = null;
let isGroupCall = false;
let groupPeers = {};
let groupIceQueues = {};