import { spawn } from "node:child_process";
import console from "node:console";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const adminDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDirectory = path.resolve(adminDirectory, "../server");
const repositoryDirectory = path.resolve(adminDirectory, "../..");
const serverRequire = createRequire(path.join(serverDirectory, "package.json"));
const rbacRestrictedAdmin = {
  username: "rbac-e2e-restricted-admin",
  password: "Rbac-E2e-Restricted-Admin-2026!",
  phone: "13900000091",
};

function findLocalEnvironmentFile() {
  const worktreeEnvironment = path.join(repositoryDirectory, ".env");

  if (existsSync(worktreeEnvironment)) {
    return worktreeEnvironment;
  }

  const dotGitPath = path.join(repositoryDirectory, ".git");

  if (!existsSync(dotGitPath)) {
    return null;
  }

  const dotGit = readFileSync(dotGitPath, "utf8").trim();

  if (!dotGit.startsWith("gitdir:")) {
    return null;
  }

  const worktreeGitDirectory = path.resolve(
    repositoryDirectory,
    dotGit.slice("gitdir:".length).trim(),
  );
  const commonDirectoryPath = path.join(worktreeGitDirectory, "commondir");

  if (!existsSync(commonDirectoryPath)) {
    return null;
  }

  const commonGitDirectory = path.resolve(
    worktreeGitDirectory,
    readFileSync(commonDirectoryPath, "utf8").trim(),
  );
  const mainWorktreeEnvironment = path.join(path.dirname(commonGitDirectory), ".env");

  return existsSync(mainWorktreeEnvironment) ? mainWorktreeEnvironment : null;
}

function loadLocalEnvironment() {
  const environmentFile = findLocalEnvironmentFile();

  if (environmentFile) {
    process.loadEnvFile(environmentFile);
  }
}

export function shouldLoadLocalEnvironment(env) {
  return !env.CI;
}

export function createAdminE2eSchemaName({
  processId = process.pid,
  now = Date.now(),
  nonce = randomBytes(3).toString("hex"),
} = {}) {
  return `admin_e2e_${processId}_${now}_${nonce}`;
}

export function assertDisposableAdminSchema(schemaName) {
  if (!/^admin_e2e_\d+_\d+_[a-f\d]{6}$/u.test(schemaName) || schemaName === "public") {
    throw new Error("Admin E2E requires a unique disposable schema");
  }
}

const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 };

export class AdminE2eInterruptedError extends Error {
  constructor(signal) {
    super(`Admin E2E interrupted by ${signal}`);
    this.name = "AdminE2eInterruptedError";
    this.signal = signal;
  }
}

export async function runWithProcessSignalHandling(operation, runtime = process) {
  const controller = new globalThis.AbortController();
  let receivedSignal = null;
  const handlers = Object.fromEntries(
    Object.keys(SIGNAL_EXIT_CODES).map((signal) => [
      signal,
      () => {
        if (receivedSignal) {
          return;
        }

        receivedSignal = signal;
        controller.abort(new AdminE2eInterruptedError(signal));
      },
    ]),
  );

  for (const [signal, handler] of Object.entries(handlers)) {
    runtime.on(signal, handler);
  }

  try {
    const result = await operation(controller.signal);

    return receivedSignal ? SIGNAL_EXIT_CODES[receivedSignal] : result;
  } catch (error) {
    if (receivedSignal && error === controller.signal.reason) {
      return SIGNAL_EXIT_CODES[receivedSignal];
    }

    throw error;
  } finally {
    for (const [signal, handler] of Object.entries(handlers)) {
      runtime.off(signal, handler);
    }
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason;
  }
}

export async function runWithIsolatedAdminSchema({
  schemaName,
  baseEnv,
  pushSchema,
  seedSchema,
  startServers,
  runPlaywright,
  dropSchema,
  signal,
}) {
  assertDisposableAdminSchema(schemaName);
  const isolatedEnv = { ...baseEnv, DB_SCHEMA: schemaName };
  let primaryError;
  let result;
  let closeServers;

  try {
    throwIfAborted(signal);
    await pushSchema(isolatedEnv, signal);
    throwIfAborted(signal);
    await seedSchema(isolatedEnv, signal);
    throwIfAborted(signal);
    closeServers = await startServers(isolatedEnv, signal);
    throwIfAborted(signal);
    result = await runPlaywright(isolatedEnv, signal);
  } catch (error) {
    primaryError = error;
  }

  const cleanupErrors = [];

  if (closeServers) {
    try {
      await closeServers();
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError);
    }
  }

  try {
    await dropSchema(schemaName, isolatedEnv);
  } catch (cleanupError) {
    cleanupErrors.push(cleanupError);
  }

  if (primaryError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      "Admin E2E failed and its disposable resources cleanup also failed",
      { cause: primaryError },
    );
  }

  if (primaryError) {
    throw primaryError;
  }

  if (cleanupErrors.length === 1) {
    throw cleanupErrors[0];
  }

  if (cleanupErrors.length > 1) {
    throw new AggregateError(cleanupErrors, "Admin E2E disposable resources cleanup failed");
  }

  return result;
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Admin E2E could not allocate an isolated port"));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForProcessExit(child, timeoutMilliseconds) {
  if (hasExited(child)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMilliseconds);

    child.once("exit", onExit);
  });
}

