(() => {
  if (window.CHINA_POP_PERFORMANCE_UPGRADES) return;
  window.CHINA_POP_PERFORMANCE_UPGRADES = true;

  const isCompactScreen = window.matchMedia?.("(max-width: 760px)")?.matches;
  const previewFps = isCompactScreen ? 24 : 30;
  const activeFps = 30;
  let lastFrameAt = 0;
  let standaloneMicStream = null;
  let replayingRecordClick = false;

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

  function getAudioModeValue() {
    return document.querySelector("#audioMode")?.value || "mic";
  }

  function hasLiveMicTrack() {
    const track = camera?.srcObject?.getAudioTracks?.()[0] || null;
    return Boolean(track && track.readyState === "live" && track.enabled !== false);
  }

  function stopStandaloneMic() {
    if (!standaloneMicStream) return;
    standaloneMicStream.getTracks().forEach((track) => track.stop());
    standaloneMicStream = null;
    if (camera?.srcObject && !camera.srcObject.getVideoTracks?.().length) {
      camera.srcObject = null;
    }
  }

  function scheduleStandaloneMicCleanup() {
    const countdownSeconds = document.querySelector("#countdownToggle")?.checked ? 3 : 0;
    const recordSeconds = Number(document.querySelector("#recordLength")?.value || 5);
    window.setTimeout(() => {
      if (!document.querySelector("#recordVideo")?.classList.contains("recording")) {
        stopStandaloneMic();
      }
    }, (countdownSeconds + recordSeconds + 2) * 1000);
  }

  async function openStandaloneMic() {
    stopStandaloneMic();
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      if (typeof setStatus === "function") setStatus("Opening microphone");
      standaloneMicStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const track = standaloneMicStream.getAudioTracks()[0];
      if (!track || track.readyState !== "live") {
        stopStandaloneMic();
        return false;
      }
      camera.srcObject = standaloneMicStream;
      if (typeof setStatus === "function") setStatus("Mic audio ready");
      return true;
    } catch (error) {
      stopStandaloneMic();
      if (typeof setStatus === "function") setStatus("Mic blocked");
      console.warn("Could not open microphone for album photo recording.", error);
      return false;
    }
  }

  function installAlbumPhotoMicBridge() {
    const button = document.querySelector("#recordVideo");
    if (!button || button.dataset.albumMicBridge === "1") return;
    button.dataset.albumMicBridge = "1";

    button.addEventListener("click", async (event) => {
      if (replayingRecordClick) {
        replayingRecordClick = false;
        scheduleStandaloneMicCleanup();
        return;
      }

      const mode = getAudioModeValue();
      const needsMic = mode === "mic" || mode === "both";
      if (!needsMic || hasLiveMicTrack()) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      await openStandaloneMic();

      replayingRecordClick = true;
      button.click();
    }, true);
  }

  function installVisibleSoundMode() {
    const select = document.querySelector("#audioMode");
    const row = document.querySelector(".action-row");
    if (!select || !row || row.querySelector(".sound-mode-control")) return;

    const oldLabel = select.closest("label");
    const label = document.createElement("label");
    label.className = "sound-mode-control";
    label.innerHTML = "<span>Sound / 声音</span>";
    label.append(select);
    row.insertBefore(label, document.querySelector("#capturePhoto"));
    if (oldLabel && oldLabel !== label && !oldLabel.querySelector("input, select, textarea")) {
      oldLabel.remove();
    }

    const style = document.createElement("style");
    style.textContent = `
      .sound-mode-control {
        display: inline-grid;
        grid-template-columns: auto minmax(140px, 1fr);
        align-items: center;
        min-height: 42px;
        gap: 9px;
        padding: 7px 10px;
        border: 1px solid rgba(242, 196, 90, 0.58);
        border-radius: 8px;
        color: var(--ink);
        background: rgba(39, 31, 17, 0.72);
      }
      .sound-mode-control span {
        color: var(--accent);
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .sound-mode-control select {
        min-width: 150px;
        height: 30px;
        padding: 0 28px 0 10px;
      }
      @media (max-width: 760px) {
        .action-row .sound-mode-control {
          grid-column: 1 / -1;
          width: 100%;
          min-height: 40px;
          grid-template-columns: auto minmax(0, 1fr);
        }
        .action-row .sound-mode-control select {
          width: 100%;
          min-width: 0;
        }
      }
    `;
    document.head.append(style);
  }

  installOptimizedRenderLoop();
  installOptimizedCameraStart();
  installVisibleSoundMode();
  installAlbumPhotoMicBridge();
})();
