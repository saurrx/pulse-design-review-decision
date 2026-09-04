import React, { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header, { type DashboardHeaderConfig } from "./Header";
import useUserCookie from "@/hooks/use-auth";
import { DashboardSlotProvider } from "./DashboardChrome";

interface DashboardLayoutProps {
  /** Omitted when used as a ROUTE layout — the router's Outlet fills it. */
  children?: React.ReactNode;
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
    // An INVENTOR goes back to the LIST, not to the idea page.
    //
    // The idea page bounces them straight back here: IdeaDetailsContent
    // redirects an inventor whose idea is IN_DRAFT to this workspace, with
    // `replace: true`. So "Back to idea" looked like a dead button — one
    // navigation out, one redirect in, no visible change — and the `replace`
    // poisoned the browser's own Back for anyone who arrived via the idea page.
    // Other roles read that page rather than being bounced off it, so they keep
    // the closer target.
    return role === "INVENTOR"
      ? { title: "Working submission", back: { label: "Back to my ideas", to: "/ideas" } }
      : {
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
  // Both pages are titled "Actions", and that is not a collision: no role has
  // both in its nav. Client-side roles reach /due-dates through "Actions";
  // Photon-side roles reach /actions through their single "Actions" item, and
  // this queue IS their action list. Titling it "Operations" contradicted the
  // nav item they arrived through, which is the confusion the earlier comment
  // here was trying to prevent.
  if (pathname === "/actions") return { title: "Actions" };
  if (pathname === "/assistant") return { title: "AI assistant" };
  if (pathname === "/profile") return { title: "My profile" };
  if (pathname === "/workspace") {
    return { title: "Workspace" };
  }
  return { title: "Pulse" };
};

/**
 * Shown while a page chunk loads. Fills the CONTENT area only — it sits inside
 * <main>, under the header, beside the sidebar, so the chrome stays put and the
 * transition reads as "this panel is loading" rather than "the app went away".
 */
const ContentFallback = () => (
  <div className="flex min-h-0 flex-1 items-center justify-center py-16">
    <div
      className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--pulse-line-strong)] border-t-[var(--pulse-brand)] motion-reduce:animate-none"
      aria-label="Loading"
      role="status"
    />
  </div>
);

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

  // The header slots. Refs rather than state so a page's portal targets a
  // stable DOM node; `ready` flips once after mount so the portals attach on
  // the next paint instead of throwing into null on the first.
  const titleSlotRef = React.useRef<HTMLSpanElement | null>(null);
  const actionsSlotRef = React.useRef<HTMLSpanElement | null>(null);
  const [ready, setReady] = React.useState(0);
  React.useEffect(() => { setReady(n => n + 1); }, []);
  const [titleSlotFilled, setTitleSlotFilled] = React.useState(false);
  // A page's title arrives by portal, so React does not tell us it happened.
  // Watching the slot is what lets the default title hide exactly when a real
  // one appears, and come back when the page leaves.
  React.useEffect(() => {
    const node = titleSlotRef.current;
    if (!node) return;
    const sync = () => setTitleSlotFilled(node.childNodes.length > 0);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(node, { childList: true });
    return () => observer.disconnect();
  }, [ready]);

  const slots = React.useMemo(
    () => ({ title: titleSlotRef.current, actions: actionsSlotRef.current, ready }),
    [ready],
  );

  return (
    <DashboardSlotProvider value={slots}>
    <div className="flex h-dvh min-h-[640px] bg-[var(--pulse-canvas)] text-[var(--pulse-ink)]">
      <Sidebar collapsed={sidebarCollapsed} toggleSidebar={toggleSidebarCollapse} />
      {/* A flex column, so a page can say flex-1 and mean "the space left under
          the header" instead of doing viewport arithmetic. h-full or
          h-[calc(100dvh-64px)] both ignore the header that sits above them in
          here, which is where the persistent 64px overhang came from. Still
          overflow-auto: short pages scroll main, tall ones own their scrolling
          via min-h-0 flex-1. */}
      <main className={`flex min-w-0 flex-1 flex-col overflow-auto bg-[var(--pulse-canvas)] ${className || ""}`}>
        {resolvedHeader && (
          <Header
            {...resolvedHeader}
            titleSlotRef={titleSlotRef}
            actionsSlotRef={actionsSlotRef}
            titleSlotFilled={titleSlotFilled}
          />
        )}
        {/* The page's OWN Suspense boundary.
            Every page is React.lazy, and the app's only <Suspense> used to sit
            outside <Routes> — so while a chunk loaded, its fallback replaced
            the entire tree, sidebar and header included. Measured on demo: the
            sidebar was gone for ~700-960ms on every first navigation, which is
            the "it reloads the whole page" people were reporting. Making the
            layout a route stopped it REMOUNTING; only a boundary inside the
            layout stops it DISAPPEARING. The nearest boundary wins, so the
            outer one never fires for these routes any more. */}
        {children ?? (
          <Suspense fallback={<ContentFallback />}>
            <Outlet />
          </Suspense>
        )}
      </main>
    </div>
    </DashboardSlotProvider>
  );
};

export default DashboardLayout;
