import type { Prisma } from "../generated/prisma/client";

/** Locks one user row for the current transaction and returns its account status. */
export async function lockUserRow(
  transaction: Pick<Prisma.TransactionClient, "$queryRaw">,
  userId: string,
): Promise<string | null> {
  const rows = await transaction.$queryRaw<Array<{ status: string }>>`
    SELECT "status"
    FROM "users"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;

  return rows[0]?.status ?? null;
}
