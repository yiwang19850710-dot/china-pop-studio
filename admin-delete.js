(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode || window.CHINA_POP_ADMIN_DELETE) return;
  window.CHINA_POP_ADMIN_DELETE = true;

  const DEFAULT_REPO = "yiwang19850710-dot/china-pop-studio";
  const DEFAULT_BRANCH = "main";
  const TOKEN_KEY = "china-pop-github-token";
  const SETTINGS_KEY = "china-pop-publish-settings";
  const DELETED_TEMPLATES_KEY = "china-pop-deleted-template-ids-v1";

  const panel = document.querySelector("#templateManagerPanel");
  const managerTemplate = document.querySelector("#managerTemplate");

  if (!panel || !managerTemplate) return;

  function setAppStatus(message) {
    try {
      if (typeof setStatus === "function") setStatus(message);
    } catch (error) {
      console.warn("Could not update delete status.", error);
    }
  }

  function getStudioTemplates() {
    try {
      if (typeof templates !== "undefined") return templates;
    } catch (error) {
      return [];
    }
    return [];
  }

  function getSelectedIndex() {
    const index = Number(managerTemplate.value);
    return Number.isInteger(index) ? index : 0;
  }

  function getSelectedTemplate() {
    const studioTemplates = getStudioTemplates();
    const studioTemplate = studioTemplates[getSelectedIndex()];
    if (studioTemplate) return studioTemplate;
    return (window.CHINA_POP_STUDIO?.getTemplates?.() || [])[getSelectedIndex()] || null;
  }

  function getDeletedTemplateIds() {
    try {
      const ids = JSON.parse(localStorage.getItem(DELETED_TEMPLATES_KEY) || "[]");
      return Array.isArray(ids) ? ids.filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function saveDeletedTemplateId(id) {
    if (!id) return;
    const ids = new Set(getDeletedTemplateIds());
    ids.add(id);
    localStorage.setItem(DELETED_TEMPLATES_KEY, JSON.stringify([...ids]));
  }

  function removeTemplateById(id) {
    if (!id) return false;
    let removed = false;

    try {
      const studioTemplates = getStudioTemplates();
      const index = studioTemplates.findIndex((template) => template?.id === id);
      if (index >= 0) {
        studioTemplates.splice(index, 1);
        removed = true;
      }
    } catch (error) {
      console.warn("Could not remove runtime template.", error);
    }

    try {
      const configs = window.CHINA_POP_TEMPLATE_CONFIGS || [];
      const index = configs.findIndex((template) => template?.id === id);
      if (index >= 0) {
        configs.splice(index, 1);
        removed = true;
      }
    } catch (error) {
      console.warn("Could not remove template config.", error);
    }

    try {
      if (typeof baseTemplateSnapshots !== "undefined") {
        const index = baseTemplateSnapshots.findIndex((template) => template?.id === id);
        if (index >= 0) baseTemplateSnapshots.splice(index, 1);
      }
    } catch (error) {
      console.warn("Could not remove template snapshot.", error);
    }

    return removed;
  }

  function refreshTemplateUi(message) {
    try {
      const studioTemplates = getStudioTemplates();
      if (typeof currentTemplate !== "undefined") {
        currentTemplate = Math.max(0, Math.min(currentTemplate || 0, studioTemplates.length - 1));
      }
      if (typeof persistTemplateDrafts === "function") persistTemplateDrafts();
      if (typeof syncTemplateManagerList === "function") syncTemplateManagerList();
      if (typeof populateTemplateManager === "function") populateTemplateManager(currentTemplate || 0);
      if (typeof renderTemplateButtons === "function") renderTemplateButtons();
      if (typeof applyTemplateDefaults === "function") applyTemplateDefaults(currentTemplate || 0);
    } catch (error) {
      console.warn("Could not refresh template list.", error);
    }
    if (message) setAppStatus(message);
  }

  function deleteFromAdminList() {
    const studioTemplates = getStudioTemplates();
    if (studioTemplates.length <= 1) {
      setAppStatus("At least one template is required");
      return;
    }

    const template = getSelectedTemplate();
    if (!template?.id) {
      setAppStatus("No template selected");
      return;
    }

    const ok = window.confirm(`Delete "${template.name}" from this admin list?`);
    if (!ok) return;

    saveDeletedTemplateId(template.id);
    removeTemplateById(template.id);
    refreshTemplateUi("Template deleted from admin list");
  }

  function applyDeletedTemplateIds() {
    const ids = getDeletedTemplateIds();
    if (!ids.length) return;
    let removed = false;
    ids.forEach((id) => {
      removed = removeTemplateById(id) || removed;
    });
    if (removed) refreshTemplateUi();
  }

  function addAdminDeleteButton() {
    if (document.querySelector("#adminDeleteTemplate")) return;
    const button = document.createElement("button");
    button.id = "adminDeleteTemplate";
    button.type = "button";
    button.textContent = "Delete from admin list / 删除当前模板";
    button.addEventListener("click", deleteFromAdminList);

    const saveRow = panel.querySelector(".admin-save-row");
    if (saveRow) saveRow.insertBefore(button, saveRow.querySelector("p"));
    else panel.prepend(button);
  }

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function getPublishForm() {
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

  function encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  function githubHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function textToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
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
      const payload = await response.json();
      return payload.message || `GitHub error ${response.status}`;
    } catch (error) {
      return `GitHub error ${response.status}`;
    }
  }

  async function readGithubFile(repo, path, branch, token) {
    const url = `https://api.github.com/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`;
    const response = await fetch(url, { headers: githubHeaders(token) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await githubError(response));
    const payload = await response.json();
    return {
      sha: payload.sha,
      text: payload.content ? base64ToText(payload.content) : "",
    };
  }

  async function writeGithubFile(repo, path, branch, token, text, message, sha) {
    const body = { message, branch, content: textToBase64(text) };
    if (sha) body.sha = sha;
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${encodePath(path)}`, {
      method: "PUT",
      headers: {
        ...githubHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await githubError(response));
    return response.json();
  }

  function extractPublishedTemplates(source) {
    const marker = "const publishedTemplates =";
    const start = source.indexOf(marker);
    if (start < 0) return [];
    const arrayStart = source.indexOf("[", start);
    const arrayEnd = source.indexOf(";\n\n  const mediaElementCache", arrayStart);
    if (arrayStart < 0 || arrayEnd < 0) return [];
    const literal = source.slice(arrayStart, arrayEnd);
    const parsed = Function(`"use strict"; return (${literal});`)();
    return Array.isArray(parsed) ? parsed : [];
  }

  function replacePublishedTemplates(source, list) {
    const marker = "const publishedTemplates =";
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    const arrayEnd = source.indexOf(";\n\n  const mediaElementCache", arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) {
      throw new Error("Could not read published template list.");
    }
    const json = JSON.stringify(list, null, 4).replace(/</g, "\\u003c");
    return `${source.slice(0, arrayStart)}${json}${source.slice(arrayEnd)}`;
  }

  function setPublishStatus(message) {
    const status = document.querySelector("#adminPublishStatus");
    if (status) status.textContent = message;
    setAppStatus(message);
  }

  async function deleteGlobally() {
    const template = getSelectedTemplate();
    if (!template?.id) {
      setPublishStatus("No template selected.");
      return;
    }

    const form = getPublishForm();
    if (!form.token) {
      setPublishStatus("Add a GitHub token first.");
      return;
    }

    const ok = window.confirm(`Delete "${template.name}" from public users?`);
    if (!ok) {
      setPublishStatus("Delete cancelled.");
      return;
    }

    const button = document.querySelector("#adminDeletePublishedTemplate");
    if (button) button.disabled = true;
    try {
      setPublishStatus("Updating public template list...");
      const publishedFile = await readGithubFile(form.repo, "published-templates.js", form.branch, form.token);
      const currentList = publishedFile?.text ? extractPublishedTemplates(publishedFile.text) : [];
      const nextList = currentList.filter((item) => item?.id !== template.id);
      if (nextList.length === currentList.length) {
        setPublishStatus("This template was not in the global published list.");
        return;
      }
      const nextSource = replacePublishedTemplates(publishedFile.text, nextList);
      await writeGithubFile(
        form.repo,
        "published-templates.js",
        form.branch,
        form.token,
        nextSource,
        `Delete published template ${template.name}`,
        publishedFile.sha,
      );
      removeTemplateById(template.id);
      saveDeletedTemplateId(template.id);
      refreshTemplateUi("Deleted globally. Public users should see it after GitHub Pages updates in 1-3 minutes.");
    } catch (error) {
      console.warn("Global template delete failed.", error);
      setPublishStatus(`Delete failed: ${error.message}`);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function addGlobalDeleteButton() {
    const publishPanel = document.querySelector("#adminPublishPanel");
    if (!publishPanel || document.querySelector("#adminDeletePublishedTemplate")) return;

    const button = document.createElement("button");
    button.id = "adminDeletePublishedTemplate";
    button.type = "button";
    button.textContent = "Delete globally / 全网删除当前模板";
    button.addEventListener("click", deleteGlobally);
    publishPanel.insertBefore(button, publishPanel.querySelector("details"));
  }

  applyDeletedTemplateIds();
  addAdminDeleteButton();
  addGlobalDeleteButton();
})();
