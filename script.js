const input = document.getElementById("in");
const out = document.getElementById("out");
const outInner = document.getElementById("outInner") || out;
const fontSizeInput = document.getElementById("fontSize");
const fontSizeValue = document.getElementById("fontSizeValue");
const bgToggle = document.getElementById("bgToggle");
const screenshotButton = document.getElementById("screenshotButton");
const SCREENSHOT_PADDING = 5;
const TILE_SHADOW_OFFSET_X = 1;
const TILE_SHADOW_OFFSET_Y = 2;
const TILE_SHADOW_BLUR = 1;
const TILE_SHADOW_COLOR = "rgba(0, 0, 0, 0.22)";

function setFontSize(px) {
  if (!Number.isFinite(px)) {
    return;
  }
  outInner.style.fontSize = `${px}px`;
  if (fontSizeValue) {
    fontSizeValue.textContent = String(px);
  }
  if (fontSizeInput && fontSizeInput.value !== String(px)) {
    fontSizeInput.value = String(px);
  }
}

function setBackground(enabled) {
  out.classList.toggle("has-bg", enabled);
  if (bgToggle) {
    bgToggle.checked = enabled;
  }
}

function parseRgbColor(color) {
  if (!color) {
    return null;
  }
  if (color === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  var m = String(color).match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/i);
  if (!m) {
    return null;
  }
  return {
    r: Math.round(Number(m[1])),
    g: Math.round(Number(m[2])),
    b: Math.round(Number(m[3])),
    a: m[4] == null ? 1 : Number(m[4]),
  };
}

function trimCanvasToContent(canvas, bgColor, padding) {
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return canvas;
  }

  var w = canvas.width;
  var h = canvas.height;
  if (!w || !h) {
    return canvas;
  }

  var data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch (e) {
    return canvas;
  }
  var top = h;
  var left = w;
  var right = -1;
  var bottom = -1;

  var bg = parseRgbColor(bgColor);
  var bgIsTransparent = !bg || bg.a === 0;
  var bgThreshold = 12;
  var outputPadding = Number.isFinite(padding) ? Math.max(0, Math.round(padding)) : 0;

  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      var r = data[i];
      var g = data[i + 1];
      var b = data[i + 2];
      var a = data[i + 3];

      if (bgIsTransparent) {
        if (a === 0) {
          continue;
        }
      } else {
        if (a === 0) {
          continue;
        }
        var d = Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
        if (d <= bgThreshold) {
          continue;
        }
      }

      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < left || bottom < top) {
    return canvas;
  }

  left = Math.max(0, left - outputPadding);
  top = Math.max(0, top - outputPadding);
  right = Math.min(w - 1, right + outputPadding);
  bottom = Math.min(h - 1, bottom + outputPadding);

  var trimmed = document.createElement("canvas");
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed.getContext("2d").drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
}

function getCaptureSafePadding() {
  var fontSize = parseFloat(getComputedStyle(outInner).fontSize);
  if (!Number.isFinite(fontSize)) {
    return 64;
  }
  return Math.max(32, Math.ceil(fontSize));
}

function waitForOutputFont(text) {
  if (!document.fonts || typeof document.fonts.load !== "function") {
    return Promise.resolve();
  }
  var fontSize = getComputedStyle(outInner).fontSize || "80px";
  return document.fonts.load(`${fontSize} "MyFixedFont"`, text || " ").then(function() {
    return document.fonts.ready;
  }).catch(function() {
    return undefined;
  });
}

function getCanvasFont(styles) {
  return [
    styles.fontStyle || "normal",
    styles.fontWeight || "400",
    styles.fontSize || "80px",
    styles.fontFamily || '"MyFixedFont", system-ui, sans-serif',
  ].join(" ");
}

function getLineHeightPx(styles) {
  var fontSize = parseFloat(styles.fontSize);
  var lineHeight = parseFloat(styles.lineHeight);
  if (Number.isFinite(lineHeight)) {
    if (lineHeight > 0 && lineHeight < 4 && Number.isFinite(fontSize)) {
      return fontSize * lineHeight;
    }
    return lineHeight;
  }

  return Number.isFinite(fontSize) ? fontSize * 0.855 : 68.4;
}

