import html2canvas from "https://esm.sh/html2canvas";

const input = document.getElementById("in");
const out = document.getElementById("out");
const outInner = document.getElementById("outInner") || out;
const fontSizeInput = document.getElementById("fontSize");
const fontSizeValue = document.getElementById("fontSizeValue");
const bgToggle = document.getElementById("bgToggle");
const screenshotButton = document.getElementById("screenshotButton");

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

function trimCanvasToContent(canvas, bgColor) {
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

  var padding = 2;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(w - 1, right + padding);
  bottom = Math.min(h - 1, bottom + padding);

  var trimmed = document.createElement("canvas");
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed.getContext("2d").drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
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
    var text = (outputArea.textContent || "").trim();
    if (!text) {
      return;
    }
    var bgEnabled = outputArea.classList.contains("has-bg");
    var bgColor = bgEnabled ? getComputedStyle(outputArea).backgroundColor : null;

    var container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.padding = "0";
    container.style.margin = "0";
    container.style.background = "transparent";
    container.style.zIndex = "-1";

    var clone = outputArea.cloneNode(true);
    clone.removeAttribute("id");
    clone.style.border = "none";
    clone.style.padding = "4px";
    clone.style.margin = "0";
    clone.style.borderRadius = "0";
    clone.style.minHeight = "0";
    clone.style.width = "auto";
    clone.style.height = "auto";
    clone.style.display = "inline-grid";
    clone.style.backgroundColor = bgEnabled ? bgColor : "transparent";

    container.appendChild(clone);
    document.body.appendChild(container);

    var options = { backgroundColor: bgColor, useCORS: true };
    html2canvas(clone, options)
      .then(function(canvas) {
        var resultCanvas = trimCanvasToContent(canvas, bgColor);
        var link = document.createElement("a");
        link.href = resultCanvas.toDataURL("image/png");
        link.download = "screenshot.png";
        link.click();
      })
      .catch(function(err) {
        console.error(err);
      })
      .then(function() {
        container.remove();
      });
  };
}

function render(){
  const v = input.value.trim();
  outInner.textContent = v ? v : "Empty";
}
input.addEventListener("input", render);
render();




