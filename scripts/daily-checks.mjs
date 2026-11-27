import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  LANG: process.env.LANG,
  CI: "1",
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
  VITE_HOSTED_AI_ENABLED: "false",
  VITE_OPENAI_API_KEY: "",
  OPENAI_API_KEY: "",
};

const steps = [
  { label: "Focused story and Talk tests", command: npm, args: ["run", "test:learning"] },
  { label: "Full Node test suite", command: npm, args: ["test"] },
  { label: "Production build", command: npm, args: ["run", "build"] },
  { label: "Git whitespace check", command: "git", args: ["diff", "--check"] },
];

function tail(text, limit) {
  return (text || "").trim().split("\n").slice(-limit).join("\n");
}

function run(command, args) {
  const start = performance.now();
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    status: result.status,
    error: result.error?.message || "",
    output: [result.stdout, result.stderr].filter(Boolean).join("\n"),
    seconds: ((performance.now() - start) / 1000).toFixed(2),
  };
}

const results = [];
for (const step of steps) {
  const commandText = [step.command, ...step.args].join(" ");
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = run(step.command, step.args);
    attempts.push(result);
    if (result.status === 0) break;
    if (result.error.includes("ENOENT") || attempt === 2) break;
  }
  const last = attempts.at(-1);
  results.push({
    ...step,
    commandText,
    attempts,
    status: last.status === 0 ? (attempts.length === 1 ? "PASS" : "PASS after retry") : "FAIL",
  });
}

const now = new Date();
const berlin = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(now);
const timestamp = now.toISOString().replaceAll(":", "-").replaceAll(".", "-");
const reportDir = join(root, "reports", "daily");
const reportPath = join(reportDir, `daily-check-${timestamp}.md`);
const failed = results.filter((item) => item.status === "FAIL");
const lines = [
  "# Deutsch Meister daily checks",
  "",
  `- Started: ${berlin} Europe/Berlin`,
  `- Result: ${failed.length ? "NEEDS ATTENTION" : "PASS"}`,
  "- Scope: local tests, local production build and Git whitespace check only.",
  "- Data safety: no learner profile or cloud account was loaded; AI and Supabase build variables were blanked.",
  "- Publication: no push, deployment, live check or rollback was attempted.",
  "",
  "## Results",
];

for (const result of results) {
  lines.push(`- **${result.status}** — ${result.label} (\`${result.commandText}\`, ${result.attempts.length} attempt${result.attempts.length === 1 ? "" : "s"})`);
}

for (const result of results.filter((item) => item.status !== "PASS")) {
  lines.push("", `## ${result.label}`, "", `Rerun with: \`${result.commandText}\``);
  for (const [index, attempt] of result.attempts.entries()) {
    lines.push("", `### Attempt ${index + 1} (${attempt.seconds}s, exit ${attempt.status ?? "unknown"})`);
    if (attempt.error) lines.push("", `Process error: ${attempt.error}`);
    const output = tail(attempt.output, 100);
    if (output) lines.push("", "```text", output, "```");
  }
}

lines.push(
  "",
  "## Limits",
  "",
  "A passing local suite does not establish live AI quality, production health, deployed-code identity or cloud-data recovery. Review any retry-recovered result because it can indicate a flaky local check.",
  "",
);

await mkdir(reportDir, { recursive: true });
await writeFile(reportPath, lines.join("\n"), "utf8");
await writeFile(join(reportDir, "latest.md"), lines.join("\n"), "utf8");
console.log(`${failed.length ? "NEEDS ATTENTION" : "PASS"}: ${results.filter((item) => item.status.startsWith("PASS")).length}/${results.length} daily checks; report: ${reportPath}`);
if (failed.length) process.exitCode = 1;
