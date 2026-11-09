
/* ============================================================
   SBO SPEED GUN — app.js
   실시간 카메라 / 공 추적 / 슬로모션 분석 / 기록 / 리포트
   ============================================================ */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const UI = {};
  const IDS = [
    "settingsBtn", "settingsDialog", "settingsForm",
    "saveSettingsBtn", "flightDistance",
    "cameraDirection", "ballMode", "voiceReadout",
    "cameraStage", "liveVideo", "liveCanvas",
    "liveBadge", "cameraFps", "cameraStatus",
    "cameraHint", "measureState", "liveSpeed",
    "speedNote", "bestSpeed", "avgSpeed",
    "pitchCount", "cameraToggleBtn", "trackToggleBtn",
    "videoFileInput", "analysisVideo", "analysisCanvas",
    "analysisEmpty", "playbackRate", "currentVideoTime",
    "startFrameBtn", "endFrameBtn",
    "startTimeLabel", "endTimeLabel",
    "analysisSpeed", "analysisStatus",
    "saveAnalysisBtn", "recordsCount",
    "recordsBest", "recordsAverage",
    "recordList", "exportCsvBtn", "clearRecordsBtn",
    "reportBest", "reportAverage", "reportCount",
    "reportChart", "printReportBtn", "toast"
  ];

  IDS.forEach(id => UI[id] = $(id));

  const RECORD_KEY = "sbo-speed-gun-records-v1";
  const SETTINGS_KEY = "sbo-speed-gun-settings-v1";

  const clamp = (n, min, max) =>
    Math.max(min, Math.min(max, n));

  const fmt = n =>
    Number.isFinite(n) ? n.toFixed(1) : "--.-";

  const safeNumber = (n, fallback) =>
    Number.isFinite(Number(n)) ? Number(n) : fallback;

  const nowISO = () => new Date().toISOString();

  function loadJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      toast("저장 공간을 사용할 수 없습니다.");
      return false;
    }
  }

  const storedSettings = loadJSON(SETTINGS_KEY, {});

  const settings = {
    distance: clamp(
      safeNumber(storedSettings.distance, 16.5),
      0.5, 100
    ),
    cameraDirection:
      storedSettings.cameraDirection === "user"
        ? "user" : "environment",
    ballMode:
      storedSettings.ballMode === "tap"
        ? "tap" : "auto",
    voice: storedSettings.voice === true,
    distanceConfirmed:
      storedSettings.distanceConfirmed === true
  };

  let records = loadJSON(RECORD_KEY, []);

  if (!Array.isArray(records)) records = [];

  records = records.filter(r =>
    r &&
    Number.isFinite(r.speed) &&
    r.speed > 0 &&
    r.speed <= 240
  ).slice(-500);

  /* ============================================================
     1. 공통 UI
     ============================================================ */

  let toastTimer;

  function toast(message) {
    UI.toast.textContent = message;
    UI.toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      UI.toast.classList.remove("show");
    }, 3000);
  }

  function status(message, hint = "") {
    UI.cameraStatus.textContent = message;

    if (hint) {
      UI.cameraHint.textContent = hint;
    }
  }

  function setSpeed(speed, state, note) {
    UI.liveSpeed.textContent = fmt(speed);
    UI.measureState.textContent = state;
    UI.speedNote.textContent = note;
  }

  function speakSpeed(speed) {
    if (!settings.voice) return;
    if (!("speechSynthesis" in window)) return;

    try {
      speechSynthesis.cancel();

      const voice = new SpeechSynthesisUtterance(
        `${Math.round(speed)} 킬로미터`
      );

      voice.lang = "ko-KR";
      voice.rate = 1.05;

      speechSynthesis.speak(voice);
    } catch {}
  }

  /* ============================================================
     2. 추가 측정 컨트롤
     ============================================================ */

  function addExtras() {
    const style = document.createElement("style");

    style.textContent = `
      .calibrate-panel {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-top:10px;
      }

      .calibrate-panel button {
        min-height:40px;
        padding:8px;
        font-size:12px;
      }

      .calibrate-tip {
        margin:8px 3px 0;
        color:#a8c8ed;
        font-size:11px;
        line-height:1.6;
      }

      .analysis-extra {
        display:grid;
        gap:9px;
        margin:12px 0;
      }

      .analysis-extra label {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        color:#bed0ec;
        font-size:12px;
      }

      .analysis-extra select {
        width:51%;
        padding:9px;
        color:#fff;
        background:#081b38;
        border:1px solid #4279b5;
        border-radius:7px;
      }

      .record-row {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .record-details {
        display:flex;
        flex-direction:column;
        gap:4px;
        min-width:0;
      }

      .record-details small {
        font-size:10px;
        color:#9cb5d5;
      }

      .record-speed {
        font-weight:900;
        color:#f6fbff;
        white-space:nowrap;
      }

      .record-delete {
        padding:6px 8px;
        color:#ffb8c2;
        background:transparent;
        border:1px solid #684057;
        border-radius:7px;
      }

      .chart-col {
        min-width:38px;
        flex:1 0 38px;
        max-width:52px;
        height:190px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:flex-end;
        gap:5px;
      }

      .chart-bar {
        width:75%;
        min-height:3px;
        border-radius:5px 5px 0 0;
        background:linear-gradient(
          #64d6ff,#126bfb
        );
        box-shadow:0 0 9px #116dff88;
      }

      .chart-num {
        color:#c5e7ff;
        font-size:10px;
      }

      .chart-label {
        color:#95add0;
        font-size:10px;
      }

      .tracking-canvas {
        cursor:crosshair;
      }
    `;

    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.className = "calibrate-panel";

    panel.innerHTML = `
      <button
        type="button"
        class="secondary-button"
        id="calibrateBtn">
        ◎ 측정 구간 지정
      </button>

      <button
        type="button"
        class="secondary-button"
        id="resetCalibrateBtn">
        ↺ 기준점 초기화
      </button>
    `;

    document.querySelector(".live-actions").after(panel);

    const tip = document.createElement("p");
    tip.id = "calibrateTip";
    tip.className = "calibrate-tip";

    tip.textContent =
      "측면 촬영에서 공의 경로 위 시작점 A와 끝점 B를 순서대로 터치하세요.";

    panel.after(tip);

    const extra = document.createElement("div");
    extra.className = "analysis-extra";

    extra.innerHTML = `
      <label for="timeFactor">
        영상 저장 속도 보정

        <select id="timeFactor">
          <option value="1">1배 · 보정 없음</option>
          <option value="2">2배 느리게 저장됨</option>
          <option value="4">4배 느리게 저장됨</option>
          <option value="8">8배 느리게 저장됨</option>
        </select>
      </label>

      <small style="
        color:#9bb9da;
        line-height:1.5;
        font-size:11px">
        영상 자체가 실제 시간보다 느리게 저장된
        경우에만 보정하세요.
        재생 속도만 변경한 경우에는 1배입니다.
      </small>

      <button
        type="button"
        class="secondary-button"
        id="videoTrackBtn"
        disabled>
        ◎ 영상 공 추적 (실험)
      </button>
    `;

    document.querySelector(
      ".analysis-toolbar"
    ).after(extra);

    UI.calibrateBtn = $("calibrateBtn");
    UI.resetCalibrateBtn = $("resetCalibrateBtn");
    UI.calibrateTip = $("calibrateTip");
    UI.timeFactor = $("timeFactor");
    UI.videoTrackBtn = $("videoTrackBtn");
  }

  /* ============================================================
     3. 기록 및 통계
     ============================================================ */

  function summaries() {
    if (!records.length) {
      return { count: 0, best: 0, avg: 0 };
    }

    const speeds = records.map(r => r.speed);

    return {
      count: speeds.length,
      best: Math.max(...speeds),
      avg:
        speeds.reduce((sum, n) => sum + n, 0) /
        speeds.length
    };
  }

  function updateSummaries() {
    const s = summaries();

    UI.bestSpeed.textContent = fmt(s.best);
    UI.avgSpeed.textContent = fmt(s.avg);
    UI.pitchCount.textContent = String(s.count);

    UI.recordsCount.textContent = String(s.count);

    UI.recordsBest.textContent =
      s.count ? fmt(s.best) : "--.-";

    UI.recordsAverage.textContent =
      s.count ? fmt(s.avg) : "--.-";

    UI.reportBest.textContent =
      s.count ? fmt(s.best) : "--.-";

    UI.reportAverage.textContent =
      s.count ? fmt(s.avg) : "--.-";

    UI.reportCount.textContent = String(s.count);

    renderRecords();
    renderChart();
  }

  function saveRecord(speed, method, distance, duration) {
    if (!Number.isFinite(speed)) return false;
    if (speed < 5 || speed > 240) return false;

    const record = {
      id:
        Date.now() + "-" +
        Math.random().toString(36).slice(2),
      speed: Math.round(speed * 10) / 10,
      method,
      distance,
      duration,
      createdAt: nowISO()
    };

    records.push(record);

    if (records.length > 500) {
      records = records.slice(-500);
    }

    saveJSON(RECORD_KEY, records);
    updateSummaries();
    speakSpeed(speed);

    toast(
      `구속 ${fmt(speed)} km/h 기록 완료`
    );

    return true;
  }

  function renderRecords() {
    UI.recordList.replaceChildren();

    if (!records.length) {
      const empty = document.createElement("li");
      empty.className = "empty-message";
      empty.textContent = "저장된 기록이 없습니다.";
      UI.recordList.append(empty);
      return;
    }

    [...records].reverse().forEach(record => {
      const li = document.createElement("li");
      li.className = "record-row";

      const details = document.createElement("div");
      details.className = "record-details";

      const title = document.createElement("span");
      title.textContent = record.method;

      const meta = document.createElement("small");

      const date = new Date(record.createdAt);

      meta.textContent =
        `${date.toLocaleString("ko-KR")} · ` +
        `${fmt(record.distance)}m`;

      details.append(title, meta);

      const speed = document.createElement("strong");
      speed.className = "record-speed";
      speed.textContent =
        `${fmt(record.speed)} km/h`;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "record-delete";
      del.textContent = "삭제";

      del.addEventListener("click", () => {
        records = records.filter(
          r => r.id !== record.id
        );

        saveJSON(RECORD_KEY, records);
        updateSummaries();
      });

      li.append(details, speed, del);
      UI.recordList.append(li);
    });
  }

  /* ============================================================
     4. 구속 그래프
     ============================================================ */

  function renderChart() {
    UI.reportChart.replaceChildren();

    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "empty-message";

      empty.textContent =
        "구속 기록이 쌓이면 그래프가 표시됩니다.";

      UI.reportChart.append(empty);
      return;
    }

    const data = records.slice(-20);

    const maximum = Math.max(
      160,
      ...data.map(r => r.speed)
    );

    data.forEach((record, index) => {
      const col = document.createElement("div");
      col.className = "chart-col";

      col.title =
        `${record.method} · ` +
        `${fmt(record.speed)} km/h`;

      const value = document.createElement("span");
      value.className = "chart-num";
      value.textContent = fmt(record.speed);

      const bar = document.createElement("div");
      bar.className = "chart-bar";

      bar.style.height =
        `${Math.max(
          3,
          record.speed / maximum * 142
        )}px`;

      const label = document.createElement("span");
      label.className = "chart-label";

      label.textContent = String(
        records.length - data.length + index + 1
      );

      col.append(value, bar, label);
      UI.reportChart.append(col);
    });
  }

  /* ============================================================
     5. CSV 파일 저장
     ============================================================ */

  function csvCell(value) {
    let str = String(value ?? "");

    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }

    return `"${str.replaceAll('"', '""')}"`;
  }

  function exportCSV() {
    if (!records.length) {
      toast("내보낼 기록이 없습니다.");
      return;
    }

    const rows = [
      [
        "일시",
        "측정 방식",
        "구속(km/h)",
        "이동 거리(m)",
        "비행 시간(s)"
      ],
      ...records.map(r => [
        r.createdAt,
        r.method,
        r.speed,
        r.distance,
        r.duration
      ])
    ];

    const csv =
      "\uFEFF" +
      rows.map(row =>
        row.map(csvCell).join(",")
      ).join("\r\n");

    const blob = new Blob(
      [csv],
      { type: "text/csv;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "SBO_SPEED_GUN_records.csv";

    document.body.append(a);
    a.click();
    a.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 5000);
  }

  /* ============================================================
     6. 화면 전환
     ============================================================ */

  function activateView(name) {
    const views = [
      "live",
      "analysis",
      "records",
      "report"
    ];

    for (const view of views) {
      const section = $("view-" + view);
      const selected = view === name;

      section.hidden = !selected;
      section.classList.toggle(
        "active",
        selected
      );
    }

    document.querySelectorAll(
      ".nav-item"
    ).forEach(button => {
      const selected =
        button.dataset.view === name;

      button.classList.toggle(
        "selected",
        selected
      );

      if (selected) {
        button.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        button.removeAttribute(
          "aria-current"
        );
      }
    });

    if (name !== "live") {
      stopCamera();
    }

    if (name !== "analysis") {
      UI.analysisVideo.pause();
    }

    if (name === "records" || name === "report") {
      updateSummaries();
    }

    document.querySelector(
      ".main-content"
    ).scrollTop = 0;
  }

  /* ============================================================
     7. 설정
     ============================================================ */

  function applySettings() {
    UI.flightDistance.value = settings.distance;

    UI.cameraDirection.value =
      settings.cameraDirection;

    UI.ballMode.value = settings.ballMode;

    UI.voiceReadout.checked = settings.voice;
  }

  function saveSettings() {
    const distance = Number(
      UI.flightDistance.value
    );

    if (
      !Number.isFinite(distance) ||
      distance < 0.5 ||
      distance > 100
    ) {
      toast("거리는 0.5~100m로 입력하세요.");
      return false;
    }

    const message =
      gateA && gateB
        ? `A와 B 사이 실제 거리가 ${distance}m인가요?`
        : `실제 측정 구간 거리가 ${distance}m인가요?`;

    if (!confirm(message)) {
      return false;
    }

    const cameraChanged =
      settings.cameraDirection !==
      UI.cameraDirection.value;

    settings.distance = distance;

    settings.cameraDirection =
      UI.cameraDirection.value;

    settings.ballMode =
      UI.ballMode.value;

    settings.voice =
      UI.voiceReadout.checked;

    settings.distanceConfirmed = true;

    if (gateA && gateB) {
      liveDistanceConfirmed = true;
    }

    saveJSON(SETTINGS_KEY, settings);

    if (cameraChanged && cameraStream) {
      stopCamera();
    }

    refreshLiveHint();
    updateAnalysisSpeed();

    toast("설정이 저장되었습니다.");

    return true;
  }

  /* ============================================================
     8. 공 후보 자동 인식
     프레임 간 움직이는 밝은 물체 탐색
     ============================================================ */

  const TRACK_WIDTH = 320;

  function makeTracker() {
    const canvas = document.createElement("canvas");

    const ctx = canvas.getContext(
      "2d",
      { willReadFrequently: true }
    );

    return {
      canvas,
      ctx,
      width: 0,
      height: 0,
      previous: null,
      target: null,
      last: null,
      trail: [],
      lost: 0,
      active: false
    };
  }

  function resetTracker(tracker) {
    tracker.previous = null;
    tracker.target = null;
    tracker.last = null;
    tracker.trail = [];
    tracker.lost = 0;
  }

  function findMovingBall(video, tracker) {
    if (!tracker.ctx) return [];
    if (video.readyState < 2) return [];
    if (!video.videoWidth) return [];

    const width = TRACK_WIDTH;

    const height = Math.max(
      90,
      Math.round(
        width *
        video.videoHeight /
        video.videoWidth
      )
    );

    if (
      tracker.width !== width ||
      tracker.height !== height
    ) {
      tracker.width = width;
      tracker.height = height;

      tracker.canvas.width = width;
      tracker.canvas.height = height;

      tracker.previous = null;
    }

    let image;

    try {
      tracker.ctx.drawImage(
        video,
        0, 0,
        width, height
      );

      image = tracker.ctx.getImageData(
        0, 0,
        width, height
      ).data;
    } catch {
      return [];
    }

    const pixels = width * height;
    const gray = new Uint8Array(pixels);
    const mask = new Uint8Array(pixels);

    let moving = 0;

    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const i = y * width + x;
        const offset = i * 4;

        const r = image[offset];
        const g = image[offset + 1];
        const b = image[offset + 2];

        const brightness =
          (r * 3 + g * 6 + b) / 10;

        gray[i] = brightness;

        if (!tracker.previous) continue;

        const difference = Math.abs(
          brightness - tracker.previous[i]
        );

        const colorDifference =
          Math.max(r, g, b) -
          Math.min(r, g, b);

        if (
          difference > 29 &&
          brightness > 115 &&
          colorDifference < 92
        ) {
          mask[i] = 1;
          moving++;
        }
      }
    }

    tracker.previous = gray;

    if (moving < 2) return [];

    if (moving > pixels * 0.19) {
      return [];
    }

    const found = [];
    const queue = new Int32Array(300);

    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const start = y * width + x;

        if (!mask[start]) continue;

        let head = 0;
        let tail = 1;
        let count = 0;
        let sumX = 0;
        let sumY = 0;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;

        let tooLarge = false;

        queue[0] = start;
        mask[start] = 0;

        while (head < tail) {
          const i = queue[head++];

          const xx = i % width;
          const yy = Math.floor(i / width);

          count++;
          sumX += xx;
          sumY += yy;

          minX = Math.min(minX, xx);
          maxX = Math.max(maxX, xx);

          minY = Math.min(minY, yy);
          maxY = Math.max(maxY, yy);

          const neighbors = [
            i - 1,
            i + 1,
            i - width,
            i + width
          ];

          for (const next of neighbors) {
            if (!mask[next]) continue;

            mask[next] = 0;

            if (tail < queue.length) {
              queue[tail++] = next;
            } else {
              tooLarge = true;
            }
          }
        }

        const boxWidth = maxX - minX + 1;
        const boxHeight = maxY - minY + 1;

        const ratio = boxWidth / boxHeight;

        if (
          !tooLarge &&
          count >= 2 &&
          count <= 105 &&
          boxWidth <= 17 &&
          boxHeight <= 17 &&
          ratio > 0.3 &&
          ratio < 3.2
        ) {
          found.push({
            x: (sumX / count) / width,
            y: (sumY / count) / height,
            area: count,
            score: count / (boxWidth * boxHeight)
          });
        }
      }
    }

    return found;
  }

  function chooseBall(candidates, tracker, preferred) {
    if (!candidates.length) {
      tracker.lost++;

      if (tracker.lost > 6) {
        tracker.last = null;
        tracker.trail = [];
      }

      return null;
    }

    const anchor =
      tracker.last ||
      tracker.target ||
      preferred ||
      { x: 0.5, y: 0.5 };

    const maxDistance =
      tracker.last ? 0.23 :
      tracker.target ? 0.19 : 0.17;

    let best = null;
    let bestScore = Infinity;

    for (const ball of candidates) {
      const distance = Math.hypot(
        ball.x - anchor.x,
        ball.y - anchor.y
      );

      if (distance > maxDistance) continue;

      const score =
        distance +
        Math.abs(ball.area - 9) / 550 -
        ball.score * 0.01;

      if (score < bestScore) {
        best = ball;
        bestScore = score;
      }
    }

    if (!best) {
      tracker.lost++;
      return null;
    }

    tracker.lost = 0;

    tracker.last = {
      x: best.x,
      y: best.y
    };

    tracker.target = tracker.last;

    tracker.trail.push({
      ...tracker.last,
      at: performance.now()
    });

    tracker.trail = tracker.trail.slice(-20);

    return tracker.last;
  }

  /* ============================================================
     9. 좌표 변환 및 그래픽
     ============================================================ */

  function canvasSize(canvas) {
    const rect = canvas.getBoundingClientRect();

    const scale = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    const width = Math.round(rect.width * scale);
    const height = Math.round(rect.height * scale);

    if (
      width > 0 &&
      height > 0 &&
      (
        canvas.width !== width ||
        canvas.height !== height
      )
    ) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");

    ctx.setTransform(
      scale, 0, 0, scale, 0, 0
    );

    ctx.clearRect(
      0, 0,
      rect.width,
      rect.height
    );

    return {
      ctx,
      width: rect.width,
      height: rect.height
    };
  }

  function displayPoint(point, width, height, video, fit) {
    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;

    const scale =
      fit === "contain"
        ? Math.min(width / vw, height / vh)
        : Math.max(width / vw, height / vh);

    const dx = (width - vw * scale) / 2;
    const dy = (height - vh * scale) / 2;

    return {
      x: dx + point.x * vw * scale,
      y: dy + point.y * vh * scale
    };
  }

  function pointFromTap(event, canvas, video, fit) {
    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;

    const scale =
      fit === "contain"
        ? Math.min(
            rect.width / vw,
            rect.height / vh
          )
        : Math.max(
            rect.width / vw,
            rect.height / vh
          );

    const dx = (rect.width - vw * scale) / 2;
    const dy = (rect.height - vh * scale) / 2;

    return {
      x: clamp(
        (x - dx) / (vw * scale),
        0, 1
      ),
      y: clamp(
        (y - dy) / (vh * scale),
        0, 1
      )
    };
  }

  function drawDot(ctx, point, color, label) {
    ctx.save();

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    ctx.shadowColor = color;
    ctx.shadowBlur = 9;

    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y,
      10,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (label) {
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(
        label,
        point.x + 13,
        point.y - 9
      );
    }

    ctx.restore();
  }

  function drawTrail(ctx, points, color) {
    if (points.length < 2) return;

    ctx.save();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    ctx.beginPath();

    points.forEach((p, i) => {
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    });

    ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     10. 실시간 카메라
     ============================================================ */

  let cameraStream = null;
  let cameraToken = 0;
  let liveRaf = 0;
  let liveRunning = false;

  const liveTracker = makeTracker();

  let frameCount = 0;
  let frameStart = 0;
  let lastSample = 0;

  let gateA = null;
  let gateB = null;

  let calibrating = 0;
  let liveDistanceConfirmed = false;

  let gateCrossAt = null;
  let lastGateProgress = null;
  let gateIsArmed = false;
  let lastDetectionTime = 0;
  let lastBall = null;

  function refreshLiveHint() {
    if (!gateA || !gateB) {
      UI.calibrateTip.textContent =
        "① 측정 구간 지정 버튼을 누르세요. " +
        "② 화면에서 시작점 A와 끝점 B를 선택하세요. " +
        "③ 실제 거리를 입력하세요.";
      return;
    }

    if (
      !settings.distanceConfirmed ||
      !liveDistanceConfirmed
    ) {
      UI.calibrateTip.textContent =
        "기준점 설정 완료. ⚙ 설정에서 " +
        "A~B 사이 실제 거리를 확인하고 저장하세요.";
      return;
    }

    UI.calibrateTip.textContent =
      `A → B / 거리 ${settings.distance}m / ` +
      "구간 평균 구속을 추정합니다.";
  }

  function drawLiveOverlay() {
    const { ctx, width, height } =
      canvasSize(UI.liveCanvas);

    if (!cameraStream) return;
    if (!width || !height) return;

    const convert = p =>
      displayPoint(
        p,
        width,
        height,
        UI.liveVideo,
        "cover"
      );

    if (gateA) {
      drawDot(
        ctx,
        convert(gateA),
        "#31deff",
        "A"
      );
    }

    if (gateB) {
      drawDot(
        ctx,
        convert(gateB),
        "#ffd86b",
        "B"
      );
    }

    if (gateA && gateB) {
      const a = convert(gateA);
      const b = convert(gateB);

      ctx.save();
      ctx.strokeStyle = "#68bbffbb";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.restore();
    }

    if (liveTracker.active) {
      drawTrail(
        ctx,
        liveTracker.trail.map(convert),
        "#ff735a"
      );

      if (lastBall) {
        drawDot(
          ctx,
          convert(lastBall),
          "#ff5345",
          "공?"
        );
      } else if (liveTracker.target) {
        drawDot(
          ctx,
          convert(liveTracker.target),
          "#ffa64c",
          "탐색"
        );
      }
    }
  }

  function resetGates() {
    gateA = null;
    gateB = null;
    calibrating = 0;

    liveDistanceConfirmed = false;

    gateCrossAt = null;
    lastGateProgress = null;
    gateIsArmed = false;

    UI.calibrateBtn.textContent =
      "◎ 측정 구간 지정";

    refreshLiveHint();
    drawLiveOverlay();
  }

  function beginGateCalibration() {
    if (!cameraStream) {
      toast("먼저 카메라를 켜 주세요.");
      return;
    }

    gateA = null;
    gateB = null;
    calibrating = 1;

    liveDistanceConfirmed = false;

    gateCrossAt = null;
    lastGateProgress = null;
    gateIsArmed = false;

    UI.calibrateBtn.textContent =
      "① A 위치 터치 중";

    status(
      "시작점 A를 터치하세요",
      "공이 이동할 경로의 시작점을 선택하세요."
    );

    refreshLiveHint();
  }

  /* ============================================================
     11. 시작점 및 끝점 통과 시간
     ============================================================ */

  function recordGateProgress(point, at) {
    if (!point || !gateA || !gateB) return;

    if (
      !settings.distanceConfirmed ||
      !liveDistanceConfirmed
    ) return;

    const ux = gateB.x - gateA.x;
    const uy = gateB.y - gateA.y;

    const magnitude =
      ux * ux + uy * uy;

    if (magnitude < 0.0025) return;

    const px = point.x - gateA.x;
    const py = point.y - gateA.y;

    const progress =
      (px * ux + py * uy) / magnitude;

    const perpendicular =
      Math.abs(px * uy - py * ux) /
      Math.sqrt(magnitude);

    if (perpendicular > 0.075) {
      lastGateProgress = null;
      gateCrossAt = null;
      return;
    }

    if (progress < -0.1) {
      gateIsArmed = true;
    }

    if (
      lastGateProgress !== null &&
      gateIsArmed
    ) {
      if (
        gateCrossAt === null &&
        lastGateProgress < 0 &&
        progress >= 0
      ) {
        const fraction = clamp(
          (0 - lastGateProgress) /
          (progress - lastGateProgress),
          0, 1
        );

        const elapsed =
          lastDetectionTime &&
          at > lastDetectionTime
            ? at - lastDetectionTime
            : 0;

        gateCrossAt =
          at - elapsed * (1 - fraction);

        status(
          "시작점 A 통과",
          "끝점 B를 추적하고 있습니다."
        );
      }

      if (
        gateCrossAt !== null &&
        lastGateProgress < 1 &&
        progress >= 1
      ) {
        const fraction = clamp(
          (1 - lastGateProgress) /
          (progress - lastGateProgress),
          0, 1
        );

        const elapsed =
          lastDetectionTime &&
          at > lastDetectionTime
            ? at - lastDetectionTime
            : 0;

        const end =
          at - elapsed * (1 - fraction);

        const seconds =
          (end - gateCrossAt) / 1000;

        const speed =
          settings.distance / seconds * 3.6;

        gateCrossAt = null;
        gateIsArmed = false;

        if (
          seconds > 0.03 &&
          seconds < 5 &&
          speed >= 5 &&
          speed <= 240
        ) {
          setSpeed(
            speed,
            "실험 추정값",
            "영상 기반 2D 추정 · 실측 보정 필요"
          );

          saveRecord(
            speed,
            "LIVE",
            settings.distance,
            seconds
          );

          status(
            "구속 추정 완료",
            "다음 투구를 감지하고 있습니다."
          );
        } else {
          status(
            "측정 무효",
            "공 추적 또는 이동 시간을 확인하세요."
          );
        }
      }
    }

    lastGateProgress = progress;
    lastDetectionTime = at;
  }

  /* ============================================================
     12. 라이브 영상 처리
     ============================================================ */

  function cameraFrame(timestamp) {
    if (!liveRunning) return;

    liveRaf = requestAnimationFrame(cameraFrame);

    if (
      !UI.liveVideo.videoWidth ||
      UI.liveVideo.readyState < 2
    ) return;

    if (!frameStart) {
      frameStart = timestamp;
    }

    if (timestamp - lastSample < 32) return;

    lastSample = timestamp;
    frameCount++;

    if (timestamp - frameStart > 1100) {
      const fps = Math.round(
        frameCount * 1000 /
        (timestamp - frameStart)
      );

      UI.cameraFps.textContent =
        `분석 FPS ≈ ${fps}`;

      frameCount = 0;
      frameStart = timestamp;
    }

    if (liveTracker.active) {
      const previousBall = lastBall;

      const candidates = findMovingBall(
        UI.liveVideo,
        liveTracker
      );

      const ball = chooseBall(
        candidates,
        liveTracker,
        gateA
      );

      lastBall = ball;

      if (ball) {
        recordGateProgress(
          ball,
          performance.now()
        );

        if (!previousBall) {
          status(
            "공 후보 추적 중",
            "붉은 표시가 실제 공인지 확인하세요."
          );
        }
      } else if (liveTracker.lost > 6) {
        gateCrossAt = null;
        lastGateProgress = null;

        status(
          "공 탐색 중",
          "공을 터치하면 추적 위치를 지정할 수 있습니다."
        );
      }
    }

    drawLiveOverlay();
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast(
        "카메라를 사용할 수 없습니다. HTTPS 사이트에서 실행하세요."
      );
      return;
    }

    if (!window.isSecureContext) {
      toast("카메라는 HTTPS 연결이 필요합니다.");
      return;
    }

    const token = ++cameraToken;

    try {
      UI.cameraToggleBtn.disabled = true;

      status("카메라 연결 중");

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: {
              ideal: settings.cameraDirection
            },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: {
              ideal: 60,
              max: 60
            }
          }
        });

      if (token !== cameraToken) {
        stream.getTracks().forEach(
          track => track.stop()
        );
        return;
      }

      cameraStream = stream;

      UI.liveVideo.srcObject = stream;

      await UI.liveVideo.play();

      UI.cameraStage.classList.add(
        "is-streaming"
      );

      UI.liveBadge.innerHTML =
        "<i></i> LIVE";

      UI.liveBadge.classList.add("is-live");

      UI.cameraToggleBtn.textContent =
        "■ 카메라 끄기";

      UI.trackToggleBtn.disabled = false;

      status(
        "카메라 연결됨",
        "공 추적 전에 측정 구간을 지정하세요."
      );

      liveRunning = true;

      frameCount = 0;
      frameStart = 0;
      lastSample = 0;

      liveRaf = requestAnimationFrame(
        cameraFrame
      );
    } catch (error) {
      status("카메라 실행 실패");

      toast(
        error?.name === "NotAllowedError"
          ? "카메라 접근 권한을 허용하세요."
          : "카메라 연결을 확인하세요."
      );

      stopCamera();
    } finally {
      UI.cameraToggleBtn.disabled = false;
    }
  }

  function stopCamera() {
    cameraToken++;
    liveRunning = false;

    cancelAnimationFrame(liveRaf);
    liveRaf = 0;

    if (cameraStream) {
      cameraStream.getTracks().forEach(
        track => track.stop()
      );
    }

    cameraStream = null;
    UI.liveVideo.srcObject = null;

    UI.cameraStage.classList.remove(
      "is-streaming"
    );

    UI.liveBadge.innerHTML =
      "<i></i> STANDBY";

    UI.liveBadge.classList.remove("is-live");

    UI.cameraToggleBtn.textContent =
      "📷 카메라 켜기";

    UI.trackToggleBtn.textContent =
      "◎ 공 추적 시작";

    UI.trackToggleBtn.disabled = true;

    UI.cameraFps.textContent = "FPS --";

    status(
      "카메라 대기 중",
      "카메라를 켠 뒤 측정을 시작하세요."
    );

    liveTracker.active = false;

    resetTracker(liveTracker);

    lastBall = null;
    lastDetectionTime = 0;

    resetGates();

    setSpeed(
      NaN,
      "측정 대기",
      "측정값 없음 · 구간 보정 필요"
    );

    canvasSize(UI.liveCanvas);
  }

  function toggleTracking() {
    if (!cameraStream) return;

    liveTracker.active = !liveTracker.active;

    resetTracker(liveTracker);

    lastBall = null;
    gateCrossAt = null;
    lastGateProgress = null;
    gateIsArmed = false;

    UI.trackToggleBtn.textContent =
      liveTracker.active
        ? "■ 공 추적 중단"
        : "◎ 공 추적 시작";

    if (liveTracker.active) {
      status(
        "공 후보 탐색 중",
        "공을 터치하여 추적 위치를 지정하세요."
      );

      if (!gateA || !gateB) {
        toast(
          "구속 계산을 위해 A/B 기준점이 필요합니다."
        );
      }
    } else {
      status(
        "공 추적 정지",
        "추적 버튼을 누르면 다시 시작합니다."
      );
    }

    drawLiveOverlay();
  }

  function handleLiveTap(event) {
    if (!cameraStream) return;

    const point = pointFromTap(
      event,
      UI.liveCanvas,
      UI.liveVideo,
      "cover"
    );

    if (calibrating === 1) {
      gateA = point;
      calibrating = 2;

      UI.calibrateBtn.textContent =
        "② B 위치 터치 중";

      status(
        "끝점 B를 터치하세요",
        "A에서 B 방향으로 이동하도록 설정하세요."
      );
    } else if (calibrating === 2) {
      if (
        Math.hypot(
          point.x - gateA.x,
          point.y - gateA.y
        ) < 0.09
      ) {
        toast("A와 B를 더 멀리 지정하세요.");
        return;
      }

      gateB = point;
      calibrating = 0;

      UI.calibrateBtn.textContent =
        "◎ 측정 구간 다시 지정";

      status(
        "측정 구간 설정 완료",
        "실측 거리를 설정에서 확인하세요."
      );

      toast("A/B 기준점 지정 완료");
    } else {
      liveTracker.target = point;
      liveTracker.last = null;
      liveTracker.previous = null;
      liveTracker.trail = [];

      lastBall = null;
      gateCrossAt = null;
      lastGateProgress = null;
      gateIsArmed = false;

      status(
        "지정 위치에서 공 탐색 중",
        "공을 다시 터치하여 보정할 수 있습니다."
      );
    }

    refreshLiveHint();
    drawLiveOverlay();
  }

  /* ============================================================
     13. 슬로모션 영상 분석
     ============================================================ */

  let videoURL = null;
  let startTime = null;
  let endTime = null;
  let validVideoSpeed = NaN;

  const videoTracker = makeTracker();

  let videoLoopId = 0;
  let videoFallbackRaf = 0;
  let videoLastMediaTime = -1;

  function videoTimeText(value) {
    return Number.isFinite(value)
      ? `${value.toFixed(3)}초`
      : "미지정";
  }

  function invalidateVideoResult() {
    validVideoSpeed = NaN;

    UI.analysisSpeed.textContent = "--.-";

    UI.saveAnalysisBtn.disabled = true;
  }

  function updateAnalysisSpeed() {
    UI.startTimeLabel.textContent =
      videoTimeText(startTime);

    UI.endTimeLabel.textContent =
      videoTimeText(endTime);

    const factor =
      Number(UI.timeFactor.value) || 1;

    const distance = settings.distance;

    if (
      startTime === null ||
      endTime === null
    ) {
      invalidateVideoResult();

      UI.analysisStatus.textContent =
        "시작과 끝 시점을 지정하세요.";

      return;
    }

    const duration =
      (endTime - startTime) / factor;

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      invalidateVideoResult();

      UI.analysisStatus.textContent =
        "끝 시점은 시작 시점 이후여야 합니다.";

      return;
    }

    if (!settings.distanceConfirmed) {
      invalidateVideoResult();

      UI.analysisStatus.textContent =
        "설정에서 실제 이동 거리를 확인하세요.";

      return;
    }

    const speed =
      distance / duration * 3.6;

    if (
      duration < 0.03 ||
      speed < 5 ||
      speed > 240
    ) {
      invalidateVideoResult();

      UI.analysisStatus.textContent =
        "측정 구간, 영상 배속, 거리를 확인하세요.";

      return;
    }

    validVideoSpeed = speed;

    UI.analysisSpeed.textContent =
      fmt(speed);

    UI.analysisStatus.textContent =
      `거리 ${distance}m ÷ ` +
      `시간 ${duration.toFixed(3)}초 × 3.6 ` +
      "· 구간 평균 추정값";

    UI.saveAnalysisBtn.disabled = false;
  }

  function updateVideoTime() {
    UI.currentVideoTime.textContent =
      videoTimeText(
        UI.analysisVideo.currentTime
      );
  }

  function resetVideo() {
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
    }

    videoURL = null;

    startTime = null;
    endTime = null;

    invalidateVideoResult();

    videoTracker.active = false;
    resetTracker(videoTracker);

    videoLastMediaTime = -1;

    UI.videoTrackBtn.textContent =
      "◎ 영상 공 추적 (실험)";

    UI.analysisEmpty.hidden = false;

    UI.startFrameBtn.disabled = true;
    UI.endFrameBtn.disabled = true;
    UI.videoTrackBtn.disabled = true;

    UI.startTimeLabel.textContent = "미지정";
    UI.endTimeLabel.textContent = "미지정";

    UI.analysisStatus.textContent =
      "투구 영상을 불러오세요.";

    updateVideoTime();
    canvasSize(UI.analysisCanvas);
  }

  async function loadVideoFile(file) {
    if (!file) return;

    if (
      file.type &&
      !file.type.startsWith("video/")
    ) {
      toast("동영상 파일을 선택하세요.");
      return;
    }

    UI.analysisVideo.pause();

    resetVideo();

    videoURL = URL.createObjectURL(file);

    UI.analysisVideo.src = videoURL;
    UI.analysisVideo.load();

    UI.analysisStatus.textContent =
      "동영상 불러오는 중...";
  }

  /* ============================================================
     14. 영상 속 공 추적
     ============================================================ */

  function processVideoTrack() {
    const candidates = findMovingBall(
      UI.analysisVideo,
      videoTracker
    );

    chooseBall(
      candidates,
      videoTracker,
      null
    );

    drawVideoOverlay();
  }

  function drawVideoOverlay() {
    const { ctx, width, height } =
      canvasSize(UI.analysisCanvas);

    if (!videoTracker.active) return;
    if (!width || !height) return;

    const convert = p =>
      displayPoint(
        p,
        width,
        height,
        UI.analysisVideo,
        "contain"
      );

    drawTrail(
      ctx,
      videoTracker.trail.map(convert),
      "#ff8363"
    );

    if (videoTracker.last) {
      drawDot(
        ctx,
        convert(videoTracker.last),
        "#ff5f53",
        "공?"
      );
    }
  }

  function videoFrame(timestamp, metadata) {
    videoLoopId = 0;

    const video = UI.analysisVideo;

    if (
      videoTracker.active &&
      video.readyState >= 2
    ) {
      const mediaTime =
        metadata?.mediaTime ??
        video.currentTime;

      if (
        mediaTime !== videoLastMediaTime
      ) {
        videoLastMediaTime = mediaTime;

        processVideoTrack();
      }
    }

    if (
      typeof video.requestVideoFrameCallback ===
      "function"
    ) {
      videoLoopId =
        video.requestVideoFrameCallback(
          videoFrame
        );
    }
  }

  function beginVideoTracking() {
    videoTracker.active =
      !videoTracker.active;

    resetTracker(videoTracker);

    UI.videoTrackBtn.textContent =
      videoTracker.active
        ? "■ 영상 공 추적 중단"
        : "◎ 영상 공 추적 (실험)";

    if (videoTracker.active) {
      toast(
        "움직이는 공 후보를 탐색합니다. 오인식할 수 있습니다."
      );

      if (
        typeof UI.analysisVideo.requestVideoFrameCallback !==
        "function"
      ) {
        const loop = () => {
          if (!videoTracker.active) return;

          if (
            !UI.analysisVideo.paused &&
            UI.analysisVideo.readyState >= 2
          ) {
            processVideoTrack();
          }

          videoFallbackRaf =
            requestAnimationFrame(loop);
        };

        videoFallbackRaf =
          requestAnimationFrame(loop);
      }
    } else {
      cancelAnimationFrame(videoFallbackRaf);
      drawVideoOverlay();
    }
  }

  /* ============================================================
     15. 이벤트 연결
     ============================================================ */

  function bindEvents() {
    document.querySelectorAll(
      ".nav-item"
    ).forEach(button => {
      button.addEventListener("click", () => {
        activateView(button.dataset.view);
      });
    });

    /* 설정 */

    UI.settingsBtn.addEventListener(
      "click",
      () => {
        applySettings();

        if (
          typeof UI.settingsDialog.showModal ===
          "function"
        ) {
          UI.settingsDialog.showModal();
        } else {
          UI.settingsDialog.setAttribute(
            "open",
            ""
          );
        }
      }
    );

    UI.settingsForm.addEventListener(
      "submit",
      event => {
        if (
          event.submitter?.id !==
          "saveSettingsBtn"
        ) return;

        if (!saveSettings()) {
          event.preventDefault();
        }
      }
    );

    /* 실시간 카메라 */

    UI.cameraToggleBtn.addEventListener(
      "click",
      () => {
        if (cameraStream) {
          stopCamera();
        } else {
          startCamera();
        }
      }
    );

    UI.trackToggleBtn.addEventListener(
      "click",
      toggleTracking
    );

    UI.calibrateBtn.addEventListener(
      "click",
      beginGateCalibration
    );

    UI.resetCalibrateBtn.addEventListener(
      "click",
      resetGates
    );

    UI.liveCanvas.addEventListener(
      "pointerdown",
      handleLiveTap
    );

    /* 영상 선택 */

    UI.videoFileInput.addEventListener(
      "change",
      event => {
        const file =
          event.target.files?.[0];

        loadVideoFile(file);

        event.target.value = "";
      }
    );

    UI.analysisVideo.addEventListener(
      "loadedmetadata",
      () => {
        UI.analysisEmpty.hidden = true;

        UI.startFrameBtn.disabled = false;
        UI.endFrameBtn.disabled = false;
        UI.videoTrackBtn.disabled = false;

        UI.analysisStatus.textContent =
          "영상을 재생하고 시작·끝 시점을 지정하세요.";

        updateVideoTime();

        if (
          typeof UI.analysisVideo.requestVideoFrameCallback ===
          "function" &&
          !videoLoopId
        ) {
          videoLoopId =
            UI.analysisVideo.requestVideoFrameCallback(
              videoFrame
            );
        }
      }
    );

    UI.analysisVideo.addEventListener(
      "timeupdate",
      updateVideoTime
    );

    UI.analysisVideo.addEventListener(
      "seeked",
      () => {
        updateVideoTime();

        videoTracker.previous = null;

        if (videoTracker.active) {
          drawVideoOverlay();
        }
      }
    );

    UI.analysisVideo.addEventListener(
      "error",
      () => {
        UI.analysisStatus.textContent =
          "지원하지 않는 영상이거나 파일이 손상되었습니다.";

        toast("영상 파일을 확인하세요.");
      }
    );

    /* 재생 속도 */

    UI.playbackRate.addEventListener(
      "change",
      () => {
        UI.analysisVideo.playbackRate =
          Number(UI.playbackRate.value) || 1;
      }
    );

    UI.timeFactor.addEventListener(
      "change",
      updateAnalysisSpeed
    );

    /* 분석 시작 시점 */

    UI.startFrameBtn.addEventListener(
      "click",
      () => {
        if (
          !Number.isFinite(
            UI.analysisVideo.duration
          )
        ) return;

        startTime =
          UI.analysisVideo.currentTime;

        updateAnalysisSpeed();
        toast("시작 시점 저장 완료");
      }
    );

    /* 분석 끝 시점 */

    UI.endFrameBtn.addEventListener(
      "click",
      () => {
        if (
          !Number.isFinite(
            UI.analysisVideo.duration
          )
        ) return;

        endTime =
          UI.analysisVideo.currentTime;

        updateAnalysisSpeed();
        toast("끝 시점 저장 완료");
      }
    );

    UI.videoTrackBtn.addEventListener(
      "click",
      beginVideoTracking
    );

    /* 영상 결과 저장 */

    UI.saveAnalysisBtn.addEventListener(
      "click",
      () => {
        if (
          !Number.isFinite(
            validVideoSpeed
          )
        ) return;

        const duration =
          (endTime - startTime) /
          (Number(UI.timeFactor.value) || 1);

        saveRecord(
          validVideoSpeed,
          "영상 분석",
          settings.distance,
          duration
        );
      }
    );

    /* 기록 내보내기 */

    UI.exportCsvBtn.addEventListener(
      "click",
      exportCSV
    );

    /* 기록 삭제 */

    UI.clearRecordsBtn.addEventListener(
      "click",
      () => {
        if (!records.length) {
          toast("삭제할 기록이 없습니다.");
          return;
        }

        const approved = confirm(
          `투구 기록 ${records.length}개를 삭제할까요?`
        );

        if (!approved) return;

        records = [];

        saveJSON(RECORD_KEY, records);
        updateSummaries();

        toast("전체 기록 삭제 완료");
      }
    );

    /* 리포트 출력 */

    UI.printReportBtn.addEventListener(
      "click",
      () => {
        if (!records.length) {
          toast("출력할 기록이 없습니다.");
          return;
        }

        activateView("report");
        window.print();
      }
    );

    /* 화면 크기 변경 */

    window.addEventListener(
      "resize",
      () => {
        drawLiveOverlay();
        drawVideoOverlay();
      }
    );

    /* 앱 종료 */

    window.addEventListener(
      "pagehide",
      () => {
        stopCamera();

        if (videoURL) {
          URL.revokeObjectURL(videoURL);
        }
      }
    );
  }

  /* ============================================================
     16. 프로그램 시작
     ============================================================ */

  addExtras();

  bindEvents();

  applySettings();

  refreshLiveHint();

  updateSummaries();

  invalidateVideoResult();

  setSpeed(
    NaN,
    "측정 대기",
    "측정값 없음 · 실제 거리와 구간 설정 필요"
  );

})();
