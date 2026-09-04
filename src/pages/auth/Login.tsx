import API_CONFIG from "@/lib/apiConfig";
import { useGoogleLogin } from "@react-oauth/google";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { track } from "@/lib/analytics";
import Cookies from "js-cookie";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import "@/style.css";
import { motion } from "framer-motion";
import { AuthField } from "./AuthField";
import { SsoButton, SsoEmailStep } from "./SsoPanel";
import { PlatformPayloadInterface } from "./Signup";
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
  password: Yup.string().required("Password is required"),
});

export interface iLoginForm {
  email: string;
  password: string;
}

const formInitialValues: iLoginForm = {
  email: "",
  password: "",
};

const Login = () => {
  const loaction = useLocation();
  const { state } = loaction;
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [screenHeight, setScreenHeight] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

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
    mutationKey: ["social_login"],
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

  // The API's Microsoft callback redirects back here with ?error= when the
  // state handshake fails or the token exchange does. It never says which —
  // deliberately, so a reason cannot be screenshotted into a ticket — but the
  // user still deserves to be told something happened. This screen used to
  // ignore the parameter entirely and show a silent, ordinary login form.
  useEffect(() => {
    // Two spellings, because two things redirect here on failure: the API's
    // Microsoft callback uses ?error=, and the SAML failure redirect — whose
    // default lives in the backend's saml.config.ts — uses ?sso_error=1. A
    // parameter this screen does not read is a user returned to a silent,
    // ordinary login form with no idea what happened.
    const err = searchParams.get("error") ?? (searchParams.get("sso_error") ? "sso" : null);
    if (!err) return;
    toast.error(
      err === "oauth_state"
        ? "That sign-in link expired. Please try again."
        : err === "sso"
          ? "SSO sign-in could not be completed. Please try again."
          : "Microsoft sign-in could not be completed. Please try again.",
    );
    const next = new URLSearchParams(searchParams);
    next.delete("error");
    next.delete("sso_error");
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

  // Errors are a response to submitting, not to typing. Formik's defaults
  // (validateOnChange + validateOnBlur) meant tabbing out of an empty field
  // scolded the user before they had asked for anything. Validation is off
  // until the first submit and live afterwards, so a message that has appeared
  // clears as soon as the value is fixed.
  const [ssoStep, setSsoStep] = useState<"idle" | "email">("idle");
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
      // The ATTEMPT, not the credentials — `method` is an enum and nothing else
      // from this form is ever sent. Paired with the server's login_succeeded /
      // login_failed, this is what turns "logins are down" into "which method".
      track("login_attempted", { method: "password" });
      loginMutate(values);
    },
  });

  // Login mutation for email/password
  const { mutate: loginMutate, isPending: isLoadingLogin } = useMutation({
    mutationKey: ["email_login"],
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
            navigate("/", { replace: true });
          }
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Error logging in");
      }
    },
  });

  /**
   * Hand off to the API's own Microsoft route. A full-page navigation, not an
   * XHR — the server issues the redirect, holds the `state` in an HttpOnly
   * cookie and exchanges the code with the client secret, which a browser
   * cannot do and should not try to.
   *
   * This page used to run its own authorize flow against the **`/common`**
   * tenant and POST the returned code to `social-login`, which sent it to the
   * GOOGLE verifier. `/common` is also the unpinned posture the server refuses
   * outright: it would accept an assertion from any Microsoft directory, not
   * just ours. The path below goes through the app origin so the session
   * cookie the callback sets is first-party.
   */
  const microsoftLogin = () => {
    track("login_attempted", { method: "microsoft" });
    window.location.href = "/v1/auth/microsoft";
  };

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
              Sign in
            </h1>
            <p className="text-neutral-400 font-sans">Welcome back to Pulse</p>
          </div>

          {ssoStep === "email" ? (
            <SsoEmailStep onCancel={() => setSsoStep("idle")} />
          ) : (
            <>
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
                track("login_attempted", { method: "google" });
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

          <SsoButton onStart={() => setSsoStep("email")} disabled={isLoading || isPending} />

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
                    // trim() only strips the ends; a space TYPED mid-way
                    // stayed. No email contains whitespace — drop it all.
                    value: e.target.value?.replace(/\s+/g, "").toLowerCase(),
                  },
                })
              }
            />

            <AuthField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={submitted ? errors.password : undefined}
              value={values.password}
              onChange={handleChange}
            />

            <div className="flex justify-end font-sans pb-3">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-sm text-[#F9B418] hover:text-[#F9B418]/80 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            {/* Not gated on `isValid`: the button used to disable itself the
                moment a field was invalid, which — now that errors wait for a
                submit — would mean the user could never trigger the validation
                they are waiting to see. */}
            <button
              type="submit"
              disabled={isLoadingLogin}
              className="w-full py-3 rounded-xl bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans"
              style={{ boxShadow: "rgba(249, 180, 24, 0.3) 0px 0px 20px" }}
            >
              {isLoadingLogin ? "Please wait..." : "Sign In"}
            </button>
          </form>
            </>
          )}

          <div className="mt-5 text-center">
            <p className="text-sm text-neutral-500 font-sans">
              Don't have an account?{" "}
              <button
                onClick={() => navigate("/signup")}
                className="text-[#F9B418] hover:text-[#F9B418]/80 transition-colors font-medium"
              >
                Sign Up
              </button>
            </p>
          </div>
          <div className={`text-center ${screenHeight < 720 ? "mt-2" : "mt-8"}`}>
            <p className="text-xs text-neutral-700 font-sans">
              © {new Date().getFullYear()} Photon Legal. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
