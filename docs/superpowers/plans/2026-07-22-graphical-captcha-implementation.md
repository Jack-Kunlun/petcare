# Graphical Captcha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Require a server-generated, Redis-backed, single-use graphical captcha before an administrator can request an SMS login code.

**Architecture:** CaptchaService creates four-character SVG challenges, stores only an HMAC digest in Redis, and atomically verifies or consumes each challenge. The SMS endpoint accepts the challenge ID and answer before running existing administrator lookup and SMS rate limits. The Admin login page fetches and refreshes challenges without persisting them.

**Tech Stack:** NestJS 11, TypeScript 6, Redis 7, Node.js crypto, React 19, Axios, Jest 30, Vitest 4, Testing Library.

## Global Constraints

- Use Node.js 22 and the repository-pinned pnpm version.
- Do not add a captcha dependency; generate SVG with Node.js crypto and controlled server strings.
- All environment reads remain inside ConfigService.
- Store only an HMAC digest in Redis; never log or return the captcha answer.
- Captcha length is four digits from 23456789.
- SVG glyphs use server-owned seven-segment vector paths. Never emit text nodes, digit values, or answer-bearing attributes.
- Default TTL is 300 seconds and maximum failed attempts is 5.
- Successful verification consumes the challenge before administrator lookup or SMS sending.
- Do not modify apps/server/.env.local.
- The worktree contains pre-existing mixed changes. Do not commit implementation files automatically; use scoped diff checkpoints.

---

## File Map

- Create apps/server/src/auth/captcha.service.ts: generation, SVG rendering, digesting, and verification.
- Create apps/server/src/auth/captcha.service.spec.ts: lifecycle and security tests.
- Create apps/server/src/config/redis.service.spec.ts: generic atomic digest-consumer tests.
- Modify apps/server/src/config/redis.service.ts: generic one-time digest consumer with OTP compatibility.
- Modify apps/server/src/config/config.service.ts and its spec: captcha settings.
- Modify auth module, service, controller, DTO, and specs: protect SMS sending.
- Modify Admin auth types, API, context, provider, and tests: expose captcha operations.
- Modify Login.tsx and Login.test.tsx: display, validate, refresh, and submit captcha.
- Modify environment examples, Docker Compose, README, seed guide, and environment documentation.

---

### Task 1: Captcha Configuration and Atomic Redis Consumer

**Files:**

- Modify: apps/server/src/config/config.service.ts
- Modify: apps/server/src/config/config.service.spec.ts
- Modify: apps/server/src/config/redis.service.ts
- Create: apps/server/src/config/redis.service.spec.ts

**Interfaces:**

- Produces: ConfigService.captchaTtlSeconds: number
- Produces: ConfigService.captchaMaxAttempts: number
- Produces: RedisService.verifyAndConsumeDigest(valueKey, attemptsKey, expectedDigest, maxAttempts): Promise<boolean>
- Preserves: RedisService.verifyAndConsumeOtp with identical behavior.

- [ ] **Step 1: Write failing configuration tests**

Delete CAPTCHA_TTL_SECONDS and CAPTCHA_MAX_ATTEMPTS and expect defaults 300 and 5. Set either to 0 and expect the existing positive-integer validation error.

```typescript
expect(service.captchaTtlSeconds).toBe(300);
expect(service.captchaMaxAttempts).toBe(5);
process.env.CAPTCHA_TTL_SECONDS = "0";
expect(() => service.captchaTtlSeconds).toThrow("CAPTCHA_TTL_SECONDS must be a positive integer");
```

- [ ] **Step 2: Run configuration tests and verify RED**

```powershell
cd apps/server
.\node_modules\.bin\jest.cmd src/config/config.service.spec.ts --runInBand
```

Expected: FAIL because both getters are missing.

- [ ] **Step 3: Add minimal getters**

```typescript
get captchaTtlSeconds(): number {
  return this.getPositiveInteger("CAPTCHA_TTL_SECONDS", 300);
}

get captchaMaxAttempts(): number {
  return this.getPositiveInteger("CAPTCHA_MAX_ATTEMPTS", 5);
}
```

