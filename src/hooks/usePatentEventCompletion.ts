import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";

import API_CONFIG from "@/lib/apiConfig";

export const isPatentEventCompleted = (event: any) => {
  const status = String(event?.event_status || event?.status || "").toUpperCase();
  return (
    status === "COMPLETED" ||
    status === "CLEARED" ||
    Boolean(event?.completed_at || event?.cleared_at)
  );
};

export const usePatentEventCompletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      completed,
    }: {
      eventId: string;
      completed: boolean;
    }) => {
      const response = await API_CONFIG.patch(
        `/api/v1/patent/events/${eventId}`,
        { status: completed ? "COMPLETED" : "OPEN" },
      );
      return response?.data?.data;
    },
    onSuccess: (_event, variables) => {
      queryClient.invalidateQueries({ queryKey: ["all_due_dates"] });
      toast.success(variables.completed ? "Event marked done" : "Event reopened");
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.message || "Could not update the calendar event",
      ),
  });
};
