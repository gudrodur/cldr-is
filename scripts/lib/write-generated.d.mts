export function writeGenerated(
  path: string,
  data: Record<string, unknown>,
  today?: string,
): "created" | "updated" | "unchanged";
