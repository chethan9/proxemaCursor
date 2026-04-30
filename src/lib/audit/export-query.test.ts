import { describe, expect, it } from "vitest";
import { buildActivityExportParams } from "./export-query";

describe("buildActivityExportParams", () => {
  it("includes filters", () => {
    const p = buildActivityExportParams(
      {
        action: "order.updated",
        module: "sites",
        clientId: "c1",
        search: "foo",
        from: "2025-01-01T00:00:00.000Z",
      },
      { actorUserId: "u1" }
    );
    expect(p.get("action")).toBe("order.updated");
    expect(p.get("module")).toBe("sites");
    expect(p.get("client_id")).toBe("c1");
    expect(p.get("search")).toBe("foo");
    expect(p.get("actor_user_id")).toBe("u1");
    expect(p.get("from")).toBe("2025-01-01T00:00:00.000Z");
  });
});
