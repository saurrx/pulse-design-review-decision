import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star } from "lucide-react";

interface ActionTemplate {
  id: string;
  label: string;
  description: string;
  requires_countries: boolean;
  requires_note: boolean;
  category: string;
  is_recommended?: boolean;
}

interface ActionDropdownProps {
  eventType: string;
  selectedTemplateId?: string;
  onSelect: (template: ActionTemplate) => void;
  disabled?: boolean;
}

const ActionDropdown: React.FC<ActionDropdownProps> = ({
  eventType,
  selectedTemplateId,
  onSelect,
  disabled = false,
}) => {
  const { data: templatesData } = useQuery({
    queryKey: ["action_templates_event", eventType],
    queryFn: async () => {
      const response = await API_CONFIG.get(
        `/api/v1/actions/templates/event/${encodeURIComponent(eventType)}`,
      );
      return response?.data;
    },
    enabled: !!eventType,
  });

  const templates: ActionTemplate[] = templatesData?.data || [];

  const handleValueChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      onSelect(template);
    }
  };

  return (
    <Select
      value={selectedTemplateId || ""}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-[200px] h-8 text-xs font-sans">
        <SelectValue placeholder="Select action..." />
      </SelectTrigger>
      <SelectContent className="font-sans">
        {templates.map((template) => (
          <SelectItem key={template.id} value={template.id} className="text-xs">
            <div className="flex items-center gap-1.5">
              {template.is_recommended && (
                <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
              )}
              <span className="truncate">{template.label}</span>
            </div>
          </SelectItem>
        ))}
        {templates.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-gray-500">
            No templates available
          </div>
        )}
      </SelectContent>
    </Select>
  );
};

export default ActionDropdown;
