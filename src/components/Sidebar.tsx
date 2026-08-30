import React from "react";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  UserRound,
  ArrowLeftRight,
  UsersRound,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ROLE_LABEL } from "@/lib/roles";
import { useQuery } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { toast } from "sonner";

import API_CONFIG from "@/lib/apiConfig";
import { clearAuthSession } from "@/lib/auth";
import { track, identifyUser, resetUser } from "@/lib/analytics";
import { getClientLogoSrc } from "@/lib/clientBranding";
import useUserCookie from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  collapsed: boolean;
  toggleSidebar: () => void;
}

type Role = "INVENTOR" | "TECH_COMMITTEE" | "LEGAL_COUNSEL" | "CASE_OWNER" | "PHOTON_ADMIN" | "PHOTON_SUPERADMIN";

type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};


const initials = (name?: string, email?: string) =>
  (name || email || "Pulse User")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const ClientInitials = ({ name }: { name: string }) => {
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] text-[10px] font-semibold text-[var(--pulse-ink-secondary)]"
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
};

const navForRole = (role: Role | undefined, reviewCount: number): NavItem[] => {
  if (role === "INVENTOR") {
    return [
      { label: "Home", path: "/", icon: LayoutDashboard },
      { label: "My ideas", path: "/ideas", icon: Lightbulb },
      { label: "Patents", path: "/patents", icon: FileStack },
      // Profile is reachable from the user menu at the bottom of the sidebar;
      // a nav item for it duplicated that door on every role and is gone
      // everywhere in the same change.
    ];
  }

  if (role === "TECH_COMMITTEE") {
    // The committee reviews and passes to legal counsel — same working view as
    // counsel, but no workspace administration, so Profile instead of Settings.
    return [
      { label: "Overview", path: "/", icon: LayoutDashboard },
      {
        label: "Review queue",
        path: "/ideas",
        icon: ClipboardCheck,
        badge: reviewCount,
      },
      { label: "Patents", path: "/patents", icon: FileStack },
      { label: "Actions", path: "/due-dates", icon: CalendarDays },
    ];
  }

  if (role === "LEGAL_COUNSEL") {
    return [
      { label: "Overview", path: "/", icon: LayoutDashboard },
      {
        label: "Review queue",
        path: "/ideas",
        icon: ClipboardCheck,
        badge: reviewCount,
      },
      { label: "Patents", path: "/patents", icon: FileStack },
      { label: "Actions", path: "/due-dates", icon: CalendarDays },
      { label: "Workspace", path: "/workspace", icon: UsersRound },
    ];
  }

  const operationalItems: NavItem[] = [
    { label: "Overview", path: "/", icon: LayoutDashboard },
    { label: "Clients", path: "/clients", icon: Building2 },
    { label: "Ideas", path: "/ideas", icon: Lightbulb, badge: reviewCount },
    { label: "Patents", path: "/patents", icon: FileStack },
    // Two screens, two names, neither pretending to be the other. "Due Dates"
    // is the deadline calendar and list — the clock. "Actions" is the
    // operations queue — the work clients have instructed. The earlier round
    // collapsed them into one item because both were called Actions, which
    // pointed the label at the wrong screen; naming the calendar after what it
    // shows fixes that without hiding it.
    { label: "Due Dates", path: "/due-dates", icon: CalendarDays },
    { label: "Actions", path: "/actions", icon: FolderKanban },
  ];
  // Workspace administration is photon-admin only. Profile is deliberately
  // NOT a nav item for anyone — it already lives in the user menu at the
  // bottom of this sidebar, and two doors to the same page read as clutter.
  if (role === "PHOTON_ADMIN" || role === "PHOTON_SUPERADMIN") {
    operationalItems.push({ label: "Workspace", path: "/workspace", icon: UsersRound });
  }
  return operationalItems;
};

