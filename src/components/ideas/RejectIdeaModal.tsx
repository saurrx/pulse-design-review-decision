import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";

interface RejectIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  ideaName: string;
  /** Called with the rejection reason (reject_reason) when the user confirms */
  onSubmit: (reject_reason: string) => void;
  reason: string;
  setReason: (reason: string) => void;
}

export function RejectIdeaModal({ isOpen, onClose, ideaName, onSubmit, reason, setReason }: RejectIdeaModalProps) {
  const { theme } = useTheme();
  const [confirmText, setConfirmText] = useState("");

  const handleSubmit = () => {
    if (reason.trim() && confirmText === "REJECT") {
      onSubmit(reason.trim());
      setConfirmText("");
      onClose();
    }
  };

  const isConfirmed = confirmText === "REJECT";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-lg border-0 backdrop-blur-xl ${
        theme === "light" 
          ? "bg-white/95" 
          : "bg-neutral-900/95"
      }`}>
        <DialogHeader className="space-y-3 pb-0">
          <div>
            <DialogTitle className={`text-xl ${theme === "light" ? "text-gray-900" : "text-white"}`}>
              Reject Disclosure
            </DialogTitle>
            <DialogDescription className={`text-sm mt-0.5 ${theme === "light" ? "text-gray-500" : "text-neutral-400"}`}>
              This action will notify the inventor and close this submission
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning Box */}
          <div className={`rounded-lg p-4 border ${
            theme === "light"
              ? "border-gray-200 bg-gray-50/50"
              : "border-white/10 bg-white/5"
          }`}>
            <div className="space-y-2">
              <p className={`text-xs uppercase tracking-wide ${
                theme === "light" ? "text-gray-500" : "text-neutral-500"
              }`}>
                Disclosure Being Rejected
              </p>
              <p className={`text-sm ${theme === "light" ? "text-gray-900" : "text-white"}`}>
                {ideaName}
              </p>
              <p className={`text-xs ${theme === "light" ? "text-gray-600" : "text-neutral-400"}`}>
                The inventor will receive notification of this rejection along with your feedback.
              </p>
            </div>
          </div>

          {/* Rejection Reason */}
          <div className="space-y-2">
            <label className={`block text-sm ${theme === "light" ? "text-gray-700" : "text-neutral-300"}`}>
              Reason for Rejection
            </label>
            <textarea
              value={reason}
              required
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear, constructive explanation for why this disclosure is being rejected (e.g., 'This invention lacks novelty as similar solutions exist in the market...')"
              rows={6}
              className={`w-full px-4 py-3 rounded-lg border resize-none transition-all focus:outline-none focus:ring-2 focus:ring-red-500/30 ${
                theme === "light"
                  ? "bg-transparent border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-red-500/50"
                  : "bg-transparent border-white/10 text-white placeholder:text-neutral-500 focus:border-red-500/50"
              }`}
            />
            <p className={`text-xs ${theme === "light" ? "text-gray-500" : "text-neutral-500"}`}>
              Provide constructive feedback to help the inventor understand the decision
            </p>
          </div>

          {/* Confirmation */}
          <div className="space-y-2">
            <label className={`block text-sm ${theme === "light" ? "text-gray-700" : "text-neutral-300"}`}>
              Type <span className={`font-mono ${theme === "light" ? "text-red-600" : "text-red-400"}`}>REJECT</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type REJECT"
              className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-red-500/30 ${
                theme === "light"
                  ? "bg-transparent border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-red-500/50"
                  : "bg-transparent border-white/10 text-white placeholder:text-neutral-500 focus:border-red-500/50"
              } ${isConfirmed ? "ring-2 ring-red-500/30" : ""}`}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className={`px-6 border ${
              theme === "light" 
                ? "border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-transparent" 
                : "border-white/10 text-neutral-400 hover:text-white hover:border-white/20 hover:bg-transparent"
            }`}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || !isConfirmed}
            className="bg-red-600 hover:bg-red-700 text-white px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject Disclosure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}