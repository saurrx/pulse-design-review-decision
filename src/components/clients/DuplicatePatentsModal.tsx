import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * What a portfolio import did.
 *
 * The shapes here follow the API rather than the legacy importer's. The old
 * version typed a full bibliographic record per "duplicate" — publication
 * country, abstract, inventors, an events_info array — and rendered all of it.
 * None of that ever arrived: the endpoint it was written against had been
 * replaced, and the upload it was waiting for could not succeed at all (F-060).
 *
 * A matched row is now an UPDATE, not a rejection, so the interesting thing
 * about it is not the patent's bibliography — the operator can see that on the
 * patent — but exactly which fields the spreadsheet overwrote.
 */
interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

/** A patent already on file that this import changed. */
interface UpdatedPatent {
  patent_id: string;
  row: number;
  application_number: string | null;
  title: string;
  changes: FieldChange[];
}

/** One application number claimed by more than one row of the same sheet. */
interface ExcelDuplicateEntry {
  application_number: string;
  rows: number[];
}

interface DuplicatePatentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicatePatents: UpdatedPatent[];
  excelDuplicateEntries?: ExcelDuplicateEntry[];
  errorCount?: number;
  successCount?: number;
  updatedCount?: number;
  dueDatesCreated?: number;
  unmappedColumns?: string[];
  /** Required fields the sheet did not supply — by column, or by row. */
  missingRequired?: MissingRequirement[];
}

export interface MissingRequirement {
  field: string;
  label: string;
  /** No column in the sheet matched this field at all. */
  missingColumn: boolean;
  rows: number[];
}

/** Values are strings, dates, lists or null; render them the way a cell reads. */
const show = (v: unknown): string => {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  const s = String(v);
  // An ISO timestamp is noise in a diff; the date is the part that changed.
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s;
};

const Stat: React.FC<{ label: string; value: number | string; tone: string }> = ({ label, value, tone }) => (
  <div className={`rounded-lg p-4 ${tone}`}>
    <div className="text-sm font-medium opacity-80">{label}</div>
    <div className="text-2xl font-bold">{value}</div>
  </div>
);

