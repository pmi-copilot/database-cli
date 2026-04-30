import { dbAll } from '../db/index.js';
import { formatSuccessResponse, convertToCSV } from '../utils/formatUtils.js';

// Keywords that indicate a write or dangerous operation.
// Checked in the query body AFTER stripping the leading SELECT.
const WRITE_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|truncate|exec|execute|merge|grant|revoke|into|openrowset|opendatasource|openquery|bulk)\b/i;

function stripQuery(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''")   // SQL string literals (handles '' escapes inside)
    .replace(/\/\*[\s\S]*?\*\//g, " ")  // block comments  /* ... */
    .replace(/--[^\n]*/g, " ");         // line comments   -- ...
}

function assertReadOnly(query: string): void {
  const trimmed = query.trim();

  if (!trimmed.toLowerCase().startsWith("select")) {
    throw new Error("Only SELECT queries are allowed.");
  }

  if (trimmed.includes(";")) {
    throw new Error("Multiple statements are not allowed. Remove the semicolon.");
  }

  // Strip literals and comments, then scan the body after the leading SELECT
  const afterSelect = stripQuery(trimmed).replace(/^\s*select\b/i, "");

  if (WRITE_KEYWORDS.test(afterSelect)) {
    throw new Error(
      "Query contains a disallowed operation (write keyword, SELECT INTO, or external rowset)."
    );
  }
}

export async function readQuery(query: string) {
  assertReadOnly(query);

  try {
    const result = await dbAll(query);
    return formatSuccessResponse(result);
  } catch (error: any) {
    throw new Error(`SQL Error: ${error.message}`);
  }
}

export async function exportQuery(query: string, format: string) {
  assertReadOnly(query);

  try {
    const result = await dbAll(query);

    if (format === "csv") {
      return {
        content: [{ type: "text", text: convertToCSV(result) }],
        isError: false,
      };
    } else if (format === "json") {
      return formatSuccessResponse(result);
    } else {
      throw new Error("Unsupported export format. Use 'csv' or 'json'.");
    }
  } catch (error: any) {
    throw new Error(`Export Error: ${error.message}`);
  }
}
