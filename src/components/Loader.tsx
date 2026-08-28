import { useTheme } from "@/hooks/useTheme";
import { motion } from "framer-motion";
import React from "react";

const Loader: React.FC = () => {
  const { theme } = useTheme();
  return (
    <div className="relative w-full h-full min-h-[400px] flex items-center justify-center">
      {/* Loading Content */}
      <div className="flex flex-col items-center gap-6">
        {/* Spinner */}
        <div className="relative w-16 h-16">
          {/* Outer Ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#F9B418] border-r-[#F9B418]"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Inner Ring */}
          <motion.div
            className="absolute inset-2 rounded-full border-2 border-transparent border-b-[#F9B418]/50 border-l-[#F9B418]/50"
            animate={{ rotate: -360 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Center Pulse */}
          <motion.div
            className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-[#F9B418]"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [1, 0.5, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Glow Effect */}
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-50"
            style={{
              background:
                "radial-gradient(circle, rgba(245, 166, 35, 0.4) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0 }}
          className="flex flex-col items-center gap-2"
        >
          <p
            className={`text-sm ${
              theme === "dark" ? "text-neutral-50" : "text-neutral-800"
            }`}
          >
            Loading
          </p>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#F9B418]"
                animate={{
                  opacity: [0.3, 1, 0.3],
                  scale: [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Loader;
