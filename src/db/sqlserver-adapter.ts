import { DbAdapter } from "./adapter.js";
import sql from 'mssql';

export class SqlServerAdapter implements DbAdapter {
  private pool: sql.ConnectionPool | null = null;
  private config: sql.config;
  private server: string;
  private database: string;

  constructor(connectionInfo: {
    server: string;
    database: string;
    user?: string;
    password?: string;
    port?: number;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    options?: any;
  }) {
    this.server = connectionInfo.server;
    this.database = connectionInfo.database;

    this.config = {
      server: connectionInfo.server,
      database: connectionInfo.database,
      port: connectionInfo.port || 1433,
      requestTimeout: 30_000,
      connectionTimeout: 15_000,
      pool: {
        min: 1,
        max: 10,
        idleTimeoutMillis: 30_000,
      },
      options: {
        encrypt: connectionInfo.encrypt ?? true,
        trustServerCertificate: connectionInfo.trustServerCertificate ?? false,
        enableArithAbort: true,
        ...connectionInfo.options,
      },
    };

    if (connectionInfo.user && connectionInfo.password) {
      this.config.user = connectionInfo.user;
      this.config.password = connectionInfo.password;
    } else {
      this.config.options!.trustedConnection = true;
    }
  }

  async init(): Promise<void> {
    try {
      console.error(`[INFO] Connecting to SQL Server: ${this.server}, Database: ${this.database}`);
      this.pool = await new sql.ConnectionPool(this.config).connect();
      console.error(`[INFO] SQL Server connection established successfully`);
    } catch (err) {
      console.error(`[ERROR] SQL Server connection error: ${(err as Error).message}`);
      throw new Error(`Failed to connect to SQL Server: ${(err as Error).message}`);
    }
  }

  private bindParams(request: sql.Request, query: string, params: any[]): string {
    let index = 0;
    const prepared = query.replace(/\?/g, () => {
      const name = `param${index}`;
      request.input(name, params[index]);
      index += 1;
      return `@${name}`;
    });
    return prepared;
  }

  async all(query: string, params: any[] = []): Promise<any[]> {
    if (!this.pool) throw new Error("Database not initialized");

    try {
      const request = this.pool.request();
      const prepared = this.bindParams(request, query, params);
      const result = await request.query(prepared);
      return result.recordset;
    } catch (err) {
      throw new Error(`SQL Server query error: ${(err as Error).message}`);
    }
  }

  async run(query: string, params: any[] = []): Promise<{ changes: number; lastID: number }> {
    if (!this.pool) throw new Error("Database not initialized");

    try {
      const request = this.pool.request();
      const prepared = this.bindParams(request, query, params);

      let lastID = 0;
      let changes = 0;

      if (query.trim().toUpperCase().startsWith('INSERT')) {
        request.output('insertedId', sql.Int, 0);
        const result = await request.query(`${prepared}; SELECT @insertedId = SCOPE_IDENTITY();`);
        lastID = result.output.insertedId || 0;
        changes = result.rowsAffected[0] ?? 0;
      } else {
        const result = await request.query(prepared);
        changes = result.rowsAffected[0] ?? 0;
      }

      return { changes, lastID };
    } catch (err) {
      throw new Error(`SQL Server query error: ${(err as Error).message}`);
    }
  }

  async exec(query: string): Promise<void> {
    if (!this.pool) throw new Error("Database not initialized");

    try {
      await this.pool.request().batch(query);
    } catch (err) {
      throw new Error(`SQL Server batch error: ${(err as Error).message}`);
    }
  }

  async executeSP(name: string, params: Record<string, any> = {}): Promise<any[][]> {
    if (!this.pool) throw new Error("Database not initialized");

    try {
      const request = this.pool.request();

      for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
      }

      const result = await request.execute(name);
      const sets = result.recordsets;
      return (Array.isArray(sets) ? sets : Object.values(sets)) as any[][];
    } catch (err) {
      throw new Error(`Stored procedure error: ${(err as Error).message}`);
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  getMetadata(): { name: string; type: string; server: string; database: string } {
    return {
      name: "SQL Server",
      type: "sqlserver",
      server: this.server,
      database: this.database,
    };
  }

  getListTablesQuery(): string {
    return "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
  }

  getDescribeTableQuery(tableName: string): string {
    // Escape single quotes to prevent injection (table name is not parameterisable here
    // because the interface returns a plain string consumed by dbAll with no params slot).
    const safeName = tableName.replace(/'/g, "''");
    return `
      SELECT
        c.COLUMN_NAME  AS name,
        c.DATA_TYPE    AS type,
        CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS notnull,
        CASE WHEN pk.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN 1 ELSE 0 END AS pk,
        c.COLUMN_DEFAULT AS dflt_value
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON c.TABLE_NAME = kcu.TABLE_NAME AND c.COLUMN_NAME = kcu.COLUMN_NAME
      LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS pk
        ON kcu.CONSTRAINT_NAME = pk.CONSTRAINT_NAME AND pk.CONSTRAINT_TYPE = 'PRIMARY KEY'
      WHERE c.TABLE_NAME = '${safeName}'
      ORDER BY c.ORDINAL_POSITION
    `;
  }
}
