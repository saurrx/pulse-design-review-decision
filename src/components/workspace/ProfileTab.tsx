import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload,
  IdCard,
  Mail,
  User,
  Phone,
  MapPin,
  Pencil,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import Cookies from "js-cookie";
import { useMutation } from "@tanstack/react-query";
import {
  useFileUpload,
  useUserCookieUpdate,
} from "@/lib/api-service/commonApi.service";
import { useTheme } from "@/hooks/useTheme";
import { MAX_FILE_SIZE } from "@/utils/constants";

type ProfileTabProps = {
  clientDetails: any;
  isEditMode?: boolean;
  setIsEditMode?: (value: boolean) => void;
  saveProfileRef?: React.MutableRefObject<(() => void) | null>;
  cancelProfileRef?: React.MutableRefObject<(() => void) | null>;
};

// Country data with flags, phone codes, and validation patterns
// Note: Some country codes are shared (e.g., +1 for US/Canada, +7 for Russia/Kazakhstan)
// This is handled by using "country_code|countryName" as unique keys in Select component
const countries = [
  {
    name: "India",
    flag: "🇮🇳",
    code: "+91",
    pattern: /^[6-9]\d{9}$/,
    placeholder: "9876543210",
    example: "10 digits starting with 6-9",
  },
  {
    name: "United States",
    flag: "🇺🇸",
    code: "+1",
    pattern: /^\d{10}$/,
    placeholder: "2025551234",
    example: "10 digits (US format)",
  },
  {
    name: "Canada",
    flag: "🇨🇦",
    code: "+1",
    pattern: /^\d{10}$/,
    placeholder: "4165551234",
    example: "10 digits (Canada format)",
  },
  {
    name: "United Kingdom",
    flag: "🇬🇧",
    code: "+44",
    pattern: /^7\d{9}$/,
    placeholder: "7123456789",
    example: "10 digits starting with 7",
  },
  {
    name: "Australia",
    flag: "🇦🇺",
    code: "+61",
    pattern: /^4\d{8}$/,
    placeholder: "412345678",
    example: "9 digits starting with 4",
  },
  {
    name: "Germany",
    flag: "🇩🇪",
    code: "+49",
    pattern: /^1[5-7]\d{8,9}$/,
    placeholder: "15123456789",
    example: "10-11 digits starting with 15-17",
  },
  {
    name: "France",
    flag: "🇫🇷",
    code: "+33",
    pattern: /^[67]\d{8}$/,
    placeholder: "612345678",
    example: "9 digits starting with 6 or 7",
  },
  {
    name: "Japan",
    flag: "🇯🇵",
    code: "+81",
    pattern: /^[789]0\d{8}$/,
    placeholder: "9012345678",
    example: "10 digits starting with 70, 80, or 90",
  },
  {
    name: "China",
    flag: "🇨🇳",
    code: "+86",
    pattern: /^1[3-9]\d{9}$/,
    placeholder: "13123456789",
    example: "11 digits starting with 13-19",
  },
  {
    name: "Brazil",
    flag: "🇧🇷",
    code: "+55",
    pattern: /^[1-9]\d{10}$/,
    placeholder: "11987654321",
    example: "11 digits",
  },
  {
    name: "Mexico",
    flag: "🇲🇽",
    code: "+52",
    pattern: /^[1-9]\d{9}$/,
    placeholder: "5512345678",
    example: "10 digits",
  },
  {
    name: "Russia",
    flag: "🇷🇺",
    code: "+7",
    pattern: /^9\d{9}$/,
    placeholder: "9123456789",
    example: "10 digits starting with 9",
  },
  {
    name: "Kazakhstan",
    flag: "🇰🇿",
    code: "+7",
    pattern: /^7\d{9}$/,
    placeholder: "7012345678",
    example: "10 digits starting with 7",
  },
  {
    name: "South Korea",
    flag: "🇰🇷",
    code: "+82",
    pattern: /^1[0-9]\d{8}$/,
    placeholder: "1012345678",
    example: "10 digits starting with 10-19",
  },
  {
    name: "Italy",
    flag: "🇮🇹",
    code: "+39",
    pattern: /^3\d{9}$/,
    placeholder: "3123456789",
    example: "10 digits starting with 3",
  },
  {
    name: "Spain",
    flag: "🇪🇸",
    code: "+34",
    pattern: /^[67]\d{8}$/,
    placeholder: "612345678",
    example: "9 digits starting with 6 or 7",
  },
  {
    name: "Netherlands",
    flag: "🇳🇱",
    code: "+31",
    pattern: /^6\d{8}$/,
    placeholder: "612345678",
    example: "9 digits starting with 6",
  },
  {
    name: "Belgium",
    flag: "🇧🇪",
    code: "+32",
    pattern: /^4\d{8}$/,
    placeholder: "412345678",
    example: "9 digits starting with 4",
  },
  {
    name: "Switzerland",
    flag: "🇨🇭",
    code: "+41",
    pattern: /^7[56789]\d{7}$/,
    placeholder: "781234567",
    example: "9 digits starting with 75-79",
  },
  {
    name: "Austria",
    flag: "🇦🇹",
    code: "+43",
    pattern: /^6\d{8,10}$/,
    placeholder: "6612345678",
    example: "9-11 digits starting with 6",
  },
  {
    name: "Sweden",
    flag: "🇸🇪",
    code: "+46",
    pattern: /^7[02-9]\d{7}$/,
    placeholder: "701234567",
    example: "9 digits starting with 70, 72-79",
  },
  {
    name: "Norway",
    flag: "🇳🇴",
    code: "+47",
    pattern: /^[49]\d{7}$/,
    placeholder: "41234567",
    example: "8 digits starting with 4 or 9",
  },
  {
    name: "Denmark",
    flag: "🇩🇰",
    code: "+45",
    pattern: /^[2-9]\d{7}$/,
    placeholder: "21234567",
    example: "8 digits starting with 2-9",
  },
  {
    name: "Finland",
    flag: "🇫🇮",
    code: "+358",
    pattern: /^4\d{7,9}$/,
    placeholder: "401234567",
    example: "8-10 digits starting with 4",
  },
  {
    name: "Poland",
    flag: "🇵🇱",
    code: "+48",
    pattern: /^[5-9]\d{8}$/,
    placeholder: "512345678",
    example: "9 digits starting with 5-9",
  },
  {
    name: "Turkey",
    flag: "🇹🇷",
    code: "+90",
    pattern: /^5\d{9}$/,
    placeholder: "5123456789",
    example: "10 digits starting with 5",
  },
  {
    name: "South Africa",
    flag: "🇿🇦",
    code: "+27",
    pattern: /^[67]\d{8}$/,
    placeholder: "612345678",
    example: "9 digits starting with 6 or 7",
  },
  {
    name: "Egypt",
    flag: "🇪🇬",
    code: "+20",
    pattern: /^1[0-9]\d{8}$/,
    placeholder: "1012345678",
    example: "10 digits starting with 10-19",
  },
  {
    name: "Nigeria",
    flag: "🇳🇬",
    code: "+234",
    pattern: /^[789]\d{9}$/,
    placeholder: "8123456789",
    example: "10 digits starting with 7, 8, or 9",
  },
  {
    name: "Kenya",
    flag: "🇰🇪",
    code: "+254",
    pattern: /^7\d{8}$/,
    placeholder: "712345678",
    example: "9 digits starting with 7",
  },
  {
    name: "UAE",
    flag: "🇦🇪",
    code: "+971",
    pattern: /^5[024-9]\d{7}$/,
    placeholder: "501234567",
    example: "9 digits starting with 50, 52-59",
  },
  {
    name: "Saudi Arabia",
    flag: "🇸🇦",
    code: "+966",
    pattern: /^5\d{8}$/,
    placeholder: "512345678",
    example: "9 digits starting with 5",
  },
  {
    name: "Israel",
    flag: "🇮🇱",
    code: "+972",
    pattern: /^5[0-9]\d{7}$/,
    placeholder: "501234567",
    example: "9 digits starting with 5",
  },
  {
    name: "Singapore",
    flag: "🇸🇬",
    code: "+65",
    pattern: /^[89]\d{7}$/,
    placeholder: "81234567",
    example: "8 digits starting with 8 or 9",
  },
  {
    name: "Malaysia",
    flag: "🇲🇾",
    code: "+60",
    pattern: /^1[0-9]\d{7,8}$/,
    placeholder: "1012345678",
    example: "9-10 digits starting with 10-19",
  },
  {
    name: "Thailand",
    flag: "🇹🇭",
    code: "+66",
    pattern: /^[689]\d{8}$/,
    placeholder: "612345678",
    example: "9 digits starting with 6, 8, or 9",
  },
  {
    name: "Philippines",
    flag: "🇵🇭",
    code: "+63",
    pattern: /^9\d{9}$/,
    placeholder: "9123456789",
    example: "10 digits starting with 9",
  },
  {
    name: "Indonesia",
    flag: "🇮🇩",
    code: "+62",
    pattern: /^8\d{8,11}$/,
    placeholder: "81234567890",
    example: "9-12 digits starting with 8",
  },
  {
    name: "Vietnam",
    flag: "🇻🇳",
    code: "+84",
    pattern: /^[39]\d{8}$/,
    placeholder: "312345678",
    example: "9 digits starting with 3 or 9",
  },
  {
    name: "Bangladesh",
    flag: "🇧🇩",
    code: "+880",
    pattern: /^1[3-9]\d{8}$/,
    placeholder: "1312345678",
    example: "10 digits starting with 13-19",
  },
  {
    name: "Pakistan",
    flag: "🇵🇰",
    code: "+92",
    pattern: /^3\d{9}$/,
    placeholder: "3123456789",
    example: "10 digits starting with 3",
  },
  {
    name: "Sri Lanka",
    flag: "🇱🇰",
    code: "+94",
    pattern: /^7[01245678]\d{7}$/,
    placeholder: "701234567",
    example: "9 digits starting with 70-78 (except 73, 79)",
  },
  {
    name: "New Zealand",
    flag: "🇳🇿",
    code: "+64",
    pattern: /^2[0-9]\d{7,8}$/,
    placeholder: "201234567",
    example: "9-10 digits starting with 20-29",
  },
  {
    name: "Argentina",
    flag: "🇦🇷",
    code: "+54",
    pattern: /^9\d{8,10}$/,
    placeholder: "91123456789",
    example: "9-11 digits starting with 9",
  },
  {
    name: "Chile",
    flag: "🇨🇱",
    code: "+56",
    pattern: /^[89]\d{8}$/,
    placeholder: "812345678",
    example: "9 digits starting with 8 or 9",
  },
  {
    name: "Colombia",
    flag: "🇨🇴",
    code: "+57",
    pattern: /^3\d{9}$/,
    placeholder: "3123456789",
    example: "10 digits starting with 3",
  },
  {
    name: "Peru",
    flag: "🇵🇪",
    code: "+51",
    pattern: /^9\d{8}$/,
    placeholder: "912345678",
    example: "9 digits starting with 9",
  },
  {
    name: "Venezuela",
    flag: "🇻🇪",
    code: "+58",
    pattern: /^4\d{9}$/,
    placeholder: "4123456789",
    example: "10 digits starting with 4",
  },
];

