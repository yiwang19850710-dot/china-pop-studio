(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode) return;

  const panel = document.querySelector("#templateManagerPanel");
  const applyButton = document.querySelector("#managerApply");
  const resetButton = document.querySelector("#managerReset");
  const exportButton = document.querySelector("#managerExport");
  const importButton = document.querySelector("#managerImport");
  const jsonField = document.querySelector("#managerJson");
  const uploadStatus = document.querySelector("#managerMediaStatus");
  const generateButton = document.querySelector("#managerGenerateFromMedia");
  const uploadInput = document.querySelector("#managerMediaUpload");

  if (!panel || !applyButton) return;

  function setAppStatus(message) {
    try {
      if (typeof setStatus === "function") setStatus(message);
    } catch (error) {
      console.warn("Could not update admin status.", error);
    }
  }

  function moveJsonTools() {
    const jsonLabel = jsonField?.closest("label");
    if (!jsonLabel || !exportButton || !importButton) return;

    const details = document.createElement("details");
    details.className = "admin-json-tools";
    details.innerHTML = "<summary>Advanced JSON tools</summary>";

    const actionRow = document.createElement("div");
    actionRow.className = "manager-actions";
    actionRow.append(exportButton, importButton);
    details.append(actionRow, jsonLabel);
    panel.append(details);
  }

  function addSaveWorkflow() {
    if (document.querySelector(".admin-save-row")) return;
    const row = document.createElement("div");
    row.className = "admin-save-row";
    row.innerHTML = `
      <button id="adminSaveTemplate" type="button">Save draft in this browser / 保存本机草稿</button>
      <button id="adminPreviewTemplate" type="button">Preview as user / 用户预览</button>
      <p>Apply or save keeps the template in this browser first. To make it visible to every public user, I still need to publish the saved template to GitHub until we add a real backend.</p>
    `;
    const mediaGenerator = panel.querySelector(".media-generator");
    mediaGenerator?.after(row);

    row.querySelector("#adminSaveTemplate")?.addEventListener("click", () => {
      applyButton.click();
      setAppStatus("Draft saved in this browser");
    });

    row.querySelector("#adminPreviewTemplate")?.addEventListener("click", () => {
      applyButton.click();
      setAppStatus("Opening user preview");
      const url = new URL(window.location.href);
      url.searchParams.delete("admin");
      url.hash = "";
      window.open(url.toString(), "_blank") || window.location.assign(url.toString());
    });
  }

  function polishUploadCopy() {
    if (generateButton) generateButton.textContent = "Create template from media";
    if (uploadStatus) {
      uploadStatus.textContent = "Upload a template image or short video. The system will create an editable template automatically.";
    }
    if (uploadInput) uploadInput.removeAttribute("capture");
    if (resetButton) resetButton.textContent = "Reset current template";
    applyButton.textContent = "Apply + save draft";
    applyButton.addEventListener("click", () => {
      window.setTimeout(() => setAppStatus("Draft saved in this browser"), 20);
    });
  }

  polishUploadCopy();
  addSaveWorkflow();
  moveJsonTools();
})();
