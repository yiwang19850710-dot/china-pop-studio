(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode || window.CHINA_POP_ADMIN_BULK_DELETE) return;
  window.CHINA_POP_ADMIN_BULK_DELETE = true;

  const DEFAULT_REPO = "yiwang19850710-dot/china-pop-studio";
  const DEFAULT_BRANCH = "main";
  const TOKEN_KEY = "china-pop-github-token";
  const SETTINGS_KEY = "china-pop-publish-settings";
  const DELETED_TEMPLATES_KEY = "china-pop-deleted-template-ids-v1";
  const selectedIds = new Set();
  const grid = document.querySelector("#templates");

  if (!grid) return;
  if (document.querySelector("#adminBulkDeletePanel")) return;

  function studioTemplates() {
    try {
      if (typeof templates !== "undefined") return templates;
    } catch (error) {
      return [];
    }
    return [];
  }

  function status(message) {
    try {
      if (typeof setStatus === "function") setStatus(message);
    } catch (error) {
      console.warn("Could not set bulk delete status.", error);
    }
    const publishStatus = document.querySelector("#adminPublishStatus");
    if (publishStatus) publishStatus.textContent = message;
  }

  function selectedTemplates() {
    return studioTemplates().filter((template) => template?.id && selectedIds.has(template.id));
  }

  function deletedIds() {
    try {
      const value = JSON.parse(localStorage.getItem(DELETED_TEMPLATES_KEY) || "[]");
      return Array.isArray(value) ? value.filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function rememberDeleted(id) {
    if (!id) return;
    const next = new Set(deletedIds());
    next.add(id);
    localStorage.setItem(DELETED_TEMPLATES_KEY, JSON.stringify([...next]));
  }

  function removeTemplate(id) {
    if (!id) return;
    selectedIds.delete(id);
    const list = studioTemplates();
    const index = list.findIndex((template) => template?.id === id);
    if (index >= 0) list.splice(index, 1);

    const configs = window.CHINA_POP_TEMPLATE_CONFIGS || [];
    const configIndex = configs.findIndex((template) => template?.id === id);
    if (configIndex >= 0) configs.splice(configIndex, 1);

    try {
      if (typeof baseTemplateSnapshots !== "undefined") {
        const snapshotIndex = baseTemplateSnapshots.findIndex((template) => template?.id === id);
        if (snapshotIndex >= 0) baseTemplateSnapshots.splice(snapshotIndex, 1);
      }
    } catch (error) {
      console.warn("Could not remove template snapshot.", error);
    }
  }

  function refresh(message) {
    try {
      const list = studioTemplates();
      if (typeof currentTemplate !== "undefined") {
        currentTemplate = Math.max(0, Math.min(currentTemplate || 0, list.length - 1));
      }
      if (typeof persistTemplateDrafts === "function") persistTemplateDrafts();
      if (typeof syncTemplateManagerList === "function") syncTemplateManagerList();
      if (typeof populateTemplateManager === "function") populateTemplateManager(currentTemplate || 0);
      if (typeof renderTemplateButtons === "function") renderTemplateButtons();
      if (typeof applyTemplateDefaults === "function") applyTemplateDefaults(currentTemplate || 0);
    } catch (error) {
      console.warn("Could not refresh after bulk delete.", error);
    }
    window.setTimeout(decorate, 0);
    if (message) status(message);
  }

  function updatePanel() {
    const count = selectedTemplates().length;
    const label = document.querySelector("#bulkDeleteCount");
    const localButton = document.querySelector("#bulkDeleteLocal");
    const globalButton = document.querySelector("#bulkDeleteGlobal");
    if (label) label.textContent = `${count} selected / 已选 ${count} 个`;
    if (localButton) localButton.disabled = count === 0;
    if (globalButton) globalButton.disabled = count === 0;

    document.querySelectorAll(".bulk-template-wrap").forEach((wrap) => {
      const checked = selectedIds.has(wrap.dataset.templateId);
      wrap.classList.toggle("is-checked", checked);
      const input = wrap.querySelector("input[type='checkbox']");
      if (input) input.checked = checked;
    });
  }

  function decorate() {
    const list = studioTemplates();
    const liveIds = new Set(list.map((template) => template?.id).filter(Boolean));
    selectedIds.forEach((id) => {
      if (!liveIds.has(id)) selectedIds.delete(id);
    });

    [...grid.querySelectorAll(".template-card")].forEach((card, index) => {
      const template = list[index];
      if (!template?.id) return;

      let wrap = card.closest(".bulk-template-wrap");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "bulk-template-wrap";
        card.before(wrap);
        wrap.append(card);
      }
      wrap.dataset.templateId = template.id;

      let picker = wrap.querySelector(".bulk-template-picker");
      if (!picker) {
        picker = document.createElement("label");
        picker.className = "bulk-template-picker";
        picker.innerHTML = '<input type="checkbox" /><span>选</span>';
        wrap.append(picker);
        picker.addEventListener("pointerdown", (event) => event.stopPropagation());
        picker.addEventListener("click", (event) => event.stopPropagation());
        picker.querySelector("input").addEventListener("change", (event) => {
          event.stopPropagation();
          if (event.currentTarget.checked) selectedIds.add(wrap.dataset.templateId);
          else selectedIds.delete(wrap.dataset.templateId);
          updatePanel();
        });
      }
    });

    updatePanel();
  }

  function installRenderHook() {
    if (typeof renderTemplateButtons !== "function" || renderTemplateButtons.__bulkDeleteHook) {
      decorate();
      return;
    }
    const original = renderTemplateButtons;
    renderTemplateButtons = function renderTemplateButtonsWithBulkDelete(...args) {
      const result = original.apply(this, args);
      window.setTimeout(decorate, 0);
      return result;
    };
    renderTemplateButtons.__bulkDeleteHook = true;
    decorate();
  }

  function installStyles() {
    if (document.querySelector("#bulkDeleteStyles")) return;
    const style = document.createElement("style");
    style.id = "bulkDeleteStyles";
    style.textContent = `
      .bulk-delete-panel {
        display: grid;
        gap: 8px;
        margin: 0 0 12px;
        padding: 10px;
        border: 1px solid rgba(243, 200, 90, 0.38);
        border-radius: 8px;
        background: rgba(243, 200, 90, 0.08);
      }
      .bulk-delete-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      #bulkDeleteCount {
        color: var(--accent);
        font-size: 0.78rem;
        font-weight: 900;
      }
      .bulk-delete-panel button {
        min-height: 34px;
        padding-inline: 10px;
        font-size: 0.78rem;
        font-weight: 850;
      }
      #bulkDeleteGlobal {
        border-color: rgba(232, 76, 61, 0.7);
        color: #fff8f2;
        background: rgba(232, 76, 61, 0.2);
      }
      .bulk-template-wrap {
        position: relative;
        min-width: 0;
      }
      .bulk-template-wrap .template-card {
        width: 100%;
        height: 100%;
      }
      .bulk-template-wrap.is-checked .template-card {
        outline: 2px solid rgba(91, 191, 145, 0.98);
        outline-offset: 2px;
      }
      .bulk-template-picker {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 4;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 28px;
        padding: 4px 7px;
        border: 1px solid rgba(249, 244, 232, 0.54);
        border-radius: 999px;
        color: var(--ink);
        background: rgba(5, 8, 10, 0.78);
        cursor: pointer;
      }
      .bulk-template-picker input {
        width: 16px;
        height: 16px;
        accent-color: var(--green);
      }
      .bulk-template-picker span {
        min-height: 0;
        font-size: 0.72rem;
        font-weight: 900;
        line-height: 1;
      }
    `;
    document.head.append(style);
  }

  function installPanel() {
    if (document.querySelector("#bulkDeletePanel")) return;
    const section = grid.closest("section");
    if (!section) return;
    const panel = document.createElement("div");
    panel.className = "bulk-delete-panel";
    panel.id = "bulkDeletePanel";
    panel.innerHTML = `
      <strong id="bulkDeleteCount">0 selected / 已选 0 个</strong>
      <div class="bulk-delete-row">
        <button id="bulkSelectAll" type="button">Select all / 全选</button>
        <button id="bulkClear" type="button">Clear / 取消</button>
      </div>
      <button id="bulkDeleteLocal" type="button" disabled>Delete checked from admin / 删除勾选</button>
      <button id="bulkDeleteGlobal" type="button" disabled>Delete checked globally / 全网删除勾选</button>
    `;
    section.insertBefore(panel, grid);

    panel.querySelector("#bulkSelectAll").addEventListener("click", () => {
      studioTemplates().forEach((template) => {
        if (template?.id) selectedIds.add(template.id);
      });
      decorate();
    });
    panel.querySelector("#bulkClear").addEventListener("click", () => {
      selectedIds.clear();
      decorate();
    });
    panel.querySelector("#bulkDeleteLocal").addEventListener("click", deleteCheckedLocal);
    panel.querySelector("#bulkDeleteGlobal").addEventListener("click", deleteCheckedGlobal);
  }

  function deleteCheckedLocal() {
    const picked = selectedTemplates();
    const list = studioTemplates();
    if (!picked.length) {
      status("No checked templates");
      return;
    }
    if (picked.length >= list.length) {
      status("Keep at least one template");
      return;
    }
    if (!window.confirm(`Delete ${picked.length} checked templates from this admin list?`)) return;
    picked.forEach((template) => {
      rememberDeleted(template.id);
      removeTemplate(template.id);
    });
    selectedIds.clear();
    refresh(`${picked.length} templates deleted from admin list`);
  }

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function publishForm() {
    const settings = readSettings();
    return {
      token: document.querySelector("#adminGithubToken")?.value.trim()
        || localStorage.getItem(TOKEN_KEY)
        || sessionStorage.getItem(TOKEN_KEY)
        || "",
      repo: document.querySelector("#adminGithubRepo")?.value.trim() || settings.repo || DEFAULT_REPO,
      branch: document.querySelector("#adminGithubBranch")?.value.trim() || settings.branch || DEFAULT_BRANCH,
    };
  }

  function headers(token) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  function textToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  function base64ToText(base64) {
    const binary = atob(base64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function githubError(response) {
    try {
      return (await response.json()).message || `GitHub error ${response.status}`;
    } catch (error) {
      return `GitHub error ${response.status}`;
    }
  }

  async function readGithubFile(form, path) {
    const url = `https://api.github.com/repos/${form.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(form.branch)}`;
    const response = await fetch(url, { headers: headers(form.token) });
    if (!response.ok) throw new Error(await githubError(response));
    const payload = await response.json();
    return { sha: payload.sha, text: base64ToText(payload.content || "") };
  }

  async function writeGithubFile(form, path, text, message, sha) {
    const response = await fetch(`https://api.github.com/repos/${form.repo}/contents/${encodePath(path)}`, {
      method: "PUT",
      headers: { ...headers(form.token), "Content-Type": "application/json" },
      body: JSON.stringify({ message, branch: form.branch, content: textToBase64(text), sha }),
    });
    if (!response.ok) throw new Error(await githubError(response));
  }

  function extractPublishedTemplates(source) {
    const marker = "const publishedTemplates =";
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    const arrayEnd = source.indexOf(";\n\n  const mediaElementCache", arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) return [];
    return Function(`"use strict"; return (${source.slice(arrayStart, arrayEnd)});`)();
  }

  function replacePublishedTemplates(source, list) {
    const marker = "const publishedTemplates =";
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    const arrayEnd = source.indexOf(";\n\n  const mediaElementCache", arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) throw new Error("Could not read published template list.");
    const json = JSON.stringify(list, null, 4).replace(/</g, "\\u003c");
    return `${source.slice(0, arrayStart)}${json}${source.slice(arrayEnd)}`;
  }

  async function deleteCheckedGlobal() {
    const picked = selectedTemplates();
    if (!picked.length) {
      status("No checked templates");
      return;
    }
    const form = publishForm();
    if (!form.token) {
      status("Add a GitHub token first.");
      return;
    }
    if (!window.confirm(`Delete ${picked.length} checked templates from public users?`)) return;

    const button = document.querySelector("#bulkDeleteGlobal");
    if (button) button.disabled = true;
    try {
      status("Updating public template list...");
      const file = await readGithubFile(form, "published-templates.js");
      const ids = new Set(picked.map((template) => template.id));
      const current = extractPublishedTemplates(file.text);
      const next = current.filter((template) => !ids.has(template?.id));
      const removed = current.length - next.length;
      if (!removed) {
        status("Checked templates were not in the global published list.");
        return;
      }
      await writeGithubFile(
        form,
        "published-templates.js",
        replacePublishedTemplates(file.text, next),
        `Delete ${removed} published templates`,
        file.sha,
      );
      picked.forEach((template) => {
        rememberDeleted(template.id);
        removeTemplate(template.id);
      });
      selectedIds.clear();
      refresh(`Deleted ${removed} globally. Public users should see it after GitHub Pages updates in 1-3 minutes.`);
    } catch (error) {
      console.warn("Bulk global delete failed.", error);
      status(`Delete failed: ${error.message}`);
    } finally {
      updatePanel();
    }
  }

  installStyles();
  installPanel();
  installRenderHook();
})();
