type ClientBrandingInput = {
  id?: string | null;
  name?: string | null;
  logo_file?: {
    file_path?: string | null;
  } | null;
};

const absoluteAsset = (path: string, baseUrl = "") => {
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath;
};

/**
 * Client marks live in object storage (DigitalOcean Spaces) and reach the app as
 * logo_file.file_path on the client record, put there by the presign upload flow
 * in the API's files module. Nothing is bundled with the build: shipping sample
 * customer logos in the repo meant committing third-party trademarks, and it hid
 * a missing upload behind a plausible-looking mark.
 *
 * A client with no uploaded logo returns null, and the caller renders initials
 * instead — see ClientLogo and Sidebar.
 */
export const getClientLogoSrc = (
  client?: ClientBrandingInput | null,
  baseUrl = "",
) => {
  const uploadedPath = client?.logo_file?.file_path;
  if (uploadedPath) return absoluteAsset(uploadedPath, baseUrl);

  return null;
};

export const getClientInitials = (name?: string | null) =>
  String(name || "Client")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
