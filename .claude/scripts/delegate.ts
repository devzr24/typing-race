// Pont orchestrateur -> agents Codex (luna, sol). Adapté de claude-delegation-kit (MIT, PatLeGrand).
// N'imprime que le compte rendu final de l'agent, pour ne pas remplir le contexte de l'orchestrateur.
//
//   npx tsx .claude/scripts/delegate.ts <luna|sol> <brief.md|-> [--skills a,b] [--effort niveau] [--dry-run]
//   npx tsx .claude/scripts/delegate.ts quota
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface AgentConfig {
  model: string;
  effort: string;
  sandbox: string;
  timeoutMin: number;
  skills: string[];
  role: string;
}

interface RateWindow {
  used_percent: number;
  window_minutes: number;
  resets_at: number;
}

const CLAUDE_DIR = path.resolve(path.dirname(process.argv[1] ?? "."), "..");
const CWD = process.cwd();
const isWin = process.platform === "win32";

function die(msg: string): never {
  console.error(msg);
  process.exit(2);
}

// La CLI livrée avec l'app Codex n'est pas dans le PATH ; son dossier change à chaque mise à jour.
function codexBin(): string {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  const base = path.join(process.env.LOCALAPPDATA ?? "", "OpenAI", "Codex", "bin");
  if (fs.existsSync(base)) {
    const found = fs
      .readdirSync(base)
      .map((d) => path.join(base, d, "codex.exe"))
      .filter((f) => fs.existsSync(f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (found.length) return found[0];
  }
  return "codex";
}

function run(bin: string, args: string[], input: string, timeoutMin: number): SpawnSyncReturns<string> {
  // Une CLI résolue via le PATH peut être un shim .cmd sous Windows : il faut alors un shell et des guillemets.
  const shell = isWin && !path.isAbsolute(bin);
  const quoted = shell ? args.map((a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)) : args;
  return spawnSync(bin, quoted, {
    cwd: CWD,
    input,
    shell,
    encoding: "utf8",
    maxBuffer: 256 << 20,
    timeout: timeoutMin * 60_000,
    windowsHide: true,
  });
}

function skillText(name: string): string {
  const file = path.join(CLAUDE_DIR, "skills", name, "SKILL.md");
  if (!fs.existsSync(file)) die(`Skill inconnu : ${name}`);
  return fs.readFileSync(file, "utf8").replace(/^---[\s\S]*?---\s*/, "").trim();
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

function failure(name: string, r: SpawnSyncReturns<string>): never {
  const errCode = (r.error as NodeJS.ErrnoException | undefined)?.code;
  const reason =
    errCode === "ETIMEDOUT" ? "délai dépassé" : r.status === 0 ? "aucune sortie" : (r.error?.message ?? `code ${r.status}`);
  const tail = (r.stderr || r.stdout || "").trim().split("\n").slice(-15).join("\n");
  console.log(`[${name} · ÉCHEC : ${reason}]\n${tail}`);
  process.exit(1);
}

function runCodex(name: string, agent: AgentConfig, prompt: string, effort: string): void {
  const outFile = path.join(os.tmpdir(), `delegate-${name}-${process.pid}.md`);
  const args = [
    "exec", "--json", "--skip-git-repo-check", "-s", agent.sandbox,
    "-m", agent.model, "-c", `model_reasoning_effort=${effort}`, "-o", outFile, "-",
  ];
  const started = Date.now();
  const r = run(codexBin(), args, prompt, agent.timeoutMin);
  if (r.status !== 0 || !fs.existsSync(outFile)) failure(name, r);

  const usage = { input: 0, cached: 0, output: 0 };
  for (const line of (r.stdout ?? "").split("\n")) {
    if (!line.includes('"turn.completed"')) continue;
    const u = JSON.parse(line).usage ?? {};
    usage.input += u.input_tokens ?? 0;
    usage.cached += u.cached_input_tokens ?? 0;
    usage.output += u.output_tokens ?? 0;
  }
  const text = fs.readFileSync(outFile, "utf8").trim();
  fs.rmSync(outFile, { force: true });
  console.log(
    `[${name} · ${agent.model}/${effort} · ${fmtDuration(Date.now() - started)} · ` +
      `in ${fmtK(usage.input)} (cache ${fmtK(usage.cached)}) / out ${fmtK(usage.output)}]`,
  );
  console.log(text);
}

function takeValue(rest: string[], i: number, flag: string): string {
  const value = rest[i + 1];
  if (!value || value.startsWith("--")) die(`Valeur requise pour ${flag}`);
  return value;
}

function delegate(argv: string[]): void {
  const [name = "", briefArg, ...rest] = argv;
  const agents: Record<string, AgentConfig> = JSON.parse(
    fs.readFileSync(path.join(CLAUDE_DIR, "workflow", "agents.json"), "utf8"),
  );
  const agent = agents[name];
  if (!agent || !briefArg) {
    die(`Usage : delegate.ts <${Object.keys(agents).join("|")}> <brief.md|-> [--skills a,b] [--effort niveau] [--dry-run]`);
  }

  const skills = [...agent.skills];
  let effort = agent.effort;
  let dryRun = false;
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === "--skills") skills.push(...takeValue(rest, i++, flag).split(",").map((s) => s.trim()).filter(Boolean));
    else if (flag === "--effort") effort = takeValue(rest, i++, flag);
    else if (flag === "--dry-run") dryRun = true;
    else die(`Option inconnue : ${flag}`);
  }

  const brief = briefArg === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(briefArg, "utf8");
  const parts = [
    `# Rôle\n${agent.role}\n` +
      "Tu fais partie d'un système multi-agents piloté par un orchestrateur. Travaille dans le répertoire courant.\n" +
      "Les règles du projet sont dans CLAUDE.md et AGENTS.md à la racine : lis-les avant de coder et respecte-les.\n" +
      "Ne commite pas, ne change pas de branche, ne pousse rien." +
      (isWin
        ? "\nBash n'est pas disponible dans ton sandbox Windows : n'essaie pas. Si une vérification échoue faute d'outil, " +
          "liste la commande dans RESTE, l'orchestrateur la lancera."
        : ""),
    ...[...new Set(skills)].map((s) => `# Skill : ${s}\n${skillText(s)}`),
    `# Brief\n${brief.trim()}`,
  ];
  const prompt = parts.join("\n\n") + "\n";

  if (dryRun) {
    console.log(`Taille du prompt : ${(Buffer.byteLength(prompt, "utf8") / 1024).toFixed(1)} Ko`);
    console.log(`Sections : ${(prompt.match(/^# .+$/gm) ?? []).join(" | ")}`);
    console.log(`Codex : ${codexBin()}`);
    return;
  }
  runCodex(name, agent, prompt, effort);
}

function findKey(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return (obj as Record<string, unknown>)[key];
  for (const v of Object.values(obj)) {
    const found = findKey(v, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function until(epochSec: number): string {
  const min = Math.round((epochSec * 1000 - Date.now()) / 60_000);
  if (min <= 0) return "réinitialisé depuis";
  const h = Math.floor(min / 60);
  return h >= 24 ? `reset dans ${Math.floor(h / 24)}j${h % 24}h` : `reset dans ${h}h${String(min % 60).padStart(2, "0")}`;
}

// Codex n'expose pas ses limites en ligne de commande, mais chaque session enregistrée les note.
function codexQuota(): string {
  const dir = path.join(os.homedir(), ".codex", "sessions");
  if (!fs.existsSync(dir)) return "inconnu (aucune session Codex)";
  const files = fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse()
    .slice(0, 20);
  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes('"rate_limits"')) continue;
      const entry = JSON.parse(lines[i]);
      const limits = findKey(entry, "rate_limits") as { primary?: RateWindow; secondary?: RateWindow } | undefined;
      if (!limits?.primary) continue;
      const win = (w: RateWindow) => {
        const label = w.window_minutes >= 1440 ? `${Math.round(w.window_minutes / 1440)}j` : `${Math.round(w.window_minutes / 60)}h`;
        const reset = w.resets_at * 1000 <= Date.now();
        return `${label} ${reset ? 100 : Math.round(100 - w.used_percent)}% restant (${until(w.resets_at)})`;
      };
      const age = entry.timestamp ? ` [relevé il y a ${fmtDuration(Date.now() - Date.parse(entry.timestamp))}]` : "";
      return [limits.primary, limits.secondary].filter((w): w is RateWindow => !!w).map(win).join(" · ") + age;
    }
  }
  return "inconnu (aucune limite enregistrée récemment)";
}

const argv = process.argv.slice(2);
if (argv[0] === "quota") {
  console.log(`codex  : ${codexQuota()}`);
  console.log("claude : outil get_usage (app desktop) ou /usage");
} else {
  delegate(argv);
}
