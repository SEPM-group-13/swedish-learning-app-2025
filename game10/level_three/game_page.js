// ==============================================
// Owned by Game 10
// ==============================================

import { getLang, recordLevelScore, changeWeight } from "../dev-tools/cookies.js";
import { t, applyI18n as fillText, roundSummary } from "../dev-tools/i18n.js";
import {
  whenReady,
  getBatch,
  vocabUrl,
  playAudio,
  renderPips,
  normalizeAnswer
} from "../dev-tools/util.js";

const TOTAL = 10;
const screens = {
  intro: document.getElementById("intro"),
  play: document.getElementById("play"),
  review: document.getElementById("review"),
  done: document.getElementById("done")
};

const TEXT = {
  en: {
    reviewTitle: "First pass complete",
    reviewNote: (n) =>
      `You missed ${n} ${n === 1 ? "word" : "words"}. Review ${n === 1 ? "it" : "them"} now for another go, or end the round.`,
    reviewBtn: "Review mistakes",
    endBtn: "End round",
    reviewLabel: (i, n) => `Review ${i} of ${n}`
  },
  sv: {
    reviewTitle: "Första genomgången klar",
    reviewNote: (n) =>
      `Du missade ${n} ord. Repetera ${n === 1 ? "det" : "dem"} nu för ett nytt försök, eller avsluta rundan.`,
    reviewBtn: "Repetera felen",
    endBtn: "Avsluta rundan",
    reviewLabel: (i, n) => `Repetition ${i} av ${n}`
  }
};

let lang = "en";
let words = [];
let queue = [];
let phase = "main"; // "main" or "review"
let qIndex = 0;
let results = [];
let reviewResults = [];
let lastTyped = "";

function txt() {
  return TEXT[lang] || TEXT.en;
}

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(lang, el.dataset.i18n);
  });
  document.getElementById("answer").placeholder = t(lang, "typeHere");
}

function show(name) {
  Object.values(screens).forEach((el) => el.classList.remove("is-on"));
  screens[name].classList.add("is-on");
}

function hidePopups() {
  document.getElementById("popup-ok").classList.remove("is-on");
  document.getElementById("popup-no").classList.remove("is-on");
}

function current() {
  return queue[qIndex];
}

function activeResults() {
  return phase === "main" ? results : reviewResults;
}

// just a simple levenstein distance for the user to have an understanding on how close they got
function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function getCloseness(typed, target) {
  const normalizedTyped = normalizeAnswer(typed);
  const normalizedTarget = normalizeAnswer(target);

  if (!normalizedTyped || !normalizedTarget) return "notClose";

  const distance = levenshteinDistance(normalizedTyped, normalizedTarget);
  const maxLength = Math.max(normalizedTyped.length, normalizedTarget.length);
  const similarity = 1 - distance / maxLength;

  if (distance === 1) return "veryClose";
  if (distance === 2 && similarity >= 0.6) return "gettingClose";

  return "notClose";
}

function updateHud() {
  const res = activeResults();
  const total = phase === "main" ? TOTAL : queue.length;
  const ok = res.filter((r) => r === true).length;
  const no = res.filter((r) => r === false).length;
  const n = Math.min(qIndex + 1, total);
  let label;
  if (phase === "main") {
    label = lang === "sv" ? `Fråga ${n} av ${total}` : `Question ${n} of ${total}`;
  } else {
    label = txt().reviewLabel(n, total);
  }
  document.getElementById("q-label").textContent = label;
  document.getElementById("live-score").innerHTML = `<i class="fa-solid fa-check" style="color:#1f6b3a;margin-right:5px"></i>${ok}<span style="color:#cfc7bb;margin:0 8px">|</span><i class="fa-solid fa-xmark" style="color:#9d0000;margin-right:5px"></i>${no}`;
  renderPips(document.getElementById("pips"), res, qIndex, total);
}

function renderPlay() {
  hidePopups();
  const word = current();
  document.getElementById("play-img").src = vocabUrl(word.img);
  document.getElementById("play-img").alt = word.en || word.sv;
  document.getElementById("play-en").textContent = word.en || "";
  document.getElementById("answer").value = "";
  updateHud();
  show("play");
  document.getElementById("answer").focus();
}

