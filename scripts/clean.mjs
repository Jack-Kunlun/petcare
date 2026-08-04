import { rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
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

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  await cleanPaths(process.cwd(), process.argv.slice(2));
}
