// complex_fit.js (재진입 문제 해결된 최종본)

let stream = null;
let video;
let canvas;
let ctx;
let referenceImg;
let checkMark;
let submitBtn;
let normalModeBtn;
let auModeBtn;
let modeInfoDisplay;
let setInfoWrapper;
let displayCurrentRound;
let displayTotalRounds;
let displayCurrentSet;
let displayTotalSets;
let refMessage;

let currentMode = 'normal';
let teacher = '';

const NORMAL_TOTAL_ROUNDS = 10;
let currentNormalRound = 0;
let capturedImages = [];
let neutralImage = null;

const AU_TOTAL_ROUNDS_PER_SET = 4;
const AU_TOTAL_SETS = 2;
const AU_OVERALL_TOTAL_ROUNDS = AU_TOTAL_ROUNDS_PER_SET * AU_TOTAL_SETS;
let currentSet_AU = 1;
let currentRoundInSet_AU = 1;
let totalCompletedRounds_AU = 0;

let drawEllipseIntervalId = null; 
// let isInitialized = false; // 이 플래그는 더 이상 필요 없으므로 제거하거나 주석 처리합니다.

function delayedNav(url) {
    document.body.classList.remove('loaded');
    document.body.classList.add('fade-out');
    setTimeout(() => {
        window.location.href = url;
    }, 400);
}

function updateDisplay() {
  if (!modeInfoDisplay || !referenceImg || !setInfoWrapper || !displayCurrentRound || !displayTotalRounds || !displayCurrentSet || !displayTotalSets || !refMessage) {
    console.warn("updateDisplay: DOM 요소 일부가 아직 준비되지 않았습니다.");
    return;
  }

  if (currentMode === 'au') {
    modeInfoDisplay.textContent = '[AU 분석 모드]  ';
    setInfoWrapper.style.display = 'inline';
    const imageIndex = ((currentSet_AU - 1) * AU_TOTAL_ROUNDS_PER_SET) + currentRoundInSet_AU;
    if (teacher && referenceImg) {
        referenceImg.src = `/static/images/teachers/${teacher}/${teacher}${imageIndex}.png`;
        referenceImg.style.display = "block";
    }
    refMessage.style.display = "none";
    displayCurrentRound.textContent = totalCompletedRounds_AU + currentRoundInSet_AU;
    displayTotalRounds.textContent = AU_OVERALL_TOTAL_ROUNDS;
    displayCurrentSet.textContent = currentSet_AU;
    displayTotalSets.textContent = AU_TOTAL_SETS;
  } else {
    modeInfoDisplay.textContent = '[일반 모드]  ';
    setInfoWrapper.style.display = 'none';
    if (currentNormalRound === 0) {
      if (referenceImg) referenceImg.style.display = "none";
      refMessage.style.display = "block";
      displayCurrentRound.textContent = "무표정";
    } else {
      if (teacher && referenceImg) {
        referenceImg.src = `/static/images/teachers/${teacher}/${teacher}${currentNormalRound}.png`;
        referenceImg.style.display = "block";
      }
      refMessage.style.display = "none";
      displayCurrentRound.textContent = currentNormalRound;
    }
    displayTotalRounds.textContent = NORMAL_TOTAL_ROUNDS;
  }

  if (!teacher && currentMode === 'au') {
    alert("AU 분석 모드는 선생님 정보가 필요합니다. 선생님 선택 페이지로 이동합니다.");
    if (typeof window.loadPage === 'function') {
        window.loadPage('complex');
    } else {
        window.location.href = '/pages/complex.html';
    }
  }
}

function initializeMode(mode) {
  console.log(`초기화 시도 모드: ${mode}`);
  currentMode = mode;
  // ▼▼▼▼▼ [수정된 부분] 모드가 바뀌면 이전 이미지 데이터를 항상 초기화 ▼▼▼▼▼
  capturedImages = [];
  neutralImage = null;
  sessionStorage.removeItem('capturedImages'); 
  sessionStorage.removeItem('neutralImage');
  // ▲▲▲▲▲ [수정 완료] ▲▲▲▲▲

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '사진 제출';
    submitBtn.style.backgroundColor = '#4CAF50';
    submitBtn.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.1)';
    submitBtn.style.color = 'white';
  }

  if (currentMode === 'au') {
    if (!teacher) {
      alert("AU 분석 모드를 시작하려면 선생님을 선택해야 합니다.");
    }
    const urlParams = new URLSearchParams(window.location.search);
    currentSet_AU = parseInt(urlParams.get('current_set') || '1');
    currentRoundInSet_AU = 1;
    totalCompletedRounds_AU = (currentSet_AU - 1) * AU_TOTAL_ROUNDS_PER_SET;
    console.log(`AU 모드 시작: Set ${currentSet_AU}, Round in set ${currentRoundInSet_AU}`);
  } else {
    currentNormalRound = 0;
    capturedImages = [];
    neutralImage = null;
    console.log('일반 복합운동 모드 시작');
  }
  updateDisplay();
}

