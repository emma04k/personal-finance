import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(".github/workflows/ci.yml");
const workflow = readFileSync(workflowPath, "utf8").replaceAll("\r\n", "\n");

function runnerForJob(jobName: string) {
  const jobBlock = workflow.match(
    new RegExp(`^  ${jobName}:\\n((?:    .+\\n?)+)`, "m"),
  )?.[1];

  expect(jobBlock, `Expected ${jobName} job to exist in CI workflow`).toBeDefined();

  return jobBlock?.match(/^    runs-on:\s*(\S+)$/m)?.[1];
}

describe("CI workflow runner contract", () => {
  it("pins every CI job to an explicit Ubuntu runner image", () => {
    const jobRunners = [runnerForJob("quality"), runnerForJob("production-image")];

    expect(workflow).not.toContain("runs-on: ubuntu-latest");
    expect(jobRunners).toEqual(["ubuntu-24.04", "ubuntu-24.04"]);
  });
});
