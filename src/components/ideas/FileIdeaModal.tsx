import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import { toast } from "@/lib/toast";
import { X, Plus, Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface FileIdeaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideaId: string;
  defaultTitle?: string;
  defaultInventors?: string[];
  onFiled: (result: { patent: { id: string }; idea: any }) => void;
}

type Chip = "inventors" | "ipc_all_versions" | "tags";

const FileIdeaModal: React.FC<FileIdeaModalProps> = ({
  open,
  onOpenChange,
  ideaId,
  defaultTitle,
  defaultInventors,
  onFiled,
}) => {
  const { theme } = useTheme();

  const [applicationNumber, setApplicationNumber] = useState("");
  const [applicationDate, setApplicationDate] = useState("");
  const [title, setTitle] = useState("");
  const [publicationCountry, setPublicationCountry] = useState("");
  const [abstract, setAbstract] = useState("");
  const [priorityDetails, setPriorityDetails] = useState("");
  const [currentAssignee, setCurrentAssignee] = useState("");
  const [assigneeOriginal, setAssigneeOriginal] = useState("");
  const [prn, setPrn] = useState("");
  const [inventors, setInventors] = useState<string[]>([]);
  const [ipcAllVersions, setIpcAllVersions] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [chipInput, setChipInput] = useState<Record<Chip, string>>({
    inventors: "",
    ipc_all_versions: "",
    tags: "",
  });
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setApplicationNumber("");
      setApplicationDate("");
      setTitle(defaultTitle ?? "");
      setPublicationCountry("");
      setAbstract("");
      setPriorityDetails("");
      setCurrentAssignee("");
      setAssigneeOriginal("");
      setPrn("");
      setInventors(defaultInventors ?? []);
      setIpcAllVersions([]);
      setTags([]);
      setChipInput({ inventors: "", ipc_all_versions: "", tags: "" });
      setFieldError({});
    }
  }, [open, defaultTitle, defaultInventors]);

  const setChipFor = (kind: Chip, next: string[]) => {
    if (kind === "inventors") setInventors(next);
    if (kind === "ipc_all_versions") setIpcAllVersions(next);
    if (kind === "tags") setTags(next);
  };

  const valueFor = (kind: Chip): string[] => {
    if (kind === "inventors") return inventors;
    if (kind === "ipc_all_versions") return ipcAllVersions;
    return tags;
  };

  const addChip = (kind: Chip) => {
    const raw = chipInput[kind].trim();
    if (!raw) return;
    const current = valueFor(kind);
    if (current.some((c) => c.toLowerCase() === raw.toLowerCase())) {
      setChipInput((p) => ({ ...p, [kind]: "" }));
      return;
    }
    setChipFor(kind, [...current, raw]);
    setChipInput((p) => ({ ...p, [kind]: "" }));
  };

  const removeChip = (kind: Chip, value: string) => {
    setChipFor(
      kind,
      valueFor(kind).filter((c) => c !== value),
    );
  };

  const fileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        application_number: applicationNumber.trim(),
        application_date: applicationDate,
        title: title.trim(),
        publication_country: publicationCountry.trim(),
        abstract: abstract.trim() || null,
        priority_details: priorityDetails.trim() || null,
        current_assignee: currentAssignee.trim() || null,
        assignee_original: assigneeOriginal.trim() || null,
        prn: prn.trim() || null,
        inventors,
        ipc_all_versions: ipcAllVersions,
        tags,
      };
      const response = await API_CONFIG.post(
        `/api/v1/idea/${ideaId}/file`,
        payload,
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
        setFieldError({ application_number: message });
      } else {
        toast.error(message);
      }
    },
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!applicationNumber.trim()) errs.application_number = "Required";
    if (!applicationDate) errs.application_date = "Required";
    if (!title.trim()) errs.title = "Required";
    if (!publicationCountry.trim()) errs.publication_country = "Required";
    setFieldError(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    fileMutation.mutate();
  };

  const chipPill = useMemo(
    () =>
      theme === "dark"
        ? "bg-neutral-800 text-neutral-200 border-neutral-700"
        : "bg-neutral-100 text-neutral-700 border-neutral-200",
    [theme],
  );

  const renderChipField = (
    kind: Chip,
    label: string,
    placeholder: string,
  ) => {
    const list = valueFor(kind);
    return (
      <div>
        <Label className="text-xs font-medium">{label}</Label>
        <div
          className={`mt-1 flex flex-wrap items-center gap-1 rounded-md border px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring ${
            theme === "dark" ? "border-neutral-800" : "border-neutral-300"
          }`}
        >
          {list.map((c) => (
            <span
              key={c}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${chipPill}`}
            >
              {c}
              <button
                type="button"
                onClick={() => removeChip(kind, c)}
                aria-label={`Remove ${c}`}
                className="opacity-60 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            value={chipInput[kind]}
            onChange={(e) =>
              setChipInput((p) => ({ ...p, [kind]: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addChip(kind);
              } else if (
                e.key === "Backspace" &&
                !chipInput[kind] &&
                list.length > 0
              ) {
                setChipFor(kind, list.slice(0, -1));
              }
            }}
            placeholder={list.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
          />
        </div>
      </div>
    );
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

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="application_number" className="text-xs font-medium">
                Application Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="application_number"
                value={applicationNumber}
                onChange={(e) => setApplicationNumber(e.target.value)}
                placeholder="e.g. US20240012345A1"
                className="mt-1"
              />
              {fieldError.application_number && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldError.application_number}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="application_date" className="text-xs font-medium">
                Application Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="application_date"
                type="date"
                value={applicationDate}
                onChange={(e) => setApplicationDate(e.target.value)}
                className="mt-1"
              />
              {fieldError.application_date && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldError.application_date}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="title" className="text-xs font-medium">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
            {fieldError.title && (
              <p className="mt-1 text-xs text-red-500">{fieldError.title}</p>
            )}
          </div>

          <div>
            <Label
              htmlFor="publication_country"
              className="text-xs font-medium"
            >
              Publication Country <span className="text-red-500">*</span>
            </Label>
            <Input
              id="publication_country"
              value={publicationCountry}
              onChange={(e) => setPublicationCountry(e.target.value)}
              placeholder="e.g. US, IN, EP"
              className="mt-1"
            />
            {fieldError.publication_country && (
              <p className="mt-1 text-xs text-red-500">
                {fieldError.publication_country}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="abstract" className="text-xs font-medium">
              Abstract
            </Label>
            <Textarea
              id="abstract"
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="current_assignee" className="text-xs font-medium">
                Current Assignee
              </Label>
              <Input
                id="current_assignee"
                value={currentAssignee}
                onChange={(e) => setCurrentAssignee(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="assignee_original" className="text-xs font-medium">
                Original Assignee
              </Label>
              <Input
                id="assignee_original"
                value={assigneeOriginal}
                onChange={(e) => setAssigneeOriginal(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prn" className="text-xs font-medium">
                PRN
              </Label>
              <Input
                id="prn"
                value={prn}
                onChange={(e) => setPrn(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="priority_details" className="text-xs font-medium">
                Priority Details
              </Label>
              <Input
                id="priority_details"
                value={priorityDetails}
                onChange={(e) => setPriorityDetails(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {renderChipField(
            "inventors",
            "Inventors",
            "Type and press Enter to add",
          )}
          {renderChipField(
            "ipc_all_versions",
            "IPC Classifications",
            "Type and press Enter to add",
          )}
          {renderChipField("tags", "Tags", "Type and press Enter to add")}
        </div>

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
