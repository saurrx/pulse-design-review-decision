import API_CONFIG from "@/lib/apiConfig";
import { useGoogleLogin } from "@react-oauth/google";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { Loader2 } from "lucide-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import "@/style.css";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { TechBackground } from "../TechBackground";
import { BannerAnimation } from "../BannerAnimation";

type loginDataType = {
  email: string
};

const validationSchema = Yup.object().shape({
  email: Yup.string().max(50, "Email must be max 50 characters").email().required("Email is required"),
});

export interface iLoginForm {
  email: string;
}

const formInitialValues: iLoginForm = {
  email: "",
};

const Invite = () => {
  const loaction = useLocation();
  const { state } = loaction;
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { inviteCode } = useParams();

  const code = searchParams.get("code") || inviteCode;
  const domain = searchParams.get("domain");

  // Formik for email form
  const {
    values,
    handleBlur,
    handleChange,
    handleSubmit,
    touched,
    errors,
  } = useFormik({
    initialValues: formInitialValues,
    validationSchema,
    onSubmit: (values: iLoginForm) => {
      sendInvitationMutate(values.email);
    },
  });

  // Send invitation mutation for email
  const { mutate: sendInvitationMutate, isPending: isLoadingSendInvitation } = useMutation({
    mutationKey: ["send_invitation"],
    mutationFn: async (email: string) => {
      try {
        const response = await API_CONFIG.post(`/api/v1/auth/ihc/verify?code=${code}&domain=${domain}`, { email }, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response?.data?.data) {
          setIsSent(true);
          toast.success("Invitation sent to your email");
        }
      } catch (error) {
        console.error("Error sending invitation:", error);
        toast.error(error?.response?.data?.message || "Error sending invitation");
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
              Invite
            </h1>
            <p className="text-neutral-400 font-sans">
              Welcome back to Photon Legal
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isSent && <div>
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
                placeholder="you@photonlegal.com"
                value={values.email?.trim()?.toLowerCase()}
                onChange={(e) => handleChange({target: {name: "email", value: e.target.value?.trim()?.toLowerCase()}})}
                onBlur={(e) => handleBlur({target: {name: "email", value: e.target.value?.trim()?.toLowerCase()}})}
                required
              />
              {touched.email && errors.email && (
                <p className="text-red-400 fixed text-xs mt-1 font-sans">
                  {errors.email}
                </p>
              )}
            </div>}
            {isSent && (
              <div className="text-sm text-neutral-400 font-sans">Verfication link has been sent to your email.</div>
            )}
            {!isSent ? <button
              type="submit"
              disabled={isLoadingSendInvitation}
              className="w-full py-3 rounded-xl bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans"
              style={{ boxShadow: "rgba(249, 180, 24, 0.3) 0px 0px 20px" }}
            >
              {isLoadingSendInvitation ? "Inviting..." : "Next"}
            </button>: <button
              type="button"
              onClick={() => navigate("/login")}
              disabled={isLoadingSendInvitation}
              className="w-full py-3 rounded-xl bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans"
              style={{ boxShadow: "rgba(249, 180, 24, 0.3) 0px 0px 20px" }}
            >
              Back to Login
            </button>}
          </form>
          <div className="mt-8 text-center">
            <p className="text-xs text-neutral-700 font-sans">
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

export default Invite;
