import assert from "node:assert/strict";
import { fork, spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { connect } from "node:net";
import process from "node:process";
import test from "node:test";
import { setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import path from "node:path";

/* global AbortController */
import {
  assertDisposableAdminSchema,
  createAdminE2eSchemaName,
  resolveAdminE2eDatabaseHost,
  runWithIsolatedAdminSchema,
  shouldLoadLocalEnvironment,
  startApplicationServers,
  stopProcess,
} from "../apps/admin/e2e/run-e2e.mjs";

const repositoryDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminDirectory = path.join(repositoryDirectory, "apps", "admin");
const signalFixture = path.join(repositoryDirectory, "scripts", "fixtures", "admin-e2e-signal.mjs");
const treeFixture = path.join(
  repositoryDirectory,
  "scripts",
  "fixtures",
  "admin-e2e-tree-root.mjs",
);

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function processExists(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntil(predicate, timeoutMilliseconds = 5_000) {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return false;
}

async function forceKillTestProcess(processId) {
  if (!Number.isInteger(processId) || processId <= 0) {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(processId), "/T", "/F"], {
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });

    await once(killer, "exit");
    return;
  }

  try {
    process.kill(-processId, "SIGKILL");
  } catch (groupError) {
    if (groupError?.code !== "ESRCH" && groupError?.code !== "EPERM") {
      throw groupError;
    }

    // The detached group may already have disappeared or its numeric id may have been reused.
    // Fall back to the owned root PID before deciding whether cleanup actually failed.
    try {
      process.kill(processId, "SIGKILL");
    } catch (processError) {
      if (processError?.code !== "ESRCH") {
        throw processError;
      }
    }
  }
}

test("标准 Admin E2E 命令固定进入版本控制内的隔离 runner", async () => {
  const packageJson = JSON.parse(await readFile(path.join(adminDirectory, "package.json"), "utf8"));

  assert.match(packageJson.scripts["test:e2e"], /e2e\/run-e2e\.mjs/u);
  assert.match(
    packageJson.scripts["test:e2e:classroom"],
    /e2e\/run-e2e\.mjs classroom-content\.spec\.ts/u,
  );
  assert.match(
    packageJson.scripts["test:e2e:community"],
    /e2e\/run-e2e\.mjs community-content\.spec\.ts/u,
  );
  assert.match(packageJson.scripts["test:e2e:pets"], /e2e\/run-e2e\.mjs pet-profile\.spec\.ts/u);
});

test("本地读取仓库 .env，CI 只使用注入的环境变量", () => {
  assert.equal(shouldLoadLocalEnvironment({}), true);
  assert.equal(shouldLoadLocalEnvironment({ CI: "true" }), false);
});

test("Windows E2E 将 localhost 数据库固定到 IPv4 loopback", () => {
  assert.equal(resolveAdminE2eDatabaseHost(" localhost "), "127.0.0.1");
  assert.equal(resolveAdminE2eDatabaseHost("postgres"), "postgres");
  assert.equal(resolveAdminE2eDatabaseHost(undefined), undefined);
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
  // Windows child.kill(SIGINT/SIGTERM) force-terminates the process instead of invoking
  // its console signal handler. The production process.on path is exercised with real
  // parent-sent OS signals on POSIX; Windows tree cleanup is verified separately below.
  test(
    `${processSignal} 会等待 close 与 drop 完成、清除进程树后按信号语义退出`,
    {
      skip:
        process.platform === "win32"
          ? "Windows child.kill(signal) 使用强制终止，不能验证 Ctrl+C process handler"
          : false,
    },
    async () => {
      const child = fork(signalFixture, { silent: true });
      const messages = [];
      let tree;

      child.on("message", (message) => messages.push(message));
      const [ready] = await once(child, "message");

      try {
        assert.equal(ready.type, "ready");
        tree = ready;
        assert.equal(await canConnect(ready.port), true);
        child.kill(processSignal);

        const [exitCode, signal] = await once(child, "exit");

        assert.equal(signal, null);
        assert.equal(exitCode, expectedCode);
        assert.deepEqual(
          messages.map((message) => (typeof message === "string" ? message : message.type)),
          ["ready", "close", "drop"],
        );
        assert.equal(await waitUntil(async () => !(await canConnect(ready.port))), true);
        assert.equal(await waitUntil(() => !processExists(ready.descendantPid)), true);
      } finally {
        if (!child.killed && child.exitCode === null) {
          child.kill("SIGKILL");
        }
        await forceKillTestProcess(tree?.rootPid);
        await forceKillTestProcess(tree?.descendantPid);
      }
    },
  );
}

test("受控关闭会清除真实子孙进程及其监听端口", async () => {
  const treeRoot = fork(treeFixture, {
    detached: process.platform !== "win32",
    silent: true,
  });
  let tree;

  try {
    [tree] = await once(treeRoot, "message");
    assert.equal(tree.type, "tree-ready");
    assert.equal(await canConnect(tree.port), true);

    await stopProcess(treeRoot);

    assert.equal(
      await waitUntil(async () => !(await canConnect(tree.port))),
      true,
      "descendant listener port should close",
    );
    assert.equal(
      await waitUntil(() => !processExists(tree.descendantPid)),
      true,
      "descendant process should exit",
    );
  } finally {
    await forceKillTestProcess(treeRoot.pid);
    await forceKillTestProcess(tree?.descendantPid);
  }
});

test("应用关闭会清除四棵真实进程树及监听端口", async () => {
  const roots = [];
  let trees = [];

  try {
    const close = await startApplicationServers(
      {
        ADMIN_E2E_SERVER_PORT: "3001",
        ADMIN_E2E_ADMIN_PORT: "8987",
        ADMIN_E2E_MINIAPP_PORT: "4322",
        ADMIN_E2E_WEBSITE_PORT: "8081",
      },
      undefined,
      {
        spawnProcess: () => {
          const root = fork(treeFixture, {
            detached: process.platform !== "win32",
            silent: true,
          });

          roots.push(root);
          return root;
        },
        waitForServer: async (_label, _url, root) => {
          trees.push((await once(root, "message"))[0]);
        },
      },
    );

    await assert.doesNotReject(close);
    assert.equal(
      await waitUntil(async () =>
        (await Promise.all(trees.map((tree) => canConnect(tree.port)))).every(
          (connected) => !connected,
        ),
      ),
      true,
      "all descendant listener ports should close",
    );
    assert.equal(
      await waitUntil(() => trees.every((tree) => !processExists(tree.descendantPid))),
      true,
      "all descendant processes should exit",
    );
  } finally {
    await Promise.allSettled(roots.map((root) => forceKillTestProcess(root.pid)));
    await Promise.allSettled(trees.map((tree) => forceKillTestProcess(tree.descendantPid)));
  }
});

test("受管进程已正常退出时 stopProcess 是幂等 no-op", async () => {
  await assert.doesNotReject(
    stopProcess({
      exitCode: 0,
      signalCode: null,
    }),
  );
});

test("POSIX 受管根进程退出后不再向无权限的旧进程组发信号", async () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  const originalKill = process.kill;
  const child = {
    pid: 424_242,
    exitCode: null,
    signalCode: null,
  };

  try {
    Object.defineProperty(process, "platform", { ...platformDescriptor, value: "linux" });
    process.kill = (_processId, signal) => {
      if (signal === "SIGTERM") {
        child.exitCode = 0;
        return true;
      }

      const error = new Error("operation not permitted");
      error.code = "EPERM";
      throw error;
    };

    await assert.doesNotReject(stopProcess(child));
  } finally {
    process.kill = originalKill;
    Object.defineProperty(process, "platform", platformDescriptor);
  }
});

test("POSIX fixture 强制清理对已消失的进程组和 PID 可重复执行", async () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  const originalKill = process.kill;
  const attempts = [];

  try {
    Object.defineProperty(process, "platform", { ...platformDescriptor, value: "linux" });
    process.kill = (processId, signal) => {
      attempts.push([processId, signal]);
      const error = new Error("no such process");
      error.code = "ESRCH";
      throw error;
    };

    await assert.doesNotReject(async () => {
      await forceKillTestProcess(424_242);
      await forceKillTestProcess(424_242);
    });
    assert.deepEqual(attempts, [
      [-424_242, "SIGKILL"],
      [424_242, "SIGKILL"],
      [-424_242, "SIGKILL"],
      [424_242, "SIGKILL"],
    ]);
  } finally {
    process.kill = originalKill;
    Object.defineProperty(process, "platform", platformDescriptor);
  }
});

