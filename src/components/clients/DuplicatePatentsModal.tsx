import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import moment from "moment";

interface DuplicatePatent {
  application_number: string;
  application_date: string;
  title: string;
  abstract: string;
  publication_country: string;
  priority_details: string;
  assignee_original: string;
  current_assignee: string;
  inventors: string[];
  issue_date: string;
  simple_family_members: string[];
  ipc_all_versions: string[];
  legal_current_status: string;
  current_status: string | null;
  events_info: Array<{
    event_name: string;
    event_date: string;
  }>;
}

interface ExcelDuplicateEntry {
  application_number: string;
  entries: Array<{
    application_number: string;
    application_date: string;
    title: string;
    current_assignee: string;
    legal_current_status: string;
    current_status: string;
  }>;
}

interface DuplicatePatentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicatePatents: DuplicatePatent[];
  excelDuplicateEntries?: ExcelDuplicateEntry[];
  errorCount?: number;
  successCount?: number;
  totalPatentImported?: number;
}

const DuplicatePatentsModal: React.FC<DuplicatePatentsModalProps> = ({
  open,
  onOpenChange,
  duplicatePatents,
  excelDuplicateEntries = [],
  errorCount = 0,
  successCount = 0,
  totalPatentImported,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] dark:bg-neutral-900 dark:border-[#cccccc20]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-neutral-800 font-sans dark:text-neutral-300">
            Patent Import Results
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Success</div>
            <div className="text-2xl font-bold text-green-700">{successCount}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm text-yellow-600 font-medium">DB Duplicates</div>
            <div className="text-2xl font-bold text-yellow-700">
              {duplicatePatents?.length || 0}
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-sm text-orange-600 font-medium">Excel Duplicates</div>
            <div className="text-2xl font-bold text-orange-700">
              {excelDuplicateEntries?.length || 0}
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm text-red-600 font-medium">Errors</div>
            <div className="text-2xl font-bold text-red-700">{errorCount}</div>
          </div>
        </div>

      {duplicatePatents?.length > 0 || excelDuplicateEntries?.length > 0 ? (
        <Tabs defaultValue={duplicatePatents?.length > 0 ? "database" : "excel"} className="w-full">
          <TabsList className="grid w-full" style={{ 
            gridTemplateColumns: `repeat(${
              (duplicatePatents?.length > 0 ? 1 : 0) + 
              (excelDuplicateEntries?.length > 0 ? 1 : 0)
            }, 1fr)`
          }}>
            {duplicatePatents?.length > 0 && (
              <TabsTrigger value="database">Database Duplicates</TabsTrigger>
            )}
            {excelDuplicateEntries?.length > 0 && (
              <TabsTrigger value="excel">Excel Duplicates</TabsTrigger>
            )}
          </TabsList>

          {duplicatePatents?.length > 0 && (
            <TabsContent value="database">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {duplicatePatents.map((patent, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-photon-light">
                          {patent.application_number}
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {patent.publication_country}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium mb-2">{patent.title}</div>
                      <div className="text-sm text-gray-600 mb-2">
                        {patent.abstract}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Assignee:</span>{" "}
                          {patent.current_assignee}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>{" "}
                          {patent.legal_current_status}
                        </div>
                        <div>
                          <span className="font-medium">Application Date:</span>{" "}
                          {moment(patent.application_date).format("MMM D, YYYY")}
                        </div>
                        <div>
                          <span className="font-medium">Issue Date:</span>{" "}
                          {moment(patent.issue_date).format("MMM D, YYYY")}
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="font-medium text-sm">Inventors:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patent.inventors.map((inventor, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {inventor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {excelDuplicateEntries?.length > 0 && (
            <TabsContent value="excel">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {excelDuplicateEntries?.map((entry, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="font-semibold text-photon-light mb-2">
                        {entry.application_number}
                      </div>
                      <div className="space-y-3">
                        {entry.entries.map((duplicate, i) => (
                          <div key={i} className="pl-4 border-l-2 border-gray-300">
                            <div className="text-sm font-medium mb-1">
                              {duplicate.title}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-medium">Date:</span>{" "}
                                {duplicate.application_date}
                              </div>
                              <div>
                                <span className="font-medium">Assignee:</span>{" "}
                                {duplicate.current_assignee}
                              </div>
                              <div>
                                <span className="font-medium">Status:</span>{" "}
                                {duplicate.legal_current_status}
                              </div>
                              {duplicate.current_status && (
                                <div>
                                  <span className="font-medium">Current Status:</span>{" "}
                                  {duplicate.current_status}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default DuplicatePatentsModal;
