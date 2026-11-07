
const $ = id => document.getElementById(id);

const STORAGE_KEY = "chronova_capsules_v1";

let capsules = [];
let toastTimer;

const form = $("capsuleForm");
const titleInput = $("capsuleTitle");
const messageInput = $("capsuleMessage");
const dateInput = $("openDate");
const imageInput = $("capsuleImage");

const today = new Date();
const localToday = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0")
].join("-");

dateInput.min = localToday;

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function loadCapsules() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    capsules = Array.isArray(parsed)
      ? parsed.filter(item =>
          item &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.message === "string" &&
          typeof item.openDate === "string"
        )
      : [];
  } catch (error) {
    capsules = [];
    showToast("Could not read saved capsules.");
  }

  renderCapsules();
}

function saveCapsules() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capsules));
    return true;
  } catch (error) {
    showToast("Storage is full. Try removing a photo.");
    return false;
  }
}

function isUnlocked(capsule) {
  return capsule.openDate <= localToday;
}

function updateStats() {
  $("totalCapsules").textContent = capsules.length;

  $("lockedCapsules").textContent =
    capsules.filter(c => !isUnlocked(c)).length;

  $("openedCapsules").textContent =
    capsules.filter(isUnlocked).length;
}

function createCard(capsule) {
  const card = document.createElement("article");
  card.className = "capsule-card";

  const unlocked = isUnlocked(capsule);

  const heading = document.createElement("h3");
  heading.textContent = unlocked
    ? "✉ " + capsule.title
    : "🔒 " + capsule.title;

  const date = document.createElement("div");
  date.className = "capsule-date";
  date.textContent = unlocked
    ? "✦ UNLOCKED · " + capsule.openDate
    : "🔒 SEALED UNTIL · " + capsule.openDate;

  const message = document.createElement("p");
  message.textContent = unlocked
    ? capsule.message
    : "This memory is waiting for its special day.";

  card.append(heading, date, message);

  if (unlocked && capsule.image) {
    const img = document.createElement("img");
    img.src = capsule.image;
    img.alt = "Memory attached to " + capsule.title;
    card.appendChild(img);
  }

  if (!unlocked) {
    const remaining = document.createElement("p");
    remaining.textContent = getCountdown(capsule.openDate);
    card.appendChild(remaining);
  }

  const actions = document.createElement("div");
  actions.className = "capsule-actions";

  if (unlocked) {
    const copyButton = document.createElement("button");
    copyButton.textContent = "Copy memory";

    copyButton.addEventListener("click", async () => {
      const content = capsule.title + "\n\n" + capsule.message;

      try {
        await navigator.clipboard.writeText(content);
        showToast("Memory copied!");
      } catch {
        showToast("Copy is unavailable in this browser.");
      }
    });

    actions.appendChild(copyButton);
  }

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Delete";

  deleteButton.addEventListener("click", () => {
    if (!confirm("Delete this capsule permanently from this device?")) {
      return;
    }

    capsules = capsules.filter(item => item.id !== capsule.id);

    if (saveCapsules()) {
      renderCapsules();
      showToast("Capsule deleted.");
    }
  });

  actions.appendChild(deleteButton);
  card.appendChild(actions);

  return card;
}

function getCountdown(dateString) {
  const target = new Date(dateString + "T00:00:00");
  const now = new Date();

  const difference = target.getTime() - now.getTime();

  if (difference <= 0) {
    return "Your memory is ready to open.";
  }

  const days = Math.ceil(difference / (1000 * 60 * 60 * 24));

  return days === 1
    ? "Opens in 1 day ✦"
    : "Opens in " + days + " days ✦";
}

function renderCapsules() {
  const list = $("capsuleList");
  list.replaceChildren();

  if (capsules.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const symbol = document.createElement("span");
    symbol.textContent = "✧";

    const heading = document.createElement("h3");
    heading.textContent = "Your universe is waiting";

    const description = document.createElement("p");
    description.textContent =
      "Create your first capsule to begin your journey.";

    empty.append(symbol, heading, description);
    list.appendChild(empty);
  } else {
    const sorted = [...capsules].sort((a, b) =>
      a.openDate.localeCompare(b.openDate)
    );

    sorted.forEach(capsule => {
      list.appendChild(createCard(capsule));
    });
  }

  updateStats();
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select an image."));
      return;
    }

    if (file.size > 1024 * 1024) {
      reject(new Error("Choose an image smaller than 1 MB."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Image could not be read."));

    reader.readAsDataURL(file);
  });
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const message = messageInput.value.trim();
  const openDate = dateInput.value;

  if (!title || !message || !openDate) {
    showToast("Please complete all required fields.");
    return;
  }

  if (openDate < localToday) {
    showToast("Choose today or a future date.");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Sealing your capsule...";

  try {
    const image = await readImage(imageInput.files[0]);

    const capsule = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString() + Math.random().toString(16).slice(2),
      title,
      message,
      openDate,
      image,
      createdAt: new Date().toISOString()
    };

    capsules.push(capsule);

    if (!saveCapsules()) {
      capsules.pop();
      return;
    }

    form.reset();
    dateInput.min = localToday;

    renderCapsules();
    showToast("Your time capsule has been sealed! ✦");

    $("capsuleList").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    showToast(error.message || "Something went wrong.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Seal my capsule ✦";
  }
});

loadCapsules();
        
