import { Input } from "@/components/ui/input";
import React from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import API_CONFIG from "@/lib/apiConfig";
import { useNavigate } from "react-router-dom";

import { TechBackground } from "../TechBackground";
import { BannerAnimation } from "../BannerAnimation";

const validationSchema = Yup.object().shape({
  email: Yup.string().max(50, "Email must be max 50 characters").email().required("Email is required"),
});

export interface iForgotPasswordForm {
  email: string;
}

const formInitialValues: iForgotPasswordForm = {
  email: "",
};

type StatusType = "PENDING" | "SENT";

const ForgotPassword = () => {
  const [status, setStatus] = React.useState<StatusType>("PENDING");
  const navigate = useNavigate();

  const {
    values,
    handleBlur,
    handleChange,
    handleSubmit,
    touched,
    isValid,
    errors,
  } = useFormik({
    initialValues: formInitialValues,
    validationSchema,
    onSubmit: (values: iForgotPasswordForm) => {
      forgotPasswordMutate(values.email);
    },
  });

  // forgot password mutation
  const { mutate: forgotPasswordMutate, isPending: isLoading } = useMutation({
    mutationKey: ["forgot_password"],
    mutationFn: async (email: string) => {
      try {
        const response = await API_CONFIG.post(
          "/api/v1/auth/forgot-password",
          {
            email,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response?.data) {
          toast.success("Password reset link sent to your email");
          setStatus("SENT");
        }
      } catch (error: any) {
        console.error("Error sending forgot password email:", error);
        toast.error(
          error?.response?.data?.message ||
            "Error sending password reset link. Please try again."
        );
      }
    },
  });

  const blobs = [
    {
      size: "600px",
      opacity: "opacity-20",
      gradient:
        "radial-gradient(circle, rgba(245, 166, 35, 0.4) 0%, rgba(245, 166, 35, 0) 70%)",
      position: { top: "-10%", right: "10%" },
      delay: "0s",
    },
    {
      size: "500px",
      opacity: "opacity-20",
      gradient:
        "radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0) 70%)",
      position: { bottom: "10%", left: "5%" },
      delay: "2s",
    },
    {
      size: "550px",
      opacity: "opacity-15",
      gradient:
        "radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0) 70%)",
      position: { top: "40%", left: "30%" },
      delay: "4s",
    },
  ];

  const dots = [
    {
      left: "4.08341%",
      top: "61.1975%",
      size: "3.94594px",
      duration: "29.7023s",
      delay: "0.0249044s",
    },
    {
      left: "1.11904%",
      top: "49.5853%",
      size: "3.50196px",
      duration: "19.4816s",
      delay: "2.0221s",
    },
    {
      left: "12.1253%",
      top: "47.9584%",
      size: "3.77664px",
      duration: "11.3665s",
      delay: "4.05669s",
    },
    {
      left: "85.7327%",
      top: "4.22111%",
      size: "3.5286px",
      duration: "28.0133s",
      delay: "2.4293s",
    },
    {
      left: "47.1505%",
      top: "56.8357%",
      size: "1.36468px",
      duration: "26.4195s",
      delay: "4.50389s",
    },
    {
      left: "97.656%",
      top: "12.0358%",
      size: "1.60298px",
      duration: "26.674s",
      delay: "1.95553s",
    },
    {
      left: "0.230657%",
      top: "19.8684%",
      size: "2.51946px",
      duration: "14.6645s",
      delay: "2.97569s",
    },
    {
      left: "79.72%",
      top: "26.494%",
      size: "1.26092px",
      duration: "26.6991s",
      delay: "2.2707s",
    },
    {
      left: "63.8366%",
      top: "86.841%",
      size: "3.36228px",
      duration: "12.4477s",
      delay: "3.10225s",
    },
    {
      left: "60.4107%",
      top: "94.7844%",
      size: "3.10993px",
      duration: "12.853s",
      delay: "4.24409s",
    },
    {
      left: "54.7956%",
      top: "47.8282%",
      size: "2.55006px",
      duration: "29.5111s",
      delay: "4.89435s",
    },
    {
      left: "52.1419%",
      top: "73.1778%",
      size: "1.09815px",
      duration: "23.203s",
      delay: "4.35727s",
    },
    {
      left: "96.2338%",
      top: "20.9787%",
      size: "2.46493px",
      duration: "25.3881s",
      delay: "3.60092s",
    },
    {
      left: "31.5422%",
      top: "85.0532%",
      size: "3.3354px",
      duration: "19.4414s",
      delay: "4.6492s",
    },
  ];

  

  return (
    <div className="pulse-auth-shell relative flex h-screen overflow-hidden bg-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {blobs.map((blob, i) => (
          <div
            key={i}
            className={`absolute rounded-full blur-3xl animate-blob ${blob.opacity}`}
            style={{
              width: blob.size,
              height: blob.size,
              background: blob.gradient,
              animationDelay: blob.delay,
              ...blob.position,
            }}
          />
        ))}

        {dots.map((dot, i) => (
          <div
            key={i}
            className="absolute bg-white/20 rounded-full animate-float"
            style={{
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              animationDuration: dot.duration,
              animationDelay: dot.delay,
            }}
          />
        ))}
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative z-10">
        {/* Diagonal yellow line */}
        <style>
          {`
          @keyframes moveDown {
            0% {
              transform: translateY(-120px) rotate(-45deg);
              opacity: 0;
            }
            15% {
              opacity: 0.09;
            }
            80% {
              transform: translateY(100vh) rotate(-45deg);
              opacity: 0.09;
            }
            85% {
              transform: translateY(100vh) rotate(-45deg);
              opacity: 0;
            }
            90% {
              transform: translateY(100vh) rotate(-45deg);
              opacity: 0;
            }
            95% {
              transform: translateY(100vh) rotate(-45deg);
              opacity: 0;
            }
            100% {
              transform: translateY(100vh) rotate(-45deg);
              opacity: 0;
            }
          }
        `}
        </style>
        <div className="absolute -top-20 -left-20 w-[100%] h-1 bg-[#e6bd06] -rotate-45 animate-[moveDown_10s_linear_infinite]" />

        <div className="w-full max-w-md">
          <div className="mb-6">
            <img
              src="/assets/photon-legal.png"
              alt="Photon Legal"
              className="h-10"
            />
          </div>

          <div className="mb-6">
            <h1 className="text-3xl mb-2 text-white font-display font-semibold">
              Reset password
            </h1>
            <p className="text-neutral-400 font-sans">
              Enter your email to receive a password reset link
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate("/login", {
                state: { fromForgotPage: true },
              })
            }
            className="font-sans flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-6"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-arrow-left w-4 h-4"
              aria-hidden="true"
            >
              <path d="m12 19-7-7 7-7"></path>
              <path d="M19 12H5"></path>
            </svg>
            <span>Back to sign in</span>
          </button>

          {status === "PENDING" && (
            <form className="font-sans space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  data-slot="label"
                  className="items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-sm mb-2 block text-neutral-300"
                  htmlFor="reset-email"
                >
                  Email
                </label>
                <Input
                  type="email"
                  id="reset-email"
                  className="flex w-full min-w-0 h-11 rounded-md border px-3 py-1 text-sm bg-white/5 border-white/10 text-white placeholder:text-neutral-600 outline-none transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50  focus-visible:border-[#F9B418]"
                  placeholder="you@photonlegal.com"
                  required
                  maxLength={50}
                  onChange={(e) => handleChange({target: {name: "email", value: e.target.value?.trim()?.toLowerCase()}})}
                  onBlur={(e) => handleBlur({target: {name: "email", value: e.target.value?.trim()?.toLowerCase()}})}
                  name="email"
                  errors={errors}
                  touched={touched}
                  value={values.email?.trim()?.toLowerCase()}
                ></Input>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all"
                disabled={!isValid || isLoading}
                style={{ boxShadow: "rgba(249, 180, 24, 0.3) 0px 0px 20px" }}
              >
                {isLoading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          {status === "SENT" && (
            <div
              className="space-y-4"
              style={{ opacity: "1", transform: "none" }}
            >
              <div className="w-16 h-16 rounded-full bg-[#F9B418]/10 border border-[#F9B418]/20 flex items-center justify-center mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-mail w-8 h-8 text-[#F9B418]"
                  aria-hidden="true"
                >
                  <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"></path>
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                </svg>
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-xl text-white">Check your email</h3>
                <p className="text-neutral-400">
                  We've sent a password reset link to{" "}
                  <span className="text-white">{values.email}</span>
                </p>
                <p className="text-sm text-neutral-500">
                  Didn't receive the email? Check your spam folder or{" "}
                  <button
                    onClick={() => navigate("/forgot-password")}
                    className="text-[#F9B418] hover:text-[#F9B418]/80 transition-colors"
                  >
                    try again
                  </button>
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all mt-6"
              >
                Back to sign in
              </button>
            </div>
          )}

          <div className="mt-8 text-center font-sans">
            <p className="text-xs text-neutral-700">
              © {new Date().getFullYear()} Photon Legal. All rights reserved.
            </p>
          </div>

        </div>
      </div>

      <div className="hidden lg:flex w-1/2 items-center justify-center relative z-10 overflow-hidden">
      <TechBackground/>
      </div>
    </div>
  );
};

export default ForgotPassword;
