(() => {
  if (window.CHINA_POP_TEMPLATE_CLEANUP) return;
  window.CHINA_POP_TEMPLATE_CLEANUP = true;

  const STORAGE_KEY = "china-pop-template-drafts-v1";

  function runtimeTemplates() {
    try {
      if (typeof templates !== "undefined") return templates;
    } catch (error) {
      return [];
    }
    return [];
  }

  function runtimeSnapshots() {
    try {
      if (typeof baseTemplateSnapshots !== "undefined") return baseTemplateSnapshots;
    } catch (error) {
      return [];
    }
    return [];
  }

  function normalizedTemplateValue(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[?#].*$/, "")
      .replace(/\\/g, "/")
      .replace(/\s+/g, " ")
      .trim();
  }

  function templateKey(template) {
    if (!template?.id) return "";
    if (template.renderer === "uploadedMedia") {
      const mediaName = normalizedTemplateValue(template.media?.name);
      if (mediaName) return `uploaded-name:${mediaName}`;
      const mediaSource = normalizedTemplateValue(template.media?.src);
      if (mediaSource && !mediaSource.startsWith("blob:") && !mediaSource.startsWith("data:")) {
        return `uploaded-src:${mediaSource}`;
      }
    }
    return `id:${template.id}`;
  }

  function isPublishedAsset(template) {
    const src = String(template?.media?.src || "");
    return Boolean(src && !template?.media?.transient && !src.startsWith("blob:") && !src.startsWith("data:"));
  }

  function preferTemplate(candidate, current) {
    const candidatePublished = isPublishedAsset(candidate);
    const currentPublished = isPublishedAsset(current);
    if (candidatePublished !== currentPublished) return candidatePublished;
    return true;
  }

  function dedupeList(list) {
    if (!Array.isArray(list) || list.length < 2) return 0;
    const keepByKey = new Map();
    list.forEach((template, index) => {
      const key = templateKey(template);
      if (!key) return;
      const currentIndex = keepByKey.get(key);
      if (currentIndex === undefined || preferTemplate(template, list[currentIndex])) {
        keepByKey.set(key, index);
      }
    });
    const keep = new Set(keepByKey.values());
    let removed = 0;
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const key = templateKey(list[index]);
      if (key && !keep.has(index)) {
        list.splice(index, 1);
        removed += 1;
      }
    }
    return removed;
  }

  function persistDrafts() {
    const list = runtimeTemplates();
    if (!list.length) return;
    try {
      const clean = list.map((template) => {
        const { draw, ...config } = template;
        const next = JSON.parse(JSON.stringify(config));
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
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (error) {
      console.warn("Template cleanup could not save drafts.", error);
    }
  }

  function refreshUi() {
    try {
      if (typeof currentTemplate !== "undefined") {
        currentTemplate = Math.min(currentTemplate || 0, Math.max(0, runtimeTemplates().length - 1));
      }
      if (typeof syncTemplateManagerList === "function") syncTemplateManagerList();
      if (typeof populateTemplateManager === "function") populateTemplateManager(currentTemplate || 0);
      if (typeof renderTemplateButtons === "function") renderTemplateButtons();
    } catch (error) {
      console.warn("Template cleanup could not refresh UI.", error);
    }
  }

  function cleanup() {
    try {
      const removedHidden = window.CHINA_POP_HIDDEN_TEMPLATES?.apply?.({ render: false }) || 0;
      const removedTemplates = dedupeList(runtimeTemplates());
      const removedConfigs = dedupeList(window.CHINA_POP_TEMPLATE_CONFIGS);
      dedupeList(runtimeSnapshots());
      const totalRemoved = removedHidden + removedTemplates + removedConfigs;
      if (totalRemoved) {
        persistDrafts();
        refreshUi();
      }
      return totalRemoved;
    } catch (error) {
      console.warn("Template cleanup could not run.", error);
      return 0;
    }
  }

  window.CHINA_POP_TEMPLATE_CLEANUP_API = { cleanup };
  cleanup();
  let ticks = 0;
  const timer = window.setInterval(() => {
    ticks += 1;
    cleanup();
    if (ticks >= 12) window.clearInterval(timer);
  }, 500);
})();
