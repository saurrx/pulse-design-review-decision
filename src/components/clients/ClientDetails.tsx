import React, {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Edit,
  Check,
  X,
  Minus,
  Plus,
  Mail,
  Users,
  FileText,
  UserX,
  Upload,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useParams } from "react-router-dom";
import _, { template } from "lodash";
import API_CONFIG from "@/lib/apiConfig";
import { getClientLogoSrc } from "@/lib/clientBranding";
import { useFileUpload } from "@/lib/api-service/commonApi.service";
import { useMutation } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";

type ClientDetailsProps = {
  clientData: any;
  clientId: string;
  refetchClientData: any;
  isEditMode?: boolean;
  onSaveComplete?: () => void;
  onCancel?: () => void;
};

export type ClientDetailsRef = {
  saveChanges: () => Promise<void>;
};

const ClientDetails = forwardRef<ClientDetailsRef, ClientDetailsProps>(
  (
    {
      clientData,
      clientId,
      refetchClientData,
      isEditMode = false,
      onSaveComplete,
      onCancel,
    },
    ref
  ) => {
    const { theme } = useTheme();
    const [tempLogoFile, setTempLogoFile] = useState<any>(null);
    const [validationErrors, setValidationErrors] = useState<any>({});
    const [formData, setFormData] = useState<any>({
      name: "",
      allowed_domain: "",
      about: "",
      status: "",
      admin_users: [],
      logo: null,
    });
    const [newAdminEmail, setNewAdminEmail] = useState("");

    // Initialize form data when clientData changes or edit mode is enabled
    useEffect(() => {
      if (clientData && isEditMode) {
        setFormData({
          name: clientData?.name || "",
          allowed_domain: clientData?.allowed_domain || "",
          about: clientData?.about || "",
          admin_users:
            clientData?.User?.filter((u: any) => u?.role === "LEGAL_COUNSEL")?.map(
              (u: any) => u?.email
            ) || [],
          logo: null,
        });
        setTempLogoFile(null);
        setNewAdminEmail("");
        setValidationErrors({});
      }
    }, [clientData, isEditMode]);

    const {
      isPending: isFileUploading,
      data: fileUploadData,
      isSuccess: logoUploadSucess,
      mutate: fileUploadMutate,
    } = useFileUpload();

    const { mutate: personalInfoUpdate, isPending: isUpdating } = useMutation({
      mutationKey: ["update_client_personal_info", clientId],
      mutationFn: async (data: any) => {
        try {
          const response = await API_CONFIG.put(
            `/api/v1/clients/personal-info/${clientId}`,
            data
          );

          if (response?.status === 200) {
            return response?.data;
          }
        } catch (error) {
          console.error("Error updating client personal info:", error);
          throw error;
        }
      },
    });

    // Expose saveChanges method via ref
    useImperativeHandle(ref, () => ({
      saveChanges: async () => {
        // Validate all fields
        const errors: any = {};

        // Validate name
        if (!formData.name?.trim()) {
          errors.name = "Client name is required";
        }

        // Validate allowed domain
        const domainError = validateAllowedDomain(formData.allowed_domain);
        if (domainError) {
          errors.allowed_domain = domainError;
        }

        // Validate admin users
        if (formData.admin_users.length === 0) {
          errors.admin_users = ["At least one admin user is required"];
        } else {
          const emailErrors = formData.admin_users
            .map((email: string) => validateAdminEmail(email))
            .filter(Boolean);
          if (emailErrors.length > 0) {
            errors.admin_users = emailErrors;
          }
        }

        if (Object.keys(errors).length > 0) {
          setValidationErrors(errors);
          toast.error("Please fix validation errors before saving");
          return;
        }

        try {
          // Prepare update data
          const updateData: any = {
            name: formData.name,
            allowed_domain: formData.allowed_domain,
            about: formData.about,
            admin_users: formData.admin_users,
          };

          // If logo was changed, include it
          if (tempLogoFile?.id) {
            updateData.logo = tempLogoFile.id;
          }

          // Save all changes together
          await new Promise<void>((resolve, reject) => {
            personalInfoUpdate(updateData, {
              onSuccess: () => {
                refetchClientData();
                resolve();
              },
              onError: (error: any) => {
                toast.error(
                  error?.response?.data?.message ||
                    "Error updating client personal info"
                );
                reject(error);
              },
            });
          });

          if (onSaveComplete) {
            onSaveComplete();
          }
        } catch (error) {
          // Error already handled in mutation
        }
      },
    }));

    useEffect(() => {
      if (fileUploadData?.data?.length > 0) {
        setTempLogoFile(fileUploadData?.data?.[0]);
      }
    }, [fileUploadData]);

    const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success("Email copied to clipboard");
    };

    const handleCancel = () => {
      if (onCancel) {
        onCancel();
      }
      // Reset form data
      if (clientData) {
        setFormData({
          name: clientData?.name || "",
          allowed_domain: clientData?.allowed_domain || "",
          about: clientData?.about || "",
          admin_users:
            clientData?.User?.filter((u: any) => u?.role === "LEGAL_COUNSEL")?.map(
              (u: any) => u?.email
            ) || [],
          logo: null,
        });
      }
      setTempLogoFile(null);
      setNewAdminEmail("");
      setValidationErrors({});
    };

    const handleAddAdmin = () => {
      if (!newAdminEmail.trim()) {
        toast.error("Please enter an email address")
      }

      const emailError = validateAdminEmail(newAdminEmail);
      if (emailError) {
        toast.error(emailError);
        return;
      }

      if (formData.admin_users.includes(newAdminEmail)) {
        toast.error("This email is already in the list")
      }

      setFormData((prev) => ({
        ...prev,
        admin_users: [...prev.admin_users, newAdminEmail],
      }));
      setNewAdminEmail("");
    };

    const handleRemoveAdmin = (email: string) => {
      if (formData.admin_users.length <= 1) {
        toast.error("At least one admin user is required");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        admin_users: prev.admin_users.filter((e: string) => e !== email),
      }));
    };

    const validateAllowedDomain = (domain: string) => {
      // Accept what people actually paste: "@6sense.com", "6sense.com", or a
    // full address like "x@6sense.com" — the save path extracts the domain
    // either way, so refusing an email here only blocked a valid intent.
    const domainRegex = /^(?:[^@\s]*@)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;
      if (!domain.trim()) {
        return "Allowed domain is required";
      }
      if (!domainRegex.test(domain)) {
        return "Enter a domain like @example.com (a full email works too — we keep the domain).";
      }
      return null;
    };

    const validateAdminEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim()) {
        return "Email is required";
      }
      if (!emailRegex.test(email)) {
        return "Please enter a valid email address";
      }
      return null;
    };

    const handleChange = (field: string, value: string) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear validation error when user starts typing
      if (validationErrors[field]) {
        setValidationErrors((prev) => ({
          ...prev,
          [field]: null,
        }));
      }
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        fileUploadMutate({ file: e.target.files[0], category: "image" });
      }
    };

    const resolvedClientLogo = tempLogoFile
      ? `${String((API_CONFIG.defaults as { baseURL?: string }).baseURL || "").replace(/\/$/, "")}/${String(tempLogoFile?.file_path || "").replace(/^\//, "")}`
      : getClientLogoSrc(
          clientData,
          String((API_CONFIG.defaults as { baseURL?: string }).baseURL || ""),
        );

    return (
      <>
        <div
          className={`border rounded-md p-6 backdrop-blur-xl mt-2 ${
            theme === "dark"
              ? "bg-neutral-900 border-[#cccccc20]"
              : "bg-white/80 border-neutral-200"
          }`}
        >
          {/* Logo and Name Section */}
          <div className="mb-6">
            <div className="flex flex-col gap-4">
              <div className="relative flex items-center justify-center w-20 h-20 border mx-auto bg-white border-neutral-200">
                <div className="inline-block bg-gray-100 text-center align-middle w-full h-full object-contain p-2">
                  <div className="flex items-center justify-center w-full h-full relative">
                    <img
                      src={
                        resolvedClientLogo
                          ? resolvedClientLogo
                          : clientData?.logo
                          ? getClientLogoSrc(
                              clientData,
                              String(
                                (API_CONFIG.defaults as { baseURL?: string })
                                  .baseURL || "",
                              ),
                            ) ?? undefined
                          : "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg=="
                      }
                      alt={clientData?.name || "company_logo"}
                      crossOrigin="use-credentials"
                      className="w-full h-full object-contain"
                    />
                    {isEditMode && (
                      <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                        <Upload className="w-5 h-5 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoChange}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div>
                {isEditMode ? (
                  <Input
                    name="name"
                    value={formData?.name || ""}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className={`h-10 bg-transparent ${
                      validationErrors.name
                        ? "border-red-500"
                        : theme === "dark"
                        ? "border-[#cccccc20] text-zinc-200"
                        : "border-neutral-200 text-neutral-900"
                    }`}
                  />
                ) : (
                  <div className="relative group w-full text-center">
                    <p
                      className={`text-center font-semibold ${
                        theme === "dark" ? "text-zinc-200" : "text-neutral-900"
                      }`}
                    >
                      {_?.capitalize(clientData?.name) || "--"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Allowed Email Domain Section */}
          <div
            className={`mb-6 pb-6 border-b ${
              theme === "dark" ? "border-[#cccccc20]" : "border-neutral-200"
            }`}
          >
            <label
              className={` ${
                theme === "dark" ? "text-zinc-400" : "text-neutral-600"
              } items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-3 block`}
            >
              <Mail className="w-4 h-4 inline mr-1.5" />
              Allowed Email Domain
            </label>
            {isEditMode ? (
              <Input
                name="allowed_domain"
                value={formData?.allowed_domain || ""}
                onChange={(e) => handleChange("allowed_domain", e.target.value)}
                className={`h-10 bg-transparent ${
                  validationErrors.allowed_domain
                    ? "border-red-500"
                    : theme === "dark"
                    ? "border-[#cccccc20] text-zinc-200"
                    : "border-neutral-200 text-neutral-900"
                }`}
                placeholder="example.com"
              />
            ) : (
              <p
                className={`font-sans ${
                  theme === "dark" ? "text-zinc-200" : "text-neutral-800"
                }`}
              >
                {clientData?.allowed_domain || "--"}
              </p>
            )}
            {validationErrors.allowed_domain && (
              <p className="text-sm text-red-500 mt-1">
                {validationErrors.allowed_domain}
              </p>
            )}
          </div>

          {/* Administrator List Section */}
          <div className="mb-6">
            <label
              className={`${
                theme === "dark" ? "text-zinc-400" : "text-neutral-600"
              } items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-3 block`}
            >
              <Users className="w-4 h-4 inline mr-1.5" />
              Administrator List
            </label>
            <div className="space-y-0">
              {(isEditMode
                ? formData?.admin_users
                : clientData?.User?.filter((u: any) => u?.role === "LEGAL_COUNSEL")
              )?.map((item: any, userIndex: number, array: any[]) => {
                const email = isEditMode ? item : item?.email;
                const total = clientData?.User?.filter(
                  (u: any) => u?.role === "LEGAL_COUNSEL"
                );
                return (
                  <div
                    key={userIndex}
                    className={`flex items-center justify-between py-3 ${
                      userIndex < array.length - 1
                        ? `border-b ${
                            theme === "dark"
                              ? "border-[#cccccc20]"
                              : "border-neutral-200"
                          }`
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm truncate font-sans ${
                          theme === "dark"
                            ? "text-zinc-200"
                            : "text-neutral-800"
                        }`}
                      >
                        {email}
                      </p>
                    </div>
                    {isEditMode && (
                      <button
                        onClick={() => handleRemoveAdmin(email)}
                        className="p-2 rounded-sm transition-colors ml-2 flex-shrink-0 text-neutral-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {((!isEditMode &&
                (!clientData?.User ||
                  clientData?.User?.filter((u: any) => u?.role === "LEGAL_COUNSEL")
                    ?.length === 0)) ||
                (isEditMode &&
                  (!formData?.admin_users ||
                    formData?.admin_users?.length === 0))) && (
                <div className="py-3">
                  <p className="text-sm text-neutral-500">
                    No administrators found
                  </p>
                </div>
              )}
            </div>
            {isEditMode && (
              <div className="flex gap-2 mt-3">
                <Input
                  name="newAdminEmail"
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value?.trim()?.toLowerCase())}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddAdmin();
                    }
                  }}
                  className={`h-10 bg-transparent ${
                    theme === "dark"
                      ? "border-[#cccccc20] text-zinc-200"
                      : "border-neutral-200 text-neutral-900"
                  }`}
                  placeholder="admin@example.com"
                />
                <button
                  onClick={handleAddAdmin}
                  className={`px-4 py-2 border rounded-sm text-sm ${
                    theme === "dark"
                      ? "border-[#cccccc20] text-zinc-300"
                      : "border-neutral-200 text-neutral-600"
                  } transition-colors hover:text-[#F9B418] hover:border-[#F9B418]`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
            {validationErrors.admin_users &&
              Array.isArray(validationErrors.admin_users) && (
                <div className="mt-2">
                  {validationErrors.admin_users.map(
                    (error: string, index: number) =>
                      error && (
                        <p key={index} className="text-sm text-red-500">
                          {error}
                        </p>
                      )
                  )}
                </div>
              )}
          </div>

          {/* About Client Section */}
          <div
            className={`pt-6 border-t ${
              theme === "dark" ? "border-[#cccccc20]" : "border-neutral-200"
            }`}
          >
            <label
              className={`${
                theme === "dark" ? "text-neutral-400" : "text-neutral-600"
              } items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-3 block`}
            >
              <FileText className="w-4 h-4 inline mr-1.5" />
              About Client
            </label>
            {isEditMode ? (
              <Textarea
                value={formData?.about || ""}
                onChange={(e) => handleChange("about", e.target.value)}
                rows={4}
                className={`${
                  theme === "dark"
                    ? "bg-zinc-800 border-[#cccccc20] text-zinc-400"
                    : "!bg-white border-neutral-200 text-neutral-900"
                } focus-visible:ring-1 focus-visible:ring-offset-0 resize-none rounded-sm`}
              />
            ) : (
              <p
                className={`leading-relaxed font-sans ${
                  theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                }`}
              >
                {clientData?.about || "--"}
              </p>
            )}
          </div>
        </div>

        {/* Offload Client Button */}
        {!isEditMode && (
          <button
            className={`${
              theme === "dark"
                ? "hover:bg-red-400/5 border-[#cccccc20] hover:border-red-500/20"
                : "hover:bg-red-50 border-neutral-200 hover:border-red-200"
            } hover:text-red-600 w-full mt-4 px-4 py-2.5 rounded-sm text-xs transition-all flex items-center justify-center gap-2 text-neutral-400 border`}
            onClick={() => {
              // TODO: Implement offload client functionality
              toast.info("Offload client functionality coming soon");
            }}
          >
            <UserX className="w-4 h-4" />
            Offload Client
          </button>
        )}
      </>
    );
  }
);

ClientDetails.displayName = "ClientDetails";

export default ClientDetails;
