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

// Khởi chạy ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', initializeApp);