const DuplicatePatentsModal: React.FC<DuplicatePatentsModalProps> = ({
  open,
  onOpenChange,
  duplicatePatents = [],
  excelDuplicateEntries = [],
  errorCount = 0,
  successCount = 0,
  updatedCount = 0,
  dueDatesCreated = 0,
  unmappedColumns = [],
  missingRequired = [],
}) => {
  const hasDetail = duplicatePatents.length > 0 || excelDuplicateEntries.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] dark:bg-neutral-900 dark:border-[#cccccc20]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold font-sans text-neutral-800 dark:text-neutral-300">
            Portfolio import results
          </DialogTitle>
          <DialogDescription>
            The spreadsheet is kept with this client — see Import history to download it.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 grid grid-cols-4 gap-4">
          <Stat label="Added" value={successCount} tone="bg-green-50 text-green-700" />
          <Stat label="Updated" value={updatedCount} tone="bg-blue-50 text-blue-700" />
          <Stat label="Deadlines" value={dueDatesCreated} tone="bg-violet-50 text-violet-700" />
          <Stat
            label="Errors"
            value={errorCount}
            tone={errorCount ? "bg-red-50 text-red-700" : "bg-neutral-50 text-neutral-600"}
          />
        </div>

        {/* Required fields the sheet did not supply.
            The previous product dropped these rows silently — a filing-date
            column blank on twelve rows imported the other eighty-two and said
            nothing, so the only way to find out was to miss a patent months
            later. Stated first, and above the "columns not imported" note,
            because this is the part that cost the uploader rows. */}
        {missingRequired.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span className="font-medium">
              Required information is missing, so some rows could not be imported:
            </span>
            <ul className="mt-2 space-y-1.5">
              {missingRequired.map((m) => (
                <li key={m.field}>
                  <span className="font-medium">{m.label}</span>
                  {m.missingColumn ? (
                    <>
                      {" "}— no column in your file matched this. Add a{" "}
                      <span className="font-medium">{m.label}</span> column and upload again.
                    </>
                  ) : (
                    <>
                      {" "}— empty on {m.rows.length} {m.rows.length === 1 ? "row" : "rows"}
                      {m.rows.length <= 12 ? ` (${m.rows.join(", ")})` : ` (${m.rows.slice(0, 12).join(", ")}…)`}
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs opacity-80">
              We need all four of Title, Application number, Filing date and Country to
              track a filing and its deadlines.{" "}
              {/* Only true when some rows actually made it. On a sheet missing a
                  whole column NOTHING imports, and telling someone the rest went
                  through is the one sentence that would stop them re-uploading. */}
              {successCount + updatedCount > 0
                ? "Every other row in the sheet was imported."
                : "No rows were imported from this file."}
            </p>
          </div>
        )}

        {unmappedColumns.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <span className="font-medium">Columns not imported:</span>{" "}
            {unmappedColumns.join(", ")}
            <p className="mt-1 text-xs opacity-80">
              These have no matching field. Everything else in the sheet was read.
            </p>
          </div>
        )}

        {!hasDetail ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-neutral-500">
            Every row was new — nothing already on file was changed.
          </div>
        ) : (
          <Tabs defaultValue={duplicatePatents.length ? "updated" : "sheet"} className="w-full">
            <TabsList
              className="grid w-full"
              style={{
                gridTemplateColumns: `repeat(${
                  (duplicatePatents.length ? 1 : 0) + (excelDuplicateEntries.length ? 1 : 0)
                }, 1fr)`,
              }}
            >
              {duplicatePatents.length > 0 && (
                <TabsTrigger value="updated">Updated ({duplicatePatents.length})</TabsTrigger>
              )}
              {excelDuplicateEntries.length > 0 && (
                <TabsTrigger value="sheet">Repeated in sheet ({excelDuplicateEntries.length})</TabsTrigger>
              )}
            </TabsList>

            {duplicatePatents.length > 0 && (
              <TabsContent value="updated">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {duplicatePatents.map((patent) => (
                      <div key={patent.patent_id} className="rounded-lg border bg-neutral-50 p-4 dark:bg-neutral-800/40">
                        <div className="mb-2 flex items-start justify-between">
                          <div className="font-semibold text-photon-light">
                            {patent.application_number || "No application number"}
                          </div>
                          <Badge variant="outline" className="ml-2 shrink-0">row {patent.row}</Badge>
                        </div>
                        <div className="mb-3 text-sm font-medium">{patent.title}</div>
                        {/* The point of this screen: what the sheet overwrote. */}
                        <div className="space-y-1.5">
                          {patent.changes.map((c, i) => (
                            <div key={i} className="grid grid-cols-[9rem_1fr] gap-2 text-xs">
                              <span className="font-medium text-neutral-500">{c.field}</span>
                              <span className="min-w-0">
                                <span className="text-red-700 line-through dark:text-red-400">{show(c.from)}</span>
                                <span className="mx-1.5 text-neutral-400">→</span>
                                <span className="text-green-700 dark:text-green-400">{show(c.to)}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            {excelDuplicateEntries.length > 0 && (
              <TabsContent value="sheet">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-500">
                      These application numbers appear on more than one row of the uploaded
                      file. The first row was imported; the others were skipped rather than
                      allowed to silently overwrite it.
                    </p>
                    {excelDuplicateEntries.map((entry) => (
                      <div key={entry.application_number} className="rounded-lg border bg-neutral-50 p-4 dark:bg-neutral-800/40">
                        <div className="font-semibold text-photon-light">{entry.application_number}</div>
                        <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                          rows {entry.rows.join(", ")} — row {entry.rows[0]} was used
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DuplicatePatentsModal;
