// signalr-handlers.js
// XÓA các dòng này:
// let groupPeers = {}; // key: userId, value: RTCPeerConnection
// let groupIceQueues = {}; // key: userId, value: array of ICE

function initializeSignalR() {
  notifyHub = new signalR.HubConnectionBuilder()
    .withUrl(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTIFY_HUB}?userId=${userId}`)
    .build();

  webrtcHub = new signalR.HubConnectionBuilder()
    .withUrl(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WEBRTC_HUB}?userId=${userId}`)
    .build();
}

// Đăng ký các event handlers
function registerSignalRHandlers() {
  // Chỉ sử dụng ReceiveOffer để hiển thị popup và xử lý cuộc gọi
  webrtcHub.on("ReceiveOffer", async (fromId, offer) => {
    // Kiểm tra xem có phải là group call không
    if (isGroupCall && currentGroupId) {
      await handleGroupOffer(fromId, offer);
    } else {
      await handleOfferWithPopup(fromId, offer);
    }
  });

  // Xử lý nhận answer
  webrtcHub.on("ReceiveAnswer", async (fromId, answer) => {
    if (isGroupCall && currentGroupId) {
      await handleGroupAnswer(fromId, answer);
    } else {
      await handleAnswer(fromId, answer);
    }
  });

  // Xử lý nhận ICE candidate
  webrtcHub.on("ReceiveIceCandidate", async (fromId, candidate) => {
    if (isGroupCall && currentGroupId) {
      await handleGroupIceCandidate(fromId, candidate);
    } else {
      await handleIceCandidate(fromId, candidate);
    }
  });

  // Xử lý tín hiệu chung (cho cả 1-1 và nhóm)
  webrtcHub.on("ReceiveSignal", async (signalData) => {
    const { type, fromUserId, data } = signalData;
    
    if (type === "offer") {
      if (isGroupCall && currentGroupId) {
        await handleGroupOffer(fromUserId, data);
      } else {
        await handleOfferWithPopup(fromUserId, data);
      }
    } else if (type === "answer") {
      if (isGroupCall && currentGroupId) {
        await handleGroupAnswer(fromUserId, data);
      } else {
        await handleAnswer(fromUserId, data);
      }
    } else if (type === "ice-candidate") {
      if (isGroupCall && currentGroupId) {
        await handleGroupIceCandidate(fromUserId, data);
      } else {
        await handleIceCandidate(fromUserId, data);
      }
    }
  });

  // Xử lý sự kiện nhóm
  webrtcHub.on("UserJoinedGroup", (userId) => {
    console.log(`User ${userId} joined the group`);
    if (isGroupCall) {
      addGroupMemberUI(userId);
    }
  });

  webrtcHub.on("UserLeftGroup", (userId) => {
    console.log(`User ${userId} left the group`);
    if (isGroupCall) {
      removeGroupMemberUI(userId);
      cleanupGroupPeer(userId);
    }
  });

  webrtcHub.on("GroupMembers", (members) => {
    console.log("Group members received:", members);
    if (isGroupCall) {
      initializeGroupCallUI(members);
    }
  });

  webrtcHub.on("UserJoinedCall", (userId) => {
    console.log(`User ${userId} joined the call`);
    if (isGroupCall) {
      addGroupMemberUI(userId);
    }
  });

  webrtcHub.on("UserLeftCall", (userId) => {
    console.log(`User ${userId} left the call`);
    if (isGroupCall) {
      removeGroupMemberUI(userId);
      cleanupGroupPeer(userId);
    }
  });

  webrtcHub.on("GroupCallEnded", (userId) => {
    console.log(`Group call ended by ${userId}`);
    endGroupCall();
  });
}

