import { supabase } from "./supabaseClient.js";

document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  // ---- AUTH ----
  const loginBtn = document.getElementById("googleLogin");

  loginBtn.addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  });

  async function refreshAuthUI() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    loginBtn.style.display = session ? "none" : "block";
  }

  supabase.auth.onAuthStateChange(async () => {
    await refreshAuthUI();
    await loadEntriesFromSupabase();
    applyMoodColorsToDots();
    renderCard();
  });

  await refreshAuthUI();

  // ---- GRID/TITLE ----
  setupGridAndHeader(); // creates dots
  updateHeaderAndPastDots();
  setInterval(updateHeaderAndPastDots, 1000);

  // ---- LOAD DATA (if logged in) ----
  await loadEntriesFromSupabase();
  applyMoodColorsToDots();
  renderCard();
}

/* ---------------------------
   DATE HELPERS
---------------------------- */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const START_2026 = new Date(2026, 0, 1);
const START_2027 = new Date(2027, 0, 1);
const END_2026 = new Date(2026, 11, 31);

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function clampDate(d) {
  if (d < START_2026) return new Date(START_2026);
  if (d > END_2026) return new Date(END_2026);
  return d;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatCardDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ---------------------------
   TOP TITLE + DOT GRID
---------------------------- */
const grid = document.getElementById("grid");
const title = document.getElementById("title");
const subtitle = document.getElementById("subtitle");

// create dots (30 columns x 13 rows-ish = 365)
const dots = [];
for (let i = 0; i < 365; i++) {
  const dot = document.createElement("div");
  dot.className = "dot";
  dots.push(dot);
  grid.appendChild(dot);
}

// Map date -> dot index (Jan 1 = 0)
function dateToIndex(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Math.floor((startOfDay(d) - START_2026) / MS_PER_DAY);
}

function updateHeaderAndPastDots() {
  const now = new Date();
  title.textContent = now.toLocaleString();

  let filled = 0;
  let daysLeft = 365;

  if (now >= START_2026 && now < START_2027) {
    const dayIndex = Math.floor((startOfDay(now) - START_2026) / MS_PER_DAY);
    filled = dayIndex + 1;
    daysLeft = 365 - filled;
  } else if (now >= START_2027) {
    filled = 365;
    daysLeft = 0;
  }

  dots.forEach((dot, i) => dot.classList.toggle("past", i < filled));
  subtitle.textContent = `${daysLeft} days left`;
}

/* ---------------------------
   SUPABASE DATA (mood + reflection)
   Table: public.day_entries
   Columns: user_id, day, mood, reflection
---------------------------- */
const entries = {}; // key: "YYYY-MM-DD" -> { mood, reflection }

async function loadEntriesFromSupabase() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // logged out: clear local entries
    for (const k of Object.keys(entries)) delete entries[k];
    return;
  }

  const { data, error } = await supabase
    .from("day_entries")
    .select("day,mood,reflection")
    .gte("day", "2026-01-01")
    .lte("day", "2026-12-31");

  if (error) {
    console.error("Load error:", error);
    return;
  }

  // reset and fill
  for (const k of Object.keys(entries)) delete entries[k];
  for (const r of data) {
    entries[r.day] = {
      mood: r.mood ?? "Calm",
      reflection: r.reflection ?? "",
    };
  }
}

async function saveEntryToSupabase(dayISO, mood, reflection) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to sync" };

  const { error } = await supabase
    .from("day_entries")
    .upsert(
      { user_id: user.id, day: dayISO, mood, reflection },
      { onConflict: "user_id,day" },
    );

  if (error) {
    console.error("Save error:", error);
    return { ok: false, message: "Save failed" };
  }
  return { ok: true, message: "Saved" };
}

/* ---------------------------
   SWIPEABLE DAY CARD UI
   Requires you add the Day Card HTML under the dots:
   - #dayCard, #cardDate, #prevDay, #nextDay, #reflection, #saveHint
   - radio inputs: name="mood" values: Fulfilling | Calm | Down
---------------------------- */
const dayCard = document.getElementById("dayCard");
const cardDateEl = document.getElementById("cardDate");
const prevDayBtn = document.getElementById("prevDay");
const nextDayBtn = document.getElementById("nextDay");
const reflectionEl = document.getElementById("reflection");
const saveHint = document.getElementById("saveHint");
const moodInputs = Array.from(document.querySelectorAll('input[name="mood"]'));

// choose initial selected day
let selectedDay = (() => {
  const now = new Date();
  if (now >= START_2026 && now < START_2027) return clampDate(startOfDay(now));
  if (now < START_2026) return new Date(START_2026);
  return new Date(END_2026);
})();

function ensureEntry(iso) {
  if (!entries[iso]) entries[iso] = { mood: "Calm", reflection: "" };
  return entries[iso];
}

