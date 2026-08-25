import type { Prisma } from "../generated/prisma/client";
import { lockUserRow } from "./user-row-lock";

describe("lockUserRow", () => {
  it("binds the user id separately and returns the locked account state", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ status: "active", phone: "13800138000" }]);
    const transaction = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;

    await expect(lockUserRow(transaction, "user-1")).resolves.toEqual({
      status: "active",
      phone: "13800138000",
    });

    const [sql, userId] = queryRaw.mock.calls[0] as [TemplateStringsArray, string];

    expect(sql.join(" ")).toContain('SELECT "status", "phone"');
    expect(sql.join("?")).toContain('WHERE "id" = ?');
    expect(sql.join(" ")).toContain("FOR UPDATE");
    expect(sql.join("")).not.toContain("user-1");
    expect(userId).toBe("user-1");
  });
});
