import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StatusSelectProps {
  defaultStatus?: string;
  status: string;
  setStatus: (status: string) => void;
}

export default function StatusSelect({
  defaultStatus = "send-to-oc",
  status,
  setStatus,
}: StatusSelectProps) {
  // Define status-specific styling
  const getStatusStyles = () => {
    switch (status) {
      case "REJECTED":
        return "text-red-500 pl-3";
      case "UPDATE_REQUEST":
        return "text-orange-500 pl-3";
      default:
        return "";
    }
  };

  return (
    <div className={`w-full max-w-xs px-3 font-bold ${getStatusStyles()}`}>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Status</SelectLabel>
            <SelectItem value="UNDER_REVIEW" className="">
              Under Review
            </SelectItem>
            <SelectItem value="UPDATE_REQUEST">Update Requested</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="SEND_TO_OC">Send to OC</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
