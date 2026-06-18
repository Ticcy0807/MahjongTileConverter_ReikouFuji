const SEATS = ["bottom", "right", "top", "left"];
const WINDS = ["東", "南", "西", "北"];
const AUTO_BACK_HAND_SEATS = ["right", "top", "left"];
const YONMA_TOTAL_TILE_COUNT = 136;
const SANMA_TOTAL_TILE_COUNT = 108;
const DEAD_WALL_TILE_COUNT = 14;

const form = document.querySelector(".table-controls");
const tabButtons = Array.from(document.querySelectorAll(".tab-button[data-seat]"));
const updateButton = document.getElementById("applyTableControls");
const updateStatus = document.getElementById("updateStatus");
const initializeRoundButton = document.getElementById("initializeRound");
const initializeContentButton = document.getElementById("initializeContent");
const screenshotButton = document.getElementById("captureTableScreenshot");
const tileDraftControls = ["hand", "draw", "kita", "melds", "river"];

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
const TILE_TOKEN_PATTERN = /0\*|[0-9][mpsz][ab]?/g;
const RIVER_TILE_PATTERN = /(0\*|[0-9][mpsz][ab]?)-?/g;
const TILE_CALIBRATION_SAMPLE = "1m";
const TILE_CALIBRATION_MIN_RATIO = 0.75;
const TILE_CALIBRATION_MAX_RATIO = 1.18;
const TILE_Y_OFFSET_MIN_RATIO = -0.45;
const TILE_Y_OFFSET_MAX_RATIO = 0.18;
const WINDOWS_FIREFOX_RIVER_SHIFT_RATIO = 0.1;
const SCREENSHOT_FILENAME = "mahjong-table.png";
const XHTML_NS = "http://www.w3.org/1999/xhtml";
const SCREENSHOT_FONT_URLS = [
  "./I.MahjongJPReikouFuji-Regular_table.woff2?v=20260618bbox",
  "https://ticcy0807.github.io/FontOnly/I.MahjongJPReikouFuji-Regular.woff2",
];

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

function countTileTokens(value) {
  return String(value || "").match(RIVER_TILE_PATTERN)?.length || 0;
}

function getMeldGroupCount(value) {
  const normalizedMelds = normalizeMultiline(value);
  return normalizedMelds ? normalizedMelds.split("\n").length : 0;
}

function getAutoBackHand(seat, seatState) {
  const handText = String(seatState?.hand || "").trim();
  if (handText || !AUTO_BACK_HAND_SEATS.includes(seat)) {
    return handText;
  }

  const backCount = Math.max(0, 13 - (getMeldGroupCount(seatState?.melds) * 3));
  return TILE_BACK.repeat(backCount);
}

function getKitaTileCount(value) {
  const count = Number.parseInt(value || "0", 10);
  return Number.isFinite(count) ? Math.max(0, Math.min(4, count)) : 0;
}

function readPxVariable(element, name) {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) ? value : 0;
}

function readNumberVariable(element, name) {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) ? value : 0;
}

function resolveLengthVariable(element, name) {
  if (!element) {
    return 0;
  }

  const rawValue = getComputedStyle(element).getPropertyValue(name).trim();
  if (/^-?(?:\d+|\d*\.\d+)px$/.test(rawValue)) {
    return Number.parseFloat(rawValue);
  }

  const probe = document.createElement("span");
  Object.assign(probe.style, {
    position: "absolute",
    left: "-9999px",
    top: "-9999px",
    visibility: "hidden",
    width: `var(${name})`,
    height: "0",
    overflow: "hidden",
  });
  element.appendChild(probe);
  const width = probe.offsetWidth || probe.getBoundingClientRect().width;
  probe.remove();
  return Number.isFinite(width) ? width : 0;
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
  updateAllSeatHandLayouts();
}

function calibrateTileFontsWhenReady() {
  if (!isWindowsPlatform) {
    return Promise.resolve();
  }

  if (!document.fonts || typeof document.fonts.load !== "function") {
    calibrateTileFonts();
    return Promise.resolve();
  }

  const table = document.querySelector(".mahjong-table");
  const seatFont = table ? readPxVariable(table, "--seat-font") : 60;
  return document.fonts
    .load(`${seatFont}px "MyFixedFont"`, TILE_CALIBRATION_SAMPLE)
    .then(() => document.fonts.ready)
    .then(calibrateTileFonts)
    .catch(calibrateTileFonts);
}

