import { createRotationOptions } from "./winston-logger.factory";

describe("createRotationOptions", () => {
  it("creates application and error transports with the retention policy", () => {
    expect(createRotationOptions("D:/logs")).toEqual([
      expect.objectContaining({
        dirname: "D:/logs",
        filename: "application-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "14d",
      }),
      expect.objectContaining({
        dirname: "D:/logs",
        filename: "error-%DATE%.log",
        level: "error",
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "14d",
      }),
    ]);
  });
});
