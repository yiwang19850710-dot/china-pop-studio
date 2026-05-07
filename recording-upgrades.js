(() => {
  const stageEl = document.querySelector("#stage");
  const cameraEl = document.querySelector("#camera");
  const captureBtn = document.querySelector("#capturePhoto");
  const recordBtn = document.querySelector("#recordVideo");
  const downloadEl = document.querySelector("#downloadLink");
  const outputPanelEl = document.querySelector("#outputPanel");
  const photoPreviewEl = document.querySelector("#photoPreview");
  const videoPreviewEl = document.querySelector("#videoPreview");
  const recordLengthEl = document.querySelector("#recordLength");
  const statusEl = document.querySelector("#status");
  let indicatorEl = document.querySelector("#recordingIndicator");
  let indicatorTimeEl = document.querySelector("#recordingCountdown");
  let activeRecorder = null;
  let activeChunks = [];
  let recordStopTimer = null;
  let recordTickTimer = null;
  let recordingEndsAt = 0;

  if (!stageEl || !captureBtn || !recordBtn) return;

  function setAppStatus(message) {
    if (typeof window.setStatus === "function") {
      window.setStatus(message);
      return;
    }
    if (statusEl) statusEl.textContent = message;
  }

  function ensureIndicator() {
    if (indicatorEl) return;
    const wrap = stageEl.closest(".stage-wrap");
    if (!wrap) return;
    indicatorEl = document.createElement("div");
    indicatorEl.id = "recordingIndicator";
    indicatorEl.className = "recording-indicator";
    indicatorEl.hidden = true;
    indicatorEl.innerHTML = "<span></span><b>Recording</b><em id=\"recordingCountdown\">0s</em>";
    wrap.append(indicatorEl);
    indicatorTimeEl = indicatorEl.querySelector("#recordingCountdown");
  }

  function waitForAppCountdown() {
    if (typeof window.waitForCountdown === "function") return window.waitForCountdown();
    return Promise.resolve();
  }

  function clickDownloadLink() {
    if (!downloadEl?.href) return;
    try {
      downloadEl.hidden = false;
      downloadEl.click();
      downloadEl.hidden = true;
    } catch (error) {
      downloadEl.hidden = false;
      console.warn("Automatic download was blocked.", error);
    }
  }

  function prepareAutoDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    if (downloadEl) {
      downloadEl.href = url;
      downloadEl.download = filename;
      downloadEl.textContent = "Download again";
      downloadEl.hidden = true;
      clickDownloadLink();
    }
    return url;
  }

  function setRecordingUi(active, remainingMs = 0) {
    ensureIndicator();
    recordBtn.classList.toggle("recording", active);
    if (indicatorEl) indicatorEl.hidden = !active;
    if (!active) {
      recordBtn.textContent = "Record video";
      return;
    }
    const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
    const label = `${secondsLeft}s`;
    if (indicatorTimeEl) indicatorTimeEl.textContent = label;
    recordBtn.textContent = `REC Recording ${label}`;
    setAppStatus(`Recording ${label}`);
  }

  function startRecordingUi(durationMs) {
    recordingEndsAt = performance.now() + durationMs;
    window.clearInterval(recordTickTimer);
    const tick = () => {
      setRecordingUi(true, Math.max(0, recordingEndsAt - performance.now()));
    };
    tick();
    recordTickTimer = window.setInterval(tick, 250);
  }

  function stopRecordingUi() {
    window.clearTimeout(recordStopTimer);
    window.clearInterval(recordTickTimer);
    recordStopTimer = null;
    recordTickTimer = null;
    recordingEndsAt = 0;
    setRecordingUi(false);
  }

  function unlockActionButtons() {
    captureBtn.disabled = false;
    recordBtn.disabled = false;
  }

  async function capturePhotoWithAutoDownload() {
    if (captureBtn.disabled) return;
    captureBtn.disabled = true;
    recordBtn.disabled = true;
    await waitForAppCountdown();
    stageEl.toBlob((blob) => {
      if (!blob) {
        unlockActionButtons();
        return;
      }
      const url = prepareAutoDownload(blob, `china-pop-studio-${Date.now()}.png`);
      if (photoPreviewEl) {
        photoPreviewEl.src = url;
        photoPreviewEl.hidden = false;
      }
      if (videoPreviewEl) videoPreviewEl.hidden = true;
      if (outputPanelEl) outputPanelEl.hidden = false;
      setAppStatus("Photo saved");
      unlockActionButtons();
    }, "image/png");
  }

  async function recordVideoWithIndicator() {
    if (activeRecorder?.state === "recording") {
      setAppStatus("Finishing video");
      activeRecorder.stop();
      return;
    }

    recordBtn.disabled = true;
    captureBtn.disabled = true;
    await waitForAppCountdown();

    try {
      activeChunks = [];
      const seconds = Number(recordLengthEl?.value || 5);
      const canvasStream = stageEl.captureStream(30);
      const audioTrack = cameraEl?.srcObject?.getAudioTracks?.()[0];
      if (audioTrack) canvasStream.addTrack(audioTrack);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      activeRecorder = new MediaRecorder(canvasStream, { mimeType });
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) activeChunks.push(event.data);
      };
      activeRecorder.onstop = () => {
        stopRecordingUi();
        const blob = new Blob(activeChunks, { type: "video/webm" });
        const url = prepareAutoDownload(blob, `china-pop-studio-${Date.now()}.webm`);
        if (videoPreviewEl) {
          videoPreviewEl.src = url;
          videoPreviewEl.hidden = false;
        }
        if (photoPreviewEl) photoPreviewEl.hidden = true;
        if (outputPanelEl) outputPanelEl.hidden = false;
        activeRecorder = null;
        unlockActionButtons();
        setAppStatus("Video saved");
      };

      activeRecorder.start();
      startRecordingUi(seconds * 1000);
      recordBtn.disabled = false;
      recordStopTimer = window.setTimeout(() => {
        if (activeRecorder?.state === "recording") activeRecorder.stop();
      }, seconds * 1000);
    } catch (error) {
      activeRecorder = null;
      stopRecordingUi();
      unlockActionButtons();
      setAppStatus("Video recording failed");
      console.warn("Could not record video.", error);
    }
  }

  if (typeof window.capturePhoto === "function") {
    captureBtn.removeEventListener("click", window.capturePhoto);
  }
  if (typeof window.recordVideo === "function") {
    recordBtn.removeEventListener("click", window.recordVideo);
  }

  captureBtn.addEventListener("click", capturePhotoWithAutoDownload);
  recordBtn.addEventListener("click", recordVideoWithIndicator);
})();
