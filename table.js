const SEATS = ["bottom", "right", "top", "left"];

const form = document.querySelector(".table-controls");
const tabButtons = Array.from(document.querySelectorAll(".tab-button[data-seat]"));
const updateButton = document.getElementById("applyTableControls");
const updateStatus = document.getElementById("updateStatus");
const initializeRoundButton = document.getElementById("initializeRound");
const initializeContentButton = document.getElementById("initializeContent");

let activeSeat = "bottom";
let statusTimer = 0;

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

readInitialState();
loadSeatDraft(activeSeat);
setActiveTab(activeSeat);
