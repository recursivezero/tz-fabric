export function normalizeMarkdown(input: string): string {
  return input
    .replace(/(\d+)\.\s+/g, "\n$1. ") 
    .replace(/-\s+/g, "\n- ")         
    .replace(/\n{2,}/g, "\n\n")       
}