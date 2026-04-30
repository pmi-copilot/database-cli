import { dbAll } from '../db/index.js';
import { formatSuccessResponse } from '../utils/formatUtils.js';

// ── Views ─────────────────────────────────────────────────────────────────────

export async function listViews() {
  try {
    const rows = await dbAll(`
      SELECT
        SCHEMA_NAME(schema_id) AS schema_name,
        name,
        create_date,
        modify_date
      FROM sys.views
      ORDER BY schema_name, name
    `);
    return formatSuccessResponse(rows);
  } catch (error: any) {
    throw new Error(`Error listing views: ${error.message}`);
  }
}

export async function describeView(name: string) {
  try {
    if (!name) throw new Error("View name is required");

    // Parameterized — no string interpolation of user input into SQL
    const rows = await dbAll(
      "SELECT OBJECT_DEFINITION(OBJECT_ID(?)) AS definition",
      [name]
    );

    const definition = rows[0]?.definition;
    if (!definition) throw new Error(`View '${name}' not found or has no readable definition`);

    return formatSuccessResponse({ name, definition });
  } catch (error: any) {
    throw new Error(`Error describing view: ${error.message}`);
  }
}

// ── Functions ─────────────────────────────────────────────────────────────────

export async function listFunctions() {
  try {
    const rows = await dbAll(`
      SELECT
        SCHEMA_NAME(schema_id) AS schema_name,
        name,
        type_desc,
        create_date,
        modify_date
      FROM sys.objects
      WHERE type IN ('FN', 'IF', 'TF')
      ORDER BY schema_name, name
    `);
    return formatSuccessResponse(rows);
  } catch (error: any) {
    throw new Error(`Error listing functions: ${error.message}`);
  }
}

export async function describeFunction(name: string) {
  try {
    if (!name) throw new Error("Function name is required");

    const rows = await dbAll(
      "SELECT OBJECT_DEFINITION(OBJECT_ID(?)) AS definition",
      [name]
    );

    const definition = rows[0]?.definition;
    if (!definition) throw new Error(`Function '${name}' not found or has no readable definition`);

    return formatSuccessResponse({ name, definition });
  } catch (error: any) {
    throw new Error(`Error describing function: ${error.message}`);
  }
}

// ── Triggers ──────────────────────────────────────────────────────────────────

export async function listTriggers() {
  try {
    const rows = await dbAll(`
      SELECT
        t.name,
        OBJECT_NAME(t.parent_id) AS table_name,
        t.type_desc,
        t.is_disabled,
        t.create_date,
        t.modify_date
      FROM sys.triggers t
      ORDER BY table_name, t.name
    `);
    return formatSuccessResponse(rows);
  } catch (error: any) {
    throw new Error(`Error listing triggers: ${error.message}`);
  }
}

export async function describeTrigger(name: string) {
  try {
    if (!name) throw new Error("Trigger name is required");

    const rows = await dbAll(
      "SELECT OBJECT_DEFINITION(OBJECT_ID(?)) AS definition",
      [name]
    );

    const definition = rows[0]?.definition;
    if (!definition) throw new Error(`Trigger '${name}' not found or has no readable definition`);

    return formatSuccessResponse({ name, definition });
  } catch (error: any) {
    throw new Error(`Error describing trigger: ${error.message}`);
  }
}

// ── Indexes ───────────────────────────────────────────────────────────────────

export async function listIndexes(tableName: string) {
  try {
    if (!tableName) throw new Error("Table name is required");

    // Parameterized — user-supplied table name never interpolated into SQL text
    const rows = await dbAll(`
      SELECT
        i.name,
        i.type_desc,
        i.is_unique,
        i.is_primary_key,
        i.is_unique_constraint,
        i.is_disabled,
        STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE OBJECT_NAME(i.object_id) = ?
        AND i.name IS NOT NULL
        AND ic.is_included_column = 0
      GROUP BY i.name, i.type_desc, i.is_unique, i.is_primary_key, i.is_unique_constraint, i.is_disabled
      ORDER BY i.is_primary_key DESC, i.name
    `, [tableName]);

    if (rows.length === 0) throw new Error(`Table '${tableName}' not found or has no indexes`);

    return formatSuccessResponse(rows);
  } catch (error: any) {
    throw new Error(`Error listing indexes: ${error.message}`);
  }
}

// ── Constraints ───────────────────────────────────────────────────────────────

export async function listConstraints(tableName: string) {
  try {
    if (!tableName) throw new Error("Table name is required");

    const rows = await dbAll(`
      SELECT
        tc.CONSTRAINT_NAME AS name,
        tc.CONSTRAINT_TYPE AS type,
        STRING_AGG(kcu.COLUMN_NAME, ', ') WITHIN GROUP (ORDER BY kcu.ORDINAL_POSITION) AS columns,
        rc.UNIQUE_CONSTRAINT_NAME AS references_constraint,
        ccu2.TABLE_NAME AS references_table
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_NAME = kcu.TABLE_NAME
      LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      LEFT JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu2
        ON rc.UNIQUE_CONSTRAINT_NAME = ccu2.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = ?
      GROUP BY tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE, rc.UNIQUE_CONSTRAINT_NAME, ccu2.TABLE_NAME
      ORDER BY tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME
    `, [tableName]);

    if (rows.length === 0) throw new Error(`Table '${tableName}' not found or has no constraints`);

    return formatSuccessResponse(rows);
  } catch (error: any) {
    throw new Error(`Error listing constraints: ${error.message}`);
  }
}
