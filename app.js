const stage = document.querySelector("#stage");
const ctx = stage.getContext("2d");
const portraitLayer = document.createElement("canvas");
const portraitLayerCtx = portraitLayer.getContext("2d");
const portraitMask = document.createElement("canvas");
const portraitMaskCtx = portraitMask.getContext("2d");
const camera = document.querySelector("#camera");
const statusEl = document.querySelector("#status");
const startButton = document.querySelector("#startCamera");
const captureButton = document.querySelector("#capturePhoto");
const recordButton = document.querySelector("#recordVideo");
const downloadLink = document.querySelector("#downloadLink");
const templateGrid = document.querySelector("#templates");
const outputFrameInput = document.querySelector("#outputFrame");
const maskStyleInput = document.querySelector("#maskStyle");
const recordLengthInput = document.querySelector("#recordLength");
const portraitSizeInput = document.querySelector("#portraitSize");
const fxIntensityInput = document.querySelector("#fxIntensity");
const mirrorToggle = document.querySelector("#mirrorToggle");
const countdownToggle = document.querySelector("#countdownToggle");
const outputPanel = document.querySelector("#outputPanel");
const photoPreview = document.querySelector("#photoPreview");
const videoPreview = document.querySelector("#videoPreview");

let W = stage.width;
let H = stage.height;
let currentTemplate = 0;
let stream = null;
let animationId = null;
let recorder = null;
let recordedChunks = [];
let countdownUntil = 0;
let countdownStart = 0;

const templateConfigs = window.CHINA_POP_TEMPLATE_CONFIGS || [];
const templateRenderers = {
  horseyear(config, ctx, w, h, t, power) {
    drawHorseYearPoster(ctx, w, h, t, power, config);
  },
  dailyGreeting(config, ctx, w, h, t, power) {
    drawDailyGreetingPoster(ctx, w, h, t, power, config.copy);
  },
  squareDance(config, ctx, w, h, t, power) {
    drawSquareDancePoster(ctx, w, h, t, power, config);
  },
  bellyPark(config, ctx, w, h, t, power) {
    drawBellyParkPoster(ctx, w, h, t, power, config);
  },
  dragonFestival(config, ctx, w, h, t, power) {
    drawFestivalBase(ctx, w, h, "#7d1712", "#1a1010", "#f2c45a");
    drawSun(ctx, w * 0.78, h * 0.23, h * 0.19, "#f2c45a", 0.88);
    drawDragonRibbon(ctx, w, h, t, power);
    drawLanterns(ctx, w, h, t, power);
    drawSeal(ctx, w - 176, h - 146, 110, config.copy?.seal || "潮");
  },
  operaStage(config, ctx, w, h, t, power) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#07111e");
    g.addColorStop(0.52, "#142b43");
    g.addColorStop(1, "#1a1018");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    drawCurtains(ctx, w, h, t, power);
    drawOperaClouds(ctx, w, h, t);
    drawStageLights(ctx, w, h, t);
    drawSeal(ctx, 122, h - 132, 100, config.copy?.seal || "京");
  },
  lanternStreet(config, ctx, w, h, t, power) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#111d2c");
    g.addColorStop(0.5, "#182821");
    g.addColorStop(1, "#331812");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    drawStreetPerspective(ctx, w, h);
    drawLanternRows(ctx, w, h, t, power);
    drawGoldConfetti(ctx, w, h, t, power);
    drawSeal(ctx, w - 156, 136, 92, config.copy?.seal || "福");
  },
  greatWall(config, ctx, w, h, t, power) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#153247");
    sky.addColorStop(0.55, "#e0984d");
    sky.addColorStop(1, "#271715");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    drawMountains(ctx, w, h);
    drawWall(ctx, w, h, t);
    drawFirework(ctx, w * 0.77, h * 0.24, 90, t, "#f8d36a", power);
    drawFirework(ctx, w * 0.22, h * 0.28, 70, t + 1.4, "#e94a3f", power);
    drawSeal(ctx, 135, 132, 94, config.copy?.seal || "游");
  },
  porcelain(config, ctx, w, h, t, power) {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#edf0e7");
    bg.addColorStop(1, "#b7d4da");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    drawPorcelainPattern(ctx, w, h, t, power);
    drawBrushCircle(ctx, w * 0.49, h * 0.48, h * 0.42, "#1c5f9f");
    drawSeal(ctx, w - 158, h - 132, 94, config.copy?.seal || "青");
  },
  cyberChinatown(config, ctx, w, h, t, power) {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 40, w * 0.5, h * 0.5, w * 0.8);
    g.addColorStop(0, "#293552");
    g.addColorStop(0.45, "#111421");
    g.addColorStop(1, "#070910");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    drawNeonGrid(ctx, w, h, t);
    drawNeonSigns(ctx, w, h, t, power);
    drawFirework(ctx, w * 0.64, h * 0.2, 62, t, "#37d6c6", power);
    drawSeal(ctx, 150, h - 128, 92, config.copy?.seal || "潮");
  },
};
const templates = templateConfigs.map((config) => ({
  ...config,
  draw(ctx, w, h, t, power) {
    const renderer = templateRenderers[config.renderer];
    if (!renderer) {
      throw new Error(`Missing renderer for template: ${config.id}`);
    }
    renderer(config, ctx, w, h, t, power);
  },
}));

