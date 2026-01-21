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