function getSelectedMood() {
  const checked = moodInputs.find((i) => i.checked);
  return checked ? checked.value : "Calm";
}

function setSelectedMood(value) {
  moodInputs.forEach((i) => (i.checked = i.value === value));
}

function renderCard() {
  if (!dayCard) return; // if you haven't added the card HTML yet

  const iso = toISODate(selectedDay);
  cardDateEl.textContent = formatCardDate(selectedDay);

  const e = entries[iso] || { mood: "Calm", reflection: "" };
  setSelectedMood(e.mood || "Calm");
  reflectionEl.value = e.reflection || "";

  saveHint.textContent = "";
}

function shiftDay(delta) {
  const d = new Date(selectedDay);
  d.setDate(d.getDate() + delta);
  selectedDay = clampDate(d);
  renderCard();
}

// Simple debounce for saving typing
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveHint.textContent = "Saving…";
  saveTimer = setTimeout(async () => {
    const iso = toISODate(selectedDay);
    const e = ensureEntry(iso);
    const res = await saveEntryToSupabase(iso, e.mood, e.reflection);
    saveHint.textContent = res.message;
    applyMoodColorsToDots(); // update dot color after save
  }, 450);
}

// Nav buttons
if (prevDayBtn) prevDayBtn.addEventListener("click", () => shiftDay(-1));
if (nextDayBtn) nextDayBtn.addEventListener("click", () => shiftDay(1));

// Mood change
moodInputs.forEach((inp) => {
  inp.addEventListener("change", () => {
    if (!inp.checked) return;
    const iso = toISODate(selectedDay);
    const e = ensureEntry(iso);
    e.mood = inp.value; // must match enum values exactly (Fulfilling/Calm/Down)
    scheduleSave();
  });
});

// Reflection typing
if (reflectionEl) {
  reflectionEl.addEventListener("input", () => {
    const iso = toISODate(selectedDay);
    const e = ensureEntry(iso);
    e.reflection = reflectionEl.value;
    scheduleSave();
  });
}

// Swipe (touch) on card
if (dayCard) {
  let startX = 0;
  let startY = 0;
  let swiping = false;

  dayCard.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      swiping = true;
    },
    { passive: true },
  );

  dayCard.addEventListener(
    "touchmove",
    (e) => {
      if (!swiping) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // if mostly vertical movement, cancel swipe (so scrolling works)
      if (Math.abs(dy) > Math.abs(dx)) swiping = false;
    },
    { passive: true },
  );

  dayCard.addEventListener(
    "touchend",
    (e) => {
      if (!swiping) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;

      if (dx > 40)
        shiftDay(-1); // swipe right: previous day
      else if (dx < -40) shiftDay(1); // swipe left: next day

      swiping = false;
    },
    { passive: true },
  );
}

/* ---------------------------
   DOT MOOD COLORING (optional)
   Uses CSS classes:
   - .dot.ful (Fulfilling)
   - .dot.calm (Calm)
   - .dot.down (Down)
   Add CSS for these if you want colored dots.
---------------------------- */
function clearMoodClasses(dot) {
  dot.classList.remove("ful", "calm", "down");
}

function moodToClass(mood) {
  if (mood === "Fulfilling") return "ful";
  if (mood === "Calm") return "calm";
  if (mood === "Down") return "down";
  return null;
}

function applyMoodColorsToDots() {
  // reset
  dots.forEach((dot) => clearMoodClasses(dot));

  // apply from entries
  for (const [iso, e] of Object.entries(entries)) {
    const idx = dateToIndex(iso);
    if (idx < 0 || idx >= dots.length) continue;
    const cls = moodToClass(e.mood);
    if (cls) dots[idx].classList.add(cls);
  }
}
const hhEl = document.getElementById("hh");
const mmEl = document.getElementById("mm");
const ssEl = document.getElementById("ss");
const dayBar = document.getElementById("dayBar");
const timeLeftEl = document.getElementById("timeLeft");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function updateClockAndDayProgress() {
  if (!hhEl || !mmEl || !ssEl || !dayBar || !timeLeftEl) return;

  const now = new Date();

  hhEl.textContent = pad2(now.getHours());
  mmEl.textContent = pad2(now.getMinutes());
  ssEl.textContent = pad2(now.getSeconds());

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const progress = ((now - start) / (end - start)) * 100;
  dayBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;

  const remaining = end - now;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  timeLeftEl.textContent =
    `${pad2(h)}h ${pad2(m)}m ${pad2(s)}s`;
}

// call once + update every second
updateClockAndDayProgress();
setInterval(updateClockAndDayProgress, 1000);

/* ---------------------------
   OPTIONAL: expose signOut if you add a logout button
   <button id="logoutBtn">Logout</button>
---------------------------- */
// const logoutBtn = document.getElementById("logoutBtn");
// if (logoutBtn) logoutBtn.addEventListener("click", signOut);
