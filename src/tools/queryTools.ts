import { dbAll } from '../db/index.js';
import { formatSuccessResponse, convertToCSV, convertToTable } from '../utils/formatUtils.js';

const WRITE_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|truncate|exec|execute|merge|grant|revoke|into|openrowset|opendatasource|openquery|bulk)\b/i;

function stripQuery(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

function assertReadOnly(query: string): void {
  const trimmed = query.trim();

  if (!trimmed.toLowerCase().startsWith("select")) {
    throw new Error("Only SELECT queries are allowed.");
  }

  if (trimmed.includes(";")) {
    throw new Error("Multiple statements are not allowed. Remove the semicolon.");
  }

  const afterSelect = stripQuery(trimmed).replace(/^\s*select\b/i, "");

  if (WRITE_KEYWORDS.test(afterSelect)) {
    throw new Error(
      "Query contains a disallowed operation (write keyword, SELECT INTO, or external rowset)."
    );
  }
}

export async function readQuery(query: string, format: 'json' | 'table' = 'json') {
  assertReadOnly(query);

  try {
    const result = await dbAll(query);
    return formatSuccessResponse(result, format);
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
    } else if (format === "table") {
      return {
        content: [{ type: "text", text: convertToTable(result) }],
        isError: false,
      };
    } else {
      throw new Error("Unsupported format. Use 'json', 'csv', or 'table'.");
    }
  } catch (error: any) {
    throw new Error(`Export Error: ${error.message}`);
  }
}
