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
      console.warn("Could not set delete status.", error);
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
      "Cache-Control": "no-cache",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  function textToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }

  function base64ToText(base64) {
    const binary = atob(base64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
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
    const cacheBust = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const url = `https://api.github.com/repos/${form.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(form.branch)}&cacheBust=${cacheBust}`;
    const response = await fetch(url, {
      headers: headers(form.token),
      cache: "no-store",
    });
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
      cache: "no-store",
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

  function hiddenSource(ids) {
    const json = JSON.stringify([...new Set(ids)].sort(), null, 2).replace(/</g, "\\u003c");
    return `(() => {
  if (window.CHINA_POP_HIDDEN_TEMPLATES?.ready) {
    window.CHINA_POP_HIDDEN_TEMPLATES.install?.();
    window.CHINA_POP_HIDDEN_TEMPLATES.apply?.();
    return;
  }

  const hiddenTemplateIds = ${json};
  window.CHINA_POP_HIDDEN_TEMPLATE_IDS = hiddenTemplateIds;

  const hiddenTemplateIdSet = new Set(hiddenTemplateIds);
  let applying = false;

  function runtimeTemplates() {
    try {
      if (typeof templates !== "undefined") return templates;
    } catch (error) {
      return [];
    }
    return [];
  }

  function removeFromList(list, idSet) {
    let removed = 0;
    if (!Array.isArray(list)) return removed;
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (idSet.has(list[index]?.id)) {
        list.splice(index, 1);
        removed += 1;
      }
    }
    return removed;
  }

  function removeSnapshots(idSet) {
    try {
      if (typeof baseTemplateSnapshots !== "undefined") removeFromList(baseTemplateSnapshots, idSet);
    } catch (error) {
      console.warn("Could not hide template snapshots.", error);
    }
  }

  function refreshAfterHide(shouldRender) {
    try {
      const list = runtimeTemplates();
      if (typeof currentTemplate !== "undefined") {
        currentTemplate = Math.max(0, Math.min(currentTemplate || 0, Math.max(0, list.length - 1)));
      }
      if (typeof syncTemplateManagerList === "function") syncTemplateManagerList();
      if (typeof populateTemplateManager === "function" && list.length) populateTemplateManager(currentTemplate || 0);
      if (shouldRender && typeof renderTemplateButtons === "function") renderTemplateButtons();
      if (typeof applyTemplateDefaults === "function" && list.length) applyTemplateDefaults(currentTemplate || 0);
    } catch (error) {
      console.warn("Could not refresh hidden templates.", error);
    }
  }

  function applyHiddenTemplates(options = {}) {
    if (applying || !hiddenTemplateIdSet.size) return 0;
    applying = true;
    try {
      installRenderHook();
      let removed = 0;
      removed += removeFromList(runtimeTemplates(), hiddenTemplateIdSet);
      removed += removeFromList(window.CHINA_POP_TEMPLATE_CONFIGS, hiddenTemplateIdSet);
      removeSnapshots(hiddenTemplateIdSet);
      if (removed) refreshAfterHide(options.render !== false);
      return removed;
    } finally {
      applying = false;
    }
  }

  function installRenderHook() {
    if (typeof renderTemplateButtons !== "function" || renderTemplateButtons.__hiddenTemplateHook) return;
    const originalRenderTemplateButtons = renderTemplateButtons;
    renderTemplateButtons = function renderTemplateButtonsWithHiddenTemplates(...args) {
      applyHiddenTemplates({ render: false });
      return originalRenderTemplateButtons.apply(this, args);
    };
    renderTemplateButtons.__hiddenTemplateHook = true;
  }

  function watchForLatePublishedTemplates() {
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      applyHiddenTemplates();
      if (ticks >= 24) window.clearInterval(timer);
    }, 250);
  }

  window.CHINA_POP_HIDDEN_TEMPLATES = {
    ready: true,
    ids: hiddenTemplateIds,
    install: installRenderHook,
    apply: applyHiddenTemplates,
  };

  installRenderHook();
  applyHiddenTemplates();
  window.setTimeout(() => {
    installRenderHook();
    applyHiddenTemplates();
  }, 0);
  watchForLatePublishedTemplates();
})();
`;
  }

  function replaceHiddenIds(source, ids) {
    const marker = "const hiddenTemplateIds =";
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    let arrayEnd = source.indexOf(";\n  window.CHINA_POP_HIDDEN_TEMPLATE_IDS", arrayStart);
    if (arrayEnd < 0) arrayEnd = source.indexOf(";\r\n  window.CHINA_POP_HIDDEN_TEMPLATE_IDS", arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) return hiddenSource(ids);
    const json = JSON.stringify([...new Set(ids)].sort(), null, 2).replace(/</g, "\\u003c");
    return `${source.slice(0, arrayStart)}${json}${source.slice(arrayEnd)}`;
  }

  function replacePublishedTemplates(source, list) {
    const marker = "const publishedTemplates =";
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    const arrayEnd = source.indexOf(";\n\n  const mediaElementCache", arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) return source;
    const json = JSON.stringify(list, null, 4).replace(/</g, "\\u003c");
    return `${source.slice(0, arrayStart)}${json}${source.slice(arrayEnd)}`;
  }

  function isVersionConflict(error) {
    return /does not match|409|conflict/i.test(String(error?.message || ""));
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
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
    const removeFrom = (list) => {
      if (!Array.isArray(list)) return;
      for (let index = list.length - 1; index >= 0; index -= 1) {
        if (idSet.has(list[index]?.id)) list.splice(index, 1);
      }
    };
    removeFrom(studioTemplates());
    removeFrom(window.CHINA_POP_TEMPLATE_CONFIGS);
    try {
      if (typeof baseTemplateSnapshots !== "undefined") removeFrom(baseTemplateSnapshots);
    } catch (error) {
      console.warn("Could not remove hidden snapshots.", error);
    }
  }

  async function updateHiddenList(form, ids) {
    let lastError = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const file = await readGithubFile(form, "hidden-templates.js");
      const current = parseArray(file?.text || "", "const hiddenTemplateIds =", ";\n  window.CHINA_POP_HIDDEN_TEMPLATE_IDS");
      const before = current.length;
      const next = [...new Set([...current, ...ids])];
      try {
        await writeGithubFile(
          form,
          "hidden-templates.js",
          replaceHiddenIds(file?.text || "", next),
          `Hide ${ids.length} templates from public users`,
          file?.sha,
        );
        return { newlyHidden: next.length - before };
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error)) throw error;
        await delay(300 + attempt * 250);
      }
    }
    throw lastError || new Error("Could not update hidden template list.");
  }

  async function cleanupPublishedList(form, ids) {
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const file = await readGithubFile(form, "published-templates.js");
      if (!file) return { removed: 0, skipped: false };
      const current = parseArray(file.text, "const publishedTemplates =", ";\n\n  const mediaElementCache");
      const idSet = new Set(ids);
      const next = current.filter((template) => !idSet.has(template?.id));
      const removed = current.length - next.length;
      if (!removed) return { removed: 0, skipped: false };
      try {
        await writeGithubFile(
          form,
          "published-templates.js",
          replacePublishedTemplates(file.text, next),
          `Delete ${removed} published templates`,
          file.sha,
        );
        return { removed, skipped: false };
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error)) throw error;
        await delay(300 + attempt * 250);
      }
    }
    console.warn("Published cleanup skipped.", lastError);
    return { removed: 0, skipped: true };
  }

  async function hideSelectedTemplates() {
    const ids = selectedTemplateIds();
    if (!ids.length) {
      notify("No template selected / 还没有选择模板");
      return;
    }
    if (ids.length >= studioTemplates().length) {
      notify("Keep at least one public template / 至少保留一个公开模板");
      return;
    }

    const form = publishForm();
    if (!form.token) {
      notify("Add a GitHub token first / 请先填写 GitHub token");
      return;
    }
    if (!window.confirm(`Delete ${ids.length} template(s) globally? / 全网删除 ${ids.length} 个模板？`)) return;

    try {
      status("Updating global delete list...");
      const hiddenResult = await updateHiddenList(form, ids);
      const cleanup = await cleanupPublishedList(form, ids);
      removeLocalTemplates(ids);
      window.CHINA_POP_HIDDEN_TEMPLATES?.apply?.();
      const hiddenMessage = hiddenResult.newlyHidden
        ? `Deleted ${ids.length} globally.`
        : "Selected templates were already deleted globally.";
      const cleanupMessage = cleanup.skipped
        ? "Published cleanup skipped, but public users will still not see them."
        : `Removed from uploaded list: ${cleanup.removed}.`;
      notify(`${hiddenMessage} ${cleanupMessage} Page will refresh now. / 已同步全网删除，页面马上刷新。`);
      const url = new URL(window.location.href);
      url.searchParams.set("admin", "1");
      url.searchParams.set("fresh", `deleted-${Date.now()}`);
      window.location.replace(url.toString());
    } catch (error) {
      console.warn("Global delete failed.", error);
      notify(`Delete failed: ${error.message}`);
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("#bulkDeleteLocal, #bulkDeleteGlobal, #adminDeletePublishedTemplate");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    hideSelectedTemplates();
  }, true);

  function alignDeleteButtons() {
    const localButton = document.querySelector("#bulkDeleteLocal");
    if (localButton) localButton.textContent = "Delete checked globally / 删除勾选并同步用户版";
    const globalButton = document.querySelector("#bulkDeleteGlobal");
    if (globalButton) globalButton.textContent = "Delete checked globally / 全网删除勾选";
  }

  alignDeleteButtons();
  let ticks = 0;
  const timer = window.setInterval(() => {
    ticks += 1;
    alignDeleteButtons();
    if (ticks >= 24) window.clearInterval(timer);
  }, 500);
})();
