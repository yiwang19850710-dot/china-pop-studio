(() => {
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
