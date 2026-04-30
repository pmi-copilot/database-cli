import { dbAll, getListTablesQuery, getDescribeTableQuery } from '../db/index.js';
import { formatSuccessResponse } from '../utils/formatUtils.js';

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
    if (!tableName) {
      throw new Error("Table name is required");
    }

    const columns = await dbAll(getDescribeTableQuery(tableName));

    if (columns.length === 0) {
      throw new Error(`Table '${tableName}' does not exist or has no columns`);
    }

    return formatSuccessResponse(
      columns.map((col) => ({
        name: col.name,
        type: col.type,
        notnull: !!col.notnull,
        default_value: col.dflt_value,
        primary_key: !!col.pk,
      }))
    );
  } catch (error: any) {
    throw new Error(`Error describing table: ${error.message}`);
  }
}
