import type { Prisma } from "../generated/prisma/client";
import { lockUserRow } from "./user-row-lock";

describe("lockUserRow", () => {
  it("binds the user id separately in a FOR UPDATE query and returns status", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ status: "active" }]);
    const transaction = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;

    await expect(lockUserRow(transaction, "user-1")).resolves.toBe("active");

    const [sql, userId] = queryRaw.mock.calls[0] as [TemplateStringsArray, string];

    expect(sql.join("?")).toContain('WHERE "id" = ?');
    expect(sql.join(" ")).toContain("FOR UPDATE");
    expect(sql.join("")).not.toContain("user-1");
    expect(userId).toBe("user-1");
  });
});
