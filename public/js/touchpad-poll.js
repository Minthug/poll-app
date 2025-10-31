// public/js/touchpad-poll.js 수정
document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 참조
  const voteForm = document.getElementById('vote-form');
  const optionZones = document.querySelectorAll('.option-zone');
  const optionIdInput = document.getElementById('option-id-input');
  const submitButton = document.querySelector('button[type="submit"]');
  const selectedOptionDiv = document.querySelector('.selected-option');
  const selectedOptionText = document.getElementById('selected-option-text');
  const resultsContainer = document.getElementById('results-container');
  const resultsDiv = document.getElementById('results');
  const totalVotesP = document.getElementById('total-votes');
  const backToVoteBtn = document.getElementById('back-to-vote');
  
  // 폼에서 poll ID 가져오기
  const pollId = voteForm.getAttribute('data-poll-id');
  
  // Socket.io 연결
  const socket = io();
  
  // 옵션 영역 클릭 이벤트
  optionZones.forEach(zone => {
    // 싱글 클릭 처리
    zone.addEventListener('click', () => {
      // 이전 선택 초기화
      optionZones.forEach(z => z.classList.remove('selected'));
      
      // 현재 선택 표시
      zone.classList.add('selected');
      
      // 선택한 옵션 ID 저장
      const optionId = zone.getAttribute('data-option-id');
      optionIdInput.value = optionId;
      
      // 선택한 옵션 텍스트 표시
      const optionText = zone.querySelector('.option-label').textContent;
      selectedOptionText.textContent = optionText;
      selectedOptionDiv.classList.remove('d-none');
      
      // 투표 버튼 활성화
      submitButton.disabled = false;
    });
    
    // 더블 클릭으로 바로 투표
    zone.addEventListener('dblclick', async () => {
      // 해당 옵션 ID 가져오기
      const optionId = zone.getAttribute('data-option-id');
      
      if (!optionId) return;
      
      try {
        const response = await fetch(`/polls/${pollId}/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ optionId })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // 결과 표시
          loadResults();
        } else {
          alert('투표 처리 중 오류가 발생했습니다: ' + data.error);
        }
      } catch (error) {
        console.error('Error:', error);
        alert('투표 처리 중 오류가 발생했습니다');
      }
    });
  });
  
  // 투표 제출 (버튼 클릭용)
  voteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!optionIdInput.value) {
      alert('옵션을 선택해주세요');
      return;
    }
    
    try {
      const response = await fetch(`/polls/${pollId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ optionId: optionIdInput.value })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 결과 표시
        loadResults();
      } else {
        alert('투표 처리 중 오류가 발생했습니다: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('투표 처리 중 오류가 발생했습니다');
    }
  });
  
  // 소켓 이벤트
  socket.on('vote-update', (data) => {
    if (data.pollId === pollId && !resultsContainer.classList.contains('d-none')) {
      loadResults();
    }
  });
  
  // 결과 로드
  async function loadResults() {
    try {
      console.log('결과 로드 시작...');
      const response = await fetch(`/polls/${pollId}/results`);
      
      // 응답 상태 확인
      if (!response.ok)