function calibrateRiverTileTextShift() {
  const table = document.querySelector(".mahjong-table");
  if (!table) {
    return;
  }

  const riverFont = readPxVariable(table, "--river-font") || readPxVariable(table, "--seat-font");
  const lineHeight = readNumberVariable(table, "--tile-line-height")
    || readNumberVariable(table, "--tile-glyph-height-ratio")
    || 0.8849;
  const domShift = getPositiveShift(getDomRiverTileTextShift(table));
  const canvasShift = getPositiveShift(getClampedTileYOffset(riverFont, lineHeight));
  const shift = domShift || canvasShift || getRiverTileTextFallbackShift(riverFont);
  const shiftRatio = riverFont ? Math.round((shift / riverFont) * 10000) / 10000 : 0;
  table.style.setProperty("--river-tile-text-shift", `${shift}px`);
  table.style.setProperty("--tile-text-shift-ratio", String(shiftRatio));
}

function getPositiveShift(value) {
  return Number.isFinite(value) && value >= 0.5 ? value : 0;
}

function getDomRiverTileTextShift(table) {
  const tile = table.querySelector(".river-tile, .indicator-tile");
  const text = tile?.querySelector(".river-tile-text, .indicator-tile-text");
  if (!tile || !text || !text.firstChild) {
    return NaN;
  }

  const tileRect = tile.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(text);
  const textRect = range.getBoundingClientRect();
  range.detach?.();

  if (!tileRect.height || !textRect.height) {
    return NaN;
  }

  const shift = tileRect.top - textRect.top;
  return Math.round(shift * 10) / 10;
}

function getRiverTileTextFallbackShift(fontSize) {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = [
    navigator.platform,
    navigator.userAgentData?.platform,
  ].filter(Boolean).join(" ").toLowerCase();
  const isWindows = userAgent.includes("windows") || platform.includes("win");
  const isFirefox = userAgent.includes("firefox");
  return isWindows && isFirefox
    ? Math.round(fontSize * WINDOWS_FIREFOX_RIVER_SHIFT_RATIO * 10) / 10
    : 0;
}

function calibrateRiverTileTextShiftWhenReady() {
  if (!document.fonts || typeof document.fonts.load !== "function") {
    calibrateRiverTileTextShift();
    return Promise.resolve();
  }

  const table = document.querySelector(".mahjong-table");
  const riverFont = table ? readPxVariable(table, "--river-font") : 60;
  return document.fonts
    .load(`${riverFont}px "MyFixedFont"`, TILE_CALIBRATION_SAMPLE)
    .then(() => document.fonts.ready)
    .then(calibrateRiverTileTextShift)
    .catch(calibrateRiverTileTextShift);
}

function getSeatElement(seat) {
  return document.querySelector(`.seat[data-seat="${seat}"]`);
}

function getRiverElement(seat) {
  return document.querySelector(`.river[data-seat="${seat}"] .river-text`);
}

function getRiverText(seat) {
  const element = getRiverElement(seat);
  return element?.dataset.value || element?.textContent.trim() || "";
}

function getSeatText(seat, selector) {
  const element = getSeatElement(seat)?.querySelector(selector);
  return element?.dataset.value || element?.textContent.trim() || "";
}

function getMeldsText(seat) {
  const melds = Array.from(getSeatElement(seat)?.querySelectorAll(".meld-run") || []);
  return melds.map((meld) => meld.dataset.value || meld.textContent.trim()).filter(Boolean).join("\n");
}

function getKitaCount(seat) {
  const value = getSeatElement(seat)?.querySelector(".kita")?.dataset.count;
  return getKitaTileCount(value);
}

