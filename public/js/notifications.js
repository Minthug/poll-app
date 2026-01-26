// public/js/notifications.js
document.addEventListener('DOMContentLoaded', function() {
  if (!window.currentUser) return;

  const badge = document.getElementById('notificationBadge');
  const notificationList = document.getElementById('notificationList');

  // 읽지 않은 알림 개수 업데이트
  function updateUnreadCount() {
    fetch('/notifications/unread-count')
      .then(res => res.json())
      .then(data => {
        if (data.count > 0) {
          badge.textContent = data.count > 99 ? '99+' : data.count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      })
      .catch(err => console.error('알림 개수 조회 오류:', err));
  }

  // 초기 로드
  updateUnreadCount();

  // 30초마다 업데이트
  setInterval(updateUnreadCount, 30000);

  // Socket.IO로 실시간 알림 (선택적)
  if (window.socket) {
    socket.on('new-notification', function(notification) {
      updateUnreadCount();
      
      // 알림 토스트 표시 (선택적)
      showNotificationToast(notification);
    });
  }
});

function showNotificationToast(notification) {
  // Bootstrap Toast 사용
  const toastHtml = `
    <div class="toast" role="alert">
      <div class="toast-header">
        <strong class="me-auto">새 알림</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">
        ${notification.message}
      </div>
    </div>
  `;
  
  // Toast 컨테이너가 필요함
  const container = document.getElementById('toastContainer');
  if (container) {
    container.insertAdjacentHTML('beforeend', toastHtml);
    const toast = new bootstrap.Toast(container.lastElementChild);
    toast.show();
  }
}