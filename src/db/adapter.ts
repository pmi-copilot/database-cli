import { SqlServerAdapter } from './sqlserver-adapter.js';

export interface DbAdapter {
  init(): Promise<void>;
  close(): Promise<void>;
  all(query: string, params?: any[]): Promise<any[]>;
  run(query: string, params?: any[]): Promise<{ changes: number; lastID: number }>;
  exec(query: string): Promise<void>;
  executeSP(name: string, params?: Record<string, any>): Promise<any[][]>;
  getMetadata(): { name: string; type: string; server?: string; database?: string };
  getListTablesQuery(): string;
  getDescribeTableQuery(tableName: string): string;
}

export function createDbAdapter(type: string, connectionInfo: any): DbAdapter {
  if (type.toLowerCase() !== 'sqlserver') {
    throw new Error(`Unsupported database type: ${type}. Only "sqlserver" is supported.`);
  }
  return new SqlServerAdapter(connectionInfo);
}
