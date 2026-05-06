(() => {
  const publishedTemplates = [
    {
      id: "il-famoso-xi-jinping-1778097968668",
      name: "Test",
      category: "uploaded",
      renderer: "uploadedMedia",
      colors: ["#d91417", "#f2c45a", "#111820"],
      copy: {
        titleZh: "",
        titleEn: "",
        subtitleZh: "",
        subtitleEn: "",
        seal: "",
      },
      media: {
        kind: "video",
        name: "Il famoso xi jinping.mp4",
        src: "assets/templates/Il famoso xi jinping.mp4",
        transient: false,
      },
      personSlot: {
        x: 0.59,
        y: 0.38,
        scale: 1,
        shape: "full",
      },
    },
  ];

  const mediaElementCache = new Map();

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

  function installRenderer() {
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

  function mediaCanLoad(config) {
    return new Promise((resolve) => {
      if (!config.media?.src) {
        resolve(false);
        return;
      }
      const timer = window.setTimeout(() => resolve(false), 5000);
      const element = config.media.kind === "video" ? document.createElement("video") : new Image();
      element.onload = () => {
        window.clearTimeout(timer);
        resolve(true);
      };
      element.onloadedmetadata = () => {
        window.clearTimeout(timer);
        resolve(true);
      };
      element.onerror = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
      element.src = config.media.src;
      if (config.media.kind === "video") element.load();
    });
  }

  async function addPublishedTemplates() {
    if (!installRenderer() || typeof templates === "undefined") return;
    for (const config of publishedTemplates) {
      if (templates.some((template) => template.id === config.id)) continue;
      const canLoad = await mediaCanLoad(config);
      if (!canLoad) continue;
      window.CHINA_POP_TEMPLATE_CONFIGS?.push(config);
      templates.push(makeRuntimeTemplate(config));
    }
    if (typeof renderTemplateButtons === "function") renderTemplateButtons();
  }

  addPublishedTemplates();
})();
