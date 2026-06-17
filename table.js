const SEATS = ["bottom", "right", "top", "left"];

const form = document.querySelector(".table-controls");
const tabButtons = Array.from(document.querySelectorAll(".tab-button[data-seat]"));
const updateButton = document.getElementById("applyTableControls");
const updateStatus = document.getElementById("updateStatus");
const initializeRoundButton = document.getElementById("initializeRound");
const initializeContentButton = document.getElementById("initializeContent");

let activeSeat = "bottom";
let statusTimer = 0;
let isWindowsPlatform = false;

const tableState = {
  seats: {},
};

const INITIAL_WINDS = {
  bottom: "東",
  right: "南",
  top: "西",
  left: "北",
};

const TILE_BACK = "0*";
const INDICATOR_COUNT = 5;
const TILE_TOKEN_PATTERN = /0\*|[0-9][mpsz]/g;
const TILE_CALIBRATION_SAMPLE = "1m";
const TILE_CALIBRATION_MIN_RATIO = 0.75;
const TILE_CALIBRATION_MAX_RATIO = 1.18;
const TILE_Y_OFFSET_MIN_RATIO = -0.45;
const TILE_Y_OFFSET_MAX_RATIO = 0.18;

function markPlatformClasses() {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = [
    navigator.platform,
    navigator.userAgentData?.platform,
  ].filter(Boolean).join(" ").toLowerCase();
  const isWindows = userAgent.includes("windows") || platform.includes("win");
  isWindowsPlatform = isWindows;
  document.documentElement.classList.toggle("is-windows", isWindows);
}

function byName(name) {
  return form ? form.elements[name] : null;
}

function normalizeMultiline(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeIndicatorText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function padDoraIndicators(value) {
  const indicatorText = normalizeIndicatorText(value);
  const tileCount = indicatorText.match(TILE_TOKEN_PATTERN)?.length || 0;
  const backCount = Math.max(0, INDICATOR_COUNT - tileCount);
  return `${indicatorText}${TILE_BACK.repeat(backCount)}`;
}

function readPxVariable(element, name) {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) ? value : 0;
}

function readNumberVariable(element, name) {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) ? value : 0;
}

function measureTileMetrics(fontSize) {
  const measure = document.createElement("span");
  measure.textContent = TILE_CALIBRATION_SAMPLE;
  Object.assign(measure.style, {
    position: "absolute",
    left: "-9999px",
    top: "-9999px",
    visibility: "hidden",
    whiteSpace: "nowrap",
    fontFamily: '"MyFixedFont", system-ui, sans-serif',
    fontSize: `${fontSize}px`,
    lineHeight: "normal",
    fontVariantLigatures: "common-ligatures",
    fontFeatureSettings: '"liga" 1',
    fontSynthesis: "none",
    textRendering: "geometricPrecision",
  });

  document.body.appendChild(measure);
  const rect = measure.getBoundingClientRect();
  measure.remove();

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  let visualHeight = 0;
  let visualTopOffset = 0;
  let actualAscent = 0;
  let fontAscent = 0;
  let fontDescent = 0;
  if (context) {
    context.font = `${fontSize}px "MyFixedFont", system-ui, sans-serif`;
    const metrics = context.measureText(TILE_CALIBRATION_SAMPLE);
    actualAscent = metrics.actualBoundingBoxAscent || 0;
    const actualDescent = metrics.actualBoundingBoxDescent || 0;
    fontAscent = metrics.fontBoundingBoxAscent || 0;
    fontDescent = metrics.fontBoundingBoxDescent || 0;
    visualHeight = actualAscent + actualDescent;

    if (actualAscent && fontAscent && fontDescent) {
      visualTopOffset = fontAscent - actualAscent;
    }
  }

  return {
    width: rect.width,
    height: visualHeight || rect.height,
    topOffset: visualTopOffset,
    actualAscent,
    fontAscent,
    fontDescent,
  };
}

function getCalibratedFontSize(fontSize, targetWidth, targetHeight) {
  const metrics = measureTileMetrics(fontSize);
  if (!metrics.width || !metrics.height || !targetWidth || !targetHeight) {
    return fontSize;
  }

  const widthRatio = targetWidth / metrics.width;
  const heightRatio = targetHeight / metrics.height;
  const ratio = Math.min(widthRatio, heightRatio);

  if (ratio < TILE_CALIBRATION_MIN_RATIO || ratio > TILE_CALIBRATION_MAX_RATIO) {
    return fontSize;
  }

  return Math.round(fontSize * ratio * 10) / 10;
}

