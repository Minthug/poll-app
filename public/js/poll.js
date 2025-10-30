document.addEventListener('DOMContentLoaded', () => {
  const touchOptions = document.querySelectorAll('.touch-option');
  const selectedOptionInput = document.getElementById('selected-option');
  const submitButton = document.querySelector('button[type="submit"]');
  const voteForm = document.getElementById('vote-form');
  const resultsContainer = document.getElementById('results-container');
  const pollId = voteForm.getAttribute('data-poll-id');
  
  // Socket.io 연결
  const socket = io();
  
  // 옵션 클릭 이벤트 처리
  touchOptions.forEach(option => {
    option.addEventListener('click', () => {
      // 선택 취소
      touchOptions.forEach(opt => opt.classList.remove('selected'));
      
      // 현재 옵션 선택
      option.classList.add('selected');
      
      // 숨겨진 입력에 선택한 옵션 ID 설정
      selectedOptionInput.value = option.getAttribute('data-option-id');
      
      // 제출 버튼 활성화
      submitButton.disabled = false;
    });
  });
  
  // 투표 폼 제출
  voteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedOptionInput.value) {
      alert('옵션을 선택해주세요');
      return;
    }
    
    try {
      const response = await fetch(`/polls/${pollId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ optionId: selectedOptionInput.value })
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
  
  // Socket.io 이벤트 처리
  socket.on('vote-update', (data) => {
    if (data.pollId === pollId && resultsContainer.classList.contains('d-block')) {
      loadResults();
    }
  });
  
  // 결과 로드 함수
  async function loadResults() {
    try {
      const response = await fetch(`/polls/${pollId}/results`);
      const data = await response.json();
      
      if (data.success) {
        // 결과 렌더링
        const { poll } = data;
        const totalVotes = poll.totalVotes;
        
        let resultsHTML = `
          <h3 class="mb-3">투표 결과</h3>
          <div class="results-grid">
        `;
        
        poll.options.forEach(option => {
          const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : 0;
          
          resultsHTML += `
            <div class="result-item">
              <div class="result-bar" style="height: ${percentage}%"></div>
              <div class="result-text">
                <div class="result-percentage">${percentage}%</div>
                <div class="result-label">${option.text}</div>
                <div class="result-votes">${option.votes}표</div>
              </div>
            </div>
          `;
        });
        
        resultsHTML += `
          </div>
          <p class="mt-3 text-muted">총 ${totalVotes}명 참여</p>
          <button id="back-to-vote" class="btn btn-outline-secondary">다시 투표하기</button>
        `;
        
        resultsContainer.innerHTML = resultsHTML;
        resultsContainer.classList.remove('d-none');
        resultsContainer.classList.add('d-block');
        voteForm.classList.add('d-none');
        
        // 다시 투표하기 버튼
        document.getElementById('back-to-vote').addEventListener('click', () => {
          resultsContainer.classList.remove('d-block');
          resultsContainer.classList.add('d-none');
          voteForm.classList.remove('d-none');
        });
      } else {
        alert('결과를 불러오는 중 오류가 발생했습니다: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('결과를 불러오는 중 오류가 발생했습니다');
    }
  }
});