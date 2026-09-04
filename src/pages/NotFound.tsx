import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { FileQuestion } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import GradientBlobs from "@/components/common/GradientBlobs";

const NotFound = () => {
  const location = useLocation();
  const { theme } = useTheme();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden ${
        theme === "dark" ? "bg-neutral-950" : "bg-neutral-50"
      }`}
    >
      {/* Animated Gradient Background */}
      <GradientBlobs />

      <div
        className={`text-center max-w-md p-8 rounded-md shadow-sm border relative z-10 ${
          theme === "dark"
            ? "bg-[#0a0a0a] border-neutral-900"
            : "bg-white border-neutral-200"
        }`}
      >
        <div className="flex justify-center mb-6">
          <div
            className={`p-3 rounded-full ${
              theme === "dark"
                ? "bg-neutral-800"
                : "bg-neutral-100"
            }`}
          >
            <FileQuestion size={48} className="text-[#F9B418]" />
          </div>
        </div>
        
        <h1
          className={`text-4xl font-bold mb-2 font-sans ${
            theme === "dark" ? "text-neutral-100" : "text-neutral-900"
          }`}
        >
          404
        </h1>
        <p
          className={`text-xl mb-6 font-sans ${
            theme === "dark" ? "text-neutral-400" : "text-neutral-600"
          }`}
        >
          Oops! We couldn't find that page
        </p>
        <a
          href="/"
          className="inline-block bg-[#F9B418] hover:bg-[#F9B418]/90 text-black font-medium px-6 py-3 rounded-sm transition-colors font-sans"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
};

export default NotFound;
