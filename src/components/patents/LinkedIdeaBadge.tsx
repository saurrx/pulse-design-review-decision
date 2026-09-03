import React from "react";
import { Link as LinkIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * "This filing came from a disclosure on the platform."
 *
 * A small circular icon sitting INLINE with the application number it
 * qualifies, not a chip on its own line. It replaced a `[link] Linked idea`
 * pill (2026-09-03): the pill cost a second row in a sticky column that is
 * already the narrowest on the screen, and it spent that row repeating a word
 * the tooltip says better. A mark belongs on the thing it describes.
 *
 * It is a COMPONENT rather than inline JSX because it cannot be verified any
 * other way. Most of the demo portfolio was imported and carries no idea link —
 * a scan of 500 patents on demo found zero — so the badge renders on no screen
 * anyone can open, and "does it look right" has no answer from the running app.
 * As a component it has stories, and those stories are the only place its
 * appearance and its accessible name are actually checked.
 *
 * The tooltip names the IDEA. A bare icon tells a reader that a link exists
 * without telling them to what, which is the same complaint that retired the
 * pill's label.
 */
export interface LinkedIdeaBadgeProps {
  ideaId: string;
  ideaTitle?: string | null;
  /** Navigate to the idea. Kept as a prop so the table row's own click handler
   *  can be stopped without this component knowing about routing. */
  onOpen: (ideaId: string) => void;
}

const LinkedIdeaBadge: React.FC<LinkedIdeaBadgeProps> = ({
  ideaId,
  ideaTitle,
  onOpen,
}) => {
  const title = ideaTitle || "Untitled disclosure";
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="linked-idea-badge"
            aria-label={`Open the linked idea: ${title}`}
            onClick={(e) => {
              // The whole row is clickable and opens the PATENT. Without this
              // the badge opens the idea and the row opens the patent, and the
              // last one to run wins.
              e.stopPropagation();
              onOpen(ideaId);
            }}
            className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            <LinkIcon className="h-2.5 w-2.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-medium">{title}</p>
          <p className="mt-0.5 text-xs opacity-80">
            Filed from a disclosure on Pulse. Open the idea.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default LinkedIdeaBadge;