function createScreenshotCanvas(text, bgColor) {
  var styles = getComputedStyle(outInner);
  var font = getCanvasFont(styles);
  var lineHeight = getLineHeightPx(styles);
  var safePadding = getCaptureSafePadding();
  var measureCanvas = document.createElement("canvas");
  var measureCtx = measureCanvas.getContext("2d");
  var lines = text.replace(/\r\n?/g, "\n").split("\n");
  var bounds = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  };

  measureCtx.font = font;
  measureCtx.textBaseline = "alphabetic";

  var metrics = lines.map(function(line, index) {
    var lineMetrics = measureCtx.measureText(line || " ");
    var lineBounds = {
      text: line,
      baseline: index * lineHeight,
      left: -lineMetrics.actualBoundingBoxLeft || 0,
      top: -(lineMetrics.actualBoundingBoxAscent || parseFloat(styles.fontSize) || 80),
      right: lineMetrics.actualBoundingBoxRight || lineMetrics.width || 0,
      bottom: lineMetrics.actualBoundingBoxDescent || 0,
    };

    if (index === 0) {
      bounds.left = lineBounds.left;
      bounds.top = lineBounds.baseline + lineBounds.top;
      bounds.right = lineBounds.right;
      bounds.bottom = lineBounds.baseline + lineBounds.bottom;
    } else {
      bounds.left = Math.min(bounds.left, lineBounds.left);
      bounds.top = Math.min(bounds.top, lineBounds.baseline + lineBounds.top);
      bounds.right = Math.max(bounds.right, lineBounds.right);
      bounds.bottom = Math.max(bounds.bottom, lineBounds.baseline + lineBounds.bottom);
    }

    return lineBounds;
  });

  var canvas = document.createElement("canvas");
  canvas.width = Math.ceil(bounds.right - bounds.left + safePadding * 2);
  canvas.height = Math.ceil(bounds.bottom - bounds.top + safePadding * 2);

  var ctx = canvas.getContext("2d");
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = styles.color || "#000";
  ctx.shadowColor = TILE_SHADOW_COLOR;
  ctx.shadowBlur = TILE_SHADOW_BLUR;
  ctx.shadowOffsetX = TILE_SHADOW_OFFSET_X;
  ctx.shadowOffsetY = TILE_SHADOW_OFFSET_Y;
  metrics.forEach(function(lineBounds) {
    ctx.fillText(lineBounds.text, safePadding - bounds.left, safePadding - bounds.top + lineBounds.baseline);
  });

  return trimCanvasToContent(canvas, bgColor, SCREENSHOT_PADDING);
}

function downloadCanvas(canvas, filename) {
  var link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}

if (fontSizeInput) {
  const currentSize = parseInt(getComputedStyle(outInner).fontSize, 10);
  if (Number.isFinite(currentSize)) {
    setFontSize(currentSize);
  }
  fontSizeInput.addEventListener("input", function() {
    setFontSize(parseInt(fontSizeInput.value, 10));
  });
}

if (bgToggle) {
  bgToggle.addEventListener("change", function() {
    setBackground(bgToggle.checked);
  });
  setBackground(bgToggle.checked);
}

if (screenshotButton) {
  screenshotButton.onclick = function() {
    var outputArea = document.getElementById("out");
    var outputContent = document.getElementById("outInner") || outputArea;
    var text = (outputContent.textContent || "").trim();
    if (!text) {
      return;
    }
    var bgEnabled = outputArea.classList.contains("has-bg");
    var bgColor = bgEnabled ? getComputedStyle(outputArea).backgroundColor : null;

    waitForOutputFont(text).then(function() {
      downloadCanvas(createScreenshotCanvas(text, bgColor), "screenshot.png");
    }).catch(function(err) {
      console.error(err);
    });
  };
}

function render(){
  const v = input.value.trim();
  outInner.textContent = v ? v : "Empty";
}
input.addEventListener("input", render);
render();
