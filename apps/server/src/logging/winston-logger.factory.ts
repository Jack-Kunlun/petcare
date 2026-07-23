import { format, transports, createLogger, type Logger, type transport } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { ConfigService } from "../config/config.service";

type RotationOptions = DailyRotateFile.DailyRotateFileTransportOptions;

const fileFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json(),
);

export function createRotationOptions(logDirectory: string): RotationOptions[] {
  const sharedOptions: RotationOptions = {
    dirname: logDirectory,
    filename: "application-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    format: fileFormat,
  };

  return [
    sharedOptions,
    {
      ...sharedOptions,
      filename: "error-%DATE%.log",
      level: "error",
    },
  ];
}

export function createWinstonLogger(configService: ConfigService): Logger {
  const configuredTransports: transport[] = [
    new transports.Console({
      format:
        configService.nodeEnv === "production"
          ? fileFormat
          : format.combine(
              format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
              format.colorize(),
              format.printf(({ timestamp, level, message, event, ...metadata }) => {
                const details =
                  Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : "";
                const eventLabel = event ? ` [${String(event)}]` : "";

                return `${String(timestamp)} ${level}${eventLabel}: ${String(message)}${details}`;
              }),
            ),
    }),
  ];

  for (const options of createRotationOptions(configService.logDirectory)) {
    try {
      const rotatingTransport = new DailyRotateFile(options);

      rotatingTransport.on("error", reportTransportError);
      configuredTransports.push(rotatingTransport);
    } catch (error) {
      reportTransportError(error);
    }
  }

  return createLogger({
    level: configService.logLevel,
    defaultMeta: {
      service: "petcare-server",
      environment: configService.nodeEnv,
    },
    transports: configuredTransports,
    exitOnError: false,
  });
}

function reportTransportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`[logging] file transport error: ${message}\n`);
}
