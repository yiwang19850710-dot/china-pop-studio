(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode) return;

  const DEFAULT_REPO = "yiwang19850710-dot/china-pop-studio";
  const DEFAULT_BRANCH = "main";
  const TOKEN_KEY = "china-pop-github-token";
  const SETTINGS_KEY = "china-pop-publish-settings";
  const MAX_ASSET_BYTES = 95 * 1024 * 1024;

  const panel = document.querySelector("#templateManagerPanel");
  const applyButton = document.querySelector("#managerApply");
  const managerTemplate = document.querySelector("#managerTemplate");
  const managerJson = document.querySelector("#managerJson");

  if (!panel || document.querySelector("#adminPublishPanel")) return;

  function setAppStatus(message) {
    try {
      if (typeof setStatus === "function") setStatus(message);
    } catch (error) {
      console.warn("Could not update publish status.", error);
    }
  }

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function createPublishPanel() {
    const settings = readSettings();
    const row = document.createElement("div");
    row.className = "admin-publish-panel";
    row.id = "adminPublishPanel";
    row.innerHTML = `
      <h3>Publish globally / 全网发布</h3>
      <label>
        GitHub token
        <input id="adminGithubToken" autocomplete="off" placeholder="github_pat_..." type="password" />
      </label>
      <label>
        Repository
        <input id="adminGithubRepo" type="text" value="${settings.repo || DEFAULT_REPO}" />
      </label>
      <label>
        Branch
        <input id="adminGithubBranch" type="text" value="${settings.branch || DEFAULT_BRANCH}" />
      </label>
      <label class="admin-publish-remember">
        <input id="adminRememberToken" type="checkbox" />
        Remember token on this device / 记住这个设备
      </label>
      <button id="adminPublishTemplate" type="button">Publish globally / 保存并全网发布</button>
      <details>
        <summary>How to get token / 如何获取令牌</summary>
        <p>Create a GitHub fine-grained token for this repo only, with Contents: Read and write. Do not share this token.</p>
      </details>
      <p id="adminPublishStatus">After publishing, GitHub Pages usually updates in 1-3 minutes.</p>
    `;

    const saveRow = panel.querySelector(".admin-save-row");
    if (saveRow) saveRow.after(row);
    else panel.prepend(row);

    const savedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
    const tokenInput = row.querySelector("#adminGithubToken");
    const rememberInput = row.querySelector("#adminRememberToken");
    if (savedToken) {
      tokenInput.value = savedToken;
      rememberInput.checked = Boolean(localStorage.getItem(TOKEN_KEY));
    }
    row.querySelector("#adminPublishTemplate").addEventListener("click", publishCurrentTemplate);
  }

  function setPublishStatus(message) {
    const status = document.querySelector("#adminPublishStatus");
    if (status) status.textContent = message;
    setAppStatus(message);
  }

  function getPublishForm() {
    return {
      token: document.querySelector("#adminGithubToken")?.value.trim() || "",
      repo: document.querySelector("#adminGithubRepo")?.value.trim() || DEFAULT_REPO,
      branch: document.querySelector("#adminGithubBranch")?.value.trim() || DEFAULT_BRANCH,
      remember: Boolean(document.querySelector("#adminRememberToken")?.checked),
    };
  }

  function rememberPublishForm({ token, repo, branch, remember }) {
    saveSettings({ repo, branch });
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getSelectedIndex() {
    const index = Number(managerTemplate?.value);
    return Number.isInteger(index) ? index : 0;
  }

  async function getCurrentTemplateConfig() {
    applyButton?.click();
    await new Promise((resolve) => window.setTimeout(resolve, 80));

    const index = getSelectedIndex();
    const studioTemplates = window.CHINA_POP_STUDIO?.getTemplates?.() || [];
    const configList = window.CHINA_POP_TEMPLATE_CONFIGS || [];
    let config = studioTemplates[index] || configList[index];

    if (!config && managerJson?.value.trim()) {
      config = JSON.parse(managerJson.value);
    }
    if (!config) throw new Error("No template selected.");

    const clean = clone(config);
    delete clean.draw;
    clean.id = clean.id || makeSlug(clean.name || `template-${Date.now()}`);
    clean.name = clean.name || clean.id;
    clean.category = clean.category || "published";
    clean.personSlot = clean.personSlot || { x: 0.5, y: 0.44, scale: 0.76, shape: "oval" };
    clean.copy = clean.copy || {};
    return clean;
  }

  function makeSlug(value) {
    return String(value || "template")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 72) || `template-${Date.now()}`;
  }

  function extensionFromMedia(media, blob) {
    const fromName = String(media.name || "").match(/\.[a-z0-9]+$/i)?.[0];
    if (fromName) return fromName.toLowerCase();
    const type = blob?.type || "";
    if (type.includes("png")) return ".png";
    if (type.includes("webp")) return ".webp";
    if (type.includes("gif")) return ".gif";
    if (type.includes("mp4")) return ".mp4";
    if (type.includes("webm")) return ".webm";
    if (type.includes("quicktime")) return ".mov";
    return media.kind === "video" ? ".mp4" : ".jpg";
  }

  function extensionFromAudio(audio, blob) {
    const fromName = String(audio.name || "").match(/\.[a-z0-9]+$/i)?.[0];
    if (fromName) return fromName.toLowerCase();
    const type = blob?.type || audio.type || "";
    if (type.includes("mpeg") || type.includes("mp3")) return ".mp3";
    if (type.includes("wav")) return ".wav";
    if (type.includes("ogg")) return ".ogg";
    if (type.includes("aac")) return ".aac";
    if (type.includes("mp4")) return ".m4a";
    return ".mp3";
  }

  function encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  function textToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    return bytesToBase64(bytes);
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToText(base64) {
    const clean = base64.replace(/\s/g, "");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function githubHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
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

  async function writeGithubFile(repo, path, branch, token, contentBase64, message, sha) {
    const body = { message, content: contentBase64, branch };
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

  async function githubError(response) {
    try {
      const payload = await response.json();
      return payload.message || `GitHub error ${response.status}`;
    } catch (error) {
      return `GitHub error ${response.status}`;
    }
  }

  async function blobFromMediaSource(media) {
    if (!media?.src) return null;
    if (media.src.startsWith("assets/") || media.src.startsWith("http://") || media.src.startsWith("https://")) {
      return null;
    }
    try {
      const response = await fetch(media.src);
      const blob = await response.blob();
      if (!blob.size) throw new Error("Media file is empty.");
      return blob;
    } catch (error) {
      throw new Error("This media is only a temporary browser file. Please re-upload it in the admin page, then publish before refreshing.");
    }
  }

  async function publishMediaAsset(config, form) {
    if (!config.media?.src) return config;
    const blob = await blobFromMediaSource(config.media);
    if (!blob) {
      config.media.transient = false;
      return config;
    }
    if (blob.size > MAX_ASSET_BYTES) {
      throw new Error("This media is too large for direct GitHub upload. Please compress it below 95MB first.");
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ext = extensionFromMedia(config.media, blob);
    const assetName = `${makeSlug(config.id)}${ext}`;
    const assetPath = `assets/templates/${assetName}`;
    const current = await readGithubFile(form.repo, assetPath, form.branch, form.token);
    await writeGithubFile(
      form.repo,
      assetPath,
      form.branch,
      form.token,
      bytesToBase64(bytes),
      `Publish template asset ${assetName}`,
      current?.sha,
    );

    config.media = {
      ...config.media,
      name: config.media.name || assetName,
      src: assetPath,
      transient: false,
    };
    return config;
  }

  async function publishAudioAsset(config, form) {
    if (!config.audio?.src) return config;
    const blob = await blobFromMediaSource(config.audio);
    if (!blob) {
      config.audio.transient = false;
      return config;
    }
    if (blob.size > MAX_ASSET_BYTES) {
      throw new Error("This sound file is too large for direct GitHub upload. Please compress it below 95MB first.");
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ext = extensionFromAudio(config.audio, blob);
    const assetName = `${makeSlug(config.id)}-sound${ext}`;
    const assetPath = `assets/sounds/${assetName}`;
    const current = await readGithubFile(form.repo, assetPath, form.branch, form.token);
    await writeGithubFile(
      form.repo,
      assetPath,
      form.branch,
      form.token,
      bytesToBase64(bytes),
      `Publish template sound ${assetName}`,
      current?.sha,
    );

    config.audio = {
      ...config.audio,
      kind: "audio",
      name: config.audio.name || assetName,
      src: assetPath,
      transient: false,
    };
    return config;
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

  function upsertPublishedTemplate(list, config) {
    const next = list.filter((item) => item && item.id !== config.id);
    next.push(config);
    return next;
  }

  function buildPublishedTemplatesSource(list) {
    const json = JSON.stringify(list, null, 4).replace(/</g, "\\u003c");
    return `(() => {
  const publishedTemplates = ${json};

  const mediaElementCache = new Map();

  function hasOwnValue(source, key) {
    return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
  }

  function copyText(source, key, fallback = "") {
    const value = hasOwnValue(source, key) ? source[key] : fallback;
    return String(value ?? "");
  }

  function hasVisibleText(value) {
    return String(value ?? "").trim().length > 0;
  }

  function getMediaElement(media) {
    if (!media?.src) return null;
    const cached = mediaElementCache.get(media.src);
    if (cached) return cached;

    let element;
    if (media.kind === "video") {
      element = document.createElement("video");
      element.src = media.src;
      element.muted = true;
      element.loop = true;
      element.playsInline = true;
      element.preload = "metadata";
    } else {
      element = new Image();
      element.src = media.src;
    }
    mediaElementCache.set(media.src, element);
    return element;
  }

  function drawCoverElement(ctx, element, w, h) {
    const sourceW = element.videoWidth || element.naturalWidth || element.width;
    const sourceH = element.videoHeight || element.naturalHeight || element.height;
    if (!sourceW || !sourceH) return false;
    const sourceRatio = sourceW / sourceH;
    const targetRatio = w / h;
    let sx = 0;
    let sy = 0;
    let sw = sourceW;
    let sh = sourceH;
    if (sourceRatio > targetRatio) {
      sw = sourceH * targetRatio;
      sx = (sourceW - sw) / 2;
    } else {
      sh = sourceW / targetRatio;
      sy = (sourceH - sh) / 2;
    }
    ctx.drawImage(element, sx, sy, sw, sh, 0, 0, w, h);
    return true;
  }

  function drawUploadedMediaPoster(ctx, w, h, t, power, config = {}) {
    const copy = config.copy || {};
    const titleZh = copyText(copy, "titleZh", "中国名场面");
    const titleEn = copyText(copy, "titleEn", "CHINA SCENE MODE");
    const subtitleZh = copyText(copy, "subtitleZh", "一秒融入本地生活");
    const subtitleEn = copyText(copy, "subtitleEn", "DROP ME INTO LOCAL CHINA");
    const seal = copyText(copy, "seal", "入");
    const media = getMediaElement(config.media);
    let drewMedia = false;

    if (media) {
      if (config.media?.kind === "video" && Math.max(w, h) > 500) media.play().catch(() => {});
      drewMedia = drawCoverElement(ctx, media, w, h);
    }

    if (!drewMedia) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#1d2938");
      g.addColorStop(0.5, "#b31619");
      g.addColorStop(1, "#f16b1e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (typeof drawPosterRays === "function") drawPosterRays(ctx, w, h, t);
    }

    const warm = ctx.createLinearGradient(0, 0, 0, h);
    warm.addColorStop(0, "rgba(0, 0, 0, 0.22)");
    warm.addColorStop(0.48, "rgba(211, 22, 20, 0.08)");
    warm.addColorStop(1, "rgba(255, 82, 20, 0.38)");
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, w, h);

    if (typeof drawGoldConfetti === "function") drawGoldConfetti(ctx, w, h, t, power * 0.7);
    if (typeof drawSceneCaption === "function" && [titleZh, titleEn, subtitleZh, subtitleEn].some(hasVisibleText)) {
      drawSceneCaption(ctx, w, h, titleZh, titleEn, subtitleZh, subtitleEn);
    }
    if (typeof drawSeal === "function" && hasVisibleText(seal)) {
      drawSeal(ctx, w * 0.82, h * 0.18, Math.min(w, h) * 0.11, seal);
    }
  }

  function installRenderer() {
    if (typeof templateRenderers === "undefined") return false;
    templateRenderers.uploadedMedia = (config, ctx, w, h, t, power) => {
      drawUploadedMediaPoster(ctx, w, h, t, power, config);
    };
    return true;
  }

  function makeRuntimeTemplate(config) {
    return {
      ...config,
      draw(ctx, w, h, t, power) {
        const renderer = templateRenderers[this.renderer];
        if (!renderer) throw new Error("Missing renderer for template: " + this.id);
        renderer(this, ctx, w, h, t, power);
      },
    };
  }

  function upsertRuntimeTemplate(config) {
    if (typeof templates === "undefined" || !installRenderer()) return;
    const runtime = makeRuntimeTemplate(config);
    const index = templates.findIndex((template) => template.id === config.id);
    if (index >= 0) Object.assign(templates[index], runtime);
    else templates.push(runtime);

    if (window.CHINA_POP_TEMPLATE_CONFIGS) {
      const clean = JSON.parse(JSON.stringify(config));
      const configIndex = window.CHINA_POP_TEMPLATE_CONFIGS.findIndex((item) => item.id === config.id);
      if (configIndex >= 0) window.CHINA_POP_TEMPLATE_CONFIGS[configIndex] = clean;
      else window.CHINA_POP_TEMPLATE_CONFIGS.push(clean);
    }
  }

  function mediaCanLoad(config) {
    return new Promise((resolve) => {
      if (!config.media?.src) {
        resolve(true);
        return;
      }
      if (config.media.kind === "video") {
        resolve(true);
        return;
      }
      const timer = window.setTimeout(() => resolve(false), 5000);
      const element = new Image();
      element.onload = () => {
        window.clearTimeout(timer);
        resolve(true);
      };
      element.onerror = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
      element.src = config.media.src;
    });
  }

  async function addPublishedTemplates() {
    if (!installRenderer() || typeof templates === "undefined") return;
    for (const config of publishedTemplates) {
      const canLoad = await mediaCanLoad(config);
      if (!canLoad) continue;
      upsertRuntimeTemplate(config);
    }
    if (typeof renderTemplateButtons === "function") renderTemplateButtons();
  }

  addPublishedTemplates();
})();
`;
  }

  async function publishCurrentTemplate() {
    const button = document.querySelector("#adminPublishTemplate");
    const form = getPublishForm();
    if (!form.token) {
      setPublishStatus("Add a GitHub token first.");
      return;
    }

    button.disabled = true;
    try {
      rememberPublishForm(form);
      setPublishStatus("Preparing template...");
      const draft = await getCurrentTemplateConfig();

      setPublishStatus("Uploading media asset...");
      const withMedia = await publishMediaAsset(draft, form);

      setPublishStatus("Uploading sound asset...");
      const publishable = await publishAudioAsset(withMedia, form);

      setPublishStatus("Updating public template list...");
      const publishedFile = await readGithubFile(form.repo, "published-templates.js", form.branch, form.token);
      const currentList = publishedFile?.text ? extractPublishedTemplates(publishedFile.text) : [];
      const nextList = upsertPublishedTemplate(currentList, publishable);
      const nextSource = buildPublishedTemplatesSource(nextList);
      await writeGithubFile(
        form.repo,
        "published-templates.js",
        form.branch,
        form.token,
        textToBase64(nextSource),
        `Publish template ${publishable.name}`,
        publishedFile?.sha,
      );

      setPublishStatus("Published globally. Public users should see it after GitHub Pages updates in 1-3 minutes.");
    } catch (error) {
      console.warn("Publish failed.", error);
      setPublishStatus(`Publish failed: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  createPublishPanel();
})();
