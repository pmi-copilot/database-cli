#!/usr/bin/env node

import { closeDatabase, initDatabase } from "../db/index.js";
import {
  executeCliCommand,
  getCommandDefinitions,
  isCliCommandName,
  type CliCommandName,
  type CliOptions,
} from "./commands.js";
import { loadConfig, listProfiles, resolveDatabase } from "./config.js";
import { writeCliError, writeToolResponse, writeUsage } from "./output.js";

type ParsedArguments = {
  profile?: string;
  command?: string;
  options: CliOptions;
};

const booleanFlags = new Set(["confirm", "help", "list-profiles"]);

function parseArguments(args: string[]): ParsedArguments {
  const options: CliOptions = {};
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token.startsWith("--")) {
      const key = token.slice(2);

      if (booleanFlags.has(key)) {
        options[key] = true;
        continue;
      }

      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Option ${token} requires a value`);
      }

      options[key] = value;
      index += 1;
      continue;
    }

    positionals.push(token);
  }

  return {
    profile: positionals[0],
    command: positionals[1],
    options,
  };
}

function buildUsage(profileList: string): string {
  const definitions = getCommandDefinitions();
  const lines = [
    "SQL Server CLI",
    "",
    "Usage:",
    "  db-cli <profile> <command> [command options]",
    "  db-cli <profile> <command> [--server <override>] [--user <override>] [--password <override>]",
    "",
    "Examples:",
    "  db-cli tenant list-tables",
    "  db-cli global read-query --query \"SELECT TOP 10 * FROM dbo.Users\"",
    "  db-cli admin describe-table --table dbo.Roles",
    "",
    "Commands:",
  ];

  for (const [name, definition] of Object.entries(definitions)) {
    lines.push(`  ${name.padEnd(16)} ${definition.description}`);
    lines.push(`                   ${definition.usage}`);
  }

  lines.push("");
  lines.push(profileList);
  lines.push("");
  lines.push("Connection overrides (optional, override config file / env vars):");
  lines.push("  --server     SQL Server host name or IP");
  lines.push("  --user       SQL Server username");
  lines.push("  --password   SQL Server password");
  lines.push("  --port       SQL Server port (default: 1433)");
  lines.push("");
  lines.push("Command options:");
  lines.push("  --query      SQL text for query and schema commands");
  lines.push("  --table      Table name for describe-table and drop-table");
  lines.push("  --format     export-query format: csv or json");
  lines.push("  --confirm    Required for drop-table");
  lines.push("");
  lines.push("Global options:");
  lines.push("  --list-profiles  Show all configured database profiles");
  lines.push("  --help           Show this message");
  lines.push("");
  lines.push("Config file locations (first match wins):");
  lines.push("  $DB_CONFIG              Path from environment variable");
  lines.push("  ./config/databases.json");
  lines.push("  ./.sqlcli.json");
  lines.push("  ~/.sqlcli/config.json");
  lines.push("");
  lines.push("Environment variables:");
  lines.push("  DB_SERVER=10.61.3.100");
  lines.push("  DB_USER=myuser");
  lines.push("  DB_PASSWORD=mypassword");
  lines.push("  DB_PORT=1433");
  lines.push("  DB_ENCRYPT=false");
  lines.push("  DB_TRUST_SERVER_CERTIFICATE=true");
  lines.push("");
  lines.push("  # Profile databases — any DB_<NAME> not in the reserved list above:");
  lines.push("  DB_TENANT=TenantDB");
  lines.push("  DB_GLOBAL=GlobalDB");
  lines.push("  DB_ADMIN=AdminDB");
  lines.push("  DB_GOGREEN=GoGreenDB");
  lines.push("");
  lines.push("  DB_ENV_FILE=.env   # path to .env file (default: .env)");

  return lines.join("\n");
}

function applyCliOverrides(
  connectionInfo: Record<string, any>,
  options: CliOptions
): Record<string, any> {
  const overrides = { ...connectionInfo };

  if (typeof options.server === "string") overrides.server = options.server;
  if (typeof options.user === "string") overrides.user = options.user;
  if (typeof options.password === "string") overrides.password = options.password;
  if (typeof options.port === "string") {
    const parsed = Number.parseInt(options.port, 10);
    if (!Number.isNaN(parsed)) overrides.port = parsed;
  }

  return overrides;
}

let isShuttingDown = false;

async function shutdown(exitCode = 0): Promise<never> {
  if (!isShuttingDown) {
    isShuttingDown = true;
    await closeDatabase();
  }

  process.exit(exitCode);
}

async function run(): Promise<number> {
  const args = process.argv.slice(2);
  const config = loadConfig();

  if (args.length === 0 || args.includes("--help") || args.includes("help")) {
    return writeUsage(buildUsage(listProfiles(config)));
  }

  const parsed = parseArguments(args);

  if (parsed.options["list-profiles"] === true) {
    return writeUsage(listProfiles(config));
  }

  if (!parsed.profile) {
    throw new Error("A database profile is required. Run with --help to see available profiles.");
  }

  const databaseName = resolveDatabase(config, parsed.profile);

  if (!parsed.command) {
    throw new Error(`A command is required. Run with --help to see available commands.`);
  }

  if (!isCliCommandName(parsed.command)) {
    throw new Error(`Unknown command: "${parsed.command}". Run with --help to see available commands.`);
  }

  if (!config.server) {
    throw new Error(
      "No server configured. Set 'server' in your config file or SQLCLI_SERVER environment variable."
    );
  }

  const commandName: CliCommandName = parsed.command;

  const baseConnection = {
    server: config.server,
    database: databaseName,
    user: config.user,
    password: config.password,
    port: config.port,
    trustServerCertificate: config.trustServerCertificate,
  };

  const connectionInfo = applyCliOverrides(baseConnection, parsed.options);

  await initDatabase(connectionInfo, "sqlserver");
  const response = await executeCliCommand(commandName, parsed.options);
  return writeToolResponse(response);
}

process.on("SIGINT", () => {
  void shutdown(130);
});

process.on("SIGTERM", () => {
  void shutdown(143);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  void shutdown(writeCliError(message));
});

process.on("uncaughtException", (error) => {
  void shutdown(writeCliError(error.message));
});

void run()
  .then(async (exitCode) => {
    await shutdown(exitCode);
  })
  .catch(async (error: Error) => {
    await shutdown(writeCliError(error.message));
  });
