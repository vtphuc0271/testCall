// Khởi tạo SignalR connections
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
    await handleOfferWithPopup(fromId, offer);
  });

  // Xử lý nhận answer
  webrtcHub.on("ReceiveAnswer", async (fromId, answer) => {
    await handleAnswer(fromId, answer);
  });

  // Xử lý nhận ICE candidate
  webrtcHub.on("ReceiveIceCandidate", async (fromId, candidate) => {
    await handleIceCandidate(fromId, candidate);
  });
}

// Xử lý offer với popup - chờ user quyết định
async function handleOfferWithPopup(fromId, offer) {
  try {
    //console.log("Received offer from:", fromId, "Data:", offer);

    if (!offer || offer === "null" || offer === "undefined") {
      console.error("Invalid offer data:", offer);
      updateStatus("Nhận được offer không hợp lệ!", true);
      return;
    }

    // Validate offer format trước
    let parsedOffer;
    try {
      parsedOffer = JSON.parse(offer);
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
    if (isInCall) {
      updateStatus("Đang trong cuộc gọi khác, không thể nhận!", true);
      return;
    }

    // Xác định loại cuộc gọi từ offer
    const hasVideo = parsedOffer.sdp.includes('m=video');
    const callType = hasVideo ? 'video' : 'audio';

    //console.log("Showing popup for call type:", callType);
    // Hiển thị popup với offer data
    console.log(fromId, callType, offer);
    showCallPopup(fromId, callType, offer);

  } catch (error) {
    console.error("Lỗi khi xử lý offer:", error);
    updateStatus("Lỗi khi xử lý offer!", true);
  }
}

// Xử lý offer khi user đã chấp nhận
async function processAcceptedOffer(fromId, offer) {
  try {
    console.log("Processing accepted offer from:", fromId);
    
    // Parse offer
    const parsedOffer = JSON.parse(offer);
    
    // Tạo peer connection trước
    if (!peer) {
      console.log("Creating new peer connection...");
      peer = createPeer(fromId);
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
      await webrtcHub.invoke('SendAnswer', fromId, userId, JSON.stringify(answer));
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

// Gửi tín hiệu bận - không cần vì backend chưa support
// async function sendBusySignal() - đã xóa

// Xử lý khi cuộc gọi bị từ chối - không cần vì backend chưa support
// function handleCallRejected() - đã xóa

// Xử lý answer
async function handleAnswer(fromId, answer) {
  try {
    //console.log("Received answer from:", fromId, "Data:", answer);

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

    let parsedAnswer;
    try {
      parsedAnswer = JSON.parse(answer);
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

    await peer.setRemoteDescription(new RTCSessionDescription(parsedAnswer));
    updateStatus("Kết nối thành công!");
  } catch (error) {
    console.error("Lỗi khi xử lý answer:", error);
    updateStatus("Lỗi khi xử lý answer!", true);
  }
}

// Xử lý ICE candidate
async function handleIceCandidate(fromId, candidate) {
  try {
    //console.log("Received ICE candidate from:", fromId, "Data:", candidate);

    if (!candidate || candidate === "null" || candidate === "undefined") {
      console.error("Invalid candidate data:", candidate);
      return;
    }

    // Parse candidate trước
    let parsedCandidate;
    try {
      parsedCandidate = JSON.parse(candidate);
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

// Tạo peer connection
function createPeer(toUserId) {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
  });

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      try {
        await webrtcHub.invoke('SendIceCandidate', userId, toUserId, JSON.stringify(event.candidate));
      } catch (error) {
        console.error("Lỗi khi gửi ICE candidate:", error);
      }
    }
  };

  pc.ontrack = (event) => {
    setRemoteVideo(event.streams[0]);
    updateStatus("Đã kết nối thành công!");
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    console.log("Connection state:", state);

    if (state === "failed" || state === "disconnected" || state === "closed") {
      handleConnectionLost();
    }
  };

  return pc;
}

// Bắt đầu cuộc gọi
async function startCall(type) {
  const toUser = remoteIdInput.value.trim();
  if (!toUser) {
    alert("Vui lòng nhập Remote ID!");
    return;
  }

  if (toUser === userId) {
    alert("Không thể gọi cho chính mình!");
    return;
  }

  if (isInCall) {
    alert("Đang trong cuộc gọi khác!");
    return;
  }

  try {
    const constraints =
      type === "video"
        ? { video: true, audio: true }
        : { video: false, audio: true };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    setLocalVideo(localStream);

    peer = createPeer(toUser);
    localStream
      .getTracks()
      .forEach((track) => peer.addTrack(track, localStream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    //console.log("Sending offer:", JSON.stringify(offer));
    await webrtcHub.invoke('SendOffer', userId, toUser, JSON.stringify(offer));
    console.log("Offer sent successfully");

    isInCall = true;
    updateButtonStates();
    updateStatus(`Đang gọi ${type} cho ${toUser}...`);
  } catch (error) {
    console.error("Lỗi khi bắt đầu cuộc gọi:", error);
    updateStatus("Lỗi khi bắt đầu cuộc gọi!", true);
    cleanupCall();
  }
}

// Kết thúc cuộc gọi
function hangup() {
  cleanupCall();
  updateStatus("Đã cúp máy");
}

function handleConnectionLost() {
  if (isInCall) {
    console.warn("🛑 Connection lost, ending call...");
    cleanupCall();
    updateStatus("Kết nối bị mất. Cuộc gọi đã kết thúc.", true);
  }
}

// Dọn dẹp resources
function cleanupCall() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (peer) {
    peer.close();
    peer = null;
  }

  // Clear pending data
  pendingIceCandidates = [];

  clearVideos();
  isInCall = false;
  updateButtonStates();
}

// Xử lý nhận cuộc gọi - không còn cần vì chỉ dùng offer
// function handleIncomingCallNotification() - đã xóa

// Xử lý khi chấp nhận cuộc gọi từ popup
async function handleIncomingCall(fromUserId, type) {
  try {
    const constraints =
      type === "video"
        ? { video: true, audio: true }
        : { video: false, audio: true };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    setLocalVideo(localStream);

    peer = createPeer(fromUserId);
    localStream
      .getTracks()
      .forEach((track) => peer.addTrack(track, localStream));

    isInCall = true;
    updateButtonStates();
    updateStatus(`Đang trong cuộc gọi ${type} với ${fromUserId}...`);
  } catch (error) {
    console.error("Lỗi khi nhận cuộc gọi:", error);
    updateStatus("Lỗi khi truy cập camera/microphone!", true);
  }
}