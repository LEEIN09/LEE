// /scripts/game_mode.js

export function init() {
  console.log("✅ game_mode.js init() 실행됨");

  const followBtn = document.getElementById("follow-mode-btn");
  const emotionBtn = document.getElementById("emotion-mode-btn");

  if (followBtn) {
    followBtn.onclick = () => {
      console.log("👉 follow-mode-btn 클릭됨");
      loadPage('face_follow');
    };
  }

  if (emotionBtn) {
    emotionBtn.onclick = () => {
      console.log("👉 emotion-mode-btn 클릭됨");
      loadPage('face_emotion');
    };
  }
}