export function init() {
  // ▼▼▼▼▼ [수정된 부분] ▼▼▼▼▼
  // 페이지에 재진입했을 때 기능이 다시 초기화되도록 중복 실행 방지 코드를 제거합니다.
  /*
  if (isInitialized) {
    console.warn("complex_fit.js: init() 함수가 이미 호출되었습니다. 중복 실행을 방지합니다.");
    return;
  }
  */
  // ▲▲▲▲▲ [수정 완료] ▲▲▲▲▲

  console.log("✅ complex_fit.js init() 실제 실행 시작");

  video = document.getElementById('video');
  canvas = document.getElementById('guide-canvas');
  referenceImg = document.getElementById('reference-img');
  checkMark = document.getElementById('check-mark');
  submitBtn = document.getElementById('submit-btn');
  normalModeBtn = document.getElementById('normal-mode-btn');
  auModeBtn = document.getElementById('au-mode-btn');
  modeInfoDisplay = document.getElementById('mode-info');
  setInfoWrapper = document.getElementById('set-info-wrapper');
  displayCurrentRound = document.getElementById('display-current-round');
  displayTotalRounds = document.getElementById('display-total-rounds');
  displayCurrentSet = document.getElementById('display-current-set');
  displayTotalSets = document.getElementById('display-total-sets');
  refMessage = document.getElementById('ref-message');

  if (!video || !canvas || !referenceImg || !submitBtn || !normalModeBtn || !auModeBtn || !modeInfoDisplay || !setInfoWrapper || !displayCurrentRound || !displayTotalRounds || !displayCurrentSet || !displayTotalSets || !refMessage) {
    console.error("init: 필수 DOM 요소 중 일부를 찾을 수 없습니다. HTML 파일의 ID를 확인해주세요. 초기화를 중단합니다.");
    return;
  }

  ctx = canvas.getContext('2d');
  
  const urlParams = new URLSearchParams(window.location.search);
  const initialModeFromUrl = urlParams.get('mode');
  const initialTeacherFromUrl = urlParams.get('teacher_id') || urlParams.get('teacher');

  if (initialTeacherFromUrl) {
      teacher = initialTeacherFromUrl;
      sessionStorage.setItem('selectedTeacher', teacher); 
  } else {
      teacher = sessionStorage.getItem('selectedTeacher');
  }

  if (!teacher) {
    alert("선생님 정보가 없습니다. 선생님 선택 페이지로 이동합니다.");
    if (typeof window.loadPage === 'function') {
        window.loadPage('complex');
    } else {
        window.location.href = '/pages/complex.html';
    }
    return;
  }

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
      stream = s;
      if (video) video.srcObject = stream;
    }).catch(err => {
      console.error("❌ 캠 접근 실패:", err);
      alert("카메라 권한을 허용해주세요. 설정에서 카메라 접근 권한을 확인해주세요.");
    });
  } else {
    alert("이 브라우저에서는 카메라 기능을 지원하지 않습니다.");
  }

  function drawEllipse() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width * 0.35, canvas.height * 0.4, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  
  // 만약 이전에 실행되던 인터벌이 있다면 해제
  if (drawEllipseIntervalId) clearInterval(drawEllipseIntervalId);
  drawEllipseIntervalId = setInterval(drawEllipse, 100);

  if (normalModeBtn) {
    normalModeBtn.onclick = () => { initializeMode('normal'); };
  }
  if (auModeBtn) {
    auModeBtn.onclick = () => { initializeMode('au'); };
  }

  if (initialModeFromUrl === 'au' && teacher) {
    initializeMode('au');
  } else {
    initializeMode('normal');
  }

  if (submitBtn) {
    submitBtn.onclick = async () => {
      if (video && (!video.srcObject || video.readyState < video.HAVE_ENOUGH_DATA)) {
          alert('웹캠 영상이 아직 준비되지 않았습니다. 잠시 기다려주세요.');
          return;
      }
      const dataUrl = captureCurrentFrame();
      submitBtn.disabled = true;

      if (currentMode === 'normal') {
        if (currentNormalRound === 0) {
          neutralImage = dataUrl;
          currentNormalRound++;
          updateDisplay();
          submitBtn.disabled = false;
          return;
        }
        capturedImages.push(dataUrl);
        if (checkMark) {
          checkMark.style.display = 'block';
          setTimeout(() => { if(checkMark) checkMark.style.display = 'none'; }, 1000);
        }
        currentNormalRound++;
        if (currentNormalRound > NORMAL_TOTAL_ROUNDS) {
          submitBtn.textContent = '운동 완료';
          submitBtn.style.backgroundColor = '#8e24aa';
          sessionStorage.setItem('neutralImage', neutralImage);
          sessionStorage.setItem('capturedImages', JSON.stringify(capturedImages));
          sessionStorage.setItem('selectedTeacher', teacher);
          sessionStorage.setItem('mode', 'normal');
        if (typeof window.loadPage === 'function') {
            loadPage('normal_feedback');
        } else {
            // loadPage 함수를 찾을 수 없을 때의 예외 처리
            window.location.href = '/'; // 홈으로 이동
            alert('페이지를 로드할 수 없습니다. 홈으로 이동합니다.');
  }
          return;
        } else {
          updateDisplay();
          submitBtn.disabled = false;
        }
      } else if (currentMode === 'au') {
        if (checkMark) {
          checkMark.style.display = 'block';
          setTimeout(() => { if(checkMark) checkMark.style.display = 'none'; }, 800);
        }
        const fetchRes = await fetch(dataUrl);
        const blob = await fetchRes.blob();
        if (!blob) {
          alert('AU 모드: 이미지 데이터 변환에 실패했습니다.');
          submitBtn.disabled = false;
          return;
        }
        const formData = new FormData();
        const currentOverallRound_AU = totalCompletedRounds_AU + currentRoundInSet_AU;
        formData.append('image_data', blob, `round_${currentOverallRound_AU}_${teacher}.jpg`);
        formData.append('round_number', currentOverallRound_AU);
        formData.append('teacher_id', teacher);

        try {
          const response = await fetch('/submit_au_data_with_image', { method: 'POST', body: formData });
          const result = await response.json();
          if (response.ok) {
            console.log('AU Firebase 저장 성공:', result.message);
            currentRoundInSet_AU++;
            if (currentRoundInSet_AU > AU_TOTAL_ROUNDS_PER_SET) {
              currentSet_AU++;
              currentRoundInSet_AU = 1;
              if (currentSet_AU > AU_TOTAL_SETS) {
                submitBtn.textContent = 'AU 분석 완료';
                submitBtn.style.backgroundColor = '#8e24aa';
                sessionStorage.setItem('selectedTeacher', teacher);
                sessionStorage.setItem('mode', 'au');
                delayedNav(`/pages/au_feedback.html?teacher_id=${teacher}&mode=au`);
                return;
              } else {
                submitBtn.textContent = '다음 세트 안내';
                submitBtn.style.backgroundColor = '#007bff';
                const nextPageUrl = `/pages/next_set_guidance.html?teacher_id=${teacher}&current_set=${currentSet_AU}`;
                delayedNav(nextPageUrl);
                return; 
              }
            } else {
              updateDisplay();
              submitBtn.disabled = false;
            }
          } else {
            alert(`AU 데이터 저장 실패: ${result.message || '알 수 없는 오류'}`);
            submitBtn.disabled = false;
          }
        } catch (error) {
          alert(`AU 데이터 전송 중 오류 발생: ${error.message}`);
          submitBtn.disabled = false;
        }
      }
    };
  } else {
    console.error("submitBtn 요소를 찾을 수 없습니다.");
  }

  if (document.body) document.body.classList.add('loaded');
  // isInitialized = true; // 이 플래그는 더 이상 필요 없으므로 제거하거나 주석 처리합니다.
  console.log("✅ complex_fit.js init() 실제 실행 완료");
}

