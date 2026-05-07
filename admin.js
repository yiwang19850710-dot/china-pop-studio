(() => {
  const adminSection = document.querySelector("#templateAdmin");
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";

  if (!isAdminMode) {
    adminSection?.setAttribute("hidden", "");
    return;
  }

  if (adminSection) adminSection.hidden = false;
  if (window.CHINA_POP_APP_HAS_BUILTIN_MANAGER) return;

  const STORAGE_KEY = "china-pop-template-drafts-v1";
  const configs = window.CHINA_POP_TEMPLATE_CONFIGS || [];
  const baseConfigs = configs.map((config) => JSON.parse(JSON.stringify(config)));
  const managerToggle = document.querySelector("#templateManagerToggle");
  const managerPanel = document.querySelector("#templateManagerPanel");
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
  const managerReset = document.querySelector("#managerReset");
  const managerExport = document.querySelector("#managerExport");
  const managerImport = document.querySelector("#managerImport");
  const managerJson = document.querySelector("#managerJson");
  const managerMediaUpload = document.querySelector("#managerMediaUpload");
  const managerGenerateFromMedia = document.querySelector("#managerGenerateFromMedia");
  const managerMediaStatus = document.querySelector("#managerMediaStatus");
  const managerAudioUpload = document.querySelector("#managerAudioUpload");
  const managerClearAudio = document.querySelector("#managerClearAudio");
  const managerAudioStatus = document.querySelector("#managerAudioStatus");
  const templateGrid = document.querySelector("#templates");
  const maskStyle = document.querySelector("#maskStyle");
  const status = document.querySelector("#status");
  const mediaElementCache = new Map();

  let activeIndex = 0;

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

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

  function persistableConfig(config) {
    const next = clone(config);
    if (next.media?.transient) {
      next.media = {
        kind: next.media.kind,
        name: next.media.name,
        transient: true,
      };
    }
    if (next.audio?.transient) {
      next.audio = {
        kind: "audio",
        name: next.audio.name,
        type: next.audio.type,
        transient: true,
      };
    }
    return next;
  }

  function saveDrafts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs.map(persistableConfig)));
    } catch (error) {
      console.warn("Could not save template drafts.", error);
    }
  }

  function loadDrafts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved)) return;
      saved.forEach((draft) => {
        const index = configs.findIndex((config) => config.id === draft.id);
        if (index >= 0) {
          Object.assign(configs[index], draft);
        } else if (draft.renderer === "uploadedMedia") {
          configs.push(draft);
          baseConfigs.push(clone(draft));
          addRuntimeTemplate(draft, false);
        }
      });
    } catch (error) {
      console.warn("Could not load template drafts.", error);
    }
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
    const titleZh = copyText(copy, "titleZh", "中国名场面");
    const titleEn = copyText(copy, "titleEn", "CHINA SCENE MODE");
    const subtitleZh = copyText(copy, "subtitleZh", "一秒融入本地生活");
    const subtitleEn = copyText(copy, "subtitleEn", "DROP ME INTO LOCAL CHINA");
    const seal = copyText(copy, "seal", "入");
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
      drawSceneCaption(
        ctx,
        w,
        h,
        titleZh,
        titleEn,
        subtitleZh,
        subtitleEn,
      );
    } else {
      ctx.fillStyle = "#ffe06b";
      ctx.textAlign = "center";
      ctx.font = "900 56px sans-serif";
      if (hasVisibleText(titleEn)) ctx.fillText(titleEn, w / 2, h * 0.18);
    }
    if (typeof drawSeal === "function" && hasVisibleText(seal)) {
      drawSeal(ctx, w * 0.82, h * 0.18, Math.min(w, h) * 0.11, seal);
    }
  }

  function ensureUploadedRenderer() {
    if (typeof templateRenderers === "undefined") return false;
    templateRenderers.uploadedMedia = (config, ctx, w, h, t, power) => {
      drawUploadedMediaPoster(ctx, w, h, t, power, config);
    };
    return true;
  }

  function makeRuntimeTemplate(config) {
    return {
      ...config,
      draw(ctx, w, h, t, power) {
        const renderer = templateRenderers[this.renderer];
        if (!renderer) throw new Error(`Missing renderer for template: ${this.id}`);
        renderer(this, ctx, w, h, t, power);
      },
    };
  }

  function addRuntimeTemplate(config, selectAfterAdd = true) {
    if (typeof templates === "undefined" || !ensureUploadedRenderer()) return;
    const exists = templates.some((template) => template.id === config.id);
    if (!exists) templates.push(makeRuntimeTemplate(config));
    if (selectAfterAdd) {
      activeIndex = configs.findIndex((item) => item.id === config.id);
      if (typeof currentTemplate !== "undefined") currentTemplate = activeIndex;
      if (maskStyle && config.personSlot?.shape) maskStyle.value = config.personSlot.shape;
      if (typeof renderTemplateButtons === "function") renderTemplateButtons();
      syncTemplateOptions();
      populateManager(activeIndex);
    }
  }

  function copyFields(config) {
    const copy = config.copy || {};
    return {
      titleZh: copyText(copy, "titleZh", copy.greeting || ""),
      titleEn: copyText(copy, "titleEn", copy.greetingEn || ""),
      subZh: copyText(copy, "subtitleZh", copy.sub || ""),
      subEn: copyText(copy, "subtitleEn", copy.subEn || ""),
      seal: copyText(copy, "seal", ""),
    };
  }

  function writeCopy(config) {
    config.copy = config.copy || {};
    if (config.renderer === "dailyGreeting") {
      config.copy.greeting = managerTitleZh.value.trim();
      config.copy.greetingEn = managerTitleEn.value.trim();
      config.copy.sub = managerSubZh.value.trim();
      config.copy.subEn = managerSubEn.value.trim();
    } else {
      config.copy.titleZh = managerTitleZh.value.trim();
      config.copy.titleEn = managerTitleEn.value.trim();
      config.copy.subtitleZh = managerSubZh.value.trim();
      config.copy.subtitleEn = managerSubEn.value.trim();
    }
    config.copy.seal = managerSeal.value.trim();
  }

  function updateRangeLabels() {
    managerSlotXValue.textContent = `${managerSlotX.value}%`;
    managerSlotYValue.textContent = `${managerSlotY.value}%`;
    managerSlotScaleValue.textContent = `${managerSlotScale.value}%`;
  }

  function updateAudioStatus(config = configs[activeIndex]) {
    if (!managerAudioStatus) return;
    if (config?.audio?.src) {
      managerAudioStatus.textContent = `Template sound attached: ${config.audio.name || "audio file"}. Publish globally to make it public.`;
      return;
    }
    if (config?.audio?.transient) {
      managerAudioStatus.textContent = "This sound was a temporary browser file. Please upload it again before publishing.";
      return;
    }
    if (config?.media?.kind === "video") {
      managerAudioStatus.textContent = "No separate sound uploaded. Template sound mode will use the video original audio.";
      return;
    }
    managerAudioStatus.textContent = "Optional: add music or a sound effect for this template.";
  }

  function syncRuntimeTemplate(index = activeIndex) {
    if (typeof templates === "undefined" || !templates[index] || !configs[index]) return;
    Object.assign(templates[index], configs[index]);
  }

  function previewCameraSlot() {
    const config = configs[activeIndex];
    if (!config) return;
    config.personSlot = {
      ...(config.personSlot || {}),
      x: Number(managerSlotX.value) / 100,
      y: Number(managerSlotY.value) / 100,
      scale: Number(managerSlotScale.value) / 100,
      shape: managerSlotShape.value,
    };
    syncRuntimeTemplate(activeIndex);
    if (maskStyle) maskStyle.value = config.personSlot.shape;
    if (typeof currentTemplate !== "undefined") currentTemplate = activeIndex;
    updateRangeLabels();
  }

  function syncTemplateOptions() {
    managerTemplate.innerHTML = "";
    configs.forEach((config, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = config.name;
      managerTemplate.append(option);
    });
    managerTemplate.value = String(activeIndex);
  }

  function syncTemplateCardLabels() {
    const labels = templateGrid.querySelectorAll(".template-card span");
    configs.forEach((config, index) => {
      if (labels[index]) labels[index].textContent = config.name;
    });
  }

  function populateManager(index = activeIndex) {
    const config = configs[index];
    if (!config) return;
    const copy = copyFields(config);
    const slot = config.personSlot || {};
    activeIndex = index;
    managerTemplate.value = String(index);
    managerName.value = config.name || "";
    managerCategory.value = config.category || "";
    managerTitleZh.value = copy.titleZh;
    managerTitleEn.value = copy.titleEn;
    managerSubZh.value = copy.subZh;
    managerSubEn.value = copy.subEn;
    managerSeal.value = copy.seal;
    managerSlotX.value = Math.round((slot.x ?? 0.5) * 100);
    managerSlotY.value = Math.round((slot.y ?? 0.44) * 100);
    managerSlotScale.value = Math.round((slot.scale ?? 0.76) * 100);
    managerSlotShape.value = slot.shape || "oval";
    managerJson.value = "";
    updateRangeLabels();
    updateAudioStatus(config);
  }

  function applyManager() {
    const config = configs[activeIndex];
    if (!config) return;
    config.name = managerName.value.trim() || config.name;
    config.category = managerCategory.value.trim() || config.category || "custom";
    writeCopy(config);
    config.personSlot = config.personSlot || {};
    config.personSlot.x = Number(managerSlotX.value) / 100;
    config.personSlot.y = Number(managerSlotY.value) / 100;
    config.personSlot.scale = Number(managerSlotScale.value) / 100;
    config.personSlot.shape = managerSlotShape.value;
    syncRuntimeTemplate(activeIndex);
    if (maskStyle) maskStyle.value = managerSlotShape.value;
    saveDrafts();
    syncTemplateOptions();
    syncTemplateCardLabels();
    populateManager(activeIndex);
    setStatus("Template updated");
  }

  function resetManager() {
    const base = baseConfigs[activeIndex];
    if (!base) return;
    Object.keys(configs[activeIndex]).forEach((key) => delete configs[activeIndex][key]);
    Object.assign(configs[activeIndex], clone(base));
    syncRuntimeTemplate(activeIndex);
    if (maskStyle && configs[activeIndex].personSlot?.shape) {
      maskStyle.value = configs[activeIndex].personSlot.shape;
    }
    saveDrafts();
    syncTemplateOptions();
    syncTemplateCardLabels();
    populateManager(activeIndex);
    setStatus("Template reset");
  }

  function exportJson() {
    managerJson.value = JSON.stringify(configs[activeIndex], null, 2);
    managerJson.focus();
    managerJson.select();
    setStatus("Template JSON ready");
  }

  function importJson() {
    try {
      const parsed = JSON.parse(managerJson.value);
      const incoming = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!incoming || typeof incoming !== "object") throw new Error("JSON must be a template object.");
      Object.assign(configs[activeIndex], incoming);
      if (configs[activeIndex].renderer === "uploadedMedia") {
        addRuntimeTemplate(configs[activeIndex], false);
      }
      syncRuntimeTemplate(activeIndex);
      saveDrafts();
      syncTemplateOptions();
      syncTemplateCardLabels();
      populateManager(activeIndex);
      setStatus("Template JSON imported");
    } catch (error) {
      setStatus("JSON import failed");
      alert(`Template JSON could not be imported: ${error.message}`);
    }
  }

  function makeTemplateId(value) {
    const base = String(value || `template-${Date.now()}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return base || `template-${Date.now()}`;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("File could not be read."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image could not be loaded."));
      image.src = src;
    });
  }

  async function imageFileToDataUrl(file) {
    const original = await loadImage(await fileToDataUrl(file));
    const maxSide = 1440;
    const ratio = Math.min(1, maxSide / Math.max(original.naturalWidth, original.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(original.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(original.naturalHeight * ratio));
    canvas.getContext("2d").drawImage(original, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  }

  function defaultUploadedCopy(file, kind) {
    const cleanName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    return {
      titleZh: kind === "video" ? "中国现场" : "中国名场面",
      titleEn: kind === "video" ? "CHINA LIVE SCENE" : "CHINA SCENE MODE",
      subtitleZh: cleanName ? `融入 ${cleanName}` : "一秒融入本地生活",
      subtitleEn: "DROP ME INTO LOCAL CHINA",
      seal: "入",
    };
  }

  async function buildTemplateFromFile(file) {
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const copy = defaultUploadedCopy(file, kind);
    return {
      id: `${makeTemplateId(file.name.replace(/\.[^.]+$/, ""))}-${Date.now()}`,
      name: `${copy.titleZh} / ${copy.titleEn}`,
      category: "uploaded",
      renderer: "uploadedMedia",
      colors: ["#d91417", "#f2c45a", "#111820"],
      copy,
      media: {
        kind,
        name: file.name,
        src: kind === "image" ? await imageFileToDataUrl(file) : URL.createObjectURL(file),
        transient: kind === "video",
      },
      personSlot: { x: 0.5, y: 0.48, scale: 0.76, shape: "full" },
    };
  }

  async function generateFromMedia() {
    const file = managerMediaUpload.files?.[0];
    if (!file) {
      managerMediaStatus.textContent = "Choose an image or video file first.";
      setStatus("Choose media first");
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      managerMediaStatus.textContent = "Please upload an image or video file.";
      setStatus("Unsupported media");
      return;
    }

    managerGenerateFromMedia.disabled = true;
    managerMediaStatus.textContent = "Generating a draft template from this media...";
    try {
      ensureUploadedRenderer();
      const config = await buildTemplateFromFile(file);
      configs.push(config);
      baseConfigs.push(clone(config));
      addRuntimeTemplate(config, true);
      saveDrafts();
      managerMediaStatus.textContent = config.media.transient
        ? "Video template generated for this browser session. Cloud storage will come with the backend."
        : "Image template generated and saved in this browser.";
      setStatus("Template generated");
    } catch (error) {
      managerMediaStatus.textContent = error.message;
      setStatus("Media generation failed");
    } finally {
      managerGenerateFromMedia.disabled = false;
    }
  }

  function attachAudioFile() {
    const file = managerAudioUpload?.files?.[0];
    const config = configs[activeIndex];
    if (!config) return;
    if (!file) {
      updateAudioStatus(config);
      setStatus("Choose sound first");
      return;
    }
    if (!file.type.startsWith("audio/")) {
      managerAudioStatus.textContent = "Please upload an audio file.";
      setStatus("Unsupported sound");
      return;
    }

    if (config.audio?.src?.startsWith?.("blob:")) {
      URL.revokeObjectURL(config.audio.src);
    }

    config.audio = {
      kind: "audio",
      name: file.name,
      type: file.type || "audio/mpeg",
      src: URL.createObjectURL(file),
      transient: true,
    };
    syncRuntimeTemplate(activeIndex);
    saveDrafts();
    updateAudioStatus(config);
    setStatus("Template sound attached");
  }

  function clearAudioFile() {
    const config = configs[activeIndex];
    if (!config) return;
    if (config.audio?.src?.startsWith?.("blob:")) {
      URL.revokeObjectURL(config.audio.src);
    }
    delete config.audio;
    if (managerAudioUpload) managerAudioUpload.value = "";
    syncRuntimeTemplate(activeIndex);
    saveDrafts();
    updateAudioStatus(config);
    setStatus("Template sound cleared");
  }

  ensureUploadedRenderer();
  loadDrafts();
  syncTemplateOptions();
  syncTemplateCardLabels();
  populateManager(0);

  managerToggle.addEventListener("click", () => {
    managerPanel.hidden = !managerPanel.hidden;
    managerToggle.setAttribute("aria-expanded", String(!managerPanel.hidden));
    if (!managerPanel.hidden) populateManager(activeIndex);
  });

  managerTemplate.addEventListener("change", () => {
    activeIndex = Number(managerTemplate.value) || 0;
    populateManager(activeIndex);
  });

  templateGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".template-card");
    if (!card) return;
    const index = Array.from(templateGrid.children).indexOf(card);
    if (index >= 0) {
      activeIndex = index;
      populateManager(index);
    }
  });

  managerApply.addEventListener("click", applyManager);
  managerReset.addEventListener("click", resetManager);
  managerExport.addEventListener("click", exportJson);
  managerImport.addEventListener("click", importJson);
  managerGenerateFromMedia?.addEventListener("click", generateFromMedia);
  managerAudioUpload?.addEventListener("change", attachAudioFile);
  managerClearAudio?.addEventListener("click", clearAudioFile);
  [managerSlotX, managerSlotY, managerSlotScale].forEach((input) => {
    input.addEventListener("input", previewCameraSlot);
  });
  managerSlotShape.addEventListener("change", previewCameraSlot);
})();
