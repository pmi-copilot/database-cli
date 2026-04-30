const MAX_COL_WIDTH = 50;

export function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header];
      if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
      return val === null || val === undefined ? '' : val;
    });
    rows.push(values.join(','));
  }

  return rows.join('\n');
}

export function convertToTable(data: any[]): string {
  if (data.length === 0) return '(no rows)';

  const headers = Object.keys(data[0]);

  const cell = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    const s = String(val);
    return s.length > MAX_COL_WIDTH ? s.slice(0, MAX_COL_WIDTH - 3) + '...' : s;
  };

  const widths = headers.map((h) => h.length);
  for (const row of data) {
    headers.forEach((h, i) => {
      widths[i] = Math.max(widths[i], cell(row[h]).length);
    });
  }

  const line = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const head = '|' + headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('|') + '|';
  const dataRows = data.map(
    (row) =>
      '|' +
      headers.map((h, i) => ` ${cell(row[h]).padEnd(widths[i])} `).join('|') +
      '|'
  );

  return [line, head, line, ...dataRows, line].join('\n');
}

export function formatErrorResponse(error: Error | string): { content: Array<{ type: string; text: string }>; isError: boolean } {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

export function formatSuccessResponse(data: any, format?: 'json' | 'table'): { content: Array<{ type: string; text: string }>; isError: boolean } {
  if (format === 'table' && Array.isArray(data)) {
    return {
      content: [{ type: "text", text: convertToTable(data) }],
      isError: false,
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError: false,
  };
}
