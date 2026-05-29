const stateUrl = "/api/state";

const el = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat("en-US");
const setText = (id, value) => {
  const node = el(id);
  if (node) node.textContent = value;
};

let latest = null; // last state payload, for client-side re-renders (event filter)
let eventFilter = "all";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function relativeTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function pillClass(status) {
  const s = String(status).toLowerCase();
  if (["pass", "done", "ok"].includes(s)) return "pass";
  if (s.includes("fail")) return "fail";
  if (["required", "in-progress", "running", "queued"].includes(s)) return "required";
  if (["skip", "not-required", "not required"].includes(s)) return "muted-pill";
  return "";
}

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------- derived helpers ---------- */

function gateVerdict(gates) {
  if (!gates || !gates.length) return { label: "none", cls: "" };
  const norm = gates.map((g) => String(g.status).toLowerCase());
  if (norm.some((s) => s.includes("fail"))) return { label: "fail", cls: "fail" };
  if (norm.some((s) => ["required", "running", "in-progress"].includes(s))) return { label: "pending", cls: "required" };
  if (norm.some((s) => s === "pass")) return { label: "pass", cls: "pass" };
  return { label: "—", cls: "" };
}

const EVENT_ICONS = {
  "vulnerability-patched": "🛡",
  "slop-removed": "✂",
  "token-usage": "◔",
  "tool-use": "⚡",
  "stack-migrated": "⇄",
  note: "•",
};

/* ---------- top bar + vitals ---------- */

function renderVitals(data) {
  setText("project-name", data.project.name);
  const status = data.project.status || "unknown";
  const statusEl = el("project-status");
  statusEl.textContent = status;
  statusEl.className = `pill ${pillClass(status)}`;

  const done = data.project.phasesDone || 0;
  const total = data.project.phasesTotal || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  setText("vital-phase", total ? `${done}/${total}` : "–");
  el("vital-phase-fill").style.width = `${pct}%`;

  setText("vital-cost", data.costs.measured ? `$${data.costs.costUsd.toFixed(2)}` : "—");
  setText("vital-agents", fmt.format(data.agents.length));

  const verdict = gateVerdict(data.quality.gates);
  const vg = el("vital-gates");
  vg.textContent = verdict.label === "pass" ? "✓ pass" : verdict.label === "fail" ? "✗ fail" : verdict.label;
  vg.className = `vital-v ${verdict.cls}`;

  if (data.git.isRepo) {
    setText("vital-git", `${data.git.branch}${data.git.changed.length ? ` ·${data.git.changed.length}` : ""}`);
  } else setText("vital-git", "—");

  const a = data.activity || { total: 0, errors: 0 };
  setText("vital-tools", a.errors ? `${fmt.format(a.total)} · ${a.errors}✗` : fmt.format(a.total));

  setText("nav-task-count", data.tasks.queued ? String(data.tasks.queued) : "");
  setText("nav-git-count", data.git.isRepo && data.git.changed.length ? String(data.git.changed.length) : "");

  const path = data.targetRoot || "";
  const short = path.split("/").filter(Boolean).slice(-2).join("/");
  setText("target-path", short ? `▸ ${short}` : "");
}

/* ---------- hero: phase ---------- */

function renderPhaseHero(data) {
  const done = data.project.phasesDone || 0;
  const total = data.project.phasesTotal || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  setText("phase-pct", `${pct}%`);
  setText("phase-big", data.project.currentPhase ? `Phase ${data.project.currentPhase}` : "–");
  setText("phase-stage", data.project.currentStage || "Not planned");
  setText("next-action", data.project.nextAction || "Route the next task through A-Stack.");

  const seg = el("phase-seg");
  if (data.phases && data.phases.length) {
    seg.innerHTML = data.phases
      .map((p) => `<i class="seg-cell ${p.status}" title="P${p.phase} ${escapeHtml(p.title)} — ${p.status}"></i>`)
      .join("");
  } else seg.innerHTML = "";
}

