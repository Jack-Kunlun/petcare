import type { Prisma } from "../generated/prisma/client";

/** Locks one user row and returns the account fields used by serialized mutations. */
export async function lockUserRow(
  transaction: Pick<Prisma.TransactionClient, "$queryRaw">,
  userId: string,
): Promise<{ status: string; phone: string | null } | null> {
  const rows = await transaction.$queryRaw<Array<{ status: string; phone: string | null }>>`
    SELECT "status", "phone"
    FROM "users"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;

  return rows[0] ?? null;
}
