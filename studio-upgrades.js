(() => {
  const actionRow = document.querySelector(".action-row");
  const cutoutToggle = document.querySelector("#cutoutToggle");
  const captureButton = document.querySelector("#capturePhoto");
  const recordButton = document.querySelector("#recordVideo");
  let albumPhoto = null;
  let albumPhotoName = "";

  function setAppStatus(message) {
    try {
      if (typeof setStatus === "function") setStatus(message);
    } catch (error) {
      console.warn("Could not update status.", error);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function makeOptimizedImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const original = await loadImage(url);
      const maxSide = 1600;
      const ratio = Math.min(1, maxSide / Math.max(original.naturalWidth, original.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(original.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(original.naturalHeight * ratio));
      canvas.getContext("2d").drawImage(original, 0, 0, canvas.width, canvas.height);
      const optimized = await loadImage(canvas.toDataURL("image/jpeg", 0.9));
      optimized.dataset.sourceName = file.name;
      return optimized;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function createAlbumControl() {
    if (!actionRow || document.querySelector("#albumPhotoInput")) return;

    const label = document.createElement("label");
    label.className = "inline-toggle album-upload";
    label.innerHTML = `<input id="albumPhotoInput" accept="image/*" type="file" /> <span>Use phone photo</span>`;

    const clearButton = document.createElement("button");
    clearButton.id = "clearAlbumPhoto";
    clearButton.className = "photo-clear-button";
    clearButton.type = "button";
    clearButton.hidden = true;
    clearButton.textContent = "Clear photo";

    const anchor = cutoutToggle?.closest("label") || actionRow.firstElementChild;
    anchor?.after(label, clearButton);

    const input = label.querySelector("input");
    const text = label.querySelector("span");
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setAppStatus("Loading phone photo");
        albumPhoto = await makeOptimizedImage(file);
        albumPhotoName = file.name;
        text.textContent = "Photo loaded";
        clearButton.hidden = false;
        if (captureButton) captureButton.disabled = false;
        if (recordButton) recordButton.disabled = false;
        setAppStatus("Phone photo ready");
      } catch (error) {
        albumPhoto = null;
        setAppStatus("Photo load failed");
        console.warn("Could not load album photo.", error);
      }
    });

    clearButton.addEventListener("click", () => {
      albumPhoto = null;
      albumPhotoName = "";
      input.value = "";
      text.textContent = "Use phone photo";
      clearButton.hidden = true;
      setAppStatus(camera?.readyState >= 2 ? "Camera is live" : "Camera is off");
    });
  }

  function getFrameBox() {
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
    return {
      style,
      boxW,
      boxH,
      x: centerX - boxW / 2,
      y: centerY - boxH / 2,
      feather: Math.max(7, Math.min(W, H) * 0.014),
    };
  }

  function sourceIsReady(source) {
    if (!source) return false;
    if (source === camera) return camera.readyState >= 2 && camera.videoWidth && camera.videoHeight;
    return source.complete && source.naturalWidth && source.naturalHeight;
  }

  function getCoverCrop(source, boxW, boxH) {
    const width = source.videoWidth || source.naturalWidth || source.width || 0;
    const height = source.videoHeight || source.naturalHeight || source.height || 0;
    const sourceRatio = width / height;
    const targetRatio = boxW / boxH;
    let sx = 0;
    let sy = 0;
    let sw = width;
    let sh = height;
    if (sourceRatio > targetRatio) {
      sw = height * targetRatio;
      sx = (width - sw) / 2;
    } else {
      sh = width / targetRatio;
      sy = (height - sh) / 2;
    }
    return { sx, sy, sw, sh };
  }

  function drawSourceCover(layerCtx, source, x, y, boxW, boxH) {
    const crop = getCoverCrop(source, boxW, boxH);
    const shouldMirror = source === camera && mirrorToggle?.checked;
    if (shouldMirror) {
      layerCtx.translate(x + boxW, y);
      layerCtx.scale(-1, 1);
      layerCtx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, boxW, boxH);
    } else {
      layerCtx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, x, y, boxW, boxH);
    }
  }

  function drawCleanCameraLayer(stageCtx, source) {
    const ready = sourceIsReady(source);
    const { style, boxW, boxH, x, y, feather } = getFrameBox();

    syncCanvasSize(portraitLayer, portraitLayerCtx, W, H);
    syncCanvasSize(portraitMask, portraitMaskCtx, W, H);

    if (ready) {
      portraitLayerCtx.save();
      applyPortraitClip(portraitLayerCtx, x, y, boxW, boxH, style);
      portraitLayerCtx.clip();
      drawSourceCover(portraitLayerCtx, source, x, y, boxW, boxH);
      portraitLayerCtx.restore();

      drawPortraitMask(portraitMaskCtx, x, y, boxW, boxH, style, feather);
      portraitLayerCtx.save();
      portraitLayerCtx.globalCompositeOperation = "destination-in";
      portraitLayerCtx.drawImage(portraitMask, 0, 0);
      portraitLayerCtx.restore();

      stageCtx.save();
      stageCtx.drawImage(portraitLayer, 0, 0);
      stageCtx.restore();
      return;
    }

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

  function installCleanCameraOverride() {
    if (typeof drawCameraLayer !== "function") return;
    const previousDrawCameraLayer = drawCameraLayer;
    drawCameraLayer = (stageCtx) => {
      if (albumPhoto) {
        drawCleanCameraLayer(stageCtx, albumPhoto);
        return;
      }
      if (cutoutToggle?.checked) {
        previousDrawCameraLayer(stageCtx);
        return;
      }
      drawCleanCameraLayer(stageCtx, camera);
    };
  }

  createAlbumControl();
  installCleanCameraOverride();
  window.CHINA_POP_STUDIO_UPGRADES = {
    hasAlbumPhoto: () => Boolean(albumPhoto),
    albumPhotoName: () => albumPhotoName,
  };
})();
