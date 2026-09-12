import { ConfigService } from "./config.service";

function configure() {
  Object.assign(process.env, {
    QUALIFICATION_STORAGE_PROVIDER: "tencent-cos",
    QUALIFICATION_COS_BUCKET: "existing-private-1234567890",
    QUALIFICATION_COS_REGION: "ap-guangzhou",
    QUALIFICATION_COS_SECRET_ID: "scoped-id",
    QUALIFICATION_COS_SECRET_KEY: "scoped-secret",
    QUALIFICATION_COS_KMS_KEY_ID: "kms-id",
    TENCENT_COS_BUCKET: "public-1234567890",
  });
}

describe("qualification storage configuration", () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original, QUALIFICATION_STORAGE_PROVIDER: "disabled" };
  });
  afterEach(() => {
    process.env = original;
  });

  it("keeps an incomplete integration disabled", () => {
    process.env.QUALIFICATION_COS_BUCKET = "unfinished";
    expect(new ConfigService().qualificationStorage).toBeNull();
  });

  it("accepts independent credentials for the existing private bucket", () => {
    configure();
    expect(new ConfigService().qualificationStorage?.bucket).toBe("existing-private-1234567890");
  });

  it.each([
    "QUALIFICATION_COS_BUCKET",
    "QUALIFICATION_COS_REGION",
    "QUALIFICATION_COS_SECRET_ID",
    "QUALIFICATION_COS_SECRET_KEY",
    "QUALIFICATION_COS_KMS_KEY_ID",
  ])("fails closed when enabled but %s is missing", (name) => {
    configure();
    delete process.env[name];
    expect(() => new ConfigService().qualificationStorage).toThrow(name);
  });

  it("rejects reusing the known public bucket", () => {
    configure();
    process.env.QUALIFICATION_COS_BUCKET = process.env.TENCENT_COS_BUCKET;
    expect(() => new ConfigService().qualificationStorage).toThrow("public media bucket");
  });

  it("keeps the workflow closed until private storage is configured", () => {
    process.env.QUALIFICATION_WORKFLOW_ENABLED = "true";
    expect(() => new ConfigService().qualificationWorkflowEnabled).toThrow(
      "QUALIFICATION_STORAGE_PROVIDER",
    );

    configure();
    expect(new ConfigService().qualificationWorkflowEnabled).toBe(true);
  });
});
