import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const meta = { title: "Legacy reference/Primitives/Form controls", component: Input, parameters: { pulse: { layout: "public", route: "/" }, layout: "padded" } } satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;
const Col = ({ children }: { children: React.ReactNode }) => <div style={{ display: "grid", gap: 16, maxWidth: 440, padding: 24 }}>{children}</div>;

export const TextInputs: Story = { render: () => <Col><Input label="Title" name="title" placeholder="A short, specific title" /><Input label="Email" name="email" type="email" defaultValue="priya@acme.test" /><Input label="Password" name="password" type="password" defaultValue="secret" /><Input label="Disabled" name="d" disabled defaultValue="Not editable" /></Col> };
export const TextInputError: Story = { name: "Text input, with error", render: () => <Col><Input label="Title" name="title" touched={{ title: true }} errors={{ title: "A title is required" }} aria-invalid /></Col> };
export const TextareaStates: Story = { render: () => <Col><Textarea placeholder="Describe the problem the invention solves" rows={4} /><Textarea error="Say what changes for the user, not only what the mechanism does." defaultValue="It works better." rows={3} /><Textarea disabled defaultValue="Read only" rows={2} /></Col> };
export const Choices: Story = { render: () => <Col>
  <div className="flex items-center gap-2"><Checkbox id="c1" defaultChecked /><Label htmlFor="c1">Include co-inventors</Label></div>
  <div className="flex items-center gap-2"><Checkbox id="c2" /><Label htmlFor="c2">Notify by email</Label></div>
  <div className="flex items-center gap-2"><Switch id="s1" defaultChecked /><Label htmlFor="s1">Review decisions</Label></div>
  <RadioGroup defaultValue="permanent"><div className="flex items-center gap-2"><RadioGroupItem value="permanent" id="r1" /><Label htmlFor="r1">Permanent</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="temporary" id="r2" /><Label htmlFor="r2">Temporary</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="step-in" id="r3" /><Label htmlFor="r3">Step-in</Label></div></RadioGroup>
</Col> };
export const SelectClosed: Story = { name: "Select", render: () => <Col><Select defaultValue="US"><SelectTrigger aria-label="Jurisdiction"><SelectValue placeholder="Jurisdiction" /></SelectTrigger><SelectContent><SelectItem value="US">United States</SelectItem><SelectItem value="EP">European Patent Office</SelectItem><SelectItem value="IN">India</SelectItem></SelectContent></Select></Col> };
export const ProgressBars: Story = { name: "Progress", render: () => <Col><Progress value={20} /><Progress value={60} /><Progress value={100} /><Progress value={40} disabled /></Col> };
