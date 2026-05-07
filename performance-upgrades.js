(() => {
  if (window.CHINA_POP_PERFORMANCE_UPGRADES) return;
  window.CHINA_POP_PERFORMANCE_UPGRADES = true;

  const isCompactScreen = window.matchMedia?.("(max-width: 760px)")?.matches;
  const previewFps = isCompactScreen ? 24 : 30;
  const activeFps = 30;
  let lastFrameAt = 0;

  function isReady() {
    return (
      typeof ctx !== "undefined" &&
      typeof templates !== "undefined" &&
      typeof currentTemplate !== "undefined" &&
      typeof drawCameraLayer === "function" &&
      typeof drawForeground === "function" &&
      typeof drawCountdown === "function"
    );
  }

  function isRecordingOrCountingDown() {
    const recording = Boolean(document.querySelector("#recordVideo")?.classList.contains("recording"));
    const countingDown = typeof countdownUntil !== "undefined" && countdownUntil;
    return recording || countingDown;
  }

  function renderOptimized(now = performance.now()) {
    animationId = requestAnimationFrame(renderOptimized);
    if (document.hidden || !isReady()) return;

    const targetFrameMs = 1000 / (isRecordingOrCountingDown() ? activeFps : previewFps);
    if (now - lastFrameAt < targetFrameMs) return;
    lastFrameAt = now;

    try {
      const t = now / 1000;
      const power = Number(fxIntensityInput.value) / 100;
      templates[currentTemplate].draw(ctx, W, H, t, power);
      drawCameraLayer(ctx);
      drawForeground(ctx, t);
      drawCountdown(ctx);
    } catch (error) {
      console.warn("Optimized render failed.", error);
    }
  }

  function installOptimizedRenderLoop() {
    try {
      if (typeof animationId !== "undefined" && animationId) cancelAnimationFrame(animationId);
      animationId = requestAnimationFrame(renderOptimized);
    } catch (error) {
      console.warn("Could not install optimized render loop.", error);
    }
  }

  function installOptimizedCameraStart() {
    if (
      typeof startButton === "undefined" ||
      typeof startCamera !== "function" ||
      typeof camera === "undefined"
    ) {
      return;
    }

    startButton.removeEventListener("click", startCamera);
    startButton.addEventListener("click", async () => {
      try {
        if (typeof stream !== "undefined" && stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        const video = isCompactScreen
          ? { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: "user" }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" };
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        camera.srcObject = stream;
        await camera.play();
        captureButton.disabled = false;
        recordButton.disabled = false;
        startButton.textContent = "Restart camera";
        if (typeof setStatus === "function") setStatus("Camera is live");
      } catch (error) {
        if (typeof setStatus === "function") setStatus("Camera blocked");
        alert("Camera access was blocked. Please allow camera permission for this site.");
      }
    });
  }

  installOptimizedRenderLoop();
  installOptimizedCameraStart();
})();
