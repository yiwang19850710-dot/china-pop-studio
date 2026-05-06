(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode || window.CHINA_POP_APP_HAS_BUILTIN_MANAGER) return;

  const STORAGE_KEY = "china-pop-template-drafts-v1";
  const managerTemplate = document.querySelector("#managerTemplate");
  const managerName = document.querySelector("#managerName");
  const managerCategory = document.querySelector("#managerCategory");
  const managerTitleZh = document.querySelector("#managerTitleZh");
  const managerTitleEn = document.querySelector("#managerTitleEn");
  const managerSubZh = document.querySelector("#managerSubZh");
  const managerSubEn = document.querySelector("#managerSubEn");
  const managerSeal = document.querySelector("#managerSeal");
  const managerSlotX = document.querySelector("#managerSlotX");
  const managerSlotY = document.querySelector("#managerSlotY");
  const managerSlotScale = document.querySelector("#managerSlotScale");
  const managerSlotShape = document.querySelector("#managerSlotShape");
  const managerSlotXValue = document.querySelector("#managerSlotXValue");
  const managerSlotYValue = document.querySelector("#managerSlotYValue");
  const managerSlotScaleValue = document.querySelector("#managerSlotScaleValue");
  const managerApply = document.querySelector("#managerApply");
  const maskStyle = document.querySelector("#maskStyle");
  const statusEl = document.querySelector("#status");
  const mediaElementCache = new Map();

  if (!managerTemplate || !managerApply) return;

  function hasOwnValue(source, key) {
    return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
  }

  function copyText(source, key, fallback = "") {
    const value = hasOwnValue(source, key) ? source[key] : fallback;
    return String(value ?? "");
  }

  function hasVisibleText(value) {
    return String(value ?? "").trim().length > 0;
  }

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function currentIndex() {
    const index = Number(managerTemplate.value);
    return Number.isInteger(index) ? index : 0;
  }

  function currentConfig() {
    return (window.CHINA_POP_TEMPLATE_CONFIGS || [])[currentIndex()];
  }

  function updateRangeLabels() {
    if (managerSlotXValue) managerSlotXValue.textContent = `${managerSlotX.value}%`;
    if (managerSlotYValue) managerSlotYValue.textContent = `${managerSlotY.value}%`;
    if (managerSlotScaleValue) managerSlotScaleValue.textContent = `${managerSlotScale.value}%`;
  }

  function persistableConfig(config) {
    const next = JSON.parse(JSON.stringify(config));
    if (next.media?.transient) {
      next.media = {
        kind: next.media.kind,
        name: next.media.name,
        transient: true,
      };
    }
    return next;
  }

  function saveDrafts() {
    try {
      const configs = window.CHINA_POP_TEMPLATE_CONFIGS || [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs.map(persistableConfig)));
    } catch (error) {
      console.warn("Could not save template fix.", error);
    }
  }

  function readSnapshot() {
    return {
      index: currentIndex(),
      name: managerName.value.trim(),
      category: managerCategory.value.trim(),
      titleZh: managerTitleZh.value.trim(),
      titleEn: managerTitleEn.value.trim(),
      subZh: managerSubZh.value.trim(),
      subEn: managerSubEn.value.trim(),
      seal: managerSeal.value.trim(),
      slot: {
        x: Number(managerSlotX.value) / 100,
        y: Number(managerSlotY.value) / 100,
        scale: Number(managerSlotScale.value) / 100,
        shape: managerSlotShape.value,
      },
    };
  }

  function writeManagerInputs(snapshot) {
    managerName.value = snapshot.name;
    managerCategory.value = snapshot.category;
    managerTitleZh.value = snapshot.titleZh;
    managerTitleEn.value = snapshot.titleEn;
    managerSubZh.value = snapshot.subZh;
    managerSubEn.value = snapshot.subEn;
    managerSeal.value = snapshot.seal;
    managerSlotX.value = Math.round(snapshot.slot.x * 100);
    managerSlotY.value = Math.round(snapshot.slot.y * 100);
    managerSlotScale.value = Math.round(snapshot.slot.scale * 100);
    managerSlotShape.value = snapshot.slot.shape;
    updateRangeLabels();
  }

  function syncRuntimeTemplate(index, config) {
    try {
      if (typeof templates !== "undefined" && templates[index]) {
        Object.assign(templates[index], config);
      }
    } catch (error) {
      console.warn("Could not sync runtime template.", error);
    }
    try {
      if (typeof currentTemplate !== "undefined") currentTemplate = index;
    } catch (error) {
      console.warn("Could not select runtime template.", error);
    }
    if (maskStyle && config.personSlot?.shape) maskStyle.value = config.personSlot.shape;
  }

  function applySnapshot(snapshot, options = {}) {
    const config = (window.CHINA_POP_TEMPLATE_CONFIGS || [])[snapshot.index];
    if (!config) return;
    config.name = snapshot.name || config.name;
    config.category = snapshot.category || config.category || "custom";
    config.copy = config.copy || {};
    if (config.renderer === "dailyGreeting") {
      config.copy.greeting = snapshot.titleZh;
      config.copy.greetingEn = snapshot.titleEn;
      config.copy.sub = snapshot.subZh;
      config.copy.subEn = snapshot.subEn;
    } else {
      config.copy.titleZh = snapshot.titleZh;
      config.copy.titleEn = snapshot.titleEn;
      config.copy.subtitleZh = snapshot.subZh;
      config.copy.subtitleEn = snapshot.subEn;
    }
    config.copy.seal = snapshot.seal;
    config.personSlot = { ...(config.personSlot || {}), ...snapshot.slot };
    syncRuntimeTemplate(snapshot.index, config);
    writeManagerInputs(snapshot);
    if (options.save) saveDrafts();
    if (options.renderButtons) {
      try {
        if (typeof renderTemplateButtons === "function") renderTemplateButtons();
      } catch (error) {
        console.warn("Could not refresh template buttons.", error);
      }
    }
    if (options.status) setStatus(options.status);
  }

  function previewCameraSlot() {
    const config = currentConfig();
    if (!config) return;
    config.personSlot = {
      ...(config.personSlot || {}),
      x: Number(managerSlotX.value) / 100,
      y: Number(managerSlotY.value) / 100,
      scale: Number(managerSlotScale.value) / 100,
      shape: managerSlotShape.value,
    };
    syncRuntimeTemplate(currentIndex(), config);
    updateRangeLabels();
  }

  function getMediaElement(media) {
    if (!media?.src) return null;
    const cached = mediaElementCache.get(media.src);
    if (cached) return cached;
    let element;
    if (media.kind === "video") {
      element = document.createElement("video");
      element.src = media.src;
      element.muted = true;
      element.loop = true;
      element.playsInline = true;
      element.preload = "auto";
      element.play().catch(() => {});
    } else {
      element = new Image();
      element.src = media.src;
    }
    mediaElementCache.set(media.src, element);
    return element;
  }

  function drawCoverElement(ctx, element, w, h) {
    const sourceW = element.videoWidth || element.naturalWidth || element.width;
    const sourceH = element.videoHeight || element.naturalHeight || element.height;
    if (!sourceW || !sourceH) return false;
    const sourceRatio = sourceW / sourceH;
    const targetRatio = w / h;
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
    ctx.drawImage(element, sx, sy, sw, sh, 0, 0, w, h);
    return true;
  }

  function drawUploadedMediaPoster(ctx, w, h, t, power, config = {}) {
    const copy = config.copy || {};
    const titleZh = copyText(copy, "titleZh", "\u4e2d\u56fd\u540d\u573a\u9762");
    const titleEn = copyText(copy, "titleEn", "CHINA SCENE MODE");
    const subtitleZh = copyText(copy, "subtitleZh", "\u4e00\u79d2\u878d\u5165\u672c\u5730\u751f\u6d3b");
    const subtitleEn = copyText(copy, "subtitleEn", "DROP ME INTO LOCAL CHINA");
    const seal = copyText(copy, "seal", "\u5165");
    const media = getMediaElement(config.media);
    let drewMedia = false;
    if (media) {
      if (config.media?.kind === "video") media.play().catch(() => {});
      drewMedia = drawCoverElement(ctx, media, w, h);
    }
    if (!drewMedia) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#1d2938");
      g.addColorStop(0.5, "#b31619");
      g.addColorStop(1, "#f16b1e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (typeof drawPosterRays === "function") drawPosterRays(ctx, w, h, t);
    }

    const warm = ctx.createLinearGradient(0, 0, 0, h);
    warm.addColorStop(0, "rgba(0, 0, 0, 0.22)");
    warm.addColorStop(0.48, "rgba(211, 22, 20, 0.08)");
    warm.addColorStop(1, "rgba(255, 82, 20, 0.38)");
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, w, h);

    if (typeof drawGoldConfetti === "function") drawGoldConfetti(ctx, w, h, t, power * 0.7);
    if (typeof drawSceneCaption === "function" && [titleZh, titleEn, subtitleZh, subtitleEn].some(hasVisibleText)) {
      drawSceneCaption(ctx, w, h, titleZh, titleEn, subtitleZh, subtitleEn);
    }
    if (typeof drawSeal === "function" && hasVisibleText(seal)) {
      drawSeal(ctx, w * 0.82, h * 0.18, Math.min(w, h) * 0.11, seal);
    }
  }

  try {
    if (typeof templateRenderers !== "undefined") {
      templateRenderers.uploadedMedia = (config, ctx, w, h, t, power) => {
        drawUploadedMediaPoster(ctx, w, h, t, power, config);
      };
    }
  } catch (error) {
    console.warn("Could not patch uploaded media renderer.", error);
  }

  managerApply.addEventListener(
    "click",
    () => {
      const snapshot = readSnapshot();
      setTimeout(() => {
        applySnapshot(snapshot, {
          save: true,
          renderButtons: true,
          status: "Template updated",
        });
      }, 0);
    },
    true,
  );
  [managerSlotX, managerSlotY, managerSlotScale].forEach((input) => {
    input.addEventListener("input", previewCameraSlot);
  });
  managerSlotShape.addEventListener("change", previewCameraSlot);
})();
