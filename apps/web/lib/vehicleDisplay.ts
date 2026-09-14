export function formatTeslaModel(
  model: string | null | undefined,
): string | null {
  const value = model?.trim();
  if (!value) return null;

  const normalized = value
    .replace(/^tesla\s+/i, "")
    .replace(/^model\s+/i, "")
    .trim();

  if (!normalized) return null;

  return `Tesla ${normalized}`;
}
