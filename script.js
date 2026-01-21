const MS_PER_DAY = 24 * 60 * 60 * 1000;

const grid = document.getElementById("grid");
const title = document.getElementById("title");
const subtitle = document.getElementById("subtitle");

// create 365 dots
const dots = [];
for (let i = 0; i < 365; i++) {
  const dot = document.createElement("div");
  dot.className = "dot";
  dots.push(dot);
  grid.appendChild(dot);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateTime(date) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function update() {
  const now = new Date();

  title.textContent = `Today: ${formatDateTime(now)}`;

  const start2026 = new Date(2026, 0, 1);
  const start2027 = new Date(2027, 0, 1);

  let filled = 0;
  let daysLeft = 365;

  if (now >= start2026 && now < start2027) {
    const todayStart = startOfDay(now);
    const dayIndex = Math.floor((todayStart - start2026) / MS_PER_DAY);
    filled = dayIndex + 1;
    daysLeft = 365 - filled;
  } else if (now >= start2027) {
    filled = 365;
    daysLeft = 0;
  }

  dots.forEach((dot, i) => {
    dot.classList.toggle("past", i < filled);
  });

  subtitle.textContent = `${daysLeft} days left in 2026`;
}

update();
setInterval(update, 1000);