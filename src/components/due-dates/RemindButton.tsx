import React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RemindButtonProps {
  lastRemindedAt: string | null;
  actionAlreadySubmitted: boolean;
  onClick: () => void;
  isLoading: boolean;
}

const RemindButton: React.FC<RemindButtonProps> = ({
  lastRemindedAt,
  actionAlreadySubmitted,
  onClick,
  isLoading,
}) => {
  const isOnCooldown = lastRemindedAt
    ? (new Date().getTime() - new Date(lastRemindedAt).getTime()) /
        (1000 * 60 * 60) <
      24
    : false;

  const hoursRemaining = lastRemindedAt
    ? Math.max(
        0,
        Math.ceil(
          24 -
            (new Date().getTime() - new Date(lastRemindedAt).getTime()) /
              (1000 * 60 * 60),
        ),
      )
    : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={actionAlreadySubmitted || isOnCooldown || isLoading}
            className="h-7 px-2 text-xs"
          >
            {isLoading ? "..." : "Remind"}
          </Button>
        </TooltipTrigger>
        {(actionAlreadySubmitted || isOnCooldown) && (
          <TooltipContent>
            <p>
              {actionAlreadySubmitted
                ? "The client has already submitted an action for this deadline"
                : `Cooldown: ${hoursRemaining}h remaining`}
            </p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

export default RemindButton;
