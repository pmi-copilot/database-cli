import { readQuery, exportQuery } from "../tools/queryTools.js";
import { listTables, describeTable } from "../tools/schemaTools.js";
import { listSPs, describeSP, execSP } from "../tools/spTools.js";
import {
  listViews, describeView,
  listFunctions, describeFunction,
  listTriggers, describeTrigger,
  listIndexes, listConstraints,
} from "../tools/objectTools.js";
import type { ToolResponse } from "./output.js";

export type CliOptions = Record<string, string | boolean>;

export type CliCommandName =
  | "read-query"
  | "export-query"
  | "list-tables"
  | "describe-table"
  | "list-views"
  | "describe-view"
  | "list-functions"
  | "describe-function"
  | "list-sp"
  | "describe-sp"
  | "exec-sp"
  | "list-triggers"
  | "describe-trigger"
  | "list-indexes"
  | "list-constraints";

type CliCommandDefinition = {
  description: string;
  usage: string;
  execute: (options: CliOptions) => Promise<ToolResponse>;
};

function getStringOption(options: CliOptions, key: string): string {
  const value = options[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required option: --${key}`);
  }
  return value;
}

const commandDefinitions: Record<CliCommandName, CliCommandDefinition> = {
  // ── Queries ────────────────────────────────────────────────────────────────
  "read-query": {
    description: "Execute a SELECT query and print JSON results.",
    usage: "read-query --query \"SELECT TOP 10 * FROM dbo.Users\"",
    execute: async (options) => readQuery(getStringOption(options, "query")),
  },
  "export-query": {
    description: "Execute a SELECT query and export as CSV or JSON.",
    usage: "export-query --format csv --query \"SELECT * FROM dbo.Users\"",
    execute: async (options) => {
      const format = getStringOption(options, "format").toLowerCase();
      return exportQuery(getStringOption(options, "query"), format);
    },
  },

  // ── Tables ─────────────────────────────────────────────────────────────────
  "list-tables": {
    description: "List all tables in the database.",
    usage: "list-tables",
    execute: async () => listTables(),
  },
  "describe-table": {
    description: "Show columns and types for a table.",
    usage: "describe-table --table Cockpit_Master",
    execute: async (options) => describeTable(getStringOption(options, "table")),
  },

  // ── Views ──────────────────────────────────────────────────────────────────
  "list-views": {
    description: "List all views in the database.",
    usage: "list-views",
    execute: async () => listViews(),
  },
  "describe-view": {
    description: "Show the definition (SQL) of a view.",
    usage: "describe-view --view dbo.ActiveUsers",
    execute: async (options) => describeView(getStringOption(options, "view")),
  },

  // ── Functions ──────────────────────────────────────────────────────────────
  "list-functions": {
    description: "List all functions (scalar, inline TVF, TVF).",
    usage: "list-functions",
    execute: async () => listFunctions(),
  },
  "describe-function": {
    description: "Show the definition (SQL) of a function.",
    usage: "describe-function --function dbo.GetHotelRevenue",
    execute: async (options) => describeFunction(getStringOption(options, "function")),
  },

  // ── Stored Procedures ──────────────────────────────────────────────────────
  "list-sp": {
    description: "List all stored procedures.",
    usage: "list-sp",
    execute: async () => listSPs(),
  },
  "describe-sp": {
    description: "Show the definition (SQL) of a stored procedure.",
    usage: "describe-sp --sp Aggregated.GetHotelData",
    execute: async (options) => describeSP(getStringOption(options, "sp")),
  },
  "exec-sp": {
    description: "Execute a stored procedure and return results.",
    usage: "exec-sp --sp dbo.GetHotelData --params '{\"HotelId\":10}'",
    execute: async (options) => {
      const name = getStringOption(options, "sp");
      const rawParams = options.params;
      const params = typeof rawParams === "string" ? JSON.parse(rawParams) : {};
      return execSP(name, params);
    },
  },

  // ── Triggers ───────────────────────────────────────────────────────────────
  "list-triggers": {
    description: "List all triggers in the database.",
    usage: "list-triggers",
    execute: async () => listTriggers(),
  },
  "describe-trigger": {
    description: "Show the definition (SQL) of a trigger.",
    usage: "describe-trigger --trigger trg_AuditUsers",
    execute: async (options) => describeTrigger(getStringOption(options, "trigger")),
  },

  // ── Indexes & Constraints ──────────────────────────────────────────────────
  "list-indexes": {
    description: "List all indexes on a table.",
    usage: "list-indexes --table Cockpit_Master",
    execute: async (options) => listIndexes(getStringOption(options, "table")),
  },
  "list-constraints": {
    description: "List all constraints (PK, FK, check, unique) on a table.",
    usage: "list-constraints --table Cockpit_Master",
    execute: async (options) => listConstraints(getStringOption(options, "table")),
  },
};

export function isCliCommandName(value: string): value is CliCommandName {
  return value in commandDefinitions;
}

export async function executeCliCommand(name: CliCommandName, options: CliOptions): Promise<ToolResponse> {
  return commandDefinitions[name].execute(options);
}

export function getCommandDefinitions(): Record<CliCommandName, CliCommandDefinition> {
  return commandDefinitions;
}