// Xử lý offer với popup - chờ user quyết định
async function handleOfferWithPopup(fromId, offer) {
  try {
    console.log("Received offer from:", fromId, "Data:", offer);

    if (!offer || offer === "null" || offer === "undefined") {
      console.error("Invalid offer data:", offer);
      updateStatus("Nhận được offer không hợp lệ!", true);
      return;
    }

    // Validate offer format trước
    let parsedOffer;
    try {
      parsedOffer = typeof offer === 'string' ? JSON.parse(offer) : offer;
    } catch (parseError) {
      console.error("Failed to parse offer JSON:", parseError);
      updateStatus("Lỗi parse offer JSON!", true);
      return;
    }

    if (!parsedOffer || !parsedOffer.type || !parsedOffer.sdp) {
      console.error("Invalid offer format:", parsedOffer);
      updateStatus("Format offer không hợp lệ!", true);
      return;
    }

    // Kiểm tra đang trong cuộc gọi khác
    if (isInCall && !isGroupCall) {
      updateStatus("Đang trong cuộc gọi khác, không thể nhận!", true);
      return;
    }

    // Xác định loại cuộc gọi từ offer
    const hasVideo = parsedOffer.sdp.includes('m=video');
    const callType = hasVideo ? 'video' : 'audio';

    // Hiển thị popup với offer data
    showCallPopup(fromId, callType, offer);

  } catch (error) {
    console.error("Lỗi khi xử lý offer:", error);
    updateStatus("Lỗi khi xử lý offer!", true);
  }
}

// Xử lý offer cho nhóm
async function handleGroupOffer(fromId, offer) {
  console.log("Received group offer from:", fromId, "Data:", offer);
  
  // Nếu đã có peer connection với user này, bỏ qua
  if (groupPeers[fromId]) return;

  // Tạo peer connection mới
  const peer = createPeerConnection(fromId, true);
  groupPeers[fromId] = peer;

  // Parse offer nếu cần
  const parsedOffer = typeof offer === 'string' ? JSON.parse(offer) : offer;
  
  await peer.setRemoteDescription(new RTCSessionDescription(parsedOffer));

  // Add local stream nếu có
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    setLocalVideo(localStream);
  }

  // Thêm track vào peer connection
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  // Tạo và thiết lập answer
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  // Gửi answer tới nhóm
  await webrtcHub.invoke("SendSignalToGroup", currentGroupId, userId, "answer", answer);
}

// Xử lý offer khi user đã chấp nhận
async function processAcceptedOffer(fromId, offer) {
  try {
    console.log("Processing accepted offer from:", fromId);
    
    // Parse offer
    const parsedOffer = typeof offer === 'string' ? JSON.parse(offer) : offer;
    
    // Tạo peer connection trước
    if (!peer) {
      console.log("Creating new peer connection...");
      peer = createPeerConnection(fromId);
    }

    // Setup media stream trước khi set remote description
    const hasVideo = parsedOffer.sdp.includes('m=video');
    const constraints = hasVideo 
      ? { video: true, audio: true } 
      : { video: false, audio: true };

    console.log("Getting user media with constraints:", constraints);
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    setLocalVideo(localStream);
    
    // Add tracks to peer connection
    localStream.getTracks().forEach((track) => {
      console.log("Adding track:", track.kind);
      peer.addTrack(track, localStream);
    });

    // Set remote description
    console.log("Setting remote description...");
    await peer.setRemoteDescription(new RTCSessionDescription(parsedOffer));

    // Xử lý các ICE candidate đã được queue
    if (pendingIceCandidates.length > 0) {
      await processPendingIceCandidates();
    }

    // Tạo và gửi answer
    console.log("Creating answer...");
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    console.log("Sending answer to:", fromId);
    try {
      // Sử dụng SendSignal cho cả 1-1 và nhóm
      if (isGroupCall && currentGroupId) {
        await webrtcHub.invoke('SendSignalToGroup', currentGroupId, userId, "answer", answer);
      } else {
        await webrtcHub.invoke('SendAnswer', userId, fromId, JSON.stringify(answer));
      }
      console.log("Answer sent successfully");
    } catch (invokeError) {
      console.error("Failed to send answer via invoke:", invokeError);
      updateStatus("Lỗi khi gửi answer!", true);
      cleanupCall();
      return;
    }

    // Cập nhật trạng thái
    isInCall = true;
    updateButtonStates();
    updateStatus(`Đang trong cuộc gọi với ${fromId}...`);
    console.log("Call setup completed successfully");

  } catch (error) {
    console.error("Lỗi khi xử lý offer đã chấp nhận:", error);
    updateStatus("Lỗi khi xử lý offer!", true);
    cleanupCall();
  }
}