function requireProcessId(child) {
  if (!Number.isInteger(child.pid) || child.pid <= 0) {
    throw new Error("Admin E2E cannot stop a child process without a valid PID");
  }

  return child.pid;
}

function waitForProcessGroupExit(processId, timeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;

  return new Promise((resolve) => {
    const check = () => {
      try {
        process.kill(-processId, 0);
      } catch (error) {
        if (error?.code === "ESRCH") {
          resolve(true);
          return;
        }

        resolve(false);
        return;
      }

      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }

      setTimeout(check, 50);
    };

    check();
  });
}

function signalProcessGroup(processId, signal) {
  try {
    process.kill(-processId, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
}

function taskkillProcessTree(processId) {
  return new Promise((resolve, reject) => {
    const killer = spawn("taskkill.exe", ["/PID", String(processId), "/T", "/F"], {
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });

    killer.once("error", () => reject(new Error("Admin E2E could not start taskkill.exe")));
    killer.once("exit", (code) => resolve(code ?? 1));
  });
}

export async function stopProcess(child) {
  if (hasExited(child)) {
    return;
  }

  const processId = requireProcessId(child);

  if (process.platform === "win32") {
    const exitCode = await taskkillProcessTree(processId);
    const stopped = await waitForProcessExit(child, 5_000);

    if (exitCode !== 0 && !stopped) {
      throw new Error(`Admin E2E taskkill.exe failed with exit code ${exitCode}`);
    }

    if (!stopped) {
      throw new Error("Admin E2E taskkill.exe did not stop its process tree");
    }

    return;
  }

  signalProcessGroup(processId, "SIGTERM");

  if (await waitForProcessGroupExit(processId, 3_000)) {
    return;
  }

  signalProcessGroup(processId, "SIGKILL");

  if (!(await waitForProcessGroupExit(processId, 5_000))) {
    throw new Error("Admin E2E could not stop an isolated process tree");
  }
}

async function waitForHttpServer(label, url, child, signal) {
  const deadline = Date.now() + 45_000;
  let startupError;

  child.once("error", (error) => {
    startupError = error;
  });

  while (Date.now() < deadline) {
    throwIfAborted(signal);

    if (startupError || hasExited(child)) {
      throw new Error(`${label} stopped before becoming ready`);
    }

    try {
      const response = await globalThis.fetch(url, {
        signal: globalThis.AbortSignal.timeout(1_000),
      });

      if (response.ok) {
        return;
      }
    } catch {
      // The process is still starting; retry until the bounded deadline.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`${label} did not become ready within 45 seconds`);
}

export async function startApplicationServers(
  env,
  signal,
  { spawnProcess = spawn, waitForServer = waitForHttpServer, stopChild = stopProcess } = {},
) {
  const serverPort = requireEnvironmentValue(env, "ADMIN_E2E_SERVER_PORT");
  const adminPort = requireEnvironmentValue(env, "ADMIN_E2E_ADMIN_PORT");
  const viteCli = path.join(adminDirectory, "node_modules", "vite", "bin", "vite.js");
  const children = [];

  try {
    const server = spawnProcess(process.execPath, [path.join(serverDirectory, "dist", "main.js")], {
      cwd: serverDirectory,
      detached: process.platform !== "win32",
      env,
      shell: false,
      stdio: "inherit",
    });

    children.push(server);
    await waitForServer("Server", `http://127.0.0.1:${serverPort}/health`, server, signal);

    const admin = spawnProcess(
      process.execPath,
      [
        viteCli,
        "--host",
        "127.0.0.1",
        "--port",
        adminPort,
        "--strictPort",
        "--configLoader",
        "runner",
      ],
      {
        cwd: adminDirectory,
        detached: process.platform !== "win32",
        env,
        shell: false,
        stdio: "inherit",
      },
    );

    children.push(admin);
    await waitForServer("Admin", `http://127.0.0.1:${adminPort}`, admin, signal);
  } catch (error) {
    const cleanupResults = await Promise.allSettled(children.toReversed().map(stopChild));
    const cleanupErrors = cleanupResults
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "Admin E2E application server startup and cleanup both failed",
        { cause: error },
      );
    }

    throw error;
  }

  return async () => {
    const results = await Promise.allSettled(children.toReversed().map(stopChild));
    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (errors.length === 1) {
      throw errors[0];
    }

    if (errors.length > 1) {
      throw new AggregateError(errors, "Admin E2E application servers failed to stop");
    }
  };
}

function runCommand(label, executable, args, options, abortSignal) {
  return new Promise((resolve, reject) => {
    throwIfAborted(abortSignal);
    const child = spawn(executable, args, {
      ...options,
      detached: process.platform !== "win32",
      shell: false,
      stdio: options.stdio ?? "inherit",
    });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      abortSignal?.removeEventListener("abort", onAbort);
      callback(value);
    };
    const onAbort = () => {
      void stopProcess(child).catch((stopError) => {
        finish(
          reject,
          new AggregateError(
            [abortSignal.reason, stopError],
            `${label} interruption could not stop its child process`,
            { cause: abortSignal.reason },
          ),
        );
      });
    };

    abortSignal?.addEventListener("abort", onAbort, { once: true });
    child.once("error", () => finish(reject, new Error(`${label} could not start`)));
    child.once("exit", (code, exitSignal) => {
      if (abortSignal?.aborted) {
        finish(reject, abortSignal.reason);
        return;
      }

      if (exitSignal) {
        finish(reject, new Error(`${label} stopped by signal ${exitSignal}`));
        return;
      }

      finish(resolve, code ?? 1);
    });
  });
}

function requireEnvironmentValue(env, name) {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`Admin E2E requires ${name}`);
  }

  return value;
}

