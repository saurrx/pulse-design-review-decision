import React, { useRef, useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import ideaDraftQuestions from "@/lib/IdeaDraftQuestion";
import { useTheme } from "@/hooks/useTheme";

interface IdeaSubmissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refetchIdeas: () => void;
}

/**
 * Minimum-friction idea capture, sectioned like a disclosure intake form:
 * title, optional document uploads, an "or" divider, optional pasted
 * content, one full-width primary action. The current user becomes primary
 * inventor server-side; co-inventors are collected later in the draft
 * workspace. Pulse tokens throughout: 2px radii, #E8E8E8 hairlines, amber
 * only on the primary action.
 */
const IdeaSubmissionModal: React.FC<IdeaSubmissionModalProps> = ({
  open,
  onOpenChange,
  refetchIdeas,
}) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasSource = sourceFiles.length > 0 || sourceText.trim().length > 0;

  const resetForm = () => {
    setTitle("");
    setSourceFiles([]);
    setSourceText("");
  };

  // Creates the idea + a fresh draft. `silent` is the close-with-title path:
  // no navigation, a single "Saved to drafts" toast.
  const { isPending: isCreatingIdea, mutateAsync: createIdea } = useMutation({
    mutationKey: ["create_idea"],
    // All form values are passed explicitly — reading component state here
    // races with the form reset on close.
    mutationFn: async ({
      silent,
      ideaTitle,
      prefill,
    }: {
      silent: boolean;
      ideaTitle: string;
      prefill: any;
    }) => {
      // Primary inventor is set server-side from the session — sent empty
      // deliberately.
      const response = await API_CONFIG.post("/api/v1/idea/create", {
        title: ideaTitle,
        inventors: [],
      });
      if (response.status !== 201) throw new Error("Failed to create idea");

      const res = await API_CONFIG.post("/api/v1/idea/create-new/draft", {
        idea_id: response?.data?.data?.id,
        meta_data: ideaDraftQuestions,
        // Existing autofill pipeline input; provenance is tagged so review
        // can distinguish inventor-provided source material.
        prefill,
      });

      refetchIdeas();
      if (silent) {
        toast.success("Saved to drafts", { position: "top-center" });
      } else {
        navigate(
          `/ideas/${res?.data?.data?.idea_id}/draft?draftId=${res?.data?.data?.id}`,
        );
      }
      return res?.data?.data;
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Error creating idea", {
        position: "top-center",
      });
    },
  });

  const buildPrefill = () =>
    hasSource
      ? {
          source: "inventor-provided",
          file_names: sourceFiles.map((f) => f.name),
          text: sourceText.trim() || null,
        }
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isCreatingIdea) return;
    await createIdea({
      silent: false,
      ideaTitle: title.trim(),
      prefill: buildPrefill(),
    });
    resetForm();
    onOpenChange(false);
  };

  // Closing never loses a typed title: silently save it as a draft.
  const handleOpenChange = (next: boolean) => {
    if (!next && title.trim() && !isCreatingIdea) {
      createIdea({
        silent: true,
        ideaTitle: title.trim(),
        prefill: buildPrefill(),
      });
    }
    if (!next) resetForm();
    onOpenChange(next);
  };

  const acceptFiles = (list: FileList | null | undefined) => {
    if (!list) return;
    const next: File[] = [];
    Array.from(list).forEach((file) => {
      if (!/\.(pdf|docx|pptx)$/i.test(file.name)) {
        toast.error(`${file.name}: use a .pdf, .docx, or .pptx file`, {
          position: "top-center",
        });
        return;
      }
      if (
        !sourceFiles.some((f) => f.name === file.name) &&
        !next.some((f) => f.name === file.name)
      ) {
        next.push(file);
      }
    });
    if (next.length) setSourceFiles((prev) => [...prev, ...next]);
  };

  const dark = theme === "dark";
  const muted = dark ? "text-neutral-500" : "text-[#727272]";
  const ink = dark ? "text-neutral-100" : "text-[#0C0C0C]";
  const hairline = dark ? "bg-[#cccccc20]" : "bg-[#E8E8E8]";
  const fieldBorder = dark ? "border-white/10" : "border-[#E8E8E8]";

  const sectionHeading = `text-base font-semibold ${ink}`;
  const fieldLabel = `mb-1 block text-xs font-medium font-sans tracking-wider uppercase ${
    dark ? "text-neutral-400" : "text-neutral-600"
  }`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`${
          dark ? "bg-[#080808] border-[#cccccc20]" : "bg-white"
        } sm:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl p-0 font-sans`}
      >
        <DialogHeader className="px-6 pt-6">
          <DialogTitle
            className={`text-xl font-bold tracking-wide font-sans ${
              dark ? "text-neutral-100" : "text-zinc-900"
            }`}
          >
            Submit an Idea
          </DialogTitle>
        </DialogHeader>

        <form className="flex flex-col" onSubmit={handleSubmit}>
          <div className="space-y-7 px-6 pb-6 pt-2">
            {/* ---- Invention details ---- */}
            <section>
              <h3 className={sectionHeading}>Invention Details</h3>
              <div className="mt-3">
                <label htmlFor="idea-title" className={fieldLabel}>
                  Idea title <span className={`${muted} normal-case`}>(required)</span>
                </label>
                <Input
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none focus-visible:border-[#F9B418] focus-visible:ring-0 ${fieldBorder} ${
                    dark
                      ? "text-neutral-100 placeholder:text-neutral-500"
                      : "text-neutral-900 placeholder:text-neutral-400"
                  }`}
                  type="text"
                  id="idea-title"
                  placeholder="A short working title — you can refine it later"
                />
              </div>
            </section>

            {/* ---- Upload documents ---- */}
            <section
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                acceptFiles(e.dataTransfer.files);
              }}
            >
              <h3 className={sectionHeading}>Upload Relevant Documents</h3>
              <p className={`mt-1 text-xs ${muted}`}>
                Drop a write-up, deck, or PDF — we'll pre-fill your draft from
                it. (.pdf, .docx, .pptx)
              </p>

              {sourceFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <span className={fieldLabel}>Uploaded files</span>
                  {sourceFiles.map((f) => (
                    <div key={f.name} className="flex items-center gap-2">
                      <div
                        className={`flex h-10 flex-1 items-center gap-2 rounded-xl border px-3 text-sm ${fieldBorder} ${ink}`}
                      >
                        <FileText className="h-4 w-4 shrink-0 text-[#727272]" />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSourceFiles((prev) =>
                            prev.filter((x) => x.name !== f.name),
                          )
                        }
                        className={`p-1 ${muted} transition-colors hover:text-[#0C0C0C] dark:hover:text-neutral-200`}
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx"
                multiple
                className="hidden"
                onChange={(e) => {
                  acceptFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`mt-3 inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  isDragOver
                    ? "border-[#F9B418] bg-[#F9B418]/5"
                    : dark
                      ? "border-white/15 text-neutral-300 hover:border-white/30"
                      : "border-[#C8C8C8] text-[#444444] hover:bg-[#F5F5F5]"
                }`}
              >
                <Plus className="h-4 w-4" /> Upload Files
              </button>
            </section>

            {/* ---- or ---- */}
            <div className="flex items-center gap-4">
              <div className={`h-[1px] flex-1 ${hairline}`} />
              <span className={`text-xs ${muted}`}>or</span>
              <div className={`h-[1px] flex-1 ${hairline}`} />
            </div>

            {/* ---- Paste content ---- */}
            <section>
              <h3 className={sectionHeading}>Paste Related Content</h3>
              <textarea
                rows={5}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste anything — an email, meeting notes, a rough description. We'll structure it for you."
                className={`mt-3 w-full resize-y rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-[#F9B418] ${fieldBorder} ${
                  dark
                    ? "text-neutral-100 placeholder:text-neutral-500"
                    : "text-neutral-900 placeholder:text-neutral-400"
                }`}
              />
              <p className={`mt-1 text-xs ${muted}`}>
                Both are optional — skip them to start with a blank draft.
              </p>
            </section>
          </div>

          {/* ---- Primary action ---- */}
          <div className={`h-[1px] w-full ${hairline}`} />
          <div className="px-6 py-4">
            <button
              type="submit"
              className="h-10 w-full rounded-xl bg-[#F9B418] text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!title.trim() || isCreatingIdea}
            >
              {isCreatingIdea
                ? "Creating..."
                : hasSource
                  ? "Create & pre-fill draft"
                  : "Create draft"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default IdeaSubmissionModal;
