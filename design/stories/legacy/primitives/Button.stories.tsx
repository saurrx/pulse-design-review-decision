import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui/button";
import { Mail, Plus, Trash2 } from "lucide-react";

const meta = { title: "Legacy reference/Primitives/Button", component: Button, parameters: { pulse: { layout: "public", route: "/" }, layout: "padded" } } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: 24 }}>{children}</div>;

export const Variants: Story = { render: () => <Row><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button variant="link">Link</Button><Button variant="destructive">Delete</Button></Row> };
export const Sizes: Story = { render: () => <Row><Button size="sm">Small</Button><Button>Default</Button><Button size="lg">Large</Button><Button size="icon" aria-label="Add"><Plus className="h-4 w-4" /></Button></Row> };
export const WithIcons: Story = { render: () => <Row><Button><Mail className="mr-2 h-4 w-4" />Send invitation</Button><Button variant="outline"><Plus className="mr-2 h-4 w-4" />New idea</Button><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Remove</Button></Row> };
export const States: Story = { render: () => <Row><Button disabled>Disabled</Button><Button variant="outline" disabled>Disabled outline</Button><Button autoFocus>Focused</Button></Row> };
