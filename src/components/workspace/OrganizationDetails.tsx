import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import { Button } from "../ui/button";
import { Check, Edit, X } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  getClientInitials,
  getClientLogoSrc,
} from "@/lib/clientBranding";

type OrganizationDetailsProps = {
  clientDetails: any;
  clientId: string;
  refetchClientData: any;
  isEditMode?: boolean;
  setIsEditMode?: (value: boolean) => void;
  saveAboutRef?: React.MutableRefObject<(() => void) | null>;
  cancelAboutRef?: React.MutableRefObject<(() => void) | null>;
};

const OrganizationDetails: React.FC<OrganizationDetailsProps> = ({
  clientDetails,
  clientId,
  refetchClientData,
  isEditMode = false,
  setIsEditMode,
  saveAboutRef,
  cancelAboutRef,
}) => {
  
  const [isEditing, setIsEditing] = useState<string | null>("");
  const [formData, setFormData] = useState<any>({
    about: "",
  });
  const [aboutValue, setAboutValue] = useState(clientDetails?.about || "");
  const [originalAboutValue, setOriginalAboutValue] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aboutValueRef = useRef<string>(aboutValue);
  
  // Keep ref in sync with state
  useEffect(() => {
    aboutValueRef.current = aboutValue;
  }, [aboutValue]);

  const { mutate: personalInfoUpdate, isPending: isUpdating } = useMutation({
    mutationKey: ["update_client_personal_info", clientId],
    mutationFn: async (data: any) => {
      try {
        const response = await API_CONFIG.put(
          `/api/v1/clients/personal-info/${clientId}`,
          data
        );

        if (response?.status === 200) {
          handleCancel();
          refetchClientData();
        }

        return response?.data;
      } catch (error) {
        console.error("Error updating client personal info:", error);
        toast.error(
          error?.response?.data?.message ||
            "Error updating client personal info"
        );
      }
    },
  });

  const handleEdit = (field: string) => {
    setIsEditing(field);
  };

  const handleCancel = () => {
    setIsEditing(null);
  };

  const handleChange = (field: string, value: string) => {
    setFormData({
      ...clientDetails,
      [field]: value,
    });
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  const handleSave = (field: string, value: any) => {
    personalInfoUpdate({
      [field]: value,
    });
    toast.success("Changes saved successfully");
  };

  const handleSaveAbout = useCallback(() => {
    personalInfoUpdate({
      about: aboutValue,
    });

    if (setIsEditMode) {
      setIsEditMode(false);
    }
  }, [aboutValue, personalInfoUpdate, setIsEditMode]);

  const handleCancelAbout = useCallback(() => {
    // Reset About text back to the original value (from when edit mode was entered)
    // If originalAboutValue is not set, fallback to clientDetails?.about
    console.log('Cancel clicked - originalAboutValue:', originalAboutValue, 'clientDetails?.about:', clientDetails?.about);
    
    if (originalAboutValue !== null && originalAboutValue !== undefined) {
      console.log('Restoring from originalAboutValue:', originalAboutValue);
      setAboutValue(originalAboutValue);
    } else if (clientDetails?.about !== undefined) {
      console.log('Restoring from clientDetails.about:', clientDetails.about);
      setAboutValue(clientDetails.about);
    }
    
    // Clear the stored original value
    setOriginalAboutValue(null);
    
    if (setIsEditMode) {
      setIsEditMode(false);
    }
  }, [originalAboutValue, clientDetails?.about, setIsEditMode]);

  // Expose save and cancel functions via refs
  useEffect(() => {
    if (saveAboutRef) {
      saveAboutRef.current = handleSaveAbout;
    }
    if (cancelAboutRef) {
      cancelAboutRef.current = handleCancelAbout;
    }
  }, [saveAboutRef, cancelAboutRef, handleSaveAbout, handleCancelAbout]);

  // Store original about value when entering edit mode
  // Capture the current aboutValue only once when isEditMode becomes true
  useEffect(() => {
    if (isEditMode && originalAboutValue === null) {
      // Store the current aboutValue from ref (always up-to-date) as the original when entering edit mode
      const currentValue = aboutValueRef.current;
      setOriginalAboutValue(currentValue);
    } else if (!isEditMode && originalAboutValue !== null) {
      // Clear original value when exiting edit mode (but not on cancel - cancel handler does this)
      // Only clear if we're exiting edit mode via save or other means
      // Don't clear here - let cancel handler do it, or clear after a delay
    }
    // Only depend on isEditMode, not aboutValue, to avoid re-running when user types
  }, [isEditMode]);

  // Update aboutValue when clientDetails changes, but only when NOT in edit mode
  // This ensures we get the latest saved value, but don't overwrite user edits
  useEffect(() => {
    if (clientDetails?.about !== undefined && !isEditMode) {
      setAboutValue(clientDetails.about);
    }
  }, [clientDetails?.about, isEditMode]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current && isEditMode) {
      const textarea = textareaRef.current;
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        // Reset height to auto to get the correct scrollHeight
        const scrollTop = textarea.scrollTop;
        textarea.style.height = "auto";
        // Set height to scrollHeight to fit content
        textarea.style.height = `${textarea.scrollHeight}px`;
        textarea.scrollTop = scrollTop;
      });
    }
  }, [aboutValue, isEditMode]);

  const { theme } = useTheme();
  const clientName = clientDetails?.name || "Client workspace";
  const clientLogoSrc = getClientLogoSrc(
    {
      id: clientDetails?.id || clientId,
      name: clientName,
      logo_file: clientDetails?.logo_file,
    },
    String(API_CONFIG.defaults.baseURL || ""),
  );
  
  return (
    <div className={`border rounded-2xl p-6 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-[var(--pulse-surface)] border-[var(--pulse-line)] shadow-[0_18px_45px_-38px_rgba(17,16,60,0.45)]'}`}>
      <div className="mb-6">
        <div className="flex flex-col gap-4">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)]">
            {clientLogoSrc ? (
              <img
                src={clientLogoSrc}
                crossOrigin="use-credentials"
                alt={`${clientName} logo`}
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <span className="text-lg font-semibold text-[var(--pulse-ink)]">
                {getClientInitials(clientName)}
              </span>
            )}
          </div>

          <div>
            <p className={`font-sans text-center font-semibold ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
            {clientName}
            </p>
          </div>
        </div>
      </div>

      <div className={`mb-6 pb-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-neutral-200'}`}>
        <label
          data-slot="label"
          className={`font-sans items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-3 block ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}
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
            className="lucide lucide-mail w-4 h-4 inline mr-1.5"
            aria-hidden="true"
          >
            <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"></path>
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
          </svg>
          Allowed Mail Domain
        </label>

        <p className={`font-sans ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
          {clientDetails?.allowed_domain.split("@")[1]}
        </p>

          {/* <CardContent className="space-y-6 border-0 px-[8px] py-[8px]">
            {clientDetails?.plan !== "PRODUCT_OWNER" && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm text-gray-500 font-semibold">
                      Subscription
                    </h4>
                    <p className="text-sm font-medium text-photon-primary">
                      {clientDetails?.plan}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    Active
                  </Badge>
                </div>
              </div>
            )}
          </CardContent> */}
      </div>

      <div className="mb-6">
        <label
          data-slot="label"
          className={`font-sans items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-3 block ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}
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
            className="lucide lucide-users w-4 h-4 inline mr-1.5"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <path d="M16 3.128a4 4 0 0 1 0 7.744"></path>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
            <circle cx="9" cy="7" r="4"></circle>
          </svg>
          
          Administrator List
        </label>

        <div className="space-y-0">
          {(() => {
            // Show all users whose role includes admin (LEGAL_COUNSEL or PHOTON_ADMIN),
            // without hiding newly invited admins behind active/verified flags.
            const adminUsers =
              clientDetails?.User?.filter(
                (u: any) => u?.role === "LEGAL_COUNSEL" || u?.role === "PHOTON_ADMIN"
              ) || [];

            return adminUsers.map((u: any, uIndex: number) => (
              <div
                key={uIndex}
                className={`py-3 relative group ${
                  uIndex === adminUsers.length - 1
                    ? ""
                    : theme === 'dark' ? "border-b border-white/10" : "border-b border-neutral-200"
                }`}
              >
               
                    <p className={`font-sans text-sm truncate pr-8 cursor-default ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      {u?.email}
                    </p>
                 
    
                
                <button
                  onClick={() => handleCopyEmail(u?.email)}
                  className={`absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'dark' ? 'hover:bg-white/10 text-neutral-500 hover:text-[#F5A623]' : 'hover:bg-neutral-100 text-neutral-400 hover:text-[#F5A623]'}`}
                  title="Copy email"
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
                    className="lucide lucide-copy w-3.5 h-3.5"
                    aria-hidden="true"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                  </svg>
                </button>
              </div>
            ));
          })()}
        </div>
      </div>

      {(isEditMode || aboutValue.trim()) && (
      <div className={`pt-6 border-t font-sans ${theme === 'dark' ? 'border-white/10' : 'border-neutral-200'}`}>
        <label
          data-slot="label"
          className={`items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-3 block ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}
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
            className="lucide lucide-file-text w-4 h-4 inline mr-1.5"
            aria-hidden="true"
          >
            <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path>
            <path d="M14 2v5a1 1 0 0 0 1 1h5"></path>
            <path d="M10 9H8"></path>
            <path d="M16 13H8"></path>
            <path d="M16 17H8"></path>
          </svg>
          About
        </label>

        {isEditMode ? (
          <Textarea
            ref={textareaRef}
            data-slot="textarea"
            value={aboutValue}
            onChange={(e) => {
              setAboutValue(e.target.value);
              // Auto-resize on input
              const textarea = e.target;
              const scrollTop = textarea.scrollTop;
              textarea.style.height = "auto";
              textarea.style.height = `${textarea.scrollHeight}px`;
            }}
            className={`overflow-hidden flex w-full resize-none rounded-md border px-3 py-2 text-base placeholder:text-muted-foreground outline-none font-sans focus-visible:border-ring focus-visible:ring-offset-0 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 disabled:opacity-50 md:text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-neutral-100' : 'border-neutral-200 bg-white text-neutral-900'}`}
            onMouseDown={(e) => {
              // Prevent text position disturbance by ensuring height is correct before interaction
              const textarea = e.target as HTMLTextAreaElement;
              if (textarea.scrollHeight > textarea.clientHeight) {
                textarea.style.height = `${textarea.scrollHeight}px`;
              }
            }}
          />
        ) : (
          <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
            {aboutValue}
          </p>
        )}
      </div>
      )}
    </div>
  );
};
export default OrganizationDetails;