test("POSIX fixture 强制清理保留非 ESRCH 错误", async () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  const originalKill = process.kill;

  try {
    Object.defineProperty(process, "platform", { ...platformDescriptor, value: "linux" });
    process.kill = () => {
      const error = new Error("operation not permitted");
      error.code = "EPERM";
      throw error;
    };

    await assert.rejects(forceKillTestProcess(424_242), { code: "EPERM" });
  } finally {
    process.kill = originalKill;
    Object.defineProperty(process, "platform", platformDescriptor);
  }
});

test("应用部分启动失败时继续关闭全部进程并聚合启动与清理错误", async () => {
  const startupError = new Error("Miniapp failed to become ready");
  const stopError = new Error("Miniapp failed to stop");
  const server = { name: "server" };
  const website = { name: "website" };
  const admin = { name: "admin" };
  const miniapp = { name: "miniapp" };
  const children = [server, website, admin, miniapp];
  const stopped = [];
  let readinessChecks = 0;

  await assert.rejects(
    startApplicationServers(
      {
        ADMIN_E2E_SERVER_PORT: "3001",
        ADMIN_E2E_ADMIN_PORT: "8987",
        ADMIN_E2E_MINIAPP_PORT: "4322",
        ADMIN_E2E_WEBSITE_PORT: "8081",
      },
      undefined,
      {
        spawnProcess: () => children.shift(),
        waitForServer: async () => {
          readinessChecks += 1;
          if (readinessChecks === 4) {
            throw startupError;
          }
        },
        stopChild: async (child) => {
          stopped.push(child.name);
          if (child === miniapp) {
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

  assert.deepEqual(stopped, ["miniapp", "admin", "website", "server"]);
});

test("Website startup failure closes Website and Server in reverse order", async () => {
  const startupError = new Error("Website failed to become ready");
  const server = { name: "server" };
  const website = { name: "website" };
  const admin = { name: "admin" };
  const children = [server, website, admin];
  const readinessLabels = [];
  const readinessUrls = [];
  const stopped = [];

  await assert.rejects(
    startApplicationServers(
      {
        ADMIN_E2E_SERVER_PORT: "3001",
        ADMIN_E2E_ADMIN_PORT: "8987",
        ADMIN_E2E_MINIAPP_PORT: "4322",
        ADMIN_E2E_WEBSITE_PORT: "8081",
      },
      undefined,
      {
        spawnProcess: () => children.shift(),
        waitForServer: async (label, url) => {
          readinessLabels.push(label);
          readinessUrls.push(url);
          if (label === "Website") throw startupError;
        },
        stopChild: async (child) => stopped.push(child.name),
      },
    ),
    startupError,
  );

  assert.deepEqual(readinessLabels, ["Server", "Website"]);
  assert.deepEqual(readinessUrls, [
    "http://127.0.0.1:3001/health",
    "http://127.0.0.1:8081/healthz",
  ]);
  assert.deepEqual(stopped, ["website", "server"]);
});

test("Website participates in signal-safe isolated lifecycle cleanup", async () => {
  const controller = new AbortController();
  const interruption = new Error("interrupted after all application servers started");
  const server = { name: "server" };
  const website = { name: "website" };
  const admin = { name: "admin" };
  const miniapp = { name: "miniapp" };
  const children = [server, website, admin, miniapp];
  const stopped = [];

  await assert.rejects(
    runWithIsolatedAdminSchema({
      schemaName: "admin_e2e_42_1000_aaaaaa",
      baseEnv: {
        ADMIN_E2E_SERVER_PORT: "3001",
        ADMIN_E2E_ADMIN_PORT: "8987",
        ADMIN_E2E_MINIAPP_PORT: "4322",
        ADMIN_E2E_WEBSITE_PORT: "8081",
      },
      signal: controller.signal,
      pushSchema: async () => {},
      seedSchema: async () => {},
      startServers: (environment, signal) =>
        startApplicationServers(environment, signal, {
          spawnProcess: () => children.shift(),
          waitForServer: async () => {},
          stopChild: async (child) => stopped.push(child.name),
        }),
      runPlaywright: async () => {
        controller.abort(interruption);
        throw interruption;
      },
      dropSchema: async () => {},
    }),
    interruption,
  );

  assert.deepEqual(stopped, ["miniapp", "admin", "website", "server"]);
});
