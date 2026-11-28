export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[];

function flatten(input: ClassValue, out: string[]): void {
  if (!input) return;
  if (typeof input === "string" || typeof input === "number") {
    out.push(String(input));
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      flatten(item, out);
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    flatten(input, out);
  }
  return out.join(" ");
}
