const STORAGE_KEY = "xhabbit_data";
const TODAY = new Date();
const TODAY_KEY = getHistoryDateKey(TODAY);
const TODAY_LABEL = TODAY.toDateString();
const HEATMAP_DAYS = 90;

const DEFAULT_HABITS = [
  createDefaultHabit("Coding Practice", "💻", "hard"),
  createDefaultHabit("Reading", "📚", "easy"),
  createDefaultHabit("Exercise", "🏃", "medium"),
  createDefaultHabit("Meditation", "🧘", "easy")
];

const QUOTES = [
  "\"Discipline equals freedom.\" — Jocko Willink",
  "\"You do not rise to the level of your goals. You fall to the level of your systems.\" — James Clear",
  "\"A little progress each day adds up to big results.\" — Satya Nani",
  "\"Success is the sum of small efforts, repeated day in and day out.\" — Robert Collier",
  "\"We are what we repeatedly do. Excellence, then, is not an act but a habit.\" — Will Durant"
];

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", color: "#10b981" },
  medium: { label: "Medium", color: "#38bdf8" },
  hard: { label: "Hard", color: "#f59e0b" }
};

const els = {
  progressPercent: document.getElementById("progress-percent"),
  todayRingFill: document.getElementById("today-ring-fill"),
  bestStreak: document.getElementById("best-streak"),
  currentStreak: document.getElementById("current-streak"),
  habitGrid: document.getElementById("habit-grid"),
  habitTemplate: document.getElementById("habit-card-template"),
  consistencyList: document.getElementById("consistency-list"),
  heatmap: document.getElementById("heatmap"),
  dailyQuote: document.getElementById("daily-quote"),
  exportDataBtn: document.getElementById("exportDataBtn"),
  modal: document.getElementById("habit-modal"),
  form: document.getElementById("habit-form"),
  nameInput: document.getElementById("habit-name"),
  openModalButton: document.getElementById("open-modal-button"),
  closeModalButton: document.getElementById("close-modal-button"),
  particleCanvas: document.getElementById("particle-canvas")
};

const state = loadData();
let weeklyChart;
let monthlyChart;

normalizeState();
applyDailyResetIfNeeded();
syncGlobalStreakForToday();
setupModal();
setupExport();
setupParticles();
registerServiceWorker();
renderApp();

function createDefaultHabit(name, icon, difficulty) {
  return {
    id: crypto.randomUUID(),
    name,
    icon,
    difficulty,
    streak: 0,
    bestStreak: 0,
    completedToday: false,
    lastCompletedDate: null,
    history: {}
  };
}

function createDefaultState() {
  return {
    habits: structuredClone(DEFAULT_HABITS),
    globalStreak: 0,
    globalStreakCarry: 0,
    bestGlobalStreak: 0,
    lastGlobalCompletionDate: null,
    lastSavedDate: TODAY_LABEL
  };
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.habits)) {
      throw new Error("Invalid habits");
    }
    return parsed;
  } catch (error) {
    console.warn("Resetting malformed Xhabbit data:", error);
    return createDefaultState();
  }
}

function normalizeState() {
  state.habits = state.habits.map((habit) => ({
    id: habit.id || crypto.randomUUID(),
    name: habit.name?.trim() || "Unnamed Habit",
    icon: habit.icon || "🎯",
    difficulty: DIFFICULTY_CONFIG[habit.difficulty] ? habit.difficulty : "easy",
    streak: Number.isFinite(habit.streak) ? Math.max(0, habit.streak) : 0,
    bestStreak: Number.isFinite(habit.bestStreak) ? Math.max(0, habit.bestStreak) : 0,
    completedToday: Boolean(habit.completedToday),
    lastCompletedDate: typeof habit.lastCompletedDate === "string" ? habit.lastCompletedDate : null,
    history: sanitizeHistoryMap(habit.history || habit.completions)
  }));

  state.globalStreak = Number.isFinite(state.globalStreak) ? Math.max(0, state.globalStreak) : 0;
  state.globalStreakCarry = Number.isFinite(state.globalStreakCarry)
    ? Math.max(0, state.globalStreakCarry)
    : state.globalStreak;
  state.bestGlobalStreak = Number.isFinite(state.bestGlobalStreak)
    ? Math.max(0, state.bestGlobalStreak)
    : Number.isFinite(state.bestStreak)
      ? Math.max(0, state.bestStreak)
      : 0;
  state.lastGlobalCompletionDate = typeof state.lastGlobalCompletionDate === "string" ? state.lastGlobalCompletionDate : null;
  state.lastSavedDate = typeof state.lastSavedDate === "string" ? state.lastSavedDate : TODAY_LABEL;

  state.habits.forEach((habit) => {
    habit.completedToday = habit.history[TODAY_KEY] === true;
  });

  saveData();
}