function createDatabaseUrl(env) {
  const host = requireEnvironmentValue(env, "DB_HOST");
  const port = requireEnvironmentValue(env, "DB_PORT");
  const username = requireEnvironmentValue(env, "DB_USERNAME");
  const password = requireEnvironmentValue(env, "DB_PASSWORD");
  const database = requireEnvironmentValue(env, "DB_NAME");
  const url = new URL(`postgresql://${host}:${port}/${database}`);

  url.username = username;
  url.password = password;
  return url.toString();
}

async function buildServerForE2e(env, signal) {
  const typescriptCli = path.join(repositoryDirectory, "node_modules", "typescript", "bin", "tsc");
  const nestCli = path.join(serverDirectory, "node_modules", "@nestjs", "cli", "bin", "nest.js");
  const silentOptions = { env, stdio: "ignore" };

  await requireSuccessfulCommand(
    "shared-types build",
    process.execPath,
    [
      typescriptCli,
      "-p",
      path.join(repositoryDirectory, "packages", "shared-types", "tsconfig.json"),
    ],
    { ...silentOptions, cwd: repositoryDirectory },
    signal,
  );
  await requireSuccessfulCommand(
    "shared-utils build",
    process.execPath,
    [
      typescriptCli,
      "-p",
      path.join(repositoryDirectory, "packages", "shared-utils", "tsconfig.json"),
    ],
    { ...silentOptions, cwd: repositoryDirectory },
    signal,
  );
  await requireSuccessfulCommand(
    "server build",
    process.execPath,
    [nestCli, "build"],
    {
      ...silentOptions,
      cwd: serverDirectory,
    },
    signal,
  );
}

