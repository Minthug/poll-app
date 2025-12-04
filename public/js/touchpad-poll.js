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
  const pollId = voteForm ? voteForm.dataset.pollId : null;
  if (!pollId) {
    console.error('Poll ID를 찾을 수 없습니다');
    return;
  }

  console.log('Poll ID:', pollId);
  console.log('Poll ID type:', typeof pollId);
  console.log('Poll ID length:', pollId ? pollId.length : 0);
  
  // Socket.io 연결
  const socket = io();
  
  socket.on('vote-update', (data) => {
    console.log('Socket 데이터:', data);

    if (data && data.pollId === pollId) {
      if (data.poll && data.poll.options) {
        updateVoteDisplay(data.poll);
      } else {
        console.warn('poll data 없음:', data);
      }
    }
  });

  // 투표 성공 후 모달 표시 함수
  function showVoteSuccessModal() {
    // 기존 모달 제거
    const existingModal = document.getElementById('vote-success-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // 모달 HTML 생성
    const modalHTML = `
      <div class="modal fade" id="vote-success-modal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">✅ 투표 완료!</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center py-4">
              <p class="mb-4">투표해 주셔서 감사합니다!</p>
              <div class="d-grid gap-2">
                <a href="/polls/${pollId}/result" class="btn btn-primary btn-lg">
                  📊 상세 결과 보기
                </a>
                <a href="/polls" class="btn btn-outline-secondary">
                  목록으로 돌아가기
                </a>
                <button type="button" class="btn btn-outline-dark" data-bs-dismiss="modal">
                  이 페이지에 머물기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 모달 표시
    const modal = new bootstrap.Modal(document.getElementById('vote-success-modal'));
    modal.show();
  }

  // 투표 정보 업데이트 함수
  function updateVoteDisplay(pollData) {
    // 데이터 검증
    if (!pollData || !pollData.options) {
      console.error('pollData가 유효하지 않음:', pollData);
      return;
    }
    
    // 총 투표 수 계산
    const totalVotes = pollData.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);

    // 총 투표 수 업데이트
    const totalVotesElement = document.getElementById('total-votes-count');
    if (totalVotesElement) {
      totalVotesElement.textContent = totalVotes;
    }

    // 각 옵션 업데이트
    pollData.options.forEach(option => {
      const card = document.querySelector(`[data-option-id="${option._id}"]`);
      if (card) {
        const voteCount = card.querySelector('.vote-count');
        if (voteCount) {
          voteCount.textContent = `${option.votes}표`;
        }

        // 비율 계산
        const percentage = totalVotes > 0 ? ((option.votes / totalVotes) * 100).toFixed(1) : 0;

        // 비율 업데이트
        const votePercentage = card.querySelector('.vote-percentage');
        if (votePercentage) {
          votePercentage.textContent = `${percentage}%`;
        }

        // 프로그레스 바 업데이트
        const progressBar = card.querySelector('.progress-bar');
        if (progressBar) {
          progressBar.style.width = `${percentage}%`;
          progressBar.setAttribute('aria-valuenow', percentage);
        }
      }
    });
  }

  // 투표 실패 모달 표시 함수 추가
  function showVoteErrorModal(errorType, message) {
    // 기존 모달 제거
    const existingModal = document.getElementById('vote-error-modal');
    if (existingModal) {
      existingModal.remove();
    }

    let icon = '⚠️';
    let title = '알림';
    let buttonText = '확인';
    let buttons = '';

    if (errorType === 'alreadyVoted') {
          icon = '✅';
          title = '이미 투표하셨습니다';
          buttons = `
            <a href="/polls/${pollId}/result" class="btn btn-primary btn-lg">
              📊 결과 보기
            </a>
            <a href="/polls" class="btn btn-outline-secondary">
              목록으로
            </a>
          `;
    } else if (errorTpye === 'ended') {
      icon = '⏰';
      title = '투표가 종료되었습니다';
      buttons = `
        <a href="/polls/${pollId}/result" class="btn btn-primary btn-lg">
          📊 결과 보기
        </a>
        <a href="/polls" class="btn btn-outline-secondary">
          목록으로
        </a>
      `;
    } else if (errorType === 'blocked') {
      icon = '🚫';
      title = '투표 불가';
      buttons = `
        <a href="/polls" class="btn btn-primary">
          목록으로 돌아가기
        </a>
      `;
    } else {
      // 기타 에러
      icon = '❌';
      title = '오류 발생';
      buttons = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
          닫기
        </button>
      `;
    }
    
    const modalHTML = `
      <div class="modal fade" id="vote-error-modal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-warning text-dark">
              <h5 class="modal-title">${icon} ${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center py-4">
              <p class="mb-4">${message}</p>
              <div class="d-grid gap-2">
                ${buttons}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 모달 추가
    document.body.insertAdjacentElementHTML('beforeend', modalHTML);

    // 모달 표시
    const modal =  new bootstrap.Modal(document.getElementById('vote-error-modal'));
    modal.show();
  }

  // 옵션 영역 클릭 이벤트
  optionCards.forEach(card => {
    // 싱글 클릭 처리
    card.addEventListener('click', () => {
      console.log('옵션 클릭됨');
      // 이전 선택 초기화
      optionCards.forEach(c => c.classList.remove('selected'));
      
      // 현재 선택 표시
      card.classList.add('selected');
      
      // 선택한 옵션 ID 저장
      const optionId = card.getAttribute('data-option-id');
      optionIdInput.value = optionId;
      
      // 선택한 옵션 텍스트 표시
      const optionTextElement = card.querySelector('.card-title');
      if (optionTextElement && selectedOptionText) {
        selectedOptionText.textContent = optionTextElement.textContent;
        const alertElement = selectedOptionDiv.querySelector('.alert');
        if (alertElement) {
          alertElement.classList.remove('d-none');
        }
      }
      
      // 투표 버튼 활성화
      if (submitButton) {
        submitButton.disabled = false;
      }
    });
    
    // 더블 클릭으로 바로 투표 
    card.addEventListener('dblclick', async () => {
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
          // 모달 표시
          showVoteSuccessModal();
        } else {
          alert('투표 처리 중 오류가 발생했습니다: ' + data.error);
        }
      } catch (error) {
        console.error('Error:', error);
        alert('투표 처리 중 오류가 발생했습니다');
      }
    });
  });
  
  // 투표 제출 (버튼 클릭용) - 수정(12.4)
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
      console.log('서버 응답:', data); // 12.4 추가
      
      if (data.success) {
        // 모달 표시
        showVoteSuccessModal();
      } else {
        // 에러 타입에 따라 다른 모달 표시
        if (data.alreadyVoted) {
          showVoteErrorModal('alreadyVoted', '이미 이 여론조사에 투표 하셨습니다.');
        } else if (data.ended) {
          showVoteErrorModal('ended', '투표 기간이 종료 되었습니다.');
        } else if (data.blocked) {
          showVoteErrorModal('blocked', data.error || '한국에서만 투표가 가능합니다');
        } else {
          showVoteErrorModal('error', data.error || '투표 처리 중 오류가 발생했습니다');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      showVoteErrorModal('error', '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요');
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

        // 결과 보기 버튼이 있는지 확인하고 없으면 추가
        const existingResultButton = document.querySelector('.btn-result-detail');
        if (!existingResultButton) {
          const resultButton = document.createElement('a');
          resultButton.href = `/polls/${pollId}/result`;
          resultButton.className = 'btn btn-info me-2 btn-result-detail';
          resultButton.innerHTML = '📊 상세 결과 보기 (원 그래프)';
          resultButton.target = '_blank';

          const buttonContainer = resultsContainer.querySelector('.mt-3');
          if (buttonContainer) {
            buttonContainer.insertBefore(resultButton, buttonContainer.firstChild);
          }
        }
        
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