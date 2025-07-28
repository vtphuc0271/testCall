// Tạo peer connection
function createPeer(toUserId) {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS
  });

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      try {
        await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEND_ICE}`, {
          toUserId: toUserId,
          fromUserId: userId,
          data: JSON.stringify(event.candidate),
        });
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
    console.log("Connection state:", pc.connectionState);
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      updateStatus("Kết nối bị ngắt!", true);
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
    const constraints = type === "video" 
      ? { video: true, audio: true } 
      : { video: false, audio: true };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    setLocalVideo(localStream);

    peer = createPeer(toUser);
    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    
    //console.log("Sending offer:", JSON.stringify(offer));
    const res = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEND_OFFER}`, {
      toUserId: toUser,
      fromUserId: userId,
      Data: JSON.stringify(offer),
    });
    
    if (res.status !== 200 && res.status !== 204) {
      throw new Error("send-offer thất bại");
    }

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
    const constraints = type === "video" 
      ? { video: true, audio: true } 
      : { video: false, audio: true };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    setLocalVideo(localStream);

    peer = createPeer(fromUserId);
    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

    isInCall = true;
    updateButtonStates();
    updateStatus(`Đang trong cuộc gọi ${type} với ${fromUserId}...`);
  } catch (error) {
    console.error("Lỗi khi nhận cuộc gọi:", error);
    updateStatus("Lỗi khi truy cập camera/microphone!", true);
  }
}