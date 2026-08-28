type ClientBrandingInput = {
  id?: string | null;
  name?: string | null;
  logo_file?: {
    file_path?: string | null;
  } | null;
};

const SAMPLE_CLIENT_LOGOS_BY_ID: Record<string, string> = {
  "client-1": "/assets/client-logos/acme-robotics.webp",
  "client-2": "/assets/client-logos/helix-biotech.png",
  "client-3": "/assets/client-logos/northwind-energy.png",
};

const SAMPLE_CLIENT_LOGOS_BY_NAME: Record<string, string> = {
  "acme robotics": "/assets/client-logos/acme-robotics.webp",
  "helix biotech": "/assets/client-logos/helix-biotech.png",
  "northwind energy": "/assets/client-logos/northwind-energy.png",
};

const absoluteAsset = (path: string, baseUrl = "") => {
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath;
};

/**
 * Uploaded client marks always win. The local mappings below make the mock
 * portfolio look realistic without relying on third-party image hotlinks.
 */
export const getClientLogoSrc = (
  client?: ClientBrandingInput | null,
  baseUrl = "",
) => {
  const uploadedPath = client?.logo_file?.file_path;
  if (uploadedPath) return absoluteAsset(uploadedPath, baseUrl);

  const id = String(client?.id || "");
  if (id && SAMPLE_CLIENT_LOGOS_BY_ID[id]) {
    return SAMPLE_CLIENT_LOGOS_BY_ID[id];
  }

  const name = String(client?.name || "").trim().toLowerCase();
  return SAMPLE_CLIENT_LOGOS_BY_NAME[name] || null;
};

export const getClientInitials = (name?: string | null) =>
  String(name || "Client")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