/* ---------- hero: cost ---------- */

function renderCostHero(data) {
  const c = data.costs;
  setText("cost-amount", c.measured ? `$${c.costUsd.toFixed(2)}` : "—");
  const inOut = c.tokensIn || c.tokensOut ? `${fmt.format(c.tokensIn || 0)} → ${fmt.format(c.tokensOut || 0)}` : `${fmt.format(c.totalTokens || 0)}`;
  setText("cost-tokens", inOut);
  setText("cost-model", c.model || "—");
  setText("cost-duration", c.durationLabel || "—");
  const src = c.source || "";
  setText("cost-source", src.startsWith("session") ? "session" : src.startsWith("manual") ? "manual" : c.measured ? "measured" : "no data");
}

/* ---------- hero: gates ---------- */

function renderGatesHero(gates) {
  const verdict = gateVerdict(gates);
  const v = el("gates-verdict");
  v.textContent = verdict.label;
  v.className = `pill ${verdict.cls}`;

  const mini = el("gates-mini");
  if (!gates || !gates.length) {
    mini.innerHTML = '<div class="empty mini">No gate report yet. Run gates.</div>';
    return;
  }
  mini.innerHTML = gates
    .map((g) => {
      const extra = g.findings !== null && g.findings !== undefined ? `<small>${fmt.format(g.critical || 0)}c · ${fmt.format(g.findings || 0)}f</small>` : "";
      return `<div class="gate-row">
        <span class="gate-name">${escapeHtml(g.gate)}</span>
        ${extra}
        <span class="pill ${pillClass(g.status)}">${escapeHtml(g.status)}</span>
      </div>`;
    })
    .join("");
}

/* ---------- hero: agents + throughput ---------- */

function renderAgentsHero(data) {
  const agents = data.agents || [];
  const a = data.activity || { total: 0, errors: 0, byTool: {} };
  setText("agents-count", `${agents.length} live`);
  const list = el("agent-list");
  list.innerHTML = agents.length
    ? agents
        .map(
          (agent) => `<div class="agent"><span class="dot"></span><strong>${escapeHtml(agent.type || "agent")}</strong><small>${relativeTime(agent.startedAt)}</small></div>`,
        )
        .join("")
    : '<div class="empty mini">No subagents running right now.</div>';

  setText("tp-total", fmt.format(a.total || 0));
  const errEl = el("tp-errors");
  errEl.textContent = fmt.format(a.errors || 0);
  errEl.parentElement.classList.toggle("has-errors", (a.errors || 0) > 0);
  const top = Object.entries(a.byTool || {}).sort((x, y) => y[1] - x[1])[0];
  setText("tp-top", top ? `${top[0]}` : "—");
}

/* ---------- tool activity chart ---------- */

function renderToolChart(activity) {
  const a = activity || { total: 0, errors: 0, byTool: {} };
  const entries = Object.entries(a.byTool || {}).sort((x, y) => y[1] - x[1]);
  setText(
    "activity-summary",
    a.total ? `${fmt.format(a.total)} tool uses${a.errors ? ` · ${a.errors} errors` : ""}` : "No activity captured — set ASTACK_ACTIVITY=on",
  );
  const chart = el("toolchart");
  if (!entries.length) {
    chart.innerHTML = '<div class="empty mini">No tool-use events. Enable with <code>ASTACK_ACTIVITY=on</code>.</div>';
    return;
  }
  const max = entries[0][1] || 1;
  chart.innerHTML = entries
    .slice(0, 10)
    .map(
      ([tool, n]) => `<div class="bar-row">
        <span class="bar-label">${escapeHtml(tool)}</span>
        <span class="bar-track"><i style="width:${Math.max(4, Math.round((n / max) * 100))}%"></i></span>
        <span class="bar-val">${fmt.format(n)}</span>
      </div>`,
    )
    .join("");
}

/* ---------- roadmap ---------- */

