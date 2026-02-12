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

  // 드롭다운 알림 목록 로드
  function loadRecentNotifications() {
    fetch('/notifications/recent?limit=5')
        .then(res => res.json())
        .then(data => {
            if (data.notification && data.notifications.length > 0) {
                notificationList.innerHTML = data.notifications.map(n => `
                    <li class="notification-item ${!n.read ? 'unread' : ''}">
              <a href="${n.link}" class="text-decoration-none text-reset d-block"
                 onclick="markAsRead('${n._id}')">
                <div class="notification-content">
                  ${n.message}
                </div>
                <div class="notification-time">
                  ${formatTime(n.createdAt)}
                </div>
              </a>
            </li>
                `).join('');
            }
        })
        .catch (err => console.error('알림 목록 조회 오류:', err));
  }

  // 시간 포맷
  function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // 초 단위

    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    return date.toLocaleDateString('ko-KR');
  }

  // 초기 로드
  updateUnreadCount();
  loadRecentNotifications();

  // 30초마다 업데이트
  setInterval(() => {
    updateUnreadCount();
    loadRecentNotifications();
  }, 30000);

  const dropdown = document.getElementById('notificationDropdown');
  if (dropdown) {
    dropdown.addEventListener('shown.bs.dropdown', loadRecentNotifications);
  }

  // Socket.IO로 실시간 알림 (선택적)
  if (window.socket) {
    socket.on('new-notification', function(notification) {
      updateUnreadCount();
      
      // 알림 토스트 표시 (선택적)
      showNotificationToast(notification);
    });
  }
});

function markAsRead(notificationId) {
  fetch(`/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }).catch(err => console.error('알림 읽음 처리 오류:', err));
}

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