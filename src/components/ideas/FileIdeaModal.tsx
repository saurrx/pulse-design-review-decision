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

interface FileIdeaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideaId: string;
  defaultTitle?: string;
  defaultInventors?: string[];
  onFiled: (result: { patent: { id: string }; idea: any }) => void;
}

/**
 * File an idea as a patent: create the Patent, link it to the idea, mark the
 * idea filed — one transaction on the server.
 *
 * The FORM is `usePatentFields` + `PatentFieldsForm`, shared with
 * AddPatentModal; the two were byte-identical copies until 2026-09-03. The
 * only differences were ever these: the idea's title and credited inventors
 * are pre-filled, the payload posts to the idea's `/file` route, and the
 * caller gets the patent AND the updated idea back.
 */
const FileIdeaModal: React.FC<FileIdeaModalProps> = ({
  open,
  onOpenChange,
  ideaId,
  defaultTitle,
  defaultInventors,
  onFiled,
}) => {
  const fields = usePatentFields({
    open,
    initial: { title: defaultTitle, inventors: defaultInventors },
  });

  const fileMutation = useMutation({
    mutationFn: async () => {
      const response = await API_CONFIG.post(
        `/api/v1/idea/${ideaId}/file`,
        fields.payload(),
      );
      return response.data;
    },
    onSuccess: (resp) => {
      onFiled(resp?.data);
      onOpenChange(false);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ??
        err?.message ??
        "Failed to file the idea";
      if (status === 409 && /application number/i.test(message)) {
        fields.setFieldError({ application_number: message });
      } else {
        toast.error(message);
      }
    },
  });

  const handleSubmit = () => {
    if (!fields.validate()) return;
    fileMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>File this idea as a patent</DialogTitle>
          <DialogDescription>
            Capture the patent record. On submit we'll create the Patent, link
            it to this idea, and mark the idea as filed — all in one
            transaction.
          </DialogDescription>
        </DialogHeader>

        <PatentFieldsForm fields={fields} />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={fileMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={fileMutation.isPending}>
            {fileMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Filing...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                File Patent
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FileIdeaModal;
