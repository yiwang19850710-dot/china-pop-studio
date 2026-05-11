(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode || window.CHINA_POP_ADMIN_CONSOLE) return;
  window.CHINA_POP_ADMIN_CONSOLE = true;

  const DEFAULT_REPO = "yiwang19850710-dot/china-pop-studio";
  const DEFAULT_BRANCH = "main";
  const SETTINGS_KEY = "china-pop-publish-settings";
  const TOKEN_KEY = "china-pop-github-token";
  const MAX_ASSET_BYTES = 95 * 1024 * 1024;

  const templateGrid = document.querySelector("#templates");
  const managerPanel = document.querySelector("#templateManagerPanel");
  const uploadInput = document.querySelector("#managerMediaUpload");
  const generateButton = document.querySelector("#managerGenerateFromMedia");
  const uploadStatus = document.querySelector("#managerMediaStatus");
  const applyButton = document.querySelector("#managerApply");
  const managerTemplate = document.querySelector("#managerTemplate");

  function setStatusLine(message) {
    try {
      if (typeof setStatus === "function") setStatus(message);
    } catch (error) {
      console.warn("Could not set admin status.", error);
    }
    const publishStatus = document.querySelector("#adminPublishStatus");
    if (publishStatus) publishStatus.textContent = message;
  }

  function alertDone(message) {
    setStatusLine(message);
    window.alert(message);
  }

  function templatesList() {
    try {
      if (typeof templates !== "undefined") return templates;
    } catch (error) {
      return [];
    }
    return [];
  }

  function runtimeConfigs() {
    return window.CHINA_POP_TEMPLATE_CONFIGS || [];
  }

  function normalizedTemplateValue(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[?#].*$/, "")
      .replace(/\\/g, "/")
      .replace(/\s+/g, " ")
      .trim();
  }

  function templateGroupKey(template) {
    if (!template?.id) return "";
    if (template.renderer === "uploadedMedia") {
      const mediaName = normalizedTemplateValue(template.media?.name);
      if (mediaName) return `uploaded-name:${mediaName}`;
      const mediaSource = normalizedTemplateValue(template.media?.src);
      if (mediaSource && !mediaSource.startsWith("blob:") && !mediaSource.startsWith("data:")) {
        return `uploaded-src:${mediaSource}`;
      }
    }
    return `id:${template.id}`;
  }

  function isPublishedAsset(template) {
    const src = String(template?.media?.src || "");
    return Boolean(src && !template?.media?.transient && !src.startsWith("blob:") && !src.startsWith("data:"));
  }

  function preferTemplate(candidate, current) {
    const candidatePublished = isPublishedAsset(candidate);
    const currentPublished = isPublishedAsset(current);
    if (candidatePublished !== currentPublished) return candidatePublished;
    return true;
  }

  function dedupeTemplateList(list) {
    if (!Array.isArray(list) || list.length < 2) return list || [];
    const keepByKey = new Map();
    list.forEach((template, index) => {
      const key = templateGroupKey(template);
      if (!key) return;
      const currentIndex = keepByKey.get(key);
      if (currentIndex === undefined || preferTemplate(template, list[currentIndex])) {
        keepByKey.set(key, index);
      }
    });
    const keep = new Set(keepByKey.values());
    return list.filter((template, index) => {
      const key = templateGroupKey(template);
      return !key || keep.has(index);
    });
  }

  function relatedTemplateIds(seedIds, list = templatesList()) {
    const seedSet = new Set(seedIds);
    const keys = new Set();
    list.forEach((template) => {
      if (seedSet.has(template?.id)) {
        const key = templateGroupKey(template);
        if (key && !key.startsWith("id:")) keys.add(key);
      }
    });
    list.forEach((template) => {
      const key = templateGroupKey(template);
      if (template?.id && key && keys.has(key)) seedSet.add(template.id);
    });
    return [...seedSet];
  }

  function selectedTemplateIds() {
    const checked = [...document.querySelectorAll(".bulk-template-wrap")]
      .filter((wrap) => wrap.querySelector("input[type='checkbox']")?.checked)
      .map((wrap) => wrap.dataset.templateId)
      .filter(Boolean);
    return [...new Set(checked)];
  }

  function currentTemplateIndex() {
    const managerIndex = Number(managerTemplate?.value);
    if (Number.isInteger(managerIndex) && templatesList()[managerIndex]) return managerIndex;
    try {
      if (typeof currentTemplate !== "undefined") return currentTemplate || 0;
    } catch (error) {
      return 0;
    }
    return 0;
  }

  function currentTemplateConfig() {
    const list = typeof window.CHINA_POP_STUDIO?.getTemplates === "function"
      ? window.CHINA_POP_STUDIO.getTemplates()
      : templatesList().map((template) => {
          const { draw, ...config } = template;
          return JSON.parse(JSON.stringify(config));
        });
    const config = list[currentTemplateIndex()];
    if (!config?.id) throw new Error("No template selected.");
    return JSON.parse(JSON.stringify(config));
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

  function rememberPublishForm(form) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ repo: form.repo, branch: form.branch }));
      if (document.querySelector("#adminRememberToken")?.checked) {
        localStorage.setItem(TOKEN_KEY, form.token);
      }
    } catch (error) {
      console.warn("Could not remember publish settings.", error);
    }
  }

  function githubHeaders(token) {
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
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }

  function bytesToBase64(bytes) {
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
    const url = `https://api.github.com/repos/${form.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(form.branch)}&cb=${cacheBust}`;
    const response = await fetch(url, { headers: githubHeaders(form.token) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await githubError(response));
    const payload = await response.json();
    return { sha: payload.sha, text: base64ToText(payload.content || "") };
  }

  async function writeGithubFile(form, path, contentBase64, message, sha) {
    const body = { message, branch: form.branch, content: contentBase64 };
    if (sha) body.sha = sha;
    const response = await fetch(`https://api.github.com/repos/${form.repo}/contents/${encodePath(path)}`, {
      method: "PUT",
      headers: { ...githubHeaders(form.token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await githubError(response));
  }

  function isVersionConflict(error) {
    return /does not match|409|conflict/i.test(String(error?.message || ""));
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function writeWithFreshSha(form, path, contentBase64, message, attempts = 5) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const file = await readGithubFile(form, path);
      try {
        await writeGithubFile(form, path, contentBase64, message, file?.sha);
        return;
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error)) throw error;
        setStatusLine("GitHub changed. Retrying with latest file...");
        await delay(350 + attempt * 300);
      }
    }
    throw lastError || new Error(`Could not update ${path}.`);
  }

  function parseArray(source, marker, endMarker) {
    if (!source) return [];
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    let arrayEnd = source.indexOf(endMarker, arrayStart);
    if (arrayEnd < 0) arrayEnd = source.indexOf(endMarker.replace(/\n/g, "\r\n"), arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) return [];
    const parsed = Function(`"use strict"; return (${source.slice(arrayStart, arrayEnd)});`)();
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  }

  function replaceArray(source, marker, endMarker, list) {
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    let arrayEnd = source.indexOf(endMarker, arrayStart);
    if (arrayEnd < 0) arrayEnd = source.indexOf(endMarker.replace(/\n/g, "\r\n"), arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) throw new Error(`Could not update ${marker}`);
    const json = JSON.stringify(list, null, 4).replace(/</g, "\\u003c");
    return `${source.slice(0, arrayStart)}${json}${source.slice(arrayEnd)}`;
  }

  function replaceHiddenIds(source, ids) {
    const startMarker = "const hiddenTemplateIds =";
    const endMarker = ";\n  window.CHINA_POP_HIDDEN_TEMPLATE_IDS";
    const start = source.indexOf(startMarker);
    const arrayStart = source.indexOf("[", start);
    let arrayEnd = source.indexOf(endMarker, arrayStart);
    if (arrayEnd < 0) arrayEnd = source.indexOf(";\r\n  window.CHINA_POP_HIDDEN_TEMPLATE_IDS", arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) {
      throw new Error("Could not update hidden template list.");
    }
    const json = JSON.stringify([...new Set(ids)].sort(), null, 2).replace(/</g, "\\u003c");
    return `${source.slice(0, arrayStart)}${json}${source.slice(arrayEnd)}`;
  }

  async function updateHiddenIds(form, transform, attempts = 6) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const file = await readGithubFile(form, "hidden-templates.js");
      const current = parseArray(file?.text || "", "const hiddenTemplateIds =", ";\n  window.CHINA_POP_HIDDEN_TEMPLATE_IDS");
      const next = transform(current);
      if (JSON.stringify(current.sort()) === JSON.stringify([...next].sort())) return { before: current, after: next, skipped: true };
      try {
        await writeGithubFile(
          form,
          "hidden-templates.js",
          textToBase64(replaceHiddenIds(file?.text || "", next)),
          "Update hidden template list",
          file?.sha,
        );
        return { before: current, after: next };
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error)) throw error;
        await delay(350 + attempt * 300);
      }
    }
    throw lastError || new Error("Could not update hidden templates.");
  }

  async function updatePublishedTemplates(form, transform, message, attempts = 6) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const file = await readGithubFile(form, "published-templates.js");
      const current = parseArray(file?.text || "", "const publishedTemplates =", ";\n\n  const mediaElementCache");
      const next = transform(current);
      if (JSON.stringify(current) === JSON.stringify(next)) return { before: current, after: next, skipped: true };
      try {
        await writeGithubFile(
          form,
          "published-templates.js",
          textToBase64(replaceArray(file?.text || "", "const publishedTemplates =", ";\n\n  const mediaElementCache", next)),
          message,
          file?.sha,
        );
        return { before: current, after: next };
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error)) throw error;
        setStatusLine("GitHub changed. Retrying with latest list...");
        await delay(350 + attempt * 300);
      }
    }
    throw lastError || new Error("Could not update published templates.");
  }

  function extensionFromName(name) {
    const match = String(name || "").match(/\.[a-z0-9]+$/i);
    return match ? match[0].toLowerCase() : "";
  }

  function mediaExtension(asset, blob) {
    const named = extensionFromName(asset?.name);
    if (named) return named;
    if (blob.type.includes("png")) return ".png";
    if (blob.type.includes("webp")) return ".webp";
    if (blob.type.includes("gif")) return ".gif";
    if (blob.type.includes("mp4")) return ".mp4";
    if (blob.type.includes("webm")) return ".webm";
    return asset?.kind === "video" ? ".mp4" : ".jpg";
  }

  function audioExtension(asset, blob) {
    const named = extensionFromName(asset?.name);
    if (named) return named;
    if (blob.type.includes("wav")) return ".wav";
    if (blob.type.includes("ogg")) return ".ogg";
    if (blob.type.includes("webm")) return ".webm";
    return ".mp3";
  }

  function slug(value) {
    return String(value || "template")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "template";
  }

  async function blobFromAsset(asset) {
    if (!asset?.src || /^assets\//.test(asset.src)) return null;
    const response = await fetch(asset.src);
    const blob = await response.blob();
    if (!blob.size) throw new Error("Uploaded file is empty.");
    return blob;
  }

  async function publishAsset(form, config) {
    if (config.media?.src) {
      const blob = await blobFromAsset(config.media);
      if (blob) {
        if (blob.size > MAX_ASSET_BYTES) throw new Error("Template media is over 95MB. Please compress it first.");
        const name = `${slug(config.id)}${mediaExtension(config.media, blob)}`;
        const path = `assets/templates/${name}`;
        await writeWithFreshSha(form, path, bytesToBase64(new Uint8Array(await blob.arrayBuffer())), `Publish template asset ${name}`);
        config.media = { ...config.media, name: config.media.name || name, src: path, transient: false };
      }
    }

    if (config.audio?.src) {
      const blob = await blobFromAsset(config.audio);
      if (blob) {
        if (blob.size > MAX_ASSET_BYTES) throw new Error("Template sound is over 95MB. Please compress it first.");
        const name = `${slug(config.id)}-sound${audioExtension(config.audio, blob)}`;
        const path = `assets/sounds/${name}`;
        await writeWithFreshSha(form, path, bytesToBase64(new Uint8Array(await blob.arrayBuffer())), `Publish template sound ${name}`);
        config.audio = { ...config.audio, kind: "audio", name: config.audio.name || name, src: path, transient: false };
      }
    }

    return config;
  }

  async function publishCurrentTemplate(button) {
    const form = publishForm();
    if (!form.token) {
      alertDone("Please paste GitHub token first. / 请先填写 GitHub token");
      return;
    }

    button.disabled = true;
    try {
      rememberPublishForm(form);
      applyButton?.click();
      await delay(80);
      setStatusLine("Preparing selected template...");
      const draft = currentTemplateConfig();
      draft.category = draft.category || "published";
      draft.renderer = draft.renderer || "uploadedMedia";
      draft.personSlot = draft.personSlot || { x: 0.5, y: 0.44, scale: 0.76, shape: "oval" };

      setStatusLine("Uploading template media...");
      const publishable = await publishAsset(form, draft);

      setStatusLine("Updating public template list...");
      await updatePublishedTemplates(
        form,
        (list) => {
          const publishKey = templateGroupKey(publishable);
          const next = list.filter((item) => {
            if (item?.id === publishable.id) return false;
            return templateGroupKey(item) !== publishKey;
          });
          next.push(publishable);
          return dedupeTemplateList(next);
        },
        `Publish template ${publishable.name || publishable.id}`,
      );
      await updateHiddenIds(form, (ids) => ids.filter((id) => id !== publishable.id));

      alertDone("Published globally. / 已全网发布成功");
    } catch (error) {
      console.warn("Admin publish failed.", error);
      alertDone(`Publish failed: ${error.message}`);
    } finally {
      button.disabled = false;
      refreshSummary();
    }
  }

  function removeLocalTemplates(ids) {
    const idSet = new Set(ids);
    const removeFrom = (list) => {
      if (!Array.isArray(list)) return;
      for (let index = list.length - 1; index >= 0; index -= 1) {
        if (idSet.has(list[index]?.id)) list.splice(index, 1);
      }
    };
    removeFrom(templatesList());
    removeFrom(runtimeConfigs());
    try {
      if (typeof baseTemplateSnapshots !== "undefined") removeFrom(baseTemplateSnapshots);
    } catch (error) {
      console.warn("Could not remove base snapshots.", error);
    }
    try {
      if (typeof currentTemplate !== "undefined") currentTemplate = Math.min(currentTemplate || 0, Math.max(0, templatesList().length - 1));
      if (typeof persistTemplateDrafts === "function") persistTemplateDrafts();
      if (typeof syncTemplateManagerList === "function") syncTemplateManagerList();
      if (typeof populateTemplateManager === "function") populateTemplateManager(currentTemplate || 0);
      if (typeof renderTemplateButtons === "function") renderTemplateButtons();
      window.CHINA_POP_TEMPLATE_CLEANUP_API?.cleanup?.();
    } catch (error) {
      console.warn("Could not refresh after delete.", error);
    }
  }

  async function deleteSelectedGlobally(button) {
    const selectedIds = selectedTemplateIds();
    const ids = relatedTemplateIds(selectedIds);
    if (!ids.length) {
      alertDone("Please check templates first. / 请先勾选要删除的模板");
      return;
    }
    if (ids.length >= templatesList().length) {
      alertDone("Keep at least one template. / 至少保留一个模板");
      return;
    }

    const form = publishForm();
    if (!form.token) {
      alertDone("Please paste GitHub token first. / 请先填写 GitHub token");
      return;
    }
    if (!window.confirm(`Delete ${ids.length} templates globally? / 全网删除 ${ids.length} 个模板？`)) return;

    button.disabled = true;
    try {
      rememberPublishForm(form);
      setStatusLine("Updating global hidden list...");
      await updateHiddenIds(form, (current) => [...new Set([...current, ...ids])]);
      setStatusLine("Cleaning uploaded template list...");
      const idSet = new Set(ids);
      const deleteKeys = new Set(
        templatesList()
          .filter((template) => idSet.has(template?.id))
          .map(templateGroupKey)
          .filter(Boolean),
      );
      const cleanup = await updatePublishedTemplates(
        form,
        (list) => list.filter((item) => !idSet.has(item?.id) && !deleteKeys.has(templateGroupKey(item))),
        `Delete ${ids.length} templates globally`,
      );
      removeLocalTemplates(ids);
      alertDone(`Deleted ${ids.length} globally. Removed uploaded entries: ${cleanup.before.length - cleanup.after.length}. / 已全网删除 ${ids.length} 个模板`);
    } catch (error) {
      console.warn("Admin delete failed.", error);
      alertDone(`Delete failed: ${error.message}`);
    } finally {
      button.disabled = false;
      refreshSummary();
    }
  }

  function refreshSummary() {
    const total = templatesList().length;
    const selected = selectedTemplateIds().length;
    let panel = document.querySelector("#adminConsoleSummary");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "adminConsoleSummary";
      panel.className = "admin-console-summary";
      templateGrid?.closest("section")?.prepend(panel);
    }
    panel.textContent = `Templates: ${total} / 当前模板 ${total} 个，Selected: ${selected} / 已选 ${selected} 个`;
  }

  function installStyles() {
    if (document.querySelector("#adminConsoleStyles")) return;
    const style = document.createElement("style");
    style.id = "adminConsoleStyles";
    style.textContent = `
      .admin-console-summary {
        margin: 0 0 10px;
        padding: 10px 12px;
        border: 1px solid rgba(91, 191, 145, 0.45);
        border-radius: 8px;
        color: #f9f4e8;
        background: rgba(91, 191, 145, 0.12);
        font-size: 0.82rem;
        font-weight: 850;
      }
      #managerMediaStatus, #adminPublishStatus {
        line-height: 1.4;
      }
      #adminPublishTemplate, #bulkDeleteGlobal {
        font-weight: 900;
      }
    `;
    document.head.append(style);
  }

  function polishCopy() {
    if (generateButton) generateButton.textContent = "Create draft from selected file / 从文件生成模板草稿";
    if (uploadStatus) uploadStatus.textContent = "Step 1: choose image/video. A draft template will be created here. / 第一步：选择图片或视频，会先生成可编辑草稿。";
    const publishButton = document.querySelector("#adminPublishTemplate");
    if (publishButton) publishButton.textContent = "Publish selected template globally / 发布当前模板到用户版";
    const globalDeleteButton = document.querySelector("#bulkDeleteGlobal");
    if (globalDeleteButton) globalDeleteButton.textContent = "Delete checked globally / 删除勾选模板";
    const localDeleteButton = document.querySelector("#bulkDeleteLocal");
    if (localDeleteButton) localDeleteButton.textContent = "Delete checked globally / 删除勾选模板";
  }

  function hookUpload() {
    if (!uploadInput || !generateButton || uploadInput.dataset.adminConsoleHook === "1") return;
    uploadInput.dataset.adminConsoleHook = "1";
    uploadInput.addEventListener("change", () => {
      if (!uploadInput.files?.[0]) return;
      setStatusLine("Creating draft template from selected file...");
      window.setTimeout(() => generateButton.click(), 30);
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const publishButton = target.closest("#adminPublishTemplate");
    if (publishButton instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopImmediatePropagation();
      publishCurrentTemplate(publishButton);
      return;
    }

    const deleteButton = target.closest("#bulkDeleteLocal, #bulkDeleteGlobal, #adminDeletePublishedTemplate");
    if (deleteButton instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteSelectedGlobally(deleteButton);
    }
  }, true);

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === "checkbox" && target.closest(".bulk-template-wrap")) {
      window.setTimeout(refreshSummary, 0);
    }
  }, true);

  installStyles();
  polishCopy();
  hookUpload();
  refreshSummary();

  let ticks = 0;
  const timer = window.setInterval(() => {
    ticks += 1;
    polishCopy();
    refreshSummary();
    if (ticks >= 30) window.clearInterval(timer);
  }, 500);
})();
