(() => {
  const script = document.createElement("script");
  script.src = `published-templates.js?v=${Date.now()}`;
  script.async = false;
  script.onerror = () => {
    try {
      if (typeof setStatus === "function") setStatus("Published templates unavailable");
    } catch (error) {
      console.warn("Published templates could not load.", error);
    }
  };
  (document.currentScript || document.body.lastElementChild)?.after(script);
})();
