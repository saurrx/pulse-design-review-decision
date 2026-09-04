import API_CONFIG from "@/lib/apiConfig";
import { useGoogleLogin } from "@react-oauth/google";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { track } from "@/lib/analytics";
import Cookies from "js-cookie";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import "@/style.css";
import { motion } from "framer-motion";
import { AuthField } from "./AuthField";
import AuthLoadingOverlay from "@/components/auth/AuthLoadingOverlay";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/BrandIcons";

type loginDataType = {
  email: string;
  name?: string;
};

const validationSchema = Yup.object().shape({
  email: Yup.string()
    .max(50, "Email must be max 50 characters")
    .email("Enter a valid email address")
    .required("Email is required"),
});

export interface iLoginForm {
  email: string;
  source: string;
}

export interface PlatformPayloadInterface {
  code: string;
  platform_type: string;
}

const formInitialValues: iLoginForm = {
  email: "",
  source: "email-signup",
};

const Signup = () => {
  const loaction = useLocation();
  // The screen was reached. Fired once per mount (the ref survives the strict-mode
  // double-invoke), so signup_started → signup_submitted → signup_succeeded reads
  // as three real steps rather than a render count.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track("signup_started");
  }, []);
  const { state } = loaction;
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [screenHeight, setScreenHeight] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");

  useLayoutEffect(() => {
    const updateHeight = () => {
      setScreenHeight(window?.innerHeight || 0);
    };

    // Set initial height
    updateHeight();

    // Add resize event listener
    window.addEventListener("resize", updateHeight);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  const { data, mutate, isSuccess, isPending } = useMutation({
    mutationKey: ["social-login"],
    mutationFn: async (data: PlatformPayloadInterface) => {
      try {
        const response = await API_CONFIG.post(
          "/api/v1/auth/social-login",
          data,
        );

        if (response?.data?.data) {
          Cookies.set("pl_user", JSON.stringify(response?.data?.data?.user), { secure: true, sameSite: "lax", path: "/" });

          navigate("/", { replace: true });
        }

        toast.error(response?.data?.message || "Logged in successfully!");

        return response.data;
      } catch (error) {
        toast.error(error?.response?.data?.message || "Error registering user");
      }
    },
  });

  useEffect(() => {
    if (isSuccess && data) {
      const { user } = data.data;

      if (user) {
        Cookies.set("pl_user", JSON.stringify(user), { secure: true, sameSite: "lax", path: "/" });
      }

      navigate("/", { replace: true });
    }
  }, [isSuccess, data]);

  // The API's Microsoft callback reports failure as ?error= and never says
  // which failure, deliberately. Say something rather than nothing.
  useEffect(() => {
    const err = searchParams.get("error");
    if (!err) return;
    toast.error(
      err === "oauth_state"
        ? "That sign-in link expired. Please try again."
        : "Microsoft sign-in could not be completed. Please try again.",
    );
    const next = new URLSearchParams(searchParams);
    next.delete("error");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);


  const handleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        const userInfo = await fetchUserInfo(tokenResponse);

        if (userInfo) {
          const payload: PlatformPayloadInterface = {
            code: tokenResponse?.access_token,
            platform_type: "google",
          };
          mutate(payload);
        }
      } catch (error) {
        toast.error("Error during sign in");
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      setIsLoading(false);
      toast.error("Error during sign in");
    },
  });

  /** Same server-side flow as Login — see the note there. */
  const microsoftLogin = () => {
    track("signup_submitted");
    window.location.href = "/v1/auth/microsoft";
  };

  const fetchUserInfo = async (tokenResponse) => {
    try {
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        },
      );

      const userInfo = await response.json();

      return userInfo;
    } catch (error) {
      throw error;
    }
  };

  // Formik for email form
  // Errors answer a submit, not a keystroke — see AuthField for why.
  const [submitted, setSubmitted] = useState(false);

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
    onSubmit: (values: iLoginForm) => {
      // The submit, not the form. The gap between this and the server's
      // signup_succeeded / signup_rejected_domain is the domain allow-list
      // turning people away — invisible from either end alone.
      track("signup_submitted");
      loginMutate(values);
    },
  });

  // Signup mutation for email
  const { mutate: loginMutate, isPending: isLoadingLogin } = useMutation({
    mutationKey: ["email_signup"],
    mutationFn: async (data: iLoginForm) => {
      try {
        const response = await API_CONFIG.post(
          "/api/v1/auth/email-signup",
          data,
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (response?.data?.data) {
          //   if (access_token && user) {
          // set cookies
          // Cookies.set("pl_access_token", access_token);
          // Cookies.set("pl_user", JSON.stringify(user), { secure: true, sameSite: "lax", path: "/" });
          // navigate("/", { replace: true });
          //   }

        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Error logging in");
      }
    },
  });

  return (
    <div className="pulse-auth-shell relative flex h-screen items-center justify-center overflow-hidden">
      <AuthLoadingOverlay show={isLoading} />

      <div className="pulse-auth-panel w-full flex items-center justify-center p-6 relative z-10">
        <div className="pulse-auth-card">
          <div className="mb-5">
            <img
              src="/assets/photon-legal.png"
              alt="Photon Legal"
              className="h-10"
            />
          </div>

          <div className="mb-6">
            <h1 className="text-3xl mb-2 font-display font-semibold text-white">
              Sign up
            </h1>
            <p className="text-neutral-400 font-sans">Welcome to Pulse</p>
          </div>

          <div className="flex items-center gap-5">
            <motion.button
              initial={
                state?.fromForgotPage ? { scaleY: 0, display: "none" } : false
              }
              animate={
                state?.fromForgotPage ? { scaleY: 1, display: "flex" } : false
              }
              transition={{
                ease: "easeInOut",
                duration: 0.1,
                delay: 0.06,
              }}
              style={{ transformOrigin: "center" }}
              onClick={() => {
                track("signup_submitted");
                handleLogin();
              }}
              disabled={isLoading || isPending}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 mb-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GoogleIcon />
              <span className="text-white font-sans">Google</span>
            </motion.button>

            <motion.button
              initial={
                state?.fromForgotPage ? { scaleY: 0, display: "none" } : false
              }
              animate={
                state?.fromForgotPage ? { scaleY: 1, display: "flex" } : false
              }
              transition={{
                ease: "easeInOut",
                duration: 0.1,
                delay: 0.06,
              }}
              style={{ transformOrigin: "center" }}
              onClick={() => microsoftLogin()}
              disabled={isLoading || isPending}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 mb-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MicrosoftIcon />

              <span className="text-white font-sans">Microsoft</span>
            </motion.button>
          </div>
          <div className="relative mb-6 flex items-center">
            <div className="flex-1 h-px bg-neutral-900" />

            <span className="px-4 text-sm text-neutral-500 font-sans whitespace-nowrap">
              Or continue with email
            </span>
            <div className="flex-1 h-px bg-neutral-900" />
          </div>

          <form
            className="ph-no-capture space-y-2"
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
            {/* Not gated on `isValid` — errors now wait for a submit, so a
                disabled button would mean they could never appear. */}
            <button
              type="submit"
              disabled={isLoadingLogin}
              className="w-full py-3 rounded-xl bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans"
              style={{ boxShadow: "rgba(249, 180, 24, 0.3) 0px 0px 20px" }}
            >
              {isLoadingLogin ? "Please wait..." : "Sign up"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-neutral-500 font-sans">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-[#F9B418] hover:text-[#F9B418]/80 transition-colors font-medium"
              >
                Login
              </button>
            </p>
          </div>
          <div
            className={`text-center ${screenHeight < 720 ? "mt-2" : "mt-8"}`}
          >
            <p className="text-xs text-neutral-700 font-sans">
              © {new Date().getFullYear()} Photon Legal. All rights reserved.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Signup;
