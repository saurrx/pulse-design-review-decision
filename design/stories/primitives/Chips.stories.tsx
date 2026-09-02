import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductChip } from "@/components/ui/product-chip";
import StatusChip from "@/components/ui/StatusChip";
import { Sparkles } from "lucide-react";

const meta = { title: "Primitives/Chips", component: ProductChip, parameters: { pulse: { layout: "public", route: "/" }, layout: "padded" } } satisfies Meta<typeof ProductChip>;
export default meta;
type Story = StoryObj<typeof meta>;
const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: 24, alignItems: "center" }}>{children}</div>;

export const StatusTones: Story = { name: "Product chip, status tones", render: () => <Row><ProductChip tone="neutral">Draft</ProductChip><ProductChip tone="warning">Decision needed</ProductChip><ProductChip tone="info">Waiting on inventor</ProductChip><ProductChip tone="success">Filed</ProductChip><ProductChip tone="danger">Declined</ProductChip></Row> };
export const Kinds: Story = { name: "Product chip, kinds", render: () => <Row><ProductChip kind="metadata" tone="neutral" icon={<Sparkles className="h-3.5 w-3.5" />}>AI evaluated</ProductChip><ProductChip kind="tag">core</ProductChip><ProductChip kind="tag">licensing</ProductChip><ProductChip kind="count">12</ProductChip></Row> };
export const StatusCodes: Story = { name: "Status chip, idea and patent codes", render: () => <Row>{["IN_DRAFT", "UNDER_REVIEW", "SENT_TO_IHC", "UPDATE_REQUEST", "REJECT_BY_IHC", "SEND_TO_OC", "FILED", "GRANTED", "ACTIVE_APPLIED", "INACTIVE_EXPIRED"].map((s) => <StatusChip key={s} status={s} />)}</Row> };
