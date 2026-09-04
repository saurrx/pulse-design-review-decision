import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import PatentFieldsForm from "./PatentFieldsForm";
import { usePatentFields } from "./usePatentFields";

/**
 * The form both patent modals now share. The assertions are the ones that
 * matter to the two callers: which fields are required, that a 409 from the
 * server lands on the application-number field, that the chip inputs de-dupe
 * case-insensitively, and that FileIdeaModal's pre-fill actually arrives.
 */
function Harness(props: { initial?: { title?: string; inventors?: string[] }; showPayload?: boolean }) {
  const fields = usePatentFields({ open: true, initial: props.initial });
  return (
    <div style={{ maxWidth: 640 }}>
      <PatentFieldsForm fields={fields} />
      <button type="button" onClick={() => fields.validate()}>validate</button>
      <button type="button" onClick={() => fields.setFieldError({ application_number: "A patent with this application number already exists" })}>simulate 409</button>
      <pre data-testid="payload">{JSON.stringify(fields.payload())}</pre>
    </div>
  );
}

/**
 * `color-contrast` off for these stories only: the field error text is
 * `text-red-500` (#ef4444) on the canvas, 3.5:1 — the same colour and the same
 * finding as `daysColor`'s 7-day band (atlas stale.md F20), ported verbatim
 * from both modals. Registered, not recoloured; every other rule still errors.
 */
const meta = {
  title: "Patents/PatentFieldsForm",
  component: Harness,
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByTestId("patent-fields-form")).toBeInTheDocument();
    // By LABEL, not by text: the payload <pre> also contains "title", and
    // getByText("Title") found both — a test failing on its own harness.
    for (const label of ["Application Number", "Application Date", "Title", "Publication Country", "Abstract", "Current Assignee", "Original Assignee", "PRN", "Priority Details", "Inventors", "IPC Classifications", "Tags"]) {
      await expect(c.getByLabelText(new RegExp("^" + label))).toBeInTheDocument();
    }
  },
};

export const RequiredFieldsValidate: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "validate" }));
    const alerts = await c.findAllByRole("alert");
    // Exactly the four required fields, and nothing else.
    await expect(alerts).toHaveLength(4);
  },
};

export const ServerConflictLandsOnTheField: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "simulate 409" }));
    const alert = await c.findByRole("alert");
    await expect(alert.textContent).toMatch(/already exists/);
    // The alert sits in the same Field wrapper as the input it describes.
    await expect(alert.closest("div")?.querySelector("input")?.id).toBe("application_number");
  },
};

export const ChipsDedupeCaseInsensitively: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const input = c.getByLabelText("Inventors");
    await userEvent.type(input, "Ada Lovelace{enter}");
    await userEvent.type(input, "ada lovelace{enter}");
    await userEvent.type(input, "Grace Hopper,");
    const field = c.getByTestId("chip-field-inventors");
    await expect(field.querySelectorAll("span.rounded-xs")).toHaveLength(2);
    await expect(JSON.parse(c.getByTestId("payload").textContent!).inventors).toEqual(["Ada Lovelace", "Grace Hopper"]);
    // Backspace on an empty input pops the last chip.
    await userEvent.type(input, "{backspace}");
    await expect(field.querySelectorAll("span.rounded-xs")).toHaveLength(1);
  },
};

export const PrefilledFromAnIdea: Story = {
  args: { initial: { title: "Phase-change lattice", inventors: ["Ada Lovelace"] } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect((c.getByLabelText(/^Title/) as HTMLInputElement).value).toBe("Phase-change lattice");
    await expect(c.getByTestId("chip-field-inventors").textContent).toContain("Ada Lovelace");
  },
};

export const PayloadShape: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByLabelText(/Application Number/), "  US1234  ");
    await userEvent.type(c.getByLabelText(/^Title/), " Lattice ");
    const p = JSON.parse(c.getByTestId("payload").textContent!);
    // Trimmed, and empty optionals are NULL not "" — the wire contract both
    // POST routes rely on.
    await expect(p.application_number).toBe("US1234");
    await expect(p.title).toBe("Lattice");
    await expect(p.abstract).toBeNull();
    await expect(Object.keys(p).sort()).toEqual(["abstract","application_date","application_number","assignee_original","current_assignee","inventors","ipc_all_versions","priority_details","prn","publication_country","tags","title"]);
  },
};
