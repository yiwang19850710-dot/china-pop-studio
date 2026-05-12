(() => {
  if (window.CHINA_POP_MOTION_TRACK) return;
  window.CHINA_POP_MOTION_TRACK = true;

  const params = new URLSearchParams(window.location.search);
  const isAdmin = params.get("admin") === "1" || window.location.hash === "#admin";
  const STORAGE_KEY = "china-pop-template-drafts-v1";
  const $ = (selector) => document.querySelector(selector);
  const stage = $("#stage");
  const managerPanel = $("#templateManagerPanel");
  const managerTemplate = $("#managerTemplate");
  const managerSlotX = $("#managerSlotX");
  const managerSlotY = $("#managerSlotY");
  const managerSlotScale = $("#managerSlotScale");
  const managerSlotShape = $("#managerSlotShape");
  const statusEl = $("#status");

  let panel = null;
  let lastTemplateIndex = -1;

  function allTemplates() {
    try {
      if (typeof templates !== "undefined") return templates;
    } catch (error) {
      return [];
    }
    return [];
  }

  function activeIndex() {
    try {
      if (typeof currentTemplate !== "undefined") return currentTemplate || 0;
    } catch (error) {
      return 0;
    }
    return 0;
  }

  function activeTemplate() {
    return allTemplates()[activeIndex()] || null;
  }

  function appConfigs() {
    return window.CHINA_POP_TEMPLATE_CONFIGS || [];
  }

  function setStatusText(message) {
    try {
      if (typeof setStatus === "function") {
        setStatus(message);
        return;
      }
    } catch (error) {
      console.warn("Motion status failed.", error);
    }
    if (statusEl) statusEl.textContent = message;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, places = 4) {
    const factor = 10 ** places;
    return Math.round(Number(value || 0) * factor) / factor;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function plainTemplate(template) {
    if (!template) return null;
    const { draw, ...config } = template;
    return clone(config);
  }

  function syncConfig(template) {
    if (!template?.id) return;
    const clean = plainTemplate(template);
    const configs = appConfigs();
    const index = configs.findIndex((config) => config?.id === template.id);
    if (index >= 0) configs[index] = clean;
    else configs.push(clean);
  }

  function persistDrafts() {
    try {
      const clean = allTemplates().map((template) => {
        const config = plainTemplate(template);
        if (config.media?.transient) {
          config.media = {
            kind: config.media.kind,
            name: config.media.name,
            transient: true,
          };
        }
        if (config.audio?.transient) {
          config.audio = {
            kind: "audio",
            name: config.audio.name,
            type: config.audio.type,
            transient: true,
          };
        }
        return config;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (error) {
      console.warn("Motion draft save failed.", error);
    }
  }

  function baseSlot(template) {
    const slot = template?.personSlot || {};
    return {
      x: round(slot.x ?? 0.5),
      y: round(slot.y ?? 0.45),
      scale: round(slot.scale ?? 0.76),
      shape: slot.shape || "circle",
    };
  }

  function ensureTrack(template) {
    if (!template) return null;
    const base = baseSlot(template);
    if (!template.motionTrack) {
      template.motionTrack = {
        enabled: false,
        duration: 4,
        loop: true,
        base: { x: base.x, y: base.y, scale: base.scale },
        keyframes: [],
      };
    }
    template.motionTrack.base = {
      x: round(template.motionTrack.base?.x ?? base.x),
      y: round(template.motionTrack.base?.y ?? base.y),
      scale: round(template.motionTrack.base?.scale ?? base.scale),
    };
    template.motionTrack.keyframes = Array.isArray(template.motionTrack.keyframes)
      ? template.motionTrack.keyframes.filter((key) => Number.isFinite(Number(key?.time)))
      : [];
    template.motionTrack.duration = Math.max(0.4, Number(template.motionTrack.duration || 4));
    return template.motionTrack;
  }

  function normalizeKey(key) {
    return {
      time: round(Math.max(0, Number(key.time || 0)), 3),
      x: round(clamp(Number(key.x ?? 0.5), 0.02, 0.98)),
      y: round(clamp(Number(key.y ?? 0.45), 0.02, 0.98)),
      scale: round(clamp(Number(key.scale ?? 0.76), 0.18, 2.2)),
    };
  }

  function sortedKeys(track) {
    return (track?.keyframes || []).map(normalizeKey).sort((a, b) => a.time - b.time);
  }

  function mediaTime(template, track) {
    const duration = Math.max(0.4, Number(track?.duration || 4));
    try {
      if (template?.media?.kind === "video" && typeof mediaElementCache !== "undefined") {
        const element = mediaElementCache.get(template.media.src);
        if (element && Number.isFinite(element.currentTime)) {
          if (track?.loop !== false) return element.currentTime % duration;
          return clamp(element.currentTime, 0, duration);
        }
      }
    } catch (error) {
      console.warn("Motion time read failed.", error);
    }
    return (performance.now() / 1000) % duration;
  }

  function interpolate(keys, time, duration, loop) {
    if (!keys.length) return null;
    if (keys.length === 1) return keys[0];
    const first = keys[0];
    const last = keys[keys.length - 1];

    if (!loop) {
      if (time <= first.time) return first;
      if (time >= last.time) return last;
    }

    let left = first;
    let right = last;
    let segmentDuration = 1;
    let segmentTime = 0;

    for (let index = 0; index < keys.length - 1; index += 1) {
      const current = keys[index];
      const next = keys[index + 1];
      if (time >= current.time && time <= next.time) {
        left = current;
        right = next;
        segmentDuration = Math.max(0.001, next.time - current.time);
        segmentTime = time - current.time;
        break;
      }
    }

    if (loop && (time > last.time || time < first.time)) {
      const end = Math.max(duration, last.time + 0.001);
      left = last;
      right = first;
      segmentDuration = Math.max(0.001, end - last.time + first.time);
      segmentTime = time >= last.time ? time - last.time : end - last.time + time;
    }

    const raw = clamp(segmentTime / segmentDuration, 0, 1);
    const ease = raw * raw * (3 - 2 * raw);
    return {
      time,
      x: left.x + (right.x - left.x) * ease,
      y: left.y + (right.y - left.y) * ease,
      scale: left.scale + (right.scale - left.scale) * ease,
    };
  }

  function motionSlot(template) {
    const track = template?.motionTrack;
    if (!track?.enabled) return null;
    const keys = sortedKeys(track);
    if (!keys.length) return null;

    const trackBase = {
      x: Number(track.base?.x ?? template.personSlot?.x ?? keys[0].x),
      y: Number(track.base?.y ?? template.personSlot?.y ?? keys[0].y),
      scale: Number(track.base?.scale ?? template.personSlot?.scale ?? keys[0].scale),
    };
    const userBase = baseSlot(template);
    const frame = interpolate(keys, mediaTime(template, track), Number(track.duration || 4), track.loop !== false);
    if (!frame) return null;

    const scaleRatio = trackBase.scale ? userBase.scale / trackBase.scale : 1;
    return {
      x: round(clamp(frame.x + userBase.x - trackBase.x, 0.02, 0.98)),
      y: round(clamp(frame.y + userBase.y - trackBase.y, 0.02, 0.98)),
      scale: round(clamp(frame.scale * scaleRatio, 0.18, 2.2)),
      shape: userBase.shape || "circle",
    };
  }

  function patchRenderer() {
    try {
      if (typeof drawCameraLayer !== "function" || drawCameraLayer.__motionTrackPatched) return;
      const previousDraw = drawCameraLayer;
      drawCameraLayer = (stageCtx) => {
        const template = activeTemplate();
        const dynamicSlot = motionSlot(template);
        if (!template || !dynamicSlot) {
          previousDraw(stageCtx);
          return;
        }
        const originalSlot = template.personSlot;
        template.personSlot = { ...(originalSlot || {}), ...dynamicSlot };
        try {
          previousDraw(stageCtx);
        } finally {
          template.personSlot = originalSlot;
        }
      };
      drawCameraLayer.__motionTrackPatched = true;
    } catch (error) {
      console.warn("Motion renderer install failed.", error);
    }
  }

  function installStyles() {
    if ($("#motionTrackStyles")) return;
    const style = document.createElement("style");
    style.id = "motionTrackStyles";
    style.textContent = `
      .motion-track-panel {
        display: grid;
        gap: 10px;
        margin: 12px 0;
        padding: 12px;
        border: 1px solid rgba(242, 196, 90, 0.38);
        border-radius: 8px;
        background: rgba(242, 196, 90, 0.08);
      }
      .motion-track-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .motion-track-head label {
        flex-direction: row;
        align-items: center;
        margin: 0;
        gap: 8px;
        white-space: nowrap;
      }
      .motion-help {
        margin: 0;
        color: rgba(249, 244, 232, 0.72);
        font-size: 0.76rem;
        line-height: 1.45;
      }
      .motion-grid {
        display: grid;
        gap: 8px;
      }
      .motion-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .motion-actions button,
      .motion-key-list button {
        min-height: 36px;
        font-size: 0.76rem;
      }
      .motion-key-list {
        display: grid;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .motion-key-list li {
        color: rgba(249, 244, 232, 0.68);
        font-size: 0.76rem;
      }
      .motion-key-list button {
        width: 100%;
        justify-content: flex-start;
        text-align: left;
        border-color: rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.06);
      }
    `;
    document.head.append(style);
  }

  function readVideoDuration(template) {
    try {
      if (template?.media?.kind === "video" && typeof mediaElementCache !== "undefined") {
        const element = mediaElementCache.get(template.media.src);
        if (element && Number.isFinite(element.duration) && element.duration > 0) {
          return Math.min(20, Math.max(1, element.duration));
        }
      }
    } catch (error) {
      console.warn("Motion duration read failed.", error);
    }
    return Number(template?.motionTrack?.duration || 4);
  }

  function updateTemplate(template, message) {
    syncConfig(template);
    persistDrafts();
    refreshPanel();
    setStatusText(message);
  }

  function buildPanel() {
    if (!isAdmin || !managerPanel || panel) return;
    panel = document.createElement("section");
    panel.id = "motionTrackPanel";
    panel.className = "motion-track-panel";
    panel.innerHTML = `
      <div class="motion-track-head">
        <strong>Dynamic head follow / 动态头像跟随</strong>
        <label><input id="motionEnabled" type="checkbox" /> Enable / 启用</label>
      </div>
      <p class="motion-help">For dance videos: add head positions over time. The user's photo/camera head will follow this path.</p>
      <div class="motion-grid">
        <label>Time 秒 <input id="motionTime" min="0" max="20" step="0.1" value="0" type="number" /></label>
        <label>X <span id="motionXValue">50%</span><input id="motionX" min="2" max="98" value="50" type="range" /></label>
        <label>Y <span id="motionYValue">45%</span><input id="motionY" min="2" max="98" value="45" type="range" /></label>
        <label>Size <span id="motionScaleValue">76%</span><input id="motionScale" min="18" max="220" value="76" type="range" /></label>
      </div>
      <div class="motion-actions">
        <button id="motionUseCurrent" type="button">Use current camera box / 读取当前框</button>
        <button id="motionUseVideoTime" type="button">Use video time / 读取视频时间</button>
        <button id="motionSaveKey" type="button">Add keyframe / 添加关键点</button>
        <button id="motionAutoDance" type="button">Auto dance path / 自动跳舞轨迹</button>
        <button id="motionClear" type="button">Clear motion / 清空轨迹</button>
      </div>
      <ol id="motionKeyList" class="motion-key-list"></ol>
    `;

    const shapeLabel = managerSlotShape?.closest("label");
    if (shapeLabel) shapeLabel.after(panel);
    else managerPanel.append(panel);

    const controls = {
      enabled: $("#motionEnabled"),
      time: $("#motionTime"),
      x: $("#motionX"),
      y: $("#motionY"),
      scale: $("#motionScale"),
      xValue: $("#motionXValue"),
      yValue: $("#motionYValue"),
      scaleValue: $("#motionScaleValue"),
    };

    function labels() {
      controls.xValue.textContent = `${controls.x.value}%`;
      controls.yValue.textContent = `${controls.y.value}%`;
      controls.scaleValue.textContent = `${controls.scale.value}%`;
    }

    function loadBaseToControls(slot) {
      controls.x.value = Math.round(slot.x * 100);
      controls.y.value = Math.round(slot.y * 100);
      controls.scale.value = Math.round(slot.scale * 100);
      labels();
    }

    [controls.x, controls.y, controls.scale].forEach((input) => input.addEventListener("input", labels));

    controls.enabled.addEventListener("change", () => {
      const template = activeTemplate();
      if (!template) return;
      const track = ensureTrack(template);
      track.enabled = controls.enabled.checked;
      if (track.enabled && !track.keyframes.length) {
        const base = baseSlot(template);
        track.base = { x: base.x, y: base.y, scale: base.scale };
        track.keyframes = [normalizeKey({ time: 0, ...base })];
        template.personSlot = { ...(template.personSlot || {}), shape: "circle" };
        if (managerSlotShape) managerSlotShape.value = "circle";
        loadBaseToControls(base);
      }
      updateTemplate(template, track.enabled ? "Motion enabled" : "Motion disabled");
    });

    $("#motionUseCurrent")?.addEventListener("click", () => {
      loadBaseToControls(baseSlot(activeTemplate()));
      setStatusText("Current camera box loaded");
    });

    $("#motionUseVideoTime")?.addEventListener("click", () => {
      const template = activeTemplate();
      const track = ensureTrack(template);
      controls.time.value = round(mediaTime(template, track), 1);
      setStatusText("Video time loaded");
    });

    $("#motionSaveKey")?.addEventListener("click", () => {
      const template = activeTemplate();
      if (!template) return;
      const track = ensureTrack(template);
      track.enabled = true;
      track.duration = Math.max(track.duration || 4, Number(controls.time.value || 0.1));
      track.base = track.base || baseSlot(template);
      const next = normalizeKey({
        time: Number(controls.time.value),
        x: Number(controls.x.value) / 100,
        y: Number(controls.y.value) / 100,
        scale: Number(controls.scale.value) / 100,
      });
      track.keyframes = sortedKeys(track).filter((key) => Math.abs(key.time - next.time) > 0.05);
      track.keyframes.push(next);
      template.personSlot = { ...(template.personSlot || {}), shape: "circle" };
      if (managerSlotShape) managerSlotShape.value = "circle";
      updateTemplate(template, "Motion keyframe saved");
    });

    $("#motionAutoDance")?.addEventListener("click", () => {
      const template = activeTemplate();
      if (!template) return;
      const base = baseSlot(template);
      const duration = Math.min(6, Math.max(3.2, readVideoDuration(template) || 4));
      const points = [
        [0, 0, 0, 1],
        [duration * 0.2, -0.024, 0.012, 1.04],
        [duration * 0.4, 0.026, -0.01, 0.99],
        [duration * 0.6, 0.018, 0.018, 1.05],
        [duration * 0.8, -0.028, -0.006, 0.98],
        [duration, 0, 0, 1],
      ];
      template.personSlot = { ...(template.personSlot || {}), shape: "circle" };
      template.motionTrack = {
        enabled: true,
        loop: true,
        duration: round(duration, 2),
        base: { x: base.x, y: base.y, scale: base.scale },
        keyframes: points.map(([time, dx, dy, scale]) => normalizeKey({
          time,
          x: base.x + dx,
          y: base.y + dy,
          scale: base.scale * scale,
        })),
      };
      if (managerSlotShape) managerSlotShape.value = "circle";
      updateTemplate(template, "Auto dance motion added");
    });

    $("#motionClear")?.addEventListener("click", () => {
      const template = activeTemplate();
      if (!template) return;
      delete template.motionTrack;
      updateTemplate(template, "Motion cleared");
    });

    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-motion-key]");
      if (!button) return;
      const key = sortedKeys(activeTemplate()?.motionTrack)[Number(button.dataset.motionKey)];
      if (!key) return;
      controls.time.value = key.time;
      controls.x.value = Math.round(key.x * 100);
      controls.y.value = Math.round(key.y * 100);
      controls.scale.value = Math.round(key.scale * 100);
      labels();
      setStatusText("Motion key loaded");
    });

    labels();
  }

  function refreshPanel() {
    if (!panel) return;
    const template = activeTemplate();
    const track = template?.motionTrack;
    const enabled = $("#motionEnabled");
    const list = $("#motionKeyList");
    if (enabled) enabled.checked = Boolean(track?.enabled);
    if (!list) return;
    const keys = sortedKeys(track);
    list.innerHTML = keys.length
      ? keys.map((key, index) => (
        `<li><button type="button" data-motion-key="${index}">${key.time.toFixed(1)}s - X ${Math.round(key.x * 100)} - Y ${Math.round(key.y * 100)} - ${Math.round(key.scale * 100)}%</button></li>`
      )).join("")
      : "<li>No motion keyframes yet / 还没有关键点</li>";
  }

  function syncPanel() {
    if (!isAdmin) return;
    buildPanel();
    const index = activeIndex();
    if (panel && index !== lastTemplateIndex) {
      lastTemplateIndex = index;
      const base = baseSlot(activeTemplate());
      const x = $("#motionX");
      const y = $("#motionY");
      const scale = $("#motionScale");
      const xv = $("#motionXValue");
      const yv = $("#motionYValue");
      const sv = $("#motionScaleValue");
      if (x) x.value = Math.round(base.x * 100);
      if (y) y.value = Math.round(base.y * 100);
      if (scale) scale.value = Math.round(base.scale * 100);
      if (xv) xv.textContent = `${Math.round(base.x * 100)}%`;
      if (yv) yv.textContent = `${Math.round(base.y * 100)}%`;
      if (sv) sv.textContent = `${Math.round(base.scale * 100)}%`;
    }
    refreshPanel();
  }

  function sourceReady() {
    try {
      if (window.CHINA_POP_STUDIO_UPGRADES?.hasAlbumPhoto?.()) return true;
    } catch (error) {
      console.warn("Album state read failed.", error);
    }
    try {
      return typeof camera !== "undefined" && camera.readyState >= 2 && camera.videoWidth && camera.videoHeight;
    } catch (error) {
      return false;
    }
  }

  function canvasPoint(event) {
    const rect = stage.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * W / rect.width,
      y: (event.clientY - rect.top) * H / rect.height,
    };
  }

  function frameForSlot(slot) {
    const size = Number((typeof portraitSizeInput !== "undefined" && portraitSizeInput?.value) || 78) / 100;
    const style = (typeof maskStyleInput !== "undefined" && maskStyleInput?.value) || slot.shape || "circle";
    const vertical = H > W;
    let boxW = W * (vertical ? 0.58 : 0.38) * size * slot.scale;
    let boxH = H * (vertical ? 0.43 : 0.74) * size * slot.scale;
    if (style === "full") {
      boxW = W * (vertical ? 0.72 : 0.64) * size * slot.scale;
      boxH = H * (vertical ? 0.48 : 0.72) * size * slot.scale;
    }
    if (style === "circle") {
      boxW = boxH = Math.min(W, H) * 0.62 * size * slot.scale;
    }
    return {
      boxW,
      boxH,
      x: W * slot.x - boxW / 2,
      y: H * slot.y - boxH / 2,
    };
  }

  function hitFrame(point, frame) {
    const margin = Math.max(32, Math.min(W, H) * 0.04);
    return (
      point.x >= frame.x - margin &&
      point.x <= frame.x + frame.boxW + margin &&
      point.y >= frame.y - margin &&
      point.y <= frame.y + frame.boxH + margin
    );
  }

  function syncManagerSlot(slot) {
    if (managerSlotX) {
      managerSlotX.value = Math.round(slot.x * 100);
      $("#managerSlotXValue")?.replaceChildren(`${Math.round(slot.x * 100)}%`);
    }
    if (managerSlotY) {
      managerSlotY.value = Math.round(slot.y * 100);
      $("#managerSlotYValue")?.replaceChildren(`${Math.round(slot.y * 100)}%`);
    }
    if (managerSlotScale) {
      managerSlotScale.value = Math.round(slot.scale * 100);
      $("#managerSlotScaleValue")?.replaceChildren(`${Math.round(slot.scale * 100)}%`);
    }
  }

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function applyBaseSlot(template, slot) {
    template.personSlot = {
      ...(template.personSlot || {}),
      x: clamp(slot.x, 0.04, 0.96),
      y: clamp(slot.y, 0.04, 0.96),
      scale: clamp(slot.scale, 0.18, 2.2),
    };
    syncConfig(template);
    syncManagerSlot(template.personSlot);
  }

  function installMotionDrag() {
    if (!stage || stage.dataset.motionDragInstalled) return;
    stage.dataset.motionDragInstalled = "true";
    let drag = null;

    function motionTemplate() {
      const template = activeTemplate();
      return template?.motionTrack?.enabled && motionSlot(template) ? template : null;
    }

    stage.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (!sourceReady()) return;
      const template = motionTemplate();
      if (!template) return;
      const dynamic = motionSlot(template);
      const frame = frameForSlot(dynamic);
      const point = canvasPoint(event);
      if (!hitFrame(point, frame)) return;
      const base = baseSlot(template);
      drag = {
        pointerId: event.pointerId,
        offsetX: point.x - (frame.x + frame.boxW / 2),
        offsetY: point.y - (frame.y + frame.boxH / 2),
        deltaX: dynamic.x - base.x,
        deltaY: dynamic.y - base.y,
      };
      stage.classList.add("portrait-dragging");
      stage.setPointerCapture?.(event.pointerId);
      setStatusText("Move moving head");
      stopEvent(event);
    }, true);

    stage.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const template = motionTemplate();
      if (!template) return;
      const point = canvasPoint(event);
      applyBaseSlot(template, {
        ...baseSlot(template),
        x: (point.x - drag.offsetX) / W - drag.deltaX,
        y: (point.y - drag.offsetY) / H - drag.deltaY,
      });
      stopEvent(event);
    }, true);

    function finish(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = null;
      stage.classList.remove("portrait-dragging");
      stage.releasePointerCapture?.(event.pointerId);
      persistDrafts();
      syncPanel();
      stopEvent(event);
    }

    stage.addEventListener("pointerup", finish, true);
    stage.addEventListener("pointercancel", finish, true);
    stage.addEventListener("wheel", (event) => {
      if (!sourceReady()) return;
      const template = motionTemplate();
      if (!template) return;
      const dynamic = motionSlot(template);
      const frame = frameForSlot(dynamic);
      const point = canvasPoint(event);
      if (!hitFrame(point, frame)) return;
      const factor = event.deltaY < 0 ? 1.06 : 0.94;
      applyBaseSlot(template, {
        ...baseSlot(template),
        scale: (template.personSlot?.scale || 1) * factor,
      });
      persistDrafts();
      syncPanel();
      setStatusText("Resize moving head");
      stopEvent(event);
    }, { capture: true, passive: false });
  }

  patchRenderer();
  installStyles();
  installMotionDrag();
  syncPanel();

  managerTemplate?.addEventListener("change", () => window.setTimeout(syncPanel, 0));
  stage?.addEventListener("pointerup", () => window.setTimeout(syncPanel, 0));
  [managerSlotX, managerSlotY, managerSlotScale, managerSlotShape].forEach((input) => {
    input?.addEventListener("input", () => window.setTimeout(syncPanel, 0));
    input?.addEventListener("change", () => window.setTimeout(syncPanel, 0));
  });

  let ticks = 0;
  const timer = window.setInterval(() => {
    ticks += 1;
    patchRenderer();
    installStyles();
    installMotionDrag();
    syncPanel();
    if (ticks >= 30) window.clearInterval(timer);
  }, 500);

  window.CHINA_POP_MOTION = {
    slotForTemplate: motionSlot,
    refresh: syncPanel,
  };
})();