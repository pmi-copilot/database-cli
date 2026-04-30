import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

export type DatabaseConfig = {
  server: string;
  user?: string;
  password?: string;
  port?: number;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  databases: Record<string, string>;
};

// Resolve to the package root (dist/src/cli → ../../..)
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const DEFAULT_CONFIG_LOCATIONS = [
  join(PACKAGE_ROOT, "config", "databases.json"),
  join(PACKAGE_ROOT, ".sqlcli.json"),
  join(homedir(), ".sqlcli", "config.json"),
];

// Reserved DB_* keys that are connection settings, not profile names
const RESERVED_DB_KEYS = new Set([
  "SERVER",
  "DATABASE",
  "USER",
  "PASSWORD",
  "PORT",
  "ENCRYPT",
  "TRUST_SERVER_CERTIFICATE",
  "ENV_FILE",
  "CONFIG",
]);

function parseEnvFile(filePath: string): Record<string, string> {
  const vars: Record<string, string> = {};

  if (!existsSync(filePath)) return vars;

  const lines = readFileSync(filePath, "utf-8").split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

function loadEnvVars(): Record<string, string | undefined> {
  const envFilePath = process.env.DB_ENV_FILE ?? join(PACKAGE_ROOT, ".env");
  const fileVars = parseEnvFile(envFilePath);
  // process.env takes precedence over .env file
  return { ...fileVars, ...process.env };
}

function loadFromFile(filePath: string): Partial<DatabaseConfig> {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as Partial<DatabaseConfig>;
  } catch {
    return {};
  }
}

function loadFromEnvVars(env: Record<string, string | undefined>): Partial<DatabaseConfig> {
  const config: Partial<DatabaseConfig> = {};
  const databases: Record<string, string> = {};

  if (env.DB_SERVER) config.server = env.DB_SERVER;
  if (env.DB_USER) config.user = env.DB_USER;
  if (env.DB_PASSWORD) config.password = env.DB_PASSWORD;
  if (env.DB_PORT) config.port = Number.parseInt(env.DB_PORT, 10);
  if (env.DB_ENCRYPT) config.encrypt = env.DB_ENCRYPT !== "false";
  if (env.DB_TRUST_SERVER_CERTIFICATE) {
    config.trustServerCertificate = env.DB_TRUST_SERVER_CERTIFICATE !== "false";
  }

  // Any DB_<NAME> that isn't a reserved connection key is treated as a profile
  // e.g. DB_TENANT=TenantDB  →  profile "tenant" → database "TenantDB"
  for (const [key, value] of Object.entries(env)) {
    const match = key.match(/^DB_(.+)$/);
    if (!match || !value) continue;

    const suffix = match[1];
    if (RESERVED_DB_KEYS.has(suffix)) continue;

    databases[suffix.toLowerCase()] = value;
  }

  if (Object.keys(databases).length > 0) {
    config.databases = databases;
  }

  return config;
}

export function loadConfig(): DatabaseConfig {
  const env = loadEnvVars();

  const configPath = env.DB_CONFIG ?? env.SQLCLI_CONFIG;
  let fileConfig: Partial<DatabaseConfig> = {};

  if (configPath) {
    fileConfig = loadFromFile(resolve(configPath));
  } else {
    for (const location of DEFAULT_CONFIG_LOCATIONS) {
      if (existsSync(location)) {
        fileConfig = loadFromFile(location);
        break;
      }
    }
  }

  const envConfig = loadFromEnvVars(env);

  // Env vars override config file values; profile lists are merged
  const merged: DatabaseConfig = {
    server: envConfig.server ?? fileConfig.server ?? "",
    databases: {
      ...fileConfig.databases,
      ...envConfig.databases,
    },
  };

  const user = envConfig.user ?? fileConfig.user;
  const password = envConfig.password ?? fileConfig.password;
  const port = envConfig.port ?? fileConfig.port;
  const encrypt = envConfig.encrypt ?? fileConfig.encrypt;
  const trust = envConfig.trustServerCertificate ?? fileConfig.trustServerCertificate;

  if (user) merged.user = user;
  if (password) merged.password = password;
  if (port) merged.port = port;
  if (encrypt !== undefined) merged.encrypt = encrypt;
  if (trust !== undefined) merged.trustServerCertificate = trust;

  return merged;
}

export function resolveDatabase(config: DatabaseConfig, profile: string): string {
  const db = config.databases[profile.toLowerCase()];

  if (!db) {
    const available = Object.keys(config.databases);
    const hint =
      available.length > 0
        ? `Available profiles: ${available.join(", ")}`
        : "No profiles configured. See --help for setup instructions.";
    throw new Error(`Unknown database profile: "${profile}". ${hint}`);
  }

  return db;
}

export function listProfiles(config: DatabaseConfig): string {
  const entries = Object.entries(config.databases);

  if (entries.length === 0) {
    return "No database profiles configured.";
  }

  const lines = ["Configured database profiles:", ""];
  for (const [profile, database] of entries) {
    lines.push(`  ${profile.padEnd(12)} → ${database}`);
  }

  return lines.join("\n");
}
