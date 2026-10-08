import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = resolve("scripts/docker-release-validate.sh");
const readmePath = resolve("README.md");
const runbookPath = resolve("docs/mvp-production-readiness-runbook.md");

function source(path: string) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function expectInOrder(text: string, expected: readonly string[]) {
  let cursor = -1;

  for (const value of expected) {
    const index = text.indexOf(value, cursor + 1);
    expect(index, `Expected to find ${value} after offset ${cursor}`).toBeGreaterThan(cursor);
    cursor = index;
  }
}

function writeExecutable(path: string, content: string) {
  writeFileSync(path, content, { mode: 0o755 });
  chmodSync(path, 0o755);
}

function readLines(path: string) {
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
}

const validationCommands = [
  "docker compose config --quiet",
  "docker compose up -d --build",
  "docker compose ps",
  "docker compose exec app npm run db:validate",
  "docker compose exec app npm run db:generate",
  "docker compose exec app npm run test",
  "docker compose exec app npm run lint",
  "docker compose exec app npm run typecheck",
  "docker compose exec app npm run build",
  "curl --fail http://127.0.0.1:3000/",
  "docker compose down",
  "docker compose ps",
] as const;

const prismaGenerationBeforeTestsCommands = [
  "docker compose exec app npm run db:validate",
  "docker compose exec app npm run db:generate",
  "docker compose exec app npm run test",
] as const;

describe("Docker-first release validation helper contract", () => {
  it("provides an executable helper that runs the documented validation commands safely", () => {
    expect(existsSync(scriptPath)).toBe(true);

    const script = source(scriptPath);
    const mode = statSync(scriptPath).mode;

    expect(script).toMatch(/^#!\/usr\/bin\/env bash/);
    expect(mode & 0o111).not.toBe(0);
    expect(script).toContain("set -Eeuo pipefail");
    expect(script).toContain("trap cleanup EXIT");
    expect(script).toMatch(/docker compose config --quiet/);
    expect(script).not.toMatch(/docker compose config(?!\s+--quiet)/);
    expect(script).toMatch(/docker compose up -d --build/);
    expect(script).not.toMatch(/docker compose up --build(?!\s)/);
    expect(script).not.toMatch(/(^|\n)\s*(?:env|printenv)\b|docker compose config\s*(?:\||>|$)/);
    expectInOrder(script, validationCommands);
  });

  it("runs Prisma validation and generation before containerized tests", () => {
    const script = source(scriptPath);

    expectInOrder(script, prismaGenerationBeforeTestsCommands);
  });

  it("keeps cleanup armed for every validation step after Compose startup begins", () => {
    const script = source(scriptPath);
    const startupIndex = script.indexOf("docker compose up -d --build");
    const cleanupArmIndex = script.indexOf("cleanup_required=1");
    const firstContainerCheckIndex = script.indexOf("docker compose ps");
    const downIndex = script.indexOf("docker compose down");

    expect(cleanupArmIndex).toBeGreaterThan(-1);
    expect(startupIndex).toBeGreaterThan(-1);
    expect(firstContainerCheckIndex).toBeGreaterThan(startupIndex);
    expect(cleanupArmIndex).toBeLessThan(startupIndex);
    expect(downIndex).toBeGreaterThan(startupIndex);
  });

  it("treats cleanup as best-effort and preserves the original validation failure code", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "docker-release-validate-"));
    const binDir = join(tempDir, "bin");
    const dockerLog = join(tempDir, "docker.log");
    const psCount = join(tempDir, "ps-count");

    mkdirSync(binDir);
    writeFileSync(psCount, "0");
    writeExecutable(join(binDir, "docker"), `#!/usr/bin/env bash
printf '%s\n' "$*" >> "$DOCKER_STUB_LOG"
if [[ "$*" == "compose ps" ]]; then
  count=$(cat "$DOCKER_PS_COUNT")
  count=$((count + 1))
  printf '%s' "$count" > "$DOCKER_PS_COUNT"
  if [[ "$count" -eq 1 ]]; then
    exit 27
  fi
  exit 32
fi
if [[ "$*" == "compose down" ]]; then
  exit 31
fi
exit 0
`);
    writeExecutable(join(binDir, "curl"), `#!/usr/bin/env bash
exit 0
`);

    try {
      const result = spawnSync("bash", [scriptPath], {
        cwd: resolve("."),
        encoding: "utf8",
        env: {
          ...process.env,
          DOCKER_PS_COUNT: psCount,
          DOCKER_STUB_LOG: dockerLog,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(27);
      expect(readLines(dockerLog)).toEqual([
        "compose config --quiet",
        "compose up -d --build",
        "compose ps",
        "compose down",
        "compose ps",
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("points operators at the helper while preserving the expanded command list", () => {
    const readme = source(readmePath);
    const runbook = source(runbookPath);

    for (const doc of [readme, runbook]) {
      expect(doc).toContain("scripts/docker-release-validate.sh");
      expect(doc).toMatch(/bash scripts\/docker-release-validate\.sh/);
      expectInOrder(doc, validationCommands);
      expect(doc).not.toMatch(/postgres(?:ql)?:\/\/[^\s<]+|sk-[A-Za-z0-9_-]{20,}|password\s*[:=]\s*[^\s<\[]/i);
    }
  });
});