function applyDailyResetIfNeeded() {
  if (state.lastSavedDate === TODAY_LABEL) {
    return;
  }

  state.habits = state.habits.map((habit) => {
    const gap = habit.lastCompletedDate ? dayDiff(habit.lastCompletedDate, TODAY_KEY) : Infinity;
    return {
      ...habit,
      completedToday: false,
      streak: gap > 1 ? 0 : habit.streak
    };
  });

  state.globalStreak = 0;
  state.lastSavedDate = TODAY_LABEL;
  saveData();
}

function syncGlobalStreakForToday() {
  const allDoneToday = areAllHabitsCompletedToday();
  if (allDoneToday && state.lastGlobalCompletionDate === TODAY_KEY) {
    state.globalStreak = state.globalStreakCarry;
  } else {
    state.globalStreak = 0;
  }
  saveData();
}

function renderApp() {
  renderProgress();
  renderSummary();
  renderHabits();
  renderConsistency();
  updateHeatmap();
  renderQuote();
  renderCharts();
}

function renderProgress() {
  const totalHabits = state.habits.length || 1;
  const completed = state.habits.filter((habit) => habit.completedToday).length;
  const percent = Math.round((completed / totalHabits) * 100);
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (percent / 100) * circumference;

  els.progressPercent.textContent = `${percent}%`;
  els.todayRingFill.style.strokeDasharray = circumference.toFixed(2);
  els.todayRingFill.style.strokeDashoffset = offset.toFixed(2);
}

function renderSummary() {
  const current = state.globalStreak;
  const best = state.bestGlobalStreak;

  els.currentStreak.textContent = `${current} day${current === 1 ? "" : "s"}`;
  els.bestStreak.textContent = `${best} day${best === 1 ? "" : "s"}`;
}

function renderHabits() {
  els.habitGrid.innerHTML = "";

  if (!state.habits.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Add your first habit to start building momentum.";
    els.habitGrid.append(empty);
    return;
  }

  state.habits.forEach((habit) => {
    const fragment = els.habitTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".habit-card");
    const badge = fragment.querySelector(".habit-difficulty-badge");
    const title = fragment.querySelector(".habit-title");
    const streakLine = fragment.querySelector(".habit-streak-line");
    const icon = fragment.querySelector(".habit-icon");
    const ring = fragment.querySelector(".habit-ring");
    const action = fragment.querySelector(".habit-action");
    const deleteButton = fragment.querySelector(".delete-button");
    const burst = fragment.querySelector(".celebration-burst");

    const isDoneToday = habit.completedToday;
    const ringConfig = getRingConfig(habit.streak, habit.difficulty, isDoneToday);
    const circumference = 2 * Math.PI * 44;
    const offset = isDoneToday ? circumference * 0.06 : circumference;

    card.dataset.habitId = habit.id;
    card.style.setProperty("--ring-color", ringConfig.color);
    card.style.setProperty("--ring-width", `${ringConfig.width}`);
    card.style.setProperty("--ring-offset", `${offset}`);
    card.classList.toggle("is-complete", isDoneToday);
    card.classList.toggle("is-legendary", habit.streak >= 30);
    card.classList.toggle("hard-mode", habit.difficulty === "hard");

    badge.textContent = DIFFICULTY_CONFIG[habit.difficulty].label;
    badge.style.background = colorAlpha(DIFFICULTY_CONFIG[habit.difficulty].color, 0.18);
    badge.style.borderColor = colorAlpha(DIFFICULTY_CONFIG[habit.difficulty].color, 0.34);
    title.textContent = habit.name;
    streakLine.textContent = `${streakAccent(habit.difficulty)} Streak: ${habit.streak} day${habit.streak === 1 ? "" : "s"}`;
    icon.textContent = habit.icon;
    ring.style.strokeDasharray = circumference.toFixed(2);
    ring.style.strokeDashoffset = offset.toFixed(2);
    action.textContent = isDoneToday ? "Undo" : "Mark Done";

    action.addEventListener("click", () => toggleHabitCompletion(habit.id, burst, card));
    deleteButton.addEventListener("click", () => deleteHabit(habit.id));

    els.habitGrid.append(fragment);
  });
}