// Create a schema for form validation
const profileFormSchema = z.object({
  employeeId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  country_code: z.string().default("+91"),
  country_name: z.string().optional(),
  address: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema> & {
  profile_image?: string;
};

const ProfileTab: React.FC<ProfileTabProps> = ({
  clientDetails,
  isEditMode = false,
  setIsEditMode,
  saveProfileRef,
  cancelProfileRef,
}) => {
  const { theme } = useTheme();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [updatedProfileImage, setUpdatedProfileImage] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]); // Default to India
  const [originalFormValues, setOriginalFormValues] =
    useState<ProfileFormValues | null>(null);

  const {
    data: fileUploadData,
    mutate: fileUploadMutate,
  } = useFileUpload();

  const { mutate: userCookieUpdate } = useUserCookieUpdate();

  const { mutate: userUpdateMutation } = useMutation({
    mutationKey: ["update_profile", currentUser?.id],
    // employeeId is deliberately stripped before submit (see the destructure
    // in the handler) because it is not user-editable, so the update payload is
    // ProfileFormValues WITHOUT it. The mutation asked for the full type and
    // could therefore never be called correctly.
    mutationFn: async (data: Omit<ProfileFormValues, "employeeId">) => {
      try {
        const response = await API_CONFIG.put(
          `/api/v1/auth/update-profile/${currentUser?.id}`,
          data
        );

        if (response.status === 200) {
          toast.success("Profile updated successfully");
          userCookieUpdate();
        }
      } catch (error) {
        console.error("Error updating profile:", error);
        toast.error(error?.response?.data?.message || "Error updating profile");
      }
    },
  });

  useEffect(() => {
    if (fileUploadData?.data?.[0]?.file_path) {
      setUpdatedProfileImage(fileUploadData.data[0]);
    }
  }, [fileUploadData]);

  // Define form with default values
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      employeeId: "",
      email: "",
      name: "",
      phone: "",
      country_code: "+91",
      country_name: "India",
      address: "",
    },
  });

  useEffect(() => {
    // fetch user deatils from cookies
    const rawUser = Cookies.get("pl_user");
      const present_user = rawUser ? JSON.parse(rawUser) : null;
    if (present_user) {
      const latestUserdata =
        clientDetails?.User?.find((e: any) => e?.id === present_user?.id) ||
        present_user;
      if (latestUserdata) {
        setCurrentUser(latestUserdata);
        
        // Set selected country based on country code and name - prefer name if available
        const country_code = latestUserdata?.country_code || "+91";
        const country_name = latestUserdata?.country_name;
        let country: (typeof countries)[number] | undefined;
        
        if (country_name) {
          // If country_name exists, use it to find the exact country
          country = countries.find(
            (c) => c.code === country_code && c.name === country_name
          );
        }
        
        // Fallback to first match by code if name match not found
        if (!country) {
          country = countries.find((c) => c.code === country_code);
        }
        
        if (!country) {
          country = countries[0]; // Default to India
        }
        
        setSelectedCountry(country);
        
        const originalValues = {
          employeeId: latestUserdata?.employeeId || latestUserdata?.id,
          email: latestUserdata?.email,
          name: latestUserdata?.name || "",
          phone: latestUserdata?.phone || "",
          country_code: country.code,
          country_name: country.name,
          address: latestUserdata?.address || "",
        };

        // Store original values for cancel functionality
        setOriginalFormValues(originalValues);

        form.setValue("employeeId", originalValues.employeeId);
        form.setValue("email", originalValues.email);
        form.setValue("name", originalValues.name);
        form.setValue("phone", originalValues.phone);
        form.setValue("country_code", originalValues.country_code);
        form.setValue("country_name", originalValues.country_name);
        form.setValue("address", originalValues.address);
      }
    }
  }, []);

  const onSubmit = (data: ProfileFormValues) => {
    const { employeeId, ...payload } = data;
    // Add profile_image to payload if updatedProfileImage exists
    if (updatedProfileImage?.id) {
      payload.profile_image = updatedProfileImage.id;
    }

    // Validate phone number based on selected country
    if (payload.phone && payload.phone.trim()) {
      const cleanedPhone = payload.phone.replace(/\D/g, ""); // Remove all non-digits
      const isValid = selectedCountry.pattern.test(cleanedPhone);
      if (!isValid) {
        toast.error(
          `Invalid phone number format for ${selectedCountry.name}. ${selectedCountry.example}`
        );
        form.setError("phone", {
          type: "manual",
          message: `Invalid format. ${selectedCountry.example}`,
        });
        return;
      }
    }

    userUpdateMutation(payload);
  };

  // Expose a save handler so the parent "Save" button can trigger this form submit
  useEffect(() => {
    if (saveProfileRef) {
      saveProfileRef.current = () => {
        form.handleSubmit(onSubmit)();
      };
    }
  }, [saveProfileRef, form, onSubmit]);

  // Expose a cancel handler so the parent "Cancel" button can reset name, phone, address, and profile picture
  useEffect(() => {
    if (cancelProfileRef && originalFormValues) {
      cancelProfileRef.current = () => {
        // Reset form fields back to original values
        form.reset({
          ...originalFormValues,
        });

        // Reset selected country back to original
        const country_code = originalFormValues.country_code || "+91";
        const country_name = originalFormValues.country_name;
        let country: (typeof countries)[number] | undefined;
        
        if (country_name) {
          country = countries.find(
            (c) => c.code === country_code && c.name === country_name
          );
        }
        
        if (!country) {
          country = countries.find((c) => c.code === country_code);
        }
        
        if (country) {
          setSelectedCountry(country);
        }

        // Reset profile picture back to original by clearing updatedProfileImage
        setUpdatedProfileImage(null);
      };
    }
  }, [cancelProfileRef, form, originalFormValues]);

  const handleCountryChange = (value: string) => {
    // Value format: "country_code|countryName" for unique identification
    const [country_code, countryName] = value.split("|");
    
    const country = countries.find(
      (c) => c.code === country_code && c.name === countryName
    );
    if (country) {
      setSelectedCountry(country);
      form.setValue("country_code", country_code);
      form.setValue("country_name", countryName);
      // Clear phone number when country changes to avoid confusion
      form.setValue("phone", "");
      // Clear any phone validation errors
      form.clearErrors("phone");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size >= MAX_FILE_SIZE) {
        toast.error("File must be less than 1GB");
        return;
      }
      fileUploadMutate({ file, category: "image" });
    }
  };

  const profileImagePath =
    updatedProfileImage?.file_path || currentUser?.profile_image_file?.file_path;
  const initials = (currentUser?.name || currentUser?.email || "User")
    .split(/\s+/)
    .map((part: string) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleLabel =
    currentUser?.role === "PHOTON_ADMIN"
      ? "Photon Legal admin"
      : currentUser?.role === "CASE_OWNER"
        ? "Case Owner"
        : currentUser?.role === "LEGAL_COUNSEL"
          ? "In-house counsel"
          : currentUser?.role === "TECH_COMMITTEE"
            ? "IP Committee"
            : "Inventor";

  if (!isEditMode) {
    const details = [
      { label: "Employee ID", value: form.getValues("employeeId") || "—", icon: IdCard },
      { label: "Email", value: form.getValues("email") || "—", icon: Mail },
      {
        label: "Phone",
        value: form.getValues("phone")
          ? `${selectedCountry.code} ${form.getValues("phone")}`
          : "—",
        icon: Phone,
      },
      { label: "Role", value: roleLabel, icon: User },
    ];

    return (
      <section
        className={`mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border shadow-sm ${currentUser?.role === "INVENTOR" || currentUser?.role === "CASE_OWNER" ? "mt-0" : "mt-5"} ${
          theme === "dark"
            ? "border-white/10 bg-white/5"
            : "border-neutral-200 bg-white"
        }`}
      >
        <div
          className={`flex flex-col gap-5 border-b px-6 py-6 sm:flex-row sm:items-center sm:justify-between ${
            theme === "dark" ? "border-white/10" : "border-neutral-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F9B418]/20 text-xl font-bold text-amber-700 ring-4 ring-[#F9B418]/10">
              {profileImagePath ? (
                <img
                  src={assetUrl(profileImagePath)}
                  alt={currentUser?.name || "Profile"}
                  crossOrigin="use-credentials"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <h2 className={`font-sans text-xl font-bold ${theme === "dark" ? "text-neutral-100" : "text-neutral-900"}`}>
                {currentUser?.name || "Your profile"}
              </h2>
              <p className={`mt-1 text-sm ${theme === "dark" ? "text-neutral-400" : "text-neutral-500"}`}>
                {roleLabel} · {currentUser?.organization_name || clientDetails?.name || "Workspace"}
              </p>
              <p className={`mt-0.5 text-sm ${theme === "dark" ? "text-neutral-500" : "text-neutral-500"}`}>
                {currentUser?.email}
              </p>
            </div>
          </div>
          {currentUser?.role === "PHOTON_ADMIN" && <button
            onClick={() => setIsEditMode?.(true)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
              theme === "dark"
                ? "border-white/10 text-neutral-300 hover:border-[#F9B418]/50 hover:text-[#F9B418]"
                : "border-neutral-200 text-neutral-700 hover:border-[#F9B418] hover:text-amber-700"
            }`}
          >
            <Pencil className="h-4 w-4" /> Edit profile
          </button>}
        </div>

        <div className="grid gap-x-10 sm:grid-cols-2">
          {details.map(({ label, value, icon: Icon }, index) => (
            <div
              key={label}
              className={`px-6 py-5 ${
                theme === "dark" ? "border-white/10" : "border-neutral-100"
              } ${index < 2 ? "border-b" : ""}`}
            >
              <div className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${theme === "dark" ? "text-neutral-500" : "text-neutral-500"}`}>
                <Icon className="h-4 w-4" /> {label}
              </div>
              <p className={`text-sm font-medium ${theme === "dark" ? "text-neutral-200" : "text-neutral-900"}`}>{value}</p>
            </div>
          ))}
          <div className={`border-t px-6 py-5 sm:col-span-2 ${theme === "dark" ? "border-white/10" : "border-neutral-100"}`}>
            <div className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${theme === "dark" ? "text-neutral-500" : "text-neutral-500"}`}>
              <MapPin className="h-4 w-4" /> Address
            </div>
            <p className={`text-sm font-medium ${theme === "dark" ? "text-neutral-200" : "text-neutral-900"}`}>
              {form.getValues("address") || "—"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      className={`mx-auto mt-5 w-full max-w-4xl rounded-2xl border p-6 backdrop-blur-xl ${
        theme === "dark"
          ? "bg-white/5 border-white/10"
          : "bg-white/80 border-neutral-200"
      }`}
    >
      <h3
        className={` font-sans font-bold text-sm uppercase tracking-wider mb-6 ${
          theme === "dark" ? "text-neutral-400" : "text-neutral-600"
        }`}
      >
        Personal Information
      </h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Profile Picture Upload - Centered */}
          <div className="mb-8 flex justify-start">
            <div className="relative">
              <div
                className={`w-32 h-32 rounded-full overflow-hidden border-2 ${
                  theme === "dark" ? "border-white/10" : "border-neutral-200"
                }`}
              >
                {profileImagePath ? (
                  <img
                    src={assetUrl(profileImagePath)}
                    alt={currentUser?.name || "Profile"}
                    crossOrigin="use-credentials"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#F9B418]/20 text-2xl font-bold text-amber-700">{initials}</div>
                )}
              </div>
              {isEditMode && (
                <>
                  <Label
                    htmlFor="picture"
                    className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#F9B418] flex items-center justify-center cursor-pointer hover:bg-[#F9B418]/90 transition-colors shadow-lg"
                  >
                    <Upload className="w-5 h-5 text-black" />
                  </Label>
                  <Input
                    name="file"
                    id="picture"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid gap-6 font-sans md:grid-cols-2">
            {/* Employee ID */}
            <div>
              <label
                className={`items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-2 block ${
                  theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                }`}
              >
                <IdCard className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
                Employee ID
              </label>
              <div className="px-4 py-3 min-h-[44px] font-sans flex items-center rounded-md border dark:bg-white/5 dark:border-white/10 dark:text-neutral-400 bg-neutral-100 border-neutral-200 text-neutral-600">
                {form.getValues("employeeId")}
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                className={`items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-2 block ${
                  theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                }`}
              >
                <Mail className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
                Email ID
              </label>
              <div className="px-4 py-3 min-h-[44px] flex items-center rounded-md border dark:bg-white/5 dark:border-white/10 dark:text-neutral-400 bg-neutral-100 border-neutral-200 text-neutral-600">
                {form.getValues("email")}
              </div>
            </div>

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className={`items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-2 block ${
                      theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                    }`}
                  >
                    <User
                      className="w-4 h-4 inline mr-1.5"
                      aria-hidden="true"
                    />
                    Name
                  </FormLabel>
                  {isEditMode ? (
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your name here"
                        maxLength={100}
                        className={`px-4 py-3 min-h-[44px] rounded-md border ${
                          theme === "dark"
                            ? "bg-white/5 border-white/10 text-neutral-200"
                            : "bg-white border-neutral-200 text-neutral-800"
                        }`}
                      />
                    </FormControl>
                  ) : (
                    <div
                      className={`px-4 py-3 min-h-[44px] flex items-center rounded-md border ${
                        theme === "dark"
                          ? "bg-white/5 border-white/10 text-neutral-200"
                          : "bg-white border-neutral-200 text-neutral-800"
                      }`}
                    >
                      {form.getValues("name") || ""}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone Number */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className={`items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-2 block ${
                      theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                    }`}
                  >
                    <Phone
                      className="w-4 h-4 inline mr-1.5"
                      aria-hidden="true"
                    />
                    Phone Number
                  </FormLabel>
                  {isEditMode ? (
                    <>
                      <FormControl>
                        <div className="flex gap-2">
                          <Select
                            onValueChange={handleCountryChange}
                            value={`${selectedCountry.code}|${selectedCountry.name}`}
                          >
                            <SelectTrigger
                              className={`w-24 h-11 px-2 rounded-md border ${
                                theme === "dark"
                                  ? "bg-white/5 border-white/10 text-neutral-200"
                                  : "bg-white border-neutral-200 text-neutral-800"
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-lg leading-none">
                                  {selectedCountry.flag}
                                </span>
                                <span
                                  className={`text-xs font-sans ${
                                    theme === "dark"
                                      ? "text-white"
                                      : "text-neutral-500"
                                  }`}
                                >
                                  {selectedCountry.code}
                                </span>
                              </div>
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {countries.map((country) => (
                                <SelectItem
                                  key={`${country.code}|${country.name}`}
                                  value={`${country.code}|${country.name}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">
                                      {country.flag}
                                    </span>
                                    <span
                                      className={`text-xs ${
                                        theme === "dark"
                                          ? "text-white"
                                          : "text-neutral-500"
                                      }`}
                                    >
                                      {country.code}
                                    </span>
                                    <span
                                      className={`text-xs ${
                                        theme === "dark"
                                          ? "text-white"
                                          : "text-neutral-700"
                                      }`}
                                    >
                                      {country.name}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            {...field}
                            className={`flex-1 h-11 px-4 rounded-md border ${
                              theme === "dark"
                                ? "bg-white/5 border-white/10 text-neutral-200"
                                : "bg-white border-neutral-200 text-neutral-800"
                            }`}
                            onChange={(e) => {
                              // Remove any non-numeric characters
                              const value = e.target.value.replace(
                                /[^\d]/g,
                                ""
                              );
                              field.onChange(value);

                              // Real-time validation
                              if (
                                value &&
                                !selectedCountry.pattern.test(value)
                              ) {
                                form.setError("phone", {
                                  type: "manual",
                                  message: `Invalid format. ${selectedCountry.example}`,
                                });
                              } else {
                                form.clearErrors("phone");
                              }
                            }}
                          />
                        </div>
                      </FormControl>
                      <div
                        className={`text-xs mt-1 ${
                          theme === "dark"
                            ? "text-neutral-500"
                            : "text-gray-500"
                        }`}
                      >
                        Format: {selectedCountry.example}
                      </div>
                    </>
                  ) : (
                    <div
                      className={`px-4 py-3 min-h-[44px] flex items-center rounded-md border ${
                        theme === "dark"
                          ? "bg-white/5 border-white/10 text-neutral-200"
                          : "bg-white border-neutral-200 text-neutral-800"
                      }`}
                    >
                      {form.getValues("phone")
                        ? `${selectedCountry.code} ${form.getValues("phone")}`
                        : ""}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Hidden fields for country code and name */}
            <FormField
              control={form.control}
              name="country_code"
              render={({ field }) => <input type="hidden" {...field} />}
            />
            <FormField
              control={form.control}
              name="country_name"
              render={({ field }) => <input type="hidden" {...field} />}
            />

            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel
                    className={`items-center gap-2 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-xs uppercase tracking-wider mb-2 block ${
                      theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                    }`}
                  >
                    <MapPin
                      className="w-4 h-4 inline mr-1.5"
                      aria-hidden="true"
                    />
                    Address
                  </FormLabel>
                  {isEditMode ? (
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter your address here"
                        rows={3}
                        maxLength={300}
                        className={`px-4 py-3 min-h-[44px] rounded-md border ${
                          theme === "dark"
                            ? "bg-white/5 border-white/10 text-neutral-200"
                            : "bg-white border-neutral-200 text-neutral-800"
                        }`}
                      />
                    </FormControl>
                  ) : (
                    <div
                      className={`px-4 py-3 min-h-[44px] flex items-center rounded-md border ${
                        theme === "dark"
                          ? "bg-white/5 border-white/10 text-neutral-200"
                          : "bg-white border-neutral-200 text-neutral-800"
                      }`}
                    >
                      {form.getValues("address") || ""}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Country */}
            {/* <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country of Residence</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {getCountryFlag(field.value)}
                        </span>
                        <SelectValue placeholder="Select your country" />
                      </div>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.name} value={country.name}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{country.flag}</span>
                          {country.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          /> */}
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ProfileTab;