// Xử lý answer
async function handleAnswer(fromId, answer) {
  try {
    console.log("Received answer from:", fromId, "Data:", answer);

    if (!answer || answer === "null" || answer === "undefined") {
      console.error("Invalid answer data:", answer);
      updateStatus("Nhận được answer không hợp lệ!", true);
      return;
    }

    if (!peer) {
      console.error("No peer connection available");
      updateStatus("Không có kết nối peer!", true);
      return;
    }

    // Kiểm tra trạng thái peer connection
    console.log("Peer connection state:", peer.signalingState);
    if (peer.signalingState !== "have-local-offer") {
      console.error("Peer connection in wrong state for answer:", peer.signalingState);
      updateStatus(`Trạng thái peer không đúng: ${peer.signalingState}`, true);
      return;
    }

    let parsedAnswer;
    try {
      parsedAnswer = typeof answer === 'string' ? JSON.parse(answer) : answer;
    } catch (parseError) {
      console.error("Failed to parse answer JSON:", parseError);
      updateStatus("Lỗi parse answer JSON!", true);
      return;
    }

    if (!parsedAnswer || !parsedAnswer.type || !parsedAnswer.sdp) {
      console.error("Invalid answer format:", parsedAnswer);
      updateStatus("Format answer không hợp lệ!", true);
      return;
    }

    console.log("Setting remote description with answer...");
    await peer.setRemoteDescription(new RTCSessionDescription(parsedAnswer));
    console.log("Remote description set successfully");
    updateStatus("Kết nối thành công!");
  } catch (error) {
    console.error("Lỗi khi xử lý answer:", error);
    updateStatus("Lỗi khi xử lý answer!", true);
  }
}

// Xử lý ICE candidate
async function handleIceCandidate(fromId, candidate) {
  try {
    console.log("Received ICE candidate from:", fromId, "Data:", candidate);

    if (!candidate || candidate === "null" || candidate === "undefined") {
      console.error("Invalid candidate data:", candidate);
      return;
    }

    // Parse candidate trước
    let parsedCandidate;
    try {
      parsedCandidate = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
    } catch (parseError) {
      console.error("Failed to parse candidate JSON:", parseError);
      return;
    }

    if (!parsedCandidate || typeof parsedCandidate.candidate === "undefined") {
      console.error("Invalid candidate format:", parsedCandidate);
      return;
    }

    // Nếu chưa có peer hoặc chưa có remote description, lưu vào queue
    if (!peer || !peer.remoteDescription) {
      console.log("Peer not ready, queueing ICE candidate");
      pendingIceCandidates.push({ fromId, candidate: parsedCandidate });
      return;
    }

    console.log("Adding ICE candidate...");
    await peer.addIceCandidate(new RTCIceCandidate(parsedCandidate));
    console.log("ICE candidate added successfully");
  } catch (error) {
    console.error("Lỗi khi thêm ICE candidate:", error);
  }
}

// Xử lý ICE candidate cho nhóm
async function handleGroupIceCandidate(fromId, candidate) {
  console.log("Received group ICE candidate from:", fromId, "Data:", candidate);
  const peer = groupPeers[fromId];

  // Parse candidate nếu cần
  const parsedCandidate = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
  const ice = new RTCIceCandidate(parsedCandidate);

  if (peer && peer.remoteDescription) {
    await peer.addIceCandidate(ice);
  } else {
    // Lưu vào queue nếu peer chưa sẵn sàng
    if (!groupIceQueues[fromId]) groupIceQueues[fromId] = [];
    groupIceQueues[fromId].push(ice);
  }
}

// Tạo peer connection
function createPeerConnection(remoteId, isGroup = false) {
  const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      if (isGroup) {
        webrtcHub.invoke("SendSignalToGroup", currentGroupId, userId, "ice-candidate", event.candidate);
      } else {
        webrtcHub.invoke("SendIceCandidate", userId, remoteId, JSON.stringify(event.candidate));
      }
    }
  };

  peer.ontrack = (event) => {
    if (isGroup) {
      setGroupRemoteVideo(remoteId, event.streams[0]);
    } else {
      setRemoteVideo(event.streams[0]);
    }
  };

  peer.onconnectionstatechange = () => {
    console.log(`Peer connection state changed to: ${peer.connectionState}`);
    if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
      if (isGroup) {
        cleanupGroupPeer(remoteId);
      }
    }
  };

  return peer;
}

