import { describe, it, expect } from "vitest";
import { evaluatePermission } from "@/types/domain";

describe("permission evaluation", () => {
  const userId = "u-1";
  const otherId = "u-2";

  it("grants full rights to the owner", () => {
    const p = evaluatePermission({ userId, ownerId: userId });
    expect(p).toEqual({
      canRead: true,
      canEdit: true,
      canDelete: true,
      canManageShares: true,
      role: "owner",
    });
  });

  it("grants read+edit but not delete/share-management to an editor", () => {
    const p = evaluatePermission({ userId, ownerId: otherId, sharePermission: "editor" });
    expect(p.canRead).toBe(true);
    expect(p.canEdit).toBe(true);
    expect(p.canDelete).toBe(false);
    expect(p.canManageShares).toBe(false);
    expect(p.role).toBe("editor");
  });

  it("grants read-only to a viewer and denies edit", () => {
    const p = evaluatePermission({ userId, ownerId: otherId, sharePermission: "viewer" });
    expect(p.canRead).toBe(true);
    expect(p.canEdit).toBe(false);
    expect(p.canDelete).toBe(false);
    expect(p.role).toBe("viewer");
  });

  it("denies all access to unshared users", () => {
    const p = evaluatePermission({ userId, ownerId: otherId, sharePermission: null });
    expect(p.canRead).toBe(false);
    expect(p.canEdit).toBe(false);
    expect(p.role).toBe("none");
  });
});
