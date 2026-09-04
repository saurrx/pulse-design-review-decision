import { useTheme } from "@/hooks/useTheme";
import { FileEdit } from "lucide-react";

interface EmptyDraftsViewProps {
  onCreateDraft: () => void;
}

const EmptyDraftsView: React.FC<EmptyDraftsViewProps> = ({ onCreateDraft }) => {
  const { theme } = useTheme();

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div
        className={`flex w-full max-w-lg flex-col items-center rounded-md border px-8 py-12 text-center ${
          theme === "dark"
            ? "border-neutral-800 bg-neutral-900/50"
            : "border-neutral-200 bg-white shadow-sm"
        }`}
      >
        <div
          className={`mb-5 flex h-12 w-12 items-center justify-center rounded-full ${
            theme === "dark" ? "bg-neutral-800" : "bg-neutral-100"
          }`}
        >
          <FileEdit
            className={`h-5 w-5 ${
              theme === "dark" ? "text-neutral-400" : "text-neutral-500"
            }`}
          />
        </div>
        <h3
          className={`text-lg font-semibold ${
            theme === "dark" ? "text-neutral-100" : "text-neutral-900"
          }`}
        >
          No draft submitted
        </h3>
        <p
          className={`mt-2 max-w-sm text-sm leading-6 ${
            theme === "dark" ? "text-neutral-400" : "text-neutral-500"
          }`}
        >
          Draft content will appear here after the first draft is created.
        </p>
      </div>
    </div>
  );
};

export default EmptyDraftsView;
