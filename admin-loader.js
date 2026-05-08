(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode) return;

  function loadStyle(href) {
    return new Promise((resolve) => {
      if (document.querySelector(`link[href="${href}"]`)) {
        resolve();
        return;
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.append(link);
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.append(script);
    });
  }

  async function loadAdmin() {
    try {
      await loadStyle("media-upload.css?v=2");
      await loadScript("admin.js?v=3");
      await loadScript("media-upload.js?v=4");
      await loadScript("admin-fixes.js?v=4");
      await loadScript("admin-workflow.js?v=3");
      await loadScript("admin-publish.js?v=3");
      await loadScript("admin-publish-retry.js?v=1");
      await loadScript("admin-delete.js?v=2");
      await loadScript("admin-global-hide-fix.js?v=2");
      await loadScript("admin-bulk-delete.js?v=5");
      await loadScript("admin-delete-unify.js?v=1");
    } catch (error) {
      console.warn("Admin tools could not load.", error);
      const status = document.querySelector("#status");
      if (status) status.textContent = "Admin load failed";
    }
  }

  loadAdmin();
})();
