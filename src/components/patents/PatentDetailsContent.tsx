import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  Clock,
  FileText,
  Save,
  Plus,
  Trash2,
  Loader2,
  PenIcon,
  ArrowLeft,
  X,
  Users,
  AlignLeftIcon,
  FileEditIcon,
  Globe,
  Calendar,
  ClipboardList,
  File,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import Loader from "../Loader";
import moment from "moment";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { useFileUpload } from "@/lib/api-service/commonApi.service";
import useUserCookie from "@/hooks/use-auth";
import { useTheme } from "@/hooks/useTheme";
import { Textarea } from "../ui/textarea";
import { MAX_FILE_SIZE } from "@/utils/constants";
import { isOutsideCounselRole } from "@/lib/roleAccess";
import { ProductChip } from "@/components/ui/product-chip";
import {
  PATENT_LEGAL_STATUS_META,
  type PatentLegalStatus,
} from "@/utils/patentLegalStatus";

// Date validation utilities
const validateDate = (
  date: string,
  patentApplicationDate: string,
  allowFutureDates: boolean = false,
): { isValid: boolean; errorMessage?: string } => {
  if (!date) {
    return { isValid: false, errorMessage: "Date is required" };
  }

  const inputDate = moment(date);
  const applicationDate = moment(patentApplicationDate);
  const today = moment();

  // Check if date is valid
  if (!inputDate.isValid()) {
    return { isValid: false, errorMessage: "Invalid date format" };
  }

  // Check if application date is valid
  if (!applicationDate.isValid()) {
    return { isValid: false, errorMessage: "Invalid patent application date" };
  }

  // Check if date is more than 100 years in the past (reasonable limit)
  if (inputDate.isBefore(moment().subtract(100, "years"))) {
    return {
      isValid: false,
      errorMessage: "Date cannot be more than 100 years ago",
    };
  }

  // Only check for future dates if allowFutureDates is false
  if (!allowFutureDates && inputDate.isAfter(today, "day")) {
    return { isValid: false, errorMessage: "Date cannot be in the future" };
  }

  // Check if date is before patent application date
  if (inputDate.isBefore(applicationDate, "day")) {
    return {
      isValid: false,
      errorMessage: `Date cannot be before patent application date (${applicationDate.format(
        "DD-MM-YYYY",
      )})`,
    };
  }

  return { isValid: true };
};

interface PatentDetailsContentProps {
  patentId: string;
}

interface PatentState {
  // Read-only fields
  title: string;
  application_number: string;
  application_date: string;
  application_type: string;
  priority_country: string;
  outside_counsel: string;
  patent_number: string;
  renewal_date: string;
  disclosure_id: string;
  abstract: string;
  inventors: string[];

  // Editable fields
  documents: Array<{
    title: string;
    type: string;
    url: string;
    addedDate: string;
  }>;
  PatentEvents: Array<{
    event_name: string;
    event_date: string;
    description: string;
  }>;
  status_timeline_history: Array<{
    status_name: string;
    status_date: string;
    completed: boolean;
  }>;
  next_steps_legal: [];
  next_steps_gpo: [];
  additional_notes: string;
}

