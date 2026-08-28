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

  return (
    <Select value={normalizedStatus} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NEW">New</SelectItem>
        <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
        <SelectItem value="COMPLETED">Completed</SelectItem>
      </SelectContent>
    </Select>
  );
};

export default RequestStatusBadge;
