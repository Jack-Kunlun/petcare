import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();
  const password = "Correct-Horse-Battery-Staple!42";

  it("stores an Argon2id hash instead of plaintext", async () => {
    const hash = await service.hash(password);

    expect(hash).not.toContain(password);
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("accepts the correct password and rejects a wrong password", async () => {
    const hash = await service.hash(password);

    await expect(service.verify(hash, password)).resolves.toBe(true);
    await expect(service.verify(hash, "wrong-password")).resolves.toBe(false);
  });

  it("rejects passwords shorter than twelve characters", async () => {
    await expect(service.hash("TooShort1!")).rejects.toThrow(
      "Password must be at least 12 characters long",
    );
  });
});
