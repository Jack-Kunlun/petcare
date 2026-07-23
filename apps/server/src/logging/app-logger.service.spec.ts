import type { Logger as WinstonLogger } from "winston";
import { AppLogger } from "./app-logger.service";

describe("AppLogger", () => {
  const winstonLogger = {
    log: jest.fn(),
    close: jest.fn(),
  } as unknown as WinstonLogger;
  const logger = new AppLogger(winstonLogger);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes structured domain events", () => {
    logger.write("warn", "order.delayed", { orderId: "order-1" });

    expect(winstonLogger.log).toHaveBeenCalledWith("warn", "order.delayed", {
      event: "order.delayed",
      orderId: "order-1",
    });
  });

  it("adapts Nest log calls", () => {
    logger.log("Starting application", "NestFactory");

    expect(winstonLogger.log).toHaveBeenCalledWith("info", "Starting application", {
      event: "nest.log",
      context: "NestFactory",
    });
  });

  it("adapts Nest error calls with stack and context", () => {
    logger.error("Boot failed", "stack trace", "NestFactory");

    expect(winstonLogger.log).toHaveBeenCalledWith("error", "Boot failed", {
      event: "nest.error",
      stack: "stack trace",
      context: "NestFactory",
    });
  });

  it("closes Winston during application shutdown", () => {
    logger.onApplicationShutdown();

    expect(winstonLogger.close).toHaveBeenCalledTimes(1);
  });
});