function startRound() {
  words = getBatch(TOTAL, "spelling");
  queue = [...words];
  phase = "main";
  qIndex = 0;
  results = [];
  reviewResults = [];
  renderPlay();
}

function startReview() {
  phase = "review";
  queue = words.filter((_, i) => results[i] === false);
  reviewResults = [];
  qIndex = 0;
  renderPlay();
}

function submitAnswer() {
  if (document.querySelector(".al-popup.is-on")) return;
  const word = current();
  const res = activeResults();
  lastTyped = document.getElementById("answer").value;
  const ok = normalizeAnswer(lastTyped) === normalizeAnswer(word.sv);
  if (ok) {
    res[qIndex] = true;
    document.getElementById("ok-img").src = vocabUrl(word.img);
    document.getElementById("ok-sv").textContent = word.sv;
    document.getElementById("popup-ok").classList.add("is-on");
  } else {
    res[qIndex] = false;
    document.getElementById("typed").textContent = lastTyped || "—";
    const closeness = getCloseness(lastTyped, word.sv);
    document.getElementById("closeness-feedback").textContent = t(lang, closeness);
    document.getElementById("no-img").src = vocabUrl(word.img);
    document.getElementById("no-sv").innerHTML = `${word.sv} <span style="font-size:15px;font-weight:400;color:#555">— ${word.en || ""}</span>`;
    document.getElementById("popup-no").classList.add("is-on");
  }
  updateHud();
}

// function acceptWrongAndNext() {
//   if (results[qIndex] !== true) results[qIndex] = false;
//   nextQuestion();
// }

function nextQuestion() {
  hidePopups();
  qIndex += 1;
  if (qIndex < queue.length) {
    renderPlay();
    return;
  }
  
  if (phase === "main") {
    const missed = results.filter((r) => r === false).length;
    if (missed > 0) showReviewChoice(missed);
    else finishRound();
  } else {
    finishRound();
  }
}

function showReviewChoice(missed) {
  const roundScore = results.filter((r) => r === true).length;
  document.getElementById("review-title").textContent = txt().reviewTitle;
  document.getElementById("review-score").textContent = String(roundScore);
  document.getElementById("review-note").textContent = txt().reviewNote(missed);
  document.getElementById("start-review").lastElementChild.textContent = txt().reviewBtn;
  document.getElementById("end-round").textContent = txt().endBtn;
  renderPips(document.getElementById("pips-review"), results, -1, TOTAL);
  show("review");
}

function finishRound() {
  hidePopups();
  const roundScore = results.filter((r) => r === true).length;
  words.forEach((w, i) => changeWeight(w.id, "spelling", results[i] ? 1 : -1));
  const { progress, total } = recordLevelScore(3, roundScore);
  document.getElementById("done-score").textContent = String(roundScore);
  renderPips(document.getElementById("pips-done"), results, -1, TOTAL);
  document.getElementById("done-note").textContent = roundSummary(lang, {
    round: roundScore,
    max: TOTAL,
    level: 3,
    total,
    finished: progress.game_completed
  });
  show("done");
}

whenReady(() => {
  lang = getLang();
  applyI18n();

  document.querySelectorAll(".js-menu").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.href = "../index.html";
    });
  });
  document.getElementById("start").addEventListener("click", startRound);
  document.getElementById("spell-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitAnswer();
  });
  document.querySelectorAll("[data-char]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("answer");
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + btn.dataset.char + input.value.slice(end);
      input.focus();
      const pos = start + 1;
      input.setSelectionRange(pos, pos);
    });
  });
  document.querySelectorAll(".js-audio").forEach((btn) => {
    btn.addEventListener("click", () => playAudio(current()?.audio));
  });
  document.querySelectorAll(".al-popup .js-next").forEach((btn) => btn.addEventListener("click", nextQuestion));
  document.getElementById("start-review").addEventListener("click", startReview);
  document.getElementById("end-round").addEventListener("click", finishRound);
  document.getElementById("again").addEventListener("click", () => show("intro"));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (document.getElementById("popup-ok").classList.contains("is-on")) nextQuestion();
  });
});
