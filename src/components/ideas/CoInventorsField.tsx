import React, { useMemo, useState } from "react";
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

/**
 * Optional co-inventors control for the draft workspace details area.
 * Typeahead over workspace users with an invite-by-email fallback.
 * Never blocks anything — purely additive.
 */
const CoInventorsField = ({ ideaId }: { ideaId?: string }) => {
  const { theme } = useTheme();
  const { user } = useUserCookie();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const { data: ideaData } = useQuery({
    queryKey: ["co_inventors_idea", ideaId],
    enabled: !!ideaId,
    queryFn: async () => {
      const response = await API_CONFIG.get(`/api/v1/idea/fetch/${ideaId}`);
      return response?.data;
    },
  });

  const { data: rosterData } = useQuery({
    queryKey: ["fetch_inventors", user?.client_id],
    enabled: !!user?.client_id && open,
    queryFn: async () => {
      const response = await API_CONFIG.get(
        `/api/v1/clients/fetch-all-inventors/${user?.client_id}`,
      );
      return response?.data;
    },
  });

  const ideaInventors: any[] = ideaData?.data?.IdeaInventor ?? [];
  const coInventors = ideaInventors.filter(
    (x) => x?.inventor?.id !== user?.id,
  );

  const roster: any[] = useMemo(
    () =>
      (Array.isArray(rosterData?.data) ? rosterData.data : []).filter(
        (u: any) =>
          u.id !== user?.id &&
          !ideaInventors.some((x) => x?.inventor?.id === u.id),
      ),
    [rosterData, ideaInventors, user?.id],
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["co_inventors_idea", ideaId] });

  const { mutate: addById } = useMutation({
    mutationFn: async (inventorId: string) => {
      await API_CONFIG.post(`/api/v1/idea/add/inventor/${ideaId}/${inventorId}`);
    },
    onSuccess: refresh,
    onError: () => toast.error("Failed to add co-inventor"),
  });

  const { mutate: addByEmail, isPending: isInviting } = useMutation({
    mutationFn: async (email: string) => {
      const res = await API_CONFIG.post("/api/v1/auth/ihc/invite-user", {
        email,
        role: "INVENTOR",
      });
      const id = res?.data?.data?.id;
      if (id) {
        await API_CONFIG.post(`/api/v1/idea/add/inventor/${ideaId}/${id}`);
      }
    },
    onSuccess: () => {
      refresh();
      toast.success("Co-inventor invited and added");
    },
    onError: () => toast.error("Failed to invite co-inventor"),
  });

  const { mutate: remove } = useMutation({
    mutationFn: async (ideaInventorId: string) => {
      await API_CONFIG.delete(
        `/api/v1/idea/remove/inventor/${ideaInventorId}`,
      );
    },
    onSuccess: refresh,
    onError: () => toast.error("Failed to remove co-inventor"),
  });

  const trimmed = input.trim().toLowerCase();
  const filtered = roster.filter(
    (u) =>
      !trimmed ||
      u.name?.toLowerCase().includes(trimmed) ||
      u.email?.toLowerCase().includes(trimmed),
  );
  const isEmailInput = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const showEmailFallback =
    isEmailInput &&
    !roster.some((u) => u.email?.toLowerCase() === trimmed) &&
    !ideaInventors.some(
      (x) => x?.inventor?.email?.toLowerCase() === trimmed,
    );

  if (!ideaId) return null;

  const chip =
    theme === "dark"
      ? "bg-neutral-800 text-neutral-200"
      : "bg-neutral-100 text-neutral-700";

  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs uppercase tracking-wider font-sans text-neutral-600 dark:text-neutral-500">
        Co-inventors <span className="normal-case">(optional)</span>
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {coInventors.map((x) => (
          <span
            key={x.id}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${chip}`}
            title={x?.inventor?.email}
          >
            {x?.inventor?.name || x?.inventor?.email}
            <button
              type="button"
              onClick={() => remove(x.id)}
              className="opacity-60 hover:opacity-100"
              aria-label={`Remove ${x?.inventor?.name || "co-inventor"}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs transition-colors ${
                theme === "dark"
                  ? "border-neutral-700 text-neutral-500 hover:text-neutral-300"
                  : "border-neutral-300 text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search teammates or enter an email..."
                value={input}
                onValueChange={setInput}
              />
              <CommandList>
                {filtered.length === 0 && !showEmailFallback && (
                  <CommandEmpty>No matches</CommandEmpty>
                )}
                {filtered.length > 0 && (
                  <CommandGroup heading="Workspace">
                    {filtered.map((u) => (
                      <CommandItem
                        key={u.id}
                        value={u.id}
                        onSelect={() => {
                          addById(u.id);
                          setInput("");
                          setOpen(false);
                        }}
                      >
                        {u.name}{" "}
                        <span className="ml-1 text-neutral-400">{u.email}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {showEmailFallback && (
                  <CommandGroup>
                    <CommandItem
                      value={`__invite__${trimmed}`}
                      disabled={isInviting}
                      onSelect={() => {
                        addByEmail(trimmed);
                        setInput("");
                        setOpen(false);
                      }}
                    >
                      <Plus className="mr-2 h-3 w-3" /> Invite "{trimmed}"
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default CoInventorsField;
