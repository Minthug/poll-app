// public/js/touchpad-poll.js 수정
document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 참조
  const voteForm = document.getElementById('vote-form');
  const optionCards = document.querySelectorAll('.option-card');
  const optionIdInput = document.getElementById('option-id-input');
  const submitButton = document.querySelector('button[type="submit"]');
  const selectedOptionDiv = document.querySelector('.selected-option');
  const selectedOptionText = document.getElementById('selected-option-text');
  const resultsContainer = document.getElementById('results-container');
  const resultsDiv = document.getElementById('results');
  const totalVotesP = document.getElementById('total-votes');
  const backToVoteBtn = document.getElementById('back-to-vote');  

  // 폼에서 poll ID 가져오기
  const pollId = document.getElementById('vote-form').dataset.pollId;
  
  // Socket.io 연결
  const socket = io();
  
  socket.on('vote-update', (data) => {
    if (data.pollId === pollId) {
      updateVoteDisplay(data.poll);
    }
  });

  // 투표 정보 업데이트 함수
  function updateVoteDisplay(pollData) {
    // 총 투표 수 계산
    const totalVotes = pollData.options.reduce((sum, opt) => sum + opt.votes, 0);

    // 총 투표 수 업데이트
    document.getElementById('total-votes-count').textContent = totalVotes;

    // 각 옵션 업데이트
    pollData.options.forEach(option => {
      const card = document.querySelector(`[data-option-id="${option._id}]`);
      if (card) {
        const voteCount = card.querySelector('.vote-count');
        voteCount.textContent = `${option.votes}표`;

        // 비율 계산
        const percentage = totalVotes > 0 ? ((option.votes / totalVotes) * 100).toFixed(1) : 0;

        // 비율 업데이트
        const votePercentage = card.querySelector('.vote-percentage');
        votePercentage.textContent = `${percentage}%`;

        // 프로그레스 바 업데이트
        const progressBar = card.querySelector('.progress-bar');
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
      }
    }) 
  }

  // 옵션 영역 클릭 이벤트
  optionCards.forEach(card => {
    // 싱글 클릭 처리
    card.addEventListener('click', () => {
      console.log('옵션 클릭됨');
      // 이전 선택 초기화
      optionCards.forEach(z => z.classList.remove('selected'));
      
      // 현재 선택 표시
      card.classList.add('selected');
      
      // 선택한 옵션 ID 저장
      const optionId = card.getAttribute('data-option-id');
      optionIdInput.value = optionId;
      
      // 선택한 옵션 텍스트 표시
    const optionText = card.querySelector('.option-label').textContent;
    selectedOptionText.textContent = optionText;
    selectedOptionDiv.querySelector('.alert').classList.remove('d-none');
      
      // 투표 버튼 활성화
      submitButton.disabled = false;
    });
    
    // 더블 클릭으로 바로 투표
    card.addEventListener('dblclick', async () => {
      // 해당 옵션 ID 가져오기
      const optionId = card.getAttribute('data-option-id');
      
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
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('받은 데이터:', data);
    
    if (data.success) {
      const { poll } = data;
      const totalVotes = poll.totalVotes || poll.options.reduce((sum, opt) => sum + opt.votes, 0);
      
      let resultsHTML = '';
      
      poll.options.forEach(option => {
        const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : 0;
        
        resultsHTML += `
          <div class="mb-3">
            <div class="d-flex justify-content-between mb-1">
              <strong>${option.text}</strong>
              <span>${option.votes}표 (${percentage}%)</span>
            </div>
            <div class="progress">
              <div class="progress-bar" role="progressbar" style="width: ${percentage}%" 
                   aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
          </div>
        `;
      });
      
      resultsDiv.innerHTML = resultsHTML;
      totalVotesP.textContent = `총 ${totalVotes}명 참여`;
      
      // 결과 표시, 폼 숨기기
      voteForm.classList.add('d-none');
      resultsContainer.classList.remove('d-none');
    } else {
      alert('결과를 불러오는 중 오류가 발생했습니다: ' + (data.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('결과 로드 오류:', error);
    alert('결과를 불러오는 중 오류가 발생했습니다: ' + error.message);
  }
}

if (backToVoteBtn) {
  backToVoteBtn.addEventListener('click', () => {
    resultsContainer.classList.add('d-none');
    voteForm.classList.remove('d-none');
  });
}
});