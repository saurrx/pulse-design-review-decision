import type React from "react";

import { useState, useEffect } from "react";
import {
  X,
  Upload,
  FileText,
  Plus,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Check,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/lib/api-service/commonApi.service";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { useTheme } from "@/hooks/useTheme";

interface Inventor {
  id: string;
  name: string;
  checked: boolean;
  email?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  uploaded: boolean;
  file_path?: string;
  original_name?: string;
  file_name?: string;
  uploadedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface RequestUpdate {
  id: number;
  title: string;
  inventors: string[];
  message: string;
  files: number;
  date: string;
  // For demo purposes, we'll store mock files
  mockFiles?: {
    id: string;
    name: string;
    size: number;
    progress: number;
  }[];
}

interface RequestUpdateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideaId?: string;
  mainIdeaData?: any;
}

interface FormData {
  note: string;
  files: string[];
  inventors: string[];
}

interface UpdateRequest {
  id: string;
  note: string;
  inventors: string[];
  idea_id: string;
  createdAt: string;
  updatedAt: string;
  UpdateRequestFiles: {
    id: string;
    file_id: string;
    update_request_id: string;
    createdAt: string;
    updatedAt: string;
  }[];
}

export default function RequestUpdateModal({
  open,
  onOpenChange,
  mainIdeaData,
  ideaId,
}: RequestUpdateProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [inventors, setInventors] = useState<Inventor[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [note, setNote] = useState("");
  const [selectedInventors, setSelectedInventors] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const { theme } = useTheme();

  const {
    isPending: isFileUploading,
    data: fileUploadData,
    isSuccess: logoUploadSucess,
    mutate: fileUploadMutate,
  } = useFileUpload();

  const queryClient = useQueryClient();

  const { data: updateRequests, isLoading: isLoadingUpdateRequests } = useQuery(
    {
      queryKey: ["update-requests", ideaId],
      queryFn: async () => {
        try {
          const response = await API_CONFIG.get(
            `/api/v1/idea/fetch-update-requests/${ideaId}`
          );
          if (response?.status === 200) {
            const totalDrafts = response?.data?.data?.length;
            if (totalDrafts === 0) {
              setShowForm(true);
            }
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

  // Initialize inventors when mainIdeaData changes
  useEffect(() => {
    if (mainIdeaData?.IdeaInventor) {
      const inventorsList = [
        { id: "all", name: "All", checked: true },
        ...mainIdeaData.IdeaInventor.map((inv: any) => ({
          id: inv.inventor_id,
          name: inv.inventor?.name || inv.inventor?.email,
          checked: false,
        })),
      ];
      setInventors(inventorsList);
      // Initialize selected inventors with all inventor IDs
      setSelectedInventors(
        mainIdeaData.IdeaInventor.map((inv: any) => inv.inventor_id)
      );
    }
  }, [mainIdeaData]);

  // Load request data when editing
  useEffect(() => {
    if (editingRequestId !== null && updateRequests) {
      const requestToEdit = updateRequests.find(
        (req: UpdateRequest) => req.id === editingRequestId
      );

      if (requestToEdit) {
        // Set note
        setNote(requestToEdit.note);
        setSelectedInventors(requestToEdit.inventors);
        setSelectedFiles(
          requestToEdit.UpdateRequestFiles.map((file) => file.file_id)
        );

        // Set inventors
        const updatedInventors = inventors.map((inventor) => ({
          ...inventor,
          checked:
            inventor.id === "all"
              ? false
              : requestToEdit.inventors.includes(inventor.id),
        }));
        setInventors(updatedInventors);

        // Set files
        const uploadedFiles = requestToEdit.UpdateRequestFiles.map((file) => ({
          id: file.file_id,
          name: file.file_id,
          size: 0,
          type: "",
          progress: 100,
          uploaded: true,
        }));
        setFiles(uploadedFiles);
      }
    }
  }, [editingRequestId]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        // useFileUpload takes { file, files, category } and uploads to S3 — it
        // has no FormData branch, so passing one fell through to
        // "No file provided" and the upload silently failed at runtime. This
        // was a type error and a real bug.
        fileUploadMutate({ files: Array.from(e.target.files), category: "idea" });
    }
  };

  // Update files when upload is successful
  useEffect(() => {
    if (logoUploadSucess && fileUploadData?.data) {
      const uploadedFiles = fileUploadData.data.map((file: any) => ({
        id: file.id,
        name: file.original_name,
        size: file.size,
        type: file.type,
        file_path: file.file_path,
        original_name: file.original_name,
        file_name: file.file_name,
        uploadedBy: file.uploadedBy,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        progress: 100,
        uploaded: true,
      }));
      setFiles((prev) => [...prev, ...uploadedFiles]);
      setSelectedFiles((prev) => [
        ...prev,
        ...uploadedFiles.map((file) => file.id),
      ]);
    }
  }, [logoUploadSucess, fileUploadData]);

  const removeFile = (id: string) => {
    setFiles((currentFiles) => currentFiles.filter((file) => file.id !== id));
    setSelectedFiles((prev) => prev.filter((fileId) => fileId !== id));
  };

  const handleInventorChange = (id: string, checked: boolean) => {
    if (id === "all") {
      // If "All" is checked, uncheck others; if unchecked, keep others as is
      const updatedInventors = inventors.map((inventor) => ({
        ...inventor,
        checked: inventor.id === "all" ? checked : false,
      }));
      setInventors(updatedInventors);

      // Update selected inventors
      setSelectedInventors(
        checked
          ? mainIdeaData?.IdeaInventor?.map((inv: any) => inv.inventor_id) || []
          : []
      );
    } else {
      // If individual inventor is checked, uncheck "All"
      const updatedInventors = inventors.map((inventor) => ({
        ...inventor,
        checked:
          inventor.id === id
            ? checked
            : inventor.id === "all"
            ? false
            : inventor.checked,
      }));
      setInventors(updatedInventors);

      // Update selected inventors
      const selectedIds = updatedInventors
        .filter((inv) => inv.id !== "all" && inv.checked)
        .map((inv) => inv.id);
      setSelectedInventors(selectedIds);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      const fileArray = Array.from(e.dataTransfer.files).map((file) => ({
        ...file,
        id: crypto.randomUUID(),
        progress: 0,
        uploaded: false,
      }));
      setFiles((prev) => [...prev, ...fileArray]);

      // Simulate upload progress
      simulateFileUploads(fileArray);
    }
  };

  const simulateFileUploads = (filesToUpload: UploadedFile[]) => {
    filesToUpload.forEach((file) => {
      const intervalId = setInterval(() => {
        setFiles((currentFiles) => {
          const updatedFiles = currentFiles.map((f) => {
            if (f.id === file.id) {
              const newProgress = Math.min(
                f.progress + Math.random() * 20,
                100
              );
              const isComplete = newProgress === 100;

              if (isComplete) {
                clearInterval(intervalId);
              }

              return {
                ...f,
                progress: newProgress,
                uploaded: isComplete,
              };
            }
            return f;
          });
          return updatedFiles;
        });
      }, 500);
    });
  };

  const handleSubmit = () => {
    // If "All" is checked, ensure all inventor IDs are included
    const finalInventors = inventors.find((inv) => inv.id === "all")?.checked
      ? mainIdeaData?.IdeaInventor?.map((inv: any) => inv.inventor_id) || []
      : selectedInventors;

    const payload = {
      note,
     // files: selectedFiles,
      inventors: finalInventors,
    };

    if (editingRequestId) {
      updateRequestChange(payload);
    } else {
      addUpdateRequest(payload);
    }
    onOpenChange(false);
  };

  const resetForm = () => {
    setFiles([]);
    setNote("");
    setSelectedFiles([]);
    setSelectedInventors(
      mainIdeaData?.IdeaInventor?.map((inv: any) => inv.inventor_id) || []
    );
    setInventors(
      inventors.map((inv) => ({
        ...inv,
        checked: inv.id === "all" ? true : false,
      }))
    );
    setShowForm(false);
    setEditingRequestId(null);
  };

  const handleCreateNewRequest = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditRequest = (requestId: string) => {
    setEditingRequestId(requestId);
    setShowForm(true);
  };

  const handleBackToList = () => {
    resetForm();
  };

  const renderRequestList = () => (
    <DialogContent className="sm:max-w-md p-0 gap-0 bg-white dark:bg-neutral-900 dark:border-[#cccccc20] flex flex-col h-[500px] max-h-[80vh]">
      <DialogHeader className="p-4 border-b dark:border-[#cccccc20] shrink-0 h-[60px]">
        <div className="flex items-center justify-between w-full">
          <DialogTitle className="text-base font-medium dark:text-neutral-300">
            Request an Update
          </DialogTitle>
          {/* <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button> */}
        </div>
      </DialogHeader>

      <div className="p-4 space-y-4 overflow-y-auto flex-grow">
        {/* New Request Button */}
        <button
          className="w-full border-2 border-dashed border-[#F9B418] rounded-md p-6 flex flex-col items-center justify-center bg-[#F9B41820] hover:bg-[#F9B41810] transition-colors"
          onClick={handleCreateNewRequest}
        >
          <Plus className="h-8 w-8 text-[#F9B418]" />
          <p className="mt-2 text-sm font-medium text-[#F9B418]">
            Request new update
          </p>
        </button>

        {/* List of Previous Requests */}
        <div className="space-y-2">
          {isLoadingUpdateRequests ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-[#F9B418]" />
            </div>
          ) : updateRequests?.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-neutral-400">
              No update requests found
            </div>
          ) : (
            updateRequests?.map((request: UpdateRequest) => (
              <div
                key={request.id}
                className="border rounded-md p-4 hover:border-[#F9B418] dark:border-[#cccccc20] cursor-pointer transition-colors"
                onClick={() => handleEditRequest(request.id)}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-medium dark:text-neutral-300">Request Update</h3>
                  <ChevronRight className="h-5 w-5 text-[#F9B418]" />
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-neutral-300">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    {/* <span>
                      No. of Files: {request.UpdateRequestFiles.length}
                    </span> */}
                    <span>Inventors: {request.inventors.length}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between mt-1">
                    <p className="line-clamp-1">{request.note}</p>
                    <span className="text-gray-400 whitespace-nowrap">
                      sent on{" "}
                      {new Date(request.createdAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DialogContent>
  );

  const renderRequestForm = () => {
    const selectedInventors = inventors.filter((i) => i.checked);

    const getSelectedNames = () => {
      if (selectedInventors.length === 0) return "Select inventors";
      if (selectedInventors.length === 1) return selectedInventors[0]?.name;
      return `${selectedInventors.length} inventors selected`;
    };
    return (
      <DialogContent
        className={`max-w-lg border-0 backdrop-blur-xl ${
          theme === "light" ? "bg-white/95" : "bg-neutral-900/95"
        }`}
      >
        <DialogHeader className="space-y-3 pb-0">
          <div className="flex items-center w-full">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-2 mr-2 hover:bg-transparent"
              onClick={handleBackToList}
            >
              <ArrowLeft className="h-4 w-4 text-[#000] dark:text-white" />
              <span className="sr-only">Back</span>
            </Button>
            <div>
              <DialogTitle
                className={`text-xl ${
                  theme === "light" ? "text-gray-900" : "text-white"
                }`}
              >
                {editingRequestId !== null
                  ? "Edit Request Update"
                  : "Request Update from Inventor"}
              </DialogTitle>
              <DialogDescription
                className={`text-sm mt-0.5 ${
                  theme === "light" ? "text-gray-500" : "text-neutral-400"
                }`}
              >
                Share feedback and request revisions to the disclosure
              </DialogDescription>
            </div>
            {/* <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button> */}
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4 overflow-y-auto flex-grow">
          {/* <div className="space-y-2">
          <h3 className="text-sm font-medium">Add Note (Optional)</h3>
          <Textarea
            placeholder="Type notes here..."
            value={note}
            onChange={handleNoteChange}
            className="resize-none min-h-[80px]"
          />
        </div> */}

          <div className="space-y-2">
            <label
              className={`block text-sm ${
                theme === "light" ? "text-gray-700" : "text-neutral-300"
              }`}
            >
              Your Feedback & Update Request
            </label>
            <textarea
              value={note}
              onChange={handleNoteChange}
              placeholder="Describe what updates are needed (e.g., 'Please provide more details on the technical implementation of the AI algorithm...')"
              rows={6}
              className={`ph-no-capture w-full px-4 py-3 rounded-sm border resize-none transition-all focus:outline-none focus:ring-2 focus:ring-[#F9B418]/50 ${
                theme === "light"
                  ? "bg-transparent border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#F9B418]"
                  : "bg-transparent border-white/10 text-white placeholder:text-neutral-500 focus:border-[#F9B418]/50"
              }`}
            />
            <p
              className={`text-xs ${
                theme === "light" ? "text-gray-500" : "text-neutral-500"
              }`}
            >
              Be specific about what information or changes you need
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                className={`block text-sm ${
                  theme === "light" ? "text-gray-700" : "text-neutral-300"
                }`}
              >
                Choose Inventors
              </label>

            </div>

            {/* Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full px-4 py-3 rounded-sm border flex items-center justify-between ${
                  theme === "light"
                    ? "bg-transparent border-gray-200 text-gray-900"
                    : "bg-transparent border-white/10 text-white"
                } ${
                  selectedInventors.length > 0 ? "ring-2 ring-[#F9B418]/20" : ""
                }`}
              >
                <span
                  className={
                    selectedInventors.length === 0 ? "text-gray-400" : ""
                  }
                >
                  {getSelectedNames()}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDropdownOpen && (
                <div
                  className={`fixed z-50 w-[85%] mt-2 rounded-lg border shadow-xl overflow-hidden ${
                    theme === "light"
                      ? "bg-white border-gray-200"
                      : "bg-neutral-800 border-white/10"
                  }`}
                >
                  {inventors.map((inventor) => (
                    <button
                      key={inventor.id}
                      onClick={() =>
                        handleInventorChange(inventor.id, !inventor.checked)
                      }
                      className={`w-full px-4 py-3 flex items-center gap-3 ${
                        theme === "light"
                          ? "hover:bg-gray-50"
                          : "hover:bg-white/5"
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded-xs border flex items-center justify-center ${
                          inventor.checked
                            ? "bg-[#F9B418] border-[#F9B418]"
                            : theme === "light"
                            ? "border-gray-300"
                            : "border-white/20"
                        }`}
                      >
                        {inventor.checked && (
                          <Check className="w-3.5 h-3.5 text-black" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 text-left">
                        <div
                          className={`text-sm ${
                            theme === "light" ? "text-gray-900" : "text-white"
                          }`}
                        >
                          {inventor.name}
                        </div>
                        {inventor?.email && (
                          <div
                            className={`text-xs ${
                              theme === "light"
                                ? "text-gray-500"
                                : "text-neutral-500"
                            }`}
                          >
                            {inventor?.email}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedInventors.length > 0 && (
              <p
                className={`text-xs ${
                  theme === "light" ? "text-gray-500" : "text-neutral-500"
                }`}
              >
                {selectedInventors.length} inventor
                {selectedInventors.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* <div className="space-y-2">
          <h3 className="text-sm font-medium">Attach Files (Optional)</h3>

          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="border rounded-md p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-[#DA9700]" />
                      <div>
                        {file.file_path ? (
                          <a
                            href={assetUrl(file.file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[#DA9700] hover:underline"
                          >
                            {file.original_name || file.name}
                          </a>
                        ) : (
                          <p className="text-sm font-medium">
                            {file.original_name || file.name}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{formatFileSize(file.size || 0)}</span>
                          {isFileUploading ? (
                            <div className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Uploading...</span>
                            </div>
                          ) : (
                            <span>
                              {file.uploaded
                                ? "Uploaded"
                                : `${Math.round(file.progress)}%`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(file.id)}
                      disabled={isFileUploading}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove file</span>
                    </Button>
                  </div>
                </div>
              ))}

              <div
                className={cn(
                  "border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center cursor-pointer",
                  isDragging
                    ? "border-[#F9B418] bg-[#FDF3DC]"
                    : "border-gray-300"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isFileUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-[#DA9700]" />
                    <span className="text-sm text-[#DA9700]">
                      Uploading files...
                    </span>
                  </div>
                ) : (
                  <label className="text-sm text-[#DA9700] hover:underline cursor-pointer">
                    Add more files
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={handleFileChange}
                      disabled={isFileUploading}
                    />
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer",
                isDragging
                  ? "border-[#F9B418] bg-[#FDF3DC]"
                  : "border-gray-300"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isFileUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-[#DA9700]" />
                  <span className="text-sm text-[#DA9700]">
                    Uploading files...
                  </span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-[#DA9700]" />
                  <p className="mt-2 text-sm text-center text-gray-600">
                    Drag and drop files or{" "}
                    <label className="text-[#DA9700] hover:underline cursor-pointer">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        onChange={handleFileChange}
                        disabled={isFileUploading}
                      />
                    </label>
                  </p>
                </>
              )}
            </div>
          )}
        </div> */}
        </div>

        {/* <div className="flex justify-end p-4 border-t shrink-0 mt-auto">
        <Button
          className="bg-[#F9B418] hover:bg-[#DA9700] text-[#0C0C0C] disabled:opacity-50 disabled:pointer-events-none"
          onClick={handleSubmit}
          disabled={isAddingUpdateRequest || isUpdatingRequest}
        >
          {isAddingUpdateRequest || isUpdatingRequest
            ? "Sending..."
            : editingRequestId !== null
            ? "Update"
            : "Send"}
        </Button>
      </div> */}
        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={`px-6 border ${
              theme === "light"
                ? "border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
                : "border-white/10 text-neutral-400 hover:bg-none"
            }`}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isAddingUpdateRequest || isUpdatingRequest}
            className="bg-[#F9B418] hover:bg-[#F9B418]/90 text-black px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
    );
  };

  const { mutate: addUpdateRequest, isPending: isAddingUpdateRequest } =
    useMutation({
      mutationFn: async (payload: {
        note: string;
        //files: string[];
        inventors: string[];
      }) => {
        try {
          const response = await API_CONFIG.post(
            `/api/v1/idea/add-update-request/${ideaId}`,
            payload
          );
          if (response?.status === 200) {
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Error sending update request:", error);
          toast.error(
            error?.response?.data?.message || "Error sending update request"
          );
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["ideaDetails", ideaId],
        });
        queryClient.invalidateQueries({
          queryKey: ["idea_draft", ideaId],
        });
        queryClient.invalidateQueries({
          queryKey: ["update-requests", ideaId],
        });
      },
    });

  const { mutate: updateRequestChange, isPending: isUpdatingRequest } =
    useMutation({
      mutationFn: async (payload: {
        note: string;
        //files: string[];
        inventors: string[];
      }) => {
        try {
          const response = await API_CONFIG.post(
            `/api/v1/idea/update-requested-change/${editingRequestId}`,
            payload
          );
          if (response?.status === 200) {
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Error updating request:", error);
          toast.error(
            error?.response?.data?.message || "Error updating request"
          );
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["ideaDetails", ideaId],
        });
        queryClient.invalidateQueries({
          queryKey: ["update-requests", ideaId],
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showForm ? renderRequestForm() : renderRequestList()}
    </Dialog>
  );
}
