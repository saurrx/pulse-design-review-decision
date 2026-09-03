import { readUserCookie } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import API_CONFIG from "../apiConfig";
import { toast } from "@/lib/toast";
import Cookies from "js-cookie";

/**
 * Hook for uploading file(s) via S3 presigned URLs.
 * Accepts { file: File } for single or { files: File[] } for multiple.
 * Returns same shape as old hook: { message, data: [fileRecords] }
 */
export function useFileUpload() {
  return useMutation({
    mutationKey: ["upload_file"],
    mutationFn: async (input: {
      file?: File;
      files?: File[];
      category?: "image" | "idea" | "patent";
    }) => {
      try {
        const category = input.category || "image";
        const { s3Upload, s3UploadMultiple } = await import("./s3Upload");
        let records;
        if (input.files && input.files.length > 0) {
          records = await s3UploadMultiple(input.files, category);
        } else if (input.file) {
          const record = await s3Upload(input.file, category);
          records = [record];
        } else {
          throw new Error("No file provided");
        }
        return { message: "File uploaded successfully", data: records };
      } catch (error: any) {
        console.error("upload file Error", error);
        toast.error(error?.response?.data?.message || "Failed to upload file!");
        throw error;
      }
    },
  });
}

export function useUserCookieUpdate() {
  return useMutation({
    mutationKey: ["update_cookie"],
    mutationFn: async () => {
      try {
        const present_user = readUserCookie();
        const response = await API_CONFIG.get(`/api/v1/auth/user/${present_user?.id}`);

        const profile_data = response?.data?.data;

        // update the cookie with the new profile data
        Cookies.set("pl_user", JSON.stringify(profile_data), { secure: true, sameSite: "lax", path: "/" });

        return response?.data;
      } catch (error) {
        console.error(error);
      }
    },
  });
}
