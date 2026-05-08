(() => {
  if (window.CHINA_POP_HIDDEN_TEMPLATES?.apply) {
    window.CHINA_POP_HIDDEN_TEMPLATES.install?.();
    window.CHINA_POP_HIDDEN_TEMPLATES.apply();
    return;
  }

  const script = document.createElement("script");
  script.src = `hidden-templates.js?v=${Date.now()}`;
  script.async = false;
  script.onerror = () => {
    try {
      if (typeof setStatus === "function") setStatus("Hidden template list unavailable");
    } catch (error) {
      console.warn("Hidden template list could not load.", error);
    }
  };
  (document.currentScript || document.body.lastElementChild)?.after(script);
})();
