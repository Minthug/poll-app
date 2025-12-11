// 다크모드 공통 스크립트
function initDarkMode() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleDarkMode() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  const text = document.getElementById('themeText');
  
  if (icon && text) {
    if (theme === 'dark') {
      icon.textContent = '☀️';
      text.textContent = '라이트';
    } else {
      icon.textContent = '🌙';
      text.textContent = '다크';
    }
  }
}

// 세션 연장
function refreshSession() {
  fetch('/api/refresh-session', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        location.reload();
      }
    })
    .catch(error => console.error('세션 연장 실패:', error));
}

// 즉시 다크모드 초기화
initDarkMode();