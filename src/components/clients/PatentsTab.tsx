import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import Loader from "../Loader";
import _ from "lodash";
import { FileSearch, FileText } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

// Define the completion status types
type CompletionStatus = "completed" | "partially_completed" | "incomplete";

// Extend the patent type to include completion status
interface Patent {
  id: number;
  applicationNumber: string;
  title: string;
  completionStatus: CompletionStatus;
}

const PatentsTab: React.FC = () => {
  const { theme } = useTheme();
  const { clientId } = useParams();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(30);

  const { isFetching: isFetchingPatents, data: patentData } = useQuery({
    queryKey: ["patents", clientId, currentPage, itemsPerPage],
    queryFn: async () => {
      const response = await API_CONFIG.get(
        `/api/v1/patent/fetch-all-patents/client/${clientId}?page=${currentPage}&limit=${itemsPerPage}`,
      );

      if (response.status === 200) {
        return response?.data;
      }
    },
    enabled: !!clientId,
    refetchOnMount: true,
  });

  const totalPatents =
    patentData?.pagination?.total || patentData?.data?.length || 0;

  return (
    <div
      className={`border rounded-md backdrop-blur-xl ${
        theme === "dark"
          ? "bg-neutral-900 border-[#cccccc20]"
          : "bg-white/80 border-neutral-200"
      }`}
    >
      <div
        className={`p-6 border-b ${
          theme === "dark" ? "border-[#cccccc20]" : "border-neutral-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2
              className={`text-lg mb-1 font-bold ${
                theme === "dark" ? "text-zinc-200" : "text-neutral-900"
              }`}
            >
              All Patents
            </h2>
            <p
              className={`text-sm 4 ${
                theme === "dark" ? "text-neutral-400" : "text-neutral-600"
              }`}
            >
              View all patents associated with this client
            </p>
          </div>
          <div className="text-right">
            <div className="text-[#F9B418] text-3xl font-bold">
              {totalPatents}
            </div>
            <div
              className={`text-xs uppercase tracking-wide mt-1 ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-600"
              }`}
            >
              Total Patents
            </div>
          </div>
        </div>
      </div>

      {isFetchingPatents ? (
        <Loader />
      ) : (
        <>
          {patentData?.data?.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center ${
                theme === "dark"
                  ? "bg-black/60 border-none"
                  : "border-gray-200 bg-white"
              } p-8 text-center shadow-sm h-full`}
            >
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full ${
                  theme === "dark" ? "bg-gray-500/20" : "bg-gray-100"
                }`}
              >
                <FileSearch
                  className={`h-10 w-10 ${
                    theme === "dark" ? "text-zinc-200" : "text-zinc-900"
                  }`}
                />
              </div>

              <h3
                className={`mt-6 text-xl font-semibold ${
                  theme === "dark" ? "text-zinc-200" : "text-zinc-900"
                }`}
              >
                No Patent Found
              </h3>

              <p className="mt-3 max-w-md text-gray-600 text-center">
                We couldn't find any patents.
              </p>
            </div>
          ) : (
            <>
              <div className="max-h-[500px] overflow-y-auto overflow-x-auto bg-neutral-50 dark:bg-neutral-900">
                <table className="w-full">
                  <thead className="sticky top-0 z-30 font-sans border-b bg-white dark:bg-[#0a0a0a] dark:border-b-[#cccccc20] border-b-neutral-200">
                    <tr>
                      <th
                        className="text-center p-4 pt-6 text-xs uppercase tracking-wider text-neutral-500"
                        style={{ width: "80px" }}
                      >
                        S.No
                      </th>
                      <th
                        className="text-left p-4 pt-6 text-xs uppercase tracking-wider text-neutral-500"
                        style={{ width: "180px" }}
                      >
                        Application No.
                      </th>
                      <th className="text-left p-4 pt-6 text-xs uppercase tracking-wider text-neutral-500">
                        Title
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {patentData?.data?.map(
                      (patent: any, patentIndex: number) => {
                        const actualIndex =
                          (currentPage - 1) * itemsPerPage + patentIndex + 1;
                        return (
                          <tr
                            key={patent.id}
                            className="border-b transition-colors group cursor-pointer border-neutral-200 dark:bg-[#0a0a0a] dark:border-[#cccccc20] hover:bg-neutral-100"
                          >
                            <td className="p-4 text-sm text-center text-neutral-600 dark:text-neutral-400">
                              {actualIndex}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-[#F9B418] flex-shrink-0" />
                                <span className="text-sm font-mono text-neutral-700 dark:text-neutral-300">
                                  {patent.application_number}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm leading-snug text-neutral-900 dark:text-neutral-400">
                                {patent.title}
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
              {patentData?.pagination && (
                <div className="p-4 border-t border-neutral-200 dark:border-none dark:border-t-[#cccccc20] bg-neutral-50 dark:bg-neutral-900">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Showing {totalPatents} patent{totalPatents !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PatentsTab;