function renderConsistency() {
  els.consistencyList.innerHTML = "";

  state.habits.forEach((habit) => {
    const percent = calculateConsistency(habit);
    const item = document.createElement("article");
    item.className = "consistency-item";

    item.innerHTML = `
      <div class="consistency-topline">
        <span>${habit.icon} ${habit.name}</span>
        <strong>${percent}%</strong>
      </div>
      <div class="consistency-bar">
        <div class="consistency-fill"></div>
      </div>
    `;

    item.querySelector(".consistency-fill").style.width = `${percent}%`;
    els.consistencyList.append(item);
  });
}

function renderHeatmap() {
  els.heatmap.innerHTML = "";

  const dates = Array.from({ length: HEATMAP_DAYS }, (_, index) => getOffsetDateKey(index - (HEATMAP_DAYS - 1)));
  dates.forEach((date) => {
    const completedHabits = totalCompletionsForDate(date);
    const totalHabits = state.habits.length;
    const ratio = totalHabits ? completedHabits / totalHabits : 0;
    const cell = document.createElement("div");

    cell.className = `heat-cell heat-${getHeatLevel(ratio)}`;
    cell.title = `${date}\n${completedHabits}/${totalHabits || 0} habits completed`;
    els.heatmap.append(cell);
  });
}

function updateHeatmap() {
  renderHeatmap();
}

function renderQuote() {
  const quoteIndex = hashString(TODAY_LABEL) % QUOTES.length;
  els.dailyQuote.textContent = QUOTES[quoteIndex];
}

function renderCharts() {
  const weeklyData = getWeeklyCompletionSeries();
  const monthlyData = getMonthlyTrendSeries();

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.96)",
        borderColor: "rgba(56, 189, 248, 0.3)",
        borderWidth: 1,
        titleColor: "#e2e8f0",
        bodyColor: "#cbd5e1"
      }
    }
  };

  if (weeklyChart) {
    weeklyChart.destroy();
  }

  weeklyChart = new Chart(document.getElementById("weekly-chart"), {
    type: "bar",
    data: {
      labels: weeklyData.labels,
      datasets: [{
        data: weeklyData.values,
        borderRadius: 12,
        backgroundColor: weeklyData.values.map((value) => (
          value >= 80 ? "rgba(16, 185, 129, 0.85)" :
          value >= 50 ? "rgba(56, 189, 248, 0.85)" :
          "rgba(139, 92, 246, 0.85)"
        ))
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#94a3b8" }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: "#64748b", callback: (value) => `${value}%` },
          grid: { color: "rgba(148, 163, 184, 0.12)" }
        }
      }
    }
  });

  if (monthlyChart) {
    monthlyChart.destroy();
  }

  monthlyChart = new Chart(document.getElementById("monthly-chart"), {
    type: "line",
    data: {
      labels: monthlyData.labels,
      datasets: [{
        data: monthlyData.values,
        fill: true,
        tension: 0.35,
        borderColor: "#60a5fa",
        backgroundColor: "rgba(56, 189, 248, 0.12)",
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#64748b",
            autoSkip: true,
            maxTicksLimit: 6
          }
        },
        y: {
          beginAtZero: true,
          suggestedMax: Math.max(3, state.habits.length),
          ticks: {
            stepSize: 1,
            color: "#64748b"
          },
          grid: { color: "rgba(148, 163, 184, 0.12)" }
        }
      }
    }
  });
}

function toggleHabitCompletion(habitId, burstEl, cardEl) {
  const habit = state.habits.find((entry) => entry.id === habitId);
  if (!habit) {
    return;
  }

  if (habit.completedToday) {
    undoHabitDone(habit);
  } else {
    applyHabitDone(habit, burstEl, cardEl);
  }

  updateGlobalStreak();
  saveData();
  renderApp();
}

