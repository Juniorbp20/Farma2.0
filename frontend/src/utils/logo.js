const API_URL = process.env.REACT_APP_API_URL || "";

export function resolveLogoSrc(rawPath) {
  const input = (rawPath || "").trim();
  if (!input) return "";
  if (/^https?:\/\//i.test(input) || input.startsWith("data:")) return input;
  const sanitized = input.replace(/\\/g, "/");
  if (sanitized.startsWith("/")) {
    return `${API_URL}${sanitized}`;
  }
  if (sanitized.startsWith("recursos_sistema/")) {
    return `${API_URL}/${sanitized.replace("recursos_sistema", "recursos")}`;
  }
  const recursosIdx = sanitized.indexOf("recursos_sistema/");
  if (recursosIdx >= 0) {
    const relative = sanitized
      .slice(recursosIdx)
      .replace("recursos_sistema", "recursos");
    const withSlash = relative.startsWith("/") ? relative : `/${relative}`;
    return `${API_URL}${withSlash}`;
  }
  if (sanitized.startsWith("recursos/")) {
    return `${API_URL}/${sanitized}`;
  }
  return `${API_URL}/recursos/${sanitized}`;
}

