// face_follow.js - 표정 따라하기 모드 JS (MediaPipe 기반)

import { loadUnityGame } from "./unity_loader.js";

let currentSessionTotalScore = 0;
let currentImageIndex = 1;
const totalImages = 50;
const baseImagePath = "/static/images/f_game/";

let faceMesh = null; // MediaPipe 인스턴스를 전역 변수로 관리하여 재사용
let teacherA = [], teacherB = [], userA = [], userB = [];

export function init() {
  loadUnityGame();
  setTimeout(() => setupFollowMode(), 300);
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

async function startFollowCamera(videoElement, callbackWhenReady) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = stream;
  videoElement.onloadedmetadata = () => {
    videoElement.play();
    callbackWhenReady?.();
  };
}

// [수정됨] 이미지 로딩 실패 시 에러를 발생시키도록 수정
function waitForImageLoad(img) {
  return new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
    } else {
      img.onload = () => resolve();
      img.onerror = () => {
        console.error(`이미지 로드 실패: ${img.src}`);
        reject(new Error(`이미지를 불러올 수 없습니다: ${img.src}`));
      };
    }
  });
}

// [수정됨] 랜드마크 추출 로직을 하나로 통합하여 비동기 문제를 해결
async function detectLandmarksFromSource(source) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // 소스가 이미지인지 비디오인지에 따라 캔버스 크기 설정
  if (source instanceof HTMLImageElement) {
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
  } else if (source instanceof HTMLVideoElement) {
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
  }

  ctx.drawImage(source, 0, 0);

  return new Promise((resolve) => {
    // 일회성 콜백을 사용하여 각 요청이 독립적으로 결과를 받도록 함
    const onResultsCallback = (results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0].map(pt => [pt.x, pt.y]);
        resolve(landmarks);
      } else {
        console.warn("랜드마크를 감지하지 못했습니다.", source);
        resolve([]); // 감지 실패 시 빈 배열 반환
      }
    };
    faceMesh.onResults(onResultsCallback);
    faceMesh.send({ image: canvas });
  });
}

// [수정됨] 새로운 랜드마크 추출 함수 사용 및 오류 처리 강화
export async function setupFollowMode() {
  console.log("[FollowMode] Initializing follow mode...");

  const imageA = document.getElementById("follow-imageA");
  const imageB = document.getElementById("follow-imageB");
  const video = document.getElementById("follow-video");
  const canvas = document.getElementById("follow-guideCanvas");
  const captureABtn = document.getElementById("follow-captureA_Btn");
  const captureBBtn = document.getElementById("follow-captureB_Btn");

  if (!imageA || !imageB || !video || !canvas || !captureABtn || !captureBBtn) {
    console.error("[FollowMode] 필수 요소가 누락되었습니다.");
    return;
  }

  try {
    // MediaPipe 인스턴스가 없으면 새로 생성 (최초 1회만 실행)
    if (!faceMesh) {
      faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      await faceMesh.initialize();
    }

    await setReferenceImages();
    await waitForImageLoad(imageA);
    await waitForImageLoad(imageB);

    // 수정된 함수를 사용하여 순차적으로 랜드마크 추출
    teacherA = await detectLandmarksFromSource(imageA);
    teacherB = await detectLandmarksFromSource(imageB);

    // 참조 이미지에서 랜드마크 추출 실패 시 더 이상 진행하지 않음
    if (teacherA.length === 0 || teacherB.length === 0) {
      console.error("참조 이미지에서 랜드마크를 추출할 수 없어, 표정 따라하기를 시작할 수 없습니다.");
      // 여기에 사용자에게 오류를 알리는 UI 로직을 추가할 수 있습니다.
      return;
    }

    captureABtn.disabled = false;
    captureBBtn.disabled = true;

    captureABtn.onclick = async () => {
      userA = await detectLandmarksFromSource(video);
      if (userA.length === 0) {
          alert("얼굴을 인식하지 못했습니다. 화면 중앙에 얼굴을 맞춰주세요.");
          return;
      }
      captureABtn.disabled = true;
      captureBBtn.disabled = false;
    };

    captureBBtn.onclick = async () => {
      userB = await detectLandmarksFromSource(video);
       if (userB.length === 0) {
          alert("얼굴을 인식하지 못했습니다. 화면 중앙에 얼굴을 맞춰주세요.");
          return;
      }
      captureBBtn.disabled = true;
      calculateScore();
    };

  } catch (error) {
    console.error("[FollowMode] 초기화 중 심각한 오류 발생:", error);
  }
}

