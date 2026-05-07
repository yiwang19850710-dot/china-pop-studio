(() => {
  const stageEl = document.querySelector("#stage");
  const cameraEl = document.querySelector("#camera");
  const captureBtn = document.querySelector("#capturePhoto");
  const recordBtn = document.querySelector("#recordVideo");
  const downloadEl = document.querySelector("#downloadLink");
  const actionRowEl = document.querySelector(".action-row");
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
  let lastObjectUrl = "";
  let shareButtonEl = null;
  let lastShareFile = null;

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

  function waitForAnimationFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  async function waitForCleanPreviewFrame() {
    await waitForAppCountdown();
    await waitForAnimationFrame();
    await waitForAnimationFrame();
  }

  function getSupportedRecordingFormat() {
    const formats = [
      { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", extension: "mp4", label: "MP4" },
      { mimeType: "video/mp4;codecs=avc1.42E01E", extension: "mp4", label: "MP4" },
      { mimeType: "video/mp4", extension: "mp4", label: "MP4" },
      { mimeType: "video/webm;codecs=vp8,opus", extension: "webm", label: "WebM" },
      { mimeType: "video/webm;codecs=vp8", extension: "webm", label: "WebM" },
      { mimeType: "video/webm", extension: "webm", label: "WebM" },
    ];
    return formats.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) || formats[formats.length - 1];
  }

  function ensureShareButton() {
    if (shareButtonEl || !actionRowEl) return shareButtonEl;
    shareButtonEl = document.createElement("button");
    shareButtonEl.id = "shareOutput";
    shareButtonEl.type = "button";
    shareButtonEl.hidden = true;
    shareButtonEl.textContent = "Share";
    downloadEl?.after(shareButtonEl);
    shareButtonEl.addEventListener("click", async () => {
      if (!lastShareFile || !navigator.share) return;
      try {
        await navigator.share({
          files: [lastShareFile],
          title: "China Pop Studio",
          text: "Made with China Pop Studio",
        });
        setAppStatus("Share opened");
      } catch (error) {
        setAppStatus("Share cancelled");
      }
    });
    return shareButtonEl;
  }

  function updateShareButton(blob, filename, label) {
    const button = ensureShareButton();
    if (!button || typeof File === "undefined") return;
    lastShareFile = new File([blob], filename, { type: blob.type || "application/octet-stream" });
    const canShare = Boolean(navigator.share && (!navigator.canShare || navigator.canShare({ files: [lastShareFile] })));
    button.textContent = label;
    button.hidden = !canShare;
  }

  function clickDownloadLink() {
    if (!downloadEl?.href) return;
    try {
      downloadEl.hidden = false;
      downloadEl.click();
    } catch (error) {
      downloadEl.hidden = false;
      console.warn("Automatic download was blocked.", error);
    }
  }

  function prepareAutoDownload(blob, filename, label) {
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    const url = URL.createObjectURL(blob);
    lastObjectUrl = url;
    updateShareButton(blob, filename, label.replace("Save", "Share"));
    if (downloadEl) {
      downloadEl.href = url;
      downloadEl.download = filename;
      downloadEl.target = "_blank";
      downloadEl.rel = "noopener";
      downloadEl.textContent = label;
      downloadEl.hidden = false;
      clickDownloadLink();
    }
    return url;
  }

  function finishActiveRecording() {
    if (activeRecorder?.state !== "recording") return;
    try {
      activeRecorder.requestData();
    } catch (error) {
      console.warn("Could not request final video data.", error);
    }
    activeRecorder.stop();
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
    await waitForCleanPreviewFrame();
    stageEl.toBlob((blob) => {
      if (!blob) {
        unlockActionButtons();
        return;
      }
      const url = prepareAutoDownload(blob, `china-pop-studio-${Date.now()}.jpg`, "Save photo");
      if (photoPreviewEl) {
        photoPreviewEl.src = url;
        photoPreviewEl.hidden = false;
      }
      if (videoPreviewEl) videoPreviewEl.hidden = true;
      if (outputPanelEl) outputPanelEl.hidden = false;
      setAppStatus("Photo ready");
      unlockActionButtons();
    }, "image/jpeg", 0.9);
  }

  async function recordVideoWithIndicator() {
    if (activeRecorder?.state === "recording") {
      setAppStatus("Finishing video");
      finishActiveRecording();
      return;
    }

    recordBtn.disabled = true;
    captureBtn.disabled = true;
    await waitForCleanPreviewFrame();

    try {
      activeChunks = [];
      const seconds = Number(recordLengthEl?.value || 5);
      const format = getSupportedRecordingFormat();
      const canvasStream = stageEl.captureStream(30);
      const audioTrack = cameraEl?.srcObject?.getAudioTracks?.()[0];
      if (audioTrack) canvasStream.addTrack(audioTrack);

      activeRecorder = new MediaRecorder(canvasStream, { mimeType: format.mimeType });
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) activeChunks.push(event.data);
      };
      activeRecorder.onstop = () => {
        stopRecordingUi();
        setAppStatus("Preparing video");
        if (!activeChunks.length) {
          activeRecorder = null;
          unlockActionButtons();
          setAppStatus("Video failed, please record again");
          return;
        }
        const blobType = activeRecorder.mimeType || format.mimeType;
        const extension = blobType.includes("mp4") ? "mp4" : format.extension;
        const formatLabel = blobType.includes("mp4") ? "MP4" : format.label;
        const blob = new Blob(activeChunks, { type: blobType });
        const url = prepareAutoDownload(blob, `china-pop-studio-${Date.now()}.${extension}`, "Save video");
        if (videoPreviewEl) {
          videoPreviewEl.src = url;
          videoPreviewEl.hidden = false;
        }
        if (photoPreviewEl) photoPreviewEl.hidden = true;
        if (outputPanelEl) outputPanelEl.hidden = false;
        activeRecorder = null;
        unlockActionButtons();
        setAppStatus(`Video ready (${formatLabel})`);
      };

      activeRecorder.start(500);
      startRecordingUi(seconds * 1000);
      recordBtn.disabled = false;
      recordStopTimer = window.setTimeout(() => {
        finishActiveRecording();
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
