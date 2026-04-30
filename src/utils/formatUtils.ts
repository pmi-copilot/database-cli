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

export function formatErrorResponse(error: Error | string): { content: Array<{ type: string; text: string }>; isError: boolean } {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

export function formatSuccessResponse(data: any): { content: Array<{ type: string; text: string }>; isError: boolean } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError: false,
  };
}
