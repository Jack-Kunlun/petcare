import { ConfigService } from "./config.service";

function configure() {
  Object.assign(process.env, {
    QUALIFICATION_STORAGE_PROVIDER: "tencent-cos",
    TENCENT_COS_BUCKET: "shared-1234567890",
    TENCENT_COS_REGION: "ap-guangzhou",
    TENCENT_COS_SECRET_ID: "shared-id",
    TENCENT_COS_SECRET_KEY: "shared-secret",
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
    process.env.TENCENT_COS_BUCKET = "unfinished";
    expect(new ConfigService().qualificationStorage).toBeNull();
  });

  it("uses the existing COS bucket and credentials with a private object prefix", () => {
    configure();
    expect(new ConfigService().qualificationStorage).toEqual({
      bucket: "shared-1234567890",
      region: "ap-guangzhou",
      secretId: "shared-id",
      secretKey: "shared-secret",
    });
  });

  it.each([
    "TENCENT_COS_BUCKET",
    "TENCENT_COS_REGION",
    "TENCENT_COS_SECRET_ID",
    "TENCENT_COS_SECRET_KEY",
  ])("fails closed when enabled but %s is missing", (name) => {
    configure();
    delete process.env[name];
    expect(() => new ConfigService().qualificationStorage).toThrow(name);
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
