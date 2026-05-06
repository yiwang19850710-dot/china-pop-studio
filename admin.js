(() => {
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
  const templateGrid = document.querySelector("#templates");
  const maskStyle = document.querySelector("#maskStyle");
  const status = document.querySelector("#status");

  let activeIndex = 0;

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveDrafts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
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
        if (index < 0) return;
        Object.assign(configs[index], draft);
      });
    } catch (error) {
      console.warn("Could not load template drafts.", error);
    }
  }

  function copyFields(config) {
    const copy = config.copy || {};
    return {
      titleZh: copy.titleZh || copy.greeting || "",
      titleEn: copy.titleEn || copy.greetingEn || "",
      subZh: copy.subtitleZh || copy.sub || "",
      subEn: copy.subtitleEn || copy.subEn || "",
      seal: copy.seal || "",
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
    config.copy.seal = managerSeal.value.trim() || copyFields(config).seal || "福";
  }

  function updateRangeLabels() {
    managerSlotXValue.textContent = `${managerSlotX.value}%`;
    managerSlotYValue.textContent = `${managerSlotY.value}%`;
    managerSlotScaleValue.textContent = `${managerSlotScale.value}%`;
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
    managerSlotX.value = Math.round((slot.x || 0.5) * 100);
    managerSlotY.value = Math.round((slot.y || 0.44) * 100);
    managerSlotScale.value = Math.round((slot.scale || 0.76) * 100);
    managerSlotShape.value = slot.shape || "oval";
    managerJson.value = "";
    updateRangeLabels();
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
  [managerSlotX, managerSlotY, managerSlotScale].forEach((input) => {
    input.addEventListener("input", updateRangeLabels);
  });
})();
