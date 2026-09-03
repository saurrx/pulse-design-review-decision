import type { HttpHandler } from "msw";
import { authHandlers } from "./auth";
import { ideaHandlers } from "./ideas";
import { dashboardHandlers } from "./dashboard";
import { patentHandlers } from "./patents";
import { actionHandlers } from "./actions";
import { clientHandlers } from "./clients";
import { inviteHandlers } from "./invites";
import { fileHandlers } from "./files";
import { v0Handlers } from "./v0";
import { egressHandler, legacyHandlers } from "../runtime/registry";

/** Literal routes are declared before parameter routes inside each module; the egress rule is always last. */
export const handlers: HttpHandler[] = [...authHandlers, ...ideaHandlers, ...dashboardHandlers, ...patentHandlers, ...actionHandlers, ...clientHandlers, ...inviteHandlers, ...fileHandlers, ...v0Handlers, ...legacyHandlers(), egressHandler()];