function readSeatFromTable(seat) {
  return {
    hand: getSeatText(seat, ".hand"),
    draw: getSeatText(seat, ".draw"),
    kita: getKitaCount(seat),
    melds: getMeldsText(seat),
    river: getRiverText(seat),
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

function getGameMode() {
  return getControlValue("game-mode") === "sanma" ? "sanma" : "yonma";
}

function isSanmaMode() {
  return getGameMode() === "sanma";
}

function getVacantSeat() {
  const vacantSeat = getControlValue("vacant-seat");
  return ["right", "top", "left"].includes(vacantSeat) ? vacantSeat : "right";
}

function getActiveSeats() {
  const vacantSeat = isSanmaMode() ? getVacantSeat() : "";
  return SEATS.filter((seat) => seat !== vacantSeat);
}

function isActiveSeat(seat) {
  return getActiveSeats().includes(seat);
}

function getWindCycle() {
  return isSanmaMode() ? WINDS.slice(0, 3) : WINDS;
}

function getTotalTileCount() {
  return isSanmaMode() ? SANMA_TOTAL_TILE_COUNT : YONMA_TOTAL_TILE_COUNT;
}

function saveActiveSeatDraft(options = {}) {
  if (!options.force && !isActiveSeat(activeSeat)) {
    return;
  }

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

function syncWindControls(changedSeat) {
  const activeSeats = getActiveSeats();
  const windCycle = getWindCycle();
  const changedSeatIndex = activeSeats.indexOf(changedSeat);
  const changedWindIndex = windCycle.indexOf(getControlValue(`${changedSeat}-wind`));
  if (changedSeatIndex < 0 || changedWindIndex < 0) {
    return;
  }

  activeSeats.forEach((seat, seatIndex) => {
    const windIndex = (changedWindIndex + seatIndex - changedSeatIndex + windCycle.length) % windCycle.length;
    setControlValue(`${seat}-wind`, windCycle[windIndex]);
  });
}

function syncModeWinds() {
  const activeSeats = getActiveSeats();
  const windCycle = getWindCycle();

  activeSeats.forEach((seat, seatIndex) => {
    setControlValue(`${seat}-wind`, windCycle[seatIndex % windCycle.length]);
  });
}

function countSeatStateTiles(seat, seatState) {
  if (!seatState) {
    return 0;
  }

  return countTileTokens(getAutoBackHand(seat, seatState))
    + countTileTokens(seatState.draw)
    + countTileTokens(seatState.melds)
    + countTileTokens(seatState.river)
    + getKitaTileCount(seatState.kita);
}

function getRemainingTileCount() {
  const usedTileCount = getActiveSeats().reduce((total, seat) => {
    return total + countSeatStateTiles(seat, tableState.seats[seat]);
  }, 0);
  return getTotalTileCount() - DEAD_WALL_TILE_COUNT - usedTileCount;
}

function setActiveTab(seat) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.seat === seat;
    const isDisabled = !isActiveSeat(button.dataset.seat);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.disabled = isDisabled;
  });
}

function setSeatControlDisabled(seat, isDisabled) {
  [`${seat}-wind`, `${seat}-score`].forEach((name) => {
    const control = byName(name);
    if (control) {
      control.disabled = isDisabled;
      control.closest(".score-row")?.classList.toggle("is-disabled", isDisabled);
    }
  });
}

function setWindOptionAvailability(seat) {
  const control = byName(`${seat}-wind`);
  if (!control) {
    return;
  }

  Array.from(control.options).forEach((option) => {
    option.disabled = isSanmaMode() && option.value === "北";
  });
}

function setTileDraftControlsDisabled(isDisabled) {
  tileDraftControls.forEach((name) => {
    const control = byName(name);
    if (control) {
      control.disabled = isDisabled;
    }
  });
}

function ensureActiveSeatAvailable() {
  if (isActiveSeat(activeSeat)) {
    return;
  }

  activeSeat = getActiveSeats()[0] || "bottom";
  loadSeatDraft(activeSeat);
}

function applyModeControls() {
  const vacantControl = byName("vacant-seat");
  if (vacantControl) {
    vacantControl.disabled = !isSanmaMode();
  }

  SEATS.forEach((seat) => {
    setSeatControlDisabled(seat, !isActiveSeat(seat));
    setWindOptionAvailability(seat);
  });

  ensureActiveSeatAvailable();
  setActiveTab(activeSeat);
  setTileDraftControlsDisabled(!isActiveSeat(activeSeat));
}

