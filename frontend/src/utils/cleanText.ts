export function cleanText(input: string): string {
  return input
    .replace(/[*_~`]/g, "")   
    .replace(/\\n/g, " ")     
    .replace(/\s+/g, " ")     
    .trim();
}
