(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode || window.CHINA_POP_APP_HAS_BUILTIN_MANAGER) return;

  const STORAGE_KEY = "china-pop-template-drafts-v1";
  const uploadInput = document.querySelector("#managerMediaUpload");
  const generateButton = document.querySelector("#managerGenerateFromMedia");
  const uploadStatus = document.querySelector("#managerMediaStatus");
  const managerTemplate = document.querySelector("#managerTemplate");
  const maskStyle = document.querySelector("#maskStyle");
  const mediaElementCache = new Map();

  if (!uploadInput || !generateButton || !uploadStatus) return;

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

  function makeTemplateId(value) {
    const base = String(value || `template-${Date.now()}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return base || `template-${Date.now()}`;
  }

  function setStatus(message) {
    if (typeof statusEl !== "undefined") statusEl.textContent = message;
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
    return next;
  }

  function saveDrafts() {
    try {
      const configs = window.CHINA_POP_TEMPLATE_CONFIGS || [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs.map(persistableConfig)));
    } catch (error) {
      console.warn("Could not save media template draft.", error);
    }
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
      drawSceneCaption(ctx, w, h, titleZh, titleEn, subtitleZh, subtitleEn);
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

  function addTemplate(config) {
    const configs = window.CHINA_POP_TEMPLATE_CONFIGS || [];
    configs.push(config);
    if (typeof templates !== "undefined" && ensureUploadedRenderer()) {
      templates.push(makeRuntimeTemplate(config));
      if (typeof currentTemplate !== "undefined") currentTemplate = templates.length - 1;
    }
    if (maskStyle && config.personSlot?.shape) maskStyle.value = config.personSlot.shape;
    if (typeof renderTemplateButtons === "function") renderTemplateButtons();

    if (managerTemplate) {
      const option = document.createElement("option");
      option.value = String(configs.length - 1);
      option.textContent = config.name;
      managerTemplate.append(option);
      managerTemplate.value = option.value;
      managerTemplate.dispatchEvent(new Event("change", { bubbles: true }));
    }
    saveDrafts();
  }

  function defaultCopy(file, kind) {
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
    const copy = defaultCopy(file, kind);
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
    const file = uploadInput.files?.[0];
    if (!file) {
      uploadStatus.textContent = "Choose an image or video file first.";
      setStatus("Choose media first");
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      uploadStatus.textContent = "Please upload an image or video file.";
      setStatus("Unsupported media");
      return;
    }

    generateButton.disabled = true;
    uploadStatus.textContent = "Generating a draft template from this media...";
    try {
      ensureUploadedRenderer();
      const config = await buildTemplateFromFile(file);
      addTemplate(config);
      uploadStatus.textContent = config.media.transient
        ? "Video template generated for this browser session. Cloud storage will come with the backend."
        : "Image template generated and saved in this browser.";
      setStatus("Template generated");
    } catch (error) {
      uploadStatus.textContent = error.message;
      setStatus("Media generation failed");
    } finally {
      generateButton.disabled = false;
    }
  }

  ensureUploadedRenderer();
  generateButton.addEventListener("click", generateFromMedia);
})();