function createMeasuredTile(token, tileClass, textClass) {
  const tile = document.createElement("span");
  tile.className = tileClass;
  if (token.endsWith("-")) {
    tile.classList.add("is-horizontal");
  }

  const text = document.createElement("span");
  text.className = textClass;
  text.textContent = token;
  tile.appendChild(text);

  return tile;
}

function renderTileLine(container, value, options = {}) {
  if (!container) {
    return;
  }

  const {
    lineClass = "seat-line",
    tileClass = "seat-tile",
    textClass = "seat-tile-text",
  } = options;
  const tileText = String(value || "").replace(/\s+/g, "");

  container.dataset.value = tileText;
  container.textContent = "";

  if (!tileText) {
    return;
  }

  const line = document.createElement("span");
  line.className = lineClass;
  Array.from(tileText.matchAll(RIVER_TILE_PATTERN)).forEach((match) => {
    line.appendChild(createMeasuredTile(match[0], tileClass, textClass));
  });

  if (!line.childElementCount) {
    line.textContent = tileText;
  }

  container.appendChild(line);
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
    renderTileLine(span, meld);
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
  renderTileLine(container, count > 0 ? "4z" : "");
}

function updateSeatHandLayout(seat) {
  const seatElement = getSeatElement(seat);
  const melds = seatElement?.querySelector(".melds");
  if (!seatElement || !melds) {
    return;
  }

  const meldWidth = Array.from(melds.children).reduce((total, meld) => {
    return total + (meld.scrollWidth || meld.getBoundingClientRect().width);
  }, 0);
  if (!meldWidth) {
    seatElement.style.setProperty("--hand-draw-shift", "0px");
    return;
  }

  const reservedMeldWidth = resolveLengthVariable(seatElement, "--melds-reserved-width");
  const kitaWidth = resolveLengthVariable(seatElement, "--kita-width");
  const meldDrawGap = resolveLengthVariable(seatElement, "--meld-draw-gap-width");
  const meldKitaAnchorShift = resolveLengthVariable(seatElement, "--meld-kita-anchor-shift");
  const pressureSign = readNumberVariable(seatElement, "--hand-pressure-sign") || -1;
  const pressureScale = readNumberVariable(seatElement, "--hand-pressure-scale") || 1;
  if (!reservedMeldWidth) {
    seatElement.style.setProperty("--hand-draw-shift", "0px");
    return;
  }

  const meldRatio = Math.min(1, meldWidth / reservedMeldWidth);
  const maxShift = meldKitaAnchorShift + (pressureSign * ((reservedMeldWidth + kitaWidth + meldDrawGap) / 2));
  const shift = Math.round(maxShift * meldRatio * pressureScale * 10) / 10;
  seatElement.style.setProperty("--hand-draw-shift", `${shift}px`);
}

function updateAllSeatHandLayouts() {
  SEATS.forEach(updateSeatHandLayout);
}

function renderRiver(seat, value) {
  const river = getRiverElement(seat);
  if (!river) {
    return;
  }
  const normalizedRiver = normalizeMultiline(value);
  river.dataset.value = normalizedRiver;
  river.textContent = "";
  normalizedRiver.split("\n").filter(Boolean).forEach((line) => {
    const span = document.createElement("span");
    span.className = "river-line";
    Array.from(line.matchAll(RIVER_TILE_PATTERN)).forEach((match) => {
      span.appendChild(createMeasuredTile(match[0], "river-tile", "river-tile-text"));
    });
    if (!span.childElementCount) {
      span.textContent = line;
    }
    river.appendChild(span);
  });
}

function renderSeat(seat) {
  const seatState = tableState.seats[seat];
  const seatElement = getSeatElement(seat);
  if (!seatState || !seatElement) {
    return;
  }

  if (!isActiveSeat(seat)) {
    renderTileLine(seatElement.querySelector(".hand"), "");
    renderTileLine(seatElement.querySelector(".draw"), "");
    renderMelds(seat, "");
    renderKita(seat, 0);
    updateSeatHandLayout(seat);
    renderRiver(seat, "");
    return;
  }

  renderTileLine(seatElement.querySelector(".hand"), getAutoBackHand(seat, seatState));
  renderTileLine(seatElement.querySelector(".draw"), seatState.draw);
  renderMelds(seat, seatState.melds);
  renderKita(seat, seatState.kita);
  updateSeatHandLayout(seat);
  renderRiver(seat, seatState.river);
}

