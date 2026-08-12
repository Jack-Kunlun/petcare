import { readdir, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export async function cleanPaths(root, relativePaths) {
  const resolvedRoot = resolve(root);

  for (const input of relativePaths) {
    const target = resolve(resolvedRoot, input);
    const pathFromRoot = relative(resolvedRoot, target);
    const isChild =
      input !== "." &&
      !isAbsolute(input) &&
      pathFromRoot !== "" &&
      pathFromRoot !== ".." &&
      !pathFromRoot.startsWith("..\\") &&
      !pathFromRoot.startsWith("../");

    if (!isChild) {
      throw new Error(`clean target must be a relative child path: ${input}`);
    }

    await rm(target, { recursive: true, force: true });
  }
}

export async function cleanWorkspaceModules(root) {
  const modulePaths = ["node_modules"];

  for (const workspaceRoot of ["apps", "packages"]) {
    const workspaceDirectories = await readdir(join(root, workspaceRoot), {
      withFileTypes: true,
    }).catch(() => []);

    for (const directory of workspaceDirectories) {
      if (directory.isDirectory()) {
        modulePaths.push(join(workspaceRoot, directory.name, "node_modules"));
      }
    }
  }

  await cleanPaths(root, modulePaths);
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const targets = process.argv.slice(2);

  if (targets.length === 1 && targets[0] === "--modules") {
    await cleanWorkspaceModules(process.cwd());
  } else {
    await cleanPaths(process.cwd(), targets);
  }
}
