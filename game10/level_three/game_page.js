// ==============================================
// Owned by Game 10
// ==============================================

import { getLang, recordLevelScore, changeWeight } from "../dev-tools/cookies.js";
import { t, applyI18n as fillText, roundSummary } from "../dev-tools/i18n.js";
import {
  whenReady,
  getBatch,
  vocabUrl,
  preloadImages,
  playAudio,
  renderPips,
  normalizeAnswer
} from "../dev-tools/util.js";


const TOTAL = 10;
const screens = {
  intro: document.getElementById("intro"),
  play: document.getElementById("play"),
  done: document.getElementById("done")
};

let lang = "en";
let words = [];
let qIndex = 0;
let results = [];
let lastTyped = "";

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
  return words[qIndex];
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
  const ok = results.filter((r) => r === true).length;
  const no = results.filter((r) => r === false).length;
  const label = lang === "sv" ? `Fråga ${Math.min(qIndex + 1, TOTAL)} av ${TOTAL}` : `Question ${Math.min(qIndex + 1, TOTAL)} of ${TOTAL}`;
  document.getElementById("q-label").textContent = label;
  document.getElementById("live-score").innerHTML = `<i class="fa-solid fa-check" style="color:#1f6b3a;margin-right:5px"></i>${ok}<span style="color:#cfc7bb;margin:0 8px">|</span><i class="fa-solid fa-xmark" style="color:#9d0000;margin-right:5px"></i>${no}`;
  renderPips(document.getElementById("pips"), results, qIndex, TOTAL);
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
  preloadImages(words);
  qIndex = 0;
  results = [];
  renderPlay();
}

function submitAnswer() {
  if (document.querySelector(".al-popup.is-on")) return;
  const word = current();
  lastTyped = document.getElementById("answer").value;
  const ok = normalizeAnswer(lastTyped) === normalizeAnswer(word.sv);
  if (ok) {
    results[qIndex] = true;
    document.getElementById("ok-img").src = vocabUrl(word.img);
    document.getElementById("ok-sv").textContent = word.sv;
    document.getElementById("popup-ok").classList.add("is-on");
  } else {
    document.getElementById("typed").textContent = lastTyped || "—";
    const closeness = getCloseness(lastTyped, word.sv);
    document.getElementById("closeness-feedback").textContent = t(lang, closeness);
    document.getElementById("no-img").src = vocabUrl(word.img);
    document.getElementById("no-sv").innerHTML = `${word.sv} <span style="font-size:15px;font-weight:400;color:#555">— ${word.en || ""}</span>`;
    document.getElementById("popup-no").classList.add("is-on");
  }
  updateHud();
}

function acceptWrongAndNext() {
  if (results[qIndex] !== true) results[qIndex] = false;
  nextQuestion();
}

function nextQuestion() {
  hidePopups();
  qIndex += 1;
  if (qIndex >= words.length) finishRound();
  else renderPlay();
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
  document.querySelectorAll("#popup-ok .js-next").forEach((btn) => btn.addEventListener("click", nextQuestion));
  document.querySelectorAll("#popup-no .js-next").forEach((btn) => btn.addEventListener("click", acceptWrongAndNext));
  document.getElementById("try-again").addEventListener("click", () => {
    hidePopups();
    document.getElementById("answer").focus();
  });
  document.getElementById("again").addEventListener("click", () => show("intro"));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (document.getElementById("popup-ok").classList.contains("is-on")) nextQuestion();
  });
});