function waitForVideoReady(video, callback) {
  const check = () => {
    if (video.readyState >= 2) { // HAVE_CURRENT_DATA
      callback();
    } else {
      setTimeout(check, 100);
    }
  };
  check();
}

async function setReferenceImages() {
  const imageA = document.getElementById("follow-imageA");
  const imageB = document.getElementById("follow-imageB");
  imageA.src = `${baseImagePath}${currentImageIndex}.png`;
  imageB.src = `${baseImagePath}${currentImageIndex + 1}.png`;
}

function calculateScore() {
  const normTeacherA = normalizeLandmarksByMidpoint(teacherA);
  const normTeacherB = normalizeLandmarksByMidpoint(teacherB);
  const normUserA = normalizeLandmarksByMidpoint(userA);
  const normUserB = normalizeLandmarksByMidpoint(userB);

  const landmarkPairs = {
    "입꼬리(우)": [291, 446], "입꼬리(좌)": [61, 226], "입벌림": [1, 152],
    "눈썹(우)": [334, 386], "눈썹(좌)": [105, 159], "눈감기(우)": [386, 374],
    "눈감기(좌)": [159, 145], "찡그리기(우)": [285, 437], "찡그리기(좌)": [217, 55],
    "입술오므리기": [61, 291],
  };

  const epsilon = 0.001;
  let totalScore = 0;
  let count = 0;

  for (const [name, [i1, i2]] of Object.entries(landmarkPairs)) {
      if (
        !normTeacherA?.[i1] || !normTeacherA?.[i2] ||
        !normTeacherB?.[i1] || !normTeacherB?.[i2] ||
        !normUserA?.[i1] || !normUserA?.[i2] ||
        !normUserB?.[i1] || !normUserB?.[i2]
      ) {
        console.warn(`[${name}] 랜드마크 누락 - 점수 계산에서 건너뜀`);
        continue;
      }
    const teacherDist = calcDistance(normTeacherB[i1], normTeacherB[i2]) - calcDistance(normTeacherA[i1], normTeacherA[i2]);
    const userDist = calcDistance(normUserB[i1], normUserB[i2]) - calcDistance(normUserA[i1], normUserA[i2]);

    const diff = Math.abs(teacherDist - userDist);
    const sim = 1 - diff / ((Math.abs(teacherDist) + epsilon) * 3);
    const score = Math.max(0, Math.min(1, sim)) * 10;

    totalScore += score;
    count++;
  }

  const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
  currentSessionTotalScore += avgScore;

  const scoreDisplay = document.getElementById("follow-scoreDisplay");
  const totalScoreDisplay = document.getElementById("session-total-score-display-follow");
  if (scoreDisplay) scoreDisplay.innerHTML = `이번 점수: <b>${avgScore} / 10</b>`;
  if (totalScoreDisplay) totalScoreDisplay.innerText = `총 점수: ${currentSessionTotalScore}`;

  currentImageIndex += 2;
  if (currentImageIndex > totalImages) {
      console.log("모든 이미지를 완료했습니다. 세션을 종료합니다.");
      // 여기에 세션 종료 관련 UI 로직 추가
      return;
  }
  setTimeout(() => setupFollowMode(), 1000);
}

function calcDistance(pt1, pt2) {
  return Math.hypot(pt1[0] - pt2[0], pt1[1] - pt2[1]);
}

function normalizeLandmarksByMidpoint(landmarks) {
  if (!landmarks || landmarks.length < 200) return landmarks;
  const left = landmarks[168];
  const right = landmarks[5];
  const baseDist = calcDistance(left, right) || 1;
  return landmarks.map(([x, y]) => [x / baseDist, y / baseDist]);
}

// (기존의 extractLandmarks와 captureAndExtract 함수는 삭제됨)

