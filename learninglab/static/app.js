import { mountScene, heroGraphic } from "./visuals.js";
import { hostSignInTarget } from "./auth-redirect.mjs";
const app = document.querySelector("#app");
const base = location.pathname.replace(/\/(login)?$/, "");
const apiRoot = base + "/api";
let hostSignIn = "", fontLoaded = false;
let csrf = "",
  state = null,
  page = [
    "home",
    "curriculum",
    "studio",
    "practice",
    "research",
    "library",
    "profile",
  ].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "home",
  selected = "ode-growth",
  task = null,
  answerValue = "",
  lastResult = null,
  chatTurns = [],
  busy = false,
  pathRequest = 0;
const e = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const mark = `<svg class="mark" viewBox="0 0 32 36" aria-hidden="true"><path d="M4 31C4 11 28 25 28 5M4 5C4 25 28 11 28 31" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="4" cy="5" r="3" fill="currentColor"/><circle cx="28" cy="5" r="3" fill="currentColor"/><circle cx="4" cy="31" r="3" fill="currentColor"/><circle cx="28" cy="31" r="3" fill="currentColor"/></svg>`;
const nodes = () => state.catalog.concepts;
const title = (id) => nodes().find((n) => n.id === id)?.title || id;
const badge = (text, cls = "") =>
  `<span class="badge ${cls}">${e(text)}</span>`;
