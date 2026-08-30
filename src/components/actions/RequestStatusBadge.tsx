import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ProductChip,
  type ProductChipTone,
} from "@/components/ui/product-chip";

interface RequestStatusBadgeProps {
  status: string;
  editable?: boolean;
  onChange?: (status: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; tone: ProductChipTone }> = {
  NEW: {
    label: "New",
    tone: "info",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    tone: "info",
  },
  IN_PROGRESS: {
    label: "In Progress",
    tone: "warning",
  },
  COMPLETED: {
    label: "Completed",
    tone: "success",
  },
};

/** The server's ladder, in the server's order (ActionsService.PROGRESSION). */
const PROGRESSION: string[] = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED"];

const RequestStatusBadge: React.FC<RequestStatusBadgeProps> = ({
  status,
  editable = false,
  onChange,
}) => {
  const normalizedStatus = STATUS_CONFIG[status] ? status : "NEW";

  if (!editable) {
    const config = STATUS_CONFIG[normalizedStatus];
    return (
      <ProductChip kind="status" tone={config.tone}>
        {config.label}
      </ProductChip>
    );
  }

  // An action only moves forward — the API refuses NEW after ACKNOWLEDGED, and
  // rightly so. Offering the earlier stages anyway made every such click a
  // round trip that came back as an error toast, so they are shown in place
  // (the reader still sees the whole ladder) but not selectable.
  const reachable = PROGRESSION.slice(PROGRESSION.indexOf(normalizedStatus));

  return (
    <Select value={normalizedStatus} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROGRESSION.map((value) => (
          <SelectItem
            key={value}
            value={value}
            disabled={!reachable.includes(value)}
          >
            {STATUS_CONFIG[value].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default RequestStatusBadge;