function applyHabitDone(habit, burstEl, cardEl) {
  const diff = habit.lastCompletedDate ? dayDiff(habit.lastCompletedDate, TODAY_KEY) : null;
  const previousStreak = habit.streak;

  if (diff === 1) {
    habit.streak += 1;
  } else if (diff === 0) {
    return;
  } else {
    habit.streak = 1;
  }

  habit.completedToday = true;
  habit.lastCompletedDate = TODAY_KEY;
  habit.history[TODAY_KEY] = true;
  habit.bestStreak = Math.max(habit.bestStreak, habit.streak);
  habit.previousStreak = previousStreak;

  triggerCelebration(burstEl, cardEl, DIFFICULTY_CONFIG[habit.difficulty].color);
}

function undoHabitDone(habit) {
  if (!habit.completedToday || habit.lastCompletedDate !== TODAY_KEY) {
    return;
  }

  habit.completedToday = false;
  habit.history[TODAY_KEY] = false;

  if (Number.isFinite(habit.previousStreak)) {
    habit.streak = Math.max(0, habit.previousStreak);
  } else {
    habit.streak = Math.max(0, habit.streak - 1);
  }

  habit.lastCompletedDate = null;
  delete habit.previousStreak;
}

function updateGlobalStreak() {
  if (!areAllHabitsCompletedToday()) {
    state.globalStreak = 0;
    return;
  }

  if (state.lastGlobalCompletionDate === TODAY_KEY) {
    state.globalStreak = state.globalStreakCarry;
    return;
  }

  const continuesChain =
    state.lastGlobalCompletionDate &&
    dayDiff(state.lastGlobalCompletionDate, TODAY_KEY) === 1;

  state.globalStreak = continuesChain ? state.globalStreakCarry + 1 : 1;
  state.globalStreakCarry = state.globalStreak;
  state.lastGlobalCompletionDate = TODAY_KEY;
  state.bestGlobalStreak = Math.max(state.bestGlobalStreak, state.globalStreak);
}

function deleteHabit(habitId) {
  state.habits = state.habits.filter((habit) => habit.id !== habitId);
  syncGlobalStreakForToday();
  saveData();
  renderApp();
}

function setupModal() {
  els.openModalButton.addEventListener("click", () => toggleModal(true));
  els.closeModalButton.addEventListener("click", () => toggleModal(false));
  els.modal.addEventListener("click", (event) => {
    if (event.target === els.modal) {
      toggleModal(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggleModal(false);
    }
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(els.form);
    const name = String(formData.get("habitName") || "").trim();
    const icon = String(formData.get("habitIcon") || "🎯");
    const difficulty = String(formData.get("habitDifficulty") || "easy");

    if (!name) {
      els.nameInput.focus();
      return;
    }

    state.habits.push({
      id: crypto.randomUUID(),
      name,
      icon,
      difficulty,
      streak: 0,
      bestStreak: 0,
      completedToday: false,
      lastCompletedDate: null,
      history: {}
    });

    syncGlobalStreakForToday();
    saveData();
    els.form.reset();
    toggleModal(false);
    renderApp();
  });
}

function setupExport() {
  els.exportDataBtn?.addEventListener("click", exportBackup);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
    });
  }
}

function exportBackup() {
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    alert("No data available to export.");
    return;
  }

  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "xhabbit-backup.json";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function toggleModal(open) {
  els.modal.classList.toggle("hidden", !open);
  els.modal.setAttribute("aria-hidden", String(!open));
  if (open) {
    setTimeout(() => els.nameInput.focus(), 50);
  }
}

function triggerCelebration(container, card, color) {
  card.animate(
    [
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(-4px) scale(1.01)" },
      { transform: "translateY(0) scale(1)" }
    ],
    { duration: 480, easing: "ease-out" }
  );

  for (let index = 0; index < 16; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.background = index % 2 === 0 ? color : index % 3 === 0 ? "#fbbf24" : "#38bdf8";
    piece.style.left = "50%";
    piece.style.top = "50%";
    piece.style.setProperty("--tx", `${randomBetween(-90, 90)}px`);
    piece.style.setProperty("--ty", `${randomBetween(-100, -10)}px`);
    piece.style.setProperty("--rot", `${randomBetween(-180, 180)}deg`);
    container.append(piece);
    setTimeout(() => piece.remove(), 950);
  }
}