function renderPhases(phases) {
  const track = el("phase-track");
  if (!phases || !phases.length) {
    track.innerHTML = '<div class="empty">No roadmap yet. Run <code>/route "new app: …"</code> or <code>/plan</code>.</div>';
    setText("roadmap-summary", "Not planned");
    return;
  }
  const done = phases.filter((p) => p.status === "done").length;
  setText("roadmap-summary", `${done}/${phases.length} phases done`);
  track.innerHTML = phases
    .map(
      (p) => `<div class="phase ${p.status}" title="${escapeHtml(p.title)}">
        <span class="phase-n">P${p.phase}</span>
        <span class="phase-title">${escapeHtml(p.title)}</span>
        <span class="phase-state">${p.status}</span>
      </div>`,
    )
    .join("");
}

/* ---------- tasks (kanban) ---------- */

const TASK_COLUMNS = [
  { key: "queued", label: "Queued" },
  { key: "in-progress", label: "In progress" },
  { key: "done", label: "Done" },
];

function taskCard(task) {
  const next =
    task.status === "queued"
      ? `<button type="button" data-task="${task.id}" data-status="in-progress">Start</button>`
      : task.status === "in-progress"
        ? `<button type="button" data-task="${task.id}" data-status="done">Done</button>`
        : `<button type="button" data-task="${task.id}" data-status="queued">Reopen</button>`;
  const pr = task.priority && task.priority !== "normal" ? `<span class="pill prio-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>` : "";
  return `<article class="task">
    <strong>${escapeHtml(task.title)}</strong>
    ${task.details ? `<p>${escapeHtml(task.details)}</p>` : ""}
    <div class="task-tags"><span class="pill">${escapeHtml(task.agent)}</span>${pr}</div>
    <div class="task-actions">${next}</div>
  </article>`;
}

function renderTasks(tasks) {
  setText(
    "task-stats-text",
    `${fmt.format(tasks.total)} total · ${fmt.format(tasks.queued)} queued · ${fmt.format(tasks.inProgress)} active · ${fmt.format(tasks.done)} done`,
  );
  // segmented bar
  const total = tasks.total || 1;
  el("task-seg").innerHTML = [
    ["queued", tasks.queued],
    ["in-progress", tasks.inProgress],
    ["done", tasks.done],
  ]
    .map(([k, n]) => (n ? `<i class="seg-cell ${k}" style="flex:${n}" title="${n} ${k}"></i>` : ""))
    .join("") || '<i class="seg-cell todo" style="flex:1"></i>';

  const board = el("task-board");
  if (!tasks.items.length) {
    board.innerHTML = '<div class="empty">No tasks queued. Add one from the panel →</div>';
    return;
  }
  board.innerHTML = TASK_COLUMNS.map((col) => {
    const items = tasks.items.filter((t) => t.status === col.key);
    return `<div class="task-col">
      <header>${col.label} <span class="col-count">${items.length}</span></header>
      ${items.map(taskCard).join("") || '<div class="empty mini">—</div>'}
    </div>`;
  }).join("");

  board.querySelectorAll("button[data-task]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await api(`/api/tasks/${encodeURIComponent(button.dataset.task)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: button.dataset.status }),
        });
        await load(true);
      } catch (e) {
        button.disabled = false;
      }
    });
  });
}

/* ---------- quality + memory ---------- */

function renderQuality(q) {
  setText("vulns-patched", fmt.format(q.vulnerabilitiesPatched));
  setText("slop-removed", fmt.format(q.slopRemoved));
  setText("critical-security", fmt.format(q.criticalSecurity));
  setText("security-findings", fmt.format(q.securityFindings));
  el("critical-security").parentElement.classList.toggle("alert", (q.criticalSecurity || 0) > 0);
}