const Sidebar: React.FC<SidebarProps> = ({ collapsed, toggleSidebar }) => {
  const { user } = useUserCookie();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role as Role | undefined;
  const isReviewer =
    role === "TECH_COMMITTEE" || role === "LEGAL_COUNSEL" ||
    role === "PHOTON_ADMIN" || role === "PHOTON_SUPERADMIN" || role === "CASE_OWNER";

  // Counts only. The sidebar is on every page and this badge is one integer;
  // it used to fetch the whole idea corpus — each row hydrated with author,
  // client, inventors and patent link — to call .length on a filtered slice.
  const { data: queueCounts } = useQuery({
    queryKey: ["pulse-review-count", role],
    enabled: isReviewer,
    staleTime: 30_000,
    queryFn: async () =>
      (await API_CONFIG.get("/api/v1/idea/counts"))?.data,
  });

  const reviewStatuses =
    role === "TECH_COMMITTEE" ? ["UNDER_REVIEW"]
      : role === "LEGAL_COUNSEL" ? ["UNDER_REVIEW", "SENT_TO_IHC"]
      : ["SEND_TO_OC"];
  const reviewCount = reviewStatuses.reduce(
    (n, status) => n + Number(queueCounts?.data?.[status] ?? 0),
    0,
  );
  const items = navForRole(role, reviewCount);
  const workspaceName =
    user?.organization_name || user?.client?.name || "Photon Legal";
  const clientId = String(user?.client_id || user?.client?.id || "");
  const clientLogoSrc = getClientLogoSrc(
    {
      id: clientId,
      name: workspaceName,
      logo_file: user?.client?.logo_file,
    },
    String((API_CONFIG.defaults as { baseURL?: string }).baseURL || ""),
  );

  const isActive = (path: string) => {
    const pathname = path.split("?")[0];
    return pathname === "/"
      ? location.pathname === "/"
      : location.pathname === pathname ||
          location.pathname.startsWith(`${pathname}/`);
  };


  /** Leave "view as client": restore the admin token server-side, restore the
   *  saved admin identity, and land back on the clients list. */
  const exitClientView = async () => {
    try {
      const r = await API_CONFIG.post("/api/v1/auth/exit-client-view");
      const original = sessionStorage.getItem("pl_original_admin_user");
      sessionStorage.removeItem("pl_client_mode");
      sessionStorage.removeItem("pl_original_admin_user");
      const restored = r?.data?.user ? JSON.stringify({ ...JSON.parse(original ?? "{}"), ...r.data.user }) : original;
      if (restored) Cookies.set("pl_user", restored, { secure: true, sameSite: "lax", path: "/" });
      // Leaving the view-as session: drop the viewed identity, then re-identify
      // the restored admin so events land on the right person. Ids/enums only.
      resetUser();
      try {
        const admin = restored ? JSON.parse(restored) : null;
        if (admin?.id) identifyUser(admin.id, { role: admin.role, client_id: admin.client_id ?? admin.clientId });
      } catch { /* best-effort */ }
      track("view_as_exited");
      window.location.replace("/clients");
    } catch {
      window.location.replace("/clients");
    }
  };

  const logout = async () => {
    track("logout_clicked");
    try {
      await API_CONFIG.post("/api/v1/auth/logout");
    } finally {
      clearAuthSession();
      toast.success("Signed out");
      navigate("/login", { replace: true });
    }
  };

  return (
    <aside
      className={`relative z-30 hidden h-dvh shrink-0 flex-col border-r border-[var(--pulse-line)] bg-[var(--pulse-surface)] transition-[width] duration-200 md:flex ${
        collapsed ? "w-[76px]" : "w-72"
      }`}
    >
      <div
        className={`flex h-16 items-center border-b border-[var(--pulse-line)] ${
          collapsed ? "justify-center px-3" : "px-6"
        }`}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex min-w-0 items-center rounded-md text-left"
          aria-label="Go to overview"
        >
          <img
            src="/assets/photon-legal-brand.png"
            alt="Photon Legal"
            className={`${collapsed ? "h-6" : "h-8"} w-auto shrink-0 object-contain`}
          />
          {!collapsed && workspaceName !== "Photon Legal" && (
            <>
              <span
                className="mx-3 h-4 w-px shrink-0 bg-[var(--pulse-line)]"
                aria-hidden="true"
              />
              {clientLogoSrc ? (
                <img
                  src={clientLogoSrc}
                  alt={`${workspaceName} logo`}
                  className="h-7 max-w-[104px] shrink object-contain object-left"
                />
              ) : (
                <ClientInitials name={workspaceName} />
              )}
            </>
          )}
        </button>
      </div>

      <nav
        className={`flex-1 overflow-y-auto py-5 ${collapsed ? "px-3" : "px-4"}`}
        aria-label="Primary navigation"
      >
        {!collapsed && (
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">
            Workspace
          </p>
        )}
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => track("nav_item_clicked", { item: item.path })}
                  title={collapsed ? item.label : undefined}
                  className={`group flex h-10 items-center rounded-lg text-sm font-medium transition-colors ${
                    collapsed ? "justify-center px-2" : "gap-3 px-2"
                  } ${
                    active
                      ? "bg-[var(--pulse-surface-subtle)] text-[var(--pulse-ink)] shadow-[inset_2px_0_0_#0C0C0C]"
                      : "text-[var(--pulse-ink-secondary)] hover:bg-[var(--pulse-surface-subtle)] hover:text-[var(--pulse-ink)]"
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${
                      active
                        ? "text-[var(--pulse-ink)]"
                        : "text-[var(--pulse-ink-muted)] group-hover:text-[var(--pulse-ink)]"
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && Boolean(item.badge) && (
                    <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--pulse-brand)] px-1.5 py-0.5 font-sans text-xs font-semibold leading-4 text-[var(--pulse-ink)]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        className="absolute -right-3 top-5 grid h-6 w-6 place-items-center rounded-full border border-[var(--pulse-line)] bg-white text-[var(--pulse-ink-muted)] shadow-sm hover:border-[var(--pulse-line-strong)] hover:text-[var(--pulse-ink)]"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      <div
        className={`border-t border-[var(--pulse-line)] ${collapsed ? "p-3" : "p-4"}`}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`flex w-full items-center rounded-lg p-2 text-left hover:bg-[var(--pulse-surface-subtle)] ${
                collapsed ? "justify-center" : "gap-3"
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--pulse-surface-subtle)] text-xs font-semibold text-[var(--pulse-ink)]">
                {initials(user?.name, user?.email)}
              </span>
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {user?.name || user?.email}
                  </span>
                  <span className="block truncate text-xs text-[var(--pulse-ink-muted)]">
                    {role ? ROLE_LABEL[role] ?? "Member" : "Member"}
                  </span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            className="w-60 rounded-xl border-[var(--pulse-line)] p-1.5 shadow-xl"
          >
            {sessionStorage.getItem("pl_client_mode") === "true" && (
              <DropdownMenuItem
                onClick={exitClientView}
                className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-amber-700"
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Exit client view
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => navigate("/profile")}
              className="cursor-pointer rounded-lg px-2 py-2 text-sm"
            >
              <UserRound className="mr-2 h-4 w-4" />
              My profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer rounded-lg px-2 py-2 text-sm text-[var(--pulse-danger)]"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

export default Sidebar;
