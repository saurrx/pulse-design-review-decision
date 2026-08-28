import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import API_CONFIG from "@/lib/apiConfig";
import useUserCookie from "@/hooks/use-auth";
import { useTheme } from "@/hooks/useTheme";
import { ProductChip } from "@/components/ui/product-chip";

const MAX_TAG_LENGTH = 30;
const MAX_TAGS = 20;
const VISIBLE_CHIPS = 2;

type PatentTagsCellProps = {
  patentId: string;
  tags: string[];
  patentsQueryKey: unknown[];
};

const PatentTagsCell = ({
  patentId,
  tags,
  patentsQueryKey,
}: PatentTagsCellProps) => {
  const { theme } = useTheme();
  const { user } = useUserCookie();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const currentTags = useMemo(() => tags ?? [], [tags]);

  const { data: suggestionsData } = useQuery({
    queryKey: ["patent-tags", user?.client_id],
    queryFn: async () => {
      const response = await API_CONFIG.get(
        `/api/v1/patent/distinct-tags/client/${user?.client_id}`,
      );
      return (response?.data?.data ?? []) as string[];
    },
    enabled: !!user?.client_id && open,
    staleTime: 60_000,
  });

  const allSuggestions = suggestionsData ?? [];

  const saveMutation = useMutation({
    mutationFn: async (nextTags: string[]) => {
      const response = await API_CONFIG.put(
        `/api/v1/patent/update-single/${patentId}`,
        { tags: nextTags },
      );
      return response.data;
    },
    onMutate: async (nextTags: string[]) => {
      await queryClient.cancelQueries({ queryKey: patentsQueryKey });
      const previous = queryClient.getQueryData<any>(patentsQueryKey);
      queryClient.setQueryData<any>(patentsQueryKey, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((p: any) =>
            p.id === patentId ? { ...p, tags: nextTags } : p,
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(patentsQueryKey, ctx.previous);
      }
      toast.error("Failed to save tags");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patent-tags", user?.client_id] });
    },
  });

  const normalize = (raw: string) => raw.trim().slice(0, MAX_TAG_LENGTH);

  const hasTag = (tag: string) =>
    currentTags.some((t) => t.toLowerCase() === tag.toLowerCase());

  const addTag = (raw: string) => {
    const tag = normalize(raw);
    if (!tag) return;
    if (hasTag(tag)) {
      setInput("");
      return;
    }
    if (currentTags.length >= MAX_TAGS) {
      toast.error(`Max ${MAX_TAGS} tags per patent`);
      return;
    }
    saveMutation.mutate([...currentTags, tag]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    saveMutation.mutate(currentTags.filter((t) => t !== tag));
  };

  const trimmedInput = input.trim();
  const filteredSuggestions = allSuggestions.filter(
    (s) =>
      !hasTag(s) &&
      (trimmedInput.length === 0 ||
        s.toLowerCase().includes(trimmedInput.toLowerCase())),
  );
  const showCreateOption =
    trimmedInput.length > 0 &&
    !hasTag(trimmedInput) &&
    !allSuggestions.some(
      (s) => s.toLowerCase() === trimmedInput.toLowerCase(),
    );

  const tagColor =
    theme === "dark"
      ? "border-neutral-700 bg-neutral-900 text-neutral-200"
      : "border-[var(--pulse-line)] bg-[var(--pulse-surface)] text-[var(--pulse-ink-muted)]";

  const visibleChips = currentTags.slice(0, VISIBLE_CHIPS);
  const overflow = currentTags.length - visibleChips.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`flex w-full flex-wrap items-center gap-1 rounded p-1 text-left transition-colors ${
            theme === "dark" ? "hover:bg-neutral-900" : "hover:bg-neutral-50"
          }`}
        >
          {currentTags.length === 0 ? (
            <ProductChip
              kind="tag"
              className={`border border-dashed bg-transparent ${
                theme === "dark"
                  ? "border-neutral-700 text-neutral-500"
                  : "border-neutral-300 text-neutral-400"
              }`}
              icon={<Plus className="h-3 w-3" />}
            >
              Add tag
            </ProductChip>
          ) : (
            <>
              {visibleChips.map((tag) => (
                <ProductChip
                  key={tag}
                  kind="tag"
                  className={`${tagColor} max-w-full`}
                  title={tag}
                >
                  {tag}
                </ProductChip>
              ))}
              {overflow > 0 && (
                <ProductChip
                  kind="tag"
                  className={tagColor}
                  title={currentTags.slice(VISIBLE_CHIPS).join(", ")}
                >
                  +{overflow}
                </ProductChip>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {currentTags.length > 0 && (
          <div className="flex flex-wrap gap-1 border-b p-2">
            {currentTags.map((tag) => (
              <ProductChip
                key={tag}
                kind="tag"
                className={tagColor}
                title={tag}
              >
                <span className="truncate max-w-[160px]">{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="opacity-60 hover:opacity-100"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </ProductChip>
            ))}
          </div>
        )}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create tag..."
            value={input}
            onValueChange={setInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmedInput) {
                e.preventDefault();
                addTag(trimmedInput);
              }
            }}
            maxLength={MAX_TAG_LENGTH}
          />
          <CommandList>
            {filteredSuggestions.length === 0 && !showCreateOption && (
              <CommandEmpty>No tags yet</CommandEmpty>
            )}
            {filteredSuggestions.length > 0 && (
              <CommandGroup heading="Existing tags">
                {filteredSuggestions.map((tag) => (
                  <CommandItem
                    key={tag}
                    value={tag}
                    onSelect={() => addTag(tag)}
                  >
                    {tag}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreateOption && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmedInput}`}
                  onSelect={() => addTag(trimmedInput)}
                >
                  <Plus className="mr-2 h-3 w-3" /> Create "{trimmedInput}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default PatentTagsCell;
