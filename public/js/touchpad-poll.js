// public/js/touchpad-poll.js
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

  // ========================================
  // 스티커 색상 팔레트 (옵션 인덱스별)
  // ========================================
  const STICKER_COLORS = [
    '#FF6B6B', // 빨강
    '#4ECDC4', // 민트
    '#FFE66D', // 노랑
    '#95E1D3', // 연두
    '#F38181', // 코랄
    '#AA96DA', // 보라
    '#FCE38A', // 골드
    '#82CCDD'  // 스카이블루
  ];

  const MAX_STICKERS = 50;

  // ========================================
  // 스티커 생성 함수
  // ========================================
  function createSticker(container, color, animate) {
    const sticker = document.createElement('div');
    sticker.className = 'sticker';
    if (animate) {
      sticker.classList.add('new');
    }

    // 랜덤 미세 회전 (-15도 ~ +15도)
    const rotation = (Math.random() * 30 - 15).toFixed(1);
    sticker.style.setProperty('--rotation', rotation + 'deg');
    sticker.style.backgroundColor = color;

    if (!animate) {
      sticker.style.transform = 'scale(1) rotate(' + rotation + 'deg)';
    }

    container.appendChild(sticker);
    return sticker;
  }

  // ========================================
  // 기존 투표 수만큼 스티커 초기화
  // ========================================
  function initStickers() {
    optionCards.forEach(card => {
      const votes = parseInt(card.dataset.votes, 10) || 0;
      const index = parseInt(card.dataset.optionIndex, 10) || 0;
      const color = STICKER_COLORS[index % STICKER_COLORS.length];
      const stickerArea = card.querySelector('.sticker-area');

      if (!stickerArea) return;

      const displayCount = Math.min(votes, MAX_STICKERS);

      for (let i = 0; i < displayCount; i++) {
        createSticker(stickerArea, color, false);
      }

      // 스티커가 최대치를 넘으면 "+N" 표시
      if (votes > MAX_STICKERS) {
        const overflow = document.createElement('span');
        overflow.className = 'sticker-overflow';
        overflow.textContent = '+' + (votes - MAX_STICKERS);
        stickerArea.appendChild(overflow);
      }
    });
  }

  // 페이지 로드 시 스티커 초기화
  initStickers();

  // ========================================
  // 스티커 1개 추가 (애니메이션 포함)
  // ========================================
  function addStickerToOption(optionId) {
    const card = document.querySelector('[data-option-id="' + optionId + '"]');
    if (!card) return;

    const index = parseInt(card.dataset.optionIndex, 10) || 0;
    const color = STICKER_COLORS[index % STICKER_COLORS.length];
    const stickerArea = card.querySelector('.sticker-area');
    if (!stickerArea) return;

    // 현재 스티커 수 체크
    const currentStickers = stickerArea.querySelectorAll('.sticker').length;
    const overflowEl = stickerArea.querySelector('.sticker-overflow');

    if (currentStickers >= MAX_STICKERS) {
      // overflow 텍스트만 업데이트
      if (overflowEl) {
        const currentExtra = parseInt(overflowEl.textContent.replace('+', ''), 10) || 0;
        overflowEl.textContent = '+' + (currentExtra + 1);
      } else {
        const overflow = document.createElement('span');
        overflow.className = 'sticker-overflow';
        overflow.textContent = '+1';
        stickerArea.appendChild(overflow);
      }
    } else {
      // overflow 앞에 삽입
      const sticker = createSticker(stickerArea, color, true);
      if (overflowEl) {
        stickerArea.insertBefore(sticker, overflowEl);
      }
    }

    // 투표 수 텍스트 업데이트
    const countEl = card.querySelector('.sticker-count');
    if (countEl) {
      const currentVotes = parseInt(card.dataset.votes, 10) || 0;
      const newVotes = currentVotes + 1;
      card.dataset.votes = newVotes;
      countEl.textContent = newVotes + '표';
    }
  }

  // ========================================
  // Socket.io 연결
  // ========================================
  const socket = io();

  socket.on('vote-update', (data) => {
    console.log('Socket 데이터:', data);

    if (data && data.pollId === pollId) {
      if (data.poll && data.poll.options) {
        updateVoteDisplay(data.poll);
      }
    }
  });

  // ========================================
  // 투표 성공 후 모달 표시 함수
  // ========================================
  function showVoteSuccessModal() {
    const existingModal = document.getElementById('vote-success-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div class="modal fade" id="vote-success-modal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">\u2705 투표 완료!</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center py-4">
              <p class="mb-4">투표해 주셔서 감사합니다!</p>
              <div class="d-grid gap-2">
                <a href="/polls/${pollId}/result" class="btn btn-primary btn-lg">
                  \ud83d\udcca 상세 결과 보기
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

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('vote-success-modal'));
    modal.show();
  }

  // ========================================
  // 투표 정보 업데이트 (소켓 실시간 + 스티커)
  // ========================================
  function updateVoteDisplay(pollData) {
    if (!pollData || !pollData.options) {
      console.error('pollData가 유효하지 않음:', pollData);
      return;
    }

    const totalVotes = pollData.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);

    const totalVotesElement = document.getElementById('total-votes-count');
    if (totalVotesElement) {
      totalVotesElement.textContent = totalVotes;
    }

    // 각 옵션 업데이트 - 스티커 기반
    pollData.options.forEach(option => {
      const card = document.querySelector('[data-option-id="' + option._id + '"]');
      if (!card) return;

      const oldVotes = parseInt(card.dataset.votes, 10) || 0;
      const newVotes = option.votes || 0;

      // 새 투표가 있으면 스티커 추가
      if (newVotes > oldVotes) {
        const diff = newVotes - oldVotes;
        for (let i = 0; i < diff; i++) {
          // 약간의 시간차를 두고 스티커 추가
          setTimeout(() => {
            addStickerToOption(option._id);
          }, i * 150);
        }
      }

      // 투표 수 텍스트 동기화
      card.dataset.votes = newVotes;
      const countEl = card.querySelector('.sticker-count');
      if (countEl) {
        countEl.textContent = newVotes + '표';
      }
    });
  }

  // ========================================
  // 투표 실패 모달
  // ========================================
  function showVoteErrorModal(errorType, message) {
    const existingModal = document.getElementById('vote-error-modal');
    if (existingModal) {
      existingModal.remove();
    }

    let icon = '\u26a0\ufe0f';
    let title = '알림';
    let buttons = '';

    if (errorType === 'alreadyVoted') {
      icon = '\u2705';
      title = '이미 투표하셨습니다';
      buttons = `
        <a href="/polls/${pollId}/result" class="btn btn-primary btn-lg">
          \ud83d\udcca 결과 보기
        </a>
        <a href="/polls" class="btn btn-outline-secondary">
          목록으로
        </a>
      `;
    } else if (errorType === 'ended') {
      icon = '\u23f0';
      title = '투표가 종료되었습니다';
      buttons = `
        <a href="/polls/${pollId}/result" class="btn btn-primary btn-lg">
          \ud83d\udcca 결과 보기
        </a>
        <a href="/polls" class="btn btn-outline-secondary">
          목록으로
        </a>
      `;
    } else if (errorType === 'blocked') {
      icon = '\ud83d\udeab';
      title = '투표 불가';
      buttons = `
        <a href="/polls" class="btn btn-primary">
          목록으로 돌아가기
        </a>
      `;
    } else {
      icon = '\u274c';
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

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('vote-error-modal'));
    modal.show();
  }

  // ========================================
  // 옵션 클릭 이벤트 (싱글 클릭 = 선택)
  // ========================================
  optionCards.forEach(card => {
    card.addEventListener('click', () => {
      console.log('옵션 클릭됨');
      optionCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      const optionId = card.getAttribute('data-option-id');
      optionIdInput.value = optionId;

      const optionTextElement = card.querySelector('.card-title');
      if (optionTextElement && selectedOptionText) {
        selectedOptionText.textContent = optionTextElement.textContent;
        const alertElement = document.getElementById('selected-alert');
        if (alertElement) {
          alertElement.classList.remove('d-none');
        }
      }

      if (submitButton) {
        submitButton.disabled = false;
      }
    });

    // 더블 클릭으로 바로 투표
    card.addEventListener('dblclick', async () => {
      const optionId = card.getAttribute('data-option-id');
      if (!optionId) return;

      const csrfToken = document.getElementById('csrf-token').value;

      try {
        const response = await fetch('/polls/' + pollId + '/vote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': csrfToken
          },
          body: JSON.stringify({ optionId, _csrf: csrfToken })
        });

        const data = await response.json();

        if (data.success) {
          // 스티커 pop 애니메이션 추가
          addStickerToOption(optionId);
          // 0.6초 후 성공 모달 표시
          setTimeout(() => {
            showVoteSuccessModal();
          }, 600);
        } else {
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
  });

  // ========================================
  // 투표 제출 (버튼 클릭용)
  // ========================================
  voteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!optionIdInput.value) {
      alert('옵션을 선택해주세요');
      return;
    }

    const csrfToken = document.getElementById('csrf-token').value;

    try {
      const response = await fetch('/polls/' + pollId + '/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          optionId: optionIdInput.value,
          _csrf: csrfToken
        })
      });

      const data = await response.json();
      console.log('서버 응답:', data);

      if (data.success) {
        // 스티커 pop 애니메이션 추가
        addStickerToOption(optionIdInput.value);
        // 0.6초 후 성공 모달 표시
        setTimeout(() => {
          showVoteSuccessModal();
        }, 600);
      } else {
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

  // ========================================
  // 결과 로드
  // ========================================
  async function loadResults() {
    try {
      console.log('결과 로드 시작...');
      const response = await fetch('/polls/' + pollId + '/results');

      if (!response.ok) {
        throw new Error('HTTP error! Status: ' + response.status);
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

        if (resultsDiv) resultsDiv.innerHTML = resultsHTML;
        if (totalVotesP) totalVotesP.textContent = '총 ' + totalVotes + '명 참여';

        const existingResultButton = document.querySelector('.btn-result-detail');
        if (!existingResultButton && resultsContainer) {
          const resultButton = document.createElement('a');
          resultButton.href = '/polls/' + pollId + '/result';
          resultButton.className = 'btn btn-info me-2 btn-result-detail';
          resultButton.innerHTML = '\ud83d\udcca 상세 결과 보기 (원 그래프)';
          resultButton.target = '_blank';

          const buttonContainer = resultsContainer.querySelector('.mt-3');
          if (buttonContainer) {
            buttonContainer.insertBefore(resultButton, buttonContainer.firstChild);
          }
        }

        if (voteForm) voteForm.classList.add('d-none');
        if (resultsContainer) resultsContainer.classList.remove('d-none');
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
      if (resultsContainer) resultsContainer.classList.add('d-none');
      if (voteForm) voteForm.classList.remove('d-none');
    });
  }
});
