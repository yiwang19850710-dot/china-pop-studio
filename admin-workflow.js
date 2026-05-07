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
      <button id="adminSaveTemplate" type="button">Save template changes</button>
      <button id="adminPreviewTemplate" type="button">Show on public preview</button>
      <p>Upload media, adjust text and camera position, then save. Public one-click publishing will connect to the backend; JSON is only kept as an advanced backup tool.</p>
    `;
    const mediaGenerator = panel.querySelector(".media-generator");
    mediaGenerator?.after(row);

    row.querySelector("#adminSaveTemplate")?.addEventListener("click", () => {
      applyButton.click();
      setAppStatus("Template saved");
    });

    row.querySelector("#adminPreviewTemplate")?.addEventListener("click", () => {
      applyButton.click();
      setAppStatus("Template available in this browser");
      window.history.replaceState(null, "", window.location.pathname);
    });
  }

  function polishUploadCopy() {
    if (generateButton) generateButton.textContent = "Create template from media";
    if (uploadStatus) {
      uploadStatus.textContent = "Upload a template image or short video. The system will create an editable template automatically.";
    }
    if (uploadInput) uploadInput.setAttribute("capture", "environment");
    if (resetButton) resetButton.textContent = "Reset current template";
    applyButton.textContent = "Apply to preview";
  }

  polishUploadCopy();
  addSaveWorkflow();
  moveJsonTools();
})();