function renderMemory(memory) {
  setText("memory-files", fmt.format(memory.markdownFiles));
  setText("trajectories", fmt.format(memory.trajectories));
  setText("patterns", fmt.format(memory.patterns));
  setText("promoted-patterns", fmt.format(memory.promotedPatterns));
  const list = el("memory-files-list");
  const files = (memory.files || []).slice(0, 12);
  list.innerHTML = files.length
    ? files.map((f) => `<span class="chip" title="${escapeHtml(f)}">${escapeHtml(f.split("/").pop())}</span>`).join("")
    : "";
}

/* ---------- git ---------- */

function changedClass(code) {
  const c = code.trim().charAt(0);
  if (c === "A" || code.startsWith("??")) return "add";
  if (c === "D") return "del";
  return "mod";
}

function renderGit(git) {
  if (!git || !git.isRepo) {
    setText("git-branch", "not a git repo");
    el("git-commits").innerHTML = "";
    el("git-changed").innerHTML = '<div class="empty mini">—</div>';
    return;
  }
  setText("git-branch", `⎇ ${git.branch} · ${git.changed.length} uncommitted`);
  el("git-commits").innerHTML = git.commits.length
    ? git.commits
        .map(
          (c) => `<article class="commit"><code>${escapeHtml(c.hash)}</code><span>${escapeHtml(c.subject)}</span><small>${relativeTime(c.at)}</small></article>`,
        )
        .join("")
    : '<div class="empty mini">No commits yet.</div>';
  el("git-changed").innerHTML = git.changed.length
    ? git.changed.map((line) => `<div class="changed ${changedClass(line)}">${escapeHtml(line)}</div>`).join("")
    : '<div class="empty mini">Working tree clean.</div>';
}

/* ---------- events (filterable) ---------- */

function renderEventFilters(events) {
  const types = ["all", ...Array.from(new Set(events.map((e) => e.type)))];
  const wrap = el("event-filters");
  wrap.innerHTML = types
    .map((t) => `<button type="button" class="filter-chip ${t === eventFilter ? "active" : ""}" data-filter="${escapeHtml(t)}">${t === "all" ? "All" : `${EVENT_ICONS[t] || "•"} ${escapeHtml(t)}`}</button>`)
    .join("");
  wrap.querySelectorAll("button[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      eventFilter = b.dataset.filter;
      renderEventFilters(events);
      renderEventList(events);
    }),
  );
}

function renderEventList(events) {
  const target = el("event-list");
  const filtered = eventFilter === "all" ? events : events.filter((e) => e.type === eventFilter);
  if (!filtered.length) {
    target.innerHTML = '<div class="empty mini">No events for this filter.</div>';
    return;
  }
  target.innerHTML = filtered
    .map((event) => {
      const tokens = (event.tokensIn || 0) + (event.tokensOut || 0);
      const meta = [relativeTime(event.createdAt), tokens ? `${fmt.format(tokens)} tok` : "", event.costUsd ? `$${Number(event.costUsd).toFixed(4)}` : ""].filter(Boolean).join(" · ");
      return `<article class="event">
        <span class="event-ico">${EVENT_ICONS[event.type] || "•"}</span>
        <div class="event-body">
          <div class="event-head"><strong>${escapeHtml(event.title)}</strong><span class="pill">${escapeHtml(event.type)}</span></div>
          ${event.details ? `<p>${escapeHtml(event.details)}</p>` : ""}
          <small>${escapeHtml(meta)}</small>
        </div>
      </article>`;
    })
    .join("");
}

/* ---------- graph ---------- */

