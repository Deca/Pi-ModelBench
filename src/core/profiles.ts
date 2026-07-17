import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { BenchmarkProfile } from "./types.js";

function parseProfile(path: string): BenchmarkProfile {
  const profile = JSON.parse(readFileSync(path, "utf8")) as BenchmarkProfile;
  if (!profile.name || !Array.isArray(profile.tasks) || profile.tasks.length === 0) throw new Error(`Invalid benchmark profile: ${path}`);
  return profile;
}

export function loadProfiles(cwd: string): Map<string, BenchmarkProfile> {
  const bundledDirectories = [
    fileURLToPath(new URL("../../profiles/", import.meta.url)),
    fileURLToPath(new URL("../../../profiles/", import.meta.url)),
  ];
  const directories = [...bundledDirectories, join(cwd, ".pi", "modelbench", "profiles")];
  const profiles = new Map<string, BenchmarkProfile>();
  for (const directory of directories) {
    if (!existsSync(directory)) continue;
    for (const filename of readdirSync(directory).filter((file) => file.endsWith(".json") && file !== "coding-agent.json")) {
      const profile = parseProfile(join(directory, filename));
      profiles.set(profile.name, profile);
    }
  }
  return profiles;
}
