import process from "node:process";
import manifest from "../package.json" with { type: "json" };

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  process.stderr.write(
    `This project only supports ${manifest.packageManager}. Run: corepack install, then pnpm install\n`,
  );
  process.exitCode = 1;
}
