(() => {
  const actionRow = document.querySelector(".action-row");
  const cutoutToggle = document.querySelector("#cutoutToggle");
  const captureButton = document.querySelector("#capturePhoto");
  const recordButton = document.querySelector("#recordVideo");
  const templateGrid = document.querySelector("#templates");
  let albumPhoto = null;
  let albumPhotoName = "";
  let albumMask = null;
  let albumMaskWidth = 0;
  let albumMaskHeight = 0;
  let albumMaskSourceName = "";
  let albumSegmenter = null;
  let albumSegmenterPromise = null;
  let albumSegmentationJob = null;
  let albumSegmentationResolver = null;
  let albumCutoutFailed = false;
  const albumMaskCanvas = document.createElement("canvas");
  const albumMaskCtx = albumMaskCanvas.getContext("2d", { willReadFrequently: true });
  const cdnBases = [
    "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation",
    "https://unpkg.com/@mediapipe/selfie_segmentation",
  ];
  let selectedCdnBase = cdnBases[0];

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

  async function ensureAlbumSegmenter() {
    if (albumSegmenter) return true;
    if (!albumSegmenterPromise) {
      albumSegmenterPromise = (async () => {
        if (typeof SelfieSegmentation === "undefined") {
          let loaded = false;
          for (const base of cdnBases) {
            try {
              await loadScript(`${base}/selfie_segmentation.js`);
              selectedCdnBase = base;
              loaded = true;
              break;
            } catch (error) {
              console.warn("Could not load photo cutout script.", error);
            }
          }
          if (!loaded || typeof SelfieSegmentation === "undefined") return false;
        }
        albumSegmenter = new SelfieSegmentation({
          locateFile: (file) => `${selectedCdnBase}/${file}`,
        });
        albumSegmenter.setOptions({
          modelSelection: 1,
          selfieMode: false,
        });
        albumSegmenter.onResults((results) => {
          albumMask = results.segmentationMask;
          albumMaskWidth = results.image?.width || albumPhoto?.naturalWidth || 0;
          albumMaskHeight = results.image?.height || albumPhoto?.naturalHeight || 0;
          albumMaskSourceName = albumPhotoName;
          if (albumSegmentationResolver) {
            albumSegmentationResolver(true);
            albumSegmentationResolver = null;
          }
        });
        return true;
      })();
    }
    return albumSegmenterPromise;
  }

  async function segmentAlbumPhoto() {
    if (!albumPhoto || !cutoutToggle?.checked) return false;
    if (albumCutoutFailed) return false;
    if (albumSegmentationJob) return albumSegmentationJob;
    albumSegmentationJob = (async () => {
      try {
        setAppStatus("Cutting out photo background");
        const ready = await ensureAlbumSegmenter();
        if (!ready) {
          albumCutoutFailed = true;
          setAppStatus("Photo cutout unavailable");
          return false;
        }
        const result = new Promise((resolve) => {
          albumSegmentationResolver = resolve;
          window.setTimeout(() => {
            if (albumSegmentationResolver) {
              albumSegmentationResolver(false);
              albumSegmentationResolver = null;
            }
          }, 6000);
        });
        await albumSegmenter.send({ image: albumPhoto });
        const ok = await result;
        setAppStatus(ok ? "Photo cutout ready" : "Photo cutout failed");
        return ok;
      } catch (error) {
        albumCutoutFailed = true;
        setAppStatus("Photo cutout unavailable");
        console.warn("Could not cut out phone photo.", error);
        return false;
      } finally {
        albumSegmentationJob = null;
      }
    })();
    return albumSegmentationJob;
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
    label.innerHTML = `<input id="albumPhotoInput" accept="image/*" type="file" /> <span>Choose photo</span>`;

    const clearButton = document.createElement("button");
    clearButton.id = "clearAlbumPhoto";
    clearButton.className = "photo-clear-button";
    clearButton.type = "button";
    clearButton.hidden = true;
    clearButton.textContent = "Remove photo";

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
        albumMask = null;
        albumMaskSourceName = "";
        albumCutoutFailed = false;
        text.textContent = "Change photo";
        clearButton.hidden = false;
        if (captureButton) captureButton.disabled = false;
        if (recordButton) recordButton.disabled = false;
        if (cutoutToggle?.checked) {
          segmentAlbumPhoto();
        } else {
          setAppStatus("Phone photo ready");
        }
      } catch (error) {
        albumPhoto = null;
        albumMask = null;
        setAppStatus("Photo load failed");
        console.warn("Could not load album photo.", error);
      }
    });

    clearButton.addEventListener("click", () => {
      albumPhoto = null;
      albumPhotoName = "";
      albumMask = null;
      albumMaskSourceName = "";
      albumCutoutFailed = false;
      input.value = "";
      text.textContent = "Choose photo";
      clearButton.hidden = true;
      setAppStatus(camera?.readyState >= 2 ? "Camera is live" : "Camera is off");
    });

    cutoutToggle?.addEventListener("change", () => {
      if (cutoutToggle.checked && albumPhoto) segmentAlbumPhoto();
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

  function drawAlbumSegmentationMask(x, y, boxW, boxH, crop) {
    if (!albumMask || albumMaskSourceName !== albumPhotoName || !albumMaskWidth || !albumMaskHeight) return false;

    syncCanvasSize(albumMaskCanvas, albumMaskCtx, W, H);
    const sx = crop.sx * albumMaskWidth / albumPhoto.naturalWidth;
    const sy = crop.sy * albumMaskHeight / albumPhoto.naturalHeight;
    const sw = crop.sw * albumMaskWidth / albumPhoto.naturalWidth;
    const sh = crop.sh * albumMaskHeight / albumPhoto.naturalHeight;

    albumMaskCtx.save();
    albumMaskCtx.filter = "blur(1px)";
    albumMaskCtx.drawImage(albumMask, sx, sy, sw, sh, x, y, boxW, boxH);
    albumMaskCtx.restore();

    const left = Math.max(0, Math.floor(x - 2));
    const top = Math.max(0, Math.floor(y - 2));
    const right = Math.min(W, Math.ceil(x + boxW + 2));
    const bottom = Math.min(H, Math.ceil(y + boxH + 2));
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const image = albumMaskCtx.getImageData(left, top, width, height);
    const data = image.data;

    for (let i = 0; i < data.length; i += 4) {
      const maskValue = data[i];
      const alpha = Math.max(0, Math.min(1, (maskValue - 132) / 72));
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }

    albumMaskCtx.putImageData(image, left, top);
    return true;
  }

  function drawAlbumCutoutLayer(stageCtx) {
    if (!albumPhoto || !sourceIsReady(albumPhoto)) {
      drawCleanCameraLayer(stageCtx, albumPhoto);
      return;
    }

    const { style, boxW, boxH, x, y } = getFrameBox();
    const crop = getCoverCrop(albumPhoto, boxW, boxH);

    syncCanvasSize(portraitLayer, portraitLayerCtx, W, H);

    portraitLayerCtx.save();
    applyPortraitClip(portraitLayerCtx, x, y, boxW, boxH, style);
    portraitLayerCtx.clip();
    drawSourceCover(portraitLayerCtx, albumPhoto, x, y, boxW, boxH);
    portraitLayerCtx.restore();

    if (drawAlbumSegmentationMask(x, y, boxW, boxH, crop)) {
      portraitLayerCtx.save();
      portraitLayerCtx.globalCompositeOperation = "destination-in";
      portraitLayerCtx.drawImage(albumMaskCanvas, 0, 0);
      portraitLayerCtx.restore();
    } else {
      segmentAlbumPhoto();
    }

    stageCtx.save();
    stageCtx.drawImage(portraitLayer, 0, 0);
    stageCtx.restore();
  }

  function installCleanCameraOverride() {
    if (typeof drawCameraLayer !== "function") return;
    const previousDrawCameraLayer = drawCameraLayer;
    drawCameraLayer = (stageCtx) => {
      if (albumPhoto) {
        if (cutoutToggle?.checked) {
          drawAlbumCutoutLayer(stageCtx);
          return;
        }
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

  function installMobileTemplateChooser() {
    if (!templateGrid || document.querySelector("#mobileTemplateSelect")) return;
    const section = templateGrid.closest("section");
    if (!section) return;

    const chooser = document.createElement("label");
    chooser.className = "mobile-template-chooser";
    chooser.innerHTML = `<span>Template</span><select id="mobileTemplateSelect"></select>`;
    section.insertBefore(chooser, templateGrid);

    const select = chooser.querySelector("select");
    function syncChooser() {
      if (typeof templates === "undefined") return;
      const options = templates.map((template, index) => `<option value="${index}">${template.name}</option>`).join("");
      if (select.dataset.options !== options) {
        select.innerHTML = options;
        select.dataset.options = options;
      }
      if (typeof currentTemplate !== "undefined") select.value = String(currentTemplate);
    }

    select.addEventListener("change", () => {
      const index = Number(select.value);
      if (window.CHINA_POP_STUDIO?.selectTemplate) {
        window.CHINA_POP_STUDIO.selectTemplate(index);
      }
      syncChooser();
    });

    if (typeof renderTemplateButtons === "function") {
      const previousRenderTemplateButtons = renderTemplateButtons;
      renderTemplateButtons = (...args) => {
        const result = previousRenderTemplateButtons(...args);
        syncChooser();
        return result;
      };
    }
    window.setTimeout(syncChooser, 0);
    window.setTimeout(syncChooser, 800);
  }

  createAlbumControl();
  installCleanCameraOverride();
  installMobileTemplateChooser();
  window.CHINA_POP_STUDIO_UPGRADES = {
    hasAlbumPhoto: () => Boolean(albumPhoto),
    albumPhotoName: () => albumPhotoName,
  };
})();
