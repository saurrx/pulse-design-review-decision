import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import AuthLoadingOverlay from "./AuthLoadingOverlay";

/**
 * The veil four auth screens show while a credential is in flight.
 *
 * The story that matters most is `Hidden`: this component returns `null` when
 * `show` is false, and the four screens it replaced each guarded it with their
 * own `{isLoading && …}`. If it ever renders an empty positioned div instead of
 * nothing, it covers the whole sign-in form with an invisible layer and the
 * login page silently stops accepting clicks.
 */
/** Records whether a real click reached the control beneath the overlay. */
const onUnderlyingClick = fn();

const meta = {
  title: "Auth/AuthLoadingOverlay",
  component: AuthLoadingOverlay,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", height: "100vh" }}>
        <button
          type="button"
          onClick={onUnderlyingClick}
          style={{ position: "absolute", top: 24, left: 24 }}
        >
          A control underneath
        </button>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthLoadingOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SigningIn: Story = {
  args: { show: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByTestId("auth-loading-overlay")).toBeInTheDocument();
    await expect(c.getByText("Signing in...")).toBeInTheDocument();
    // Announced, not just drawn: a spinner a screen reader cannot see is a
    // silent page for anyone not looking at it.
    await expect(c.getByRole("status")).toBeInTheDocument();
  },
};

export const Hidden: Story = {
  args: { show: false },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByTestId("auth-loading-overlay")).toBeNull();

    // Then prove nothing is covering the control beneath it.
    //
    // Two earlier versions of this assertion did NOT bite. Planting
    // `return <div className="absolute inset-0" />` in place of `return null`
    // passed both:
    //
    //   - `queryByTestId(...)` is null either way, because the planted div
    //     carries no testid;
    //   - `toBeEnabled()` is true of a covered button, and `userEvent.click`
    //     only checks `pointer-events` ON THE TARGET, not occlusion — so it
    //     dispatched straight at the button and the handler fired.
    //
    // That failure mode is the entire reason this story exists: an invisible
    // full-screen layer over the sign-in form leaves the page looking completely
    // normal and silently unclickable. Only the browser's own hit-test can tell
    // the two worlds apart, so ask it — symmetric with
    // `BlocksInteractionWhileShown`, which asserts the opposite.
    const btn = c.getByRole("button", { name: "A control underneath" });
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    await expect(hit).toBe(btn);

    // And a real click still reaches the handler.
    onUnderlyingClick.mockClear();
    await userEvent.click(btn);
    await expect(onUnderlyingClick).toHaveBeenCalledTimes(1);
  },
};

/**
 * ResetPassword and Invite are not literally "signing in" — they set a password
 * or accept an invite and get signed in immediately after. The label is
 * overridable for a screen where the default stops being true.
 */
/**
 * The other half of the same contract: while it IS showing, the veil must
 * actually swallow the click. An overlay that renders but lets input through
 * would let someone submit the form twice mid-request.
 */
export const BlocksInteractionWhileShown: Story = {
  args: { show: true },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole("button", { name: "A control underneath" });
    const r = btn.getBoundingClientRect();
    // Hit-test the button's own centre. `userEvent.click` was the wrong tool:
    // with `pointerEventsCheck: 0` it dispatches straight at the element and
    // bypasses occlusion entirely, so it "passed" against an overlay that was
    // in fact covering nothing — the escape hatch defeated the assertion.
    // elementFromPoint asks the browser what a real pointer would actually hit.
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    await expect(hit).not.toBe(btn);
    await expect(canvasElement.querySelector('[data-testid="auth-loading-overlay"]')!.contains(hit))
      .toBe(true);
  },
};

export const CustomLabel: Story = {
  args: { show: true, label: "Setting your password..." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Setting your password...")).toBeInTheDocument();
  },
};