function renderScore(seat) {
  const wind = getControlValue(`${seat}-wind`);
  const score = getControlValue(`${seat}-score`);
  const content = document.querySelector(`.score-${seat} .score-content`);
  if (!content) {
    return;
  }
  content.textContent = "";
  if (!isActiveSeat(seat)) {
    return;
  }

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
  if (detailItems[0]) {
    detailItems[0].textContent = String(getRemainingTileCount());
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
    const indicatorText = padDoraIndicators(getControlValue("dora-indicators"));
    const line = document.createElement("span");
    line.className = "indicator-line";
    doraIndicators.textContent = "";
    (indicatorText.match(TILE_TOKEN_PATTERN) || []).forEach((token) => {
      line.appendChild(createMeasuredTile(token, "indicator-tile", "indicator-tile-text"));
    });
    doraIndicators.appendChild(line);
  }
}

function renderTable() {
  applyModeControls();
  renderRound();
  renderDoraIndicators();
  SEATS.forEach((seat) => {
    renderScore(seat);
    renderSeat(seat);
  });
}

function absolutizeCssUrls(cssText) {
  return cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, url) => {
    const trimmedUrl = url.trim();
    if (/^(?:data:|blob:|https?:|file:|#)/i.test(trimmedUrl)) {
      return match;
    }

    return `url("${new URL(trimmedUrl, document.baseURI).href}")`;
  });
}

function getPageCssText() {
  return Array.from(document.styleSheets).map((sheet) => {
    try {
      return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
    } catch (error) {
      return "";
    }
  }).join("\n");
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function fetchFontDataUrl(fontPath) {
  const fontUrl = new URL(fontPath, document.baseURI);
  const response = await fetch(fontUrl.href);
  if (!response.ok) {
    throw new Error(`Unable to load font: ${fontUrl.href}`);
  }

  const fontData = arrayBufferToBase64(await response.arrayBuffer());
  return `data:font/woff2;base64,${fontData}`;
}

async function getScreenshotFontFaceCss() {
  for (const fontPath of SCREENSHOT_FONT_URLS) {
    try {
      const fontDataUrl = await fetchFontDataUrl(fontPath);
      return [
        "@font-face {",
        'font-family: "MyFixedFont";',
        `src: url("${fontDataUrl}") format("woff2");`,
        "ascent-override: 82.2927%;",
        "descent-override: 6.1951%;",
        "line-gap-override: 0%;",
        "font-display: block;",
        "}",
      ].join("");
    } catch (error) {
      console.warn(error);
    }
  }

  return "";
}

function inlineComputedStyles(source, clone) {
  if (!(source instanceof Element) || !(clone instanceof Element)) {
    return;
  }

  const styles = getComputedStyle(source);
  for (const property of styles) {
    clone.style.setProperty(
      property,
      styles.getPropertyValue(property),
      styles.getPropertyPriority(property),
    );
  }

  Array.from(source.children).forEach((sourceChild, index) => {
    inlineComputedStyles(sourceChild, clone.children[index]);
  });
}

function wrapCssCdata(cssText) {
  return `<![CDATA[${cssText.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadCanvasPng(canvas, filename) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof canvas.toBlob !== "function") {
        downloadDataUrl(canvas.toDataURL("image/png"), filename);
        resolve();
        return;
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          downloadDataUrl(canvas.toDataURL("image/png"), filename);
          resolve();
          return;
        }
        downloadBlob(blob, filename);
        resolve();
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

function waitForTableFonts() {
  if (!document.fonts || typeof document.fonts.load !== "function") {
    return Promise.resolve();
  }

  const table = document.querySelector(".mahjong-table");
  const seatFont = table ? readPxVariable(table, "--seat-font") : 60;
  const mainFont = table ? readPxVariable(table, "--main-font") : 88;
  return Promise.all([
    document.fonts.load(`${seatFont}px "MyFixedFont"`, TILE_CALIBRATION_SAMPLE),
    document.fonts.load(`${mainFont}px "MyFixedFont"`, TILE_CALIBRATION_SAMPLE),
  ]).then(() => document.fonts.ready).catch(() => undefined);
}

async function createTableScreenshotSvg(table) {
  const rect = table.getBoundingClientRect();
  const width = Math.ceil(rect.width || readPxVariable(table, "--table-width"));
  const height = Math.ceil(rect.height || readPxVariable(table, "--table-height"));
  const clone = table.cloneNode(true);
  clone.setAttribute("xmlns", XHTML_NS);
  inlineComputedStyles(table, clone);

  const fontFaceCss = await getScreenshotFontFaceCss();
  const cssText = `${fontFaceCss}\n${absolutizeCssUrls(getPageCssText())}`;
  const serializedTable = new XMLSerializer().serializeToString(clone);
  const foreignObjectHtml = [
    `<div xmlns="${XHTML_NS}" style="width:${width}px;height:${height}px;overflow:hidden;background:#fff;">`,
    `<style>${wrapCssCdata(cssText)}</style>`,
    serializedTable,
    "</div>",
  ].join("");
  const svgText = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><style type="text/css">${wrapCssCdata(fontFaceCss)}</style></defs>`,
    `<foreignObject width="100%" height="100%">`,
    foreignObjectHtml,
    "</foreignObject>",
    "</svg>",
  ].join("");

  return {
    width,
    height,
    svgText,
    blob: new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }),
  };
}