function renderGraph(graph) {
  const svg = el("stack-graph");
  const core = graph.nodes.filter((n) => n.group !== "task");
  const tasks = graph.nodes.filter((n) => n.group === "task");
  const positions = new Map();
  const corePositions = [
    [120, 90],
    [300, 90],
    [480, 90],
    [660, 90],
    [780, 210],
    [620, 310],
    [440, 310],
    [260, 310],
    [100, 230],
  ];
  core.forEach((n, i) => positions.set(n.id, corePositions[i] || [120 + i * 80, 180]));
  tasks.forEach((n, i) => positions.set(n.id, [160 + (i % 4) * 190, 180 + Math.floor(i / 4) * 64]));

  const edges = graph.edges
    .filter((e) => positions.has(e.from) && positions.has(e.to))
    .map((e) => {
      const [x1, y1] = positions.get(e.from);
      const [x2, y2] = positions.get(e.to);
      return `<line class="graph-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    })
    .join("");
  const nodes = graph.nodes
    .filter((n) => positions.has(n.id))
    .map((n) => {
      const [x, y] = positions.get(n.id);
      const label = n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label;
      return `<g><rect class="graph-node ${n.group}" x="${x - 72}" y="${y - 20}" width="144" height="40" rx="9" /><text class="graph-label" x="${x}" y="${y + 5}" text-anchor="middle" font-size="12">${escapeHtml(label)}</text></g>`;
    })
    .join("");
  svg.innerHTML = `${edges}${nodes}`;
}

/* ---------- apply ---------- */

function applyData(data) {
  latest = data;
  renderVitals(data);
  renderPhaseHero(data);
  renderCostHero(data);
  renderGatesHero(data.quality.gates);
  renderAgentsHero(data);
  renderToolChart(data.activity);
  renderPhases(data.phases);
  renderTasks(data.tasks);
  renderQuality(data.quality);
  renderMemory(data.memory);
  renderGit(data.git);
  renderEventFilters(data.events);
  renderEventList(data.events);
  renderGraph(data.graph);
}

/* ---------- polling ---------- */

function setLive(ok) {
  const ind = el("live-indicator");
  ind.classList.toggle("offline", !ok);
  setText("live-label", ok ? "live" : "offline");
}

let lastSignature = "";
let inFlight = false;
async function load(force = false) {
  if (inFlight) return;
  inFlight = true;
  try {
    const data = await api(stateUrl);
    setLive(true);
    const { generatedAt, ...rest } = data;
    const signature = JSON.stringify(rest);
    if (force || signature !== lastSignature) {
      lastSignature = signature;
      applyData(data);
    }
    setText("generated-at", `updated ${relativeTime(data.generatedAt)}`);
  } catch (error) {
    setLive(false);
  } finally {
    inFlight = false;
  }
}

/* ---------- wiring ---------- */

el("refresh").addEventListener("click", () => load(true));

const actionResult = el("action-result");
document.querySelectorAll(".actions button[data-action]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const name = btn.dataset.action;
    const buttons = [...document.querySelectorAll(".actions button")];
    buttons.forEach((b) => (b.disabled = true));
    actionResult.className = "action-result show busy";
    actionResult.textContent = `Running ${name}…`;
    try {
      const res = await api("/api/actions", { method: "POST", body: JSON.stringify({ name }) });
      actionResult.className = `action-result show ${res.ok ? "ok" : "fail"}`;
      actionResult.textContent = `${res.ok ? "✓" : "✗"} ${name} · ${res.durationMs}ms\n\n${res.summary || res.output || "(no output)"}`;
      await load(true);
    } catch (error) {
      actionResult.className = "action-result show fail";
      actionResult.textContent = `✗ ${name} failed: ${error.message}`;
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  });
});

el("task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: el("task-title").value,
      details: el("task-details").value,
      agent: el("task-agent").value,
      priority: el("task-priority").value,
      intent: "route",
    }),
  });
  event.target.reset();
  setText("form-status", "Task added.");
  await load(true);
});

setInterval(() => {
  if (!document.hidden) load().catch(() => {});
}, 3000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) load(true).catch(() => {});
});
// keep relative timestamps fresh between polls
setInterval(() => {
  if (latest && !document.hidden) setText("generated-at", `updated ${relativeTime(latest.generatedAt)}`);
}, 1000);

load(true).catch((error) => {
  document.body.innerHTML = `<main class="panel-block"><h1>Dashboard failed</h1><p>${escapeHtml(error.message)}</p></main>`;
});
