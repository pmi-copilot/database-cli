type ToolResponseContent = {
  type: string;
  text: string;
};

export type ToolResponse = {
  content: ToolResponseContent[];
  isError: boolean;
};

function getPrimaryText(response: ToolResponse): string {
  return response.content[0]?.text ?? "";
}

export function writeToolResponse(response: ToolResponse): number {
  const text = getPrimaryText(response);

  if (response.isError) {
    if (text) {
      console.error(text);
    }
    return 1;
  }

  if (text) {
    console.log(text);
  }

  return 0;
}

export function writeUsage(message: string): number {
  console.log(message);
  return 0;
}

export function writeCliError(message: string): number {
  console.error(JSON.stringify({ error: message }, null, 2));
  return 1;
}