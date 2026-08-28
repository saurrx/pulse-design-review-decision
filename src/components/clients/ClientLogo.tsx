import React, { useEffect, useMemo, useState } from "react";

import API_CONFIG from "@/lib/apiConfig";
import { getClientInitials, getClientLogoSrc } from "@/lib/clientBranding";

type ClientLogoProps = {
  client?: {
    id?: string | null;
    name?: string | null;
    logo_file?: { file_path?: string | null } | null;
  } | null;
  className?: string;
  fallbackClassName?: string;
};

const ClientLogo: React.FC<ClientLogoProps> = ({
  client,
  className = "max-h-full max-w-full object-contain",
  fallbackClassName = "text-xs font-semibold text-[var(--pulse-ink-secondary)]",
}) => {
  const src = useMemo(
    () =>
      getClientLogoSrc(
        client,
        String((API_CONFIG.defaults as { baseURL?: string }).baseURL || ""),
      ),
    [client],
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${client?.name || "Client"} logo`}
        className={className}
        crossOrigin="use-credentials"
        // 82 client cards means 82 authenticated streams through the API, each
        // a DB lookup plus an S3 GET. Only the handful actually on screen need
        // to be fetched; the rest arrive as the list is scrolled.
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={fallbackClassName}
      role="img"
      aria-label={`${client?.name || "Client"} initials`}
    >
      {getClientInitials(client?.name)}
    </span>
  );
};

export default ClientLogo;
