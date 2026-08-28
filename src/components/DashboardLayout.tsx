import React from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header, { type DashboardHeaderConfig } from "./Header";
import useUserCookie from "@/hooks/use-auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  header?: Partial<DashboardHeaderConfig> | false;
}

const defaultHeaderForRoute = (
  pathname: string,
  role?: string,
): DashboardHeaderConfig => {
  if (pathname === "/") {
    return {
      title: role === "INVENTOR" ? "Your invention workspace" : "Portfolio overview",
    };
  }
  if (pathname === "/clients") return { title: "Clients" };
  if (pathname.startsWith("/clients/")) {
    return {
      title: "Client workspace",
      back: { label: "Back to clients", to: "/clients" },
    };
  }
  if (/^\/ideas\/[^/]+\/draft$/.test(pathname)) {
    return {
      title: "Working submission",
      back: { label: "Back to idea", to: pathname.replace(/\/draft$/, "") },
    };
  }
  if (/^\/ideas\/[^/]+$/.test(pathname)) {
    return {
      title: "Idea details",
      back: { label: "Back to ideas", to: "/ideas" },
    };
  }
  if (pathname === "/ideas") {
    return {
      title:
        role === "LEGAL_COUNSEL" || role === "TECH_COMMITTEE"
          ? "Review queue"
          : role === "INVENTOR"
            ? "My ideas"
            : "Ideas",
    };
  }
  if (/^\/patents\/[^/]+$/.test(pathname)) {
    return {
      title: "Filing details",
      back: { label: "Back to filings", to: "/patents" },
    };
  }
  if (pathname === "/patents") return { title: "Patents" };
  if (pathname === "/due-dates") return { title: "Actions" };
  if (pathname === "/actions") return { title: "Actions" };
  if (pathname === "/assistant") return { title: "AI assistant" };
  if (pathname === "/profile") return { title: "My profile" };
  if (pathname === "/workspace") {
    return { title: "Workspace" };
  }
  return { title: "Pulse" };
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className,
  header,
}) => {
  const { pathname } = useLocation();
  const { user } = useUserCookie();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    try {
      if (window.matchMedia("(max-width: 1439px)").matches) return true;
      return localStorage.getItem("pulse-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 1439px)");
    const syncSidebarToViewport = (matches: boolean) => {
      if (matches) {
        setSidebarCollapsed(true);
        return;
      }

      setSidebarCollapsed(
        localStorage.getItem("pulse-sidebar-collapsed") === "true",
      );
    };

    const onViewportChange = (event: MediaQueryListEvent) =>
      syncSidebarToViewport(event.matches);

    syncSidebarToViewport(compactViewport.matches);
    compactViewport.addEventListener("change", onViewportChange);
    return () => compactViewport.removeEventListener("change", onViewportChange);
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("pulse-sidebar-collapsed", String(next));
      return next;
    });
  };

  const resolvedHeader = React.useMemo(() => {
    if (header === false) return null;
    return {
      ...defaultHeaderForRoute(pathname, user?.role),
      ...(header || {}),
    };
  }, [header, pathname, user?.role]);

  return (
    <div className="flex h-dvh min-h-[640px] bg-[var(--pulse-canvas)] text-[var(--pulse-ink)]">
      <Sidebar collapsed={sidebarCollapsed} toggleSidebar={toggleSidebarCollapse} />
      {/* A flex column, so a page can say flex-1 and mean "the space left under
          the header" instead of doing viewport arithmetic. h-full or
          h-[calc(100dvh-64px)] both ignore the header that sits above them in
          here, which is where the persistent 64px overhang came from. Still
          overflow-auto: short pages scroll main, tall ones own their scrolling
          via min-h-0 flex-1. */}
      <main className={`flex min-w-0 flex-1 flex-col overflow-auto bg-[var(--pulse-canvas)] ${className || ""}`}>
        {resolvedHeader && <Header {...resolvedHeader} />}
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
