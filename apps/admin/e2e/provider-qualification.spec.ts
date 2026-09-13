import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  PROVIDER_QUALIFICATION_CONSENT_VERSION,
  PROVIDER_QUALIFICATION_MATERIAL_KIND,
  type AdminProviderQualificationDetail,
  type BountyProviderEligibility,
  type ProviderQualificationSummary,
} from "@petcare/shared-types";
import { expect, test, type APIResponse } from "@playwright/test";

// A public logo exercises real image validation without storing identity documents.
const material = readFileSync(
  new URL("../../miniapp/src/static/auth/petcare-logo.png", import.meta.url),
);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for qualification E2E`);
  }

  return value;
}

async function data<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);

  return (await response.json()).data as T;
}

async function failure(response: APIResponse, status: number, code?: string): Promise<void> {
  expect(response.status(), await response.text()).toBe(status);

  if (code) {
    expect((await response.json()).code).toBe(code);
  }
}

test("qualification ownership, private reads, independent review and revocation", async ({
  request,
}, info) => {
  const applicant = {
    Authorization: `Bearer ${requiredEnv(`QUALIFICATION_E2E_APPLICANT_TOKEN_${info.retry}`)}`,
  };
  const reviewer = {
    Authorization: `Bearer ${requiredEnv(`QUALIFICATION_E2E_REVIEWER_TOKEN_${info.retry}`)}`,
  };
  const login = await data<{ accessToken: string }>(
    await request.post("/api/auth/login/password", {
      data: {
        identifier: requiredEnv("DEFAULT_ADMIN_USERNAME"),
        password: requiredEnv("DEFAULT_ADMIN_PASSWORD"),
      },
    }),
  );
  const admin = { Authorization: `Bearer ${login.accessToken}` };
  const ownPath = "/api/provider-qualifications";
  const adminPath = "/api/admin/provider-qualifications";
  const consent = { accepted: true, consentVersion: PROVIDER_QUALIFICATION_CONSENT_VERSION };
  const approval = { decision: "approve", reason: "Isolated review evidence verified" };
  const verifiedApproval = {
    ...approval,
    verificationMethod: "isolated-e2e",
    verificationReference: `e2e-${randomUUID()}`,
  };
  const multipart = {
    file: { name: "non-personal-logo.png", mimeType: "image/png", buffer: material },
  };
  const idempotencyKey = randomUUID();

  await failure(await request.get(`${ownPath}/mine`), 401);
  const draft = await data<ProviderQualificationSummary>(
    await request.post(ownPath, {
      headers: applicant,
      data: { idempotencyKey },
    }),
  );

  expect(draft.status).toBe("draft");
  expect(
    await data(await request.post(ownPath, { headers: applicant, data: { idempotencyKey } })),
  ).toEqual(draft);
  await failure(
    await request.post(ownPath, { headers: applicant, data: { idempotencyKey: randomUUID() } }),
    409,
    "QUALIFICATION_ALREADY_ACTIVE",
  );
  const path = `${ownPath}/${draft.id}`;
  const reviewPath = `${adminPath}/${draft.id}`;
  const eligibility = async () =>
    data<BountyProviderEligibility>(
      await request.get("/api/bounties/provider-eligibility", { headers: applicant }),
    );

  expect((await eligibility()).eligible).toBe(false);

  await failure(
    await request.post(`${path}/materials/id-front`, { headers: reviewer, multipart }),
    404,
    "QUALIFICATION_NOT_FOUND",
  );
  await failure(
    await request.post(`${path}/submit`, { headers: reviewer, data: consent }),
    404,
    "QUALIFICATION_NOT_FOUND",
  );
  await failure(
    await request.post(`${path}/submit`, {
      headers: applicant,
      data: { ...consent, accepted: false },
    }),
    400,
    "QUALIFICATION_CONSENT_REQUIRED",
  );
  await failure(
    await request.post(`${path}/submit`, { headers: applicant, data: consent }),
    400,
    "QUALIFICATION_MATERIAL_INCOMPLETE",
  );
  await failure(
    await request.post(`${path}/materials/id-front`, {
      headers: applicant,
      multipart: {
        file: { name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("not an image") },
      },
    }),
    400,
  );

  await Promise.all(
    Object.values(PROVIDER_QUALIFICATION_MATERIAL_KIND).map(async (kind) => {
      const uploaded = await data<ProviderQualificationSummary>(
        await request.post(`${path}/materials/${kind}`, { headers: applicant, multipart }),
      );

      expect(uploaded.materialKinds).toContain(kind);
      expect(JSON.stringify(uploaded)).not.toContain("private/provider-qualifications/");
    }),
  );
  const pending = await data<ProviderQualificationSummary>(
    await request.post(`${path}/submit`, { headers: applicant, data: consent }),
  );

  expect(pending.status).toBe("pending");
  expect(
    await data(await request.post(`${path}/submit`, { headers: applicant, data: consent })),
  ).toEqual(pending);
  await failure(
    await request.post(`${path}/materials/training`, { headers: applicant, multipart }),
    409,
    "QUALIFICATION_STATE_CONFLICT",
  );

  await failure(await request.get(reviewPath, { headers: applicant }), 403);
  await failure(await request.get(`${reviewPath}/materials/id-front`), 401);
  await failure(await request.get(`${reviewPath}/materials/id-front`, { headers: applicant }), 403);
  await failure(await request.get(`${reviewPath}/materials/id-front`, { headers: reviewer }), 403);
  expect(
    (
      await data<AdminProviderQualificationDetail>(
        await request.get(reviewPath, { headers: reviewer }),
      )
    ).status,
  ).toBe("pending");
  const bytes = await request.get(`${reviewPath}/materials/id-front`, { headers: admin });

  expect(bytes.status()).toBe(200);
  expect(bytes.headers()["cache-control"]).toBe("no-store, private");
  expect(bytes.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await bytes.body()).toEqual(material);
  await failure(
    await request.post(`${reviewPath}/review`, { headers: applicant, data: verifiedApproval }),
    403,
  );
  await failure(
    await request.post(`${reviewPath}/review`, { headers: reviewer, data: approval }),
    400,
    "QUALIFICATION_VERIFICATION_REQUIRED",
  );
  expect((await eligibility()).eligible).toBe(false);

  const reviews = await Promise.all(
    [reviewer, admin].map((headers) =>
      request.post(`${reviewPath}/review`, { headers, data: verifiedApproval }),
    ),
  );
  const [success, conflict] = reviews.sort((left, right) => left.status() - right.status());

  await failure(conflict, 409, "QUALIFICATION_STATE_CONFLICT");
  const approved = await data<AdminProviderQualificationDetail>(success);

  expect(approved.status).toBe("approved");
  expect(approved.verificationReference).toBe(verifiedApproval.verificationReference);
  expect(approved.events.filter((event) => event.action === "submitted")).toHaveLength(1);
  expect(approved.events.filter((event) => event.action === "approved")).toHaveLength(1);
  expect(approved.events.some((event) => event.action === "read_id-front")).toBe(true);
  expect(JSON.stringify(approved)).not.toContain("private/provider-qualifications/");
  expect((await eligibility()).eligible).toBe(true);
  await failure(
    await request.post(`${reviewPath}/review`, { headers: reviewer, data: verifiedApproval }),
    409,
    "QUALIFICATION_STATE_CONFLICT",
  );
  const revoke = { reason: "Isolated revocation closes eligibility" };

  await failure(
    await request.post(`${reviewPath}/revoke`, { headers: reviewer, data: revoke }),
    403,
  );
  const revoked = await data<AdminProviderQualificationDetail>(
    await request.post(`${reviewPath}/revoke`, { headers: admin, data: revoke }),
  );

  expect(revoked.status).toBe("revoked");
  expect(revoked.events.filter((event) => event.action === "revoked")).toHaveLength(1);
  expect((await eligibility()).eligible).toBe(false);
  expect(
    await data<ProviderQualificationSummary[]>(
      await request.get(`${ownPath}/mine`, { headers: applicant }),
    ),
  ).toEqual([expect.objectContaining({ id: draft.id, status: "revoked" })]);
  await failure(
    await request.post(`${reviewPath}/revoke`, { headers: admin, data: revoke }),
    409,
    "QUALIFICATION_STATE_CONFLICT",
  );

  // Even an authorized reviewer cannot approve their own submitted application.
  const self = await data<ProviderQualificationSummary>(
    await request.post(ownPath, { headers: reviewer, data: { idempotencyKey: randomUUID() } }),
  );

  await Promise.all(
    Object.values(PROVIDER_QUALIFICATION_MATERIAL_KIND).map(async (kind) => {
      await data(
        await request.post(`${ownPath}/${self.id}/materials/${kind}`, {
          headers: reviewer,
          multipart,
        }),
      );
    }),
  );
  await data(
    await request.post(`${ownPath}/${self.id}/submit`, { headers: reviewer, data: consent }),
  );
  await failure(
    await request.post(`${adminPath}/${self.id}/review`, {
      headers: reviewer,
      data: verifiedApproval,
    }),
    403,
    "QUALIFICATION_SELF_REVIEW",
  );
});
