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
  const audioModeEl = document.querySelector("#audioMode");
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
  let activeAudioCleanup = null;

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

  function isSupportedFormat(format) {
    return !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(format.mimeType);
  }

  function getSupportedRecordingFormat(needsAudio = false) {
    const formats = needsAudio
      ? [
          { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", extension: "mp4", label: "MP4" },
          { mimeType: "video/mp4;codecs=h264,mp4a.40.2", extension: "mp4", label: "MP4" },
          { mimeType: "video/webm;codecs=vp9,opus", extension: "webm", label: "WebM" },
          { mimeType: "video/webm;codecs=vp8,opus", extension: "webm", label: "WebM" },
          { mimeType: "video/webm", extension: "webm", label: "WebM" },
          { mimeType: "video/mp4", extension: "mp4", label: "MP4" },
        ]
      : [
          { mimeType: "video/mp4;codecs=avc1.42E01E", extension: "mp4", label: "MP4" },
          { mimeType: "video/mp4", extension: "mp4", label: "MP4" },
          { mimeType: "video/webm;codecs=vp8", extension: "webm", label: "WebM" },
          { mimeType: "video/webm", extension: "webm", label: "WebM" },
        ];
    return formats.find(isSupportedFormat) || formats[formats.length - 1];
  }

  function getShareMimeType(filename, blob) {
    if (filename.endsWith(".mp4")) return "video/mp4";
    if (filename.endsWith(".webm")) return "video/webm";
    if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
    return blob.type || "application/octet-stream";
  }

  function showSaveFallback(message) {
    if (downloadEl?.href) {
      downloadEl.hidden = false;
      downloadEl.textContent = lastShareFile?.type?.startsWith("video/") ? "Save video" : "Save photo";
    }
    setAppStatus(message);
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
      if (!lastShareFile) {
        showSaveFallback("Record a video first");
        return;
      }
      if (!navigator.share) {
        showSaveFallback("Share unavailable. Use Save video.");
        return;
      }
      const originalText = shareButtonEl.textContent;
      shareButtonEl.disabled = true;
      shareButtonEl.textContent = "Opening share...";
      setAppStatus("Opening share");
      try {
        const shareData = { files: [lastShareFile] };
        if (navigator.canShare && !navigator.canShare(shareData)) {
          throw new Error("File sharing is not supported by this browser.");
        }
        await navigator.share(shareData);
        setAppStatus("Share opened");
      } catch (error) {
        console.warn("Could not open share sheet.", error);
        const cancelled = error?.name === "AbortError" || error?.name === "NotAllowedError";
        showSaveFallback(cancelled ? "Share cancelled. Use Save video." : "Share unavailable. Use Save video.");
      } finally {
        shareButtonEl.disabled = false;
        shareButtonEl.textContent = originalText;
      }
    });
    return shareButtonEl;
  }

  function updateShareButton(blob, filename, label) {
    const button = ensureShareButton();
    if (!button || typeof File === "undefined") return;
    lastShareFile = new File([blob], filename, { type: getShareMimeType(filename, blob) });
    const canShare = Boolean(navigator.share);
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

  function getAudioMode() {
    return audioModeEl?.value || "mic";
  }

  function getMicTrack() {
    const track = cameraEl?.srcObject?.getAudioTracks?.()[0] || null;
    if (!track || track.readyState !== "live" || track.enabled === false) return null;
    return track;
  }

  function getCurrentTemplateConfig() {
    try {
      if (typeof templates === "undefined" || typeof currentTemplate === "undefined") return null;
      return templates[currentTemplate] || null;
    } catch (error) {
      return null;
    }
  }

  function getTemplateSoundSource() {
    const template = getCurrentTemplateConfig();
    if (template?.audio?.src) {
      return {
        kind: "audio",
        src: template.audio.src,
        name: template.audio.name || "template sound",
      };
    }
    if (template?.media?.kind === "video" && template.media.src) {
      return {
        kind: "video",
        src: template.media.src,
        name: template.media.name || "template video",
      };
    }
    return null;
  }

  function restartTemplateVisualMedia(source) {
    if (source?.kind !== "video") return;
    try {
      if (typeof mediaElementCache === "undefined") return;
      const visualElement = mediaElementCache.get(source.src);
      if (!visualElement) return;
      visualElement.currentTime = 0;
      visualElement.play?.().catch?.(() => {});
    } catch (error) {
      console.warn("Could not restart template video preview.", error);
    }
  }

  function stopActiveAudio() {
    if (!activeAudioCleanup) return;
    try {
      activeAudioCleanup();
    } catch (error) {
      console.warn("Could not clean up recording audio.", error);
    }
    activeAudioCleanup = null;
  }

  function createTemplateAudioElement(source) {
    const element = document.createElement(source.kind === "video" ? "video" : "audio");
    element.src = source.src;
    element.loop = true;
    element.playsInline = true;
    element.preload = "auto";
    element.muted = false;
    element.volume = 1;
    return element;
  }

  async function connectTemplateAudio(audioContext, destination, gainValue) {
    const source = getTemplateSoundSource();
    if (!source) return null;
    restartTemplateVisualMedia(source);

    const element = createTemplateAudioElement(source);
    const mediaSource = audioContext.createMediaElementSource(element);
    const gain = audioContext.createGain();
    gain.gain.value = gainValue;
    mediaSource.connect(gain).connect(destination);

    const cleanup = () => {
      try {
        element.pause();
        element.removeAttribute("src");
        element.load();
        mediaSource.disconnect();
        gain.disconnect();
      } catch (error) {
        console.warn("Could not clean up template sound.", error);
      }
    };

    try {
      element.currentTime = 0;
    } catch (error) {
      console.warn("Could not rewind template sound.", error);
    }

    try {
      await audioContext.resume();
      await element.play();
    } catch (error) {
      cleanup();
      throw error;
    }

    return { element, cleanup };
  }

  async function createRecordingStream(canvasStream) {
    stopActiveAudio();

    const mode = getAudioMode();
    const recordingStream = new MediaStream(canvasStream.getVideoTracks());
    const micTrack = getMicTrack();

    if (mode === "mute") {
      setAppStatus("Recording without sound");
      return recordingStream;
    }

    if (mode === "mic") {
      if (micTrack) recordingStream.addTrack(micTrack);
      else setAppStatus("Mic unavailable, recording silent video");
      return recordingStream;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      if (mode === "both" && micTrack) {
        recordingStream.addTrack(micTrack);
        setAppStatus("Template sound unavailable, using mic");
      } else {
        setAppStatus("Template sound unavailable");
      }
      return recordingStream;
    }

    const audioContext = new AudioContextConstructor();
    const destination = audioContext.createMediaStreamDestination();
    const cleanupTasks = [];
    let hasAudio = false;

    try {
      const templateAudio = await connectTemplateAudio(audioContext, destination, mode === "both" ? 0.82 : 1);
      if (templateAudio) {
        cleanupTasks.push(templateAudio.cleanup);
        hasAudio = true;
      }

      if (mode === "both" && micTrack) {
        const micStream = new MediaStream([micTrack]);
        const micSource = audioContext.createMediaStreamSource(micStream);
        const micGain = audioContext.createGain();
        micGain.gain.value = 0.78;
        micSource.connect(micGain).connect(destination);
        cleanupTasks.push(() => {
          micSource.disconnect();
          micGain.disconnect();
        });
        hasAudio = true;
      }

      if (!hasAudio) {
        await audioContext.close();
        if (mode === "both" && micTrack) recordingStream.addTrack(micTrack);
        setAppStatus(mode === "both" && micTrack ? "Template sound unavailable, using mic" : "Template sound unavailable");
        return recordingStream;
      }

      destination.stream.getAudioTracks().forEach((track) => recordingStream.addTrack(track));
      activeAudioCleanup = () => {
        cleanupTasks.forEach((cleanup) => cleanup());
        destination.stream.getTracks().forEach((track) => track.stop());
        audioContext.close().catch(() => {});
      };
      return recordingStream;
    } catch (error) {
      console.warn("Could not use template sound.", error);
      cleanupTasks.forEach((cleanup) => cleanup());
      destination.stream.getTracks().forEach((track) => track.stop());
      await audioContext.close().catch(() => {});
      if (mode === "both" && micTrack) {
        recordingStream.addTrack(micTrack);
        setAppStatus("Template sound unavailable, using mic");
      } else {
        setAppStatus("Template sound unavailable");
      }
      return recordingStream;
    }
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
      const canvasStream = stageEl.captureStream(30);
      const recordingStream = await createRecordingStream(canvasStream);
      const hasAudio = recordingStream.getAudioTracks().some((track) => track.readyState === "live");
      const format = getSupportedRecordingFormat(hasAudio);

      activeRecorder = new MediaRecorder(recordingStream, { mimeType: format.mimeType });
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) activeChunks.push(event.data);
      };
      activeRecorder.onstop = () => {
        stopRecordingUi();
        stopActiveAudio();
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
        const publicBlobType = extension === "mp4" ? "video/mp4" : "video/webm";
        const blob = new Blob(activeChunks, { type: publicBlobType });
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
      stopActiveAudio();
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