function captureCurrentFrame() {
  const tempCanvas = document.createElement('canvas');
  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
    const aspectRatio = video.videoHeight / video.videoWidth;
    tempCanvas.width = 160;
    tempCanvas.height = 160 * aspectRatio;
  } else {
    tempCanvas.width = 160;
    tempCanvas.height = 120;
  }
  const tempCtx = tempCanvas.getContext('2d');
  if (video) tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
  return tempCanvas.toDataURL('image/png');
}

export function cleanup() {
  console.log("🧹 complex_fit.js cleanup() 호출됨");
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    console.log("📷 캠 스트림 정리 완료 (stream 전역 변수)");
  }
  const videoElement = document.getElementById('video');
  if (videoElement && videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
    console.log("📷 캠 스트림 정리 완료 (video 요소를 통해)");
  }

  if (drawEllipseIntervalId) {
    clearInterval(drawEllipseIntervalId);
    drawEllipseIntervalId = null;
    console.log("Ellipse drawing interval이 clear 되었습니다.");
  }
  
  video = null;
  canvas = null;
  ctx = null;
  referenceImg = null;
  checkMark = null;
  submitBtn = null;
  normalModeBtn = null;
  auModeBtn = null;
  modeInfoDisplay = null;
  setInfoWrapper = null;
  displayCurrentRound = null;
  displayTotalRounds = null;
  displayCurrentSet = null;
  displayTotalSets = null;
  refMessage = null;

  // isInitialized = false; // 이 플래그는 더 이상 필요 없으므로 제거하거나 주석 처리합니다.
  console.log("🧹 complex_fit.js cleanup() 완료");
}