import { AuthField } from "./AuthField";
import React from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import API_CONFIG from "@/lib/apiConfig";
import { useNavigate } from "react-router-dom";


const validationSchema = Yup.object().shape({
  email: Yup.string().max(50, "Email must be max 50 characters").email("Enter a valid email address").required("Email is required"),
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

  // Errors answer a submit, not a keystroke — see AuthField for why.
  const [submitted, setSubmitted] = React.useState(false);

  const {
    values,
    handleChange,
    handleSubmit,
    errors,
  } = useFormik({
    initialValues: formInitialValues,
    validationSchema,
    validateOnChange: submitted,
    validateOnBlur: submitted,
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

  return (
    <div className="pulse-auth-shell relative flex h-screen items-center justify-center overflow-hidden">
      <div className="pulse-auth-panel w-full flex items-center justify-center p-6 relative z-10">
        {/* Diagonal yellow line */}
        <div className="pulse-auth-card">
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
            <form
              className="ph-no-capture font-sans space-y-2"
              noValidate
              onSubmit={(e) => {
                setSubmitted(true);
                handleSubmit(e);
              }}
            >
              <AuthField
                label="Email"
                name="email"
                type="email"
                maxLength={50}
                autoComplete="username"
                placeholder="you@company.com"
                error={submitted ? errors.email : undefined}
                value={values.email}
                onChange={(e) =>
                  handleChange({
                    target: {
                      name: "email",
                      value: e.target.value?.replace(/\s+/g, "").toLowerCase(),
                    },
                  })
                }
              />

              <button
                type="submit"
                className="w-full py-3 rounded-sm bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all"
                disabled={isLoading}
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
                className="w-full py-3 rounded-sm bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all mt-6"
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

    </div>
  );
};

export default ForgotPassword;
