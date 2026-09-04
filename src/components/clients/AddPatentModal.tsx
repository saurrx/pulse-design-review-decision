import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import { toast } from "@/lib/toast";
import { Plus, Loader2 } from "lucide-react";
import { usePatentFields } from "@/components/patents/usePatentFields";
import PatentFieldsForm from "@/components/patents/PatentFieldsForm";

interface AddPatentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onAdded?: (result: { id: string }) => void;
}

/**
 * Add a single patent to a client's portfolio.
 *
 * Everything about the FORM lives in `usePatentFields` + `PatentFieldsForm`,
 * shared with FileIdeaModal — the two were byte-identical copies until
 * 2026-09-03. What is left here is the only thing that differs: where the
 * payload goes and what happens after.
 */
const AddPatentModal: React.FC<AddPatentModalProps> = ({
  open,
  onOpenChange,
  clientId,
  onAdded,
}) => {
  const fields = usePatentFields({ open });

  const addMutation = useMutation({
    mutationFn: async () => {
      const response = await API_CONFIG.post(
        `/api/v1/patent/client/${clientId}`,
        fields.payload(),
      );
      return response.data;
    },
    onSuccess: (resp) => {
      onAdded?.(resp?.data);
      onOpenChange(false);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ??
        err?.message ??
        "Failed to add the patent";
      // A duplicate application number is a FIELD error, shown on the field
      // that caused it; everything else is a toast.
      if (status === 409 && /application number/i.test(message)) {
        fields.setFieldError({ application_number: message });
      } else {
        toast.error(message);
      }
    },
  });

  const handleSubmit = () => {
    if (!fields.validate()) return;
    addMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a patent</DialogTitle>
          <DialogDescription>
            Add a single patent to this client's portfolio. Status defaults to
            Active – Applied; you can change it later from the patents list.
          </DialogDescription>
        </DialogHeader>

        <PatentFieldsForm fields={fields} />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={addMutation.isPending}>
            {addMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Patent
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddPatentModal;
