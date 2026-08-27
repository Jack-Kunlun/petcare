import { Buffer } from "node:buffer";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import process from "node:process";
import { setImmediate } from "node:timers";

const configuredRoot = process.env.ADMIN_E2E_MEDIA_DIR?.trim();

if (!configuredRoot) {
  throw new Error("Admin E2E fake COS requires ADMIN_E2E_MEDIA_DIR");
}

const storageRoot = path.resolve(configuredRoot);
const originalLoad = Module._load;

function resolveObjectPath(key) {
  const normalizedKey = String(key).replaceAll("\\", "/").replace(/^\/+/, "");
  const objectPath = path.resolve(storageRoot, normalizedKey);

  if (!normalizedKey || !objectPath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Admin E2E fake COS rejected an unsafe object key");
  }

  return objectPath;
}

function complete(callback, operation) {
  try {
    operation();
    setImmediate(() => callback(null, {}));
  } catch (error) {
    setImmediate(() => callback(error));
  }
}

class FakeCos {
  putObject(params, callback) {
    complete(callback, () => {
      const objectPath = resolveObjectPath(params.Key);
      const body = Buffer.isBuffer(params.Body) ? params.Body : Buffer.from(params.Body);

      fs.mkdirSync(path.dirname(objectPath), { recursive: true });
      fs.writeFileSync(objectPath, body);
    });
  }

  headObject(params, callback) {
    complete(callback, () => fs.accessSync(resolveObjectPath(params.Key), fs.constants.R_OK));
  }

  deleteObject(params, callback) {
    complete(callback, () => fs.rmSync(resolveObjectPath(params.Key), { force: true }));
  }
}

Module._load = function load(request, parent, isMain) {
  if (request === "cos-nodejs-sdk-v5") {
    return FakeCos;
  }

  return originalLoad.call(this, request, parent, isMain);
};
