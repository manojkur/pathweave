import { mountScene, heroGraphic } from "./visuals.js";
const app = document.querySelector("#app");
const base = location.pathname.replace(/\/(login)?$/, "");
const apiRoot = base + "/api";
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
  app.innerHTML = `<div class="login-wrap"><section class="login-story"><div class="brand">${mark}Pathweave</div><div class="eyebrow">A connected way to learn</div><h1>Build understanding.<br>One connection<br>at a time.</h1><p>A place to explore ideas, find your next step, and make room for the questions that lead somewhere new.</p><div id="login-art" class="hero-art"></div></section><main id="main" class="login-panel"><form class="login-form" id="login-form"><div class="eyebrow">Your learning workspace</div><h2>Welcome back.</h2><p>Sign in to continue your path.</p><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="100"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button class="primary" type="submit">Sign in <span aria-hidden="true">→</span></button><div class="login-error" role="alert">${e(error)}</div><p class="footnote">This workspace is currently open to its owner. Pathweave’s code and research methods are public.</p><a class="small" href="https://github.com/manojkur/pathweave" target="_blank" rel="noopener">Explore the open project ↗</a></form></main></div>`;
  document.querySelector("#login-art").append(heroGraphic());
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
  ["home", "⌂", "Overview"],
  ["curriculum", "⌘", "Learning paths"],
  ["studio", "◇", "Idea studio"],
  ["practice", "✓", "Self-assessment"],
  ["research", "◌", "Research lab"],
  ["library", "▤", "Source library"],
  ["profile", "◎", "Your profile"],
];
function render() {
  if (!state) return;
  app.innerHTML = `<div class="shell"><aside class="sidebar"><a href="#home" class="brand" data-page="home">${mark}Pathweave</a><div class="tagline">Follow the connections</div><nav class="nav" aria-label="Main navigation">${menu.map(([id, icon, label]) => button(`<span class="navicon" aria-hidden="true">${icon}</span>${label}`, "page", id === page ? "active" : "", `data-page="${id}" ${id === page ? 'aria-current="page"' : ""}`)).join("")}</nav><div class="domain-pill"><span class="dot"></span>Mathematics · first domain</div><div class="side-bottom"><p>A little curiosity.<br>A clearer picture.</p>${state.links.host ? `<p><a href="${e(safeLink(state.links.host))}">← Your research labs</a></p>` : ""}<a href="https://github.com/manojkur/pathweave" target="_blank" rel="noopener">Open research project ↗</a></div></aside><div class="workspace"><header class="topbar"><span class="breadcrumb">Your workspace <span aria-hidden="true">/</span> ${e(menu.find((m) => m[0] === page)?.[2])}</span><div class="account">${badge("Research preview", "green")}<span class="avatar">${e((state.username || "You").slice(0, 1).toUpperCase())}</span>${button("Sign out", "logout", "text-btn")}</div></header><main id="main" class="main" tabindex="-1"></main></div></div>`;
  const main = document.querySelector("#main");
  (
    ({
      home: homeView,
      curriculum: curriculumView,
      studio: studioView,
      practice: practiceView,
      research: researchView,
      library: libraryView,
      profile: profileView,
    })[page] || homeView
  )(main);
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
  return `<div class="eyebrow">${kicker}</div><h1>${heading}</h1><p class="intro">${description}</p>`;
}
function homeView(main) {
  const skillCount = Object.keys(state.profile.skills || {}).length;
  main.innerHTML =
    intro(
      "There’s room to begin again",
      "A small step.<br>A wider understanding.",
      "You don’t need to know everything before you begin. Start with what makes sense, explore what doesn’t, and let the connections grow.",
    ) +
    `<div class="hero-card"><div class="hero-copy"><div class="eyebrow">Explore an idea</div><h2>How does a local rule<br>become a whole curve?</h2><p>Meet differential equations through motion, a picture, and one small step at a time.</p>${button("Open the idea studio &nbsp; →", "open-lesson", "primary", 'data-concept="ode-growth"')}</div><div class="hero-art" id="hero-art"></div></div><div class="section-head"><h2>Make this path yours</h2>${badge("No timer. No pressure.")}</div><div class="grid three"><article class="card"><div class="stepnum">1</div><h3>Find your starting point</h3><p>A few small tasks help distinguish what feels familiar from what you can use independently.</p>${button("Try a self-assessment →", "page", "text-btn", 'data-page="practice"')}</article><article class="card"><div class="stepnum">2</div><h3>Choose a direction</h3><p>Explore connections from foundational ideas to proof, abstraction, and research reading.</p>${button("Explore learning paths →", "page", "text-btn", 'data-page="curriculum"')}</article><article class="card"><div class="stepnum">3</div><h3>Build a clearer picture</h3><p>Move between visual intuition, precise definitions, and arguments you can justify.</p>${button("Meet your learner profile →", "page", "text-btn", 'data-page="profile"')}</article></div><div class="section-head"><h2>A living research project</h2>${button("Inside the lab →", "page", "text-btn", 'data-page="research"')}</div><div class="grid two"><article class="card"><div class="line-item"><span class="dot"></span><div><h3>Connected ideas, honest boundaries</h3><p>${nodes().length} mapped concepts · ${Object.keys(state.catalog.lessons).length} original pilot lessons · ${skillCount} concepts with personal evidence.</p></div></div><p class="footnote">The map is a direction for the project. Advanced and frontier nodes are reading goals; they are not completed courses.</p></article><article class="card"><div class="eyebrow">A principle we’re testing</div><h3>Understanding should outlast the help.</h3><p>We track assisted work separately and make space for later retrieval, transfer, and proof review.</p>${badge("Evidence-informed, still experimental")}</article></div>`;
  document.querySelector("#hero-art").append(heroGraphic());
}
function curriculumView(main) {
  main.innerHTML =
    intro(
      "Many ways into an idea",
      "Choose where you want to go.",
      "A course sequence is one route through a much larger network. Solid lines show chosen prerequisites for this prototype; other connections invite a preview.",
    ) +
    `<div class="card"><div class="grid two"><div><label for="goal">What would you like to understand?</label><select id="goal">${nodes()
      .map(
        (n) =>
          `<option value="${e(n.id)}" ${(state.profile.goal || "ode-growth") === n.id ? "selected" : ""}>${e(n.title)}</option>`,
      )
      .join(
        "",
      )}</select></div><div><label for="strategy">Path emphasis</label><select id="strategy"><option value="connected">Connected foundations</option><option value="proof-first" ${state.profile.strategy === "proof-first" ? "selected" : ""}>Proof foundations first</option></select></div></div><p class="footnote">These are candidate dependency paths. This version changes the order of prerequisite branches; it has not established an optimal human learning sequence.</p>${button("Build my path →", "build-path", "primary")}</div><div id="path-list" class="path-list"></div><div class="section-head"><h2>The wider map</h2>${badge("Select a concept to explore")}</div><div id="map" class="map-wrap"></div><p class="footnote">Conceptual previews and analogies do not imply formal prerequisites. The frontier requires paper-specific mapping, expert review, and up-to-date sources.</p>`;
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
        `<div class="path-node"><span class="circle">${i + 1}</span><div><h3>${e(n.title)}</h3><p>${e(n.outcome)}</p></div>${badge(n.status === "pilot" ? "Pilot lesson" : n.status === "frontier-map" ? "Research goal" : "Mapped goal", n.status === "pilot" ? "green" : "")} ${button(n.status === "pilot" ? "Explore →" : "Preview →", "open-lesson", "", `data-concept="${e(n.id)}"`)}</div>`,
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
      path.setAttribute("stroke", "#cbd9c9");
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
      fill: n.status === "pilot" ? "#eef4e8" : "#fafbf7",
      stroke: "#cddbc9",
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
  chatTurns = [];
  render();
  window.scrollTo(0, 0);
}
function studioView(main) {
  const lesson = state.catalog.lessons[selected],
    node = nodes().find((n) => n.id === selected);
  main.innerHTML =
    intro(
      "Explore · explain · justify",
      e(node.title),
      e(lesson?.question || node.outcome),
    ) +
    `<div class="row space-bottom"><label class="small" for="lesson-select">Explore another idea</label><select id="lesson-select">${nodes()
      .map(
        (n) =>
          `<option value="${e(n.id)}" ${n.id === selected ? "selected" : ""}>${e(n.title)}${n.status === "pilot" ? "" : " · mapped goal"}</option>`,
      )
      .join(
        "",
      )}</select></div><div class="studio"><article class="card lesson">${
      lesson
        ? `<div id="visual-scene"></div><h3>A picture to begin with</h3><p>${e(lesson.intuition)}</p><h3>Make the idea precise</h3><p class="formal">${e(lesson.formal)}</p><h3>Work through one example</h3><p>${e(lesson.example)}</p><h3>Why the argument works</h3><p>${e(lesson.proof)}</p><h3>Where intuition needs care</h3><p>${e(lesson.counterexample)}</p><h3>A connection to carry forward</h3><p>${e(lesson.next)}</p><div class="row">${button("Try this idea independently →", "practice-concept", "primary", `data-concept="${e(selected)}"`)}${badge("Original pilot lesson", "green")}</div><p class="footnote">Reference trail: ${lesson.sources
            .map((id) => {
              const source = state.sources.find((s) => s.id === id);
              return source
                ? `<a href="${e(safeLink(source.url))}" target="_blank" rel="noopener">${e(source.title)}</a>`
                : "";
            })
            .join(
              " · ",
            )}. These lessons are original; source books are not reproduced here.</p>`
        : `<div class="empty"><h2>A direction to build toward</h2><p>This concept is mapped, but its course material and assessment are not yet authored or validated.</p><p>${e(node.outcome)}</p><h3>Chosen prerequisites</h3><p>${node.prerequisites.map((id) => e(title(id))).join(" · ") || "No prerequisites mapped"}</p>${button("Build a path to this idea →", "goal-concept", "primary", `data-concept="${e(selected)}"`)}</div>`
    }</article><aside class="card chat-panel"><div class="row between"><h2>Think it through</h2>${badge("One step at a time", "green")}</div><p>Describe what you see, ask a question, or talk through your next step.</p><div id="chat-log" class="chat-log"><div class="message">${lesson ? "Which part of this idea would you like to explore? We can begin with the picture or a single example." : "This is a mapped learning goal. We can explore a preliminary question, but there is no reviewed lesson here yet."}</div></div><label for="chat-message">Your thought or question</label><textarea id="chat-message" placeholder="I think the slope depends on…" maxlength="6000"></textarea><div class="row">${button("Send thought →", "chat", "primary")}${button("Use microphone", "voice", "ghost")}${button("Read last reply", "speak", "text-btn")}</div><p class="chat-mode" id="chat-mode">${state.provider_configured ? "AI tutor connected · replies can contain mistakes" : "Local guide · a model provider is not configured"}</p><p class="footnote">Voice dictation depends on your browser and may use its speech service. You can edit the transcript before sending. Conversations are ${state.profile.retain_conversations ? "retained privately by your choice" : "not retained after this session"}.</p></aside></div>`;
  if (lesson)
    mountScene(
      document.querySelector("#visual-scene"),
      lesson.visual,
      lesson.storyboard,
    );
  document.querySelector("#lesson-select").onchange = (ev) =>
    openLesson(ev.target.value);
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
      "A starting point, not a verdict",
      "What feels clear?",
      "Try an idea without a timer. An answer is one piece of evidence; it doesn’t define your ability or certify mastery.",
    ) +
    `<div class="grid two"><article class="card"><div class="grid two"><div><label for="practice-concept">Concept</label><select id="practice-concept">${supported.map((n) => `<option value="${e(n.id)}" ${n.id === selected ? "selected" : ""}>${e(n.title)}</option>`).join("")}</select></div><div><label for="dimension">Task type</label><select id="dimension"><option value="intuition">Concept check</option><option value="proof">Explain & justify</option></select></div></div><div class="row space-top">${button("Find a small task →", "new-task", "primary")}</div><div id="task-area">${task ? taskMarkup() : `<p class="footnote">Start with something familiar, or choose a concept you’re curious about. Proof submissions wait for review and do not automatically increase a score.</p>`}</div></article><aside class="card"><div class="eyebrow">Understanding has several parts</div><h2>More than getting it right.</h2><div class="line-item"><span class="stepnum">↔</span><div><h3>Represent it</h3><p>Connect a picture, an equation, and a verbal explanation.</p></div></div><div class="line-item"><span class="stepnum">∴</span><div><h3>Justify it</h3><p>State assumptions and explain why the reasoning covers the claim.</p></div></div><div class="line-item"><span class="stepnum">↗</span><div><h3>Use it somewhere new</h3><p>Return later to an unfamiliar problem with help removed.</p></div></div><p class="footnote">The initial automated task bank checks narrow concept questions. It is not yet a validated multidimensional diagnostic. Other dimensions remain unknown until suitable evidence is collected.</p></aside></div>`;
}
function taskMarkup() {
  return `<hr><div class="eyebrow">A small task · ${task.kind === "proof" ? "Proof review" : "Independent attempt"}</div><h2>${e(task.prompt)}</h2>${task.kind === "choice" ? `<div class="choices">${task.choices.map((c) => button(e(c), "choose", "choice" + (answerValue === c ? " selected" : ""), `data-choice="${e(c)}" ${lastResult ? "disabled" : ""}`)).join("")}</div>` : `<label for="proof-answer">Your explanation</label><textarea id="proof-answer" maxlength="12000" placeholder="My claim is… The assumptions are…">${e(answerValue)}</textarea><details><summary>Show the review rubric</summary><ul>${task.rubric.map((r) => `<li>${e(r)}</li>`).join("")}</ul></details>`}<div class="checkline"><input id="assisted" type="checkbox"><label for="assisted">I used help on this attempt. Keep that distinction in my evidence.</label></div>${lastResult ? `<div class="result ${lastResult.correct === false ? "wrong" : ""}"><strong>${lastResult.correct === null ? "Saved for proof review" : lastResult.correct ? "That fits the rule." : "Let’s examine the rule."}</strong><br>${e(lastResult.reason)}</div>` : button("Record my attempt", "submit-answer", "primary")}<p class="footnote">Want a break? Your recorded progress is saved. You can return whenever you’re ready.</p>`;
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
  const skillKeys = Object.keys(state.profile.skills || {}),
    all = state.profile.skills || {};
  main.innerHTML =
    intro(
      "Your understanding is still unfolding",
      "A profile, not a label.",
      "Keep track of what you’ve demonstrated, where help was involved, and which questions are still open.",
    ) +
    `<div class="grid two"><article class="card"><div class="eyebrow">Evidence collected</div><h2>${skillKeys.length} concepts explored</h2>${
      skillKeys.length
        ? skillKeys
            .map(
              (key) =>
                `<h3>${e(title(key))}</h3>${[
                  "intuition",
                  "representation",
                  "formal",
                  "proof",
                  "transfer",
                ]
                  .map((dim) => {
                    const v = all[key][dim];
                    return `<div class="profile-row"><span>${e(dim === "intuition" ? "Concept checks" : dim)}</span><div class="meter"><span data-score="${v ? Math.round(v.mean * 100) : 0}"></span></div><span>${v ? Math.round(v.mean * 100) + "%" : "—"}</span></div>${v ? `<small>${v.observations} observations · ${v.assisted} assisted · approximate interval ${v.interval.map((x) => Math.round(x * 100) + "%").join("–")}</small>` : ""}`;
                  })
                  .join("")}<hr>`,
            )
            .join("")
        : `<div class="empty">Your evidence profile begins with a small task. Unobserved dimensions remain unknown.</div>${button("Try a self-assessment →", "page", "primary", 'data-page="practice"')}`
    }<p class="footnote">These are prototype Bayesian evidence estimates. The approximate intervals are not a validated measure of mathematical ability. Multiple-choice recognition is narrower than independent problem solving.</p></article><aside class="card"><div class="eyebrow">You choose what’s retained</div><h2>Your data, your boundaries.</h2><div class="checkline"><input type="checkbox" id="retain" ${state.profile.retain_conversations ? "checked" : ""}><label for="retain">Retain my tutor conversations privately for later review.</label></div><div class="checkline"><input type="checkbox" id="consent" ${state.profile.research_consent ? "checked" : ""}><label for="consent">Allow private learning-observation records for research analysis. Nothing is published automatically.</label></div>${button("Save preferences", "preferences", "primary")}<hr><h3>AI connection</h3><p class="small">Selected backend: <strong>${state.provider_backend === "local" ? "Local AI machine" : "OpenRouter"}</strong>. This choice is shared by the tutor and background AI roles.</p><div class="row">${button("Use OpenRouter", "backend-cloud", state.provider_backend === "openrouter" ? "primary" : "ghost")}${button("Use local machine", "backend-local", state.provider_backend === "local" ? "primary" : "ghost")}</div><label for="local-model">Local served model identifier</label><input id="local-model" value="${e(state.local_ai_model)}" placeholder="Auto-detect when connected"><p class="footnote">The local machine can be selected after it reconnects through your private server connection. A failed connection check keeps the current backend selected.</p><p class="small">Configure OpenRouter privately. Your key is sent only to this server and OpenRouter, saved with restricted file permissions, and never returned to the browser.</p><p class="small">${state.provider_configured ? "Configured: " + e(state.provider_model) : "No model provider configured"}</p><label for="provider-key">OpenRouter API key</label><input type="password" id="provider-key" autocomplete="off" placeholder="Enter a key to configure or replace it"><label for="provider-model">Model identifier</label><input id="provider-model" value="${e(state.provider_model || "openai/gpt-4.1-mini")}" placeholder="provider/model-name"><p class="small"><a href="https://openrouter.ai/models" target="_blank" rel="noopener">Browse current model identifiers ↗</a></p><div class="checkline"><input type="checkbox" id="provider-share"><label for="provider-share">Also configure this key and model in my connected knowledge workspaces. Their existing unrelated provider keys stay separate.</label></div><div class="row">${button("Connect OpenRouter", "provider-save", "primary")}${button("Remove key here", "provider-remove", "text-btn")}</div><p class="footnote">Default server limits: 40 calls and $2 of reserved cost per UTC day, at most $0.05 per call. A separate provider-side key limit can further cap spending. The tutor and background roles share this budget.</p><hr><h3>Review and control</h3><p>Conversation history is separate from the current teaching release. The tutor uses that release, your current concept evidence, and the last few turns in this session.</p><div class="row"><a class="small" href="${e(apiRoot)}/export" download>Export my learning data</a>${button("Delete my learning data", "delete-profile", "text-btn danger")}</div><p class="footnote">Deletion removes learning evidence, attempts, proofs, and retained conversations from this workspace. Separate library records and operational backups have their own retention.</p><hr><h3>Account password</h3><label for="current-password">Current password</label><input type="password" id="current-password" autocomplete="current-password"><label for="new-password">New password · at least 16 characters</label><input type="password" id="new-password" autocomplete="new-password" minlength="16">${button("Change password and sign out", "password-change", "ghost")}<hr><h3>Come back to an idea</h3>${
      Object.entries(state.profile.reviews || {})
        .map(
          ([id, t]) =>
            `<p class="small">${e(title(id))} · ${new Date(t * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>`,
        )
        .join("") ||
      '<p class="small">Review suggestions appear after recorded tasks.</p>'
    }</aside></div>`;
  main
    .querySelectorAll("[data-score]")
    .forEach((n) => (n.style.width = n.dataset.score + "%"));
}
function researchView(main) {
  main.innerHTML =
    intro(
      "Inside the research lab",
      "Test the path. Question the result.",
      "Background roles collect source metadata, examine learning evidence, run synthetic experiments, and propose better explanations. Candidates remain separate from the active teaching release.",
    ) +
    `<div class="grid two"><article class="card"><div class="row between"><h2>Background work</h2>${badge(state.worker_alive ? "Worker connected" : "Worker not connected", state.worker_alive ? "green" : "gold")}</div>${[
      "research",
      "analysis",
      "experimentation",
      "narrative",
    ]
      .map((role) => {
        const j = state.jobs.find((x) => x.role === role);
        return `<div class="job"><div><h3>${e(role[0].toUpperCase() + role.slice(1))}</h3><p>${j ? e(j.status) + (j.error ? " · " + e(j.error) : "") : "Waiting for first run"}${j?.heartbeat ? " · " + new Date(j.heartbeat * 1000).toLocaleTimeString() : ""}</p></div>${button("Queue run", "job", "", `data-role="${role}"`)}</div>`;
      })
      .join(
        "",
      )}<p class="footnote">The worker persists schedules and retries. Model calls share daily call and spending ceilings. Metadata discovery is not a literature review, and synthetic results do not establish human learning benefits.</p></article><article class="card"><div class="eyebrow">Active release</div><h2 class="break">${e(state.catalog.version)}</h2><p>This snapshot contains the current teaching policy, concept map, lessons, and visual storyboards. It can run from a fresh chat.</p><details><summary>Read the teaching policy</summary><p>${e(state.catalog.tutor_policy)}</p></details>${button("Refresh lab status", "refresh", "text-btn")}</article></div><div class="section-head"><h2>Curriculum experiment</h2>${badge("Synthetic learners only", "gold")}</div><div class="card">${state.experiment ? `<p>${e(state.experiment.warning)}</p><div class="chart">${state.experiment.results.map((r) => `<div class="bar-col"><span>${Math.round(r.mean * 100)}%</span><div class="bar" data-bar="${r.mean * 100}"></div><span>${e(r.strategy)}</span></div>`).join("")}</div><p class="footnote">Simulated delayed retrieval success · ${state.experiment.protocol.paired_seeds} paired seeds · identical exposure budgets · memory capacities 3–5 chunks. These assumptions must be calibrated to human data before any human curriculum claim.</p>` : '<div class="empty">The first paired-seed experiment will appear after the experimentation role runs.</div>'}</div><div class="section-head"><h2>Proposed improvements</h2>${badge("Review before promotion")}</div>${state.proposals.length ? state.proposals.map((p) => `<article class="card"><div class="row between"><h3>Visual narrative and teaching policy candidate</h3>${badge(p.status)}</div><p>${e(p.payload.rationale)}</p><p class="small">Based on release ${e(p.payload.base_version)} · ${e(p.payload.validation)}</p><details><summary>Compare candidate teaching policy and storyboard</summary><h3>Current policy</h3><p>${e(state.catalog.tutor_policy)}</p><h3>Candidate policy</h3><p>${e(p.payload.snapshot.tutor_policy)}</p><ol>${(p.payload.snapshot.lessons["ode-growth"].storyboard || []).map((x) => `<li>${e(x)}</li>`).join("")}</ol></details>${p.status === "pending" ? button("Approve this candidate release", "promote", "primary", `data-id="${e(p.id)}"`) : ""}</article>`).join("") : '<div class="empty">No candidates yet. The narrative role needs a configured model provider. Existing lessons and visuals remain usable.</div>'}<div class="section-head"><h2>New source discovery</h2>${badge("Unreviewed metadata")}</div><div class="card">${state.research_inbox.length ? state.research_inbox.map((s) => `<div class="source"><div><h3>${e(s.title)}</h3><a href="${e(safeLink(s.url))}" target="_blank" rel="noopener">Source record ↗</a><p class="small">${e(s.published?.slice(0, 10))} · ${e(s.review_status)}</p></div></div>`).join("") : "<p>No new discovery records yet. Reviewed seed source cards are in the Source library.</p>"}</div><div class="section-head"><h2>Famous problems, with context</h2></div><div class="card">${state.famous_problems.map((p) => `<div class="source"><div><h3>${e(p.title)}</h3><p>${e(p.statement)}</p>${badge(p.status)}<small>${e(p.learning_use)}</small><a href="${e(safeLink(p.url))}" target="_blank" rel="noopener">Source and status ↗</a></div></div>`).join("")}<p class="footnote">Open-problem status is dated and requires rechecking. These are context and exploration records, not graded beginner assignments.</p></div>`;
  main
    .querySelectorAll("[data-bar]")
    .forEach((n) => (n.style.height = n.dataset.bar + "%"));
}
function libraryView(main) {
  main.innerHTML =
    intro(
      "A traceable foundation",
      "Sources behind the choices.",
      "Public source cards describe what was inspected, what it supports, and where the evidence stops. Full books and papers belong in your connected private library.",
    ) +
    `<div class="card"><div class="row between"><h2>${e(state.links.library_label)}</h2>${badge(state.library_connected ? "Connected" : "Not configured", state.library_connected ? "green" : "gold")}</div><div class="row"><input id="library-query" aria-label="Search private library" placeholder="Find a book or paper in your library">${button("Search library", "library-search", "primary")}${state.links.library ? `<a class="small" href="${e(safeLink(state.links.library))}" target="_blank" rel="noopener">Open library ↗</a>` : ""}</div><div id="library-results"></div><p class="footnote">Credentials stay on the server. Saving a source creates a reference record; it does not fetch or redistribute a copyrighted file.</p></div><div class="section-head"><h2>Research and textbook register</h2><select id="source-filter" aria-label="Filter sources"><option value="all">All source cards</option><option value="research">Learning research</option><option value="textbook">Mathematics texts</option><option value="tool">Visual and verification tools</option></select></div><div class="card" id="source-list"></div>`;
  renderSources("all");
  document.querySelector("#source-filter").onchange = (ev) =>
    renderSources(ev.target.value);
}
function renderSources(kind) {
  document.querySelector("#source-list").innerHTML = state.sources
    .filter((s) => kind === "all" || s.kind === kind)
    .map(
      (s) =>
        `<article class="source"><div><h3>${e(s.title)}</h3><small>${e(s.authors)} · ${e(s.year || "living documentation")}</small>${badge(s.review_status)}${badge(s.kind)}<p>${e(s.summary)}</p><small><strong>Design implication:</strong> ${e(s.decision)}</small><small><strong>Limit:</strong> ${e(s.limitation)}</small><a href="${e(safeLink(s.url))}" target="_blank" rel="noopener">Read the original source ↗</a></div><div>${state.library_connected ? button("Save reference", "save-source", "", `data-source="${e(s.id)}"`) : ""}</div></article>`,
    )
    .join("");
  wire();
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
      refs.append("Private reading supplied: ");
      for (const reference of response.references) {
        const link = document.createElement("a");
        link.textContent = reference.title;
        link.href = reference.url;
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
    document.querySelector("#chat-mode").textContent =
      (response.mode === "model" ? "AI tutor" : "Local guide") +
      " · release " +
      response.release;
  } finally {
    busy = false;
    document.querySelector('[data-action="chat"]').disabled = false;
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
              "This lesson has proof examples but no validated automatic task family yet. Try a logic task.",
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
        } else if (a === "job") {
          await api("/jobs/" + b.dataset.role, { method: "POST" });
          notify(
            "Queued for the background worker. Refresh shortly to see the result.",
          );
        } else if (a === "promote") {
          await api("/proposals/" + b.dataset.id + "/promote", {
            method: "POST",
          });
          await refresh();
          render();
          notify("Candidate promoted. New tutor sessions use this release.");
        } else if (a === "library-search") {
          const data = await api(
            "/library?q=" +
              encodeURIComponent(
                document.querySelector("#library-query").value,
              ),
          );
          document.querySelector("#library-results").innerHTML = data.connected
            ? data.items
                .map(
                  (p) =>
                    `<div class="line-item"><a href="${e(safeLink(p.url))}" target="_blank" rel="noopener">${e(p.title)} ↗</a></div>`,
                )
                .join("") || "<p>No matching references found.</p>"
            : "<p>The private library connector is not configured yet.</p>";
        } else if (a === "save-source") {
          b.disabled = true;
          await api("/library/" + b.dataset.source, { method: "POST" });
          notify("Reference saved in your private library.");
          b.disabled = false;
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
try {
  const s = await api("/auth/session");
  csrf = s.csrf;
  await refresh();
  state.username = s.username;
  render();
} catch {
  loginView();
}
