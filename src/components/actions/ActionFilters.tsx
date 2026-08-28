import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface ActionFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  deadlineWindow: string;
  onDeadlineWindowChange: (window: string) => void;
  showStatusFilter?: boolean;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  showClientFilter?: boolean;
  clients?: Array<{ id: string; name: string }>;
  clientFilter?: string;
  onClientFilterChange?: (clientId: string) => void;
}

const ActionFilters: React.FC<ActionFiltersProps> = ({
  searchQuery,
  onSearchChange,
  deadlineWindow,
  onDeadlineWindowChange,
  showStatusFilter = false,
  statusFilter,
  onStatusFilterChange,
  showClientFilter = false,
  clients,
  clientFilter,
  onClientFilterChange,
}) => {
  const { theme } = useTheme();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by application number or title..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <Select value={deadlineWindow} onValueChange={onDeadlineWindowChange}>
        <SelectTrigger className="w-[150px] h-9 text-sm">
          <SelectValue placeholder="Deadline window" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All deadlines</SelectItem>
          <SelectItem value="7">Next 7 days</SelectItem>
          <SelectItem value="30">Next 30 days</SelectItem>
          <SelectItem value="60">Next 60 days</SelectItem>
          <SelectItem value="90">Next 90 days</SelectItem>
        </SelectContent>
      </Select>

      {showStatusFilter && onStatusFilterChange && (
        <Select value={statusFilter || "all"} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
      )}

      {showClientFilter && onClientFilterChange && clients && (
        <Select value={clientFilter || "all"} onValueChange={onClientFilterChange}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default ActionFilters;
