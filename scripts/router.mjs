#!/usr/bin/env node
const input = process.argv.slice(2).join(" ").trim();

const intents = [
  {
    name: "new-app",
    workflow: "workflows/new-app.md",
    keywords: [
      "build an app",
      "make an app",
      "create an app",
      "new app",
      "web app",
      "saas",
      "dashboard",
      "landing page",
      "mvp",
      "startup idea",
    ],
  },
  {
    name: "migrate",
    workflow: "workflows/migrate.md",
    keywords: [
      "/migrate",
      "migrate",
      "import stack",
      "import a-stack",
      "add a-stack",
      "install a-stack",
      "stack files aren't there",
      "stack files are missing",
      "existing repo",
      "already has code",
      "make it so a-stack was there",
      "make it so a stack was there",
    ],
  },
  {
    name: "plan",
    workflow: "workflows/plan.md",
    keywords: ["plan", "prd", "spec", "roadmap", "requirements", "phase", "architecture", "scope"],
  },
  {
    name: "execute",
    workflow: "workflows/execute.md",
    keywords: ["implement", "execute", "build this", "code it", "start coding", "work on phase", "parallel"],
  },
  {
    name: "security-review",
    workflow: "workflows/security-review.md",
    keywords: ["security", "cyber", "audit", "vulnerability", "owasp", "auth", "secrets", "pii", "prompt injection"],
  },
  {
    name: "ui-review",
    workflow: "workflows/ui-review.md",
    keywords: ["ui", "ux", "design", "slop", "council", "screenshot", "frontend", "visual", "taste"],
  },
  {
    name: "qa-browser",
    workflow: "workflows/qa-browser.md",
    keywords: ["qa", "browser", "click", "test the site", "playwright", "console", "screenshot", "broken flow"],
  },
  {
    name: "seo-audit",
    workflow: "workflows/seo-audit.md",
    keywords: ["seo", "metadata", "og tag", "sitemap", "robots", "search engine", "canonical", "schema"],
  },
  {
    name: "ship",
    workflow: "workflows/ship.md",
    keywords: ["ship", "release", "deploy", "launch", "pr", "merge", "production", "go live"],
  },
  {
    name: "debug",
    workflow: "workflows/debug.md",
    keywords: [
      "debug",
      "bug",
      "broken",
      "error",
      "failing",
      "not working",
      "crash",
      "regression",
      "fix this",
      "fix the bug",
      "why is",
      "why isn't",
      "stack trace",
      "throws",
      "throwing",
      "stops working",
      "stopped working",
      "doesn't work",
      "does not work",
    ],
  },
  {
    name: "memory-recall",
    workflow: "workflows/memory.md",
    keywords: ["remember", "memory", "preference", "what stack", "what do i like", "recall", "knowledge"],
  },
  {
    name: "self-learning",
    workflow: "workflows/self-learning.md",
    keywords: [
      "self learning",
      "self-learning",
      "self optimizing",
      "self-optimizing",
      "learn from",
      "optimize itself",
      "improve over time",
      "trajectory",
      "feedback loop",
      "successful pattern",
    ],
  },
  {
    name: "find-skill",
    workflow: "workflows/find-skill.md",
    keywords: ["find skill", "extra skill", "install skill", "is there a skill", "skill for"],
  },
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordMatches(lower, keyword) {
  if (keyword.includes(" ") || keyword.startsWith("/")) return lower.includes(keyword);
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(keyword)}([^a-z0-9]|$)`).test(lower);
}

function scoreIntent(text, intent) {
  const lower = text.toLowerCase();
  let score = 0;
  const matches = [];

  for (const keyword of intent.keywords) {
    if (keywordMatches(lower, keyword)) {
      const weight = keyword.includes(" ") ? 3 : 1;
      score += weight;
      matches.push(keyword);
    }
  }

  if (intent.name === "new-app" && /\b(build|make|create)\b.*\b(app|site|dashboard|saas|tool)\b/.test(lower)) {
    score += 5;
    matches.push("build-app-pattern");
  }

  if (intent.name === "migrate" && /\b(existing|already has|old|current)\b.*\b(repo|codebase|project|app)\b/.test(lower)) {
    score += 5;
    matches.push("existing-repo-pattern");
  }

  if (intent.name === "ship" && /\b(ship|deploy|release)\b/.test(lower)) {
    score += 4;
    matches.push("ship-pattern");
  }

  if (intent.name === "security-review" && /\b(auth|admin|token|secret|vuln|owasp)\b/.test(lower)) {
    score += 3;
    matches.push("security-pattern");
  }

  if (intent.name === "debug" && /\b(fix|debug|investigate|repro|reproduce)\b.*\b(bug|error|crash|issue|failure|test)\b/.test(lower)) {
    score += 4;
    matches.push("debug-pattern");
  }

  if (intent.name === "debug" && /\b(bug|broken|crash|error|exception|failing|fails)\b/.test(lower)) {
    score += 2;
    matches.push("debug-symptom");
  }

  return { ...intent, score, matches };
}

function detectMode(text) {
  const lower = text.toLowerCase();
  if (/\b(review[- ]?only|just review|don'?t fix|do not fix|no auto[- ]?fix|advisory only)\b/.test(lower)) {
    return { mode: "review-only", reason: "User asked for review without changes." };
  }
  if (/\b(ask me|confirm with me|wait for me|step by step|interactive|don'?t yolo|do not yolo|pause before)\b/.test(lower)) {
    return { mode: "interactive", reason: "User asked for confirmation before each step." };
  }
  if (/\b(yolo|full[- ]?yolo|just do it|go ahead|don'?t ask)\b/.test(lower)) {
    return { mode: "full-yolo", reason: "User explicitly asked for full-yolo." };
  }
  return { mode: "full-yolo", reason: "Default mode." };
}

function route(text) {
  if (!text) {
    return {
      intent: "new-app",
      workflow: "workflows/new-app.md",
      confidence: "low",
      matches: [],
      mode: "full-yolo",
      modeReason: "No input provided; defaulting.",
      reason: "No input provided; defaulting to new app intake.",
    };
  }

  const { mode, reason: modeReason } = detectMode(text);

  const ranked = intents
    .map((intent) => scoreIntent(text, intent))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const best = ranked[0];
  const second = ranked[1];
  const confidence =
    best.score >= 5 && best.score >= second.score + 2
      ? "high"
      : best.score >= 2
        ? "medium"
        : best.score >= 1
          ? "low"
          : "none";

  if (confidence === "none") {
    return {
      intent: "find-skill",
      workflow: "workflows/find-skill.md",
      confidence,
      matches: best.matches,
      mode,
      modeReason,
      reason: "No keyword match; use find-skills fallback after checking local context.",
    };
  }

  return {
    intent: best.name,
    workflow: best.workflow,
    confidence,
    matches: best.matches,
    mode,
    modeReason,
    reason: `Matched ${best.name} from ${best.matches.join(", ")}.`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = route(input);
  console.log(JSON.stringify(result, null, 2));
}

export { route };
