import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { FileQuestion } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {theme === "dark" ? (
          <>
            {/* Yellow Gradient Blob */}
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(245, 166, 35, 0.3) 0%, rgba(245, 166, 35, 0) 70%)",
                top: "-10%",
                right: "10%",
                animationDelay: "0s",
              }}
            />
            {/* Cyan Gradient Blob */}
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0) 70%)",
                bottom: "10%",
                left: "5%",
                animationDelay: "2s",
              }}
            />
            {/* Purple Gradient Blob */}
            <div
              className="absolute w-[550px] h-[550px] rounded-full opacity-15 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0) 70%)",
                top: "40%",
                left: "30%",
                animationDelay: "4s",
              }}
            />
          </>
        ) : (
          <>
            {/* Yellow Gradient Blob - Light */}
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(245, 166, 35, 0.2) 0%, rgba(245, 166, 35, 0) 70%)",
                top: "-10%",
                right: "10%",
                animationDelay: "0s",
              }}
            />
            {/* Cyan Gradient Blob - Light */}
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0) 70%)",
                bottom: "10%",
                left: "5%",
                animationDelay: "2s",
              }}
            />
            {/* Pink Gradient Blob - Light */}
            <div
              className="absolute w-[550px] h-[550px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0) 70%)",
                top: "40%",
                left: "30%",
                animationDelay: "4s",
              }}
            />
          </>
        )}
      </div>

      <div
        className={`text-center max-w-md p-8 rounded-xl shadow-sm border relative z-10 ${
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
          className="inline-block bg-[#F9B418] hover:bg-[#F9B418]/90 text-black font-medium px-6 py-3 rounded-lg transition-colors font-sans"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
};

export default NotFound;
