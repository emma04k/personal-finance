import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUDGET_TIME_ZONE,
  buildCurrentMonthStartForTimeZone,
} from "@/modules/budget/application/default-budget-period";

describe("default budget period month", () => {
  it("uses America/Bogota as the project-owned default time zone", () => {
    expect(DEFAULT_BUDGET_TIME_ZONE).toBe("America/Bogota");
  });

  it("derives the default month from the local date in the selected time zone", () => {
    expect(
      buildCurrentMonthStartForTimeZone({
        now: new Date("2026-03-01T02:00:00.000Z"),
        timeZone: "America/Bogota",
      }),
    ).toBe("2026-02");
  });
});
