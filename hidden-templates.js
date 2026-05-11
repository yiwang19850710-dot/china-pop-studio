(() => {
  if (window.CHINA_POP_HIDDEN_TEMPLATES?.ready) {
    window.CHINA_POP_HIDDEN_TEMPLATES.install?.();
    window.CHINA_POP_HIDDEN_TEMPLATES.apply?.();
    return;
  }

  const hiddenTemplateIds = [
  "bellypark",
  "evening",
  "gumo-und-nihao-1778272664350",
  "gumo-und-nihao-1778272664384",
  "gumo-und-nihao-1778272718374",
  "gumo-und-nihao-1778272718383",
  "gumo-und-nihao-1778274101677",
  "gumo-und-nihao-1778274101732",
  "gumo-und-nihao-1778275214465",
  "gumo-und-nihao-1778275219787",
  "gumo-zusammen-1778532612537",
  "gumo-zusammen-1778532618684",
  "horseyear",
  "morning",
  "neon",
  "noon",
  "opera",
  "porcelain",
  "squaredance"
];
  window.CHINA_POP_HIDDEN_TEMPLATE_IDS = hiddenTemplateIds;

  const hiddenTemplateIdSet = new Set(hiddenTemplateIds);
  let applying = false;

  function runtimeTemplates() {
    try {
      if (typeof templates !== "undefined") return templates;
    } catch (error) {
      return [];
    }
    return [];
  }

  function removeFromList(list, idSet) {
    let removed = 0;
    if (!Array.isArray(list)) return removed;
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (idSet.has(list[index]?.id)) {
        list.splice(index, 1);
        removed += 1;
      }
    }
    return removed;
  }

  function removeSnapshots(idSet) {
    try {
      if (typeof baseTemplateSnapshots !== "undefined") removeFromList(baseTemplateSnapshots, idSet);
    } catch (error) {
      console.warn("Could not hide template snapshots.", error);
    }
  }

  function refreshAfterHide(shouldRender) {
    try {
      const list = runtimeTemplates();
      if (typeof currentTemplate !== "undefined") {
        currentTemplate = Math.max(0, Math.min(currentTemplate || 0, Math.max(0, list.length - 1)));
      }
      if (typeof syncTemplateManagerList === "function") syncTemplateManagerList();
      if (typeof populateTemplateManager === "function" && list.length) populateTemplateManager(currentTemplate || 0);
      if (shouldRender && typeof renderTemplateButtons === "function") renderTemplateButtons();
      if (typeof applyTemplateDefaults === "function" && list.length) applyTemplateDefaults(currentTemplate || 0);
    } catch (error) {
      console.warn("Could not refresh hidden templates.", error);
    }
  }

  function applyHiddenTemplates(options = {}) {
    if (applying || !hiddenTemplateIdSet.size) return 0;
    applying = true;
    try {
      installRenderHook();
      let removed = 0;
      removed += removeFromList(runtimeTemplates(), hiddenTemplateIdSet);
      removed += removeFromList(window.CHINA_POP_TEMPLATE_CONFIGS, hiddenTemplateIdSet);
      removeSnapshots(hiddenTemplateIdSet);
      if (removed) refreshAfterHide(options.render !== false);
      return removed;
    } finally {
      applying = false;
    }
  }

  function installRenderHook() {
    if (typeof renderTemplateButtons !== "function" || renderTemplateButtons.__hiddenTemplateHook) return;
    const originalRenderTemplateButtons = renderTemplateButtons;
    renderTemplateButtons = function renderTemplateButtonsWithHiddenTemplates(...args) {
      applyHiddenTemplates({ render: false });
      return originalRenderTemplateButtons.apply(this, args);
    };
    renderTemplateButtons.__hiddenTemplateHook = true;
  }

  function watchForLatePublishedTemplates() {
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      applyHiddenTemplates();
      if (ticks >= 24) window.clearInterval(timer);
    }, 250);
  }

  window.CHINA_POP_HIDDEN_TEMPLATES = {
    ready: true,
    ids: hiddenTemplateIds,
    install: installRenderHook,
    apply: applyHiddenTemplates,
  };

  installRenderHook();
  applyHiddenTemplates();
  window.setTimeout(() => {
    installRenderHook();
    applyHiddenTemplates();
  }, 0);
  watchForLatePublishedTemplates();
})();