- [ ] **Step 4: Write the failing Redis primitive test**

Create a fake client whose eval method returns 1. Inject it into a RedisService instance, call verifyAndConsumeDigest, and assert eval receives both keys and arguments [expectedDigest, "5"]. Add a return-0 case expecting false.

- [ ] **Step 5: Run Redis tests and verify RED**

```powershell
.\node_modules\.bin\jest.cmd src/config/redis.service.spec.ts --runInBand
```

Expected: FAIL because verifyAndConsumeDigest is missing.

- [ ] **Step 6: Generalize the Lua operation**

Move the existing OTP Lua body into verifyAndConsumeDigest. Make verifyAndConsumeOtp delegate to it so current OTP behavior remains unchanged.

- [ ] **Step 7: Verify GREEN and inspect the scoped diff**

```powershell
.\node_modules\.bin\jest.cmd src/config/config.service.spec.ts src/config/redis.service.spec.ts --runInBand
git diff --check -- apps/server/src/config
```

Expected: all tests PASS and no whitespace errors.

---

### Task 2: Captcha Generation and Verification Service

**Files:**

- Create: apps/server/src/auth/captcha.service.ts
- Create: apps/server/src/auth/captcha.service.spec.ts
- Modify: apps/server/src/auth/auth.module.ts

**Interfaces:**

- Produces: CaptchaChallenge with captchaId, image, and expiresIn.
- Produces: CaptchaService.create(): Promise<CaptchaChallenge>
- Produces: CaptchaService.verifyAndConsume(captchaId, answer): Promise<boolean>

- [ ] **Step 1: Write failing generation tests**

Use an in-memory Redis fake. Control only the random boundary so the answer is known without a production test hook.

```typescript
const challenge = await service.create();
expect(challenge.captchaId).toMatch(/^[a-f0-9]{32}$/);
expect(challenge.image).toMatch(/^data:image\/svg\+xml;base64,/);
expect(challenge.expiresIn).toBe(300);
expect(redis.lastValue).toMatch(/^[a-f0-9]{64}$/);
expect(redis.lastValue).not.toContain("2345");
```

- [ ] **Step 2: Run and verify RED**

```powershell
.\node_modules\.bin\jest.cmd src/auth/captcha.service.spec.ts --runInBand
```

Expected: FAIL because CaptchaService does not exist.

- [ ] **Step 3: Implement minimal creation**

Generate a 16-byte hex ID and four digits from 23456789. Compute an HMAC-SHA256 over captchaId, a colon, and the normalized answer. Store the digest at auth:captcha:<id> with the configured TTL. Render a 140 by 48 SVG using an internal seven-segment path map, controlled rotations, lines, and circles. Return a Base64 Data URL and never emit text nodes or answer-bearing attributes.

- [ ] **Step 4: Write failing lifecycle tests**

Cover successful verification, success only once, wrong-answer failure, and delegation of captchaMaxAttempts to verifyAndConsumeDigest.

- [ ] **Step 5: Implement verification and module registration**

Normalize the answer and call:

```typescript
return this.redisService.verifyAndConsumeDigest(
  "auth:captcha:" + captchaId,
  "auth:captcha:attempts:" + captchaId,
  digest,
  this.configService.captchaMaxAttempts,
);
```

Register CaptchaService in AuthModule providers.

- [ ] **Step 6: Verify GREEN, Lint, and build**

```powershell
.\node_modules\.bin\jest.cmd src/auth/captcha.service.spec.ts --runInBand
.\node_modules\.bin\eslint.cmd src/auth/captcha.service.ts src/auth/captcha.service.spec.ts
.\node_modules\.bin\nest.cmd build
```

Expected: PASS and exit code 0.

---

### Task 3: Protect the SMS Send Endpoint

**Files:**

- Modify: apps/server/src/auth/dto/send-sms-code.dto.ts
- Modify: apps/server/src/auth/auth.service.ts and auth.service.spec.ts
- Modify: apps/server/src/auth/auth.controller.ts and auth.controller.spec.ts

