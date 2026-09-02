import API_CONFIG from "@/lib/apiConfig";
import { useGoogleLogin } from "@react-oauth/google";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { track } from "@/lib/analytics";
import Cookies from "js-cookie";
import { Loader2 } from "lucide-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import "@/style.css";
import { motion } from "framer-motion";
import { AuthField } from "./AuthField";

type loginDataType = {
  email: string
};

const validationSchema = Yup.object().shape({
  email: Yup.string().max(50, "Email must be max 50 characters").email("Enter a valid email address").required("Email is required"),
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

  // Someone followed an invite or share link and landed here. The code itself is
  // a credential and never travels; this is only "a link was opened", which is
  // the missing first step of invite_opened → invite_accepted / share_link_accepted.
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current || !code) return;
    openedRef.current = true;
    track("invite_opened");
  }, [code]);

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

  return (
    <div className="pulse-auth-shell relative flex h-screen items-center justify-center overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-photon-primary" />
            <p className="text-gray-600 font-medium">Signing in...</p>
          </div>
        </div>
      )}

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
              Invite
            </h1>
            <p className="text-neutral-400 font-sans">
              You have been invited to Pulse
            </p>
          </div>

          <form
            className="ph-no-capture space-y-2"
            noValidate
            onSubmit={(e) => {
              setSubmitted(true);
              handleSubmit(e);
            }}
          >
            {!isSent && (
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
            )}
            {isSent && (
              <div className="text-sm text-neutral-400 font-sans">Verification link has been sent to your email.</div>
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

    </div>
  );
};

export default Invite;
