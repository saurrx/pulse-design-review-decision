import React from "react";
import { createPortal } from "react-dom";
import { HeaderPrimaryAction, type DashboardHeaderAction } from "./Header";

/**
 * The seam that lets the dashboard chrome outlive a navigation.
 *
 * Every page used to wrap ITSELF in `<DashboardLayout>`, and the routes
 * rendered those pages as siblings. So each navigation unmounted the whole
 * tree — sidebar, header, the lot — and mounted a fresh one. Measured
 * 2026-09-01 by tagging the live sidebar node and navigating: `REMOUNTED` on
 * every route, four for four. The chrome is identical for a given session
 * (nav items are a function of role, not of route), so rebuilding it per
 * navigation bought nothing and cost a full teardown, a Suspense fallback and
 * a re-run of the sidebar's own queries every time.
 *
 * The layout is a ROUTE now (App.tsx), rendering `<Outlet/>`, so it mounts once
 * per session. That leaves one problem: five pages legitimately put their own
 * controls in the header — an Export CSV button, a list/calendar toggle, a
 * client's name as the title — and those controls are live JSX bound to page
 * state.
 *
 * They reach the header through a SLOT, not through shared state. A context
 * holding `{header}` would have to be written from the page during render
 * (illegal) or in an effect keyed on JSX (which cannot be compared, so the
 * effect re-fires every render and the setState loops). A portal has neither
 * problem: the page renders its controls in its own tree, React puts the DOM
 * nodes in the header's slot, and every re-render of the page updates them
 * directly. No synchronisation to get wrong.
 */

type Slots = {
  title: HTMLElement | null;
  actions: HTMLElement | null;
  /** Bumped when the slots first attach, so portals mount on the same paint. */
  ready: number;
};

const SlotContext = React.createContext<Slots>({ title: null, actions: null, ready: 0 });

export const DashboardSlotProvider = SlotContext.Provider;

/**
 * Render into one of the header's slots.
 *
 * Renders nothing until the slot exists — on the very first paint the layout
 * has not attached its refs yet, and portalling into null throws.
 */
const Slot = ({ into, children }: { into: "title" | "actions"; children: React.ReactNode }) => {
  const slots = React.useContext(SlotContext);
  const node = slots[into];
  if (!node || !children) return null;
  return createPortal(children, node);
};

/**
 * A page's own header controls.
 *
 * `title` replaces the route-derived title (a client's name, say); `actions`
 * appends the page's buttons. A page that needs neither renders nothing and
 * gets the default header, which is the common case.
 */
export const PageHeader = ({
  title,
  actions,
  primaryAction,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  primaryAction?: DashboardHeaderAction;
}) => (
  <>
    {title ? <Slot into="title">{title}</Slot> : null}
    {actions || primaryAction ? (
      <Slot into="actions">
        {actions}
        {primaryAction ? <HeaderPrimaryAction action={primaryAction} /> : null}
      </Slot>
    ) : null}
  </>
);

/**
 * Per-page classes on the layout's `<main>`.
 *
 * Two pages need them: the idea workspace owns its own scrolling
 * (`h-screen overflow-hidden`) and two client screens position children against
 * main (`relative`). Applied to the DOM node directly rather than through state
 * — same reason as the slots — and reverted on unmount so a class cannot leak
 * from one page onto the next.
 */
export const useMainClassName = (className?: string) => {
  const slots = React.useContext(SlotContext);
  React.useEffect(() => {
    if (!className) return;
    const main = slots.actions?.closest("main") ?? document.querySelector("main");
    if (!main) return;
    const added = className.split(/\s+/).filter(Boolean);
    main.classList.add(...added);
    return () => main.classList.remove(...added);
  }, [className, slots.ready, slots.actions]);
};

/** Declarative form of the hook, for readability at the call site. */
export const MainClass = ({ className }: { className: string }) => {
  useMainClassName(className);
  return null;
};
