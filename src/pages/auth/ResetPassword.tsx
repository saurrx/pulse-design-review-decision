import React from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import API_CONFIG from "@/lib/apiConfig";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { iIHCLoginForm } from "./IHCLogin";
import Cookies from "js-cookie";
import { useMemo, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion"
import { TechBackground } from "../TechBackground";
import { BannerAnimation } from "../BannerAnimation";
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
    mutationFn: async (data: iIHCLoginForm) => {
      try {
        const response = await API_CONFIG.post("/api/v1/auth/ihc/login", data, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response?.data?.data) {
          const { user } = response.data.data;

          if (user) {
            Cookies.set("pl_user", JSON.stringify(user), { secure: true, sameSite: "lax", path: "/" });
            toast.success("User logged in successfully");
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
            toast.success("Password set successfully. Please login!");
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
            toast.success("Password reset successfully! Please login.");
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
            toast.success("Password set successfully, Please login!");
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
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isValid,
  } = useFormik({
    initialValues,
    validationSchema,
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
      {isLoadingLogin && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-photon-primary" />
            <p className="text-gray-600 font-medium">Signing in...</p>
          </div>
        </div>
      )}

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
            <form onSubmit={handleSubmit} className="ph-no-capture font-sans space-y-5">
              <div>
                <label
                  htmlFor="new-password"

                  className="font-sans items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-sm mb-2 block text-neutral-300"
                >New Password</label>

                <Input
                  name="password"
                  id="new-password"
                  autoComplete="off"
                  className="flex w-full min-w-0 h-11 rounded-md border px-3 py-1 text-sm bg-white/5 border-white/10 text-white placeholder:text-neutral-600 outline-none transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50  focus-visible:border-[#F9B418]"
                  placeholder="New Password..."

                  touched={touched}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.password}
                  errors={errors}
                  type="password"
                />
              </div>


              <div>
                <label
                  htmlFor="confirm-password"
                  data-slot="label"
                  className="font-sans items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-sm mb-2 block text-neutral-300"
                >Confirm Password</label>

                <Input
                  name="confirm_password"
                  className="flex w-full min-w-0 h-11 rounded-md border px-3 py-1 text-sm bg-white/5 border-white/10 text-white placeholder:text-neutral-600 outline-none transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50  focus-visible:border-[#F9B418]"
                  placeholder="Confirm Password..."
                  autoComplete="off"
                  touched={touched}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.confirm_password}
                  errors={errors}
                  type="password"
                  id="confirm-password"
                />
              </div>

              <button
                type="submit"
                className="w-full font-sans py-3 rounded-xl bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all"
                disabled={!isValid || isPending}
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

      <div className="hidden lg:flex w-1/2 items-center justify-center relative z-10 overflow-hidden">
        <TechBackground />
      </div>
    </div>
  );
};

export default ResetPassword;
