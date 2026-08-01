import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  assertDisposableAdminSchema,
  createAdminE2eSchemaName,
  runWithIsolatedAdminSchema,
  shouldLoadLocalEnvironment,
  startApplicationServers,
} from "../apps/admin/e2e/run-e2e.mjs";

const repositoryDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminDirectory = path.join(repositoryDirectory, "apps", "admin");
const signalFixture = path.join(repositoryDirectory, "scripts", "fixtures", "admin-e2e-signal.mjs");

test("标准 Admin E2E 命令固定进入版本控制内的隔离 runner", async () => {
  const packageJson = JSON.parse(await readFile(path.join(adminDirectory, "package.json"), "utf8"));

  assert.match(packageJson.scripts["test:e2e"], /e2e\/run-e2e\.mjs/u);
});

test("本地读取仓库 .env，CI 只使用注入的环境变量", () => {
  assert.equal(shouldLoadLocalEnvironment({}), true);
  assert.equal(shouldLoadLocalEnvironment({ CI: "true" }), false);
});

test("生成的 Admin E2E schema 唯一且绝不允许 public", () => {
  const first = createAdminE2eSchemaName({ processId: 42, now: 1000, nonce: "aaaaaa" });
  const second = createAdminE2eSchemaName({ processId: 42, now: 1000, nonce: "bbbbbb" });

  assert.equal(first, "admin_e2e_42_1000_aaaaaa");
  assert.notEqual(first, second);
  assert.doesNotThrow(() => assertDisposableAdminSchema(first));
  assert.throws(() => assertDisposableAdminSchema("public"), /disposable schema/u);
});

test("push 或 Playwright 失败仍执行 DROP IF EXISTS，并保留原始失败", async () => {
  for (const failurePoint of ["push", "playwright"]) {
    const calls = [];
    const expected = new Error(`${failurePoint} failed`);

    await assert.rejects(
      runWithIsolatedAdminSchema({
        schemaName: "admin_e2e_42_1000_aaaaaa",
        baseEnv: { DB_SCHEMA: "public" },
        pushSchema: async (env) => {
          calls.push(["push", env.DB_SCHEMA]);
          if (failurePoint === "push") throw expected;
        },
        seedSchema: async (env) => calls.push(["seed", env.DB_SCHEMA]),
        startServers: async (env) => {
          calls.push(["start", env.DB_SCHEMA]);
          return async () => calls.push(["close", env.DB_SCHEMA]);
        },
        runPlaywright: async (env) => {
          calls.push(["playwright", env.DB_SCHEMA]);
          if (failurePoint === "playwright") throw expected;
          return 0;
        },
        dropSchema: async (schemaName, env) =>
          calls.push(["drop-if-exists", schemaName, env.DB_SCHEMA]),
      }),
      expected,
    );

    assert.deepEqual(calls.at(-1), [
      "drop-if-exists",
      "admin_e2e_42_1000_aaaaaa",
      "admin_e2e_42_1000_aaaaaa",
    ]);
  }
});

test("成功时按 push、seed、start、Playwright、close、drop 顺序完成完整生命周期", async () => {
  const calls = [];
  const result = await runWithIsolatedAdminSchema({
    schemaName: "admin_e2e_42_1000_aaaaaa",
    baseEnv: {},
    pushSchema: async () => calls.push("push"),
    seedSchema: async () => calls.push("seed"),
    startServers: async () => {
      calls.push("start");
      return async () => calls.push("close");
    },
    runPlaywright: async () => {
      calls.push("playwright");
      return 0;
    },
    dropSchema: async () => calls.push("drop-if-exists"),
  });

  assert.equal(result, 0);
  assert.deepEqual(calls, ["push", "seed", "start", "playwright", "close", "drop-if-exists"]);
});

test("服务关闭失败仍执行 DROP IF EXISTS", async () => {
  const calls = [];
  const closeError = new Error("close failed");

  await assert.rejects(
    runWithIsolatedAdminSchema({
      schemaName: "admin_e2e_42_1000_aaaaaa",
      baseEnv: {},
      pushSchema: async () => calls.push("push"),
      seedSchema: async () => calls.push("seed"),
      startServers: async () => async () => {
        calls.push("close");
        throw closeError;
      },
      runPlaywright: async () => 0,
      dropSchema: async () => calls.push("drop-if-exists"),
    }),
    closeError,
  );

  assert.deepEqual(calls.at(-2), "close");
  assert.deepEqual(calls.at(-1), "drop-if-exists");
});

for (const [processSignal, expectedCode] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  test(`${processSignal} 会等待 close 与 drop 完成后按信号语义退出`, async () => {
    const child = fork(signalFixture, { silent: true });
    const messages = [];

    child.on("message", (message) => messages.push(message));
    const [ready] = await once(child, "message");

    assert.equal(ready, "ready");
    child.send(processSignal);

    const [exitCode, signal] = await once(child, "exit");

    assert.equal(signal, null);
    assert.equal(exitCode, expectedCode);
    assert.deepEqual(messages, ["ready", "close", "drop"]);
  });
}

test("应用部分启动失败时继续关闭全部进程并聚合启动与清理错误", async () => {
  const startupError = new Error("Admin failed to become ready");
  const stopError = new Error("Admin failed to stop");
  const server = { name: "server" };
  const admin = { name: "admin" };
  const children = [server, admin];
  const stopped = [];
  let readinessChecks = 0;

  await assert.rejects(
    startApplicationServers(
      {
        ADMIN_E2E_SERVER_PORT: "3001",
        ADMIN_E2E_ADMIN_PORT: "8987",
      },
      undefined,
      {
        spawnProcess: () => children.shift(),
        waitForServer: async () => {
          readinessChecks += 1;
          if (readinessChecks === 2) {
            throw startupError;
          }
        },
        stopChild: async (child) => {
          stopped.push(child.name);
          if (child === admin) {
            throw stopError;
          }
        },
      },
    ),
    (error) => {
      assert(error instanceof AggregateError);
      assert.deepEqual(error.errors, [startupError, stopError]);
      assert.equal(error.cause, startupError);
      return true;
    },
  );

  assert.deepEqual(stopped, ["admin", "server"]);
});
