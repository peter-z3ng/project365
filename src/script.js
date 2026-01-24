import { supabase } from "./supabaseClient.js";

const loginBtn = document.getElementById("googleLogin");

loginBtn.addEventListener("click", async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
});

// Optional logout button (you can add in HTML)
async function signOut() {
  await supabase.auth.signOut();
}

// Show/hide login button based on session
async function refreshAuthUI() {
  const { data: { session } } = await supabase.auth.getSession();
  loginBtn.style.display = session ? "none" : "block";
}

supabase.auth.onAuthStateChange(() => {
  refreshAuthUI();
});

refreshAuthUI();

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const grid = document.getElementById("grid");
const title = document.getElementById("title");
const subtitle = document.getElementById("subtitle");

// create dots
const dots = [];
for (let i = 0; i < 365; i++) {
  const d = document.createElement("div");
  d.className = "dot";
  dots.push(d);
  grid.appendChild(d);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function update() {
  const now = new Date();
  title.textContent = `${now.toLocaleString()}`;

  const start2026 = new Date(2026, 0, 1);
  const start2027 = new Date(2027, 0, 1);

  let filled = 0;
  let daysLeft = 365;

  if (now >= start2026 && now < start2027) {
    const dayIndex = Math.floor((startOfDay(now) - start2026) / MS_PER_DAY);
    filled = dayIndex + 1;
    daysLeft = 365 - filled;
  } else if (now >= start2027) {
    filled = 365;
    daysLeft = 0;
  }

  dots.forEach((dot, i) => {
    dot.classList.toggle("past", i < filled);
  });

  subtitle.textContent = `${daysLeft} days left`;
}

update();
setInterval(update, 1000);

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadEntries2026() {
  const { data, error } = await supabase
    .from("day_entries")
    .select("day,mood,reflection")
    .gte("day", "2026-01-01")
    .lte("day", "2026-12-31");

  if (error) throw error;

  const map = {};
  for (const r of data) map[r.day] = r; // key: "YYYY-MM-DD"
  return map;
}

async function saveEntry(dayISO, mood, reflection) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("day_entries")
    .upsert(
      { user_id: user.id, day: dayISO, mood, reflection },
      { onConflict: "user_id,day" }
    );

  if (error) throw error;
}