import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { GoogleIcon, MicrosoftIcon } from "./BrandIcons";

/**
 * The two vendor marks on the social sign-in buttons.
 *
 * The assertions here are about TRADEMARK correctness rather than looks. Both
 * vendors require their mark as supplied, and a recoloured Google G or a
 * Microsoft square in the wrong hue is a brand-terms problem that no visual
 * review would reliably catch. The first draft of BrandIcons.tsx was written by
 * hand and corrupted one of Google's four paths, which is exactly why the file
 * is generated from source and why these stories pin the colours.
 */
const meta = { title: "Auth/BrandIcons" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Google: Story = {
  render: () => <GoogleIcon />,
  play: async ({ canvasElement }) => {
    const paths = canvasElement.querySelectorAll("path");
    await expect(paths).toHaveLength(4);
    const fills = Array.from(paths).map((p) => p.getAttribute("fill"));
    await expect(fills).toEqual(["#4285F4", "#34A853", "#FBBC04", "#EA4335"]);
    // Every path must carry real geometry. A truncated `d` renders a blank box
    // at this size and looks like a loading state rather than a bug.
    for (const p of Array.from(paths)) {
      await expect((p.getAttribute("d") ?? "").length).toBeGreaterThan(80);
    }
  },
};

export const Microsoft: Story = {
  render: () => <MicrosoftIcon />,
  play: async ({ canvasElement }) => {
    const rects = canvasElement.querySelectorAll("rect");
    await expect(rects).toHaveLength(4);
    await expect(Array.from(rects).map((r) => r.getAttribute("fill")))
      .toEqual(["#F25022", "#7FBA00", "#00A4EF", "#FFB900"]);
  },
};

export const Sized: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <GoogleIcon size={16} />
      <GoogleIcon size={20} />
      <GoogleIcon size={32} />
      <MicrosoftIcon size={32} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const svgs = canvasElement.querySelectorAll("svg");
    await expect(Array.from(svgs).map((s) => s.getAttribute("width")))
      .toEqual(["16", "20", "32", "32"]);
  },
};

/**
 * Both marks sit inside a button that already says "Continue with Google". An
 * icon that also announces itself makes a screen reader say the vendor twice.
 */
export const HiddenFromAssistiveTech: Story = {
  render: () => (
    <button type="button" style={{ display: "inline-flex", gap: 8, padding: 12 }}>
      <GoogleIcon />
      Continue with Google
    </button>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const btn = c.getByRole("button", { name: "Continue with Google" });
    await expect(btn).toBeInTheDocument();
    await expect(btn.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  },
};
