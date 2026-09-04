import React from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AuthField } from "./AuthField";
import { Button } from "@/components/ui/button";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import API_CONFIG from "@/lib/apiConfig";
import { Eye, EyeOff } from "lucide-react";
import { iLoginForm } from "./Login";
import Cookies from "js-cookie";
import { useMemo, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion"
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
// password and confirm_password fields. both should be same case sentsitive
const validationSchema = Yup.object().shape({
  password: Yup.string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters long")
    .matches(/[a-z]/, "Must contain at least one lowercase letter")
    .matches(/[A-Z]/, "Must contain at least one uppercase letter")
    .matches(/\d/, "Must contain at least one number")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, "Must contain at least one special character"),
  confirm_password: Yup.string()
    .required("Confirm Password is required")
    .oneOf([Yup.ref("password")], "Passwords must match"),
});

// define interface for form values
interface FormValues {
  password: string;
  confirm_password: string;
}

// define initial values for form
const initialValues: FormValues = {
  password: "",
  confirm_password: "",
};

type CurrentPageStatusType = "SUCCESS_RESET" | "SUCCESS_SET" | "ALREADY_ACTIVE" | "PENDING";

const ResetPassword: React.FC = () => {
  const [currentPageStatus, setCurrentPageStatus] =
    useState<CurrentPageStatusType>("PENDING");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = searchParams?.get("source");
  const isForgotPasswordFlow = source === "forgot_password";

  const { mutate: loginMutate, isPending: isLoadingLogin } = useMutation({
    mutationKey: ["ihc_login"],
    mutationFn: async (data: iLoginForm) => {
      try {
        const response = await API_CONFIG.post("/api/v1/auth/login", data, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response?.data?.data) {
          const { user } = response.data.data;

          if (user) {
            Cookies.set("pl_user", JSON.stringify(user), { secure: true, sameSite: "lax", path: "/" });
            window.location.href = "/";
          }
        }
      } catch (error) {
        console.error("Error logging in:", error);
        toast.error(error?.response?.data?.message || "Error logging in");
      }
    },
  });

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  // Redirect to login if token is missing or invalid
  useEffect(() => {
    if (!token) {
      toast.error("Invalid or missing reset token");
      navigate("/login");
    }
  }, [token, navigate]);

  const { mutate, isPending } = useMutation({
    mutationKey: ["reset_password"],
    mutationFn: async (values: {
      user_id: string;
      password: string;
      source?: "verify_link";
      email?: string;
    }) => {
      try {
        let response;

        if (source === "email_signup") {
          // Email signup: user does not exist yet; backend creates them.
          response = await API_CONFIG.post(
            `/api/v1/auth/complete-signup`,
            {
              token,
              email: email || values.email,
              password: values.password,
            },
            { headers: { "Content-Type": "application/json" } }
          );
          if (response?.status === 200) {
            setCurrentPageStatus("SUCCESS_SET");
            setTimeout(() => navigate("/login"), 2000);
          }
          return response?.data;
        }
  

        if (isForgotPasswordFlow) {
          // Forgot password flow - call reset-password endpoint
          response = await API_CONFIG.post(
            `/api/v1/auth/reset-password`,
            {
              token,
              password: values.password,
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (response?.status === 200) {
            setCurrentPageStatus("SUCCESS_RESET");
            // Redirect to login page after a short delay
            setTimeout(() => {
              navigate("/login");
            }, 2000);
          }
        } else {
          // Original set-password flow
          response = await API_CONFIG.post(
            `/api/v1/auth/ihc/set-password`,
            {
              token,
              password: values.password,
              email: values.email,
              source: source || null,
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (response?.status === 200) {
            setCurrentPageStatus("SUCCESS_SET");
            setTimeout(() => {
              navigate("/login");
            }, 2000);
          }
        }

        return response?.data;
      } catch (error: any) {
        console.error("Error resetting password:", error);
        toast.error(
          error?.response?.data?.message || "Error resetting password"
        );
      }
    },
  });

  // useFormik hook to manage form state and validation
  // Errors answer a submit, not a keystroke — see AuthField for why.
  const [submitted, setSubmitted] = useState(false);

  const {
    values,
    errors,
    handleChange,
    handleSubmit,
  } = useFormik({
    initialValues,
    validationSchema,
    validateOnChange: submitted,
    validateOnBlur: submitted,
    onSubmit: (values) => {
      // handle form submission
      if (isForgotPasswordFlow) {
        mutate({
          password: values.password,
          user_id: searchParams?.get("user_id") || "",
        });
      } else {
        mutate({
          password: values.password,
          source: "verify_link",
          user_id: searchParams?.get("user_id") || "",
          email: searchParams?.get("email") || "",
        });
      }
    },
  });

  return (
    <div className="pulse-auth-shell relative flex h-screen items-center justify-center overflow-hidden">
      <AuthLoadingOverlay show={isLoadingLogin} />

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
              {currentPageStatus === "SUCCESS_RESET"
                ? "Password reset successfully!" : currentPageStatus === "SUCCESS_SET"
                  ? "Password set successfully!"
                  : isForgotPasswordFlow
                    ? "Reset Your Password"
                    : "Set Your Password"}
            </h1>

            <p className="text-neutral-400 font-sans">
              {isForgotPasswordFlow ? (
                "Enter your new password below"
              ) : email ? (
                <>
                  for <b>{email}</b>
                </>
              ) : (
                "Set your new password below"
              )}
            </p>
          </div>

          {currentPageStatus === "PENDING" && (
            <form
              className="ph-no-capture font-sans space-y-2"
              noValidate
              onSubmit={(e) => {
                setSubmitted(true);
                handleSubmit(e);
              }}
            >
              <AuthField
                label="New Password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                error={submitted ? errors.password : undefined}
                value={values.password}
                onChange={handleChange}
              />

              <AuthField
                label="Confirm Password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                error={submitted ? errors.confirm_password : undefined}
                value={values.confirm_password}
                onChange={handleChange}
              />

              <button
                type="submit"
                className="w-full font-sans py-3 rounded-sm bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all"
                disabled={isPending}
                style={{ boxShadow: "rgba(249, 180, 24, 0.3) 0px 0px 20px" }}
              >
                {isPending ? "Please wait..." : "Submit"}
              </button>
            </form>
          )}

          {(currentPageStatus === "SUCCESS_RESET" || currentPageStatus === "SUCCESS_SET") && (
            <div className="flex flex-col items-center gap-4 w-[400px]">
              <p className="text-sm text-gray-500 text-center">
                Redirecting to login page...
              </p>
            </div>
          )}

          <div className="mt-8 text-center font-sans">
            <p className="text-xs text-neutral-700">
              © {new Date().getFullYear()} Photon Legal. All rights reserved.
            </p>
          </div>

     
        </div>
      </div>

      {/* <div className="flex flex-col text-center my-[56px]">
        <p className="font-bold text-[32px] tracking-tight">
          {currentPageStatus === "SUCCESS_RESET"
            ? "Password reset successfully!"
            : isForgotPasswordFlow
            ? "Reset Your Password"
            : "Set Your Password"}
        </p>
        <p className="font-normal text-xl text-[#0E0E0EBF]">
          {isForgotPasswordFlow ? (
            "Enter your new password below"
          ) : email ? (
            <>
              for <b>{email}</b>
            </>
          ) : (
            "Set your new password below"
          )}
        </p>
      </div> */}

    </div>
  );
};

export default ResetPassword;
