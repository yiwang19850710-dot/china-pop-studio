(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode || window.CHINA_POP_ADMIN_GLOBAL_HIDE_FIX) return;
  window.CHINA_POP_ADMIN_GLOBAL_HIDE_FIX = true;

  const DEFAULT_REPO = "yiwang19850710-dot/china-pop-studio";
  const DEFAULT_BRANCH = "main";
  const TOKEN_KEY = "china-pop-github-token";
  const SETTINGS_KEY = "china-pop-publish-settings";

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
      console.warn("Could not set global hide status.", error);
    }
    const publishStatus = document.querySelector("#adminPublishStatus");
    if (publishStatus) publishStatus.textContent = message;
  }

  function notify(message) {
    status(message);
    window.alert(message);
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
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await githubError(response));
    const payload = await response.json();
    return { sha: payload.sha, text: base64ToText(payload.content || "") };
  }

  async function writeGithubFile(form, path, text, message, sha) {
    const body = { message, branch: form.branch, content: textToBase64(text) };
    if (sha) body.sha = sha;
    const response = await fetch(`https://api.github.com/repos/${form.repo}/contents/${encodePath(path)}`, {
      method: "PUT",
      headers: { ...headers(form.token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await githubError(response));
  }

  function parseArray(source, marker, endMarker) {
    if (!source) return [];
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    let arrayEnd = source.indexOf(endMarker, arrayStart);
    if (arrayEnd < 0) arrayEnd = source.indexOf(endMarker.replace("\n", "\r\n"), arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) return [];
    const parsed = Function(`"use strict"; return (${source.slice(arrayStart, arrayEnd)});`)();
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  }

  function fallbackHiddenSource(ids) {
    const json = JSON.stringify([...new Set(ids)].sort(), null, 2).replace(/</g, "\\u003c");
    return `(() => {
  const hiddenTemplateIds = ${json};
  window.CHINA_POP_HIDDEN_TEMPLATE_IDS = hiddenTemplateIds;
  const hiddenTemplateIdSet = new Set(hiddenTemplateIds);
  function runtimeTemplates() {
    try { return typeof templates !== "undefined" ? templates : []; } catch (error) { return []; }
  }
  function removeFromList(list) {
    if (!Array.isArray(list)) return;
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (hiddenTemplateIdSet.has(list[index]?.id)) list.splice(index, 1);
    }
  }
  function applyHiddenTemplates() {
    removeFromList(runtimeTemplates());
    removeFromList(window.CHINA_POP_TEMPLATE_CONFIGS);
  }
  if (typeof renderTemplateButtons === "function" && !renderTemplateButtons.__hiddenTemplateHook) {
    const originalRenderTemplateButtons = renderTemplateButtons;
    renderTemplateButtons = function renderTemplateButtonsWithHiddenTemplates(...args) {
      applyHiddenTemplates();
      return originalRenderTemplateButtons.apply(this, args);
    };
    renderTemplateButtons.__hiddenTemplateHook = true;
  }
  window.CHINA_POP_HIDDEN_TEMPLATES = { ids: hiddenTemplateIds, apply: applyHiddenTemplates };
  applyHiddenTemplates();
  window.setTimeout(applyHiddenTemplates, 0);
  let ticks = 0;
  const timer = window.setInterval(() => {
    ticks += 1;
    applyHiddenTemplates();
    if (ticks >= 24) window.clearInterval(timer);
  }, 250);
})();
`;
  }

  function replaceHiddenIds(source, ids) {
    const marker = "const hiddenTemplateIds =";
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    let arrayEnd = source.indexOf(";\n  window.CHINA_POP_HIDDEN_TEMPLATE_IDS", arrayStart);
    if (arrayEnd < 0) arrayEnd = source.indexOf(";\r\n  window.CHINA_POP_HIDDEN_TEMPLATE_IDS", arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) return fallbackHiddenSource(ids);
    const json = JSON.stringify([...new Set(ids)].sort(), null, 2).replace(/</g, "\\u003c");
    return `${source.slice(0, arrayStart)}${json}${source.slice(arrayEnd)}`;
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

  function isVersionConflict(error) {
    return /does not match|409|conflict/i.test(String(error?.message || ""));
  }

  function selectedTemplateIds() {
    const checked = [...document.querySelectorAll(".bulk-template-wrap")]
      .filter((wrap) => wrap.querySelector("input[type='checkbox']")?.checked)
      .map((wrap) => wrap.dataset.templateId)
      .filter(Boolean);
    if (checked.length) return [...new Set(checked)];

    const list = studioTemplates();
    const managerIndex = Number(document.querySelector("#managerTemplate")?.value);
    let index = Number.isInteger(managerIndex) ? managerIndex : 0;
    try {
      if (!list[index] && typeof currentTemplate !== "undefined") index = currentTemplate || 0;
    } catch (error) {
      index = 0;
    }
    return list[index]?.id ? [list[index].id] : [];
  }

  function removeLocalTemplates(ids) {
    const idSet = new Set(ids);
    try {
      const list = studioTemplates();
      for (let index = list.length - 1; index >= 0; index -= 1) {
        if (idSet.has(list[index]?.id)) list.splice(index, 1);
      }
      if (window.CHINA_POP_TEMPLATE_CONFIGS) {
        for (let index = window.CHINA_POP_TEMPLATE_CONFIGS.length - 1; index >= 0; index -= 1) {
          if (idSet.has(window.CHINA_POP_TEMPLATE_CONFIGS[index]?.id)) window.CHINA_POP_TEMPLATE_CONFIGS.splice(index, 1);
        }
      }
    } catch (error) {
      console.warn("Could not remove local hidden templates.", error);
    }
  }

  async function updateHiddenList(form, ids) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const file = await readGithubFile(form, "hidden-templates.js");
      const hiddenIds = parseArray(file?.text || "", "const hiddenTemplateIds =", ";\n  window.CHINA_POP_HIDDEN_TEMPLATE_IDS");
      const before = hiddenIds.length;
      const next = [...new Set([...hiddenIds, ...ids])];
      try {
        await writeGithubFile(form, "hidden-templates.js", replaceHiddenIds(file?.text || "", next), `Hide ${ids.length} templates from public users`, file?.sha);
        return { newlyHidden: next.length - before };
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error)) throw error;
      }
    }
    throw lastError || new Error("Could not update hidden template list.");
  }

  async function cleanupPublishedList(form, ids) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const file = await readGithubFile(form, "published-templates.js");
      if (!file) return { removed: 0, skipped: false };
      const current = parseArray(file.text, "const publishedTemplates =", ";\n\n  const mediaElementCache");
      const idSet = new Set(ids);
      const next = current.filter((template) => !idSet.has(template?.id));
      const removed = current.length - next.length;
      if (!removed) return { removed: 0, skipped: false };
      try {
        await writeGithubFile(form, "published-templates.js", replacePublishedTemplates(file.text, next), `Delete ${removed} published templates`, file.sha);
        return { removed, skipped: false };
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error)) throw error;
      }
    }
    console.warn("Published list cleanup skipped.", lastError);
    return { removed: 0, skipped: true };
  }

  async function hideSelectedTemplates() {
    const ids = selectedTemplateIds();
    if (!ids.length) {
      notify("No template selected.");
      return;
    }
    const list = studioTemplates();
    if (ids.length >= list.length) {
      notify("Keep at least one public template.");
      return;
    }
    const form = publishForm();
    if (!form.token) {
      notify("Add a GitHub token first.");
      return;
    }
    if (!window.confirm(`Hide ${ids.length} template(s) from public users?`)) return;

    try {
      status("Updating public hidden list...");
      const hiddenResult = await updateHiddenList(form, ids);
      const cleanup = await cleanupPublishedList(form, ids);
      removeLocalTemplates(ids);
      const hiddenMessage = hiddenResult.newlyHidden
        ? `Hidden ${ids.length} globally.`
        : "Selected templates were already hidden globally.";
      const cleanupMessage = cleanup.skipped
        ? "Published list cleanup skipped, but users will still not see hidden templates."
        : `Removed from published list: ${cleanup.removed}.`;
      notify(`${hiddenMessage} ${cleanupMessage} Page will refresh now.`);
      const url = new URL(window.location.href);
      url.searchParams.set("admin", "1");
      url.searchParams.set("fresh", `hidden-${Date.now()}`);
      window.location.replace(url.toString());
    } catch (error) {
      console.warn("Global hide failed.", error);
      notify(`Delete failed: ${error.message}`);
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("#bulkDeleteGlobal, #adminDeletePublishedTemplate");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    hideSelectedTemplates();
  }, true);
})();
