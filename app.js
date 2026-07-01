(function () {
  const STORAGE_KEY = "mk-lounge-static-scorer:v1";
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

  const els = {
    myTeamInput: document.getElementById("myTeamInput"),
    resetButton: document.getElementById("resetButton"),
    addRaceButton: document.getElementById("addRaceButton"),
    raceEntryGrid: document.getElementById("raceEntryGrid"),
    inputError: document.getElementById("inputError"),
    rankingList: document.getElementById("rankingList"),
    raceCountBadge: document.getElementById("raceCountBadge"),
    historyList: document.getElementById("historyList"),
    overlayRaceCount: document.getElementById("overlayRaceCount"),
    overlayRanking: document.getElementById("overlayRanking"),
    startCaptureButton: document.getElementById("startCaptureButton"),
    stopCaptureButton: document.getElementById("stopCaptureButton"),
    captureStatus: document.getElementById("captureStatus"),
    captureVideo: document.getElementById("captureVideo"),
    captureCanvas: document.getElementById("captureCanvas"),
    detectScores: document.getElementById("detectScores"),
  };

  const state = loadState();
  const capture = {
    stream: null,
    timer: 0,
    metadata: null,
    templates: [],
    lastDetectedAt: 0,
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
      version: 1,
      myTeamTag: "",
      races: [],
      draftEntries: blankEntries(),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultState();
      }
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !Array.isArray(parsed.races)) {
        return defaultState();
      }
      return {
        ...defaultState(),
        ...parsed,
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

  function raceCountText() {
    return `Race ${state.races.length}/${MAX_RACES}`;
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

  function renderRanking() {
    const ranking = rankingFromRaces(state.races);
    els.rankingList.innerHTML = "";
    els.raceCountBadge.textContent = raceCountText();
    if (ranking.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "まだ集計されたレースはありません。1レース目を入力すると順位表が表示されます。";
      els.rankingList.append(empty);
      return;
    }
    ranking.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = `ranking-row${isMyTeam(item.team) ? " my-team" : ""}`;
      row.innerHTML = `
        <span class="rank-no">${index + 1}</span>
        <span class="team-name"></span>
        <span class="team-score">${item.score}</span>
      `;
      row.querySelector(".team-name").textContent = item.team;
      els.rankingList.append(row);
    });
  }

  function renderOverlay() {
    const ranking = rankingFromRaces(state.races);
    els.overlayRaceCount.textContent = raceCountText();
    els.overlayRanking.innerHTML = "";
    if (ranking.length === 0) {
      const row = document.createElement("div");
      row.className = "overlay-row";
      row.innerHTML = `
        <span class="overlay-rank">--</span>
        <span class="overlay-team">No races</span>
        <span class="overlay-score">0</span>
      `;
      els.overlayRanking.append(row);
      return;
    }
    ranking.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = `overlay-row${isMyTeam(item.team) ? " my-team" : ""}`;
      row.innerHTML = `
        <span class="overlay-rank">${index + 1}</span>
        <span class="overlay-team"></span>
        <span class="overlay-score">${item.score}</span>
      `;
      row.querySelector(".overlay-team").textContent = item.team;
      els.overlayRanking.append(row);

      const next = ranking[index + 1];
      if (next) {
        const diff = document.createElement("div");
        diff.className = "overlay-diff";
        diff.textContent = `+${item.score - next.score}`;
        els.overlayRanking.append(diff);
      }
    });
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
          saveState();
          renderRanking();
          renderOverlay();
        });
        const score = document.createElement("span");
        score.className = "score-chip";
        score.textContent = entry.score;
        row.append(pos, input, score);
        entries.append(row);
      }

      card.append(title, entries);
      els.historyList.append(card);
    });
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
    localStorage.removeItem(STORAGE_KEY);
    showError("");
    renderAll();
  }

  function bindEvents() {
    els.addRaceButton.addEventListener("click", addRaceFromDraft);
    els.resetButton.addEventListener("click", resetAll);
    els.startCaptureButton.addEventListener("click", startCapture);
    els.stopCaptureButton.addEventListener("click", stopCapture);
    els.myTeamInput.addEventListener("input", () => {
      state.myTeamTag = els.myTeamInput.value.trim();
      saveState();
      renderAll();
    });
  }

  function renderAll() {
    els.myTeamInput.value = state.myTeamTag;
    renderDraftInputs();
    renderRanking();
    renderHistory();
    renderOverlay();
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
    if (!capture.metadata || els.captureVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    const canvas = els.captureCanvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(els.captureVideo, 0, 0, canvas.width, canvas.height);
    const result = detectResultScreen(ctx);
    renderDetectionScores(result.scores);
    if (result.detected) {
      capture.lastDetectedAt = Date.now();
      setCaptureStatus(`リザルト画面を検出しました。rank_matches=${result.matches}`, "detected");
    } else {
      setCaptureStatus(`監視中。rank_matches=${result.matches}`);
    }
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
