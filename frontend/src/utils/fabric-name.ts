// utils/fabricNameGenerator.ts
const adjectives = [
  "silken", "woven", "plush", "crisp", "matte", "lustrous", "soft", "vivid"
];

const nouns = [
  "linen", "velvet", "twill", "canvas", "jacquard", "chiffon", "hemp", "cotton"
];

export function generateFabricName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}`;
}
