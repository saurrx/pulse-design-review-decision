import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";

interface SubmitActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionLabel?: string;
  applicationNumber?: string;
  selectedCountries?: string[];
  onConfirm: () => void;
  isSubmitting: boolean;
}

const SubmitActionsDialog: React.FC<SubmitActionsDialogProps> = ({
  open,
  onOpenChange,
  actionLabel,
  applicationNumber,
  selectedCountries,
  onConfirm,
  isSubmitting,
}) => {
  const { theme } = useTheme();
  const hasCountries = !!selectedCountries?.length;
  const displayLabel = hasCountries
    ? actionLabel?.replace(/\s*\([^)]*\)\s*$/, "").trim()
    : actionLabel;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={`${
          theme === "dark" ? "bg-neutral-900 border-[#cccccc20]" : "bg-white"
        } rounded-lg`}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className={`font-sans text-lg ${
              theme === "dark" ? "text-neutral-100" : "text-zinc-900"
            }`}
          >
            Submit Action to Outside Counsel
          </AlertDialogTitle>
          <AlertDialogDescription
            className={`font-sans text-sm ${
              theme === "dark" ? "text-neutral-400" : "text-zinc-500"
            }`}
            asChild
          >
            <div className="space-y-3">
              {displayLabel && applicationNumber ? (
                <p>
                  You are about to submit <strong>"{displayLabel}"</strong> for
                  application <strong>{applicationNumber}</strong> to Outside
                  Counsel. They will be notified via email. This action cannot
                  be undone.
                </p>
              ) : (
                <p>
                  This action will be sent to Outside Counsel. They will be
                  notified via email. This action cannot be undone.
                </p>
              )}
              {hasCountries && (
                <div className="flex items-start gap-2 flex-wrap">
                  <span
                    className={`text-xs font-medium pt-0.5 ${
                      theme === "dark" ? "text-neutral-300" : "text-zinc-700"
                    }`}
                  >
                    Countries:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedCountries!.map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className={`text-xs ${
                          theme === "dark"
                            ? "border-[#cccccc30] text-neutral-200"
                            : "border-slate-300 text-zinc-700"
                        }`}
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className={`bg-transparent border font-sans rounded-lg ${
              theme === "dark"
                ? "border-white text-zinc-300 hover:bg-transparent hover:text-zinc-300"
                : ""
            }`}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSubmitting}
            className="text-zinc-900 font-medium rounded-lg font-sans bg-[#F9B418] hover:bg-[#F9B418]"
          >
            {isSubmitting ? "Submitting..." : "Submit to OC"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SubmitActionsDialog;
