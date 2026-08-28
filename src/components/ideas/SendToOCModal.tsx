import { useState } from "react";
import { X, Plus, Send } from "lucide-react";
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

interface SendToOCModalProps {
  isOpen: boolean;
  onClose: () => void;
  ideaName: string;
  onSubmit: (message?: string) => void;
  instructions: string;
  setInstructions: (text: string) => void;
}

export function SendToOCModal({
  isOpen,
  onClose,
  ideaName,
  onSubmit,
  instructions,
  setInstructions,
}: SendToOCModalProps) {
  const { theme } = useTheme();

  const handleSubmit = () => {
    onSubmit();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`max-w-lg border-0 backdrop-blur-xl ${
          theme === "light" ? "bg-white/95" : "bg-neutral-900/95"
        }`}
      >
        <DialogHeader className="space-y-3 pb-0">
          <div>
            <DialogTitle
              className={`text-xl ${
                theme === "light" ? "text-gray-900" : "text-white"
              }`}
            >
              Send to Outside Counsel
            </DialogTitle>
            <DialogDescription
              className={`text-sm mt-0.5 ${
                theme === "light" ? "text-gray-500" : "text-neutral-400"
              }`}
            >
              Forward this disclosure for patent application filing
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* What's Being Sent */}
          <div
            className={`rounded-lg p-4 border ${
              theme === "light"
                ? "bg-gradient-to-br from-gray-50 to-transparent border-gray-200"
                : "bg-gradient-to-br from-white/5 to-transparent border-white/10"
            }`}
          >
            <div className="space-y-2">
              <p
                className={`text-xs uppercase tracking-wide ${
                  theme === "light" ? "text-gray-500" : "text-neutral-500"
                }`}
              >
                Disclosure to Send
              </p>
              <p
                className={`text-sm ${
                  theme === "light" ? "text-gray-900" : "text-white"
                }`}
              >
                {ideaName}
              </p>
            </div>
          </div>

          {/* Instructions for OC */}
          <div className="space-y-2">
            <label
              className={`block text-sm ${
                theme === "light" ? "text-gray-700" : "text-neutral-300"
              }`}
            >
              Instructions for Outside Counsel{" "}
              <span
                className={`text-xs ${
                  theme === "light" ? "text-gray-400" : "text-neutral-500"
                }`}
              >
                (Optional)
              </span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Add any special instructions, filing priorities, or context for the legal team..."
              rows={5}
              className={`w-full px-4 py-3 rounded-lg border resize-none transition-all focus:outline-none focus:ring-2 focus:ring-[#F9B418]/50 ${
                theme === "light"
                  ? "bg-transparent border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#F9B418]"
                  : "bg-transparent border-white/10 text-white placeholder:text-neutral-500 focus:border-[#F9B418]/50"
              }`}
            />
          </div>

          {/* Info Note */}
          <div
            className={`rounded-lg p-3 border ${
              theme === "light"
                ? "bg-blue-50/50 border-blue-200/50"
                : "bg-blue-500/5 border-blue-500/20"
            }`}
          >
            <p
              className={`text-xs ${
                theme === "light" ? "text-blue-700" : "text-blue-400"
              }`}
            >
              The complete disclosure document, including all sections and
              supporting files, will be sent to your outside counsel team for
              patent application processing.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className={`px-6 border ${
              theme === "light"
                ? "border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
                : "border-white/10 text-neutral-400"
            }`}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-[#F9B418] hover:bg-[#F9B418]/90 text-black px-6"
          >
            <Send className="w-4 h-4 mr-2" />
            Send to OC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