**Interfaces:**

- Consumes: CaptchaService.create and verifyAndConsume.
- Changes: AuthService.sendSmsCode(phone, captchaId, captchaCode).
- Produces: GET /auth/captcha.
- Changes: POST /auth/sms/send body to phone, captchaId, and captchaCode.

- [ ] **Step 1: Write failing AuthService tests**

Add a CaptchaService mock. Invalid captcha must reject before database access:

```typescript
captchaService.verifyAndConsume.mockResolvedValue(false);
await expect(service.sendSmsCode(phone, "captcha-1", "2345")).rejects.toMatchObject({
  status: 400,
});
expect(prisma.user.findFirst).not.toHaveBeenCalled();
expect(verificationCodeService.send).not.toHaveBeenCalled();
```

Add a valid case and verify captcha checking occurs before findFirst while preserving the generic success response.

- [ ] **Step 2: Run and verify RED**

```powershell
.\node_modules\.bin\jest.cmd src/auth/auth.service.spec.ts --runInBand
```

Expected: FAIL due to constructor and signature changes.

- [ ] **Step 3: Implement service enforcement**

Inject CaptchaService. At the start of sendSmsCode, verify the challenge and throw BadRequestException("图形验证码错误或已过期") on failure. Only then execute the existing lookup and SMS logic.

- [ ] **Step 4: Write failing controller and DTO tests**

Assert GET /auth/captcha delegates to create. Assert sendSmsCode forwards all three values. Through a Nest validation pipe, reject empty IDs and answers not matching exactly four digits from 2 through 9.

- [ ] **Step 5: Implement controller and DTO changes**

Use IsString and Length(16, 128) for captchaId and Matches(/^[2-9]{4}$/) for captchaCode. Add the GET endpoint and inject CaptchaService into the controller.

- [ ] **Step 6: Verify the endpoint**

```powershell
.\node_modules\.bin\jest.cmd src/auth/auth.service.spec.ts src/auth/auth.controller.spec.ts --runInBand
.\node_modules\.bin\eslint.cmd src/auth
.\node_modules\.bin\nest.cmd build
```

Expected: PASS and exit code 0.

---

### Task 4: Admin API and Authentication Context

**Files:**

- Modify: apps/admin/src/auth/auth.types.ts
- Modify: apps/admin/src/auth/auth.api.ts
- Modify: apps/admin/src/auth/auth.context.ts
- Modify: apps/admin/src/auth/AuthProvider.tsx and AuthProvider.test.tsx

**Interfaces:**

- Produces: CaptchaChallenge with captchaId, image, and expiresIn.
- Produces: getCaptcha(): Promise<CaptchaChallenge>
- Changes: sendSmsCode(phone, captchaId, captchaCode): Promise<void>
- Exposes both through AuthContextValue.

- [ ] **Step 1: Write failing provider delegation tests**

Render the existing consumer, invoke getCaptcha and sendSmsCode, and assert the API receives exact arguments and returns the challenge.

- [ ] **Step 2: Run and verify RED**

```powershell
cd apps/admin
.\node_modules\.bin\vitest.cmd run src/auth/AuthProvider.test.tsx
```

Expected: FAIL because methods and signatures are missing.

- [ ] **Step 3: Implement types, API, and context**

```typescript
export async function getCaptcha(): Promise<CaptchaChallenge> {
  const response = await apiClient.get<CaptchaChallenge>("/auth/captcha");
  return response.data;
}

export async function sendSmsCode(
  phone: string,
  captchaId: string,
  captchaCode: string,
): Promise<void> {
  await apiClient.post("/auth/sms/send", { phone, captchaId, captchaCode });
}
```

Expose stable callbacks from AuthProvider and add them to memo dependencies.

- [ ] **Step 4: Verify GREEN**

```powershell
.\node_modules\.bin\vitest.cmd run src/auth/AuthProvider.test.tsx
.\node_modules\.bin\eslint.cmd src/auth
```

Expected: PASS and exit code 0.

---

### Task 5: Graphical Captcha Login Interaction

**Files:**

