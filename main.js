// main.js
// Khởi tạo ứng dụng
async function initializeApp() {
  // Khởi tạo UI
  initializeUI();
  
  // Lấy User ID
  if (!getUserId()) {
    return;
  }
  
  // Khởi tạo SignalR
  initializeSignalR();
  registerSignalRHandlers();
  
  // Kết nối SignalR
  await connectSignalR();
  
  // Cleanup khi đóng trang
  window.addEventListener("beforeunload", () => {
    if (isGroupCall) {
      leaveGroupCall();
    } else {
      hangup();
    }
  });
}

// Kết nối SignalR
async function connectSignalR() {
  try {
    updateStatus("Đang kết nối...");

    // Kết nối cả hai hubs
    await Promise.all([
      webrtcHub.start(),
      notifyHub.start()
    ]);

    console.log("✅ SignalR connected.");
    updateStatus("Đã kết nối thành công. Sẵn sàng thực hiện cuộc gọi!");
    updateButtonStates();
  } catch (err) {
    console.error("❌ SignalR connection error:", err);
    updateStatus("Lỗi kết nối SignalR!", true);
  }
}

// Tạo cuộc gọi nhóm
async function createGroupCall() {
  // Kiểm tra kết nối
  if (!webrtcHub || webrtcHub.state !== signalR.HubConnectionState.Connected) {
    updateStatus("Chưa kết nối đến server. Vui lòng chờ...", true);
    return;
  }
  
  const groupId = groupIdInput.value.trim() || null;
  
  try {
    const result = await webrtcHub.invoke("CreateGroupCall", userId, groupId);
    currentGroupId = result;
    isGroupCall = true;
    isInCall = true;
    
    // Lấy danh sách thành viên
    const members = await webrtcHub.invoke("GetGroupMembers", currentGroupId);
    initializeGroupCallUI(members);
    updateGroupInfo(currentGroupId, members.length);
    
    // Thiết lập media
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalVideo(localStream);
    }
    
    updateButtonStates();
    updateStatus(`Đã tạo cuộc gọi nhóm: ${currentGroupId}`);
    
  } catch (error) {
    console.error("Lỗi khi tạo cuộc gọi nhóm:", error);
    updateStatus("Lỗi khi tạo cuộc gọi nhóm!", true);
  }
}

// Tham gia cuộc gọi nhóm
async function joinGroupCall() {
  const groupId = groupIdInput.value.trim();
  if (!groupId) {
    alert("Vui lòng nhập Group ID!");
    return;
  }
  
  try {
    const success = await webrtcHub.invoke("JoinGroupCall", groupId, userId);
    
    if (success) {
      currentGroupId = groupId;
      isGroupCall = true;
      isInCall = true;
      
      // Lấy danh sách thành viên
      const members = await webrtcHub.invoke("GetGroupMembers", currentGroupId);
      initializeGroupCallUI(members);
      updateGroupInfo(currentGroupId, members.length);
      
      // Thiết lập media
      if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalVideo(localStream);
      }
      
      // Gửi offer đến các thành viên khác
      for (const memberId of members) {
        if (memberId !== userId && !groupPeers[memberId]) {
          await createAndSendGroupOffer(memberId);
        }
      }
      
      updateButtonStates();
      updateStatus(`Đã tham gia cuộc gọi nhóm: ${currentGroupId}`);
    } else {
      updateStatus("Không thể tham gia cuộc gọi nhóm!", true);
    }
  } catch (error) {
    console.error("Lỗi khi tham gia cuộc gọi nhóm:", error);
    updateStatus("Lỗi khi tham gia cuộc gọi nhóm!", true);
  }
}

// Rời cuộc gọi nhóm
async function leaveGroupCall() {
  if (currentGroupId) {
    try {
      await webrtcHub.invoke("LeaveGroupCall", currentGroupId, userId);
      endGroupCall();
      updateStatus("Đã rời cuộc gọi nhóm");
    } catch (error) {
      console.error("Lỗi khi rời cuộc gọi nhóm:", error);
      updateStatus("Lỗi khi rời cuộc gọi nhóm!", true);
    }
  }
}

// Tạo và gửi offer cho thành viên nhóm
async function createAndSendGroupOffer(memberId) {
  const peer = createPeerConnection(memberId, true);
  groupPeers[memberId] = peer;
  
  // Thêm track vào peer connection
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  
  // Tạo và thiết lập offer
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  
  // Gửi offer đến thành viên
  await webrtcHub.invoke("SendSignalToGroup", currentGroupId, userId, "offer", offer);
}

// Kết thúc cuộc gọi nhóm
function endGroupCall() {
  // Dọn dẹp peer connections
  for (const memberId of Object.keys(groupPeers)) {
    if (groupPeers[memberId]) {
      groupPeers[memberId].close();
    }
  }
  
  // Reset variables
  groupPeers = {};
  groupIceQueues = {};
  currentGroupId = null;
  isGroupCall = false;
  isInCall = false;
  
  // Ẩn container nhóm
  document.getElementById('groupCallContainer').style.display = 'none';
  
  updateButtonStates();
}

// Khởi chạy ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', initializeApp);