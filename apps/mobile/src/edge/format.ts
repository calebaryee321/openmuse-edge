export function formatBytes(value?: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${Math.round(value)} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let current = value / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && current >= 1024; index += 1) {
    current /= 1024;
    unit = units[index];
  }

  return `${current >= 10 ? current.toFixed(0) : current.toFixed(1)} ${unit}`;
}
