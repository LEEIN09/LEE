// /scripts/unity_loader.js

export function loadUnityGame() {
  
  const canvas = document.getElementById("unity-canvas");
  document.getElementById("unity-loading-bar").style.display = "block";
  const loaderUrl = "/static/unity_game_files/Build/towerdefense.loader.js";

  const config = {
    arguments: [],
    dataUrl: "/static/unity_game_files/Build/towerdefense.data",
    frameworkUrl: "/static/unity_game_files/Build/towerdefense.framework.js",
    codeUrl: "/static/unity_game_files/Build/towerdefense.wasm",
    productName: "towerdefense",
    showBanner: showUnityBanner,
    devicePixelRatio: 1,
  };


  const script = document.createElement("script");
  script.src = loaderUrl;
  script.onload = () => {
    createUnityInstance(canvas, config, (progress) => {      
      const bar = document.getElementById("unity-progress-bar-full");
      if (bar) bar.style.width = `${progress * 100}%`;
    }).then((unityInstance) => {      
      window.unityGameInstance = unityInstance;
      console.log("✅ Unity 인스턴스 생성 완료");
      const bar = document.getElementById("unity-loading-bar");
      if (bar) bar.style.display = "none";
      const fsBtn = document.getElementById("unity-fullscreen-button");
      if (fsBtn) fsBtn.onclick = () => unityInstance.SetFullscreen(1);
    }).catch((err) => {
      console.error("❌ Unity 로딩 실패:", err);
      alert("Unity 게임을 불러오는 데 실패했습니다.");
    });
  };

  document.body.appendChild(script);
}

function showUnityBanner(msg, type) {
  const banner = document.getElementById("unity-warning");
  if (!banner) return;

  const div = document.createElement("div");
  div.innerHTML = msg;
  div.style = type === "error"
    ? "background: red; padding: 10px;"
    : "background: yellow; padding: 10px;";

  banner.appendChild(div);
  setTimeout(() => banner.removeChild(div), 5000);
}
