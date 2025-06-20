// ✅ 감정 표현하기 모드: face_emotion.js

// let currentSessionTotalScore = 0;
let sessionTotalScoreDisplayElement = null;

let faceApiModelLoaded_Emotion = false;
let currentSessionTotalScore_Emotion = 0;
const emotionVideo = document.getElementById("emotion-video");
const emotionReferenceImg = document.getElementById("emotion-referenceImg");
const emotionCaptureBtn = document.getElementById("emotion-captureBtn");
const emotionScoreDisplay = document.getElementById("emotion-scoreDisplay");
const emotionRefEmotionDisplay = document.getElementById("emotion-refEmotionDisplay");
const emotionUserEmotionDisplay = document.getElementById("emotion-userEmotionDisplay");
const emotionGuideCanvas = document.getElementById("emotion-guideCanvas");
const sessionTotalDisplay = document.getElementById("session-total-score-display-emotion");
const baseImagePath = "/static/images/e_game/";
const emotionImageIndices = Array.from({ length: 50 }, (_, i) => i + 1);
let currentImageIndex = 0;


async function startVideoForEmotionMode(videoElement, callbackWhenReady) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = stream;
  videoElement.onloadedmetadata = () => {
    videoElement.play();
    callbackWhenReady();
  };
}

async function loadEmotionModels() {
  if (faceApiModelLoaded_Emotion) return true;
  await faceapi.nets.tinyFaceDetector.loadFromUri("/static/models");
  await faceapi.nets.faceLandmark68Net.loadFromUri("/static/models");
  await faceapi.nets.faceExpressionNet.loadFromUri("/static/models");
  faceApiModelLoaded_Emotion = true;
  return true;
}

async function startEmotionCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
  emotionVideo.srcObject = stream;
  await emotionVideo.play();
}

function drawGuideEllipse(canvas, video) {
  const ctx = canvas.getContext("2d");
  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width * 0.25, canvas.height * 0.38, 0, 0, 2 * Math.PI);
  ctx.stroke();
}

async function loadNextEmotionImage() {
  currentImageIndex = emotionImageIndices[Math.floor(Math.random() * emotionImageIndices.length)];
  const imageUrl = `${baseImagePath}e${currentImageIndex}.png`;
  emotionReferenceImg.src = imageUrl;
  emotionRefEmotionDisplay.innerText = "기준 감정: -";
  emotionUserEmotionDisplay.innerText = "당신 감정: -";
  emotionScoreDisplay.innerText = "이번 점수: -";
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

function getTopEmotion(exp) {
  return Object.entries(exp).sort((a, b) => b[1] - a[1])[0][0];
}

async function recognizeExpressions(img) {
  return await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
}

async function handleEmotionCapture() {

    if (!emotionReferenceImg.complete) {
    console.log("⏳ 기준 이미지 로딩 대기 중...");
    await new Promise(resolve => {
      emotionReferenceImg.onload = () => {
        console.log("✅ 기준 이미지 로딩 완료");
        resolve();
      };
    });
  }

  const refResult = await recognizeExpressions(emotionReferenceImg);
  const userResult = await recognizeExpressions(emotionVideo);

  console.log("📌 기준 감정:", refResult?.expressions);
  console.log("📌 사용자 감정:", userResult?.expressions);

  if (!refResult || !userResult) {
    emotionScoreDisplay.innerText = "이번 점수: 분석 실패";
    await loadNextEmotionImage(); 
    return;
    }

  const refVec = Object.values(refResult.expressions);
  const userVec = Object.values(userResult.expressions);
  const sim = cosineSimilarity(refVec, userVec);
  const score = Math.max(3, Math.min(10, Math.round(sim * 10)));

  emotionScoreDisplay.innerHTML = `이번 점수: <b>${score} / 10</b>`;
  currentSessionTotalScore_Emotion += score;
  sessionTotalDisplay.innerText = `총 점수: ${currentSessionTotalScore_Emotion}`;

  emotionUserEmotionDisplay.innerHTML = `당신 감정: <b>${getTopEmotion(userResult.expressions)}</b>`;
  emotionRefEmotionDisplay.innerHTML = `기준 감정: <b>${getTopEmotion(refResult.expressions)}</b>`;

  setTimeout(() => {
    loadNextEmotionImage();  
  }, 2000); 
}

export async function setupEmotionMode() {
  await loadEmotionModels();
  await startEmotionCamera();
  drawGuideEllipse(emotionGuideCanvas, emotionVideo);
  await loadNextEmotionImage();
  emotionCaptureBtn.addEventListener("click", handleEmotionCapture);
}

function waitForVideoReady(video, callback) {
  const check = () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      callback();
    } else {
      requestAnimationFrame(check);
    }
  };
  check();
}

//========================================================================================================//

import { loadUnityGame } from './unity_loader.js';

export async function init() {
  console.log("🧠 감정 표현 모드 init()");
  await loadUnityGame();

  const loaded = await loadEmotionModels();
  if (!loaded) return;

  const videoReady = await startVideoForEmotionMode();
  if (!videoReady) return;

  await loadNextEmotionImage();

  const captureBtn = document.getElementById('emotion-captureBtn');
  if (captureBtn) {
    captureBtn.removeEventListener('click', processEmotionExpression); // 중복 방지
    captureBtn.addEventListener('click', processEmotionExpression);
  }
}

