(() => {
  const cutoutToggle = document.querySelector("#cutoutToggle");
  if (!cutoutToggle) return;

  const cdnBases = [
    "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation",
    "https://unpkg.com/@mediapipe/selfie_segmentation",
  ];

  let selectedCdnBase = cdnBases[0];
  let segmenter = null;
  let segmenterPromise = null;
  let latestMask = null;
  let latestMaskWidth = 0;
  let latestMaskHeight = 0;
  let isSegmenting = false;
  let lastSegmentAt = 0;
  let hasFailed = false;
  let didShowLoading = false;
  const cleanMask = document.createElement("canvas");
  const cleanMaskCtx = cleanMask.getContext("2d", { willReadFrequently: true });
  let latestMaskRevision = 0;
  let cleanMaskKey = "";

  function setAppStatus(message) {
    try {
      if (typeof setStatus === "function") setStatus(message);
    } catch (error) {
      console.warn("Could not update segmentation status.", error);
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.append(script);
    });
  }

  async function loadSegmentationScript() {
    for (const base of cdnBases) {
      try {
        await loadScript(`${base}/selfie_segmentation.js`);
        selectedCdnBase = base;
        return true;
      } catch (error) {
        console.warn(error);
      }
    }
    return false;
  }

  async function ensureSegmenter() {
    if (segmenter) return true;
    if (hasFailed) return false;
    if (!segmenterPromise) {
      segmenterPromise = (async () => {
        if (!didShowLoading) {
          didShowLoading = true;
          setAppStatus("Loading background cutout");
        }
        const loaded = await loadSegmentationScript();
        if (!loaded || typeof SelfieSegmentation === "undefined") {
          hasFailed = true;
          setAppStatus("Cutout unavailable");
          return false;
        }
        segmenter = new SelfieSegmentation({
          locateFile: (file) => `${selectedCdnBase}/${file}`,
        });
        segmenter.setOptions({
          modelSelection: 1,
          selfieMode: false,
        });
        segmenter.onResults((results) => {
          latestMask = results.segmentationMask;
          latestMaskWidth = results.image?.width || camera.videoWidth || 0;
          latestMaskHeight = results.image?.height || camera.videoHeight || 0;
          latestMaskRevision += 1;
        });
        setAppStatus("Camera cutout ready");
        return true;
      })();
    }
    return segmenterPromise;
  }

  async function queueSegmentation() {
    if (!cutoutToggle.checked || hasFailed) return;
    if (typeof camera === "undefined" || camera.readyState < 2 || !camera.videoWidth || !camera.videoHeight) return;
    const now = performance.now();
    if (isSegmenting || now - lastSegmentAt < 120) return;
    lastSegmentAt = now;
    isSegmenting = true;
    try {
      const ready = await ensureSegmenter();
      if (ready) await segmenter.send({ image: camera });
    } catch (error) {
      hasFailed = true;
      setAppStatus("Cutout unavailable");
      console.warn("Background cutout failed.", error);
    } finally {
      isSegmenting = false;
    }
  }

  function getSourceCrop(boxW, boxH, sourceW = camera.videoWidth, sourceH = camera.videoHeight) {
    const sourceRatio = sourceW / sourceH;
    const targetRatio = boxW / boxH;
    let sx = 0;
    let sy = 0;
    let sw = sourceW;
    let sh = sourceH;
    if (sourceRatio > targetRatio) {
      sw = sourceH * targetRatio;
      sx = (sourceW - sw) / 2;
    } else {
      sh = sourceW / targetRatio;
      sy = (sourceH - sh) / 2;
    }
    return { sx, sy, sw, sh };
  }

  function drawSourceCover(layerCtx, source, x, y, boxW, boxH, crop) {
    if (mirrorToggle.checked) {
      layerCtx.translate(x + boxW, y);
      layerCtx.scale(-1, 1);
      layerCtx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, boxW, boxH);
    } else {
      layerCtx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, x, y, boxW, boxH);
    }
  }

  function drawMaskImageCover(layerCtx, x, y, boxW, boxH, cameraCrop) {
    if (!latestMask || !latestMaskWidth || !latestMaskHeight) return false;
    const sx = cameraCrop.sx * latestMaskWidth / camera.videoWidth;
    const sy = cameraCrop.sy * latestMaskHeight / camera.videoHeight;
    const sw = cameraCrop.sw * latestMaskWidth / camera.videoWidth;
    const sh = cameraCrop.sh * latestMaskHeight / camera.videoHeight;
    if (mirrorToggle.checked) {
      layerCtx.translate(x + boxW, y);
      layerCtx.scale(-1, 1);
      layerCtx.drawImage(latestMask, sx, sy, sw, sh, 0, 0, boxW, boxH);
    } else {
      layerCtx.drawImage(latestMask, sx, sy, sw, sh, x, y, boxW, boxH);
    }
    return true;
  }

  function rebuildCleanMask(x, y, boxW, boxH, cameraCrop) {
    syncCanvasSize(cleanMask, cleanMaskCtx, W, H);

    cleanMaskCtx.save();
    cleanMaskCtx.filter = "blur(2px)";
    drawMaskImageCover(cleanMaskCtx, x, y, boxW, boxH, cameraCrop);
    cleanMaskCtx.restore();

    const left = Math.max(0, Math.floor(x - 2));
    const top = Math.max(0, Math.floor(y - 2));
    const right = Math.min(W, Math.ceil(x + boxW + 2));
    const bottom = Math.min(H, Math.ceil(y + boxH + 2));
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const image = cleanMaskCtx.getImageData(left, top, width, height);
    const data = image.data;

    for (let i = 0; i < data.length; i += 4) {
      const maskValue = data[i];
      const alpha = Math.max(0, Math.min(1, (maskValue - 120) / 86));
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }

    cleanMaskCtx.putImageData(image, left, top);
  }

  function drawMaskCover(layerCtx, x, y, boxW, boxH, cameraCrop) {
    if (!latestMask || !latestMaskWidth || !latestMaskHeight) return false;
    const key = [
      latestMaskRevision,
      Math.round(x),
      Math.round(y),
      Math.round(boxW),
      Math.round(boxH),
      Math.round(cameraCrop.sx),
      Math.round(cameraCrop.sy),
      Math.round(cameraCrop.sw),
      Math.round(cameraCrop.sh),
      mirrorToggle.checked ? "mirror" : "normal",
    ].join(":");

    if (key !== cleanMaskKey) {
      rebuildCleanMask(x, y, boxW, boxH, cameraCrop);
      cleanMaskKey = key;
    }

    layerCtx.globalCompositeOperation = "destination-in";
    layerCtx.drawImage(cleanMask, 0, 0);
    return true;
  }

  function drawCutoutCameraLayer(stageCtx) {
    const ready = camera.readyState >= 2 && camera.videoWidth && camera.videoHeight;
    const size = Number(portraitSizeInput.value) / 100;
    const slot = templates[currentTemplate]?.personSlot || {};
    const style = maskStyleInput.value || slot.shape || "oval";
    const slotScale = slot.scale || 1;
    const vertical = H > W;
    let boxW = W * (vertical ? 0.58 : 0.38) * size * slotScale;
    let boxH = H * (vertical ? 0.43 : 0.74) * size * slotScale;
    if (style === "full") {
      boxW = W * (vertical ? 0.72 : 0.64) * size * slotScale;
      boxH = H * (vertical ? 0.48 : 0.72) * size * slotScale;
    }
    if (style === "circle") {
      boxW = boxH = Math.min(W, H) * 0.62 * size * slotScale;
    }
    const centerX = W * (slot.x || 0.5);
    const centerY = H * (slot.y || (vertical ? 0.42 : 0.54));
    const x = centerX - boxW / 2;
    const y = centerY - boxH / 2;
    const feather = Math.max(12, Math.min(W, H) * 0.028);

    stageCtx.save();
    stageCtx.shadowColor = "rgba(255, 198, 72, 0.42)";
    stageCtx.shadowBlur = 26;
    stageCtx.fillStyle = "rgba(255, 226, 124, 0.12)";
    applyPortraitClip(stageCtx, x - feather, y - feather, boxW + feather * 2, boxH + feather * 2, style);
    stageCtx.fill();
    stageCtx.restore();

    syncCanvasSize(portraitLayer, portraitLayerCtx, W, H);
    syncCanvasSize(portraitMask, portraitMaskCtx, W, H);

    if (ready) {
      const cameraCrop = getSourceCrop(boxW, boxH);

      portraitLayerCtx.save();
      applyPortraitClip(portraitLayerCtx, x, y, boxW, boxH, style);
      portraitLayerCtx.clip();
      drawSourceCover(portraitLayerCtx, camera, x, y, boxW, boxH, cameraCrop);
      portraitLayerCtx.restore();

      portraitLayerCtx.save();
      const maskApplied = drawMaskCover(portraitLayerCtx, x, y, boxW, boxH, cameraCrop);
      portraitLayerCtx.restore();

      if (!maskApplied) {
        drawPortraitMask(portraitMaskCtx, x, y, boxW, boxH, style, feather);
        portraitLayerCtx.save();
        portraitLayerCtx.globalCompositeOperation = "destination-in";
        portraitLayerCtx.drawImage(portraitMask, 0, 0);
        portraitLayerCtx.restore();
      }

      portraitLayerCtx.save();
      portraitLayerCtx.globalCompositeOperation = "source-atop";
      const softGrade = portraitLayerCtx.createLinearGradient(x, y, x, y + boxH);
      softGrade.addColorStop(0, "rgba(255, 248, 226, 0.08)");
      softGrade.addColorStop(0.58, "rgba(255, 224, 142, 0.05)");
      softGrade.addColorStop(1, "rgba(42, 24, 12, 0.08)");
      portraitLayerCtx.fillStyle = softGrade;
      portraitLayerCtx.fillRect(x, y, boxW, boxH);
      portraitLayerCtx.restore();

      stageCtx.save();
      stageCtx.globalAlpha = 0.98;
      stageCtx.drawImage(portraitLayer, 0, 0);
      stageCtx.restore();
    } else {
      stageCtx.save();
      applyPortraitClip(stageCtx, x, y, boxW, boxH, style);
      stageCtx.clip();
      stageCtx.fillStyle = "rgba(255, 255, 255, 0.08)";
      stageCtx.fillRect(x, y, boxW, boxH);
      stageCtx.fillStyle = "rgba(249, 244, 232, 0.76)";
      stageCtx.textAlign = "center";
      stageCtx.textBaseline = "middle";
      stageCtx.font = "700 34px sans-serif";
      stageCtx.fillText("Start camera", x + boxW / 2, y + boxH / 2);
      stageCtx.restore();
    }

    stageCtx.save();
    stageCtx.globalCompositeOperation = "screen";
    const mist = stageCtx.createLinearGradient(0, y + boxH * 0.6, 0, y + boxH + feather * 2);
    mist.addColorStop(0, "rgba(255, 244, 210, 0)");
    mist.addColorStop(0.7, "rgba(255, 232, 170, 0.08)");
    mist.addColorStop(1, "rgba(255, 216, 126, 0.11)");
    stageCtx.fillStyle = mist;
    stageCtx.fillRect(Math.max(0, x - feather * 2), y + boxH * 0.58, Math.min(W, boxW + feather * 4), boxH * 0.45);
    stageCtx.restore();
  }

  try {
    const originalDrawCameraLayer = drawCameraLayer;
    drawCameraLayer = (stageCtx) => {
      if (!cutoutToggle.checked) {
        originalDrawCameraLayer(stageCtx);
        return;
      }
      queueSegmentation();
      try {
        drawCutoutCameraLayer(stageCtx);
      } catch (error) {
        console.warn("Cutout draw failed.", error);
        originalDrawCameraLayer(stageCtx);
      }
    };
  } catch (error) {
    console.warn("Could not install background cutout.", error);
  }

  cutoutToggle.addEventListener("change", () => {
    if (cutoutToggle.checked) queueSegmentation();
  });
})();