// Xử lý các ICE candidate đã được queue
async function processPendingIceCandidates() {
  console.log("Processing", pendingIceCandidates.length, "pending ICE candidates");
  
  for (const item of pendingIceCandidates) {
    try {
      console.log("Adding queued ICE candidate from:", item.fromId);
      await peer.addIceCandidate(new RTCIceCandidate(item.candidate));
    } catch (error) {
      console.error("Error adding queued ICE candidate:", error);
    }
  }
  
  // Clear queue
  pendingIceCandidates = [];
}

// Hàm mới: Tạo cuộc gọi nhóm
async function createGroupCall(groupId = null) {
  try {
    const result = await webrtcHub.invoke("CreateGroupCall", userId, groupId);
    currentGroupId = result;
    isGroupCall = true;
    isInCall = true;
    
    // Lấy danh sách thành viên
    const members = await webrtcHub.invoke("GetGroupMembers", currentGroupId);
    initializeGroupCallUI(members);
    
    updateButtonStates();
    updateStatus(`Đã tạo cuộc gọi nhóm: ${currentGroupId}`);
    
    return currentGroupId;
  } catch (error) {
    console.error("Lỗi khi tạo cuộc gọi nhóm:", error);
    updateStatus("Lỗi khi tạo cuộc gọi nhóm!", true);
  }
}

// Hàm mới: Tham gia cuộc gọi nhóm
async function joinGroupCall(groupId) {
  try {
    const success = await webrtcHub.invoke("JoinGroupCall", groupId, userId);
    
    if (success) {
      currentGroupId = groupId;
      isGroupCall = true;
      isInCall = true;
      
      // Lấy danh sách thành viên
      const members = await webrtcHub.invoke("GetGroupMembers", currentGroupId);
      initializeGroupCallUI(members);
      
      // Thiết lập media và gửi offer đến các thành viên khác
      await setupGroupCallMedia();
      
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

// Hàm mới: Thiết lập media cho cuộc gọi nhóm
async function setupGroupCallMedia() {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    setLocalVideo(localStream);
  }
  
  // Gửi offer đến tất cả thành viên trong nhóm
  for (const memberId of Object.keys(groupPeers)) {
    if (memberId !== userId) {
      await createAndSendGroupOffer(memberId);
    }
  }
}

// Hàm mới: Tạo và gửi offer cho thành viên nhóm
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

// Hàm mới: Rời cuộc gọi nhóm
async function leaveGroupCall() {
  if (currentGroupId) {
    await webrtcHub.invoke("LeaveGroupCall", currentGroupId, userId);
    endGroupCall();
  }
}

// Hàm mới: Kết thúc cuộc gọi nhóm
async function endGroupCall() {
  if (currentGroupId) {
    await webrtcHub.invoke("EndGroupCall", currentGroupId, userId);
    
    // Dọn dẹp
    for (const memberId of Object.keys(groupPeers)) {
      cleanupGroupPeer(memberId);
    }
    
    groupPeers = {};
    groupIceQueues = {};
    currentGroupId = null;
    isGroupCall = false;
    isInCall = false;
    
    updateButtonStates();
    updateStatus("Cuộc gọi nhóm đã kết thúc");
  }
}

// Hàm mới: Dọn dẹp peer connection nhóm
function cleanupGroupPeer(memberId) {
  if (groupPeers[memberId]) {
    groupPeers[memberId].close();
    delete groupPeers[memberId];
  }
  
  // Xóa video element tương ứng
  const videoElement = document.getElementById(`remoteVideo-${memberId}`);
  if (videoElement) {
    videoElement.remove();
  }
}

// Hàm mới: Khởi tạo UI cho cuộc gọi nhóm
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
  
  // Hiển thị container cho video nhóm
  document.getElementById('groupCallContainer').style.display = 'block';
}

// Hàm mới: Thêm UI thành viên nhóm
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

// Hàm mới: Xóa UI thành viên nhóm
function removeGroupMemberUI(memberId) {
  const videoContainer = document.getElementById(`remoteVideoContainer-${memberId}`);
  if (videoContainer) {
    videoContainer.remove();
  }
}

// Hàm mới: Thiết lập video cho nhóm
function setGroupRemoteVideo(memberId, stream) {
  const videoElement = document.getElementById(`remoteVideo-${memberId}`);
  if (videoElement) {
    videoElement.srcObject = stream;
  }
}