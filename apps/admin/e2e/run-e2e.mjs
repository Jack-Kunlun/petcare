import { spawn } from "node:child_process";
import console from "node:console";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const adminDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDirectory = path.resolve(adminDirectory, "../server");
const repositoryDirectory = path.resolve(adminDirectory, "../..");
const serverRequire = createRequire(path.join(serverDirectory, "package.json"));

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

export async function runWithIsolatedAdminSchema({
  schemaName,
  baseEnv,
  pushSchema,
  seedSchema,
  startServers,
  runPlaywright,
  dropSchema,
}) {
  assertDisposableAdminSchema(schemaName);
  const isolatedEnv = { ...baseEnv, DB_SCHEMA: schemaName };
  let primaryError;
  let result;
  let closeServers;

  try {
    await pushSchema(isolatedEnv);
    await seedSchema(isolatedEnv);
    closeServers = await startServers(isolatedEnv);
    result = await runPlaywright(isolatedEnv);
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

async function stopProcess(child) {
  if (hasExited(child)) {
    return;
  }

  child.kill("SIGTERM");

  if (await waitForProcessExit(child, 3_000)) {
    return;
  }

  child.kill("SIGKILL");

  if (!(await waitForProcessExit(child, 5_000))) {
    throw new Error("Admin E2E could not stop an isolated application server");
  }
}

async function waitForHttpServer(label, url, child) {
  const deadline = Date.now() + 45_000;
  let startupError;

  child.once("error", (error) => {
    startupError = error;
  });

  while (Date.now() < deadline) {
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

async function startApplicationServers(env) {
  const serverPort = requireEnvironmentValue(env, "ADMIN_E2E_SERVER_PORT");
  const adminPort = requireEnvironmentValue(env, "ADMIN_E2E_ADMIN_PORT");
  const viteCli = path.join(adminDirectory, "node_modules", "vite", "bin", "vite.js");
  const children = [];

  try {
    const server = spawn(process.execPath, [path.join(serverDirectory, "dist", "main.js")], {
      cwd: serverDirectory,
      env,
      shell: false,
      stdio: "inherit",
    });

    children.push(server);
    await waitForHttpServer("Server", `http://127.0.0.1:${serverPort}/health`, server);

    const admin = spawn(
      process.execPath,
      [viteCli, "--host", "127.0.0.1", "--port", adminPort, "--strictPort"],
      { cwd: adminDirectory, env, shell: false, stdio: "inherit" },
    );

    children.push(admin);
    await waitForHttpServer("Admin", `http://127.0.0.1:${adminPort}`, admin);
  } catch (error) {
    await Promise.allSettled(children.toReversed().map(stopProcess));
    throw error;
  }

  return async () => {
    const results = await Promise.allSettled(children.toReversed().map(stopProcess));
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

function runCommand(label, executable, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      ...options,
      shell: false,
      stdio: options.stdio ?? "inherit",
    });

    child.once("error", () => reject(new Error(`${label} could not start`)));
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} stopped by signal ${signal}`));
        return;
      }

      resolve(code ?? 1);
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

async function buildServerForE2e(env) {
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
  );
  await requireSuccessfulCommand("server build", process.execPath, [nestCli, "build"], {
    ...silentOptions,
    cwd: serverDirectory,
  });
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
  } finally {
    await prisma.$disconnect();
  }
}

async function requireSuccessfulCommand(label, executable, args, options) {
  const exitCode = await runCommand(label, executable, args, options);

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

export async function main(playwrightArgs = process.argv.slice(2)) {
  if (shouldLoadLocalEnvironment(process.env)) {
    loadLocalEnvironment();
  }
  const schemaName = createAdminE2eSchemaName();
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
    ALLOWED_ORIGINS: `http://127.0.0.1:${adminPort}`,
  };
  const prismaCli = path.join(serverDirectory, "node_modules", "prisma", "build", "index.js");
  const playwrightCli = path.join(adminDirectory, "node_modules", "@playwright", "test", "cli.js");

  return runWithIsolatedAdminSchema({
    schemaName,
    baseEnv,
    pushSchema: async (env) => {
      await requireSuccessfulCommand(
        "Prisma db push",
        process.execPath,
        [prismaCli, "db", "push"],
        {
          cwd: serverDirectory,
          env,
          stdio: "ignore",
        },
      );
      await buildServerForE2e(env);
    },
    seedSchema: seedCompiledServer,
    startServers: startApplicationServers,
    runPlaywright: (env) =>
      runCommand("Playwright", process.execPath, [playwrightCli, "test", ...playwrightArgs], {
        cwd: adminDirectory,
        env,
      }),
    dropSchema: dropPostgresSchema,
  });
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
