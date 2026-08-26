import { spawn } from "node:child_process";
import console from "node:console";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const adminDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const miniappDirectory = path.resolve(adminDirectory, "../miniapp");
const serverDirectory = path.resolve(adminDirectory, "../server");
const websiteDirectory = path.resolve(adminDirectory, "../website");
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

export function resolveAdminE2eDatabaseHost(value) {
  const host = value?.trim();

  return host?.toLowerCase() === "localhost" ? "127.0.0.1" : host;
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
  const miniappPort = requireEnvironmentValue(env, "ADMIN_E2E_MINIAPP_PORT");
  const websitePort = requireEnvironmentValue(env, "ADMIN_E2E_WEBSITE_PORT");
  const miniappCli = path.join(
    miniappDirectory,
    "node_modules",
    "@dcloudio",
    "vite-plugin-uni",
    "bin",
    "uni.js",
  );
  const viteCli = path.join(adminDirectory, "node_modules", "vite", "bin", "vite.js");
  const websiteEntry = path.join(websiteDirectory, "dist", "server", "entry.mjs");
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

    const website = spawnProcess(process.execPath, [websiteEntry], {
      cwd: websiteDirectory,
      detached: process.platform !== "win32",
      env: { ...env, PORT: websitePort, HOST: "127.0.0.1" },
      shell: false,
      stdio: "inherit",
    });

    children.push(website);
    await waitForServer("Website", `http://127.0.0.1:${websitePort}/healthz`, website, signal);

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

    const miniapp = spawnProcess(
      process.execPath,
      [miniappCli, "--host", "127.0.0.1", "--port", miniappPort, "--strictPort"],
      {
        cwd: miniappDirectory,
        detached: process.platform !== "win32",
        env,
        shell: false,
        stdio: "inherit",
      },
    );

    children.push(miniapp);
    await waitForServer("Miniapp", `http://127.0.0.1:${miniappPort}`, miniapp, signal);
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
  await requireSuccessfulCommand(
    "website build",
    process.execPath,
    [path.join(websiteDirectory, "node_modules", "astro", "bin", "astro.mjs"), "build"],
    {
      ...silentOptions,
      env: { ...env, ASTRO_TELEMETRY_DISABLED: "1" },
      cwd: websiteDirectory,
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
  const { seedWebsiteContent } = serverRequire(
    path.join(serverDirectory, "dist", "seed", "seed-website-content.js"),
  );
  const { PasswordService } = serverRequire(
    path.join(serverDirectory, "dist", "auth", "password.service.js"),
  );
  const { JwtService } = serverRequire("@nestjs/jwt");
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
    await seedWebsiteContent(prisma, administrator.id);
    await prisma.websiteMediaAsset.upsert({
      where: { storageKey: "public/website-media/e2e/website-e2e-selection.png" },
      update: {
        originalName: "website-e2e-selection.png",
        mimeType: "image/png",
        sizeBytes: 67,
        width: 1,
        height: 1,
        checksum: "website-e2e-selection-png",
        status: "active",
        archivedAt: null,
        createdById: administrator.id,
      },
      create: {
        storageKey: "public/website-media/e2e/website-e2e-selection.png",
        originalName: "website-e2e-selection.png",
        mimeType: "image/png",
        sizeBytes: 67,
        width: 1,
        height: 1,
        checksum: "website-e2e-selection-png",
        status: "active",
        createdById: administrator.id,
      },
    });
    const [communityAuthor, communityReporter] = await Promise.all([
      prisma.user.upsert({
        where: { phone: "13900000095" },
        update: { username: "community-e2e-author", nickname: "社区 E2E 作者", status: "active" },
        create: {
          phone: "13900000095",
          username: "community-e2e-author",
          nickname: "社区 E2E 作者",
          status: "active",
        },
      }),
      prisma.user.upsert({
        where: { phone: "13900000096" },
        update: {
          username: "community-e2e-reporter",
          nickname: "社区 E2E 举报人",
          status: "active",
        },
        create: {
          phone: "13900000096",
          username: "community-e2e-reporter",
          nickname: "社区 E2E 举报人",
          status: "active",
        },
      }),
    ]);
    const jwtSecret = requireEnvironmentValue(env, "JWT_SECRET");
    const jwt = new JwtService();
    const accessToken = (user) =>
      jwt.sign(
        {
          sub: user.id,
          sid: randomUUID(),
          sessionVersion: user.sessionVersion,
          username: user.username,
          roles: [],
          type: "access",
        },
        { secret: jwtSecret, expiresIn: "30m" },
      );

    env.COMMUNITY_E2E_AUTHOR_TOKEN = accessToken(communityAuthor);
    env.COMMUNITY_E2E_REPORTER_TOKEN = accessToken(communityReporter);
    const [
      systemViewPermission,
      systemFeeConfigPermission,
      websiteViewPermission,
      websiteReadPermission,
      websiteEditPermission,
      websiteEditActionPermission,
      websitePublishPermission,
      websitePublishActionPermission,
      restrictedRole,
      websiteReaderRole,
      websiteEditorRole,
      websitePublisherRole,
    ] = await Promise.all([
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "system.view" } }),
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "system.fee_config" } }),
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "website.view" } }),
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "website.read" } }),
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "website.edit" } }),
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "website.edit_action" } }),
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "website.publish" } }),
      prisma.permission.findUniqueOrThrow({ where: { permissionCode: "website.publish_action" } }),
      prisma.role.upsert({
        where: { roleName: "rbac_e2e_system_viewer" },
        update: { description: "Admin RBAC E2E restricted session" },
        create: {
          roleName: "rbac_e2e_system_viewer",
          description: "Admin RBAC E2E restricted session",
          isActive: true,
        },
      }),
      prisma.role.upsert({
        where: { roleName: "rbac_e2e_website_reader" },
        update: { description: "Website Content read-only E2E session" },
        create: {
          roleName: "rbac_e2e_website_reader",
          description: "Website Content read-only E2E session",
          isActive: true,
        },
      }),
      prisma.role.upsert({
        where: { roleName: "rbac_e2e_website_editor" },
        update: { description: "Website Content editor E2E session" },
        create: {
          roleName: "rbac_e2e_website_editor",
          description: "Website Content editor E2E session",
          isActive: true,
        },
      }),
      prisma.role.upsert({
        where: { roleName: "rbac_e2e_website_publisher" },
        update: { description: "Website Content publisher E2E session" },
        create: {
          roleName: "rbac_e2e_website_publisher",
          description: "Website Content publisher E2E session",
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
    const websiteRoles = [
      {
        username: "rbac-e2e-website-reader",
        phone: "13900000092",
        nickname: "Website Content reader",
        role: websiteReaderRole,
        permissions: [websiteViewPermission, websiteReadPermission],
      },
      {
        username: "rbac-e2e-website-editor",
        phone: "13900000093",
        nickname: "Website Content editor",
        role: websiteEditorRole,
        permissions: [
          websiteViewPermission,
          websiteReadPermission,
          websiteEditPermission,
          websiteEditActionPermission,
        ],
      },
      {
        username: "rbac-e2e-website-publisher",
        phone: "13900000094",
        nickname: "Website Content publisher",
        role: websitePublisherRole,
        permissions: [
          websiteViewPermission,
          websiteReadPermission,
          websitePublishPermission,
          websitePublishActionPermission,
        ],
      },
    ];
    const passwordHash = await new PasswordService().hash(rbacRestrictedAdmin.password);

    for (const fixture of [
      {
        username: rbacRestrictedAdmin.username,
        phone: rbacRestrictedAdmin.phone,
        nickname: "RBAC E2E restricted administrator",
        role: restrictedRole,
        permissions: [systemViewPermission, systemFeeConfigPermission],
      },
      ...websiteRoles,
    ]) {
      const user = await prisma.user.upsert({
        where: { phone: fixture.phone },
        update: {
          username: fixture.username,
          nickname: fixture.nickname,
          passwordHash,
          status: "active",
        },
        create: {
          phone: fixture.phone,
          username: fixture.username,
          nickname: fixture.nickname,
          passwordHash,
          status: "active",
        },
      });

      await Promise.all([
        ...fixture.permissions.map((permission) =>
          prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: fixture.role.id, permissionId: permission.id },
            },
            update: {},
            create: { roleId: fixture.role.id, permissionId: permission.id },
          }),
        ),
        prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: fixture.role.id } },
          update: {},
          create: { userId: user.id, roleId: fixture.role.id },
        }),
      ]);
    }
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
  let miniappPort = await findAvailablePort();
  let websitePort = await findAvailablePort();

  while (adminPort === serverPort) {
    adminPort = await findAvailablePort();
  }

  while (websitePort === serverPort || websitePort === adminPort) {
    websitePort = await findAvailablePort();
  }

  while ([serverPort, adminPort, websitePort].includes(miniappPort)) {
    miniappPort = await findAvailablePort();
  }

  const baseEnv = {
    ...process.env,
    DB_HOST: resolveAdminE2eDatabaseHost(process.env.DB_HOST),
    PORT: String(serverPort),
    ADMIN_E2E_SERVER_PORT: String(serverPort),
    ADMIN_E2E_ADMIN_PORT: String(adminPort),
    ADMIN_E2E_MINIAPP_PORT: String(miniappPort),
    ADMIN_E2E_MINIAPP_URL: `http://127.0.0.1:${miniappPort}`,
    ADMIN_E2E_WEBSITE_PORT: String(websitePort),
    ADMIN_E2E_WEBSITE_URL: `http://127.0.0.1:${websitePort}`,
    ADMIN_E2E_VITE_CACHE_DIR: path.join(temporaryDirectory, "vite-cache"),
    ADMIN_E2E_MINIAPP_VITE_CACHE_DIR: path.join(temporaryDirectory, "miniapp-vite-cache"),
    LOG_DIR: path.join(temporaryDirectory, "server-logs"),
    ALLOWED_ORIGINS: `http://127.0.0.1:${adminPort},http://127.0.0.1:${websitePort},http://127.0.0.1:${miniappPort}`,
    VITE_MINIAPP_API_BASE_URL: `http://127.0.0.1:${serverPort}`,
    WEBSITE_PUBLIC_URL: `http://127.0.0.1:${websitePort}`,
    WEBSITE_CONTENT_API_BASE_URL: `http://127.0.0.1:${serverPort}`,
    // Fake, isolated configuration makes the list adapter resolve the seeded asset URL locally.
    // This flow never uploads, reads, or verifies a Tencent COS object.
    TENCENT_COS_SECRET_ID: "admin-e2e-fake-secret-id",
    TENCENT_COS_SECRET_KEY: "admin-e2e-fake-secret-key",
    TENCENT_COS_BUCKET: "admin-e2e-media-1250000000",
    TENCENT_COS_REGION: "ap-guangzhou",
    TENCENT_COS_PUBLIC_BASE_URL: `http://127.0.0.1:${websitePort}`,
    RBAC_E2E_RESTRICTED_USERNAME: rbacRestrictedAdmin.username,
    RBAC_E2E_RESTRICTED_PASSWORD: rbacRestrictedAdmin.password,
    COMMUNITY_POST_MAX_ATTEMPTS: "1",
    COMMUNITY_POST_WINDOW_SECONDS: "1",
    COMMUNITY_MEDIA_MAX_ATTEMPTS: "5",
    COMMUNITY_MEDIA_WINDOW_SECONDS: "60",
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
