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
    hangup();
  });
}

// Kết nối SignalR
async function connectSignalR() {
  try {
    updateStatus("Đang kết nối...");

    // Chỉ kết nối webrtcHub
    await webrtcHub.start();

    console.log("✅ SignalR connected.");
    updateStatus("Đã kết nối thành công. Sẵn sàng thực hiện cuộc gọi!");
    updateButtonStates();
  } catch (err) {
    console.error("❌ SignalR connection error:", err);
    updateStatus("Lỗi kết nối SignalR!", true);
  }
}

async function startGroupCall(groupId, members) {
    console.log("Starting group call in room:", groupId);
  currentGroupId = groupId;

  // Lấy stream
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  setLocalVideo(localStream);

  for (const memberId of members) {
    if (memberId === getUserId()) continue;

    const peer = createPeerConnection(memberId, true); // isGroup = true
    groupPeers[memberId] = peer;

    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    await webrtcHub.invoke("SendSignalToGroup", groupId, getUserId(), "offer", offer);
  }
}

// Khởi chạy ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', initializeApp);

document.addEventListener("keydown", async (e) => {
  if (e.key === "F2") {
    const groupId = "room1";
    const members = ["user1", "user2", "user3"]; // phải thay bằng danh sách thật từ server
    await startGroupCall(groupId, members);
  }
});