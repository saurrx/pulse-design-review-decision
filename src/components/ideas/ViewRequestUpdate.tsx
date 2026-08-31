import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { X, Eye, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import { toast } from "@/lib/toast";

// Utility function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

interface ViewRequestUpdateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideaId: string;
}

export default function ViewRequestUpdate({
  open,
  onOpenChange,
  ideaId,
}: ViewRequestUpdateProps) {
  const { data: updateRequests, isLoading: isLoadingUpdateRequests } = useQuery(
    {
      queryKey: ["recent-update-requests", ideaId],
      queryFn: async () => {
        try {
          const response = await API_CONFIG.get(
            `/api/v1/idea/fetch-recent-update-request/${ideaId}`
          );
          if (response?.status === 200) {
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Error fetching update requests:", error);
          toast.error(
            error?.response?.data?.message || "Error fetching update requests"
          );
        }
      },
      enabled: !!ideaId,
    }
  );

  const handleDownload = async (file: any) => {
    try {
      const response = await fetch(
        assetUrl(file?.file?.file_path)
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file?.file?.original_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Error downloading file");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden dark:bg-neutral-900 dark:border-[#cccccc20]">
        <div className="flex items-center justify-between p-4 border-b dark:border-[#cccccc20]">
          <DialogTitle className="text-lg font-medium font-sans dark:text-neutral-300">
            Content for Requested Update
          </DialogTitle>
        </div>

        <div className="p-6 space-y-6">
          {/* Inventors Section */}
          <div className="space-y-3">
            <h3 className="text-base font-sans font-semibold text-[#F9B418]">
              Inventors
            </h3>
            <div className="flex flex-wrap flex-row gap-4">
              {updateRequests?.allInventors?.map((inventor: any) => (
                <div key={inventor?.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={inventor?.id}
                    defaultChecked={true}
                    disabled
                    className="border-[#F9B418] text-[#F9B418] data-[state=checked]:bg-[#F9B418] data-[state=checked]:text-white"
                  />
                  <label htmlFor={inventor?.id} className="text-sm font-sans font-medium dark:text-neutral-300">
                    {inventor?.name || inventor?.email}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-[#F9B418] font-sans">Notes</h3>
            <div className="bg-gray-100 dark:bg-neutral-800 p-3 rounded-md">
              <p className="text-sm font-sans text-neutral-900 dark:text-neutral-300">
                {updateRequests?.mainRequest?.note || "No notes available"}
              </p>
            </div>
          </div>

          {/* Files Section */}
          {updateRequests?.mainRequest?.UpdateRequestFiles?.length > 0 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-[#F9B418]">Files</h3>
            </div>

            <div className="space-y-2">
              {updateRequests?.mainRequest?.UpdateRequestFiles?.map(
                (file: any) => (
                  <div
                    key={file.id}
                    className="flex items-center p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-[#FDF3DC] p-2 rounded">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="text-[#DA9700]"
                        >
                          <path
                            d="M7 18H17V16H7V18Z M7 14H17V12H7V14Z M7 10H17V8H7V10Z M5 22C4.45 22 3.979 21.804 3.587 21.412C3.195 21.02 2.999 20.549 3 20V4C3 3.45 3.196 2.979 3.588 2.587C3.98 2.195 4.451 1.999 5 2H19C19.55 2 20.021 2.196 20.413 2.588C20.805 2.98 21.001 3.451 21 4V20C21 20.55 20.804 21.021 20.412 21.413C20.02 21.805 19.549 22.001 19 22H5Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {file?.file?.original_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file?.file?.size || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="ml-auto flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => {
                          window.open(
                            assetUrl(file?.file?.file_path),
                            "_blank"
                          );
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleDownload(file)}
                      >
                        <Download className="h-4 w-4" />
                        <span className="sr-only">Download</span>
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