function getClampedTileYOffset(fontSize, lineHeightRatio) {
  const metrics = measureTileMetrics(fontSize);
  if (!Number.isFinite(metrics.topOffset)) {
    return 0;
  }

  const fontBoxHeight = metrics.fontAscent + metrics.fontDescent;
  const lineHeight = fontSize * lineHeightRatio;
  const topOffset = metrics.actualAscent && fontBoxHeight
    ? ((lineHeight - fontBoxHeight) / 2) + metrics.fontAscent - metrics.actualAscent
    : metrics.topOffset;
  const rawOffset = -topOffset;
  const minOffset = fontSize * TILE_Y_OFFSET_MIN_RATIO;
  const maxOffset = fontSize * TILE_Y_OFFSET_MAX_RATIO;
  return Math.round(Math.min(maxOffset, Math.max(minOffset, rawOffset)) * 10) / 10;
}

function calibrateTileFonts() {
  const table = document.querySelector(".mahjong-table");
  if (!table) {
    return;
  }

  const lineHeight = readNumberVariable(table, "--tile-line-height") || 0.855;
  const seatFont = readPxVariable(table, "--seat-font");
  const seatCell = readPxVariable(table, "--seat-cell");
  const mainFont = readPxVariable(table, "--main-font");
  const mainCell = readPxVariable(table, "--main-cell");

  const calibratedSeatFont = getCalibratedFontSize(seatFont, seatCell, seatFont * lineHeight);
  const calibratedMainFont = getCalibratedFontSize(mainFont, mainCell, mainFont * lineHeight);
  const seatYOffset = getClampedTileYOffset(calibratedSeatFont, lineHeight);
  const mainYOffset = getClampedTileYOffset(calibratedMainFont, lineHeight);

  table.style.setProperty("--seat-font", `${calibratedSeatFont}px`);
  table.style.setProperty("--main-font", `${calibratedMainFont}px`);
  table.style.setProperty("--seat-tile-y-offset", `${seatYOffset}px`);
  table.style.setProperty("--main-tile-y-offset", `${mainYOffset}px`);
}

function calibrateTileFontsWhenReady() {
  if (!isWindowsPlatform) {
    return;
  }

  if (!document.fonts || typeof document.fonts.load !== "function") {
    calibrateTileFonts();
    return;
  }

  const table = document.querySelector(".mahjong-table");
  const seatFont = table ? readPxVariable(table, "--seat-font") : 60;
  document.fonts
    .load(`${seatFont}px "MyFixedFont"`, TILE_CALIBRATION_SAMPLE)
    .then(() => document.fonts.ready)
    .then(calibrateTileFonts)
    .catch(calibrateTileFonts);
}

function getSeatElement(seat) {
  return document.querySelector(`.seat[data-seat="${seat}"]`);
}

function getRiverElement(seat) {
  return document.querySelector(`.river[data-seat="${seat}"] .river-text`);
}

function getSeatText(seat, selector) {
  const element = getSeatElement(seat)?.querySelector(selector);
  return element ? element.textContent.trim() : "";
}

function getMeldsText(seat) {
  const melds = Array.from(getSeatElement(seat)?.querySelectorAll(".meld-run") || []);
  return melds.map((meld) => meld.textContent.trim()).filter(Boolean).join("\n");
}

function getKitaCount(seat) {
  const value = getSeatElement(seat)?.querySelector(".kita")?.dataset.count;
  const count = Number.parseInt(value || "0", 10);
  return Number.isFinite(count) ? Math.max(0, Math.min(4, count)) : 0;
}

function readSeatFromTable(seat) {
  return {
    hand: getSeatText(seat, ".hand .tile"),
    draw: getSeatText(seat, ".draw .tile"),
    kita: getKitaCount(seat),
    melds: getMeldsText(seat),
    river: getRiverElement(seat)?.textContent.trim() || "",
  };
}

function readInitialState() {
  SEATS.forEach((seat) => {
    tableState.seats[seat] = readSeatFromTable(seat);
  });

  const doraIndicators = document.querySelector(".dora-indicators")?.textContent.trim() || "";
  if (!getControlValue("dora-indicators")) {
    setControlValue("dora-indicators", doraIndicators);
  }
}

function setControlValue(name, value) {
  const control = byName(name);
  if (control) {
    control.value = value;
  }
}

function getControlValue(name) {
  return byName(name)?.value || "";
}

function saveActiveSeatDraft() {
  tableState.seats[activeSeat] = {
    hand: getControlValue("hand").trim(),
    draw: getControlValue("draw").trim(),
    kita: Number.parseInt(getControlValue("kita") || "0", 10),
    melds: normalizeMultiline(getControlValue("melds")),
    river: normalizeMultiline(getControlValue("river")),
  };
}

function loadSeatDraft(seat) {
  const seatState = tableState.seats[seat] || readSeatFromTable(seat);
  setControlValue("hand", seatState.hand);
  setControlValue("draw", seatState.draw);
  setControlValue("kita", String(seatState.kita));
  setControlValue("melds", seatState.melds);
  setControlValue("river", seatState.river);
}

function setActiveTab(seat) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.seat === seat;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function createTileSpan(value) {
  const span = document.createElement("span");
  span.className = "tile";
  span.textContent = value;
  return span;
}

