import React, { useRef, useState } from "react";
import { useTrackOnce } from "@/lib/analytics";
import { Save, X } from "lucide-react";

import { PageHeader } from "@/components/DashboardChrome";
import ProductPage from "@/components/layout/ProductPage";
import ProfileTab from "@/components/workspace/ProfileTab";
import useUserCookie from "@/hooks/use-auth";
import { useTheme } from "@/hooks/useTheme";

const ProfilePage: React.FC = () => {
  useTrackOnce("profile_viewed");
  const { theme } = useTheme();
  const { user } = useUserCookie();
  const [isEditMode, setIsEditMode] = useState(false);
  const saveProfileRef = useRef<(() => void) | null>(null);
  const cancelProfileRef = useRef<(() => void) | null>(null);

  return (
    <>
      <PageHeader
        actions={isEditMode ? (
          <>
            <button
              onClick={() => {
                cancelProfileRef.current?.();
                setIsEditMode(false);
              }}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                theme === "dark"
                  ? "border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-300"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
              }`}
            >
              <X className="h-4 w-4" /> Cancel
            </button>
            <button
              onClick={() => saveProfileRef.current?.()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--pulse-brand)] px-3 text-sm font-semibold text-[var(--pulse-ink)] transition-colors hover:bg-[var(--pulse-brand-hover)]"
            >
              <Save className="h-4 w-4" /> Save
            </button>
          </>
        ) : null}
      />
      <ProductPage maxWidth="max-w-[960px]">
        <ProfileTab
          clientDetails={user?.client || {
            name: user?.organization_name,
          }}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          saveProfileRef={saveProfileRef}
          cancelProfileRef={cancelProfileRef}
        />
      </ProductPage>
    </>
  );
};

export default ProfilePage;
