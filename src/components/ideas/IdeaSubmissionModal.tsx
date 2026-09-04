import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ClipboardPaste,
  FileText,
  Upload,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import ideaDraftQuestions from "@/lib/IdeaDraftQuestion";
import { useTheme } from "@/hooks/useTheme";
import { track } from "@/lib/analytics";

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
  const [contextMode, setContextMode] = useState<"files" | "text" | null>(
    null,
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasSource = sourceFiles.length > 0 || sourceText.trim().length > 0;

  // Modal opened — a funnel entry point. No content, just the event.
  useEffect(() => {
    if (open) track("idea_create_opened");
  }, [open]);

  const resetForm = () => {
    setTitle("");
    setSourceFiles([]);
    setSourceText("");
    setContextMode(null);
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

      // Idea + draft created — opaque ids only, never the title or source text.
      track("idea_created", { idea_id: response?.data?.data?.id });

      refetchIdeas();
      if (silent) {
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
    if (next.length) {
      setSourceFiles((prev) => [...prev, ...next]);
      setContextMode("files");
    }
  };

  const dark = theme === "dark";
  const muted = dark ? "text-neutral-500" : "text-[#727272]";
  const ink = dark ? "text-neutral-100" : "text-[#0C0C0C]";
  const hairline = dark ? "bg-[#cccccc20]" : "bg-[#E8E8E8]";
  const fieldBorder = dark ? "border-white/10" : "border-[#E8E8E8]";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`${
          dark ? "bg-[#080808] border-[#cccccc20]" : "bg-white"
        } max-h-[88vh] overflow-hidden rounded-2xl p-0 font-sans sm:max-w-[600px]`}
      >
        <DialogHeader className="px-7 pb-5 pt-7">
          <DialogTitle
            className={`font-sans text-2xl font-semibold tracking-[-0.025em] ${
              dark ? "text-neutral-100" : "text-zinc-900"
            }`}
          >
            Start an idea
          </DialogTitle>
        </DialogHeader>

        <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 space-y-6 overflow-y-auto px-7 pb-7">
            <div>
              <label
                htmlFor="idea-title"
                className={`mb-2 flex items-center gap-2 text-sm font-medium ${ink}`}
              >
                Working title
                <span className={`text-xs font-normal ${muted}`}>Required</span>
              </label>
              <Input
                autoFocus
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`h-12 w-full rounded-xl border bg-transparent px-3.5 text-[15px] outline-none focus-visible:border-[#4351C0] focus-visible:ring-2 focus-visible:ring-[#4351C0]/10 ${fieldBorder} ${
                  dark
                    ? "text-neutral-100 placeholder:text-neutral-500"
                    : "text-neutral-900 placeholder:text-neutral-400"
                }`}
                type="text"
                id="idea-title"
                placeholder="What would you call it if you were telling a colleague?"
              />
            </div>

            <section className={`border-t pt-5 ${dark ? "border-white/10" : "border-[#E8E8E8]"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className={`text-sm font-semibold ${ink}`}>
                    Already have something written?
                    <span className={`ml-2 font-normal ${muted}`}>Optional</span>
                  </h3>
                  <p className={`mt-1 text-xs ${muted}`}>
                    Slides, notes, a sketch, or anything relevant. We turn it into a
                    draft. You don't start from a blank page.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={contextMode === "files"}
                  onClick={() => setContextMode(contextMode === "files" ? null : "files")}
                  className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-[13px] font-medium transition-colors ${
                    contextMode === "files"
                      ? dark
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-[#C8C8C8] bg-[#F5F5F5] text-[#0C0C0C]"
                      : dark
                        ? "border-white/10 text-neutral-300 hover:border-white/25"
                        : "border-[#E8E8E8] text-[#444444] hover:border-[#C8C8C8] hover:bg-[#FAFAFA]"
                  }`}
                >
                  <Upload className="h-4 w-4" /> Upload files
                </button>
                <button
                  type="button"
                  aria-pressed={contextMode === "text"}
                  onClick={() => setContextMode(contextMode === "text" ? null : "text")}
                  className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-[13px] font-medium transition-colors ${
                    contextMode === "text"
                      ? dark
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-[#C8C8C8] bg-[#F5F5F5] text-[#0C0C0C]"
                      : dark
                        ? "border-white/10 text-neutral-300 hover:border-white/25"
                        : "border-[#E8E8E8] text-[#444444] hover:border-[#C8C8C8] hover:bg-[#FAFAFA]"
                  }`}
                >
                  <ClipboardPaste className="h-4 w-4" /> Paste notes
                </button>
              </div>

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

              {contextMode === "files" && (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
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
                    className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm transition-colors ${
                      isDragOver
                        ? "border-[#4351C0] bg-[#4351C0]/5 text-[#4351C0]"
                        : dark
                          ? "border-white/20 text-neutral-300 hover:border-white/35"
                          : "border-[#C8C8C8] text-[#444444] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    Drop files here or choose files
                    <span className={`text-xs ${muted}`}>PDF, DOCX, PPTX</span>
                  </button>
                  {sourceFiles.map((file) => (
                    <div
                      key={file.name}
                      className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm ${fieldBorder} ${ink}`}
                    >
                      <FileText className={`h-4 w-4 shrink-0 ${muted}`} />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSourceFiles((files) =>
                            files.filter((item) => item.name !== file.name),
                          )
                        }
                        className={`grid h-7 w-7 place-items-center ${muted} hover:text-[#0C0C0C] dark:hover:text-neutral-200`}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {contextMode === "text" && (
                <textarea
                  autoFocus
                  rows={4}
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Paste an email, meeting notes, or a rough description…"
                  className={`mt-3 w-full resize-none rounded-xl border bg-transparent px-3.5 py-3 text-sm outline-none focus-visible:border-[#4351C0] focus-visible:ring-2 focus-visible:ring-[#4351C0]/10 ${fieldBorder} ${
                    dark
                      ? "text-neutral-100 placeholder:text-neutral-500"
                      : "text-neutral-900 placeholder:text-neutral-400"
                  }`}
                />
              )}
            </section>
          </div>

          <div className={`h-[1px] w-full ${hairline}`} />
          <div className="flex items-center justify-between gap-4 px-7 py-4">
            <p className={`text-xs ${muted}`}>
              {title.trim() ? "Everything can be edited later." : "Enter a title to continue."}
            </p>
            <button
              type="submit"
              className="inline-flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-[#F9B418] px-5 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700] disabled:cursor-not-allowed disabled:bg-[#FDF3DC] disabled:text-[#9C9C9C]"
              disabled={!title.trim() || isCreatingIdea}
            >
              {isCreatingIdea ? "Saving…" : "Save Idea"}
              {!isCreatingIdea && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default IdeaSubmissionModal;
