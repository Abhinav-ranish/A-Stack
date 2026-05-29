#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const positional = [];
const flags = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    flags[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : true;
  } else {
    positional.push(a);
  }
}
const root = positional[0] || flags.target || process.cwd();
const ignorePath = join(root, ".a-stack", "security-ignore.json");
let ignores = { ids: [], files: [], lines: [] };
if (existsSync(ignorePath)) {
  try {
    const parsed = JSON.parse(readFileSync(ignorePath, "utf8"));
    ignores = { ids: parsed.ids || [], files: parsed.files || [], lines: parsed.lines || [] };
  } catch {
    ignores = { ids: [], files: [], lines: [] };
  }
}

const includeExt = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".env", ".yaml", ".yml",
  ".py", ".rb", ".go", ".php", ".java", ".kt", ".rs", ".sh", ".bash", ".zsh",
  ".html", ".vue", ".svelte", ".astro",
]);
const denyDirs = new Set([
  ".git", "node_modules", "dist", "build", ".next", ".cache", "coverage",
  ".turbo", ".parcel-cache", "out", ".svelte-kit", ".nuxt", "vendor", "target",
  ".venv", "__pycache__",
]);

const patterns = [
  // Secrets — provider-specific token shapes
  { id: "openai-key", severity: "critical", regex: /sk-(?:proj-|svcacct-|None-)?[A-Za-z0-9_-]{20,}/ },
  { id: "anthropic-key", severity: "critical", regex: /sk-ant-(?:api|admin|sid)-[A-Za-z0-9_-]{20,}/ },
  { id: "github-token", severity: "critical", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/ },
  { id: "github-fine-grained", severity: "critical", regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { id: "aws-access-key", severity: "critical", regex: /\b(?:AKIA|ASIA|AIDA|AGPA|AROA|AIPA|ANPA|ANVA)[0-9A-Z]{16}\b/ },
  { id: "aws-secret-key", severity: "critical", regex: /\baws(?:.{0,20})?(?:secret|access)?[_-]?key[^a-z0-9]{0,5}['"][A-Za-z0-9/+=]{40}['"]/i },
  { id: "google-api-key", severity: "critical", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "google-oauth", severity: "high", regex: /\bya29\.[0-9A-Za-z_-]{20,}/ },
  { id: "stripe-live-key", severity: "critical", regex: /\bsk_live_[0-9a-zA-Z]{20,}\b/ },
  { id: "stripe-restricted-key", severity: "critical", regex: /\brk_live_[0-9a-zA-Z]{20,}\b/ },
  { id: "slack-token", severity: "critical", regex: /\bxox[abprs]-[0-9A-Za-z-]{10,}/ },
  { id: "slack-webhook", severity: "high", regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{6,}\/B[A-Z0-9]{6,}\/[A-Za-z0-9]{24,}/ },
  { id: "discord-bot-token", severity: "high", regex: /\b[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27,}\b/ },
  { id: "private-key-block", severity: "critical", regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: "jwt-leak", severity: "medium", regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: "generic-api-key", severity: "high", regex: /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][A-Za-z0-9_\-./+=]{20,}['"]/i },
  { id: "db-url-with-password", severity: "high", regex: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s'"`]+:[^@\s'"`]{4,}@/ },

  // Trust boundary
  { id: "client-user-id-trust", severity: "high", regex: /(?:req\.(?:query|body|params|headers)\.(?:user[_-]?id|userId|owner[_-]?id|account[_-]?id)|searchParams\.get\(['"](?:user[_-]?id|userId|owner[_-]?id|account[_-]?id)['"]\))/i },
  { id: "client-admin-trust", severity: "high", regex: /(?:req\.(?:query|body|params|headers)\.(?:is[_-]?admin|isAdmin|role|admin)|localStorage\.getItem\(['"](?:role|is[_-]?admin|admin)['"]\))/i },
  { id: "jwt-none-alg", severity: "critical", regex: /\balg(?:orithm)?\s*[:=]\s*['"]none['"]/i },
  { id: "jwt-verify-disabled", severity: "high", regex: /jwt\.(?:verify|decode)\([^)]*\bverify\s*:\s*false/ },

  // Injection / unsafe
  { id: "unsafe-exec-template", severity: "high", regex: /(?:execSync|exec|spawn|spawnSync)\s*\(\s*`[^`]*\$\{/ },
  { id: "unsafe-exec-concat", severity: "high", regex: /(?:execSync|exec|spawnSync|spawn)\s*\(\s*['"][^'"]*['"]\s*\+/ },
  { id: "shell-injection-shellTrue", severity: "high", regex: /shell\s*:\s*true/ },
  { id: "child-process-eval", severity: "high", regex: /\b(?:eval|Function)\s*\(\s*[^)]*(?:req\.|request\.|input)/ },
  { id: "sql-string-concat", severity: "high", regex: /(?:query|execute|raw)\s*\(\s*['"`][^'"`]*(?:SELECT|INSERT|UPDATE|DELETE)[^'"`]*['"`]\s*\+/i },
  { id: "sql-template-interp", severity: "medium", regex: /(?:query|execute|raw)\s*\(\s*`[^`]*(?:SELECT|INSERT|UPDATE|DELETE)[^`]*\$\{/i },
  { id: "path-traversal-sink", severity: "high", regex: /(?:readFile|readFileSync|createReadStream|sendFile|res\.sendFile)\s*\(\s*(?:path\.join\([^)]*req\.|req\.[a-z.]+\.(?:path|file|name))/i },
  { id: "open-redirect", severity: "medium", regex: /res\.redirect\s*\(\s*req\.(?:query|body|params)/ },
  { id: "ssrf-fetch-userinput", severity: "high", regex: /(?:fetch|axios\.(?:get|post|request)|got|http\.request)\s*\(\s*req\.(?:query|body|params)/ },

  // Web app
  { id: "insecure-cookie", severity: "medium", regex: /(?:setCookie|res\.cookie|document\.cookie\s*=)/ },
  { id: "open-cors", severity: "medium", regex: /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*/ },
  { id: "open-cors-credentials", severity: "high", regex: /cors\(\s*\{\s*origin\s*:\s*true[^}]*credentials\s*:\s*true/ },
  { id: "dangerous-html", severity: "low", regex: /dangerouslySetInnerHTML|innerHTML\s*=/ },
  { id: "tls-rejectUnauthorized", severity: "high", regex: /rejectUnauthorized\s*:\s*false/ },
  { id: "tls-env-bypass", severity: "high", regex: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/ },

  // AI / prompt
  { id: "prompt-injection-marker", severity: "medium", regex: /\b(ignore (?:all )?previous instructions|disregard (?:all )?previous instructions|you are now|system prompt:)/i },
  { id: "llm-key-in-frontend", severity: "high", regex: /(?:NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_)(?:OPENAI|ANTHROPIC|GROQ|TOGETHER|MISTRAL|GEMINI)_API_KEY/ },
];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return denyDirs.has(entry.name) ? [] : walk(path);
    if (!entry.isFile()) return [];
    const ext = entry.name.startsWith(".env") ? ".env" : entry.name.slice(entry.name.lastIndexOf("."));
    return includeExt.has(ext) ? [path] : [];
  });
}

function isIgnored(relFile, line, id) {
  if (ignores.ids.includes(id)) return true;
  if (ignores.files.includes(relFile)) return true;
  if (ignores.lines.some((rule) => rule.file === relFile && rule.line === line)) return true;
  return false;
}

const findings = [];
for (const file of walk(root)) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (content.indexOf("\0") !== -1) continue; // skip binary files
  const relFile = relative(root, file);
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes("a-stack-ignore")) return;
    for (const pattern of patterns) {
      if (!pattern.regex.test(line)) continue;
      if (isIgnored(relFile, index + 1, pattern.id)) continue;
      findings.push({
        id: pattern.id,
        severity: pattern.severity,
        file: relFile,
        line: index + 1,
        snippet: line.trim().slice(0, 180),
      });
    }
  });
}

const counts = findings.reduce(
  (acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  },
  { critical: 0, high: 0, medium: 0, low: 0 },
);

console.log(
  JSON.stringify(
    {
      root,
      findings,
      critical: counts.critical,
      high: counts.high,
      medium: counts.medium,
      low: counts.low,
      scannedPatterns: patterns.length,
    },
    null,
    2,
  ),
);
process.exit(counts.critical > 0 ? 1 : 0);
