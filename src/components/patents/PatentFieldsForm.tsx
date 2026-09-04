import React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Chip, PatentFields } from "./usePatentFields";

/**
 * The patent record form — nine fields and three chip lists.
 *
 * Rendered identically by AddPatentModal and FileIdeaModal, which until
 * 2026-09-03 each carried their own copy (3,078 normalised characters,
 * byte-identical). It is a pure view over `usePatentFields`: no state of its
 * own, so the two modals cannot drift apart again by editing one.
 *
 * Field ids double as the error keys the API returns on a 409
 * (`application_number`), which is why they are snake_case.
 */
const Field: React.FC<{
  id: string; label: string; required?: boolean; error?: string; children: React.ReactNode;
}> = ({ id, label, required, error, children }) => (
  <div>
    <Label htmlFor={id} className="text-xs font-medium">
      {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
    </Label>
    {children}
    {error && <p className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
  </div>
);

const ChipField: React.FC<{
  fields: PatentFields; kind: Chip; label: string; placeholder: string;
}> = ({ fields, kind, label, placeholder }) => {
  const list = fields.chips.values(kind);
  const inputId = `chips-${kind}`;
  return (
    <div>
      <Label htmlFor={inputId} className="text-xs font-medium">{label}</Label>
      <div
        className="mt-1 flex flex-wrap items-center gap-1 rounded-sm border border-neutral-300 px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring dark:border-neutral-800"
        data-testid={`chip-field-${kind}`}
      >
        {list.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-xs border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          >
            {c}
            <button
              type="button"
              onClick={() => fields.chips.remove(kind, c)}
              aria-label={`Remove ${c}`}
              className="opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={fields.chips.input[kind]}
          onChange={(e) => fields.chips.setInput(kind, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              fields.chips.add(kind);
            } else if (e.key === "Backspace" && !fields.chips.input[kind] && list.length > 0) {
              fields.chips.pop(kind);
            }
          }}
          placeholder={list.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
};

const PatentFieldsForm: React.FC<{ fields: PatentFields }> = ({ fields }) => {
  const { values: v, set, fieldError } = fields;
  return (
    <div className="grid gap-4 py-2" data-testid="patent-fields-form">
      <div className="grid grid-cols-2 gap-4">
        <Field id="application_number" label="Application Number" required error={fieldError.application_number}>
          <Input id="application_number" value={v.applicationNumber} onChange={(e) => set.applicationNumber(e.target.value)} placeholder="e.g. US20240012345A1" className="mt-1" />
        </Field>
        <Field id="application_date" label="Application Date" required error={fieldError.application_date}>
          <Input id="application_date" type="date" value={v.applicationDate} onChange={(e) => set.applicationDate(e.target.value)} className="mt-1" />
        </Field>
      </div>

      <Field id="title" label="Title" required error={fieldError.title}>
        <Input id="title" value={v.title} onChange={(e) => set.title(e.target.value)} className="mt-1" />
      </Field>

      <Field id="publication_country" label="Publication Country" required error={fieldError.publication_country}>
        <Input id="publication_country" value={v.publicationCountry} onChange={(e) => set.publicationCountry(e.target.value)} placeholder="e.g. US, IN, EP" className="mt-1" />
      </Field>

      <Field id="abstract" label="Abstract">
        <Textarea id="abstract" value={v.abstract} onChange={(e) => set.abstract(e.target.value)} rows={3} className="mt-1" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="current_assignee" label="Current Assignee">
          <Input id="current_assignee" value={v.currentAssignee} onChange={(e) => set.currentAssignee(e.target.value)} className="mt-1" />
        </Field>
        <Field id="assignee_original" label="Original Assignee">
          <Input id="assignee_original" value={v.assigneeOriginal} onChange={(e) => set.assigneeOriginal(e.target.value)} className="mt-1" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field id="prn" label="PRN">
          <Input id="prn" value={v.prn} onChange={(e) => set.prn(e.target.value)} className="mt-1" />
        </Field>
        <Field id="priority_details" label="Priority Details">
          <Input id="priority_details" value={v.priorityDetails} onChange={(e) => set.priorityDetails(e.target.value)} className="mt-1" />
        </Field>
      </div>

      <ChipField fields={fields} kind="inventors" label="Inventors" placeholder="Type and press Enter to add" />
      <ChipField fields={fields} kind="ipc_all_versions" label="IPC Classifications" placeholder="Type and press Enter to add" />
      <ChipField fields={fields} kind="tags" label="Tags" placeholder="Type and press Enter to add" />
    </div>
  );
};

export default PatentFieldsForm;
