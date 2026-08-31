import API_CONFIG from "@/lib/apiConfig";
import { useGoogleLogin } from "@react-oauth/google";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { toast } from "@/lib/toast";
import { track } from "@/lib/analytics";
import Cookies from "js-cookie";
import { Loader2 } from "lucide-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import "@/style.css";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { TechBackground } from "../TechBackground";
import { BannerAnimation } from "../BannerAnimation";
import { PlatformPayloadInterface } from "./Signup";

type loginDataType = {
  email: string;
  name?: string;
};

const validationSchema = Yup.object().shape({
  email: Yup.string()
    .max(50, "Email must be max 50 characters")
    .email()
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
  const processedCodeRef = useRef<string | null>(null);

  const code = searchParams.get("code");

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

      toast.success("User registered/login successfully");
      navigate("/", { replace: true });
    }
  }, [isSuccess, data]);

  useEffect(() => {
    if (code && code !== processedCodeRef.current) {
      // Validate OAuth state parameter to prevent CSRF
      const returnedState = searchParams.get("state");
      const savedState = sessionStorage.getItem("ms_oauth_state");
      sessionStorage.removeItem("ms_oauth_state");

      if (!returnedState || returnedState !== savedState) {
        toast.error("OAuth state mismatch. Please try logging in again.");
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete("code");
        newSearchParams.delete("state");
        setSearchParams(newSearchParams, { replace: true });
        return;
      }

      processedCodeRef.current = code;
      const payload: PlatformPayloadInterface = {
        code: code,
        platform_type: "microsoft",
      };

      // Remove code and state from URL to prevent re-processing
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("code");
      newSearchParams.delete("state");
      setSearchParams(newSearchParams, { replace: true });

      mutate(payload);
    }
  }, [code, mutate, searchParams, setSearchParams]);

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

  // Formik for email/password form
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
            toast.success("User logged in successfully");
            navigate("/", { replace: true });
          }
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Error logging in");
      }
    },
  });

  const microsoftLogin = () => {
    track("login_attempted", { method: "microsoft" });
    const oauthState = crypto.randomUUID();
    sessionStorage.setItem("ms_oauth_state", oauthState);
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_MS_CLIENT_ID,
      response_type: "code",
      redirect_uri: `${window.location.origin}/login`,
      response_mode: "query",
      scope: "openid profile email User.Read",
      state: oauthState,
    });

    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  };

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
      {isLoading && (
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

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:pl-6 relative z-10">
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
        <div
          className="absolute -top-20 -left-20 w-[100%] h-1 bg-[#e6bd06] -rotate-45
         animate-[moveDown_10s_linear_infinite]"
        />

        <div className="w-full max-w-md">
          <div className="mb-5">
            <img
              src="  /assets/photon-legal.png"
              alt="Photon Legal"
              className="h-10"
            />
          </div>

          <div className="mb-6">
            <h1 className="text-3xl mb-2 font-display font-semibold text-white">
              Sign in
            </h1>
            <p className="text-neutral-400 font-sans">
              Welcome back to Photon Legal
            </p>
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
                track("login_attempted", { method: "google" });
                handleLogin();
              }}
              disabled={isLoading || isPending}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 mb-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19.8055 10.2292C19.8055 9.55207 19.7493 8.86821 19.6299 8.19775H10.2002V12.0492H15.6014C15.3773 13.2911 14.6571 14.3898 13.6025 15.0879V17.5866H16.8251C18.7173 15.8449 19.8055 13.2728 19.8055 10.2292Z"
                  fill="#4285F4"
                ></path>
                <path
                  d="M10.2002 20.0006C12.9517 20.0006 15.2726 19.1151 16.8288 17.5865L13.6062 15.0878C12.7092 15.6979 11.5492 16.0431 10.2038 16.0431C7.54164 16.0431 5.28676 14.2828 4.48943 11.9165H1.16309V14.4923C2.75191 17.8695 6.27072 20.0006 10.2002 20.0006Z"
                  fill="#34A853"
                ></path>
                <path
                  d="M4.48584 11.9163C4.06482 10.6744 4.06482 9.32958 4.48584 8.08765V5.51184H1.16307C-0.390024 8.73056 -0.390024 12.2734 1.16307 15.492L4.48584 11.9163Z"
                  fill="#FBBC04"
                ></path>
                <path
                  d="M10.2002 3.95805C11.6222 3.936 13.0005 4.47247 14.036 5.45722L16.8929 2.60096C15.1858 0.990301 12.9334 0.0839084 10.2002 0.109031C6.27072 0.109031 2.75191 2.24007 1.16309 5.61841L4.48585 8.19422C5.2796 5.82116 7.53806 3.95805 10.2002 3.95805Z"
                  fill="#EA4335"
                ></path>
              </svg>
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
              <svg
                width="20"
                height="20"
                viewBox="0 0 23 23"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
                <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
                <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
              </svg>

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

          <form className="ph-no-capture space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                data-slot="label"
                className="items-center gap-2 font-sans font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-sm mb-2 block text-neutral-300"
                htmlFor="email"
              >
                Email
              </label>
              <Input
                data-slot="input"
                type="email"
                name="email"
                maxLength={50}
                className="font-sans email-input file:text-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 rounded-md border px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:ring-[0.5px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-11 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-[#F9B418] focus-visible:ring-offset-0 focus-visible:border-[#F9B418]"
                id="email"
                autoComplete="off"
                placeholder="you@photonlegal.com"
                value={values.email?.trim()?.toLowerCase()}
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
                onBlur={(e) =>
                  handleBlur({
                    target: {
                      name: "email",
                      value: e.target.value?.trim()?.toLowerCase(),
                    },
                  })
                }
                required
              />
              {touched.email && errors.email && (
                <p className="text-red-400 fixed text-xs mt-1 font-sans">
                  {errors.email}
                </p>
              )}
            </div>
            <div>
              <label
                data-slot="label"
                className="font-sans items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-sm mb-2 block text-neutral-300"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <Input
                  type="password"
                  name="password"
                  data-slot="input"
                  autoComplete="off"
                  className=" file:text-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 rounded-md border px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:ring-[0.5px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-11 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-[#F9B418] focus-visible:ring-offset-0 focus-visible:border-[#F9B418] pr-10 font-sans"
                  id="password"
                  placeholder="••••••••"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                />
              </div>
              {touched.password && errors.password && (
                <p className="text-red-400 text-xs fixed mt-1 font-sans">
                  {errors.password}
                </p>
              )}
            </div>
            <div className="flex justify-end font-sans">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-sm text-[#F9B418] hover:text-[#F9B418]/80 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={!isValid || isLoadingLogin}
              className="w-full py-3 rounded-xl bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans"
              style={{ boxShadow: "rgba(249, 180, 24, 0.3) 0px 0px 20px" }}
            >
              {isLoadingLogin ? "Please wait..." : "Sign In"}
            </button>
          </form>

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
          <div
            className={`text-center ${screenHeight < 720 ? "mt-2" : "mt-8"}`}
          >
            <p className="text-xs text-neutral-700 font-sans">
              © {new Date().getFullYear()} Photon Legal. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 items-center justify-center relative z-10 overflow-hidden">
        <TechBackground />
      </div>
    </div>
  );
};

export default Login;
