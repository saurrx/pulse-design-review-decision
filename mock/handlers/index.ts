import type { HttpHandler } from "msw";
import { authHandlers } from "./auth";
import { ideaHandlers } from "./ideas";
import { dashboardHandlers } from "./dashboard";
import { egressHandler } from "../runtime/registry";

/** Literal routes are declared before parameter routes inside each module; the egress rule is always last. */
export const handlers: HttpHandler[] = [...authHandlers, ...ideaHandlers, ...dashboardHandlers, egressHandler()];