const button = (text, action, cls = "", extra = "") =>
  `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
function notify(msg) {
  const n = document.querySelector("#notice");
  n.textContent = msg;
  n.classList.add("show");
  setTimeout(() => n.classList.remove("show"), 6500);
}
async function api(path, options = {}) {
  const res = await fetch(apiRoot + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
      ...options.headers,
    },
  });
  const target = hostSignInTarget(res.headers.get("X-Login-URL"), location.origin);
  if (target) hostSignIn = target;
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401 && path != "/auth/login") {
      loginView();
    }
    throw Error(
      typeof data.detail === "string"
        ? data.detail
        : "The request could not be completed.",
    );
  }
  return data;
}
async function refresh() {
  state = await api("/state");
}
function loginView(error = "") {
  if (hostSignIn) {
    state = null;
    chatTurns = [];
    task = null;
    app.replaceChildren();
    location.replace(hostSignIn);
    return;
  }
  app.innerHTML = `<main id="main" class="login-panel"><form class="login-form" id="login-form"><div class="brand">${mark}Pathweave</div><h1>Sign in</h1><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="100"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button class="primary" type="submit">Sign in</button><div class="login-error" role="alert">${e(error)}</div></form></main>`;
  document.querySelector("#login-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const b = ev.submitter;
    b.disabled = true;
    b.textContent = "Signing in…";
    try {
      const s = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: ev.target.username.value,
          password: ev.target.password.value,
        }),
      });
      csrf = s.csrf;
      await refresh();
      render();
    } catch (err) {
      document.querySelector(".login-error").textContent = err.message;
      b.disabled = false;
      b.textContent = "Sign in →";
    }
  };
}
const menu = [
  ["home", "⌂", "Learn"],
  ["curriculum", "⌘", "My path"],
  ["practice", "✓", "Practice"],
  ["profile", "◎", "Progress"],
];
function render() {
  if (!state) return;
  const host = state.host || {};
  const currentPage = page === "studio" ? "home" : page;
  app.innerHTML = `<div class="shell"><aside class="sidebar"><a href="#home" class="brand" data-page="home">${mark}<span>Pathweave</span></a><div class="subject">Mathematics</div><nav class="nav" aria-label="Main navigation">${menu.map(([id, icon, label]) => button(`<span class="navicon" aria-hidden="true">${icon}</span>${label}`, "page", id === currentPage ? "active" : "", `data-page="${id}" ${id === currentPage ? 'aria-current="page"' : ""}`)).join("")}</nav><div class="side-bottom">${host.name ? `<a class="host-home" href="${e(safeLink(host.home_path))}"><span aria-hidden="true">←</span> ${e(host.name)}</a>` : ""}${host.settings_path ? `<a href="${e(safeLink(host.settings_path))}">Settings</a>` : button("Settings", "page", "text-btn", 'data-page="settings"')}</div></aside><div class="workspace"><header class="topbar"><span class="breadcrumb">Mathematics <span aria-hidden="true">/</span> ${e(page === "studio" ? "Lesson" : menu.find((m) => m[0] === page)?.[2] || "Settings")}</span><div class="account">${button("Sign out", "logout", "text-btn")}</div></header><main id="main" class="main" tabindex="-1"></main></div></div>`;
  const main = document.querySelector("#main");
  ({home: homeView, curriculum: curriculumView, studio: studioView, practice: practiceView,
    profile: profileView, settings: settingsView}[page] || homeView)(main);
  wire();
}
function safeLink(url) {
  try {
    const u = new URL(url, location.origin);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "#";
  } catch {
    return "#";
  }
}
function intro(kicker, heading, description) {
  return `${kicker ? `<div class="eyebrow">${kicker}</div>` : ""}<h1>${heading}</h1>${description ? `<p class="intro">${description}</p>` : ""}`;
}
function homeView(main) {
  const available = nodes().filter((n) => state.catalog.lessons[n.id]);
  const goal = state.profile.goal;
  const next = available.find((n) => n.id === goal) || available.find((n) => n.id === selected) || available[0];
  const lesson = state.catalog.lessons[next.id];
  main.innerHTML = intro("", "Mathematics", "Learn a concept, work through an example, then try it yourself.") +
    `<section class="hero-card"><div class="hero-copy"><div class="eyebrow">${Object.keys(state.profile.skills || {}).length ? "Continue learning" : "Start here"}</div><h2>${e(next.title)}</h2><p>${e(lesson.question)}</p>${button("Start lesson <span aria-hidden='true'>→</span>", "open-lesson", "primary", `data-concept="${e(next.id)}"`)}</div><div class="hero-art" id="hero-art"></div></section><div class="section-head"><h2>Lessons</h2>${button("Choose a goal →", "page", "text-btn", 'data-page="curriculum"')}</div><div class="lesson-grid">${available.map((n, i) => `<button class="lesson-card" data-action="open-lesson" data-concept="${e(n.id)}"><span class="lesson-number">${String(i + 1).padStart(2,"0")}</span><h3>${e(n.title)}</h3><p>${e(state.catalog.lessons[n.id].question)}</p><span class="lesson-open">Open lesson <span aria-hidden="true">↗</span></span></button>`).join("")}</div>`;
  document.querySelector("#hero-art").append(heroGraphic());
}
function curriculumView(main) {
  main.innerHTML =
    intro(
      "",
      "My path",
      "Choose a goal to see the concepts that lead to it.",
    ) +
    `<div class="card"><div class="grid two"><div><label for="goal">What would you like to understand?</label><select id="goal">${nodes()
      .map(
        (n) =>
          `<option value="${e(n.id)}" ${(state.profile.goal || "ode-growth") === n.id ? "selected" : ""}>${e(n.title)}</option>`,
      )
      .join(
        "",
      )}</select></div><div><label for="strategy">Lesson order</label><select id="strategy"><option value="connected">Build on connections</option><option value="proof-first" ${state.profile.strategy === "proof-first" ? "selected" : ""}>Start with proofs</option></select></div></div><details><summary>About this path</summary><p>This suggested order follows the current concept map. It has not been shown to be the best order for every learner.</p></details>${button("Show my path →", "build-path", "primary")}</div><div id="path-list" class="path-list"></div><div class="section-head"><h2>Concept map</h2>${badge("Select a concept")}</div><div id="map" class="map-wrap"></div><details><summary>Reading the map</summary><p>Lines show prerequisites in the current map. Later topics may not have lessons yet. Connections preview related ideas; they do not replace the required foundations.</p></details>`;
  drawMap();
  void buildPath(false);
}
async function buildPath(save = true) {
  const requestId = ++pathRequest;
  const goal = document.querySelector("#goal").value,
    strategy = document.querySelector("#strategy").value;
  const path = await api("/pathway?" + new URLSearchParams({ goal, strategy }));
  if (requestId !== pathRequest || page !== "curriculum") return;
  if (save) {
    await api("/profile", {
      method: "POST",
      body: JSON.stringify({ ...state.profile, goal, strategy }),
    });
    state.profile.goal = goal;
    state.profile.strategy = strategy;
  }
  document.querySelector("#path-list").innerHTML = path
    .map(
      (n, i) =>
        `<div class="path-node"><span class="circle">${i + 1}</span><div><h3>${e(n.title)}</h3><p>${e(n.outcome)}</p></div>${badge(n.status === "pilot" ? "Lesson available" : "Coming later", n.status === "pilot" ? "green" : "")} ${button(n.status === "pilot" ? "Learn →" : "View →", "open-lesson", "", `data-concept="${e(n.id)}"`)}</div>`,
    )
    .join("");
  wire();
}
function drawMap() {
  const ns = "http://www.w3.org/2000/svg",
    s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 1440 650");
  s.setAttribute(
    "aria-label",
    "Mathematics concept network. Use the path list above for a text equivalent.",
  );
  const positions = {},
    counts = {};
  for (const n of nodes()) {
    const c = counts[n.stage] || 0;
    counts[n.stage] = c + 1;
    positions[n.id] = [n.stage * 116 + 15, c * 85 + 42];
  }
  for (const n of nodes())
    for (const p of n.prerequisites) {
      const [a, b] = positions[p],
        [c, d] = positions[n.id];
      const path = document.createElementNS(ns, "path");
      path.setAttribute(
        "d",
        `M${a + 105},${b + 19} C${a + 120},${b + 19} ${c - 15},${d + 19} ${c},${d + 19}`,
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#3d3d3d");
      s.append(path);
    }
  for (const n of nodes()) {
    const [x, y] = positions[n.id],
      g = document.createElementNS(ns, "g");
    g.setAttribute("class", "mapnode");
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", n.title + ", " + n.status);
    const r = document.createElementNS(ns, "rect");
    Object.entries({
      x,
      y,
      width: 105,
      height: 44,
      rx: 7,
      fill: n.status === "pilot" ? "#252525" : "#101010",
      stroke: "#515151",
    }).forEach(([k, v]) => r.setAttribute(k, v));
    g.append(r);
    const words = n.title.split(" ");
    let lines = [""];
    for (const word of words) {
      if ((lines.at(-1) + " " + word).length > 16) lines.push(word);
      else lines[lines.length - 1] += (lines.at(-1) ? " " : "") + word;
    }
    lines.slice(0, 3).forEach((l, i) => {
      const t = document.createElementNS(ns, "text");
      t.setAttribute("x", x + 7);
      t.setAttribute("y", y + 13 + i * 12);
      t.textContent = l;
      g.append(t);
    });
    g.onclick = () => openLesson(n.id);
    g.onkeydown = (ev) => {
      if (["Enter", " "].includes(ev.key)) {
        ev.preventDefault();
        openLesson(n.id);
      }
    };
    s.append(g);
  }
  document.querySelector("#map").append(s);
}
function openLesson(id) {
  selected = id;
  page = "studio";
  history.replaceState(null, "", "#lesson=" + encodeURIComponent(id));
  chatTurns = [];
  render();
  window.scrollTo(0, 0);
}
function studioView(main) {
  const lesson = state.catalog.lessons[selected],
    node = nodes().find((n) => n.id === selected);
  main.innerHTML =
    intro(
      "Lesson",
      e(node.title),
      e(lesson?.question || node.outcome),
    ) +
    `<div class="row space-bottom"><label class="small" for="lesson-select">Choose a lesson</label><select id="lesson-select">${nodes()
      .filter((n) => state.catalog.lessons[n.id] || n.id === selected)
      .map(
        (n) =>
          `<option value="${e(n.id)}" ${n.id === selected ? "selected" : ""}>${e(n.title)}${n.status === "pilot" ? "" : " · coming later"}</option>`,
      )
      .join(
        "",
      )}</select></div><div class="studio"><article class="card lesson">${
      lesson
        ? `<div id="visual-scene"></div><h3>The idea</h3><p>${e(lesson.intuition)}</p><h3>Definition</h3><p class="formal">${e(lesson.formal)}</p><h3>Example</h3><p>${e(lesson.example)}</p><h3>Why it works</h3><p>${e(lesson.proof)}</p><h3>A counterexample</h3><p>${e(lesson.counterexample)}</p><h3>What comes next</h3><p>${e(lesson.next)}</p><div class="row">${button("Practice this →", "practice-concept", "primary", `data-concept="${e(selected)}"`)}</div><details class="lesson-sources"><summary>Sources</summary><div id="lesson-sources" aria-live="polite">Finding related reading…</div></details>`
        : `<div class="empty"><h2>Lesson coming later</h2><p>You can view its prerequisites and add it as a goal. A full lesson is not available yet.</p><p>${e(node.outcome)}</p><h3>Prerequisites</h3><p>${node.prerequisites.map((id) => e(title(id))).join(" · ") || "No prerequisites mapped"}</p>${button("Show prerequisites →", "goal-concept", "primary", `data-concept="${e(selected)}"`)}</div>`
    }</article><aside class="card chat-panel"><div class="row between"><h2>Ask a question</h2></div><p>Ask about the lesson or explain where you got stuck.</p><div id="chat-log" class="chat-log"><div class="message">${lesson ? "What would you like to understand?" : "This topic has no full lesson yet. You can ask a preliminary question."}</div></div><label for="chat-message">Your question</label><textarea id="chat-message" placeholder="I think the slope depends on…" maxlength="6000"></textarea><div class="row">${button("Send", "chat", "primary")}${button("Use microphone", "voice", "ghost")}${button("Read last reply", "speak", "text-btn")}</div><p class="chat-mode" id="chat-mode">${state.provider_configured ? "AI tutor · check important steps" : "Basic hints · connect AI in Settings"}</p><details><summary>Voice and privacy</summary><p class="footnote">Dictation may use your browser’s speech service. Edit the transcript before sending. Conversations are ${state.profile.retain_conversations ? "saved privately" : "not saved"}.</p></details></aside></div>`;
  if (lesson)
    mountScene(
      document.querySelector("#visual-scene"),
      lesson.visual,
      lesson.storyboard,
    );
  document.querySelector("#lesson-select").onchange = (ev) =>
    openLesson(ev.target.value);
  if (lesson) void loadLessonSources(selected);
}
function practiceView(main) {
  const supported = nodes().filter((n) =>
    [
      "fractions",
      "algebra",
      "functions",
      "derivatives",
      "vectors",
      "linear-maps",
      "eigenvalues",
      "probability",
      "ode-growth",
      "logic",
      "sequences",
    ].includes(n.id),
  );
  main.innerHTML =
    intro(
      "",
      "Practice",
      "Choose a concept and try a question. There’s no timer.",
    ) +
    `<div class="grid two"><article class="card"><div class="grid two"><div><label for="practice-concept">Concept</label><select id="practice-concept">${supported.map((n) => `<option value="${e(n.id)}" ${n.id === selected ? "selected" : ""}>${e(n.title)}</option>`).join("")}</select></div><div><label for="dimension">Task type</label><select id="dimension"><option value="intuition">Concept check</option><option value="proof">Explain & justify</option></select></div></div><div class="row space-top">${button("New question", "new-task", "primary")}</div><div id="task-area">${task ? taskMarkup() : `<p class="footnote">Choose “New question” to begin.</p>`}</div></article><aside class="card practice-help"><h2>How it works</h2><ol><li>Choose a concept.</li><li>Answer without help, or mark that you used help.</li><li>Check the explanation and try another question.</li></ol><p class="small">Written proofs are saved for review. They are not graded automatically.</p></aside></div>`;
}
function taskMarkup() {
  return `<hr><div class="eyebrow">Question · ${task.kind === "proof" ? "Proof review" : "Independent attempt"}</div><h2>${e(task.prompt)}</h2>${task.kind === "choice" ? `<div class="choices">${task.choices.map((c) => button(e(c), "choose", "choice" + (answerValue === c ? " selected" : ""), `data-choice="${e(c)}" ${lastResult ? "disabled" : ""}`)).join("")}</div>` : `<label for="proof-answer">Your explanation</label><textarea id="proof-answer" maxlength="12000" placeholder="My claim is… The assumptions are…">${e(answerValue)}</textarea><details><summary>Show the review rubric</summary><ul>${task.rubric.map((r) => `<li>${e(r)}</li>`).join("")}</ul></details>`}<div class="checkline"><input id="assisted" type="checkbox"><label for="assisted">I used help with this answer.</label></div>${lastResult ? `<div class="result ${lastResult.correct === false ? "wrong" : ""}"><strong>${lastResult.correct === null ? "Saved for proof review" : lastResult.correct ? "Correct." : "Try another approach."}</strong><br>${e(lastResult.reason)}</div>` : button("Check answer", "submit-answer", "primary")}<p class="footnote">Your submitted answers are saved in Progress.</p>`;
}
async function newTask() {
  selected = document.querySelector("#practice-concept").value;
  task = await api(
    "/problem?" +
      new URLSearchParams({
        concept: selected,
        dimension: document.querySelector("#dimension").value,
      }),
  );
  answerValue = "";
  lastResult = null;
  document.querySelector("#task-area").innerHTML = taskMarkup();
  wire();
}
function profileView(main) {
  const entries = Object.entries(state.profile.skills || {});
  main.innerHTML = intro("", "Progress", "Your practice history and topics to revisit.") +
    `<div class="card">${entries.length ? entries.map(([id, dimensions]) => {
      const checks = dimensions.intuition;
      const total = Object.values(dimensions).reduce((sum, value) => sum + value.observations, 0);
      return `<div class="progress-entry"><div><h3>${e(title(id))}</h3><p>${total} recorded ${total === 1 ? "attempt" : "attempts"}${checks ? ` · ${checks.assisted} with help` : ""}</p></div><div class="row">${button("Review lesson", "open-lesson", "ghost", `data-concept="${e(id)}"`)}${button("Practice", "practice-concept", "", `data-concept="${e(id)}"`)}</div></div>`;
    }).join("") : `<div class="empty"><h2>No practice recorded yet.</h2><p>Answer a question to start tracking your progress.</p>${button("Start practice", "page", "primary", 'data-page="practice"')}</div>`}</div><div class="section-head"><h2>Revisit</h2></div><div class="card">${Object.entries(state.profile.reviews || {}).map(([id, date]) => `<div class="progress-entry"><div><h3>${e(title(id))}</h3><p>${new Date(date * 1000).toLocaleDateString(undefined, {month:"short",day:"numeric"})}</p></div>${button("Practice again", "practice-concept", "", `data-concept="${e(id)}"`)}</div>`).join("") || "<p>Suggestions appear after you practice.</p>"}</div><p class="footnote">Practice records describe the questions you’ve tried; they do not certify mastery.</p>`;
}
function settingsView(main) {
  const host = state.host || {};
  if (host.settings_path) { location.replace(host.settings_path); return; }
  main.innerHTML = intro("", "Settings", "Manage your data and AI connection.") +
    `<div class="card settings-card"><h2>Privacy</h2><div class="checkline"><input type="checkbox" id="retain" ${state.profile.retain_conversations ? "checked" : ""}><label for="retain">Save conversations privately.</label></div><div class="checkline"><input type="checkbox" id="consent" ${state.profile.research_consent ? "checked" : ""}><label for="consent">Use practice records to help evaluate lessons.</label></div>${button("Save preferences", "preferences", "primary")}<hr><h2>AI</h2><p>${state.provider_configured ? e(state.provider_model) : "No model connected"}</p><div class="row">${button("OpenRouter", "backend-cloud", state.provider_backend === "openrouter" ? "primary" : "ghost")}${button("Local machine", "backend-local", state.provider_backend === "local" ? "primary" : "ghost")}</div><label for="local-model">Local model</label><input id="local-model" value="${e(state.local_ai_model)}" placeholder="Auto-detect"><label for="provider-key">OpenRouter key</label><input type="password" id="provider-key" autocomplete="off"><label for="provider-model">Model</label><input id="provider-model" value="${e(state.provider_model)}"><input type="checkbox" id="provider-share" hidden>${button("Save connection", "provider-save", "primary")}<hr><h2>Your data</h2><a href="${e(apiRoot)}/export" download>Export data</a>${button("Delete learning data", "delete-profile", "text-btn danger")}</div>`;
}
async function loadLessonSources(concept) {
  try {
    const data = await api("/sources?" + new URLSearchParams({concept}));
    if (page !== "studio" || selected !== concept) return;
    const panel = document.querySelector("#lesson-sources");
    if (!panel) return;
    panel.innerHTML = data.reading.length ? data.reading.map((source) => `<article class="source"><h3>${e(source.title)}</h3><details><summary>Read excerpt</summary><p>${e(source.text)}</p><small>Automatically extracted; check the original for notation.</small></details></article>`).join("") : "<p>No readable excerpts found for this lesson.</p>";
    if (data.references.length) panel.innerHTML += `<p class="small">References: ${data.references.map((source) => `<a href="${e(safeLink(source.url))}" target="_blank" rel="noopener noreferrer">${e(source.title)}</a>`).join(" · ")}</p>`;
    if (data.unavailable) panel.innerHTML += "<p class='small'>Saved reading is temporarily unavailable. You can continue the lesson.</p>";
  } catch {
    if (page === "studio" && selected === concept) {
      const panel = document.querySelector("#lesson-sources");
      if (panel) panel.textContent = "Reading is temporarily unavailable. You can continue the lesson.";
    }
  }
}
async function sendChat() {
  if (busy) return;
  const box = document.querySelector("#chat-message"),
    message = box.value.trim();
  if (!message) return;
  busy = true;
  const log = document.querySelector("#chat-log");
  const append = (text, role) => {
    const n = document.createElement("div");
    n.className = "message " + role;
    n.textContent = text;
    log.append(n);
    log.scrollTop = log.scrollHeight;
  };
  append(message, "user");
  box.value = "";
  document.querySelector('[data-action="chat"]').disabled = true;
  try {
    const response = await api("/chat", {
      method: "POST",
      body: JSON.stringify({
        concept: selected,
        message,
        turns: chatTurns.slice(-8),
      }),
    });
    append(response.text, "assistant");
    if (response.references?.length) {
      const refs = document.createElement("p");
      refs.className = "footnote";
      refs.append("Sources: ");
      for (const reference of response.references) {
        const link = document.createElement("a");
        link.textContent = reference.title;
        link.href = "#sources";
        link.onclick = (event) => { event.preventDefault(); document.querySelector(".lesson-sources")?.setAttribute("open", ""); document.querySelector(".lesson-sources")?.scrollIntoView({block:"nearest"}); };
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        refs.append(link, " · ");
      }
      log.append(refs);
    }
    chatTurns.push(
      { role: "user", content: message },
      { role: "assistant", content: response.text },
    );
    chatTurns = chatTurns.slice(-8);
    const modeLabel = document.querySelector("#chat-mode");
    if (modeLabel) modeLabel.textContent =
      (response.mode === "model" ? "AI tutor" : "Local guide") +
      (response.mode === "model" ? " · check important steps" : " · connect AI in Settings");
  } finally {
    busy = false;
    const sendButton = document.querySelector('[data-action="chat"]');
    if (sendButton) sendButton.disabled = false;
  }
}
function voice() {
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    notify(
      "Voice dictation is not available in this browser. You can type or use your operating system’s dictation.",
    );
    return;
  }
  if (
    !confirm(
      "Your browser may send audio to its speech service. Start dictation?",
    )
  )
    return;
  const r = new Recognition();
  r.lang = navigator.language || "en-US";
  r.interimResults = false;
  r.onresult = (event) => {
    document.querySelector("#chat-message").value +=
      (document.querySelector("#chat-message").value ? " " : "") +
      event.results[0][0].transcript;
    notify("Transcript ready. Review it before sending.");
  };
  r.onerror = () =>
    notify(
      "Dictation stopped. Check microphone permissions or type your thought.",
    );
  r.start();
  notify("Listening…");
}
function wire() {
  document.querySelectorAll("[data-action]").forEach((b) => {
    b.onclick = async (ev) => {
      try {
        const a = b.dataset.action;
        if (a === "page") {
          page = b.dataset.page;
          history.replaceState(null, "", "#" + page);
          render();
          window.scrollTo(0, 0);
        } else if (a === "logout") {
          await api("/auth/logout", { method: "POST" });
          state = null;
          chatTurns = [];
          loginView();
        } else if (a === "open-lesson") openLesson(b.dataset.concept);
        else if (a === "build-path") await buildPath();
        else if (a === "new-task") await newTask();
        else if (a === "practice-concept") {
          selected = b.dataset.concept;
          if (
            ![
              "fractions",
              "algebra",
              "functions",
              "derivatives",
              "vectors",
              "linear-maps",
              "eigenvalues",
              "probability",
              "ode-growth",
              "logic",
              "sequences",
            ].includes(selected)
          ) {
            notify(
              "Practice for this topic is not available yet. Try a logic question.",
            );
            selected = "logic";
          }
          page = "practice";
          task = null;
          render();
          await newTask();
        } else if (a === "goal-concept") {
          state.profile.goal = b.dataset.concept;
          page = "curriculum";
          render();
        } else if (a === "choose") {
          answerValue = b.dataset.choice;
          document
            .querySelectorAll(".choice")
            .forEach((n) => n.classList.toggle("selected", n === b));
        } else if (a === "submit-answer") {
          const value =
            task.kind === "proof"
              ? document.querySelector("#proof-answer").value
              : answerValue;
          if (!value) {
            notify("Choose an answer or write an explanation first.");
            return;
          }
          lastResult = await api("/answer", {
            method: "POST",
            body: JSON.stringify({
              id: task.id,
              answer: value,
              assisted: document.querySelector("#assisted").checked,
            }),
          });
          answerValue = value;
          await refresh();
          document.querySelector("#task-area").innerHTML = taskMarkup();
          wire();
        } else if (a === "chat") await sendChat();
        else if (a === "voice") voice();
        else if (a === "speak") {
          const reply = chatTurns
            .filter((t) => t.role === "assistant")
            .at(-1)?.content;
          if (reply && window.speechSynthesis) {
            speechSynthesis.cancel();
            speechSynthesis.speak(new SpeechSynthesisUtterance(reply));
          } else notify("Send a thought first to get a reply.");
        } else if (a === "preferences") {
          await api("/profile", {
            method: "POST",
            body: JSON.stringify({
              goal: state.profile.goal || "ode-growth",
              strategy: state.profile.strategy || "connected",
              retain_conversations: document.querySelector("#retain").checked,
              research_consent: document.querySelector("#consent").checked,
            }),
          });
          await refresh();
          notify("Your preferences are saved.");
        } else if (a === "password-change") {
          await api("/auth/password", {
            method: "POST",
            body: JSON.stringify({
              current: document.querySelector("#current-password").value,
              new: document.querySelector("#new-password").value,
            }),
          });
          state = null;
          chatTurns = [];
          loginView();
          notify("Password changed. Sign in with your new password.");
        } else if (a === "backend-cloud" || a === "backend-local") {
          b.disabled = true;
          await api("/provider/backend", {
            method: "POST",
            body: JSON.stringify({
              backend: a === "backend-local" ? "local" : "openrouter",
              model: document.querySelector("#local-model").value.trim(),
            }),
          });
          await refresh();
          render();
          notify("AI backend selected.");
        } else if (a === "provider-save") {
          b.disabled = true;
          const savedProvider = await api("/provider", {
            method: "POST",
            body: JSON.stringify({
              key: document.querySelector("#provider-key").value,
              model: document.querySelector("#provider-model").value.trim(),
              share_with_library:
                document.querySelector("#provider-share").checked,
            }),
          });
          document.querySelector("#provider-key").value = "";
          await refresh();
          render();
          notify(
            savedProvider.library_sync
              ? "OpenRouter saved; " +
                  savedProvider.library_sync.updated +
                  " connected workspaces updated" +
                  (savedProvider.library_sync.failed
                    ? "; some connections need attention."
                    : ".")
              : "OpenRouter key verified and saved privately.",
          );
        } else if (a === "provider-remove") {
          const savedProvider = await api("/provider", { method: "DELETE" });
          await refresh();
          render();
          notify("Saved provider key removed.");
        } else if (a === "delete-profile") {
          if (b.dataset.confirm !== "yes") {
            b.dataset.confirm = "yes";
            b.textContent = "Confirm deletion";
            return;
          }
          await api("/profile", { method: "DELETE" });
          chatTurns = [];
          task = null;
          answerValue = "";
          lastResult = null;
          await refresh();
          render();
          notify("Your learning data has been deleted.");
        } else if (a === "refresh") {
          await refresh();
          render();
        }
      } catch (err) {
        notify(err.message);
        b.disabled = false;
      }
    };
  });
  document.querySelectorAll("a[data-page]").forEach(
    (a) =>
      (a.onclick = (ev) => {
        ev.preventDefault();
        page = a.dataset.page;
        render();
      }),
  );
}
async function openWorkspace() {
  try {
    const s = await api("/auth/session");
    csrf = s.csrf;
    await refresh();
    state.username = s.username;
    const fontPath = hostSignInTarget(state.host?.font_url, location.origin);
    if (fontPath && !fontLoaded) {
      try { const font = new FontFace("Workspace", `url(${JSON.stringify(fontPath)})`, {weight: "300 700"}); document.fonts.add(await font.load()); fontLoaded = true; } catch { /* Use the local sans-serif fallback. */ }
    }
    const hash = location.hash.slice(1);
    if (hash.startsWith("lesson=") && nodes().some((n) => n.id === decodeURIComponent(hash.slice(7)))) {
      selected = decodeURIComponent(hash.slice(7)); page = "studio";
    } else if (["research", "library"].includes(page)) page = "home";
    render();
  } catch {
    loginView();
  }
}
window.addEventListener("pagehide", () => app.replaceChildren());
window.addEventListener("pageshow", (event) => {
  if (event.persisted) void openWorkspace();
});
await openWorkspace();