function renderSvgToCanvas(svgCapture) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgCapture.svgText)}`;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svgCapture.width;
      canvas.height = svgCapture.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is unavailable."));
        return;
      }
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => {
      reject(new Error("Unable to render table screenshot."));
    };
    image.src = dataUrl;
  });
}

async function captureTableScreenshot() {
  const table = document.querySelector(".mahjong-table");
  if (!table) {
    return;
  }

  await waitForTableFonts();
  const svgCapture = await createTableScreenshotSvg(table);
  try {
    const canvas = await renderSvgToCanvas(svgCapture);
    await downloadCanvasPng(canvas, SCREENSHOT_FILENAME);
    showStatus("截圖已下載");
  } catch (error) {
    console.error(error);
    showStatus("PNG 產生失敗");
  }
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
  syncModeWinds();
  applyModeControls();

  showStatus("場次已初始化，按更新套用");
}

function initializeContentDraft() {
  SEATS.forEach((seat) => {
    tableState.seats[seat] = createEmptySeatState();
  });
  setControlValue("dora-indicators", "");
  applyModeControls();
  loadSeatDraft(activeSeat);
  showStatus("內容已初始化，按更新套用");
}

function handleModeSettingsChange() {
  saveActiveSeatDraft({ force: true });
  syncModeWinds();
  applyModeControls();
  renderTable();
  showUpdatedStatus();
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextSeat = button.dataset.seat;
    if (!nextSeat || nextSeat === activeSeat || !isActiveSeat(nextSeat)) {
      return;
    }
    saveActiveSeatDraft();
    activeSeat = nextSeat;
    setActiveTab(activeSeat);
    loadSeatDraft(activeSeat);
    setTileDraftControlsDisabled(false);
  });
});

if (initializeRoundButton) {
  initializeRoundButton.addEventListener("click", initializeRoundDraft);
}

if (initializeContentButton) {
  initializeContentButton.addEventListener("click", initializeContentDraft);
}

SEATS.forEach((seat) => {
  const windControl = byName(`${seat}-wind`);
  if (windControl) {
    windControl.addEventListener("change", () => {
      syncWindControls(seat);
      applyModeControls();
    });
  }
});

["game-mode", "vacant-seat"].forEach((name) => {
  const control = byName(name);
  if (control) {
    control.addEventListener("change", handleModeSettingsChange);
  }
});

if (updateButton) {
  updateButton.addEventListener("click", () => {
    saveActiveSeatDraft();
    renderTable();
    showUpdatedStatus();
  });
}

if (screenshotButton) {
  screenshotButton.addEventListener("click", () => {
    captureTableScreenshot().catch((error) => {
      console.error(error);
      showStatus("截圖失敗");
    });
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
applyModeControls();
loadSeatDraft(activeSeat);
setActiveTab(activeSeat);
renderTable();
calibrateTileFontsWhenReady()
  .then(calibrateRiverTileTextShiftWhenReady)
  .catch(calibrateRiverTileTextShiftWhenReady);