function setSingleTile(container, value) {
  if (!container) {
    return;
  }
  container.textContent = "";
  const tileText = String(value || "").trim();
  if (tileText) {
    container.appendChild(createTileSpan(tileText));
  }
}

function renderMelds(seat, value) {
  const container = getSeatElement(seat)?.querySelector(".melds");
  if (!container) {
    return;
  }
  container.textContent = "";
  normalizeMultiline(value).split("\n").filter(Boolean).forEach((meld) => {
    const span = document.createElement("span");
    span.className = "meld-run";
    span.textContent = meld;
    container.appendChild(span);
  });
}

function renderKita(seat, value) {
  const container = getSeatElement(seat)?.querySelector(".kita");
  if (!container) {
    return;
  }
  const count = Math.max(0, Math.min(4, Number.parseInt(value || "0", 10) || 0));
  container.dataset.count = String(count);
  setSingleTile(container, count > 0 ? "4z" : "");
}

function renderSeat(seat) {
  const seatState = tableState.seats[seat];
  const seatElement = getSeatElement(seat);
  if (!seatState || !seatElement) {
    return;
  }

  setSingleTile(seatElement.querySelector(".hand"), seatState.hand);
  setSingleTile(seatElement.querySelector(".draw"), seatState.draw);
  renderMelds(seat, seatState.melds);
  renderKita(seat, seatState.kita);

  const river = getRiverElement(seat);
  if (river) {
    river.textContent = normalizeMultiline(seatState.river);
  }
}

function renderScore(seat) {
  const wind = getControlValue(`${seat}-wind`);
  const score = getControlValue(`${seat}-score`);
  const content = document.querySelector(`.score-${seat} .score-content`);
  if (!content) {
    return;
  }
  content.textContent = "";
  [wind, score].forEach((value) => {
    const span = document.createElement("span");
    span.textContent = value;
    content.appendChild(span);
  });
}

function renderRound() {
  const round = getControlValue("round");
  const honba = getControlValue("honba");
  const riichiSticks = getControlValue("riichi-sticks");
  const roundTitle = document.querySelector(".round-title");
  const detailItems = document.querySelectorAll(".round-details span");

  if (roundTitle) {
    roundTitle.textContent = round;
  }
  if (detailItems[1]) {
    detailItems[1].textContent = `${honba} 本場`;
  }
  if (detailItems[2]) {
    detailItems[2].textContent = `供託 ${riichiSticks}`;
  }
}

function renderDoraIndicators() {
  const doraIndicators = document.querySelector(".dora-indicators");
  if (doraIndicators) {
    doraIndicators.textContent = padDoraIndicators(getControlValue("dora-indicators"));
  }
}

function renderTable() {
  renderRound();
  renderDoraIndicators();
  SEATS.forEach((seat) => {
    renderScore(seat);
    renderSeat(seat);
  });
}

function showStatus(message) {
  if (!updateStatus) {
    return;
  }
  window.clearTimeout(statusTimer);
  updateStatus.textContent = message;
  updateStatus.classList.add("is-visible");
  statusTimer = window.setTimeout(() => {
    updateStatus.textContent = "";
    updateStatus.classList.remove("is-visible");
  }, 1600);
}

function showUpdatedStatus() {
  showStatus("已更新");
}

function createEmptySeatState() {
  return {
    hand: "",
    draw: "",
    kita: 0,
    melds: "",
    river: "",
  };
}

function initializeRoundDraft() {
  setControlValue("round", "東 1 局");
  setControlValue("honba", "0");
  setControlValue("riichi-sticks", "0");

  SEATS.forEach((seat) => {
    setControlValue(`${seat}-score`, "25000");
    setControlValue(`${seat}-wind`, INITIAL_WINDS[seat]);
  });

  showStatus("場次已初始化，按更新套用");
}

function initializeContentDraft() {
  SEATS.forEach((seat) => {
    tableState.seats[seat] = createEmptySeatState();
  });
  setControlValue("dora-indicators", "");
  loadSeatDraft(activeSeat);
  showStatus("內容已初始化，按更新套用");
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextSeat = button.dataset.seat;
    if (!nextSeat || nextSeat === activeSeat) {
      return;
    }
    saveActiveSeatDraft();
    activeSeat = nextSeat;
    setActiveTab(activeSeat);
    loadSeatDraft(activeSeat);
  });
});

if (initializeRoundButton) {
  initializeRoundButton.addEventListener("click", initializeRoundDraft);
}

if (initializeContentButton) {
  initializeContentButton.addEventListener("click", initializeContentDraft);
}

if (updateButton) {
  updateButton.addEventListener("click", () => {
    saveActiveSeatDraft();
    renderTable();
    showUpdatedStatus();
  });
}

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveActiveSeatDraft();
    renderTable();
    showUpdatedStatus();
  });
}

markPlatformClasses();
readInitialState();
loadSeatDraft(activeSeat);
setActiveTab(activeSeat);
calibrateTileFontsWhenReady();
