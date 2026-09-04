import { useEffect, useState } from "react";

/**
 * The state behind a patent record form.
 *
 * `AddPatentModal` (add to a client's portfolio) and `FileIdeaModal` (file an
 * idea as a patent) carried BYTE-IDENTICAL copies of all of this — fourteen
 * `useState`s, the reset-on-open effect, the chip add/remove logic, the
 * validation and the payload shape — 157 lines of JSX and ~90 of logic each,
 * proved identical by normalised diff on 2026-09-03 except for the mutation's
 * name and which fields the reset pre-fills. The two screens differ ONLY in
 * where the payload is posted and what happens after; that is what stayed in
 * the modals.
 *
 * Owning the payload here is deliberate: it is the wire contract with
 * `POST /api/v1/patent/client/:id` and `POST /api/v1/idea/:id/file`, and two
 * modals each building it by hand is how a field silently stops being sent
 * from one of them.
 */
export type Chip = "inventors" | "ipc_all_versions" | "tags";

export interface PatentPayload {
  application_number: string;
  application_date: string;
  title: string;
  publication_country: string;
  abstract: string | null;
  priority_details: string | null;
  current_assignee: string | null;
  assignee_original: string | null;
  prn: string | null;
  inventors: string[];
  ipc_all_versions: string[];
  tags: string[];
}

export interface UsePatentFieldsOptions {
  /** Reset (and pre-fill) whenever this becomes true — the dialog's `open`. */
  open: boolean;
  /** Pre-filled values applied on every open. FileIdeaModal seeds the idea's
   *  title and credited inventors; AddPatentModal seeds nothing. */
  initial?: { title?: string; inventors?: string[] };
}

export function usePatentFields({ open, initial }: UsePatentFieldsOptions) {
  const [applicationNumber, setApplicationNumber] = useState("");
  const [applicationDate, setApplicationDate] = useState("");
  const [title, setTitle] = useState("");
  const [publicationCountry, setPublicationCountry] = useState("");
  const [abstract, setAbstract] = useState("");
  const [priorityDetails, setPriorityDetails] = useState("");
  const [currentAssignee, setCurrentAssignee] = useState("");
  const [assigneeOriginal, setAssigneeOriginal] = useState("");
  const [prn, setPrn] = useState("");
  const [inventors, setInventors] = useState<string[]>([]);
  const [ipcAllVersions, setIpcAllVersions] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [chipInput, setChipInput] = useState<Record<Chip, string>>({
    inventors: "", ipc_all_versions: "", tags: "",
  });
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  const initialTitle = initial?.title;
  const initialInventors = initial?.inventors;

  useEffect(() => {
    if (!open) return;
    setApplicationNumber("");
    setApplicationDate("");
    setTitle(initialTitle ?? "");
    setPublicationCountry("");
    setAbstract("");
    setPriorityDetails("");
    setCurrentAssignee("");
    setAssigneeOriginal("");
    setPrn("");
    setInventors(initialInventors ?? []);
    setIpcAllVersions([]);
    setTags([]);
    setChipInput({ inventors: "", ipc_all_versions: "", tags: "" });
    setFieldError({});
  }, [open, initialTitle, initialInventors]);

  const chipValues = (kind: Chip): string[] =>
    kind === "inventors" ? inventors : kind === "ipc_all_versions" ? ipcAllVersions : tags;

  const setChips = (kind: Chip, next: string[]) => {
    if (kind === "inventors") setInventors(next);
    else if (kind === "ipc_all_versions") setIpcAllVersions(next);
    else setTags(next);
  };

  /** Commit the pending input as a chip. Case-insensitive de-dupe; empty is a no-op. */
  const addChip = (kind: Chip) => {
    const raw = chipInput[kind].trim();
    if (!raw) return;
    const current = chipValues(kind);
    if (!current.some((c) => c.toLowerCase() === raw.toLowerCase())) {
      setChips(kind, [...current, raw]);
    }
    setChipInput((p) => ({ ...p, [kind]: "" }));
  };

  const removeChip = (kind: Chip, value: string) =>
    setChips(kind, chipValues(kind).filter((c) => c !== value));

  /** Backspace on an empty chip input removes the last chip. */
  const popChip = (kind: Chip) => setChips(kind, chipValues(kind).slice(0, -1));

  const setChipInputFor = (kind: Chip, value: string) =>
    setChipInput((p) => ({ ...p, [kind]: value }));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!applicationNumber.trim()) errs.application_number = "Required";
    if (!applicationDate) errs.application_date = "Required";
    if (!title.trim()) errs.title = "Required";
    if (!publicationCountry.trim()) errs.publication_country = "Required";
    setFieldError(errs);
    return Object.keys(errs).length === 0;
  };

  const payload = (): PatentPayload => ({
    application_number: applicationNumber.trim(),
    application_date: applicationDate,
    title: title.trim(),
    publication_country: publicationCountry.trim(),
    abstract: abstract.trim() || null,
    priority_details: priorityDetails.trim() || null,
    current_assignee: currentAssignee.trim() || null,
    assignee_original: assigneeOriginal.trim() || null,
    prn: prn.trim() || null,
    inventors,
    ipc_all_versions: ipcAllVersions,
    tags,
  });

  return {
    values: {
      applicationNumber, applicationDate, title, publicationCountry, abstract,
      priorityDetails, currentAssignee, assigneeOriginal, prn,
    },
    set: {
      applicationNumber: setApplicationNumber, applicationDate: setApplicationDate,
      title: setTitle, publicationCountry: setPublicationCountry, abstract: setAbstract,
      priorityDetails: setPriorityDetails, currentAssignee: setCurrentAssignee,
      assigneeOriginal: setAssigneeOriginal, prn: setPrn,
    },
    chips: { values: chipValues, input: chipInput, setInput: setChipInputFor, add: addChip, remove: removeChip, pop: popChip },
    fieldError, setFieldError, validate, payload,
  };
}

export type PatentFields = ReturnType<typeof usePatentFields>;
