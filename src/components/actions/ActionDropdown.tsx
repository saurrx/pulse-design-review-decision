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
  /** The denormalised instruction text already saved on the row. */
  selectedLabel?: string | null;
  selectedTemplateId?: string;
  onSelect: (template: ActionTemplate) => void;
  disabled?: boolean;
}

const ActionDropdown: React.FC<ActionDropdownProps> = ({
  eventType,
  selectedTemplateId,
  onSelect,
  disabled = false,
  selectedLabel,
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
      // When an instruction is already saved, the closed control shows THAT
      // text via the placeholder — not the id-matched item, whose CURRENT
      // label changes when templates are relabeled and would rewrite history.
      value={selectedLabel ? "" : selectedTemplateId || ""}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-[200px] h-8 text-xs font-sans">
        {/* The instruction is DENORMALISED onto the row at decide-time, on
            purpose — history must not change when a template is relabeled.
            Radix only renders a value whose item exists in the CURRENT
            template list, so a row whose saved template no longer surfaces
            for this event (or was renamed) showed an empty cell. The saved
            text is the truth; show it. */}
        <SelectValue placeholder={selectedLabel || "Select action..."} />
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
