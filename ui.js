// ui.js
// Khởi tạo các DOM elements
function initializeUI() {
  remoteIdInput = document.getElementById("remoteId");
  groupIdInput = document.getElementById("groupId");
  statusDiv = document.getElementById("status");
  videoCallBtn = document.getElementById("videoCallBtn");
  audioCallBtn = document.getElementById("audioCallBtn");
  hangupBtn = document.getElementById("hangupBtn");
  createGroupBtn = document.getElementById("createGroupBtn");
  joinGroupBtn = document.getElementById("joinGroupBtn");
  leaveGroupBtn = document.getElementById("leaveGroupBtn");
  currentGroupIdSpan = document.getElementById("currentGroupId");
  memberCountSpan = document.getElementById("memberCount");
  
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
  if (createGroupBtn) createGroupBtn.disabled = isInCall;
  if (joinGroupBtn) joinGroupBtn.disabled = isInCall;
  if (leaveGroupBtn) leaveGroupBtn.disabled = !isGroupCall;
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

// Hiển thị video remote cho nhóm
function setGroupRemoteVideo(memberId, stream) {
  const videoElement = document.getElementById(`remoteVideo-${memberId}`);
  if (videoElement) {
    videoElement.srcObject = stream;
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
    await handleIncomingCall(pendingCall.fromUserId, pendingCall.callType);
  }

  hideCallPopup();
}

// Từ chối cuộc gọi đến
async function rejectIncomingCall() {
  if (!pendingCall) return;
  
  const fromUserId = pendingCall.fromUserId;
  cleanupCall();
  updateStatus(`Đã từ chối cuộc gọi từ ${fromUserId}`);
  hideCallPopup();
  pendingIceCandidates = [];
}

// Khởi tạo UI cho cuộc gọi nhóm
function initializeGroupCallUI(members) {
  // Xóa UI cũ
  const remoteVideosContainer = document.getElementById('remoteVideos');
  remoteVideosContainer.innerHTML = '';
  
  // Thêm UI cho các thành viên
  members.forEach(memberId => {
    if (memberId !== userId) {
      addGroupMemberUI(memberId);
    }
  });
  
  // Cập nhật số lượng thành viên
  if (memberCountSpan) {
    memberCountSpan.textContent = members.length;
  }
  
  // Hiển thị container cho video nhóm
  document.getElementById('groupCallContainer').style.display = 'block';
}

// Thêm UI thành viên nhóm
function addGroupMemberUI(memberId) {
  const remoteVideosContainer = document.getElementById('remoteVideos');
  
  // Kiểm tra xem đã có video cho thành viên này chưa
  if (!document.getElementById(`remoteVideo-${memberId}`)) {
    const videoContainer = document.createElement('div');
    videoContainer.className = 'remote-video-container';
    videoContainer.id = `remoteVideoContainer-${memberId}`;
    
    const video = document.createElement('video');
    video.id = `remoteVideo-${memberId}`;
    video.autoplay = true;
    video.playsInline = true;
    
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = memberId;
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(label);
    remoteVideosContainer.appendChild(videoContainer);
  }
}

// Xóa UI thành viên nhóm
function removeGroupMemberUI(memberId) {
  const videoContainer = document.getElementById(`remoteVideoContainer-${memberId}`);
  if (videoContainer) {
    videoContainer.remove();
  }
}

// Cập nhật thông tin nhóm
function updateGroupInfo(groupId, memberCount) {
  if (currentGroupIdSpan) {
    currentGroupIdSpan.textContent = groupId;
  }
  if (memberCountSpan) {
    memberCountSpan.textContent = memberCount;
  }
}

// Phát âm thanh chuông
function playRingtone() {
  console.log("🔔 Playing ringtone...");
}

// Dừng âm thanh chuông
function stopRingtone() {
  console.log("🔇 Stopping ringtone...");
}