function setupParticles() {
  const canvas = els.particleCanvas;
  const context = canvas.getContext("2d");
  const particles = Array.from({ length: 42 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() * 2.2 + 0.8,
    speed: Math.random() * 0.0009 + 0.00025,
    alpha: Math.random() * 0.7 + 0.1
  }));

  const resize = () => {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  };

  const draw = () => {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles.forEach((particle) => {
      particle.y += particle.speed;
      if (particle.y > 1.1) {
        particle.y = -0.1;
        particle.x = Math.random();
      }

      const px = particle.x * window.innerWidth;
      const py = particle.y * window.innerHeight;
      const gradient = context.createRadialGradient(px, py, 0, px, py, particle.size * 8);
      gradient.addColorStop(0, `rgba(255,255,255,${particle.alpha})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(px, py, particle.size * 4, 0, Math.PI * 2);
      context.fill();
    });

    requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener("resize", resize);
}

function calculateConsistency(habit) {
  const days = Array.from({ length: 10 }, (_, index) => getOffsetDateKey(-index));
  const completed = days.filter((date) => habit.history[date] === true).length;
  return Math.round((completed / days.length) * 100);
}

function getWeeklyCompletionSeries() {
  const labels = [];
  const values = [];

  for (let offset = -6; offset <= 0; offset += 1) {
    const date = getOffsetDateKey(offset);
    const day = new Date(`${date}T00:00:00`);
    labels.push(day.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1));
    values.push(completionRateForDate(date));
  }

  return { labels, values };
}

function getMonthlyTrendSeries() {
  const labels = [];
  const values = [];

  for (let offset = -29; offset <= 0; offset += 1) {
    const date = getOffsetDateKey(offset);
    labels.push(date.slice(5));
    values.push(totalCompletionsForDate(date));
  }

  return { labels, values };
}

function completionRateForDate(date) {
  if (!state.habits.length) {
    return 0;
  }
  const completed = state.habits.filter((habit) => habit.history[date] === true).length;
  return Math.round((completed / state.habits.length) * 100);
}

function totalCompletionsForDate(date) {
  return state.habits.reduce((count, habit) => count + (habit.history[date] === true ? 1 : 0), 0);
}

function getHeatLevel(ratio) {
  if (ratio <= 0) return 0;
  if (ratio < 0.5) return 1;
  if (ratio < 0.75) return 2;
  if (ratio < 1) return 3;
  return 4;
}

function areAllHabitsCompletedToday() {
  return state.habits.length > 0 && state.habits.every((habit) => habit.completedToday);
}

function getRingConfig(streak, difficulty, isDoneToday) {
  const difficultyColor = DIFFICULTY_CONFIG[difficulty].color;
  if (!isDoneToday) {
    return { color: difficulty === "hard" ? "#fb7185" : difficultyColor, width: 7 };
  }
  if (streak >= 30) {
    return { color: "#fbbf24", width: 15 };
  }
  if (streak >= 10) {
    return { color: difficulty === "hard" ? "#f97316" : difficultyColor, width: 12 };
  }
  if (streak >= 4) {
    return { color: difficultyColor, width: 10 };
  }
  return { color: difficultyColor, width: 7 };
}

function streakAccent(difficulty) {
  if (difficulty === "hard") return "🔥";
  if (difficulty === "medium") return "⚡";
  return "✨";
}

function sanitizeHistoryMap(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value).reduce((acc, [date, completed]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      acc[date] = completed === true;
    }
    return acc;
  }, {});
}

function saveData() {
  const data = {
    habits: state.habits,
    globalStreak: state.globalStreak,
    globalStreakCarry: state.globalStreakCarry,
    bestStreak: state.bestGlobalStreak,
    bestGlobalStreak: state.bestGlobalStreak,
    lastGlobalCompletionDate: state.lastGlobalCompletionDate,
    lastSavedDate: state.lastSavedDate
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getHistoryDateKey(date) {
  return date.toISOString().split("T")[0];
}

function getOffsetDateKey(offset) {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + offset);
  return getHistoryDateKey(date);
}

function dayDiff(fromDate, toDate) {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  return Math.round((end - start) / 86400000);
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function colorAlpha(hex, alpha) {
  const clean = hex.replace("#", "");
  const bigint = Number.parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