function setStageSize() {
  const frame = outputFrameInput.value;
  if (frame === "wide") {
    stage.width = 1280;
    stage.height = 720;
  } else {
    stage.width = 720;
    stage.height = 1280;
  }
  W = stage.width;
  H = stage.height;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function applyTemplateDefaults(index) {
  const slot = templates[index]?.personSlot;
  if (!slot?.shape) return;
  const hasShape = Array.from(maskStyleInput.options).some((option) => option.value === slot.shape);
  if (hasShape) {
    maskStyleInput.value = slot.shape;
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  const radius = Math.max(0, Math.min(r, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawHorseYearPoster(ctx, w, h, t, power, config = {}) {
  const copy = config.copy || {};
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#8f090b");
  g.addColorStop(0.38, "#d11118");
  g.addColorStop(0.7, "#f35b19");
  g.addColorStop(1, "#7c0506");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  drawPosterRays(ctx, w, h, t);
  drawGiantLanternBand(ctx, w, h, t, power);
  drawPosterYear(ctx, w, h);
  drawVerticalGreeting(ctx, w, h);
  drawPosterEnglishRibbon(ctx, w, h, copy.titleEn || "HAPPY SPRING FESTIVAL", copy.subtitleEn || "2026 YEAR OF THE HORSE");
  drawPosterGlow(ctx, w, h);
  drawHorseHerd(ctx, w, h, t, power);
  drawGoldBlessing(ctx, w, h);
  drawSeal(ctx, w * 0.17, h * 0.56, Math.min(w, h) * 0.12, copy.seal || "福");
}

function drawPosterRays(ctx, w, h, t) {
  ctx.save();
  ctx.translate(w * 0.52, h * 0.42);
  for (let i = 0; i < 28; i++) {
    ctx.rotate((Math.PI * 2) / 28);
    const grad = ctx.createLinearGradient(0, 0, w * 0.8, 0);
    grad.addColorStop(0, "rgba(255, 228, 139, 0.12)");
    grad.addColorStop(1, "rgba(255, 228, 139, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.9, Math.sin(t + i) * 10 + 18);
    ctx.lineTo(w * 0.9, Math.sin(t + i) * 10 - 18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawGiantLanternBand(ctx, w, h, t, power) {
  const count = w > h ? 8 : 5;
  for (let i = 0; i < count; i++) {
    const x = (i - 0.2) * (w / (count - 0.4));
    const y = h * 0.075 + Math.sin(t * 1.2 + i) * h * 0.006;
    drawLantern(ctx, x, y, Math.min(w, h) * (0.22 + power * 0.04), Math.sin(t + i) * 0.05);
  }
  ctx.fillStyle = "rgba(95, 7, 7, 0.45)";
  ctx.fillRect(0, 0, w, h * 0.035);
}

function drawPosterYear(ctx, w, h) {
  const scale = Math.min(w / 720, h / 1280);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255, 224, 120, 0.85)";
  ctx.shadowBlur = 18 * scale;
  ctx.lineWidth = 8 * scale;
  ctx.strokeStyle = "#7d2508";
  ctx.fillStyle = "#f6cf64";
  ctx.font = `900 ${Math.max(54, 92 * scale)}px Georgia, serif`;
  ctx.strokeText("2026", w * 0.52, h * 0.13);
  ctx.fillText("2026", w * 0.52, h * 0.13);
  ctx.restore();
}

function drawVerticalGreeting(ctx, w, h) {
  const scale = Math.min(w / 720, h / 1280);
  const x = w * 0.14;
  const startY = h * 0.24;
  const chars = ["春", "节", "快", "乐"];
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.max(42, 76 * scale)}px serif`;
  chars.forEach((char, index) => {
    const y = startY + index * 86 * scale;
    ctx.fillStyle = "rgba(80, 0, 0, 0.6)";
    roundedRect(ctx, x - 62 * scale, y - 42 * scale, 124 * scale, 70 * scale, 4 * scale);
    ctx.fill();
    ctx.shadowColor = "rgba(255, 224, 120, 0.85)";
    ctx.shadowBlur = 12 * scale;
    ctx.strokeStyle = "#6c1208";
    ctx.lineWidth = 5 * scale;
    ctx.fillStyle = "#ffdf75";
    ctx.strokeText(char, x, y);
    ctx.fillText(char, x, y);
    ctx.shadowBlur = 0;
  });

  ctx.fillStyle = "rgba(255, 240, 204, 0.92)";
  ctx.font = `700 ${Math.max(18, 30 * scale)}px serif`;
  const sideText = ["2", "0", "2", "6", "马", "年", "吉", "祥"];
  sideText.forEach((char, index) => {
    ctx.fillText(char, x + 86 * scale, startY + index * 28 * scale);
  });
  ctx.restore();
}

function drawPosterGlow(ctx, w, h) {
  const glow = ctx.createRadialGradient(w * 0.57, h * 0.43, 0, w * 0.57, h * 0.43, h * 0.31);
  glow.addColorStop(0, "rgba(255, 244, 224, 0.9)");
  glow.addColorStop(0.3, "rgba(255, 210, 145, 0.48)");
  glow.addColorStop(1, "rgba(194, 14, 18, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(w * 0.57, h * 0.43, w * 0.38, h * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGoldBlessing(ctx, w, h) {
  const scale = Math.min(w / 720, h / 1280);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255, 222, 115, 0.75)";
  ctx.shadowBlur = 16 * scale;
  ctx.fillStyle = "#ffd66a";
  ctx.strokeStyle = "#842311";
  ctx.lineWidth = 4 * scale;
  ctx.font = `900 ${Math.max(22, 42 * scale)}px serif`;
  ctx.strokeText("金马迎福", w * 0.22, h * 0.52);
  ctx.fillText("金马迎福", w * 0.22, h * 0.52);
  ctx.restore();
}

function drawHorseHerd(ctx, w, h, t, power) {
  const baseY = h * 0.82;
  const horses = [
    [0.18, 0.72, "#3b1112", -0.3],
    [0.34, 0.76, "#b94124", 0.2],
    [0.52, 0.86, "#f5d69a", 0],
    [0.7, 0.75, "#1c1110", 0.25],
    [0.86, 0.67, "#efe2c8", -0.2],
  ];
  horses.forEach(([px, size, color, phase], index) => {
    drawHorse(ctx, w * px, baseY + Math.sin(t * 2 + index) * 5, Math.min(w, h) * 0.22 * size, color, phase + t * 0.08, power);
  });
  const fog = ctx.createLinearGradient(0, h * 0.67, 0, h);
  fog.addColorStop(0, "rgba(255, 92, 25, 0)");
  fog.addColorStop(0.5, "rgba(255, 92, 25, 0.24)");
  fog.addColorStop(1, "rgba(120, 8, 8, 0.42)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
}

function drawHorse(ctx, x, y, s, color, phase, power) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 23, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(42, -28, 18, 30, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(25, -12);
  ctx.quadraticCurveTo(42, -55, 62, -54);
  ctx.quadraticCurveTo(48, -34, 48, -18);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const legX = -28 + i * 19;
    const swing = Math.sin(phase * 4 + i * 1.7) * (14 + power * 8);
    ctx.beginPath();
    ctx.moveTo(legX, 18);
    ctx.lineTo(legX + swing, 70);
    ctx.stroke();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-42, -8);
  ctx.quadraticCurveTo(-76, -36, -82, -8);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 226, 130, 0.75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, -22);
  ctx.quadraticCurveTo(12, -34, 36, -22);
  ctx.stroke();
  ctx.restore();
}

function drawDailyGreetingPoster(ctx, w, h, t, power, options) {
  const vertical = h > w;
  if (options.time === "evening") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#251044");
    g.addColorStop(0.5, "#7f1137");
    g.addColorStop(1, "#15081b");
    ctx.fillStyle = g;
  } else if (options.time === "noon") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#ffcb4d");
    g.addColorStop(0.42, "#ef3e18");
    g.addColorStop(1, "#7b0709");
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#ff8a25");
    g.addColorStop(0.34, "#e71919");
    g.addColorStop(1, "#84100a");
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, w, h);

  drawPosterRays(ctx, w, h, t);
  drawGreetingFloralBorder(ctx, w, h, t, power, options.time);
  if (options.time === "evening") {
    drawLanternRows(ctx, w, h, t, power);
    drawNeonGrid(ctx, w, h, t);
  } else {
    drawSun(ctx, w * 0.72, h * 0.18, Math.min(w, h) * 0.24, "#ffe56f", 0.82);
    drawLanterns(ctx, w, h, t, power);
  }

  drawBigGreetingText(ctx, w, h, options.greeting, options.greetingEn, options.sub, options.subEn);
  drawGoldIngotRain(ctx, w, h, t, power);
  drawSeal(ctx, w * (vertical ? 0.82 : 0.88), h * (vertical ? 0.53 : 0.72), Math.min(w, h) * 0.12, options.seal);
}

function drawPosterEnglishRibbon(ctx, w, h, title, sub) {
  const scale = Math.min(w / 720, h / 1280);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(117, 8, 8, 0.68)";
  roundedRect(ctx, w * 0.22, h * 0.185, w * 0.56, 58 * scale, 8 * scale);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 223, 112, 0.68)";
  ctx.lineWidth = 2 * scale;
  roundedRect(ctx, w * 0.22, h * 0.185, w * 0.56, 58 * scale, 8 * scale);
  ctx.stroke();
  ctx.fillStyle = "#fff2b8";
  ctx.font = `900 ${Math.max(18, 29 * scale)}px sans-serif`;
  ctx.fillText(title, w * 0.5, h * 0.205);
  ctx.fillStyle = "#ffd95f";
  ctx.font = `800 ${Math.max(14, 20 * scale)}px sans-serif`;
  ctx.fillText(sub, w * 0.5, h * 0.23);
  ctx.restore();
}

function drawBigGreetingText(ctx, w, h, greeting, greetingEn, sub, subEn) {
  const scale = Math.min(w / 720, h / 1280);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255, 235, 130, 0.95)";
  ctx.shadowBlur = 20 * scale;
  ctx.strokeStyle = "#780b07";
  ctx.lineWidth = 8 * scale;
  ctx.fillStyle = "#ffe06b";
  ctx.font = `900 ${Math.max(64, 126 * scale)}px serif`;
  const chars = greeting.split("");
  const startX = w * 0.5 - (chars.length - 1) * 54 * scale;
  chars.forEach((char, index) => {
    const y = h * 0.18 + Math.sin(index * 1.2) * 8 * scale;
    const x = startX + index * 108 * scale;
    ctx.strokeText(char, x, y);
    ctx.fillText(char, x, y);
  });

  ctx.shadowBlur = 10 * scale;
  ctx.font = `800 ${Math.max(24, 43 * scale)}px sans-serif`;
  ctx.strokeStyle = "#8f1710";
  ctx.lineWidth = 5 * scale;
  ctx.fillStyle = "#fff0b0";
  ctx.strokeText(sub, w * 0.5, h * 0.26);
  ctx.fillText(sub, w * 0.5, h * 0.26);

  ctx.fillStyle = "rgba(93, 7, 8, 0.7)";
  roundedRect(ctx, w * 0.18, h * 0.295, w * 0.64, 66 * scale, 8 * scale);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 229, 127, 0.68)";
  ctx.lineWidth = 2 * scale;
  roundedRect(ctx, w * 0.18, h * 0.295, w * 0.64, 66 * scale, 8 * scale);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff1b5";
  ctx.font = `900 ${Math.max(18, 30 * scale)}px sans-serif`;
  ctx.fillText(greetingEn, w * 0.5, h * 0.312);
  ctx.fillStyle = "#ffd85e";
  ctx.font = `800 ${Math.max(13, 19 * scale)}px sans-serif`;
  ctx.fillText(subEn, w * 0.5, h * 0.338);
  ctx.restore();
}

function drawGreetingFloralBorder(ctx, w, h, t, power, time) {
  const colors = time === "evening"
    ? ["#ff4f8a", "#ffd75e", "#58ddff"]
    : ["#ffd75e", "#ff5336", "#70d34f"];
  const count = 18 + Math.round(power * 12);
  for (let i = 0; i < count; i++) {
    const side = i % 2;
    const x = side ? w - 38 - (i % 3) * 12 : 38 + (i % 3) * 12;
    const y = ((i * 89 + t * 28) % (h + 120)) - 60;
    drawCheapFlower(ctx, x, y, 16 + (i % 4) * 5, colors[i % colors.length], t + i);
  }
}

function drawCheapFlower(ctx, x, y, r, color, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.4);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.ellipse(0, -r, r * 0.42, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fff3a8";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGoldIngotRain(ctx, w, h, t, power) {
  const count = 18 + Math.round(power * 26);
  for (let i = 0; i < count; i++) {
    const x = (i * 119 + t * 44) % w;
    const y = (i * 173 + t * 65) % h;
    drawIngot(ctx, x, y, 18 + (i % 4) * 5, Math.sin(t + i) * 0.18);
  }
}

function drawIngot(ctx, x, y, s, rotate) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  ctx.fillStyle = "rgba(255, 212, 82, 0.84)";
  ctx.strokeStyle = "rgba(136, 61, 8, 0.54)";
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.beginPath();
  ctx.moveTo(-s, s * 0.15);
  ctx.quadraticCurveTo(-s * 0.7, -s * 0.6, 0, -s * 0.35);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.6, s, s * 0.15);
  ctx.quadraticCurveTo(s * 0.45, s * 0.58, 0, s * 0.42);
  ctx.quadraticCurveTo(-s * 0.45, s * 0.58, -s, s * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSquareDancePoster(ctx, w, h, t, power, config = {}) {
  const copy = config.copy || {};
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#101c47");
  g.addColorStop(0.36, "#d41319");
  g.addColorStop(0.68, "#f46a1c");
  g.addColorStop(1, "#5a0508");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  drawSquareTiles(ctx, w, h);
  drawPosterRays(ctx, w, h, t);
  drawLanternRows(ctx, w, h, t, power);
  drawDiscoSun(ctx, w * 0.5, h * 0.36, Math.min(w, h) * 0.22, t);
  drawDancerCrowd(ctx, w, h, t, power);
  drawSceneCaption(
    ctx,
    w,
    h,
    copy.titleZh || "广场舞天团",
    copy.titleEn || "SQUARE DANCE CREW",
    copy.subtitleZh || "跟上节奏 好运翻倍",
    copy.subtitleEn || "MOVE TOGETHER, LUCK FOREVER",
  );
  drawSeal(ctx, w * 0.84, h * 0.18, Math.min(w, h) * 0.11, copy.seal || "舞");
}

function drawSquareTiles(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.strokeStyle = "rgba(255, 231, 125, 0.28)";
  ctx.lineWidth = 2;
  for (let x = -w; x < w * 2; x += 78) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(w * 0.5 + (x - w * 0.5) * 0.12, h * 0.62);
    ctx.stroke();
  }
  for (let y = h * 0.68; y < h; y += 58) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDiscoSun(ctx, x, y, r, t) {
  drawSun(ctx, x, y, r, "#ffef6e", 0.72);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(r * 0.2, Math.sin(t + i) * 4);
    ctx.lineTo(r * 0.96, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDancerCrowd(ctx, w, h, t, power) {
  const dancers = [
    [0.13, 0.76, "#ffdf5c", "#ca1820", -1],
    [0.28, 0.73, "#42d7ff", "#d91764", 1],
    [0.42, 0.8, "#ffef91", "#1c7ad8", -1],
    [0.58, 0.82, "#ffef91", "#d62424", 1],
    [0.74, 0.74, "#50e58d", "#a317d7", -1],
    [0.88, 0.78, "#ffd45c", "#1d9a62", 1],
  ];
  dancers.forEach(([px, py, shirt, pants, side], index) => {
    drawDancer(ctx, w * px, h * py + Math.sin(t * 3 + index) * 8, Math.min(w, h) * 0.18, shirt, pants, side, t + index, power);
  });
}

function drawDancer(ctx, x, y, s, shirt, pants, side, t, power) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
  ctx.shadowBlur = 12;

  ctx.fillStyle = "#f0bd8d";
  ctx.beginPath();
  ctx.arc(0, -76, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = shirt;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.lineTo(0, -12);
  ctx.stroke();

  ctx.strokeStyle = shirt;
  ctx.lineWidth = 10;
  const armLift = 42 + power * 20;
  ctx.beginPath();
  ctx.moveTo(-4, -48);
  ctx.lineTo(-48 * side, -72 - Math.sin(t * 2) * armLift * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, -48);
  ctx.lineTo(42 * side, -22 + Math.cos(t * 2) * 14);
  ctx.stroke();

  ctx.strokeStyle = pants;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(-28 + Math.sin(t * 3) * 8, 54);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(30 + Math.cos(t * 3) * 8, 54);
  ctx.stroke();
  ctx.restore();
}

function drawBellyParkPoster(ctx, w, h, t, power, config = {}) {
  const copy = config.copy || {};
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#7fd3ff");
  sky.addColorStop(0.52, "#77c35a");
  sky.addColorStop(1, "#f26424");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  drawSun(ctx, w * 0.78, h * 0.16, Math.min(w, h) * 0.18, "#fff07a", 0.72);
  drawParkTrees(ctx, w, h, t);
  drawParkPath(ctx, w, h);
  drawBellyUncles(ctx, w, h, t, power);
  drawSceneCaption(
    ctx,
    w,
    h,
    copy.titleZh || "公园纳凉局",
    copy.titleEn || "PARK COOLING CLUB",
    copy.subtitleZh || "背心卷起 才是夏天",
    copy.subtitleEn || "SUMMER STYLE, LOCAL LEGEND",
  );
  drawSeal(ctx, w * 0.16, h * 0.19, Math.min(w, h) * 0.11, copy.seal || "凉");
}

function drawParkTrees(ctx, w, h, t) {
  for (let i = 0; i < 9; i++) {
    const x = (i * 141 + 30) % w;
    const y = h * (0.42 + (i % 3) * 0.05);
    ctx.fillStyle = "#67401f";
    ctx.fillRect(x - 8, y, 16, h * 0.18);
    ctx.fillStyle = i % 2 ? "#207b3e" : "#2f9b48";
    ctx.beginPath();
    ctx.arc(x, y, 46 + (i % 3) * 9 + Math.sin(t + i) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParkPath(ctx, w, h) {
  ctx.fillStyle = "rgba(226, 185, 116, 0.78)";
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.55);
  ctx.quadraticCurveTo(w * 0.62, h * 0.72, w * 0.52, h);
  ctx.lineTo(w, h);
  ctx.lineTo(w, h * 0.58);
  ctx.quadraticCurveTo(w * 0.58, h * 0.62, w * 0.36, h * 0.55);
  ctx.fill();
}

function drawBellyUncles(ctx, w, h, t, power) {
  const people = [
    [0.18, 0.72, "#ffffff", "#274c9a", -0.15],
    [0.76, 0.7, "#f4e4bb", "#3c7a41", 0.12],
    [0.9, 0.78, "#e9f7ff", "#5b3921", -0.05],
  ];
  people.forEach(([px, py, shirt, shorts, lean], index) => {
    drawBellyUncle(ctx, w * px, h * py + Math.sin(t + index) * 5, Math.min(w, h) * 0.2, shirt, shorts, lean, t + index, power);
  });
}

function drawBellyUncle(ctx, x, y, s, shirt, shorts, lean, t, power) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(s / 100, s / 100);
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = 10;

  ctx.fillStyle = "#d99a68";
  ctx.beginPath();
  ctx.arc(0, -92, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.fillRect(-10, -112, 20, 7);

  ctx.fillStyle = shirt;
  roundedRect(ctx, -32, -75, 64, 62, 10);
  ctx.fill();
  ctx.fillStyle = "#d99a68";
  ctx.beginPath();
  ctx.ellipse(0, -24, 31 + power * 6, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(126, 61, 29, 0.42)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -24, 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#d99a68";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-28, -58);
  ctx.lineTo(-55, -18 + Math.sin(t) * 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, -58);
  ctx.lineTo(55, -22 + Math.cos(t) * 6);
  ctx.stroke();

  ctx.fillStyle = shorts;
  roundedRect(ctx, -34, -5, 68, 28, 7);
  ctx.fill();
  ctx.strokeStyle = "#d99a68";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-18, 20);
  ctx.lineTo(-30, 68);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(18, 20);
  ctx.lineTo(32, 68);
  ctx.stroke();
  ctx.restore();
}

function drawSceneCaption(ctx, w, h, title, titleEn, sub, subEn) {
  const scale = Math.min(w / 720, h / 1280);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255, 231, 110, 0.95)";
  ctx.shadowBlur = 18 * scale;
  ctx.strokeStyle = "#7d0b09";
  ctx.lineWidth = 7 * scale;
  ctx.fillStyle = "#ffe46b";
  ctx.font = `900 ${Math.max(48, 92 * scale)}px serif`;
  ctx.strokeText(title, w * 0.5, h * 0.17);
  ctx.fillText(title, w * 0.5, h * 0.17);

  ctx.shadowBlur = 8 * scale;
  ctx.fillStyle = "#fff1b2";
  ctx.strokeStyle = "#7d0b09";
  ctx.lineWidth = 4 * scale;
  ctx.font = `900 ${Math.max(20, 34 * scale)}px sans-serif`;
  ctx.strokeText(titleEn, w * 0.5, h * 0.22);
  ctx.fillText(titleEn, w * 0.5, h * 0.22);

  ctx.font = `800 ${Math.max(24, 40 * scale)}px sans-serif`;
  ctx.lineWidth = 4 * scale;
  ctx.fillStyle = "#fff2bd";
  ctx.strokeText(sub, w * 0.5, h * 0.27);
  ctx.fillText(sub, w * 0.5, h * 0.27);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(110, 6, 8, 0.72)";
  roundedRect(ctx, w * 0.2, h * 0.295, w * 0.6, 42 * scale, 7 * scale);
  ctx.fill();
  ctx.fillStyle = "#ffe06b";
  ctx.font = `800 ${Math.max(13, 19 * scale)}px sans-serif`;
  ctx.fillText(subEn, w * 0.5, h * 0.312);
  ctx.restore();
}

function drawFestivalBase(ctx, w, h, top, bottom, gold) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.7, bottom);
  g.addColorStop(1, "#09090b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  for (let x = -h; x < w + h; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h, h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSun(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(0.7, color);
  g.addColorStop(1, "rgba(243, 196, 90, 0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawLantern(ctx, x, y, size, sway) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.strokeStyle = "rgba(249, 218, 139, 0.8)";
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.9);
  ctx.lineTo(0, -size * 0.47);
  ctx.stroke();
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  glow.addColorStop(0, "rgba(255, 226, 126, 0.72)");
  glow.addColorStop(0.45, "rgba(223, 65, 46, 0.9)");
  glow.addColorStop(1, "rgba(223, 65, 46, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.43, size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e94635";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.34, size * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 225, 126, 0.7)";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.2, size * 0.46, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f5c45a";
  ctx.fillRect(-size * 0.27, -size * 0.55, size * 0.54, size * 0.11);
  ctx.fillRect(-size * 0.27, size * 0.43, size * 0.54, size * 0.11);
  ctx.restore();
}

function drawLanterns(ctx, w, h, t, power) {
  const count = 6 + Math.round(power * 4);
  for (let i = 0; i < count; i++) {
    const x = 90 + i * ((w - 180) / Math.max(1, count - 1));
    const y = 76 + Math.sin(t * 1.4 + i) * 7;
    drawLantern(ctx, x, y, 64 + (i % 2) * 20, Math.sin(t + i) * 0.08);
  }
}

function drawDragonRibbon(ctx, w, h, t, power) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(244, 194, 73, 0.6)";
  ctx.shadowBlur = 20;
  ctx.strokeStyle = "#f1c04f";
  ctx.lineWidth = 24 + power * 10;
  ctx.beginPath();
  for (let x = -80; x <= w + 80; x += 18) {
    const y = h * 0.63 + Math.sin(x * 0.012 + t * 1.7) * 66;
    if (x === -80) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#da332a";
  ctx.lineWidth = 12 + power * 5;
  ctx.stroke();
  ctx.fillStyle = "#f1c04f";
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 0.52 + Math.sin(t) * 24, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#15110d";
  ctx.beginPath();
  ctx.arc(w * 0.135, h * 0.51 + Math.sin(t) * 24, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSeal(ctx, x, y, size, text) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.06);
  ctx.fillStyle = "rgba(185, 30, 30, 0.88)";
  roundedRect(ctx, -size / 2, -size / 2, size, size, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 232, 201, 0.86)";
  ctx.lineWidth = 5;
  roundedRect(ctx, -size / 2 + 10, -size / 2 + 10, size - 20, size - 20, 5);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 232, 201, 0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size * 0.48}px serif`;
  ctx.fillText(text, 0, 4);
  ctx.restore();
}

function drawCurtains(ctx, w, h, t, power) {
  const width = w * (0.18 + power * 0.08);
  ["left", "right"].forEach((side) => {
    const x = side === "left" ? 0 : w - width;
    const g = ctx.createLinearGradient(x, 0, x + width, 0);
    g.addColorStop(0, "#5f0c14");
    g.addColorStop(0.45, "#c52b35");
    g.addColorStop(1, "#240913");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 32) {
      const wave = Math.sin(y * 0.03 + t) * 15;
      const edge = side === "left" ? x + width + wave : x - wave;
      ctx.lineTo(edge, y);
    }
    ctx.lineTo(side === "left" ? x : x + width, h);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = "#d49f38";
  ctx.fillRect(0, 0, w, 20);
}

function drawOperaClouds(ctx, w, h, t) {
  ctx.save();
  ctx.strokeStyle = "rgba(245, 212, 117, 0.72)";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const x = ((i * 210 + t * 30) % (w + 260)) - 130;
    const y = 150 + (i % 3) * 128;
    ctx.beginPath();
    ctx.arc(x, y, 38, Math.PI, Math.PI * 1.9);
    ctx.arc(x + 52, y - 6, 30, Math.PI * 0.9, Math.PI * 2);
    ctx.arc(x + 94, y, 34, Math.PI, Math.PI * 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStageLights(ctx, w, h, t) {
  for (let i = 0; i < 4; i++) {
    const x = w * (0.18 + i * 0.21);
    const g = ctx.createRadialGradient(x, 26, 0, x, h * 0.54, h * 0.58);
    const hue = i % 2 ? "232, 74, 67" : "243, 213, 117";
    g.addColorStop(0, `rgba(${hue}, 0.36)`);
    g.addColorStop(1, `rgba(${hue}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 26, 0);
    ctx.lineTo(x + 170 * Math.sin(t + i), h);
    ctx.lineTo(x - 170 * Math.cos(t + i), h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawStreetPerspective(ctx, w, h) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.strokeStyle = "rgba(244, 193, 75, 0.24)";
  ctx.lineWidth = 3;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.58);
    ctx.lineTo(w * 0.5 + i * 150, h);
    ctx.stroke();
  }
}

function drawLanternRows(ctx, w, h, t, power) {
  for (let row = 0; row < 3; row++) {
    const y = 92 + row * 96;
    const size = 64 - row * 10;
    const count = 6 + row * 2 + Math.round(power * 3);
    for (let i = 0; i < count; i++) {
      const x = (i + 0.5) * (w / count);
      drawLantern(ctx, x, y + Math.sin(t * 1.2 + i) * 5, size, Math.sin(t + i) * 0.06);
    }
  }
}

function drawGoldConfetti(ctx, w, h, t, power) {
  ctx.fillStyle = "rgba(244, 193, 75, 0.78)";
  const count = Math.round(55 + power * 75);
  for (let i = 0; i < count; i++) {
    const x = (i * 83 + t * 42) % w;
    const y = (i * 149 + t * 90) % h;
    ctx.fillRect(x, y, 3 + (i % 4), 8 + (i % 6));
  }
}

function drawMountains(ctx, w, h) {
  const colors = ["rgba(28, 48, 47, 0.84)", "rgba(38, 59, 49, 0.78)", "rgba(21, 31, 36, 0.86)"];
  colors.forEach((color, layer) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h * (0.52 + layer * 0.07));
    for (let x = 0; x <= w; x += 90) {
      const y = h * (0.45 + layer * 0.07) + Math.sin(x * 0.01 + layer) * 70;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  });
}

function drawWall(ctx, w, h, t) {
  ctx.save();
  ctx.translate(0, Math.sin(t * 0.4) * 4);
  ctx.fillStyle = "#6f5542";
  ctx.strokeStyle = "#2e2119";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-60, h * 0.7);
  ctx.bezierCurveTo(w * 0.25, h * 0.56, w * 0.45, h * 0.82, w + 80, h * 0.63);
  ctx.lineTo(w + 80, h * 0.76);
  ctx.bezierCurveTo(w * 0.45, h * 0.96, w * 0.25, h * 0.7, -60, h * 0.84);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const x = 90 + i * 135;
    const y = h * 0.67 + Math.sin(i) * 36;
    ctx.fillStyle = "#765a43";
    ctx.fillRect(x, y - 70, 72, 70);
    ctx.fillStyle = "#2e2119";
    ctx.fillRect(x + 12, y - 48, 48, 36);
  }
  ctx.restore();
}

function drawFirework(ctx, x, y, r, t, color, power) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.55 + power * 0.35;
  const phase = (t % 1.8) / 1.8;
  for (let i = 0; i < 18; i++) {
    const a = (Math.PI * 2 * i) / 18;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * phase * 0.38, Math.sin(a) * r * phase * 0.38);
    ctx.lineTo(Math.cos(a) * r * phase, Math.sin(a) * r * phase);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPorcelainPattern(ctx, w, h, t, power) {
  ctx.save();
  ctx.strokeStyle = "rgba(29, 91, 154, 0.45)";
  ctx.lineWidth = 3;
  const count = 9 + Math.round(power * 8);
  for (let i = 0; i < count; i++) {
    const x = ((i * 170 + t * 16) % (w + 180)) - 90;
    const y = 70 + (i % 5) * 130;
    ctx.beginPath();
    ctx.arc(x, y, 42, 0, Math.PI * 1.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 32, y - 20);
    ctx.quadraticCurveTo(x + 90, y - 42, x + 116, y + 22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBrushCircle(ctx, x, y, r, color) {
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.arc(x, y, r, 0.25, Math.PI * 1.78);
  ctx.stroke();
  ctx.restore();
}

function drawNeonGrid(ctx, w, h, t) {
  ctx.strokeStyle = "rgba(55, 214, 198, 0.26)";
  ctx.lineWidth = 2;
  for (let y = h * 0.54; y < h; y += 38) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(t + y) * 3);
    ctx.lineTo(w, y + Math.sin(t + y) * 3);
    ctx.stroke();
  }
  for (let x = 0; x <= w; x += 80) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.54);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

function drawNeonSigns(ctx, w, h, t, power) {
  const signs = [
    [90, 120, 156, 82, "#ee3e52", "喜"],
    [w - 250, 108, 170, 92, "#37d6c6", "龙"],
    [w - 220, h - 250, 135, 78, "#f5c45a", "夜"],
  ];
  signs.forEach(([x, y, sw, sh, color, text], i) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + power * 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    roundedRect(ctx, x, y + Math.sin(t + i) * 5, sw, sh, 8);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${sh * 0.5}px serif`;
    ctx.fillText(text, x + sw / 2, y + sh / 2 + Math.sin(t + i) * 5);
    ctx.restore();
  });
}

function applyPortraitClip(ctx, x, y, w, h, style) {
  ctx.beginPath();
  if (style === "circle") {
    const r = Math.min(w, h) / 2;
    ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
  } else if (style === "arch") {
    const r = w / 2;
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  } else if (style === "full") {
    roundedRect(ctx, x, y, w, h, 8);
  } else {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  }
}

function syncCanvasSize(canvas, canvasCtx, w, h) {
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  } else {
    canvasCtx.clearRect(0, 0, w, h);
  }
}

function drawCameraImage(ctx, x, y, boxW, boxH) {
  const vRatio = camera.videoWidth / camera.videoHeight;
  const bRatio = boxW / boxH;
  let sx = 0;
  let sy = 0;
  let sw = camera.videoWidth;
  let sh = camera.videoHeight;
  if (vRatio > bRatio) {
    sw = camera.videoHeight * bRatio;
    sx = (camera.videoWidth - sw) / 2;
  } else {
    sh = camera.videoWidth / bRatio;
    sy = (camera.videoHeight - sh) / 2;
  }
  if (mirrorToggle.checked) {
    ctx.translate(x + boxW, y);
    ctx.scale(-1, 1);
    ctx.drawImage(camera, sx, sy, sw, sh, 0, 0, boxW, boxH);
  } else {
    ctx.drawImage(camera, sx, sy, sw, sh, x, y, boxW, boxH);
  }
}

function drawPortraitMask(maskCtx, x, y, boxW, boxH, style, feather) {
  maskCtx.save();
  maskCtx.filter = `blur(${feather}px)`;
  maskCtx.fillStyle = "rgba(255, 255, 255, 0.98)";
  applyPortraitClip(
    maskCtx,
    x + feather * 0.25,
    y + feather * 0.25,
    boxW - feather * 0.5,
    boxH - feather * 0.5,
    style,
  );
  maskCtx.fill();
  maskCtx.restore();
}

function drawCameraLayer(ctx) {
  const ready = camera.readyState >= 2 && camera.videoWidth && camera.videoHeight;
  const size = Number(portraitSizeInput.value) / 100;
  const slot = templates[currentTemplate]?.personSlot || {};
  const style = maskStyleInput.value || slot.shape || "oval";
  const slotScale = slot.scale || 1;
  const vertical = H > W;
  let boxW = W * (vertical ? 0.58 : 0.38) * size * slotScale;
  let boxH = H * (vertical ? 0.43 : 0.74) * size * slotScale;
  if (style === "full") {
    boxW = W * (vertical ? 0.72 : 0.64) * size * slotScale;
    boxH = H * (vertical ? 0.48 : 0.72) * size * slotScale;
  }
  if (style === "circle") {
    boxW = boxH = Math.min(W, H) * 0.62 * size * slotScale;
  }
  const centerX = W * (slot.x || 0.5);
  const centerY = H * (slot.y || (vertical ? 0.42 : 0.54));
  const x = centerX - boxW / 2;
  const y = centerY - boxH / 2;
  const feather = Math.max(12, Math.min(W, H) * 0.028);

  ctx.save();
  ctx.shadowColor = "rgba(255, 198, 72, 0.72)";
  ctx.shadowBlur = 44;
  ctx.fillStyle = "rgba(255, 226, 124, 0.34)";
  applyPortraitClip(ctx, x - feather, y - feather, boxW + feather * 2, boxH + feather * 2, style);
  ctx.fill();
  ctx.restore();

  syncCanvasSize(portraitLayer, portraitLayerCtx, W, H);
  syncCanvasSize(portraitMask, portraitMaskCtx, W, H);

  if (ready) {
    portraitLayerCtx.save();
    applyPortraitClip(portraitLayerCtx, x, y, boxW, boxH, style);
    portraitLayerCtx.clip();
    drawCameraImage(portraitLayerCtx, x, y, boxW, boxH);
    portraitLayerCtx.restore();

    portraitLayerCtx.save();
    portraitLayerCtx.globalCompositeOperation = "source-atop";
    const warmth = portraitLayerCtx.createLinearGradient(x, y, x, y + boxH);
    warmth.addColorStop(0, "rgba(255, 233, 184, 0.16)");
    warmth.addColorStop(0.56, "rgba(224, 40, 23, 0.13)");
    warmth.addColorStop(1, "rgba(255, 92, 24, 0.22)");
    portraitLayerCtx.fillStyle = warmth;
    portraitLayerCtx.fillRect(x, y, boxW, boxH);
    portraitLayerCtx.restore();

    drawPortraitMask(portraitMaskCtx, x, y, boxW, boxH, style, feather);
    portraitLayerCtx.save();
    portraitLayerCtx.globalCompositeOperation = "destination-in";
    portraitLayerCtx.drawImage(portraitMask, 0, 0);
    portraitLayerCtx.restore();

    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(portraitLayer, 0, 0);
    ctx.restore();
  } else {
    ctx.save();
    applyPortraitClip(ctx, x, y, boxW, boxH, style);
    ctx.clip();
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.fillStyle = "rgba(249, 244, 232, 0.76)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 34px sans-serif";
    ctx.fillText("Start camera", x + boxW / 2, y + boxH / 2);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255, 232, 148, 0.42)";
  ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.006);
  applyPortraitClip(ctx, x - feather * 0.2, y - feather * 0.2, boxW + feather * 0.4, boxH + feather * 0.4, style);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const mist = ctx.createLinearGradient(0, y + boxH * 0.58, 0, y + boxH + feather * 3);
  mist.addColorStop(0, "rgba(255, 92, 24, 0)");
  mist.addColorStop(0.58, "rgba(255, 72, 18, 0.25)");
  mist.addColorStop(1, "rgba(188, 10, 13, 0.44)");
  ctx.fillStyle = mist;
  ctx.fillRect(Math.max(0, x - feather * 2), y + boxH * 0.52, Math.min(W, boxW + feather * 4), boxH * 0.52);
  ctx.restore();
}

function drawForeground(ctx, t) {
  const power = Number(fxIntensityInput.value) / 100;
  ctx.save();
  ctx.globalAlpha = 0.28 + power * 0.4;
  ctx.fillStyle = "#f4c14c";
  for (let i = 0; i < 22; i++) {
    const x = ((i * 67 + t * 28) % (W + 60)) - 30;
    const y = 38 + ((i * 113 + t * 20) % (H - 80));
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const title = templates[currentTemplate].name.toUpperCase();
  ctx.save();
  ctx.fillStyle = "rgba(6, 8, 10, 0.42)";
  roundedRect(ctx, 34, H - 90, 332, 48, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(249, 244, 232, 0.94)";
  ctx.font = "800 25px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, 56, H - 66);
  ctx.restore();
}

function drawCountdown(ctx) {
  if (!countdownUntil) return;
  const remaining = countdownUntil - performance.now();
  if (remaining <= 0) {
    countdownUntil = 0;
    return;
  }
  const total = countdownUntil - countdownStart;
  const number = Math.max(1, Math.ceil(remaining / 1000));
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f4c14c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 180px sans-serif";
  ctx.fillText(String(number), W / 2, H / 2);
  ctx.strokeStyle = "rgba(249, 244, 232, 0.9)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 132, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - remaining / total));
  ctx.stroke();
  ctx.restore();
}

function render() {
  const t = performance.now() / 1000;
  const power = Number(fxIntensityInput.value) / 100;
  templates[currentTemplate].draw(ctx, W, H, t, power);
  drawCameraLayer(ctx);
  drawForeground(ctx, t);
  drawCountdown(ctx);
  animationId = requestAnimationFrame(render);
}

function renderTemplateButtons() {
  templateGrid.innerHTML = "";
  templates.forEach((template, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "template-card";
    button.setAttribute("aria-pressed", String(index === currentTemplate));
    const preview = document.createElement("canvas");
    const storyPreview = outputFrameInput.value !== "wide";
    preview.width = storyPreview ? 180 : 320;
    preview.height = storyPreview ? 320 : 180;
    preview.style.aspectRatio = storyPreview ? "9 / 16" : "16 / 9";
    const label = document.createElement("span");
    label.textContent = template.name;
    button.append(preview, label);
    button.addEventListener("click", () => {
      currentTemplate = index;
      applyTemplateDefaults(index);
      renderTemplateButtons();
    });
    template.draw(preview.getContext("2d"), preview.width, preview.height, 0, 0.72);
    templateGrid.append(button);
  });
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
      audio: true,
    });
    camera.srcObject = stream;
    await camera.play();
    captureButton.disabled = false;
    recordButton.disabled = false;
    startButton.textContent = "Restart camera";
    setStatus("Camera is live");
  } catch (error) {
    setStatus("Camera blocked");
    alert("Camera access was blocked. Please allow camera permission for localhost.");
  }
}

function prepareDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = filename;
  downloadLink.hidden = false;
}

async function waitForCountdown() {
  if (!countdownToggle.checked) return;
  countdownStart = performance.now();
  countdownUntil = countdownStart + 3000;
  await new Promise((resolve) => setTimeout(resolve, 3050));
}

async function capturePhoto() {
  captureButton.disabled = true;
  await waitForCountdown();
  stage.toBlob((blob) => {
    if (!blob) return;
    prepareDownload(blob, `china-pop-studio-${Date.now()}.png`);
    photoPreview.src = URL.createObjectURL(blob);
    photoPreview.hidden = false;
    videoPreview.hidden = true;
    outputPanel.hidden = false;
    setStatus("Photo ready");
    captureButton.disabled = false;
  }, "image/png");
}

async function recordVideo() {
  if (recorder?.state === "recording") {
    recorder.stop();
    return;
  }
  recordButton.disabled = true;
  await waitForCountdown();
  recordedChunks = [];
  const seconds = Number(recordLengthInput.value);
  const canvasStream = stage.captureStream(30);
  const audioTrack = stream?.getAudioTracks()[0];
  if (audioTrack) canvasStream.addTrack(audioTrack);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  recorder = new MediaRecorder(canvasStream, { mimeType });
  recorder.ondataavailable = (event) => {
    if (event.data.size) recordedChunks.push(event.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    prepareDownload(blob, `china-pop-studio-${Date.now()}.webm`);
    videoPreview.src = URL.createObjectURL(blob);
    videoPreview.hidden = false;
    photoPreview.hidden = true;
    outputPanel.hidden = false;
    setStatus("Video ready");
    recordButton.textContent = "Record video";
    recordButton.disabled = false;
  };
  recorder.start();
  recordButton.textContent = "Recording...";
  setStatus(`Recording ${seconds}s`);
  setTimeout(() => {
    if (recorder?.state === "recording") recorder.stop();
  }, seconds * 1000);
}

startButton.addEventListener("click", startCamera);
captureButton.addEventListener("click", capturePhoto);
recordButton.addEventListener("click", recordVideo);
outputFrameInput.addEventListener("change", () => {
  setStageSize();
  renderTemplateButtons();
});

setStageSize();
applyTemplateDefaults(currentTemplate);
renderTemplateButtons();
render();
