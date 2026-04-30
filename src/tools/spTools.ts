import { dbAll, dbExecuteSP } from '../db/index.js';
import { formatSuccessResponse } from '../utils/formatUtils.js';

const BLOCKED_SP_NAMES = new Set([
  "sp_executesql",
  "sp_execute",
  "sp_prepexec",
  "sp_prepexecrpc",
  "xp_cmdshell",
  "xp_regread",
  "xp_regwrite",
  "xp_regdeletevalue",
  "xp_regdeletekey",
  "sp_oacreate",
  "sp_oamethod",
  "sp_oagetproperty",
  "sp_oasetproperty",
  "sp_oastop",
  "sp_oadestroy",
]);

function validateSPName(name: string): void {
  if (!/^[\w\[\]. @#]+$/.test(name)) {
    throw new Error(
      `Invalid stored procedure name: "${name}". Only letters, digits, _, @, #, ., [], and spaces are allowed.`
    );
  }

  const baseName = name.split(".").pop()?.replace(/[\[\]]/g, "").toLowerCase() ?? "";
  if (BLOCKED_SP_NAMES.has(baseName)) {
    throw new Error(
      `Stored procedure '${name}' is blocked because it can execute arbitrary SQL or OS commands.`
    );
  }
}

export async function listSPs() {
  try {
    const rows = await dbAll(
      "SELECT name, create_date, modify_date FROM sys.procedures ORDER BY name"
    );
    return formatSuccessResponse(rows);
  } catch (error: any) {
    throw new Error(`Error listing stored procedures: ${error.message}`);
  }
}

export async function describeSP(name: string) {
  try {
    if (!name) throw new Error("Stored procedure name is required");

    validateSPName(name);

    // Parameterized — no string interpolation of user input into SQL
    const rows = await dbAll(
      "SELECT OBJECT_DEFINITION(OBJECT_ID(?)) AS definition",
      [name]
    );

    const definition = rows[0]?.definition;
    if (!definition) {
      throw new Error(`Stored procedure '${name}' not found or has no readable definition`);
    }

    return formatSuccessResponse({ name, definition });
  } catch (error: any) {
    throw new Error(`Error describing stored procedure: ${error.message}`);
  }
}

export async function execSP(name: string, params: Record<string, any> = {}) {
  try {
    if (!name) throw new Error("Stored procedure name is required");

    validateSPName(name);

    const recordsets = await dbExecuteSP(name, params);

    if (recordsets.length === 1) {
      return formatSuccessResponse(recordsets[0]);
    }

    const result: Record<string, any[]> = {};
    recordsets.forEach((rs, i) => {
      result[`recordset_${i + 1}`] = rs;
    });

    return formatSuccessResponse(result);
  } catch (error: any) {
    throw new Error(`Error executing stored procedure: ${error.message}`);
  }
}
