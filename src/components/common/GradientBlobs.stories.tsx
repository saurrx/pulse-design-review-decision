import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import GradientBlobs from "./GradientBlobs";

/**
 * The decoration that was copy-pasted into eight screens and rendered in one.
 *
 * These stories exist to make that visible: the component is invisible by
 * design (blurred, low opacity, `pointer-events-none`), so "does it look right"
 * cannot be answered by opening a page — seven of the eight copies were dead for
 * months precisely because nobody could tell. Each story asserts the DOM
 * contract instead: three blobs, hidden from assistive tech, and the animation
 * only when it is asked for.
 */
const meta = {
  title: "Common/GradientBlobs",
  component: GradientBlobs,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", height: "100vh", background: "var(--pulse-canvas)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GradientBlobs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: { theme: "light" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const root = c.getByTestId("gradient-blobs");
    await expect(root.querySelectorAll("[data-blob]")).toHaveLength(3);
    // The light theme's third blob is PINK where dark is purple — the one place
    // the two themes differ by hue rather than opacity, and the detail most
    // likely to be lost in a "tidy up".
    const accent = root.querySelector('[data-blob="accent"]') as HTMLElement;
    await expect(accent.style.background).toContain("236, 72, 153");
  },
};

export const Dark: Story = {
  args: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("gradient-blobs");
    const accent = root.querySelector('[data-blob="accent"]') as HTMLElement;
    await expect(accent.style.background).toContain("168, 85, 247");
  },
};

/**
 * Animation off. This is the mode a visual snapshot must use — the blobs drift
 * on a 20s loop, so a screenshot of the animated variant differs every run and
 * a diff tool reports noise forever.
 */
export const Static: Story = {
  args: { theme: "light", animated: false },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("gradient-blobs");
    for (const el of Array.from(root.querySelectorAll("[data-blob]"))) {
      await expect(el.className).not.toContain("animate-blob");
    }
  },
};

export const Animated: Story = {
  args: { theme: "light", animated: true },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("gradient-blobs");
    for (const el of Array.from(root.querySelectorAll("[data-blob]"))) {
      await expect(el.className).toContain("animate-blob");
    }
  },
};

/**
 * Decoration must be invisible to a screen reader and untouchable by a mouse.
 * A blurred 600px div that swallowed clicks would break every control beneath
 * it, and this is the assertion that keeps `pointer-events-none` on.
 */
export const IsInertDecoration: Story = {
  args: { theme: "light" },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("gradient-blobs");
    await expect(root.getAttribute("aria-hidden")).toBe("true");
    await expect(root.className).toContain("pointer-events-none");
  },
};
