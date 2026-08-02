import {
  buildDropSchemaIfExistsStatement,
  IsolatedPostgresSchemaLifecycle,
} from "./support/isolated-postgres-schema";

describe("IsolatedPostgresSchemaLifecycle", () => {
  it("初始化已部分创建 schema 后失败，仍 drop 并恢复所有环境变量", async () => {
    const environment: NodeJS.ProcessEnv = {
      DB_SCHEMA: "public",
      JWT_SECRET: "original-secret",
      NODE_ENV: "development",
    };
    const calls: string[] = [];
    const failure = new Error("db push failed after partial creation");
    const lifecycle = new IsolatedPostgresSchemaLifecycle({
      schemaName: "system_settings_e2e_42_1000",
      environment,
      overrides: { JWT_SECRET: "e2e-secret", NODE_ENV: "test" },
      initialize: async () => {
        calls.push(`push:${environment.DB_SCHEMA}`);
        throw failure;
      },
      close: async () => calls.push("close"),
      drop: async (schemaName) => calls.push(`drop-if-exists:${schemaName}`),
    });

    await expect(lifecycle.setup()).rejects.toBe(failure);
    expect(calls).toEqual([
      "push:system_settings_e2e_42_1000",
      "close",
      "drop-if-exists:system_settings_e2e_42_1000",
    ]);
    expect(environment).toEqual({
      DB_SCHEMA: "public",
      JWT_SECRET: "original-secret",
      NODE_ENV: "development",
    });
  });

  it("关闭应用失败也继续 drop，恢复环境后报告关闭错误", async () => {
    const environment: NodeJS.ProcessEnv = {};
    const calls: string[] = [];
    const closeFailure = new Error("app close failed");
    const lifecycle = new IsolatedPostgresSchemaLifecycle({
      schemaName: "system_settings_e2e_42_1000",
      environment,
      overrides: { JWT_SECRET: "e2e-secret", NODE_ENV: "test" },
      initialize: async () => calls.push("push"),
      close: async () => {
        calls.push("close");
        throw closeFailure;
      },
      drop: async (schemaName) => calls.push(`drop-if-exists:${schemaName}`),
    });

    await lifecycle.setup();
    await expect(lifecycle.teardown()).rejects.toBe(closeFailure);
    expect(calls).toEqual(["push", "close", "drop-if-exists:system_settings_e2e_42_1000"]);
    expect(environment.DB_SCHEMA).toBeUndefined();
    expect(environment.JWT_SECRET).toBeUndefined();
    expect(environment.NODE_ENV).toBeUndefined();
  });

  it("DROP 语句只接受约定前缀并始终使用 IF EXISTS", () => {
    expect(buildDropSchemaIfExistsStatement("system_settings_e2e_42_1000")).toBe(
      'DROP SCHEMA IF EXISTS "system_settings_e2e_42_1000" CASCADE',
    );
    expect(() => buildDropSchemaIfExistsStatement("public")).toThrow(
      "requires an isolated disposable schema",
    );
    expect(() => buildDropSchemaIfExistsStatement("system_settings_e2e_42_1000;DROP")).toThrow(
      "requires an isolated disposable schema",
    );
  });
});
