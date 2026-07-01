(function () {
  const STORAGE_KEY = "mk-lounge-static-scorer:v1";
  const STORAGE_VERSION = 1;
  const MAX_RACES = 12;
  const SCORE_TABLE = {
    1: 15,
    2: 12,
    3: 10,
    4: 9,
    5: 8,
    6: 7,
    7: 6,
    8: 5,
    9: 4,
    10: 3,
    11: 2,
    12: 1,
  };
  const RANK_TEMPLATE_BASE = "./assets/rank_templates";
  const RANK_SCORE_THRESHOLD = 0.62;
  const RANK_MIN_MATCHES = 10;
  const DETECTION_INTERVAL_MS = 650;
  const MATCH_CANDIDATE_COOLDOWN_MS = 5000;
  const NAME_X = 678;
  const NAME_Y = 62;
  const NAME_WIDTH = 230;
  const NAME_HEIGHT = 25;
  const NAME_ROW_STRIDE = 52;
  const FEATURE_WIDTH = NAME_WIDTH * 2;
  const FEATURE_HEIGHT = NAME_HEIGHT * 2;

  const els = {
    myTeamInput: document.getElementById("myTeamInput"),
    resetButton: document.getElementById("resetButton"),
    addRaceButton: document.getElementById("addRaceButton"),
    raceEntryGrid: document.getElementById("raceEntryGrid"),
    inputError: document.getElementById("inputError"),
    historyList: document.getElementById("historyList"),
    overlayRaceCount: document.getElementById("overlayRaceCount"),
    overlayRanking: document.getElementById("overlayRanking"),
    scoreboard: document.getElementById("scoreboard"),
    startCaptureButton: document.getElementById("startCaptureButton"),
    stopCaptureButton: document.getElementById("stopCaptureButton"),
    captureStatus: document.getElementById("captureStatus"),
    captureVideo: document.getElementById("captureVideo"),
    captureCanvas: document.getElementById("captureCanvas"),
    detectedResultImage: document.getElementById("detectedResultImage"),
    detectedResultPlaceholder: document.getElementById("detectedResultPlaceholder"),
    detectScores: document.getElementById("detectScores"),
    specimenStatus: document.getElementById("specimenStatus"),
    pendingMatchPanel: document.getElementById("pendingMatchPanel"),
    pendingMatchEntries: document.getElementById("pendingMatchEntries"),
    addPendingRaceButton: document.getElementById("addPendingRaceButton"),
    clearPendingRaceButton: document.getElementById("clearPendingRaceButton"),
  };
  let previousOverlayRaceCount = null;
  let raceUpdateTimer = 0;

  const state = loadState();
  const capture = {
    stream: null,
    timer: 0,
    metadata: null,
    templates: [],
    lastDetectedAt: 0,
    lastPendingAt: 0,
    lastFeatures: null,
  };

  function blankEntries() {
    return Array.from({ length: 12 }, (_, index) => {
      const position = index + 1;
      return {
        position,
        team: "",
        score: SCORE_TABLE[position],
      };
    });
  }

  function defaultState() {
    return {
      version: STORAGE_VERSION,
      myTeamTag: "",
      races: [],
      draftEntries: blankEntries(),
      specimens: [],
      pendingMatch: null,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultState();
      }
      const parsed = JSON.parse(raw);
      if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.races)) {
        return defaultState();
      }
      return {
        ...defaultState(),
        ...parsed,
        specimens: normalizeSpecimens(parsed.specimens || []),
        pendingMatch: null,
        draftEntries: normalizeEntries(parsed.draftEntries || blankEntries()),
        races: parsed.races.map((race, index) => ({
          raceNo: index + 1,
          entries: normalizeEntries(race.entries || []),
        })),
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizeSpecimens(specimens) {
    if (!Array.isArray(specimens)) {
      return [];
    }
    return specimens
      .filter((specimen) => specimen && specimen.team && specimen.feature)
      .map((specimen) => ({
        team: String(specimen.team).trim(),
        feature: String(specimen.feature),
      }))
      .filter((specimen) => specimen.team && specimen.feature);
  }

  function normalizeEntries(entries) {
    const byPosition = new Map();
    for (const entry of entries) {
      const position = Number(entry.position);
      if (Number.isInteger(position) && position >= 1 && position <= 12) {
        byPosition.set(position, {
          position,
          team: String(entry.team || "").trim(),
          score: SCORE_TABLE[position],
        });
      }
    }
    return Array.from({ length: 12 }, (_, index) => {
      const position = index + 1;
      return byPosition.get(position) || {
        position,
        team: "",
        score: SCORE_TABLE[position],
      };
    });
  }

  function rankingFromRaces(races) {
    const scores = new Map();
    for (const race of races) {
      for (const entry of race.entries) {
        const team = entry.team.trim();
        if (!team) {
          continue;
        }
        scores.set(team, (scores.get(team) || 0) + SCORE_TABLE[entry.position]);
      }
    }
    return Array.from(scores.entries())
      .map(([team, score]) => ({ team, score }))
      .sort((a, b) => b.score - a.score || a.team.localeCompare(b.team));
  }

  function validateEntries(entries) {
    if (entries.length !== 12) {
      return "12行分の入力が必要です。";
    }
    const missing = entries.filter((entry) => !entry.team.trim()).map((entry) => entry.position);
    if (missing.length > 0) {
      return `タグが未入力の順位があります: ${missing.join(", ")}`;
    }
    return "";
  }

  function showError(message) {
    els.inputError.textContent = message;
    els.inputError.hidden = !message;
  }

  function renderDraftInputs() {
    els.raceEntryGrid.innerHTML = "";
    for (const entry of state.draftEntries) {
      const row = document.createElement("label");
      row.className = "entry-row";

      const position = document.createElement("span");
      position.className = "position-chip";
      position.textContent = entry.position;

      const input = document.createElement("input");
      input.type = "text";
      input.autocomplete = "off";
      input.placeholder = "タグ";
      input.value = entry.team;
      input.addEventListener("input", () => {
        entry.team = input.value.trim();
        saveState();
      });

      const score = document.createElement("span");
      score.className = "score-chip";
      score.textContent = `+${entry.score}`;

      row.append(position, input, score);
      els.raceEntryGrid.append(row);
    }
  }

  function renderOverlay() {
    const ranking = rankingFromRaces(state.races);
    const raceCount = state.races.length;
    const raceCountChanged = previousOverlayRaceCount !== null && raceCount !== previousOverlayRaceCount;
    previousOverlayRaceCount = raceCount;
    els.overlayRaceCount.textContent = `Race ${raceCount} / ${MAX_RACES}`;
    els.overlayRanking.innerHTML = "";
    els.scoreboard.classList.toggle("no-ranking", ranking.length === 0);
    if (raceCountChanged) {
      triggerRaceUpdateAnimation();
    }
    if (ranking.length === 0) {
      return;
    }
    ranking.forEach((item, index) => {
      const next = ranking[index + 1];
      const gap = next ? item.score - next.score : null;
      const row = document.createElement("div");
      row.className = `team-row${isMyTeam(item.team) ? " own-team" : ""}`;
      row.innerHTML = `
        <span class="team-name"></span>
        <span class="team-score">${renderScore(item.score)}</span>
        ${renderGapBetween(gap)}
      `;
      row.querySelector(".team-name").textContent = item.team;
      els.overlayRanking.append(row);
    });
  }

  function triggerRaceUpdateAnimation() {
    window.clearTimeout(raceUpdateTimer);
    els.scoreboard.classList.remove("race-updated");
    els.overlayRaceCount.classList.remove("race-count-updated");
    void els.scoreboard.offsetWidth;
    els.scoreboard.classList.add("race-updated");
    els.overlayRaceCount.classList.add("race-count-updated");
    raceUpdateTimer = window.setTimeout(() => {
      els.scoreboard.classList.remove("race-updated");
      els.overlayRaceCount.classList.remove("race-count-updated");
    }, 900);
  }

  function renderScore(score) {
    return String(score)
      .trim()
      .split("")
      .map((char) => `<span class="score-digit">${escapeHtml(char)}</span>`)
      .join("");
  }

  function renderGapBetween(gap) {
    if (!Number.isFinite(gap)) {
      return "";
    }
    return `<span class="rank-gap">${renderScore(Math.max(0, gap))}</span>`;
  }

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }

  function renderHistory() {
    els.historyList.innerHTML = "";
    if (state.races.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Race Historyはまだ空です。";
      els.historyList.append(empty);
      return;
    }
    [...state.races].reverse().forEach((race) => {
      const card = document.createElement("article");
      card.className = "history-card";

      const title = document.createElement("h3");
      title.textContent = `Race ${race.raceNo}`;
      const deleteButton = document.createElement("button");
      deleteButton.className = "icon-danger-button";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteRace(race.raceNo));
      const cardHeader = document.createElement("div");
      cardHeader.className = "history-card-header";
      cardHeader.append(title, deleteButton);

      const entries = document.createElement("div");
      entries.className = "history-entries";

      for (const entry of race.entries) {
        const row = document.createElement("label");
        row.className = "history-row";
        const pos = document.createElement("span");
        pos.className = "position-chip";
        pos.textContent = entry.position;
        const input = document.createElement("input");
        input.type = "text";
        input.autocomplete = "off";
        input.value = entry.team;
        input.addEventListener("input", () => {
          entry.team = input.value.trim();
          if (race.raceNo === 1) {
            syncSpecimenTeamsFromFirstRace();
          }
          saveState();
          renderOverlay();
          renderSpecimenStatus();
        });
        const score = document.createElement("span");
        score.className = "score-chip";
        score.textContent = entry.score;
        row.append(pos, input, score);
        entries.append(row);
      }

      card.append(cardHeader, entries);
      els.historyList.append(card);
    });
  }

  function renderSpecimenStatus() {
    const count = state.specimens.length;
    if (count >= 12) {
      els.specimenStatus.textContent = `標本 ${count}件`;
    } else if (state.races.length === 0 && !capture.lastFeatures) {
      els.specimenStatus.textContent = "標本なし: 1レース目入力とリザルト検出で自動作成";
    } else if (state.races.length === 0) {
      els.specimenStatus.textContent = "標本待ち: 1レース目を入力してください";
    } else if (!capture.lastFeatures) {
      els.specimenStatus.textContent = "標本待ち: 1レース目のリザルトを検出してください";
    } else {
      els.specimenStatus.textContent = "標本作成準備完了";
    }
  }

  function renderPendingMatch() {
    if (!state.pendingMatch) {
      els.pendingMatchPanel.hidden = true;
      els.pendingMatchEntries.innerHTML = "";
      return;
    }
    els.pendingMatchPanel.hidden = false;
    els.pendingMatchEntries.innerHTML = "";
    for (const entry of state.pendingMatch.entries) {
      const row = document.createElement("div");
      row.className = "pending-entry";
      row.innerHTML = `
        <span>${entry.position}</span>
        <span></span>
        <span>+${entry.score}</span>
      `;
      row.querySelector("span:nth-child(2)").textContent = entry.team;
      els.pendingMatchEntries.append(row);
    }
  }

  function isMyTeam(team) {
    return state.myTeamTag && team.toLowerCase() === state.myTeamTag.toLowerCase();
  }

  function addRaceFromDraft() {
    if (state.races.length >= MAX_RACES) {
      showError("12レースまで追加済みです。新しく始める場合はReset Allしてください。");
      return;
    }
    const entries = normalizeEntries(state.draftEntries);
    const error = validateEntries(entries);
    if (error) {
      showError(error);
      return;
    }
    showError("");
    state.races.push({
      raceNo: state.races.length + 1,
      entries,
    });
    state.draftEntries = blankEntries();
    maybeBuildFirstRaceSpecimens();
    saveState();
    renderAll();
  }

  function maybeBuildFirstRaceSpecimens() {
    if (!capture.lastFeatures || state.races.length === 0 || state.specimens.length >= 12) {
      return false;
    }
    const sourceRace = state.races[0];
    state.specimens = sourceRace.entries.map((entry) => ({
      team: entry.team,
      feature: uint8ToBase64(capture.lastFeatures[entry.position - 1]),
    }));
    state.pendingMatch = null;
    return true;
  }

  function syncSpecimenTeamsFromFirstRace() {
    const firstRace = state.races[0];
    if (!firstRace || state.specimens.length < 12) {
      return;
    }
    for (const entry of firstRace.entries) {
      const specimen = state.specimens[entry.position - 1];
      if (specimen) {
        specimen.team = entry.team;
      }
    }
  }

  function addPendingRace() {
    if (!state.pendingMatch) {
      return;
    }
    if (state.races.length >= MAX_RACES) {
      showError("12レースまで追加済みです。新しく始める場合はReset Allしてください。");
      return;
    }
    state.races.push({
      raceNo: state.races.length + 1,
      entries: normalizeEntries(state.pendingMatch.entries),
    });
    state.pendingMatch = null;
    saveState();
    showError("");
    renderAll();
  }

  function clearPendingRace() {
    state.pendingMatch = null;
    saveState();
    renderPendingMatch();
  }

  function deleteRace(raceNo) {
    if (!window.confirm(`Race ${raceNo} を削除します。よろしいですか？`)) {
      return;
    }
    state.races = state.races
      .filter((race) => race.raceNo !== raceNo)
      .map((race, index) => ({
        ...race,
        raceNo: index + 1,
      }));
    if (raceNo === 1) {
      state.specimens = [];
      state.pendingMatch = null;
    }
    saveState();
    renderAll();
  }

  function resetAll() {
    if (!window.confirm("すべての履歴、設定、保存データを削除します。よろしいですか？")) {
      return;
    }
    const fresh = defaultState();
    state.version = fresh.version;
    state.myTeamTag = fresh.myTeamTag;
    state.races = fresh.races;
    state.draftEntries = fresh.draftEntries;
    state.specimens = fresh.specimens;
    state.pendingMatch = fresh.pendingMatch;
    capture.lastFeatures = null;
    localStorage.removeItem(STORAGE_KEY);
    showError("");
    renderAll();
  }

  function bindEvents() {
    els.addRaceButton.addEventListener("click", addRaceFromDraft);
    els.resetButton.addEventListener("click", resetAll);
    els.startCaptureButton.addEventListener("click", startCapture);
    els.stopCaptureButton.addEventListener("click", stopCapture);
    els.addPendingRaceButton.addEventListener("click", addPendingRace);
    els.clearPendingRaceButton.addEventListener("click", clearPendingRace);
    els.myTeamInput.addEventListener("input", () => {
      state.myTeamTag = els.myTeamInput.value.trim();
      saveState();
      renderAll();
    });
  }

  function renderAll() {
    els.myTeamInput.value = state.myTeamTag;
    renderDraftInputs();
    renderHistory();
    renderOverlay();
    renderSpecimenStatus();
    renderPendingMatch();
  }

  async function startCapture() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setCaptureStatus("このブラウザは画面共有に対応していません。", "error");
      return;
    }
    try {
      await ensureRankTemplates();
      capture.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 15, max: 30 },
        },
        audio: false,
      });
      els.captureVideo.srcObject = capture.stream;
      els.startCaptureButton.disabled = true;
      els.stopCaptureButton.disabled = false;
      setCaptureStatus("画面共有中。リザルト画面を監視しています。");
      capture.timer = window.setInterval(scanSharedFrame, DETECTION_INTERVAL_MS);
      capture.stream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", stopCapture);
      });
    } catch (error) {
      setCaptureStatus(`画面共有を開始できませんでした: ${error.message || error}`, "error");
      stopCapture();
    }
  }

  function stopCapture() {
    if (capture.timer) {
      window.clearInterval(capture.timer);
      capture.timer = 0;
    }
    if (capture.stream) {
      capture.stream.getTracks().forEach((track) => track.stop());
      capture.stream = null;
    }
    els.captureVideo.srcObject = null;
    els.startCaptureButton.disabled = false;
    els.stopCaptureButton.disabled = true;
    if (!els.captureStatus.classList.contains("error")) {
      setCaptureStatus("停止しました。");
    }
  }

  function setCaptureStatus(message, kind = "") {
    els.captureStatus.textContent = message;
    els.captureStatus.className = `capture-status${kind ? ` ${kind}` : ""}`;
  }

  async function ensureRankTemplates() {
    if (capture.metadata && capture.templates.length === 12) {
      return;
    }
    const response = await fetch(`${RANK_TEMPLATE_BASE}/metadata.json`);
    if (!response.ok) {
      throw new Error("順位テンプレートを読み込めませんでした。HTTPサーバー経由で開いてください。");
    }
    capture.metadata = await response.json();
    capture.templates = [];
    for (const file of capture.metadata.files) {
      const image = await loadImage(`${RANK_TEMPLATE_BASE}/${file}`);
      const pixels = imageToGrayscaleVector(image, capture.metadata.rank_roi.width, capture.metadata.rank_roi.height);
      capture.templates.push(normalizeVector(pixels));
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`画像を読み込めませんでした: ${src}`));
      image.src = src;
    });
  }

  function imageToGrayscaleVector(image, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);
    return imageDataToVector(ctx.getImageData(0, 0, width, height));
  }

  function imageDataToVector(imageData) {
    const data = imageData.data;
    const values = new Float32Array(imageData.width * imageData.height);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
      values[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    }
    return values;
  }

  function normalizeVector(values) {
    let sum = 0;
    for (const value of values) {
      sum += value;
    }
    const mean = sum / values.length;
    let norm = 0;
    const normalized = new Float32Array(values.length);
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i] - mean;
      normalized[i] = value;
      norm += value * value;
    }
    const scale = Math.sqrt(norm) || 1;
    for (let i = 0; i < normalized.length; i += 1) {
      normalized[i] /= scale;
    }
    return normalized;
  }

  function scanSharedFrame() {
    if (
      !capture.metadata ||
      els.captureVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      els.captureVideo.videoWidth === 0 ||
      els.captureVideo.videoHeight === 0
    ) {
      return;
    }
    const canvas = els.captureCanvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(els.captureVideo, 0, 0, canvas.width, canvas.height);
    const result = detectResultScreen(ctx);
    renderDetectionScores(result.scores);
    if (result.detected) {
      capture.lastDetectedAt = Date.now();
      showDetectedResultScreenshot(canvas);
      handleDetectedFrame(ctx);
      setCaptureStatus(`リザルト画面を検出しました。rank_matches=${result.matches}`, "detected");
    } else {
      setCaptureStatus(`監視中。rank_matches=${result.matches}`);
    }
  }

  function showDetectedResultScreenshot(canvas) {
    els.detectedResultImage.style.backgroundImage = `url("${canvas.toDataURL("image/jpeg", 0.82)}")`;
    els.detectedResultImage.hidden = false;
    els.detectedResultPlaceholder.hidden = true;
  }

  function handleDetectedFrame(ctx) {
    capture.lastFeatures = extractNameFeatures(ctx);
    const builtSpecimens = maybeBuildFirstRaceSpecimens();
    if (builtSpecimens) {
      saveState();
    }
    renderSpecimenStatus();
    if (builtSpecimens || state.specimens.length < 12 || state.pendingMatch || state.races.length >= MAX_RACES) {
      return;
    }
    const now = Date.now();
    if (now - capture.lastPendingAt < MATCH_CANDIDATE_COOLDOWN_MS) {
      return;
    }
    const matched = matchFeatures(capture.lastFeatures);
    if (!matched) {
      return;
    }
    state.pendingMatch = {
      entries: matched,
      createdAt: now,
    };
    capture.lastPendingAt = now;
    saveState();
    renderPendingMatch();
  }

  function extractNameFeatures(ctx) {
    const features = [];
    for (let row = 0; row < 12; row += 1) {
      const y = NAME_Y + NAME_ROW_STRIDE * row;
      const imageData = ctx.getImageData(NAME_X, y, NAME_WIDTH, NAME_HEIGHT);
      features.push(featureFromNameImageData(imageData));
    }
    return features;
  }

  function featureFromNameImageData(imageData) {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = imageData.width;
    sourceCanvas.height = imageData.height;
    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    sourceCtx.putImageData(imageData, 0, 0);

    const featureCanvas = document.createElement("canvas");
    featureCanvas.width = FEATURE_WIDTH;
    featureCanvas.height = FEATURE_HEIGHT;
    const featureCtx = featureCanvas.getContext("2d", { willReadFrequently: true });
    featureCtx.imageSmoothingEnabled = true;
    featureCtx.drawImage(sourceCanvas, 0, 0, FEATURE_WIDTH, FEATURE_HEIGHT);

    const resized = featureCtx.getImageData(0, 0, FEATURE_WIDTH, FEATURE_HEIGHT);
    const data = resized.data;
    const feature = new Uint8Array(FEATURE_WIDTH * FEATURE_HEIGHT);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const total = r + g + b;
      let value = 255 - total / 3;
      if (550 - total < 120) {
        value = 255;
      }
      if (765 - total > 500) {
        value = 255;
      }
      feature[j] = Math.max(0, Math.min(255, Math.round(value)));
    }
    return feature;
  }

  function matchFeatures(features) {
    const specimens = state.specimens.map((specimen) => ({
      team: specimen.team,
      feature: base64ToUint8(specimen.feature),
    }));
    if (specimens.length < 12) {
      return null;
    }
    const scoreMatrix = features.map((feature) => specimens.map((specimen) => -l1Distance(feature, specimen.feature)));
    const assignment = maximizeAssignment(scoreMatrix);
    if (!assignment) {
      return null;
    }
    return assignment.map((specimenIndex, rowIndex) => {
      const position = rowIndex + 1;
      return {
        position,
        team: specimens[specimenIndex].team,
        score: SCORE_TABLE[position],
        matchScore: scoreMatrix[rowIndex][specimenIndex],
      };
    });
  }

  function l1Distance(a, b) {
    let distance = 0;
    for (let i = 0; i < a.length; i += 1) {
      distance += Math.abs(a[i] - b[i]);
    }
    return distance;
  }

  function detectResultScreen(ctx) {
    const roi = capture.metadata.rank_roi;
    const scores = [];
    let matches = 0;
    for (let index = 0; index < 12; index += 1) {
      const y = roi.y + roi.row_stride * index;
      const imageData = ctx.getImageData(roi.x, y, roi.width, roi.height);
      const actual = normalizeVector(imageDataToVector(imageData));
      const score = dot(actual, capture.templates[index]);
      scores.push(score);
      if (score >= RANK_SCORE_THRESHOLD) {
        matches += 1;
      }
    }
    return {
      detected: matches >= RANK_MIN_MATCHES,
      matches,
      scores,
    };
  }

  function dot(a, b) {
    let score = 0;
    for (let i = 0; i < a.length; i += 1) {
      score += a[i] * b[i];
    }
    return score;
  }

  function maximizeAssignment(scoreMatrix) {
    const rows = scoreMatrix.length;
    const cols = scoreMatrix[0]?.length || 0;
    if (rows === 0 || cols < rows) {
      return null;
    }
    let maxScore = -Infinity;
    for (const row of scoreMatrix) {
      for (const score of row) {
        maxScore = Math.max(maxScore, score);
      }
    }
    const cost = scoreMatrix.map((row) => row.map((score) => maxScore - score));
    const u = Array(rows + 1).fill(0);
    const v = Array(cols + 1).fill(0);
    const p = Array(cols + 1).fill(0);
    const way = Array(cols + 1).fill(0);

    for (let i = 1; i <= rows; i += 1) {
      p[0] = i;
      let j0 = 0;
      const minv = Array(cols + 1).fill(Infinity);
      const used = Array(cols + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity;
        let j1 = 0;
        for (let j = 1; j <= cols; j += 1) {
          if (used[j]) {
            continue;
          }
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
        for (let j = 0; j <= cols; j += 1) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }
        j0 = j1;
      } while (p[j0] !== 0);

      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0 !== 0);
    }

    const assignment = Array(rows).fill(-1);
    for (let j = 1; j <= cols; j += 1) {
      if (p[j] !== 0) {
        assignment[p[j] - 1] = j - 1;
      }
    }
    return assignment.every((index) => index >= 0) ? assignment : null;
  }

  function uint8ToBase64(values) {
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < values.length; i += chunkSize) {
      binary += String.fromCharCode(...values.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToUint8(encoded) {
    const binary = atob(encoded);
    const values = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      values[i] = binary.charCodeAt(i);
    }
    return values;
  }

  function renderDetectionScores(scores) {
    els.detectScores.innerHTML = "";
    scores.forEach((score, index) => {
      const item = document.createElement("div");
      item.className = `detect-score${score >= RANK_SCORE_THRESHOLD ? " match" : ""}`;
      item.innerHTML = `<span>${index + 1}</span><span>${score.toFixed(3)}</span>`;
      els.detectScores.append(item);
    });
  }

  bindEvents();
  renderAll();
})();