export async function ShowFacialRecognitionUI_JS(modeFromUnity, attempt = 1) {
  console.log(`[follow] ShowFacialRecognitionUI_JS called. Mode: ${modeFromUnity}, Attempt: ${attempt}`);

  currentSessionTotalScore = 0;
  let sessionTotalScoreDisplayElement = document.getElementById('session-total-score-display-follow');
  if (sessionTotalScoreDisplayElement) sessionTotalScoreDisplayElement.innerText = '총 점수: 0';

  const modal = document.getElementById('facial-recognition-modal');
  const followVideo = document.getElementById("follow-video");
  const followGuideCanvas = document.getElementById("follow-guideCanvas");
  const followModeUI = document.getElementById('follow-mode-ui');
  const guideCanvas = document.getElementById('follow-guideCanvas');
  if (!modal || !followModeUI) return;

  modal.style.display = 'flex';
  followModeUI.style.display = 'block';
  if (guideCanvas) guideCanvas.style.display = 'block';

  await startFollowCamera(followVideo, () => {
    console.log("팔로우 모드 캠 시작됨");
    waitForVideoReady(followVideo, () => {
      drawGuideEllipse(followGuideCanvas, followVideo);
    });
  });

  // 표정 따라하기 모드 초기화
  setupFollowMode();
}

export function closeFacialModal(mode = null, reason = "manual_close") {
  const modal = document.getElementById("facial-recognition-modal");
  if (modal) modal.style.display = "none";

  const score = currentSessionTotalScore ?? 0;

  if (window.unityGameInstance) {
    if (reason.startsWith("session_ended_by_unity")) {
      console.log("✅ Unity로 최종 점수 전송:", score);
      window.unityGameInstance.SendMessage('CostManagerObject', 'ReceiveFacialScore', score);
    } else {
      console.log("🛑 Unity에 운동 중단 알림 전송");
      window.unityGameInstance.SendMessage('CostManagerObject', 'FacialExerciseAborted', 0);
    }
  }

  const video = document.getElementById("follow-video");
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }

  currentSessionTotalScore = 0;
}

// /scripts/face_follow.js 파일의 맨 아래에 이 코드를 추가하세요.

// ... 기존의 init, setupFollowMode 등 모든 함수는 그대로 둡니다 ...

// ★★★★★[핵심] 페이지를 떠날 때 호출될 정리(cleanup) 함수 ★★★★★
export function cleanup() {
  console.log("🧹 face_follow.js: cleanup 실행. 리소스를 정리합니다.");

  // 1. 카메라 스트림 중지
  const video = document.getElementById("follow-video");
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    console.log("✅ [Cleanup] 카메라 스트림이 중지되었습니다.");
  }

  // 2. Unity 인스턴스 종료
  if (window.unityGameInstance && typeof window.unityGameInstance.Quit === 'function') {
    window.unityGameInstance.Quit()
      .then(() => {
        console.log("✅ [Cleanup] Unity 인스턴스가 성공적으로 종료되었습니다.");
        window.unityGameInstance = null;
      })
      .catch((err) => {
        console.error("❌ [Cleanup] Unity 인스턴스 종료 중 오류 발생:", err);
        window.unityGameInstance = null;
      });
  }

  // 3. MediaPipe 인스턴스 종료 (메모리 누수 방지에 매우 중요!)
  if (faceMesh) {
    faceMesh.close(); // MediaPipe 인스턴스의 공식 종료 메소드
    faceMesh = null;
    console.log("✅ [Cleanup] MediaPipe FaceMesh 인스턴스가 종료되었습니다.");
  }

  // 4. 이벤트 리스너 제거
  const captureABtn = document.getElementById("follow-captureA_Btn");
  if (captureABtn) {
    const newBtn = captureABtn.cloneNode(true);
    captureABtn.parentNode.replaceChild(newBtn, captureABtn);
  }
  const captureBBtn = document.getElementById("follow-captureB_Btn");
    if (captureBBtn) {
    const newBtn = captureBBtn.cloneNode(true);
    captureBBtn.parentNode.replaceChild(newBtn, captureBBtn);
  }
  console.log("✅ [Cleanup] 이벤트 리스너가 정리되었습니다.");

  // 5. 전역에 할당된 함수 정리
  if (window.ShowFacialRecognitionUI_JS === ShowFacialRecognitionUI_JS) {
    window.ShowFacialRecognitionUI_JS = undefined;
  }
  if (window.closeFacialModal === closeFacialModal) {
    window.closeFacialModal = undefined;
  }
}

// 마찬가지로 기존 export 구문에 cleanup을 추가하거나, `export function cleanup()`으로 둡니다.

// Unity에서 호출 가능하도록 전역 스코프에 함수 등록
window.ShowFacialRecognitionUI_JS = ShowFacialRecognitionUI_JS;
window.closeFacialModal = closeFacialModal;