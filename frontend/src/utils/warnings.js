export function dedupeWarnings(warnings) {
  const seen = new Set();
  const list = Array.isArray(warnings) ? warnings : [];

  return list.filter((warning) => {
    const key =
      typeof warning === "string"
        ? warning
        : `${warning?.code ?? ""}|${warning?.provider ?? ""}|${warning?.message ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
