import { dbAll, getListTablesQuery, getDescribeTableQuery } from '../db/index.js';
import { convertToTable, formatSuccessResponse } from '../utils/formatUtils.js';

export async function listTables() {
  try {
    const tables = await dbAll(getListTablesQuery());
    return formatSuccessResponse(tables.map((t) => t.name));
  } catch (error: any) {
    throw new Error(`Error listing tables: ${error.message}`);
  }
}

export async function describeTable(tableName: string) {
  try {
    if (!tableName) throw new Error("Table name is required");

    const columns = await dbAll(getDescribeTableQuery(tableName));

    if (columns.length === 0) {
      throw new Error(`Table '${tableName}' does not exist or has no columns`);
    }

    return formatSuccessResponse(
      columns.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: !col.notnull,
        default_value: col.dflt_value,
        primary_key: !!col.pk,
      }))
    );
  } catch (error: any) {
    throw new Error(`Error describing table: ${error.message}`);
  }
}

export async function previewTable(tableName: string) {
  try {
    if (!tableName) throw new Error("Table name is required");

    const [columns, sample] = await Promise.all([
      dbAll(getDescribeTableQuery(tableName)),
      dbAll("SELECT TOP 3 * FROM [" + tableName.replace(/]/g, "]]") + "]"),
    ]);

    if (columns.length === 0) {
      throw new Error(`Table '${tableName}' does not exist or has no columns`);
    }

    const schemaTable = convertToTable(
      columns.map((col) => ({
        column: col.name,
        type: col.type,
        nullable: col.notnull ? "NO" : "YES",
        primary_key: col.pk ? "YES" : "",
        default: col.dflt_value ?? "",
      }))
    );

    const sampleTable = sample.length > 0 ? convertToTable(sample) : "(no rows)";

    return {
      content: [{
        type: "text",
        text: `── Schema: ${tableName} ──\n${schemaTable}\n\n── Sample rows (TOP 3) ──\n${sampleTable}`,
      }],
      isError: false,
    };
  } catch (error: any) {
    throw new Error(`Error previewing table: ${error.message}`);
  }
}
