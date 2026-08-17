export function toJsonSafe<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === "bigint") return item.toString();
      if (item instanceof Uint8Array) {
        return { $type: "bytes", base64: Buffer.from(item).toString("base64") };
      }
      return item;
    }),
  ) as unknown;
}

export function toolResult(value: unknown) {
  const safe = toJsonSafe(value);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(safe, null, 2) }],
    structuredContent:
      typeof safe === "object" && safe !== null && !Array.isArray(safe)
        ? (safe as Record<string, unknown>)
        : { value: safe },
  };
}