- Modify: apps/admin/src/pages/Login.tsx
- Modify: apps/admin/src/pages/Login.test.tsx

**Interfaces:**

- Consumes: auth.getCaptcha()
- Consumes: auth.sendSmsCode(phone, captchaId, captchaCode)

- [ ] **Step 1: Write failing loading and display test**

Mock getCaptcha with captchaId captcha-1 and a valid SVG Data URL. Switch to the SMS tab and expect an image button named “图形验证码，点击换一张”.

- [ ] **Step 2: Run and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run src/pages/Login.test.tsx
```

Expected: FAIL because no image or request exists.

- [ ] **Step 3: Implement challenge loading and display**

Add captcha, captchaCode, and captchaLoading state. Fetch on entering SMS mode, render the Data URL through an img inside a refresh button, and expose aria-label “图形验证码，点击换一张”.

- [ ] **Step 4: Write failing validation and submission tests**

Cover:

- missing input or challenge prevents sending;
- request contains phone, captchaId, and normalized answer;
- clicking the image refreshes;
- success clears input, starts the countdown, and loads a new challenge;
- failure shows an error, clears input, and loads a new challenge;
- image-loading failure shows retry and disables sending.

- [ ] **Step 5: Implement minimal send behavior**

Validate phone, challenge presence, and exactly four digits from 2 through 9. In finally, clear captcha input and reload the challenge. Keep SMS-code login unchanged.

- [ ] **Step 6: Verify GREEN and build**

```powershell
.\node_modules\.bin\vitest.cmd run src/pages/Login.test.tsx
.\node_modules\.bin\eslint.cmd src/pages/Login.tsx src/pages/Login.test.tsx
.\node_modules\.bin\vite.cmd build
```

Expected: tests PASS, Lint exit 0, and Vite build succeeds.

---

### Task 6: Configuration, Documentation, and Final Verification

**Files:**

- Modify: .env.example
- Modify: docker-compose.yml
- Modify: docs/environment-variables.md
- Modify: README.md
- Modify: apps/server/prisma/SEED-GUIDE.md
- Update: this plan’s checkboxes

**Interfaces:**

- Documents: CAPTCHA_TTL_SECONDS=300
- Documents: CAPTCHA_MAX_ATTEMPTS=5

- [ ] **Step 1: Add configuration and documentation**

Add both variables to .env.example and Docker Server environment. Document positive-integer requirements, defaults, Redis digest storage, single consumption, and the local user flow.

- [ ] **Step 2: Run the complete automated matrix**

```powershell
cd apps/server
pnpm exec prisma validate
.\node_modules\.bin\jest.cmd --runInBand
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\nest.cmd build

cd ../admin
.\node_modules\.bin\vitest.cmd run
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vite.cmd build

cd ../..
pnpm exec prettier --check apps/server/src/auth apps/server/src/config apps/admin/src/auth apps/admin/src/pages/Login.tsx apps/admin/src/pages/Login.test.tsx docs docker-compose.yml
git diff --check
```

Expected: all test suites PASS and every command exits 0. Verify .env.example manually because Prettier has no parser for it.

- [ ] **Step 3: Perform real HTTP integration**

Temporarily start the built Server and verify:

1. GET /auth/captcha returns an ID and SVG Data URL.
2. Incorrect captcha returns 400 and does not send SMS.
3. Open the Admin page and read the rendered image as a user; never parse production internals or add an answer endpoint.
4. A valid challenge sends the configured local SMS code once.
5. Reusing that challenge returns 400.
6. SMS login with the local code still succeeds.
7. Stop the temporary Server and leave PostgreSQL and Redis healthy.

- [ ] **Step 4: Review the final scoped diff**

```powershell
git diff -- apps/server/src/auth apps/server/src/config apps/admin/src/auth apps/admin/src/pages/Login.tsx apps/admin/src/pages/Login.test.tsx .env.example docker-compose.yml docs/environment-variables.md README.md apps/server/prisma/SEED-GUIDE.md
git status --short
```

Expected: only intended captcha changes plus known pre-existing changes, with no secrets or generated output staged.
