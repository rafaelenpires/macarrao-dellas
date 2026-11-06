import { copyFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve(".dev.vars");
const target = resolve("dist/server/.dev.vars");

try {
  await access(source);
  await access(resolve("dist/server/wrangler.json"));
  await copyFile(source, target);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
