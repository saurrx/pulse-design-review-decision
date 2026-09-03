import React, { useEffect, useState } from "react";
import {
  X,
  Upload,
  Plus,
  File,
  Minus,
  AlertCircle,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormikProps } from "formik";
import { iClientOnboardForm } from "@/pages/client/ClientsPage";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import API_CONFIG from "@/lib/apiConfig";
import { useTheme } from "@/hooks/useTheme";
import { MAX_FILE_SIZE } from "@/utils/constants";

interface OnboardClientModalProps {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  formik: FormikProps<iClientOnboardForm>;
}

type ClientType = "EXISTING" | "POTENTIAL";

interface FormErrorProps {
  message: string;
}

export function FormError({ message }: FormErrorProps) {
  const { theme } = useTheme();

  return (
    <div
      className={`flex items-start gap-2 text-sm mt-2 px-3 py-2 rounded-lg border ${
        theme === "dark"
          ? "text-red-400 bg-red-500/5 border-red-500/20"
          : "text-red-600 bg-red-50 border-red-200"
      }`}
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

const OnboardClientModal: React.FC<OnboardClientModalProps> = ({
  open,
  onOpenChange,
  formik,
  isSubmitting,
}) => {
  const { theme } = useTheme();
  const [clientType, setClientType] = useState<ClientType>("EXISTING");
  const [attachedFiles, setAttachedFiles] = useState<any>(null);
  const [addNewInventors, setAddNewInventors] = useState([
    { id: Date.now(), value: "" },
  ]);

  const {
    values,
    setValues,
    handleBlur,
    handleChange,
    handleSubmit,
    errors,
    touched,
    setFieldValue,
    isValid,
    resetForm,
  } = formik;

  // No need to initialize newAdminEmail in formik values, as it's a local state

  const {
    mutate,
    data: fileUploadData,
    isPending: isUploadingLogo,
    isSuccess: fileUploadSucess,
    error: fileUploadError,
  } = useMutation({
    mutationKey: ["upload_file"],
    mutationFn: async (input: { file: File }) => {
      try {
        const { s3Upload } = await import("@/lib/api-service/s3Upload");
        const fileRecord = await s3Upload(input.file, "image");
        return { message: "File uploaded successfully", data: [fileRecord] };
      } catch (error: any) {
        console.error("upload file Error", error);
        toast.error(error?.response?.data?.message || "Failed to upload file!");
      }
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if(file?.size >= MAX_FILE_SIZE) {
        toast.error("File must be less than 1GB");
        return;
      }
      mutate({ file });
    }
  };

  useEffect(() => {
    if (fileUploadData) {
      setValues((prev) => ({ ...prev, logo: fileUploadData?.data?.[0] }));
    }
  }, [fileUploadData, setValues]);

  const { mutate: deleteFile } = useMutation({
    mutationKey: ["delete_file"],
    mutationFn: async (id: string) => {
      try {
        const response = await API_CONFIG.delete(`/api/v1/remove-file/${id}`);

        if (response.status === 200) {
          setValues((prev) => ({ ...prev, logo: "" }));
        }
      } catch (error) {
        console.error("file upload error", error);
        toast.error(error?.response?.message || "Failed to upload file");
      }
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if(e?.target?.files?.[0]?.size >= MAX_FILE_SIZE) {
        toast.error("File must be less than 1GB");
        return;
      }
      setAttachedFiles(e?.target?.files?.[0]);
      setValues((prev) => ({
        ...prev,
        patent_file: e?.target?.files?.[0],
      }));
    }
  };

  const handleAddNewInventor = () => {
    setAddNewInventors((prev) => [...prev, { id: Date.now(), value: "" }]);
  };

  const removeInventor = (id: string) => {
    setAddNewInventors((prev) => {
      const updated = prev.filter((inv) => inv.id?.toString() !== id);
      setFieldValue(
        "admin_users",
        updated.map((inv) => inv.value).filter((v) => v.trim() !== ""),
      );
      return updated;
    });
  };

  const handleInventorChange = (id: string, value: string) => {
    setAddNewInventors((prev) => {
      const updated = prev.map((inv) =>
        inv.id?.toString() === id ? { ...inv, value } : inv,
      );
      setFieldValue(
        "admin_users",
        updated.map((inv) => inv.value).filter((v) => v.trim() !== ""),
      );
      return updated;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        onOpenChange(false);
        setAttachedFiles(null);
      }}
    >
      <DialogContent
        className={`max-w-lg max-h-[90vh] overflow-y-auto backdrop-blur-xl border ${
          theme === "dark"
            ? "bg-neutral-950/95 border-white/10"
            : "bg-white/95 border-neutral-200"
        }`}
      >
        <DialogHeader>
          <DialogTitle
            className={`text-xl ${
              theme === "dark" ? "text-neutral-100" : "text-neutral-900"
            }`}
          >
            Onboard a Client
          </DialogTitle>
          <DialogDescription
            className={`text-xs uppercase tracking-wider ${
              theme === "dark" ? "text-neutral-500" : "text-neutral-600"
            }`}
          >
            Add a new client to the platform
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-5 mt-4">
            {/* Client Type - Radio Buttons */}
            <div>
              <Label
                className={`text-xs uppercase tracking-wider mb-3 block ${
                  theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                }`}
              >
                Client Type <span className="text-[#F9B418]">*</span>
              </Label>
              <div className="flex gap-3">
                {(["EXISTING", "POTENTIAL"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setValues((prev: any) => ({ ...prev, type: type }));
                      setClientType(type);
                    }}
                    className={`flex  items-center gap-3 px-4 py-3 border rounded-md transition-all flex-1 ${
                      clientType === type
                        ? theme === "dark"
                          ? "border-[#F9B418] bg-[#F9B418]/10"
                          : "border-[#F9B418] bg-[#F9B418]/10"
                        : theme === "dark"
                          ? "border-white/10 hover:border-white/20 bg-white/5"
                          : "border-neutral-200 hover:border-neutral-300 bg-neutral-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        clientType === type
                          ? "border-[#F9B418]"
                          : theme === "dark"
                            ? "border-neutral-600"
                            : "border-neutral-400"
                      }`}
                    >
                      {clientType === type && (
                        <div className="w-2 h-2 rounded-full bg-[#F9B418]" />
                      )}
                    </div>
                    <span
                      className={`text-sm capitalize ${
                        clientType === type
                          ? "text-[#F9B418]"
                          : theme === "dark"
                            ? "text-neutral-300"
                            : "text-neutral-700"
                      }`}
                    >
                      {type.toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
              {errors.type && <FormError message={errors.type} />}
            </div>
          </div>

          {/* Client Name */}
          <div>
            <Label
              htmlFor="clientName"
              className={`text-xs uppercase tracking-wider mb-2 block mt-2 ${
                theme === "dark" ? "text-neutral-400" : "text-neutral-600"
              }`}
            >
              Client Name <span className="text-[#F9B418]">*</span>
            </Label>
            <Input
              name="name"
              id="client"
              value={values.name}
              onChange={handleChange}
              placeholder="Enter client name"
              className={`h-10 ${
                theme === "dark"
                  ? "bg-transparent border-white/10 text-neutral-100 placeholder:text-neutral-500 focus-visible:border-[#F9B418] focus-visible:ring-0"
                  : "bg-transparent border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus-visible:border-[#F9B418] focus-visible:ring-0"
              }`}
              required
              onBlur={handleBlur}
              touched={touched}
              errors={errors}
            />
            {errors.name && <FormError message={errors.name} />}
          </div>

          {/* Upload Client Logo */}
          <div>
            <Label
              className={`text-xs uppercase tracking-wider mb-2 block ${
                theme === "dark" ? "text-neutral-400" : "text-neutral-600"
              }`}
            >
              Client Logo{" "}
              <span
                className={`text-xs normal-case ${
                  theme === "dark" ? "text-neutral-500" : "text-neutral-500"
                }`}
              >
                (Optional)
              </span>
            </Label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                theme === "dark"
                  ? "border-white/10 hover:border-white/20 bg-white/5"
                  : "border-neutral-200 hover:border-neutral-300 bg-neutral-50"
              }`}
            >
              <input
                type="file"
                id="logoUpload"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <label
                htmlFor="logoUpload"
                className="flex flex-col items-center cursor-pointer"
              >
                <Upload
                  className={`w-6 h-6 mb-2 ${
                    theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                  }`}
                />
                <p
                  className={`text-sm ${
                    theme === "dark" ? "text-neutral-300" : "text-neutral-700"
                  }`}
                >
                  {values?.logo?.original_name
                    ? values?.logo?.original_name
                    : "Click to upload logo"}
                </p>
                <p
                  className={`text-xs mt-1 ${
                    theme === "dark" ? "text-neutral-500" : "text-neutral-500"
                  }`}
                >
                  PNG, JPG or SVG (Max 5MB)
                </p>
              </label>
            </div>
          </div>

          {/* Upload Patent File */}
          <div>
            <Label
              className={`text-xs uppercase tracking-wider mb-2 block ${
                theme === "dark" ? "text-neutral-400" : "text-neutral-600"
              }`}
            >
              Patent File{" "}
              <span
                className={`text-xs normal-case ${
                  theme === "dark" ? "text-neutral-500" : "text-neutral-500"
                }`}
              >
                (Optional)
              </span>
            </Label>
            <div
              className={`border-2 border-dashed rounded-md p-8 transition-colors ${
                theme === "dark"
                  ? "border-white/10 hover:border-white/20 bg-white/5"
                  : "border-neutral-200 hover:border-neutral-300 bg-neutral-50"
              }`}
            >
              <input
                type="file"
                id="patentUpload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="patentUpload"
                className="flex flex-col items-center cursor-pointer"
              >
                <Upload
                  className={`w-6 h-6 mb-2 ${
                    theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                  }`}
                />
                <p
                  className={`text-sm ${
                    theme === "dark" ? "text-neutral-300" : "text-neutral-700"
                  }`}
                >
                  {attachedFiles?.name
                    ? attachedFiles?.name?.length > 50
                      ? attachedFiles?.name?.substring(0, 47) + "..."
                      : attachedFiles?.name
                    : "Click to upload patent file"}
                </p>
                <p
                  className={`text-xs mt-1 ${
                    theme === "dark" ? "text-neutral-500" : "text-neutral-500"
                  }`}
                >
                  PDF or DOC (Max 10MB)
                </p>
              </label>
            </div>
          </div>

          {/* Admin Emails */}
          <div className="space-y-1">
            <Label
              className={`${
                theme === "dark" ? "text-zinc-200" : "text-gray-600"
              } font-medium font-sans tracking-wider text-xs`}
            >
              ADMIN EMAIL(S)
              <span className="text-[#F9B418]">*</span>
            </Label>

            {addNewInventors.map((inv, index) => (
              <div key={inv.id} className="flex items-center gap-2">
                <Input
                  name="admin-email"
                  id="admin-email"
                  type="text"
                  className={`w-full ${
                    theme === "dark"
                      ? "bg-black/20 border-[#cccccc20] text-white placeholder:text-neutral-500"
                      : "placeholder:text-neutral-400"
                  }`}
                  placeholder="Enter name or email"
                  value={inv.value}
                  onBlur={(e) =>
                    handleInventorChange(inv.id?.toString(), e.target.value)
                  }
                  onChange={(e) =>
                    handleInventorChange(inv.id?.toString(), e.target.value)
                  }
                />

                {addNewInventors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeInventor(inv.id?.toString())}
                    className={`${
                      theme === "dark"
                        ? "text-zinc-200 border-[#cccccc20]"
                        : "text-zinc-900"
                    } text-gray-500 border rounded-lg p-3.5`}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={handleAddNewInventor}
              // onClick={() => {
              //   if (newAdminEmail && newAdminEmail.includes("@")) {
              //     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              //     if (!emailRegex.test(newAdminEmail)) {
              //       toast.error("Please enter a valid email address");
              //       return;
              //     }
              //     const existingEmails = [...values.admin_users];
              //     if (!existingEmails.includes(newAdminEmail)) {
              //       setValues({
              //         ...values,
              //         admin_users: [
              //           ...existingEmails.filter((email) => email.trim() !== ""),
              //           newAdminEmail,
              //         ],
              //       });
              //       setNewAdminEmail("");
              //     } else {
              //       toast.error("This email is already added");
              //     }
              //   }
              // }}
              className={`flex items-center gap-2 mt-3 text-xs uppercase tracking-wider transition-colors ${
                theme === "dark"
                  ? "text-neutral-400 hover:text-[#F9B418]"
                  : "text-neutral-600 hover:text-[#F9B418]"
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Another Email
            </button>
            {/* {errors.admin_users && (
              <FormError message={errors.admin_users as string} />
            )} */}
          </div>

          {/* Allowed Email Domain */}
          <div>
            <Label
              htmlFor="emailDomain"
              className={`text-xs uppercase tracking-wider mb-2 block ${
                theme === "dark" ? "text-neutral-400" : "text-neutral-600"
              }`}
            >
              Allowed Email Domain <span className="text-[#F9B418]">*</span>
            </Label>
            <Input
              name="allowed_domain"
              id="allowed_domain"
              value={values.allowed_domain}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
              onChange={(e) => {
                handleChange(e);
              }}
              placeholder="example.com"
              className={`h-10 ${
                theme === "dark"
                  ? "bg-transparent border-white/10 text-neutral-100 placeholder:text-neutral-500 focus-visible:border-[#F9B418] focus-visible:ring-0"
                  : "bg-transparent border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus-visible:border-[#F9B418] focus-visible:ring-0"
              }`}
            />
            {errors.allowed_domain && (
              <FormError message={errors.allowed_domain} />
            )}
            <p
              className={`text-xs mt-2 ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-500"
              }`}
            >
              Only emails from this domain will be allowed to access the client
              portal
            </p>
          </div>

          {/* Footer Actions */}
          <div
            className={`flex items-center justify-end gap-3 mt-6 pt-6 border-t ${
              theme === "dark" ? "border-white/10" : "border-neutral-200"
            }`}
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={`px-5 py-2.5 rounded-md text-xs uppercase tracking-wider border transition-colors ${
                theme === "dark"
                  ? "border-white/10 text-neutral-300 hover:border-white/20 hover:bg-white/5"
                  : "border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-md text-xs uppercase tracking-wider bg-[#F9B418] text-black hover:bg-[#F9B418]/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Onboarding..." : "Onboard Client"}
            </button>
          </div>
        </form>

        {/* <form
          onSubmit={handleSubmit}
          className="flex flex-col h-full overflow-auto"
        >
          <div className="flex-1 px-6 h-[200px] overflow-auto">
            <div className="space-y-6 px-2 pb-2">
              <div className="space-y-3">
                <Label className="font-medium">Admins</Label>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 relative">
                    <Input
                      name="admin-email"
                      id="admin-email"
                      placeholder="Enter admin email"
                      className="border-gray-200 pr-10"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          newAdminEmail &&
                          newAdminEmail.includes("@")
                        ) {
                          e.preventDefault();
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (!emailRegex.test(newAdminEmail)) {
                            toast.error("Please enter a valid email address");
                            return;
                          }
                          const existingEmails = [...values.admin_users];
                          if (!existingEmails.includes(newAdminEmail)) {
                            setValues({
                              ...values,
                              admin_users: [
                                ...existingEmails.filter(
                                  (email) => email.trim() !== ""
                                ),
                                newAdminEmail,
                              ],
                            });
                            setNewAdminEmail("");
                          } else {
                            toast.error("This email is already added");
                          }
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        if (newAdminEmail && newAdminEmail.includes("@")) {
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (!emailRegex.test(newAdminEmail)) {
                            toast.error("Please enter a valid email address");
                            return;
                          }
                          const existingEmails = [...values.admin_users];
                          if (!existingEmails.includes(newAdminEmail)) {
                            setValues({
                              ...values,
                              admin_users: [
                                ...existingEmails.filter(
                                  (email) => email.trim() !== ""
                                ),
                                newAdminEmail,
                              ],
                            });
                            setNewAdminEmail("");
                          } else {
                            toast.error("This email is already added");
                          }
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full"
                      disabled={
                        !newAdminEmail ||
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAdminEmail)
                      }
                    >
                      <Plus className="h-4 w-4 text-photon-primary" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {values.admin_users
                    .filter((email: string) => email.trim() !== "")
                    .map((email: string, index: number) => (
                      <div
                        key={index}
                        className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full flex items-center"
                      >
                        <span>{email}</span>
                        <Button
                          onClick={() => {
                            const updatedAdmins = [...values.admin_users];
                            updatedAdmins.splice(index, 1);
                            setValues({
                              ...values,
                              admin_users: updatedAdmins,
                            });
                          }}
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="ml-1 h-5 w-5 p-0 rounded-full hover:bg-gray-200"
                        >
                          <X className="h-3 w-3 text-gray-500" />
                        </Button>
                      </div>
                    ))}
                </div>

                {errors.admin_users && touched.admin_users && (
                  <p className="text-sm text-red-500">{errors.admin_users}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="font-medium">
                  Allowed Mail Domains (Required)
                </Label>
                <div className="flex gap-2">
                  <Input
                    name="allowed_domain"
                    id="allowed_domain"
                    value={values.allowed_domain}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      handleChange(e);
                    }}
                    placeholder="e.g. @clientdomain.com"
                    className="border-gray-200"
                    required
                    onBlur={handleBlur}
                    touched={touched}
                    errors={errors}
                  />
                </div>
                {errors.allowed_domain && touched.allowed_domain && (
                  <p className="text-sm text-red-500">
                    {errors.allowed_domain}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4 flex justify-end gap-2">
            <Button
              type="submit"
              className="rounded-lg bg-primary text-primary-foreground"
              disabled={
                !isValid ||
                isSubmitting ||
                !values.name?.trim() ||
                !values.type ||
                !values.allowed_domain?.trim() ||
                values.admin_users.filter((email) => email.trim() !== "")
                  .length === 0
              }
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form> */}
      </DialogContent>
    </Dialog>
  );
};

export default OnboardClientModal;