export function closeFacialModal(mode = null, reason = "manual_close") {
  const modal = document.getElementById("facial-recognition-modal");
  if (modal) modal.style.display = "none";

  const score = currentSessionTotalScore_Emotion ?? 0;

  // ✅ Unity로 점수 또는 중단 메시지 전송
  if (window.unityGameInstance) {
    if (reason.startsWith("session_ended_by_unity")) {
      console.log("✅ Unity로 최종 점수 전송:", score);
      window.unityGameInstance.SendMessage('CostManagerObject', 'ReceiveFacialScore', score);
    } else {
      console.log("🛑 Unity에 운동 중단 알림 전송");
      window.unityGameInstance.SendMessage('CostManagerObject', 'FacialExerciseAborted', 0);
    }
  }

  // ✅ 캠 스트림 정리
  const video = (mode === 'emotion_expression')
    ? document.getElementById("emotion-video")
    : document.getElementById("follow-video");

  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }

  // ✅ 점수 초기화
  currentSessionTotalScore_Emotion = 0;
}

export async function ShowFacialRecognitionUI_JS(modeFromUnity, attempt = 1) {
  console.log(`[emotion] ShowFacialRecognitionUI_JS called. Mode: ${modeFromUnity}, Attempt: ${attempt}`);

  // 점수 초기화
  currentSessionTotalScore_Emotion = 0;
  sessionTotalScoreDisplayElement = document.getElementById('session-total-score-display-emotion');
  if (sessionTotalScoreDisplayElement) sessionTotalScoreDisplayElement.innerText = '총 점수: 0';

  const modal = document.getElementById('facial-recognition-modal');
  const emotionModeUI = document.getElementById('emotion-mode-ui');
  const guideCanvas = document.getElementById('emotion-guideCanvas');
  if (!modal || !emotionModeUI) return;

  modal.style.display = 'flex';
  emotionModeUI.style.display = 'block';
  if (guideCanvas) guideCanvas.style.display = 'block';

  // 모델 로딩
  const loaded = await loadEmotionModels();
  if (!loaded) return;

  // 캠 시작
  await startVideoForEmotionMode(emotionVideo, () => {
    console.log("🎥 감정모드 캠 시작됨");

    // 🎯 비디오가 제대로 그려진 뒤 캔버스 가이드라인 그리기
    waitForVideoReady(emotionVideo, () => {
      drawGuideEllipse(emotionGuideCanvas, emotionVideo);
    });
  });

  // 첫 표정 세팅
  await loadNextEmotionImage();

  const btn = document.getElementById('emotion-captureBtn');
  btn?.removeEventListener('click', handleEmotionCapture);
  btn?.addEventListener('click', handleEmotionCapture);
}

// ★★★★★[핵심] 페이지를 떠날 때 호출될 정리(cleanup) 함수 ★★★★★
export function cleanup() {
  console.log("🧹 face_emotion.js: cleanup 실행. 리소스를 정리합니다.");

  // 1. 카메라 스트림 중지 (가장 중요!)
  // closeFacialModal 함수에 이미 관련 로직이 있으므로 재활용하거나 직접 구현합니다.
  const video = document.getElementById("emotion-video");
  if (video && video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach(track => track.stop()); // 모든 트랙(비디오, 오디오)을 중지
    video.srcObject = null;
    console.log("✅ [Cleanup] 카메라 스트림이 중지되었습니다.");
  }

  // 2. Unity 인스턴스 종료
  // unity_loader.js에서 window.unityGameInstance 같은 전역 변수로 인스턴스를 관리한다고 가정합니다.
  if (window.unityGameInstance && typeof window.unityGameInstance.Quit === 'function') {
    window.unityGameInstance.Quit()
      .then(() => {
        console.log("✅ [Cleanup] Unity 인스턴스가 성공적으로 종료되었습니다.");
        window.unityGameInstance = null; // 인스턴스 참조 제거
      })
      .catch((err) => {
        console.error("❌ [Cleanup] Unity 인스턴스 종료 중 오류 발생:", err);
        window.unityGameInstance = null; // 오류가 발생해도 참조는 제거
      });
  }

  // 3. 이벤트 리스너 제거 (메모리 누수 방지)
  const captureBtn = document.getElementById('emotion-captureBtn');
  if (captureBtn) {
    // handleEmotionCapture 함수에 대한 참조가 필요하지만,
    // 간단하게는 버튼을 복제하여 리스너를 제거할 수 있습니다.
    const newBtn = captureBtn.cloneNode(true);
    captureBtn.parentNode.replaceChild(newBtn, captureBtn);
    console.log("✅ [Cleanup] 이벤트 리스너가 정리되었습니다.");
  }
  
  // 4. 전역에 할당된 함수 정리 (선택사항이지만 좋은 습관입니다)
  if (window.ShowFacialRecognitionUI_JS === ShowFacialRecognitionUI_JS) {
    window.ShowFacialRecognitionUI_JS = undefined;
  }
  if (window.closeFacialModal === closeFacialModal) {
    window.closeFacialModal = undefined;
  }
}


// ✅ 전역 등록

window.ShowFacialRecognitionUI_JS = ShowFacialRecognitionUI_JS;
window.closeFacialModal = closeFacialModal;