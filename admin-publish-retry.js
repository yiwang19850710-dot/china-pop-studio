(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode || window.CHINA_POP_ADMIN_PUBLISH_RETRY) return;
  window.CHINA_POP_ADMIN_PUBLISH_RETRY = true;

  const DEFAULT_REPO = "yiwang19850710-dot/china-pop-studio";
  const DEFAULT_BRANCH = "main";
  const SETTINGS_KEY = "china-pop-publish-settings";
  const TOKEN_KEY = "china-pop-github-token";
  const MAX_ASSET_BYTES = 95 * 1024 * 1024;

  function setPublishStatus(message) {
    const el = document.querySelector("#adminPublishStatus");
    if (el) el.textContent = message;
    try {
      if (typeof setStatus === "function") setStatus(message);
    } catch (error) {
      console.warn("Could not set publish status.", error);
    }
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
    const url = `https://api.github.com/repos/${form.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(form.branch)}&cacheBust=${cacheBust}`;
    const response = await fetch(url, { headers: headers(form.token), cache: "no-store" });
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
      headers: { ...headers(form.token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await githubError(response));
  }

  function isVersionConflict(error) {
    return /does not match|409|conflict/i.test(String(error?.message || ""));
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function makeSlug(value) {
    return String(value || "template")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "template";
  }

  function selectedTemplateConfig() {
    const list = typeof window.CHINA_POP_STUDIO?.getTemplates === "function"
      ? window.CHINA_POP_STUDIO.getTemplates()
      : [];
    const managerIndex = Number(document.querySelector("#managerTemplate")?.value);
    let index = Number.isInteger(managerIndex) ? managerIndex : 0;
    try {
      if (!list[index] && typeof currentTemplate !== "undefined") index = currentTemplate || 0;
    } catch (error) {
      index = 0;
    }
    const config = list[index];
    if (!config?.id) throw new Error("No template selected.");
    return JSON.parse(JSON.stringify(config));
  }

  async function blobFromSource(asset) {
    if (!asset?.src || !asset.transient && /^assets\//.test(asset.src)) return null;
    const response = await fetch(asset.src);
    const blob = await response.blob();
    if (!blob.size) throw new Error("Uploaded file is empty.");
    return blob;
  }

  function extensionFromName(name) {
    const match = String(name || "").match(/\.[a-z0-9]+$/i);
    return match ? match[0].toLowerCase() : "";
  }

  function extensionFromMedia(asset, blob) {
    const named = extensionFromName(asset?.name);
    if (named) return named;
    if (blob.type.includes("png")) return ".png";
    if (blob.type.includes("webp")) return ".webp";
    if (blob.type.includes("gif")) return ".gif";
    if (blob.type.includes("mp4")) return ".mp4";
    if (blob.type.includes("webm")) return ".webm";
    return asset?.kind === "video" ? ".mp4" : ".jpg";
  }

  function extensionFromAudio(asset, blob) {
    const named = extensionFromName(asset?.name);
    if (named) return named;
    if (blob.type.includes("mpeg")) return ".mp3";
    if (blob.type.includes("wav")) return ".wav";
    if (blob.type.includes("ogg")) return ".ogg";
    if (blob.type.includes("webm")) return ".webm";
    return ".mp3";
  }

  async function writeFileWithFreshSha(form, path, contentBase64, message, attempts = 5) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const current = await readGithubFile(form, path);
      try {
        await writeGithubFile(form, path, contentBase64, message, current?.sha);
        return;
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error)) throw error;
        setPublishStatus("GitHub changed during upload. Retrying...");
        await delay(350 + attempt * 300);
      }
    }
    throw lastError || new Error(`Could not publish ${path}.`);
  }

  async function publishMedia(config, form) {
    if (!config.media?.src) return config;
    const blob = await blobFromSource(config.media);
    if (!blob) {
      config.media.transient = false;
      return config;
    }
    if (blob.size > MAX_ASSET_BYTES) throw new Error("This media is too large. Please compress it below 95MB first.");
    const ext = extensionFromMedia(config.media, blob);
    const assetName = `${makeSlug(config.id)}${ext}`;
    const assetPath = `assets/templates/${assetName}`;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await writeFileWithFreshSha(form, assetPath, bytesToBase64(bytes), `Publish template asset ${assetName}`);
    config.media = { ...config.media, name: config.media.name || assetName, src: assetPath, transient: false };
    return config;
  }

  async function publishAudio(config, form) {
    if (!config.audio?.src) return config;
    const blob = await blobFromSource(config.audio);
    if (!blob) {
      config.audio.transient = false;
      return config;
    }
    if (blob.size > MAX_ASSET_BYTES) throw new Error("This sound file is too large. Please compress it below 95MB first.");
    const ext = extensionFromAudio(config.audio, blob);
    const assetName = `${makeSlug(config.id)}-sound${ext}`;
    const assetPath = `assets/sounds/${assetName}`;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await writeFileWithFreshSha(form, assetPath, bytesToBase64(bytes), `Publish template sound ${assetName}`);
    config.audio = { ...config.audio, kind: "audio", name: config.audio.name || assetName, src: assetPath, transient: false };
    return config;
  }

  function extractPublishedTemplates(source) {
    const marker = "const publishedTemplates =";
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    let arrayEnd = source.indexOf(";\n\n  const mediaElementCache", arrayStart);
    if (arrayEnd < 0) arrayEnd = source.indexOf(";\r\n\r\n  const mediaElementCache", arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) return [];
    const parsed = Function(`"use strict"; return (${source.slice(arrayStart, arrayEnd)});`)();
    return Array.isArray(parsed) ? parsed : [];
  }

  function replacePublishedTemplates(source, list) {
    const marker = "const publishedTemplates =";
    const start = source.indexOf(marker);
    const arrayStart = source.indexOf("[", start);
    let arrayEnd = source.indexOf(";\n\n  const mediaElementCache", arrayStart);
    if (arrayEnd < 0) arrayEnd = source.indexOf(";\r\n\r\n  const mediaElementCache", arrayStart);
    if (start < 0 || arrayStart < 0 || arrayEnd < 0) {
      throw new Error("Could not read public template list.");
    }
    const json = JSON.stringify(list, null, 4).replace(/</g, "\\u003c");
    return `${source.slice(0, arrayStart)}${json}${source.slice(arrayEnd)}`;
  }

  function upsertTemplate(list, config) {
    return [...list.filter((item) => item?.id !== config.id), config];
  }

  async function updatePublishedList(form, config) {
    let lastError = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const file = await readGithubFile(form, "published-templates.js");
      const source = file?.text || "";
      const current = extractPublishedTemplates(source);
      const next = upsertTemplate(current, config);
      try {
        await writeGithubFile(
          form,
          "published-templates.js",
          textToBase64(replacePublishedTemplates(source, next)),
          `Publish template ${config.name}`,
          file?.sha,
        );
        return;
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error)) throw error;
        setPublishStatus("Public template list changed. Retrying...");
        await delay(400 + attempt * 350);
      }
    }
    throw lastError || new Error("Could not update public template list.");
  }

  async function publishSelectedTemplate(button) {
    const form = getPublishForm();
    if (!form.token) {
      setPublishStatus("Add a GitHub token first.");
      return;
    }
    button.disabled = true;
    try {
      rememberPublishForm(form);
      setPublishStatus("Preparing template...");
      const config = selectedTemplateConfig();
      config.category = config.category || "published";
      config.renderer = config.renderer || "uploadedMedia";
      config.personSlot = config.personSlot || { x: 0.5, y: 0.44, scale: 0.76, shape: "oval" };

      setPublishStatus("Uploading template image/video...");
      const withMedia = await publishMedia(config, form);

      setPublishStatus("Uploading template sound...");
      const publishable = await publishAudio(withMedia, form);

      setPublishStatus("Updating public template list...");
      await updatePublishedList(form, publishable);
      setPublishStatus("Published globally. Public users should see it after GitHub Pages updates in 1-3 minutes.");
      window.alert("Published globally / 已全网发布");
    } catch (error) {
      console.warn("Publish failed.", error);
      setPublishStatus(`Publish failed: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("#adminPublishTemplate");
    if (!(button instanceof HTMLButtonElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    publishSelectedTemplate(button);
  }, true);
})();