async function seedCompiledServer(env) {
  const { PrismaPg } = serverRequire("@prisma/adapter-pg");
  const { PrismaClient } = serverRequire(
    path.join(serverDirectory, "dist", "generated", "prisma", "client.js"),
  );
  const { seedInitialData } = serverRequire(
    path.join(serverDirectory, "dist", "seed", "seed-initial-data.js"),
  );
  const { seedSystemSettings } = serverRequire(
    path.join(serverDirectory, "dist", "seed", "seed-system-settings.js"),
  );
  const { PasswordService } = serverRequire(
    path.join(serverDirectory, "dist", "auth", "password.service.js"),
  );
  const phone = requireEnvironmentValue(env, "DEFAULT_ADMIN_PHONE");
  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: createDatabaseUrl(env) },
      { schema: requireEnvironmentValue(env, "DB_SCHEMA") },
    ),
  });

  try {
    await seedInitialData(prisma, {
      username: env.DEFAULT_ADMIN_USERNAME?.trim() || "admin",
      phone,
      password: requireEnvironmentValue(env, "DEFAULT_ADMIN_PASSWORD"),
      nickname: "系统管理员",
    });
    const administrator = await prisma.user.findUniqueOrThrow({
      where: { phone },
      select: { id: true },
    });

    await seedSystemSettings(prisma, administrator.id);
    const [systemViewPermission, systemFeeConfigPermission, restrictedRole] = await Promise.all([
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "system.view" } }),
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "system.fee_config" } }),
      prisma.role.upsert({
        where: { roleName: "rbac_e2e_system_viewer" },
        update: { description: "Admin RBAC E2E restricted session" },
        create: {
          roleName: "rbac_e2e_system_viewer",
          description: "Admin RBAC E2E restricted session",
          isActive: true,
        },
      }),
    ]);
    await Promise.all(
      [systemViewPermission, systemFeeConfigPermission].map((permission) =>
        prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: restrictedRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: { roleId: restrictedRole.id, permissionId: permission.id },
        }),
      ),
    );
    const restrictedPasswordHash = await new PasswordService().hash(rbacRestrictedAdmin.password);
    const restrictedUser = await prisma.user.upsert({
      where: { phone: rbacRestrictedAdmin.phone },
      update: {
        username: rbacRestrictedAdmin.username,
        nickname: "RBAC E2E restricted administrator",
        passwordHash: restrictedPasswordHash,
        status: "active",
      },
      create: {
        phone: rbacRestrictedAdmin.phone,
        username: rbacRestrictedAdmin.username,
        nickname: "RBAC E2E restricted administrator",
        passwordHash: restrictedPasswordHash,
        status: "active",
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: restrictedUser.id, roleId: restrictedRole.id },
      },
      update: {},
      create: { userId: restrictedUser.id, roleId: restrictedRole.id },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function requireSuccessfulCommand(label, executable, args, options, signal) {
  const exitCode = await runCommand(label, executable, args, options, signal);

  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}`);
  }
}

async function dropPostgresSchema(schemaName, env) {
  assertDisposableAdminSchema(schemaName);
  const { Client } = serverRequire("pg");
  const client = new Client({
    host: requireEnvironmentValue(env, "DB_HOST"),
    port: Number(requireEnvironmentValue(env, "DB_PORT")),
    user: requireEnvironmentValue(env, "DB_USERNAME"),
    password: requireEnvironmentValue(env, "DB_PASSWORD"),
    database: requireEnvironmentValue(env, "DB_NAME"),
  });

  await client.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await client.end();
  }
}

async function runMain(playwrightArgs, signal) {
  if (shouldLoadLocalEnvironment(process.env)) {
    loadLocalEnvironment();
  }
  const schemaName = createAdminE2eSchemaName();
  const temporaryDirectory = path.join(tmpdir(), schemaName);
  const serverPort = await findAvailablePort();
  let adminPort = await findAvailablePort();

  while (adminPort === serverPort) {
    adminPort = await findAvailablePort();
  }

  const baseEnv = {
    ...process.env,
    PORT: String(serverPort),
    ADMIN_E2E_SERVER_PORT: String(serverPort),
    ADMIN_E2E_ADMIN_PORT: String(adminPort),
    ADMIN_E2E_VITE_CACHE_DIR: path.join(temporaryDirectory, "vite-cache"),
    LOG_DIR: path.join(temporaryDirectory, "server-logs"),
    ALLOWED_ORIGINS: `http://127.0.0.1:${adminPort}`,
    RBAC_E2E_RESTRICTED_USERNAME: rbacRestrictedAdmin.username,
    RBAC_E2E_RESTRICTED_PASSWORD: rbacRestrictedAdmin.password,
  };
  const prismaCli = path.join(serverDirectory, "node_modules", "prisma", "build", "index.js");
  const playwrightCli = path.join(adminDirectory, "node_modules", "@playwright", "test", "cli.js");

  try {
    return await runWithIsolatedAdminSchema({
      schemaName,
      baseEnv,
      signal,
      pushSchema: async (env, operationSignal) => {
        await requireSuccessfulCommand(
          "Prisma db push",
          process.execPath,
          [prismaCli, "db", "push"],
          {
            cwd: serverDirectory,
            env,
            stdio: "ignore",
          },
          operationSignal,
        );
        await buildServerForE2e(env, operationSignal);
      },
      seedSchema: seedCompiledServer,
      startServers: startApplicationServers,
      runPlaywright: (env, operationSignal) =>
        runCommand(
          "Playwright",
          process.execPath,
          [playwrightCli, "test", ...playwrightArgs],
          {
            cwd: adminDirectory,
            env,
          },
          operationSignal,
        ),
      dropSchema: dropPostgresSchema,
    });
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function main(playwrightArgs = process.argv.slice(2)) {
  return runWithProcessSignalHandling((signal) => runMain(playwrightArgs, signal), process);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";

if (import.meta.url === invokedPath) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      const safeMessage = error instanceof Error ? error.message : "Admin E2E failed";
      console.error(safeMessage);
      process.exitCode = 1;
    });
}