const PatentDetailsContent: React.FC<PatentDetailsContentProps> = ({
  patentId,
}) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(true);
  const [isFamilyMembersExpanded, setIsFamilyMembersExpanded] = useState(true);
  const [selectedInventor, setSelectedInventor] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [patentState, setPatentState] = useState<PatentState>({
    title: "",
    application_number: "",
    application_date: "",
    application_type: "",
    priority_country: "",
    outside_counsel: "",
    patent_number: "",
    renewal_date: "",
    disclosure_id: "",
    abstract: "",
    inventors: [],
    documents: [],
    PatentEvents: [],
    status_timeline_history: [],
    next_steps_legal: [],
    next_steps_gpo: [],
    additional_notes: "",
  });

  // State for date validation errors
  const [dateValidationErrors, setDateValidationErrors] = useState<{
    timeline: { [key: number]: string };
    events: { [key: number]: string };
  }>({
    timeline: {},
    events: {},
  });

  // Helper functions to check for validation errors
  const hasTimelineValidationErrors = () => {
    const timelineErrors = dateValidationErrors.timeline;
    return Object.keys(timelineErrors).some((key) => {
      const error = timelineErrors[parseInt(key)];
      return error && error.trim() !== "";
    });
  };

  const hasEventValidationErrors = () => {
    const eventErrors = dateValidationErrors.events;
    return Object.keys(eventErrors).some((key) => {
      const error = eventErrors[parseInt(key)];
      return error && error.trim() !== "";
    });
  };

  const [localDocuments, setLocalDocuments] = useState<any[]>([]);
  const [newUploadedFiles, setNewUploadedFiles] = useState<any[]>([]);

  const queryClient = useQueryClient();

  const { user } = useUserCookie();

  const { isFetching: isFetchingPatentDetails, data: patentDetailsData } =
    useQuery({
      queryKey: ["patentDetails", patentId],
      queryFn: async () => {
        const response = await API_CONFIG.get(
          `/api/v1/patent/fetch/${patentId}`,
        );

        if (response.status === 200) {
          return response?.data;
        }
        return null;
      },
    });

  // Populate the editable state from the query result. This must live in an
  // effect (not queryFn) so cached data hydrates the state too — queryFn is
  // skipped entirely when React Query serves a fresh cached result.
  // isEditMode is deliberately NOT a dependency: hydration must only happen
  // when data arrives, not when edit mode toggles — the save flow flips
  // isEditMode off while the cache still holds pre-save data, and re-running
  // here at that moment would revert the user's saved edits until refetch.
  useEffect(() => {
    const data = patentDetailsData?.data;
    if (!data || isEditMode) return;

    setPatentState({
      title: data.title || "",
      application_number: data.application_number || "",
      application_date: data.application_date || "",
      application_type: data.application_type || "",
      priority_country: data.priority_country || "",
      outside_counsel: data.outside_counsel || "",
      patent_number: data.patent_number || "",
      renewal_date: data.renewal_date || "",
      disclosure_id: data.disclosure_id || "",
      abstract: data.abstract || "",
      inventors: data.inventors || [],
      documents: data.PatentFiles || [],
      PatentEvents: data.PatentEvents || [],
      status_timeline_history: data.status_timeline_history || [],
      next_steps_legal: data.next_steps_legal || [],
      next_steps_gpo: data.next_steps_gpo || [],
      additional_notes: data.additional_notes || "",
    });

    setNewUploadedFiles([]);
    setLocalDocuments(data?.PatentFiles?.map((item: any) => item?.file));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patentDetailsData]);

  const patent = {
    id: patentId,
    title: "Event optimization in a multi-tenant computing environment",
    status: "Ready for Examination",
    lastUpdated: "3:45 PM, 23 Oct 2024",
    domain: "Machine Learning",
    country: {
      name: "United States",
      flag: "🇺🇸",
    },
    applicationNo: "18/651,546",
    filingDate: "30-04-2024",
    applicationType: "Ordinary",
    priorityCountry: "United States",
    familyMembers: [
      { country: "US", applicationNo: "US11755625B2" },
      { country: "US", applicationNo: "US2021406285A1" },
      { country: "US", applicationNo: "US12111852B2" },
      { country: "US", applicationNo: "US2023394070A1" },
      { country: "EP", applicationNo: "EP4172813A1" },
      { country: "EP", applicationNo: "EP4172813A4" },
      { country: "WO", applicationNo: "WO2022006151A1" },
      { country: "JP", applicationNo: "JP2023533476A" },
      { country: "IN", applicationNo: "IN202227076300A" },
      { country: "CA", applicationNo: "CA3188139A1" },
      { country: "IL", applicationNo: "IL299554A" },
    ],
    currentEvent: "Office Order Assigned",
    inventors: [
      {
        name: "Mukhopadhyay Dibya",
        country: "US",
        affiliation: "Zuora Inc",
        email: "dibya.m@zuora.com",
        phone: "+1 (555) 123-4567",
        employeeId: "ZUR-8724",
        address: "3050 S Delaware St, San Mateo, CA 94403",
        countryOfResidence: "United States",
      },
      {
        name: "Chiu Anthony",
        country: "GB",
        affiliation: "Zuora Inc",
        email: "anthony.c@zuora.com",
        phone: "+44 (020) 7946-0958",
        employeeId: "ZUR-6391",
        address: "4 Winsley St, Fitzrovia, London, UK",
        countryOfResidence: "United Kingdom",
      },
      {
        name: "Sooklaris Maria Nicoletta",
        country: "US",
        affiliation: "Zuora Inc",
        email: "maria.s@zuora.com",
        phone: "+1 (555) 875-2139",
        employeeId: "ZUR-9174",
        address: "3050 S Delaware St, San Mateo, CA 94403",
        countryOfResidence: "United States",
      },
      {
        name: "Krishnaswamy Arun",
        country: "US",
        affiliation: "Zuora Inc",
        email: "arun.k@zuora.com",
        phone: "+1 (555) 456-7890",
        employeeId: "ZUR-4269",
        address: "3050 S Delaware St, San Mateo, CA 94403",
        countryOfResidence: "United States",
      },
      {
        name: "Sudersanam Sumithra",
        country: "IN",
        affiliation: "Zuora Inc",
        email: "sumithra.s@zuora.com",
        phone: "+91 (80) 4590-3865",
        employeeId: "ZUR-7254",
        address: "Brigade Gateway, 8th floor, Bengaluru, India",
        countryOfResidence: "India",
      },
      {
        name: "Shaik Amanulla",
        country: "IN",
        affiliation: "Zuora Inc",
        email: "amanulla.s@zuora.com",
        phone: "+91 (80) 4590-2741",
        employeeId: "ZUR-6157",
        address: "Brigade Gateway, 8th floor, Bengaluru, India",
        countryOfResidence: "India",
      },
      {
        name: "Pitchumani Vinodhini",
        country: "IN",
        affiliation: "Zuora Inc",
        email: "vinodhini.p@zuora.com",
        phone: "+91 (80) 4590-8963",
        employeeId: "ZUR-5431",
        address: "Brigade Gateway, 8th floor, Bengaluru, India",
        countryOfResidence: "India",
      },
    ],
    outsideCounsel: "Photon Legal",
    patentNo: "Pending",
    renewalDate: "N/A",
    disclosureId: "DIS-456-789",
    abstract:
      "Machine learning-based techniques are described that enable modifying an event timing schedule in a multi-tenant computing environment. The multi-tenant computing environment stores tenant data of multiple tenants. Each tenant of the multiple tenants offers subscription services to subscribers. Multiple events involving multiple subscribers of a particular tenant are attempted. The multiple events include a first subset of successfully executed events and a second subset of unsuccessfully executed events. One or more training datasets are generated based on the first subset and the second subset. The one or more training datasets include contextual information corresponding to each of the multiple events. The contextual information includes multilevel data. A machine learning model is trained to output a timing schedule for retrying a particular unsuccessfully executed event of a particular subscriber.",
    priorityDetails:
      "US202418651546A (17-Dec-2021) ; US202117554717A (30-Apr-2024)",
    assigneeOriginal: "ZUORA INC (US)",
    currentAssignee: "ZUORA INC",
    publicationDate: "19-09-2024",
    publicationCountry: "US",
    timeline: [
      {
        stage: "Application Filed",
        completed: true,
        date: "30-04-2024",
      },
      {
        stage: "Publication",
        completed: true,
        date: "19-09-2024",
      },
      {
        stage: "Ready for Examination",
        completed: true,
        date: "22-09-2024",
      },
      {
        stage: "Grant",
        completed: false,
        date: "",
      },
    ],
    events: [
      {
        title: "Application Submitted to USPTO",
        eventDate: "30-04-2024",
        completedOn: "30-04-2024",
        description:
          "Patent application filed with the United States Patent and Trademark Office.",
      },
      {
        title: "Publication of Application",
        eventDate: "19-09-2024",
        completedOn: "19-09-2024",
        description: "Patent application published for public disclosure.",
      },
      {
        title: "Ready for Substantive Examination",
        eventDate: "22-09-2024",
        completedOn: "22-09-2024",
        description:
          "Application has been processed and is now awaiting examination by a patent examiner.",
      },
      {
        title: "Office Order Assigned",
        eventDate: "28-09-2024",
        completedOn: "28-09-2024",
        description:
          "Patent application assigned to a patent examiner for review.",
      },
    ],
    nextStepsLegal:
      "Prepare for potential office actions from USPTO. Monitor examination status and be ready to respond to examiner inquiries within the statutory period.",
    nextStepsGPO:
      "Review prior art in the same technical field. Consider filing continuation applications to cover additional aspects of the technology.",
    documents: [
      {
        title: "Patent Application as Filed",
        type: "PDF",
        url: "#",
      },
      {
        title: "Published Application (US202418651546A)",
        type: "PDF",
        url: "#",
      },
      {
        title: "Priority Documents",
        type: "PDF",
        url: "#",
      },
    ],
    additionalNotes:
      "This patent application covers our core machine learning technology for event optimization in subscription management. Priority claim to US202418651546A (17-Dec-2021) and US202117554717A (30-Apr-2024). Original assignee: ZUORA INC (US), Current assignee: ZUORA INC.",
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleSelectInventor = (index: number) => {
    setSelectedInventor(index);
  };

  const handleEditToggle = () => {
    if (!isEditMode) {
      // When entering edit mode, ensure we have the latest data
      const data = patentDetailsData?.data;
      if (data) {
        setPatentState((prev) => ({
          ...prev,
          inventors: data.inventors || [],
        }));
      }
    } else {
      // Clear validation errors when exiting edit mode
      setDateValidationErrors({
        timeline: {},
        events: {},
      });
    }
    setIsEditMode(!isEditMode);
  };

  const handleInputChange = (field: keyof PatentState, value: any) => {
    setPatentState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEventChange = (index: number, field: string, value: any) => {
    // Always update the state immediately (for real-time typing)
    setPatentState((prev) => {
      const updatedEvents = [...prev.PatentEvents];
      updatedEvents[index] = {
        ...updatedEvents[index],
        [field]: value,
      };
      return {
        ...prev,
        PatentEvents: updatedEvents,
      };
    });
  };

  const validateEventDate = (index: number, value: string) => {
    if (!value) {
      // Clear error if empty
      setDateValidationErrors((prev) => ({
        ...prev,
        events: {
          ...prev.events,
          [index]: "",
        },
      }));
      return;
    }

    const applicationDate = patentDetailsData?.data?.application_date;
    if (applicationDate) {
      const validation = validateDate(value, applicationDate, true);

      setDateValidationErrors((prev) => ({
        ...prev,
        events: {
          ...prev.events,
          [index]: validation.isValid ? "" : validation.errorMessage || "",
        },
      }));

      if (!validation.isValid) {
        toast.error(validation.errorMessage);
      }
    }
  };

  const {
    mutate: uploadFile,
    isPending: isUploadingFile,
    data: uploadedFiles,
  } = useFileUpload();

  useEffect(() => {
    if (uploadedFiles) {
      const nFIles: any = uploadedFiles?.data;
      setNewUploadedFiles((prev) => [...nFIles]);
    }
  }, [uploadedFiles]);

  const handleAddEvent = () => {
    const applicationDate = patentDetailsData?.data?.application_date;
    const today = moment().format("YYYY-MM-DD");

    setPatentState((prev) => ({
      ...prev,
      PatentEvents: [
        {
          event_name: "",
          event_date:
            applicationDate && moment(applicationDate).isAfter(today)
              ? applicationDate
              : today,
          description: "",
        },
        ...prev.PatentEvents,
      ],
    }));
  };

  const { mutate: removeDocFile, isPending: isRemovingDocFile } = useMutation({
    mutationKey: ["remove_doc_file"],
    mutationFn: async (id: string) => {
      try {
        const response = await API_CONFIG.delete(
          `/api/v1/patent/delete-doc/${id}`,
        );
        if (response?.status === 200) {
          toast.success("Document removed successfully");
          setLocalDocuments((prev) => prev.filter((doc) => doc.id !== id));
          setNewUploadedFiles((prev) => prev.filter((doc) => doc.id !== id));
          queryClient.invalidateQueries({
            queryKey: ["patentDetails", patentId],
          });
        }
        return response?.data;
      } catch (error) {
        console.error("Error removing document file:", error);
        toast.error(error?.response?.data?.message || "Something went wrong");
      }
    },
  });

  const handleRemoveEvent = (index: number) => {
    setPatentState((prev) => ({
      ...prev,
      PatentEvents: prev.PatentEvents.filter((_, i) => i !== index),
    }));

    // Clear validation error for removed event
    setDateValidationErrors((prev) => {
      const newErrors = { ...prev.events };
      delete newErrors[index];
      // Shift down remaining errors
      const shiftedErrors: { [key: number]: string } = {};
      Object.keys(newErrors).forEach((key) => {
        const numKey = parseInt(key);
        if (numKey > index) {
          shiftedErrors[numKey - 1] = newErrors[numKey];
        } else {
          shiftedErrors[numKey] = newErrors[numKey];
        }
      });
      return {
        ...prev,
        events: shiftedErrors,
      };
    });
  };

  const handleAddTimeline = () => {
    const applicationDate = patentDetailsData?.data?.application_date;
    const today = moment().format("YYYY-MM-DD");

    setPatentState((prev) => ({
      ...prev,
      status_timeline_history: [
        ...prev.status_timeline_history,
        {
          status_name: "",
          status_date:
            applicationDate && moment(applicationDate).isAfter(today)
              ? applicationDate
              : today,
          completed: false,
        },
      ],
    }));
  };

  const handleTimelineChange = (index: number, field: string, value: any) => {
    // Always update the state immediately (for real-time typing)
    setPatentState((prev) => {
      const updatedTimeline = [...prev.status_timeline_history];
      updatedTimeline[index] = {
        ...updatedTimeline[index],
        [field]: value,
      };
      return {
        ...prev,
        status_timeline_history: updatedTimeline,
      };
    });
  };

  const validateTimelineDate = (index: number, value: string) => {
    if (!value) {
      // Clear error if empty
      setDateValidationErrors((prev) => ({
        ...prev,
        timeline: {
          ...prev.timeline,
          [index]: "",
        },
      }));
      return;
    }

    const applicationDate = patentDetailsData?.data?.application_date;
    if (applicationDate) {
      const validation = validateDate(value, applicationDate);

      setDateValidationErrors((prev) => ({
        ...prev,
        timeline: {
          ...prev.timeline,
          [index]: validation.isValid ? "" : validation.errorMessage || "",
        },
      }));

      if (!validation.isValid) {
        toast.error(validation.errorMessage);
      }
    }
  };

  const handleRemoveTimeline = (index: number) => {
    setPatentState((prev) => ({
      ...prev,
      status_timeline_history: prev.status_timeline_history.filter(
        (_, i) => i !== index,
      ),
    }));

    // Clear validation error for removed timeline
    setDateValidationErrors((prev) => {
      const newErrors = { ...prev.timeline };
      delete newErrors[index];
      // Shift down remaining errors
      const shiftedErrors: { [key: number]: string } = {};
      Object.keys(newErrors).forEach((key) => {
        const numKey = parseInt(key);
        if (numKey > index) {
          shiftedErrors[numKey - 1] = newErrors[numKey];
        } else {
          shiftedErrors[numKey] = newErrors[numKey];
        }
      });
      return {
        ...prev,
        timeline: shiftedErrors,
      };
    });
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files) return;

    try {
      const validFiles: File[] = [];
      for (const file of files) {
        if(file?.size >= MAX_FILE_SIZE) {
          toast.error("File must be less than 1GB");
          return;
        }
        validFiles.push(file);
      }

      uploadFile({ files: validFiles, category: "image" });
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteDocument = (id: string) => {
    if (id) {
      removeDocFile(id);
    }
  };

  const { mutate: updatePatent, isPending: isUpdatingPatent } = useMutation({
    mutationFn: async (data) => {
      try {
        const response = await API_CONFIG.put(
          `/api/v1/patent/update-single/${patentId}`,
          data,
        );

        if (response?.status === 200) {
          toast.success("Patent updated successfully");
          handleEditToggle();
          queryClient.invalidateQueries({
            queryKey: ["patentDetails", patentId],
          });
        }

        return response?.data;
      } catch (error) {
        console.error("Error updating patent:", error);
        toast.error(error?.response?.data?.message || "Something went wrong",);
      }
    },
  });

  const handleSave = async () => {
    // Check for any validation errors before saving
    const hasTimelineErrors = Object.values(dateValidationErrors.timeline).some(
      (error) => error !== "",
    );
    const hasEventErrors = Object.values(dateValidationErrors.events).some(
      (error) => error !== "",
    );

    if (hasTimelineErrors || hasEventErrors) {
      toast.error("Please fix date validation errors before saving");
      return;
    }

    // Only send editable fields to the API
    const editableFields: any = {
      documents: newUploadedFiles?.map((doc) => doc?.id) || [],
      PatentEvents: patentState.PatentEvents,
      status_timeline_history: patentState.status_timeline_history,
      next_steps_legal: patentState.next_steps_legal?.map((item: any) => item),
      next_steps_gpo: patentState.next_steps_gpo?.map((item: any) => item),
      additional_notes: patentState.additional_notes,
    };
    try {
      // const response = await API_CONFIG.put(
      //   `/api/v1/patent/update/${patentId}`,
      //   editableFields
      // );
      // if (response.status === 200) {
      //   setIsEditMode(false);
      //   // You might want to show a success toast here
      // }
      updatePatent(editableFields);
    } catch (error) {
      console.error("Error updating patent:", error);
    }
  };

  const handleAddNewDocument = () => {
    setPatentState((prev: any) => ({
      ...prev,
      documents: [
        ...(prev.documents || []),
        {
          status_name: "",
          files: [],
        },
      ],
    }));
  };

  const handleAddDocuments = (stageIndex: number, files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);

    // update patentState
    setPatentState((prev: any) => {
      const updated = [...prev.documents];
      updated[stageIndex] = {
        ...updated[stageIndex],
        files: [...(updated[stageIndex].files || []), ...newFiles],
      };
      return { ...prev, documents: updated };
    });

    // store only file names
    setNewUploadedFiles((prev: string[]) => [
      ...prev,
      ...newFiles.map((file) => file.name),
    ]);
  };

  const handleRemoveDocument = (stageIndex: number, fileIndex: number) => {
    setPatentState((prev: any) => {
      const updated = [...prev.documents];
      updated[stageIndex] = {
        ...updated[stageIndex],
        files: updated[stageIndex].files.filter(
          (_: any, i: number) => i !== fileIndex,
        ),
      };
      return { ...prev, documents: updated };
    });
  };

  const handleRemoveDocumentBlock = (stageIndex: number) => {
    setPatentState((prev: any) => ({
      ...prev,
      documents: prev.documents.filter((_: any, i: number) => i !== stageIndex),
    }));
  };

  const handleAddLegalStep = () => {
    setPatentState((prev: any) => ({
      ...prev,
      next_steps_legal: [...(prev.next_steps_legal || []), { name: "" }],
    }));
  };

  const handleLegalStepChange = (index: number, value: string) => {
    setPatentState((prev: any) => {
      const updated = [...prev.next_steps_legal];
      updated[index] = value;
      return { ...prev, next_steps_legal: updated };
    });
  };

  const handleRemoveLegalStep = (index: number) => {
    setPatentState((prev: any) => ({
      ...prev,
      next_steps_legal: prev.next_steps_legal.filter(
        (_: any, i: number) => i !== index,
      ),
    }));
  };

  const handleAddGpoStep = () => {
    setPatentState((prev: any) => ({
      ...prev,
      next_steps_gpo: [...(prev.next_steps_gpo || []), { name: "" }],
    }));
  };

  const handleGpoStepChange = (index: number, value: string) => {
    setPatentState((prev: any) => {
      const updated = [...prev.next_steps_gpo];
      updated[index] = value;
      return { ...prev, next_steps_gpo: updated };
    });
  };

  const handleRemoveGpoStep = (index: number) => {
    setPatentState((prev: any) => ({
      ...prev,
      next_steps_gpo: prev.next_steps_gpo.filter(
        (_: any, i: number) => i !== index,
      ),
    }));
  };

  const currentLegalStatus = patentDetailsData?.data
    ?.legal_current_status as PatentLegalStatus | undefined;
  const legalStatusMeta = currentLegalStatus
    ? PATENT_LEGAL_STATUS_META[currentLegalStatus]
    : undefined;

  return (
    <div className="patent-detail-page w-full dark:bg-[#0a0a0a]">
      {isFetchingPatentDetails && !patentDetailsData ? (
        <Loader />
      ) : (
        <div className={` w-full`}>
          {/* Animated Gradient Background */}
          <div className="hidden">
            {theme === "dark" ? (
              <>
                {/* Yellow Gradient Blob */}
                <div
                  className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl animate-blob"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(245, 166, 35, 0.4) 0%, rgba(245, 166, 35, 0) 70%)",
                    top: "-10%",
                    right: "10%",
                    animationDelay: "0s",
                  }}
                />
                {/* Cyan Gradient Blob */}
                <div
                  className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl animate-blob"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0) 70%)",
                    bottom: "10%",
                    left: "5%",
                    animationDelay: "2s",
                  }}
                />
                {/* Purple Gradient Blob */}
                <div
                  className="absolute w-[550px] h-[550px] rounded-full opacity-15 blur-3xl animate-blob"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0) 70%)",
                    top: "40%",
                    left: "30%",
                    animationDelay: "4s",
                  }}
                />
              </>
            ) : (
              <>
                {/* Yellow Gradient Blob - Light */}
                <div
                  className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-3xl animate-blob"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(245, 166, 35, 0.2) 0%, rgba(245, 166, 35, 0) 70%)",
                    top: "-10%",
                    right: "10%",
                    animationDelay: "0s",
                  }}
                />
                {/* Cyan Gradient Blob - Light */}
                <div
                  className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-3xl animate-blob"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0) 70%)",
                    bottom: "10%",
                    left: "5%",
                    animationDelay: "2s",
                  }}
                />
                {/* Pink Gradient Blob - Light */}
                <div
                  className="absolute w-[550px] h-[550px] rounded-full opacity-20 blur-3xl animate-blob"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0) 70%)",
                    top: "40%",
                    left: "30%",
                    animationDelay: "4s",
                  }}
                />
              </>
            )}
          </div>
          <div
            className={`w-full rounded-2xl border px-6 py-5 [box-shadow:var(--pulse-shadow-card)] ${
              theme === "dark"
                ? "bg-neutral-950 border-[#cccccc20]"
                : "bg-white border-[var(--pulse-line)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`${
                  theme === "dark" ? "text-neutral-500" : "text-gray-600"
                } text-xs font-sans`}
              >
                Patents <span className="mx-1 text-gray-500">/</span>{" "}
                {patentDetailsData?.data?.application_number || patentId}
              </span>
            </div>{" "}
            <div className="flex justify-between w-full">
              <div>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={handleGoBack}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--pulse-line)] text-[var(--pulse-ink-secondary)] transition-colors hover:bg-[var(--pulse-surface-subtle)] hover:text-[var(--pulse-ink)]"
                    aria-label="Back to patents"
                  >
                    <ArrowLeft
                      className={`h-5 w-5 ${
                        theme === "dark" ? "text-[#a1a1a1]" : "text-gray-600"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-[22px] font-semibold leading-7 tracking-[-0.02em] font-sans ${
                      theme === "dark" ? "text-zinc-200" : "text-zinc-900"
                    }`}
                  >
                    {patentDetailsData?.data?.title || "-"}
                  </span>
                </div>
                <div className="ml-[52px] mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-[var(--pulse-ink-muted)] font-sans tabular-nums">
                    <Clock size={12} />
                    Filed{" "}
                    {patentDetailsData?.data?.application_date
                      ? moment(patentDetailsData.data.application_date).format(
                          "MMM D, YYYY",
                        )
                      : "—"}
                  </div>
                  {legalStatusMeta && (
                    <ProductChip
                      kind="status"
                      markerColor={legalStatusMeta.marker}
                      textColor={legalStatusMeta.text}
                    >
                      {legalStatusMeta.label.replace(
                        /^(Active|Inactive) – /,
                        "",
                      )}
                    </ProductChip>
                  )}
                </div>
              </div>
              {isOutsideCounselRole(user?.role) && (
                <div>
                  {!isEditMode ? (
                    <button
                      onClick={isEditMode ? handleSave : handleEditToggle}
                      className={`flex items-center gap-2 border rounded-lg text-sm font-sans font-medium ${
                        theme === "dark"
                          ? "border-[#cccccc20] text-neutral-300"
                          : "text-neutral-600"
                      } h-fit mt-4 py-2.5 px-4`}
                    >
                      <PenIcon size={16} /> Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => {
                          // Reset form state to original data
                          const data = patentDetailsData?.data;
                          if (data) {
                            setPatentState({
                              title: data.title || "",
                              application_number: data.application_number || "",
                              application_date: data.application_date || "",
                              application_type: data.application_type || "",
                              priority_country: data.priority_country || "",
                              outside_counsel: data.outside_counsel || "",
                              patent_number: data.patent_number || "",
                              renewal_date: data.renewal_date || "",
                              disclosure_id: data.disclosure_id || "",
                              abstract: data.abstract || "",
                              inventors: data.inventors || [],
                              documents: data.documents || [],
                              PatentEvents: data.PatentEvents || [],
                              status_timeline_history:
                                data.status_timeline_history || [],
                              next_steps_legal: data.next_steps_legal || [],
                              next_steps_gpo: data.next_steps_gpo || [],
                              additional_notes: data.additional_notes || "",
                            });
                            setNewUploadedFiles([]);
                            setLocalDocuments(
                              data?.PatentFiles?.map((item: any) => item?.file),
                            );
                          }
                          setIsEditMode(false);
                        }}
                        className={`${
                          theme === "dark"
                            ? "text-neutral-300 border-[#cccccc20]"
                            : "text-gray-500"
                        } flex items-center gap-2 border rounded-lg text-sm h-fit py-3 px-4`}
                      >
                        <X size={16} /> Cancel
                      </button>
                      <button
                        onClick={isEditMode ? handleSave : handleEditToggle}
                        className="flex items-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold bg-[#F9B418] text-neutral-900 h-fit py-3 px-4"
                      >
                        <Save size={16} /> Save Changes
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="w-full pb-10">
            <div className="mt-5 grid w-full grid-cols-1 gap-5 patent-details-grid">
              <div className="grid w-full grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(320px,0.8fr)]">
                <Card
                  className={`${
                    theme === "dark"
                      ? "border-[#cccccc20] bg-neutral-900/50"
                      : ""
                  }`}
                >
                  <CardHeader
                    className={`${
                      theme === "light" ? "bg-gray-50/5" : "border-[#cccccc20]"
                    } border-b rounded-t-lg py-5`}
                  >
                    <CardTitle
                      className={`${
                        theme === "dark" && "text-neutral-100"
                      } flex items-center gap-2 font-sans text-[15px] font-semibold`}
                    >
                      <FileText size={16} className="text-[var(--pulse-ink-muted)]" /> Patent
                      Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="pt-6 pb-4">
                      <div className="grid grid-cols-2 gap-6 patent-info-grid">
                        <div className="space-y-1 font-sans">
                          <p
                            className={`text-xs font-medium ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-gray-600"
                            } tracking-wide`}
                          >
                            Application No.
                          </p>
                          <p
                            className={`${
                              theme === "dark" && "text-neutral-300"
                            } text-sm tabular-nums`}
                          >
                            {patentDetailsData?.data?.application_number}
                          </p>
                          {patentDetailsData?.data?.IdeaPatentLink?.[0]?.idea
                            ?.id && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/ideas/${patentDetailsData.data.IdeaPatentLink[0].idea.id}`,
                                )
                              }
                              className="text-xs text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                              title={
                                patentDetailsData.data.IdeaPatentLink[0].idea
                                  .title
                              }
                            >
                              ↳ Linked to idea:{" "}
                              {patentDetailsData.data.IdeaPatentLink[0].idea
                                .title || "View idea"}
                            </button>
                          )}
                        </div>

                        <div className="space-y-1 font-sans">
                          <p
                            className={`text-xs font-medium ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-gray-600"
                            } tracking-wide`}
                          >
                            Filing Date
                          </p>
                          <p
                            className={`${
                              theme === "dark" && "text-neutral-300"
                            } text-sm tabular-nums`}
                          >
                            {moment(
                              patentDetailsData?.data?.application_date,
                            ).format("MMM D, YYYY")}
                          </p>
                        </div>

                        <div className="space-y-1 font-sans">
                          <p
                            className={`text-xs font-medium ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-gray-600"
                            } tracking-wide`}
                          >
                            Application Type
                          </p>
                          <p
                            className={`${
                              theme === "dark" && "text-neutral-300"
                            } text-sm`}
                          >
                            {patentDetailsData?.data?.application_type || "—"}
                          </p>
                        </div>

                        <div className="space-y-1 font-sans">
                          <p
                            className={`text-xs font-medium ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-gray-600"
                            } tracking-wide`}
                          >
                            Priority Country
                          </p>
                          <p
                            className={`${
                              theme === "dark" && "text-neutral-300"
                            } text-sm`}
                          >
                            {patentDetailsData?.data?.priority_country || "—"}
                          </p>
                        </div>

                        <div className="space-y-1 font-sans">
                          <p
                            className={`text-xs font-medium ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-gray-600"
                            } tracking-wide`}
                          >
                            Outside Counsel
                          </p>
                          <p
                            className={`${
                              theme === "dark" && "text-neutral-300"
                            } text-sm`}
                          >
                            {patentDetailsData?.data?.outside_counsel || "—"}
                          </p>
                        </div>

                        <div className="space-y-1 font-sans">
                          <p
                            className={`text-xs font-medium ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-gray-600"
                            } tracking-wide`}
                          >
                            Patent No.
                          </p>
                          <p
                            className={`${
                              theme === "dark" && "text-neutral-300"
                            } text-sm`}
                          >
                            {patentDetailsData?.data?.patent_number || "Pending"}
                          </p>
                        </div>

                        <div className="space-y-1 font-sans">
                          <p
                            className={`text-xs font-medium ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-gray-600"
                            } tracking-wide`}
                          >
                            Renewal Date
                          </p>
                          <p
                            className={`${
                              theme === "dark" && "text-neutral-300"
                            } text-sm`}
                          >
                            {patentDetailsData?.data?.renewal_date
                              ? moment(
                                  patentDetailsData.data.renewal_date,
                                ).format("MMM D, YYYY")
                              : "—"}
                          </p>
                        </div>

                        <div className="space-y-1 font-sans">
                          <p
                            className={`text-xs font-medium ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-gray-600"
                            } tracking-wide`}
                          >
                            Disclosure ID
                          </p>
                          <p
                            className={`${
                              theme === "dark" && "text-neutral-300"
                            } text-sm`}
                          >
                            {patentDetailsData?.data?.disclosure_id || "—"}
                          </p>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card
                  className={`w-full ${
                    theme === "dark"
                      ? "border-[#cccccc20] bg-neutral-900/50"
                      : ""
                  }`}
                >
                  <CardHeader
                    className={`${
                      theme === "light" ? "bg-gray-50/5" : "border-[#cccccc20]"
                    } border-b rounded-t-xl`}
                  >
                    <CardTitle
                      className={`${
                        theme === "dark" && "text-neutral-100"
                      } flex items-center gap-2 font-sans text-[15px] font-semibold`}
                    >
                      <Users size={17} className="text-[var(--pulse-ink-muted)]" /> Inventors
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4 px-4">
                    <ScrollArea className="">
                      <div className="space-y-1 mt-2">
                        {patentState.inventors.map(
                          (inventor: string, index: number) => (
                            <div key={index}>
                              <div className="py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2 px-2">
                                  <span
                                    className={`${
                                      theme === "dark"
                                        ? "text-neutral-300"
                                        : "text-gray-600"
                                    } text-sm font-medium font-sans`}
                                  >
                                    {inventor}
                                  </span>
                                </div>
                                {/* <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                    >
                                      <Link
                                        size={14}
                                        className={
                                          selectedInventor === index
                                            ? "text-photon-primary"
                                            : "text-gray-500"
                                        }
                                      />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-48 bg-white"
                                  >
                                    {patent.inventors.map((item, idx) => (
                                      <DropdownMenuItem
                                        key={idx}
                                        onClick={() =>
                                          handleSelectInventor(idx)
                                        }
                                        className="cursor-pointer"
                                      >
                                        {item.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu> */}
                              </div>
                              {index < patentState.inventors.length - 1 && (
                                <Separator
                                  className={`${
                                    theme === "dark" && "bg-[#cccccc20]"
                                  } my-1 h-[1px]`}
                                />
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <Card
                className={`col-span-2 my-2 ${
                  theme === "dark" ? "border-[#cccccc20] bg-neutral-900/50" : ""
                }`}
              >
                <CardHeader
                  className={`${
                    theme === "light" ? "bg-gray-50/5" : ""
                  } rounded-t-xl`}
                >
                  <CardTitle
                    className={`${
                      theme === "dark" && "text-neutral-100"
                    } flex items-center gap-2 font-sans text-[15px] font-semibold`}
                  >
                    <AlignLeftIcon size={17} className="text-[var(--pulse-ink-muted)]" />{" "}
                    Abstract
                  </CardTitle>
                </CardHeader>
                <CardContent className="-mt-2">
                  <Collapsible
                    open={isAbstractExpanded}
                    onOpenChange={setIsAbstractExpanded}
                  >
                    {!isEditMode ? (
                      <CollapsibleContent>
                        <p
                          className={`${
                            theme === "dark"
                              ? "text-neutral-400"
                              : "text-gray-600"
                          } text-xs sm:text-sm font-sans mt-2`}
                        >
                          {patentDetailsData?.data?.abstract}
                        </p>
                      </CollapsibleContent>
                    ) : (
                      <Textarea
                        placeholder="Add abstract"
                        name="abstract"
                        value={patentState.abstract || ""}
                        onChange={(e) =>
                          handleInputChange("abstract", e.target.value)
                        }
                        className={`rounded-lg border ${
                          theme === "dark"
                            ? "bg-black text-neutral-300 border-[#cccccc50]"
                            : "bg-transparent"
                        }`}
                      />
                    )}
                  </Collapsible>
                </CardContent>
              </Card>

              <Card
                className={`col-span-2 mb-2 ${
                  theme === "dark" ? "border-[#cccccc20] bg-neutral-900/50" : ""
                }`}
              >
                <CardHeader
                  className={`${
                    theme === "light" ? "bg-gray-50/5" : ""
                  } rounded-t-xl`}
                >
                  <CardTitle
                    className={`${
                      theme === "dark" && "text-neutral-100"
                    } flex items-center gap-2 font-sans text-[15px] font-semibold`}
                  >
                    <Globe size={17} className="text-[var(--pulse-ink-muted)]" /> Family
                    Members
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Collapsible
                    open={isFamilyMembersExpanded}
                    onOpenChange={setIsFamilyMembersExpanded}
                  >
                    <CollapsibleContent>
                      {patentDetailsData?.data?.simple_family_members?.length ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {patentDetailsData.data.simple_family_members.map(
                          (member, index) => (
                            <div
                              key={index}
                              className={`flex items-center gap-2 p-2 ${
                                index <
                                patentDetailsData?.data?.simple_family_members
                                  ?.length -
                                  1
                                  ? "border-b pb-2"
                                  : ""
                              } dark:border-[#cccccc20] rounded-md`}
                            >
                              <FileText
                                size={14}
                                className="text-gray-500 flex-shrink-0"
                              />
                              <span className="text-xs font-medium truncate">
                                {member}
                              </span>
                            </div>
                          ),
                          )}
                        </div>
                      ) : (
                        <p className="pb-2 text-sm text-neutral-500 dark:text-neutral-400">
                          No related family records.
                        </p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              <Card
                className={`col-span-2 mb-2 ${
                  theme === "dark" ? "border-[#cccccc20] bg-neutral-900/50" : ""
                }`}
              >
                <CardHeader
                  className={`${
                    theme === "light" ? "bg-gray-50/5" : ""
                  } rounded-t-xl`}
                >
                  <CardTitle
                    className={`${
                      theme === "dark" && "text-neutral-100"
                    } flex items-center justify-between gap-2 font-sans text-[15px] font-semibold`}
                  >
                    <div className="flex items-center gap-2">
                      <File size={17} className="text-[var(--pulse-ink-muted)]" /> Documents
                    </div>
                    {isEditMode && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddNewDocument}
                        className={`bg-transparent font-medium font-sans ${
                          theme === "dark"
                            ? "border-[#cccccc20] text-neutral-400 hover:bg-white/5 hover:text-neutral-300"
                            : ""
                        } flex items-center gap-2`}
                        title={
                          hasTimelineValidationErrors()
                            ? "Please fix validation errors before adding new status"
                            : ""
                        }
                      >
                        <Plus size={14} />
                        Add
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="gap-4">
                    {patentState?.documents?.map(
                      (stage: any, index: number) => {
                        const fileInputRef =
                          React.createRef<HTMLInputElement>();

                        return (
                          <div
                            key={index}
                            className="flex-1 min-w-[250px] pb-2"
                          >
                            {/* Status Name */}
                            <p className="text-sm font-medium">
                              {stage.status_name}
                            </p>

                            {/* Hidden File Input */}
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                handleFileUpload(e);
                                handleAddDocuments(index, e.target.files);
                              }}
                            />

                            {/* Add Document Input */}
                            {isEditMode && (
                              <div className="flex items-center gap-2 mb-3 border-t">
                                {!stage?.file && (
                                  <div className="w-full pt-3">
                                    <input
                                      readOnly
                                      value={stage?.file?.file_name}
                                      placeholder="Click to add documents"
                                      onClick={() =>
                                        fileInputRef.current?.click()
                                      }
                                      className="flex-1 p-1 px-4 border rounded-md text-sm cursor-pointer bg-transparent w-full"
                                    />
                                  </div>
                                )}

                                {/* Trash for EMPTY block */}
                                {stage.files?.length === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteDocument(stage?.id);
                                      handleRemoveDocumentBlock(index);
                                    }}
                                    className="text-red-500 hover:text-red-600 pt-3"
                                    title="Remove document block"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Documents List */}

                            {stage?.file && (
                              <div className="group flex items-center gap-2 w-full">
                                <div
                                  className={`flex justify-between items-center ${
                                    isEditMode
                                      ? `border rounded-md ${
                                          theme === "dark" ? "bg-black" : ""
                                        } px-3`
                                      : `${
                                          index <
                                          patentState?.documents?.length - 1
                                            ? "border-b pb-2"
                                            : ""
                                        }`
                                  } group-hover:pb-3 w-full ${
                                    theme === "dark" ? "border-[#cccccc20]" : ""
                                  }`}
                                >
                                  {/* File Name */}
                                  <input
                                    readOnly
                                    value={stage?.file?.file_name}
                                    className={`font-sans ${
                                      theme === "dark"
                                        ? "text-neutral-400"
                                        : "text-neutral-700"
                                    } flex-1 p-1 text-sm bg-transparent`}
                                  />

                                  {/* Icons (hidden until hover) */}
                                  <div
                                    className={`flex items-center gap-3 transition-opacity duration-200
                                        opacity-0 group-hover:opacity-100
                                        ${
                                          theme === "dark"
                                            ? "text-neutral-300"
                                            : "text-neutral-600"
                                        }
                                      `}
                                  >
                                    <button
                                      onClick={() =>
                                        window.open(
                                          assetUrl(stage?.file?.file_path),
                                          "_blank",
                                        )
                                      }
                                    >
                                      <Eye size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        const url = assetUrl(stage?.file?.file_path);
                                        const link =
                                          document.createElement("a");
                                        link.href = url;
                                        link.setAttribute(
                                          "download",
                                          stage?.file?.file_name || "file",
                                        );
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }}
                                    >
                                      <Download size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* Delete (always visible in edit mode) */}
                                {isEditMode && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteDocument(stage?.file?.id);
                                      handleRemoveDocumentBlock(index);
                                    }}
                                    className="text-red-500 hover:text-red-600"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                    {!isEditMode &&
                      !patentState?.documents?.some((item: any) => item?.file) && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          No documents attached.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`col-span-2 ${
                  theme === "dark" ? "border-[#cccccc20] bg-neutral-900/50" : ""
                }`}
              >
                <CardHeader
                  className={`${
                    theme === "light" ? "bg-gray-50/5" : ""
                  } rounded-t-xl`}
                >
                  <CardTitle
                    className={`${
                      theme === "dark" && "text-neutral-100"
                    } flex items-center gap-2 font-sans text-[15px] font-semibold`}
                  >
                    <Calendar size={17} className="text-[var(--pulse-ink-muted)]" /> Status and
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid lg:grid-cols-2 grid-cols-1 gap-5">
                  <div className="flex flex-wrap gap-4 patent-timeline-boxes">
                    <div className="flex items-center justify-between">
                      <div
                        className={`${
                          theme === "dark"
                            ? "text-neutral-500"
                            : "text-neutral-600"
                        } font-sans text-sm font-medium`}
                      >
                        Status
                      </div>
                      {isEditMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddTimeline}
                          disabled={hasTimelineValidationErrors()}
                          className={`bg-transparent font-medium font-sans ${
                            theme === "dark"
                              ? "border-[#cccccc20] text-neutral-400 hover:bg-white/5 hover:text-neutral-300"
                              : ""
                          } flex items-center gap-2`}
                          title={
                            hasTimelineValidationErrors()
                              ? "Please fix validation errors before adding new status"
                              : ""
                          }
                        >
                          <Plus size={14} />
                          Add
                        </Button>
                      )}
                    </div>
                    {patentState?.status_timeline_history?.map(
                      (stage: any, index: number) => (
                        <div
                          key={index}
                          className={`flex-1 min-w-[200px] pb-3 ${
                            theme === "dark" && "border-[#cccccc20]"
                          } ${
                            index <
                              patentState?.status_timeline_history?.length -
                                1 && "border-b"
                          }`}
                        >
                          <div
                            className={`${
                              isEditMode
                                ? "grid grid-cols-4"
                                : "flex items-center justify-between"
                            } gap-3 w-full`}
                          >
                            <div className="flex items-center gap-2 col-span-2">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={stage.status_name || ""}
                                  onChange={(e) =>
                                    handleTimelineChange(
                                      index,
                                      "status_name",
                                      e.target.value,
                                    )
                                  }
                                  className={`${
                                    theme === "dark"
                                      ? "bg-black text-neutral-300 border-[#cccccc50]"
                                      : ""
                                  } p-1.5 px-2 border rounded-md text-sm w-full`}
                                  placeholder="Enter status name"
                                />
                              ) : (
                                <p
                                  className={`${
                                    theme === "dark" && "text-neutral-300"
                                  } text-sm font-sans`}
                                >
                                  {stage.status_name}
                                </p>
                              )}
                            </div>

                            {isEditMode ? (
                              <div className="space-y-2 w-[220px]">
                                <input
                                  type="date"
                                  value={
                                    stage.status_date
                                      ? moment(stage.status_date).format(
                                          "YYYY-MM-DD",
                                        )
                                      : ""
                                  }
                                  onChange={(e) =>
                                    handleTimelineChange(
                                      index,
                                      "status_date",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={(e) =>
                                    validateTimelineDate(index, e.target.value)
                                  }
                                  className={`w-full p-1.5 px-2 border rounded-md text-sm ${
                                    theme === "dark"
                                      ? "bg-black text-neutral-300 border-[#cccccc50]"
                                      : ""
                                  } ${
                                    dateValidationErrors.timeline[index]
                                      ? "border-red-500 focus:ring-red-500"
                                      : "border-gray-300"
                                  }`}
                                />
                                {dateValidationErrors.timeline[index] && (
                                  <p className="text-red-500 text-xs mt-1">
                                    {dateValidationErrors.timeline[index]}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p
                                className={`text-xs font-sans ${
                                  theme === "dark"
                                    ? "text-neutral-500"
                                    : "text-neutral-500"
                                } ml-6`}
                              >
                                {stage.status_date
                                  ? moment(stage.status_date).format(
                                      "YYYY-MM-DD",
                                    )
                                  : "Pending"}
                              </p>
                            )}
                            {isEditMode && (
                              <div className="w-full flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="ml-auto h-6 w-6 p-0"
                                  onClick={() => handleRemoveTimeline(index)}
                                >
                                  <Trash2 size={14} className="text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 patent-timeline-boxes">
                    <div className="flex items-center justify-between">
                      <div
                        className={`${
                          theme === "dark"
                            ? "text-neutral-500"
                            : "text-neutral-600"
                        } font-sans text-sm font-medium`}
                      >
                        Events
                      </div>
                      {isEditMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddEvent}
                          disabled={hasEventValidationErrors()}
                          className={`bg-transparent font-medium font-sans ${
                            theme === "dark"
                              ? "border-[#cccccc20] text-neutral-400 hover:bg-white/5 hover:text-neutral-300"
                              : ""
                          } flex items-center gap-2`}
                          title={
                            hasTimelineValidationErrors()
                              ? "Please fix validation errors before adding new status"
                              : ""
                          }
                        >
                          <Plus size={14} />
                          Add
                        </Button>
                      )}
                    </div>
                    {patentState?.PatentEvents?.map(
                      (stage: any, index: number) => (
                        <div
                          key={index}
                          className={`flex-1 min-w-[200px] pb-3 ${
                            theme === "dark" && "border-[#cccccc20]"
                          } ${
                            index < patentState?.PatentEvents?.length - 1 &&
                            "border-b"
                          }`}
                        >
                          <div
                            className={`${
                              isEditMode
                                ? "grid grid-cols-4"
                                : "flex items-center justify-between"
                            } gap-3 w-full`}
                          >
                            <div className="flex items-center gap-2 col-span-2">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={stage.event_name || ""}
                                  onChange={(e) =>
                                    handleEventChange(
                                      index,
                                      "event_name",
                                      e.target.value,
                                    )
                                  }
                                  className={`${
                                    theme === "dark"
                                      ? "bg-black text-neutral-300 border-[#cccccc50]"
                                      : ""
                                  } p-1.5 px-2 border rounded-md text-sm w-full`}
                                  placeholder="Enter event name"
                                />
                              ) : (
                                <p
                                  className={`${
                                    theme === "dark" && "text-neutral-300"
                                  } text-sm font-sans`}
                                >
                                  {stage.event_name}
                                </p>
                              )}
                            </div>

                            {isEditMode ? (
                              <div className="space-y-2 w-[220px]">
                                <input
                                  type="date"
                                  value={
                                    stage.event_date
                                      ? moment(stage.event_date).format(
                                          "YYYY-MM-DD",
                                        )
                                      : ""
                                  }
                                  onChange={(e) =>
                                    handleEventChange(
                                      index,
                                      "event_date",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={(e) =>
                                    validateEventDate(index, e.target.value)
                                  }
                                  className={`w-full p-1.5 px-2 border rounded-md text-sm ${
                                    theme === "dark"
                                      ? "bg-black text-neutral-300 border-[#cccccc50]"
                                      : ""
                                  } ${
                                    dateValidationErrors.events[index]
                                      ? "border-red-500 focus:ring-red-500"
                                      : "border-gray-300"
                                  }`}
                                />
                                {dateValidationErrors.timeline[index] && (
                                  <p className="text-red-500 text-xs mt-1">
                                    {dateValidationErrors.events[index]}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p
                                className={`text-xs font-sans ${
                                  theme === "dark"
                                    ? "text-neutral-500"
                                    : "text-neutral-500"
                                } ml-6`}
                              >
                                {stage.event_date
                                  ? moment(stage.event_date).format(
                                      "YYYY-MM-DD",
                                    )
                                  : "Pending"}
                              </p>
                            )}
                            {isEditMode && (
                              <div className="w-full flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="ml-auto h-6 w-6 p-0"
                                  onClick={() => handleRemoveEvent(index)}
                                >
                                  <Trash2 size={14} className="text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                  {/* <Card className="border">
                        <CardContent className="p-4">
                          <h3 className="text-xs sm:text-sm font-semibold mb-3">
                            Next Steps
                          </h3>

                          <div className="space-y-3">
                            <div>
                              <h4 className="text-xs font-medium text-gray-700 mb-1">
                                From Photon Legal
                              </h4>
                              {isEditMode ? (
                                <textarea
                                  value={patentState.next_steps_legal || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "next_steps_legal",
                                      e.target.value
                                    )
                                  }
                                  className="w-full p-2 border rounded-md text-sm"
                                  rows={3}
                                />
                              ) : (
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  {patentState?.next_steps_legal || "-"}
                                </p>
                              )}
                            </div>

                            <Separator className="my-2" />

                            <div>
                              <h4 className="text-xs font-medium text-gray-700 mb-1">
                                From GPO
                              </h4>
                              {isEditMode ? (
                                <textarea
                                  value={patentState.next_steps_gpo || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "next_steps_gpo",
                                      e.target.value
                                    )
                                  }
                                  className="w-full p-2 border rounded-md text-sm"
                                  rows={3}
                                />
                              ) : (
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  {patentState.next_steps_gpo || "-"}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card> */}

                  {/* <Card className="border shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base sm:text-lg">
                            Documents
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground">
                            Patent documentation and related files
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          {isEditMode && (
                            <div className="mb-4">
                              <Label
                                htmlFor="file-upload"
                                className="text-sm font-medium"
                              >
                                Upload New Document
                              </Label>
                              <div className="mt-2">
                                <Input
                                  id="file-upload"
                                  name="file-upload"
                                  type="file"
                                  multiple
                                  onChange={handleFileUpload}
                                  disabled={isUploadingFile}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          )}
                          <div className="space-y-2">
                            {[...newUploadedFiles, ...localDocuments]?.map(
                              (doc: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex justify-between items-center p-2.5 rounded-md border border-gray-100 bg-gray-50/50 hover:bg-gray-100/60 transition-colors group"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/5 text-photon-light">
                                      {doc?.file_path ? (
                                        <img
                                          src={assetUrl(doc?.file_path)}
                                          alt={doc?.original_name}
                                          className="w-full h-full object-cover rounded-md"
                                          onError={(e) => {
                                            // Fallback to FileText icon if image fails to load
                                            e.currentTarget.style.display =
                                              "none";
                                            e.currentTarget.parentElement
                                              ?.querySelector(".file-icon")
                                              ?.classList.remove("hidden");
                                          }}
                                        />
                                      ) : (
                                        <FileText
                                          size={isMobile ? 14 : 16}
                                          className="text-gray-600 file-icon"
                                        />
                                      )}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs sm:text-sm font-medium text-gray-800">
                                        {doc?.original_name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {doc.type} • Added{" "}
                                        {moment(doc.createdAt).format(
                                          "DD-MM-YYYY"
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 opacity-70 hover:opacity-100 hover:bg-white/80 rounded-md"
                                      title="View Document"
                                      onClick={() =>
                                        window.open(
                                          assetUrl(doc?.file_path),
                                          "_blank"
                                        )
                                      }
                                    >
                                      <Eye
                                        size={isMobile ? 14 : 16}
                                        className="text-gray-600"
                                      />
                                    </Button>
                                    <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 opacity-70 hover:opacity-100 hover:bg-white/80 rounded-md"
                                    title="Download Document"
                                    onClick={() => {
                                      const link = document.createElement("a");
                                      link.href = assetUrl(doc?.file_path);
                                      link.setAttribute("download", doc?.original_name || "document");
                                      link.setAttribute("target", "_blank");
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                  >
                                    <Download
                                      size={isMobile ? 14 : 16}
                                      className="text-gray-600"
                                    />
                                  </Button>
                                    {isEditMode && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 opacity-70 hover:opacity-100 hover:bg-white/80 rounded-md"
                                        title="Delete Document"
                                        onClick={() =>
                                          handleDeleteDocument(doc?.id)
                                        }
                                      >
                                        <Trash2
                                          size={isMobile ? 14 : 16}
                                          className="text-red-500"
                                        />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </CardContent>
                      </Card> */}
                </CardContent>
              </Card>
            </div>

            <Card
              className={`col-span-2 mb-2 ${
                theme === "dark" ? "border-[#cccccc20] bg-neutral-900/50" : ""
              }`}
            >
              <CardHeader
                className={`${
                  theme === "light" ? "bg-gray-50/5" : ""
                } rounded-t-xl`}
              >
                <CardTitle
                  className={`${
                    theme === "dark" && "text-neutral-100"
                  } flex items-center gap-2 font-sans text-[15px] font-semibold`}
                >
                  <ClipboardList size={17} className="text-[var(--pulse-ink-muted)]" /> Next
                  Steps
                </CardTitle>
              </CardHeader>
              <CardContent className="grid lg:grid-cols-2 grid-cols-1 gap-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="mb-2 text-sm font-medium text-neutral-500">
                      Next steps from Photon Legal
                    </p>

                    {isEditMode && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAddLegalStep}
                        className={`bg-transparent font-medium font-sans ${
                          theme === "dark"
                            ? "border-[#cccccc20] text-neutral-400 hover:bg-white/5 hover:text-neutral-300"
                            : ""
                        } flex items-center gap-2`}
                      >
                        <Plus size={14} /> Add
                      </Button>
                    )}
                  </div>

                  {patentState?.next_steps_legal?.map(
                    (step: any, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        {isEditMode ? (
                          <input
                            name="step_legal"
                            value={step}
                            onChange={(e) =>
                              handleLegalStepChange(index, e.target.value)
                            }
                            placeholder="Enter next step"
                            className={`${
                              theme === "dark"
                                ? "bg-black text-neutral-300 border-[#cccccc50]"
                                : ""
                            } p-1.5 px-2 border rounded-md text-sm w-full`}
                          />
                        ) : (
                          <p className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 font-sans flex items-center gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full text-[#F9B418] bg-[#F9B418]/20 flex items-center justify-center">
                              {index + 1}
                            </span>
                            {step}
                          </p>
                        )}

                        {isEditMode && (
                          <button
                            onClick={() => handleRemoveLegalStep(index)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ),
                  )}
                  {!isEditMode &&
                    !patentState?.next_steps_legal?.some(Boolean) && (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        No next steps recorded.
                      </p>
                    )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="mb-2 text-sm font-medium text-neutral-500">
                      Next steps from patent office
                    </p>

                    {isEditMode && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAddGpoStep}
                        className={`bg-transparent font-medium font-sans ${
                          theme === "dark"
                            ? "border-[#cccccc20] text-neutral-400 hover:bg-white/5 hover:text-neutral-300"
                            : ""
                        } flex items-center gap-2`}
                      >
                        <Plus size={14} /> Add
                      </Button>
                    )}
                  </div>

                  {patentState?.next_steps_gpo?.map(
                    (step: any, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        {isEditMode ? (
                          <input
                            name="step_gpo"
                            value={step}
                            onChange={(e) =>
                              handleGpoStepChange(index, e.target.value)
                            }
                            placeholder="Enter next step"
                            className={`${
                              theme === "dark"
                                ? "bg-black text-neutral-300 border-[#cccccc50]"
                                : ""
                            } p-1.5 px-2 border rounded-md text-sm w-full`}
                          />
                        ) : (
                          <p className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 flex items-center gap-3 font-sans">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full text-blue-500 bg-blue-500/20 flex items-center justify-center">
                              {index + 1}
                            </span>{" "}
                            {step}
                          </p>
                        )}

                        {isEditMode && (
                          <button
                            onClick={() => handleRemoveGpoStep(index)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ),
                  )}
                  {!isEditMode &&
                    !patentState?.next_steps_gpo?.some(Boolean) && (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        No next steps recorded.
                      </p>
                    )}
                </div>
              </CardContent>
            </Card>

            <Card
              className={`mt-7 ${
                theme === "dark" ? "border-[#cccccc20] bg-neutral-900/50" : ""
              }`}
            >
              <CardHeader
                className={`${
                  theme === "light" ? "bg-gray-50/5" : ""
                } rounded-t-xl`}
              >
                <CardTitle
                  className={`${
                    theme === "dark" && "text-neutral-100"
                  } flex items-center gap-2 font-sans text-[15px] font-semibold`}
                >
                  <FileEditIcon size={17} className="text-[var(--pulse-ink-muted)]" />{" "}
                  Additional Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditMode ? (
                  <Textarea
                    value={patentState.additional_notes || ""}
                    onChange={(e) =>
                      handleInputChange("additional_notes", e.target.value)
                    }
                    className={`${
                      theme === "dark"
                        ? "bg-black text-neutral-400 border-[#cccccc50]"
                        : "bg-transparent"
                    } w-full p-2 border rounded-md text-sm`}
                    rows={4}
                    placeholder="Enter additional notes"
                  />
                ) : (
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 font-sans mt-2">
                    {patentState.additional_notes || "No additional notes."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatentDetailsContent;
