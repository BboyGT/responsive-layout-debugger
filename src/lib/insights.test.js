import { describe, expect, it } from "vitest";
import {
  buildCauseExplanation,
  buildComparisonFix,
  buildRegressionSummary,
} from "./insights";

describe("insights helpers", () => {
  it("builds grouped cause explanations", () => {
    const result = buildCauseExplanation({
      causeLabel: "A fixed width is preventing the layout from shrinking",
      selectors: [".card", ".hero"],
      devices: ["mobile", "tablet"],
      rationale: ["The computed width stays in pixels instead of adapting."],
    });

    expect(result).toContain("A fixed width is preventing the layout from shrinking");
    expect(result).toContain(".card, .hero");
    expect(result).toContain("mobile, tablet");
  });

  it("accepts grouped values passed as sets", () => {
    const result = buildCauseExplanation({
      causeLabel: "Container width mismatch",
      selectors: new Set([".card", ".hero", ".nav", ".badge"]),
      devices: new Set(["mobile", "tablet"]),
      rationale: new Set(["The rendered box crosses the viewport boundary."]),
    });

    expect(result).toContain(".card, .hero, .nav");
    expect(result).toContain("and 1 more elements");
    expect(result).toContain("mobile, tablet");
  });

  it("returns targeted comparison fixes", () => {
    expect(buildComparisonFix("fixed-width")).toContain("fixed pixel widths");
    expect(buildComparisonFix("unknown")).toContain("Compare widths");
  });

  it("computes regression deltas", () => {
    const result = buildRegressionSummary(
      [{ id: "mobile", label: "Mobile", count: 2 }],
      [{ id: "mobile", label: "Mobile", count: 5 }],
    );

    expect(result).toEqual([
      {
        id: "mobile",
        label: "Mobile",
        baselineCount: 2,
        currentCount: 5,
        delta: 3,
      },
    ]);
  });
});
