import COS from "cos-nodejs-sdk-v5";
import { ConfigService } from "../config/config.service";
import { DatabaseBackupStorage } from "./database-backup-storage";

const usageMessage = "Usage: database-backup-cli <upload|download> <source> <destination>";
const uploadFailureMessage = "Database backup upload failed";
const downloadFailureMessage = "Database backup download failed";
const operationFailureMessage = "Database backup operation failed";

function backupConfigurationNames(message: string): string | undefined {
  const entries = message.startsWith("Invalid backup configuration:\n- ")
    ? message.slice("Invalid backup configuration:\n- ".length).split("\n- ")
    : [message];
  const names = entries.map(
    (entry) =>
      /^(BACKUP_COS_(?:SECRET_ID|SECRET_KEY|BUCKET|REGION))(?: is required| must use the BucketName-APPID format| has an invalid format)$/u.exec(
        entry,
      )?.[1],
  );

  if (names.length === 0 || !names.every((name): name is string => Boolean(name))) {
    return undefined;
  }

  return [...new Set(names)].join(", ");
}

export function formatDatabaseBackupCliError(error: unknown): string {
  if (!(error instanceof Error)) {
    return operationFailureMessage;
  }

  if ([usageMessage, uploadFailureMessage, downloadFailureMessage].includes(error.message)) {
    return error.message;
  }

  const configurationNames = backupConfigurationNames(error.message);

  return configurationNames
    ? `Invalid backup configuration: ${configurationNames}`
    : operationFailureMessage;
}

async function main(): Promise<void> {
  const [operation, first, second, ...extra] = process.argv.slice(2);

  if (
    extra.length > 0 ||
    !first ||
    !second ||
    (operation !== "upload" && operation !== "download")
  ) {
    throw new Error(usageMessage);
  }

  const config = new ConfigService();

  config.validateForBackup();
  const storage = new DatabaseBackupStorage(
    new COS({
      SecretId: config.backupCosSecretId,
      SecretKey: config.backupCosSecretKey,
      Protocol: "https:",
    }),
    config,
  );

  if (operation === "upload") {
    await storage.upload(first, second);
  } else {
    await storage.download(first, second);
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${formatDatabaseBackupCliError(error)}\n`);
    process.exitCode = 1;
  });
}
