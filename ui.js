// ui.js
// Khởi tạo các DOM elements
function initializeUI() {
  remoteIdInput = document.getElementById("remoteId");
  statusDiv = document.getElementById("status");
  videoCallBtn = document.getElementById("videoCallBtn");
  audioCallBtn = document.getElementById("audioCallBtn");
  hangupBtn = document.getElementById("hangupBtn");
  
  // Call popup elements
  callPopup = document.getElementById("callPopup");
  callerNameDiv = document.getElementById("callerName");
  callTypeDiv = document.getElementById("callType");
  callTimeDiv = document.getElementById("callTime");
  acceptCallBtn = document.getElementById("acceptCallBtn");
  rejectCallBtn = document.getElementById("rejectCallBtn");
  
  // Đăng ký event listeners cho popup
  if (acceptCallBtn) {
    acceptCallBtn.addEventListener('click', acceptIncomingCall);
  }
  if (rejectCallBtn) {
    rejectCallBtn.addEventListener('click', rejectIncomingCall);
  }
}

// Cập nhật trạng thái hiển thị
function updateStatus(message, isError = false) {
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${isError ? "error" : "connected"}`;
  }
}

// Cập nhật trạng thái các nút bấm
function updateButtonStates() {
  if (videoCallBtn) videoCallBtn.disabled = isInCall;
  if (audioCallBtn) audioCallBtn.disabled = isInCall;
  if (hangupBtn) hangupBtn.disabled = !isInCall;
}

// Lấy User ID từ người dùng
function getUserId() {
  userId = prompt("Nhập user ID của bạn:", "user1");
  if (!userId) {
    alert("Cần phải có User ID để tiếp tục!");
    location.reload();
    return false;
  }
  
  document.getElementById("info").innerText = `Bạn đang đăng nhập với ID: ${userId}`;
  return true;
}

// Hiển thị video local
function setLocalVideo(stream) {
  const localVideo = document.getElementById("localVideo");
  if (localVideo) {
    localVideo.srcObject = stream;
  }
}

// Hiển thị video remote
function setRemoteVideo(stream) {
  const remoteVideo = document.getElementById("remoteVideo");
  if (remoteVideo) {
    remoteVideo.srcObject = stream;
  }
}

// Xóa video streams
function clearVideos() {
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  
  if (localVideo) localVideo.srcObject = null;
  if (remoteVideo) remoteVideo.srcObject = null;
}

// Hiển thị popup cuộc gọi đến
function showCallPopup(fromUserId, callType, offerData = null) {
    console.log("Showing call popup");
  if (callPopup) {
    // Cập nhật thông tin cuộc gọi
    if (callerNameDiv) callerNameDiv.textContent = fromUserId;
    if (callTypeDiv) callTypeDiv.textContent = `Cuộc gọi ${callType}`;
    if (callTimeDiv) callTimeDiv.textContent = new Date().toLocaleTimeString();
    console.log("offerData received in showCallPopup:", offerData);
    // Lưu thông tin cuộc gọi và offer (nếu có)
    pendingCall = { fromUserId, callType };
    if (offerData) {
      pendingOffer = { fromId: fromUserId, offer: offerData };
    }
    console.log("Pending call data set:", pendingOffer);
    // Hiển thị popup
    callPopup.style.display = 'flex';
    
    // Phát âm thanh chuông (nếu có)
    playRingtone();
  }
}

// Ẩn popup cuộc gọi
function hideCallPopup() {
  if (callPopup) {
    callPopup.style.display = 'none';
    pendingCall = null;
    pendingOffer = null;
    // Không clear pendingIceCandidates ở đây vì có thể cần dùng
    stopRingtone();
  }
}

// Chấp nhận cuộc gọi đến
async function acceptIncomingCall() {
  if (!pendingCall) return;
  
  console.log("Accepting call from:", pendingCall.fromUserId);
  
  // Nếu có offer đang chờ, xử lý offer
  if (pendingOffer) {
    console.log("Processing pending offer...");
    await processAcceptedOffer(pendingOffer.fromId, pendingOffer.offer);
  } else {
    console.log("No pending offer, setting up media only...");
    // Fallback: chỉ setup media nếu không có offer
    await handleIncomingCall(pendingCall.fromUserId, pendingCall.callType);
  }

  // Sau khi xử lý xong thì mới ẩn popup và xóa dữ liệu
  hideCallPopup();
}

// Từ chối cuộc gọi đến
async function rejectIncomingCall() {
  if (!pendingCall) return;
  
  const fromUserId = pendingCall.fromUserId;
  cleanupCall();
  updateStatus(`Đã từ chối cuộc gọi từ ${fromUserId}`);
  hideCallPopup();
  // Clear pending data khi từ chối
  pendingIceCandidates = [];
}

// Phát âm thanh chuông (có thể tùy chỉnh)
function playRingtone() {
  // Có thể thêm audio element để phát âm thanh chuông
  console.log("🔔 Playing ringtone...");
}

// Dừng âm thanh chuông
function stopRingtone() {
  console.log("🔇 Stopping ringtone...");
}