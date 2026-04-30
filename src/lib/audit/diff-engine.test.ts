import { describe, expect, it } from "vitest";
import { buildFieldDiffs, capFieldDiffs, flattenForAudit } from "./diff-engine";

describe("buildFieldDiffs", () => {
  it("detects scalar changes", () => {
    const d = buildFieldDiffs({ a: 1 }, { a: 2 });
    expect(d).toHaveLength(1);
    expect(d[0].path).toBe("a");
    expect(d[0].before).toBe(1);
    expect(d[0].after).toBe(2);
  });

  it("redacts sensitive keys", () => {
    const d = buildFieldDiffs({ password: "old" }, { password: "new" });
    expect(d[0].before).toBe("[redacted]");
    expect(d[0].after).toBe("[redacted]");
  });

  it("flattens nested paths", () => {
    const d = buildFieldDiffs({ user: { name: "A" } }, { user: { name: "B" } });
    const paths = d.map((x) => x.path);
    expect(paths.some((p) => p.includes("name"))).toBe(true);
  });
});

describe("capFieldDiffs", () => {
  it("limits rows", () => {
    const many = Array.from({ length: 600 }, (_, i) => ({
      path: `k${i}`,
      before: 0,
      after: 1,
    }));
    expect(capFieldDiffs(many, 500)).toHaveLength(500);
  });
});

describe("flattenForAudit", () => {
  it("indexes arrays", () => {
    const f = flattenForAudit([{ x: 1 }]);
    expect(Object.keys(f).some((k) => k.includes("[0]"))).toBe(true);
  });
});
