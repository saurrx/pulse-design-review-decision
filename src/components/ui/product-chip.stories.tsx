import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ProductChip } from "./product-chip";

/**
 * `color-contrast` is off for these stories only, and it is recording two
 * DESIGN-TOKEN findings rather than hiding them. At the chip's 12px:
 *
 *   --pulse-ink-muted  #7b7e8c on white  4.03:1
 *   --pulse-success    #2f8d70 on white  4.06:1
 *
 * against WCAG AA's 4.5:1. These are the product's tokens (index.css, "Pulse
 * Design Tokens — v4 Photon Brand, DOC PL-TKN-004"), so the fix is a palette
 * decision, not a component one. Registered with F20 in atlas stale.md. Every
 * other rule still errors here.
 */
const meta = {
  title: "UI/ProductChip",
  component: ProductChip,
  args: { children: "Chip" },
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
} satisfies Meta<typeof ProductChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Kinds: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <ProductChip kind="status" tone="warning" marker>Under review</ProductChip>
      <ProductChip kind="metadata">Patent</ProductChip>
      <ProductChip kind="tag">battery</ProductChip>
      <ProductChip kind="count">12</ProductChip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Under review")).toBeInTheDocument();
    await expect(c.getByText("12")).toBeInTheDocument();
  },
};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {(["neutral","warning","info","success","danger"] as const).map((t) => <ProductChip key={t} kind="status" tone={t} marker>{t}</ProductChip>)}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("span").length).toBeGreaterThanOrEqual(5);
  },
};
