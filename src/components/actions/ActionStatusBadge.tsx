import React from "react";
import { Badge } from "@/components/ui/badge";

interface ActionStatusBadgeProps {
  status: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NO_ACTION: {
    label: "No Action",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  SUBMITTED: {
    label: "Submitted",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  UPDATED: {
    label: "Updated",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const ActionStatusBadge: React.FC<ActionStatusBadgeProps> = ({ status }) => {
  const config = STATUS_CONFIG[status || "NO_ACTION"] || STATUS_CONFIG.NO_ACTION;

  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium ${config.className}`}
    >
      {config.label}
    </Badge>
  );
};

export default ActionStatusBadge;
