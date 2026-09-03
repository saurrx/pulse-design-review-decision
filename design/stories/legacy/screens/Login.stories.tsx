import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import Login from "@/pages/auth/Login";

/** The auth shell. Public layout, no persona. Google is an inert control here; the password form talks to the mock. */
const meta = {
  title: "Legacy reference/Screens/Login",
  component: Login,
  parameters: { pulse: { scenario: "committee/queue", layout: "public", route: "/login" } },
} satisfies Meta<typeof Login>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Sign in" })).toBeVisible();
  },
};

export const ValidationErrors: Story = {
  name: "Submitted empty",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Sign in" });
    await userEvent.click(canvas.getByRole("button", { name: "Sign In" }));
    await expect(await canvas.findByText("Email is required")).toBeVisible();
    await expect(canvas.getByLabelText(/^email$/i)).toHaveAttribute("aria-invalid", "true");
  },
};

export const InvalidCredentials: Story = {
  name: "Unknown account",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Sign in" });
    await userEvent.type(canvas.getByLabelText(/^email$/i), "nobody@acme.test");
    await userEvent.type(canvas.getByLabelText(/^password$/i), "x");
    await userEvent.click(canvas.getByRole("button", { name: "Sign In" }));
    // The toast animates in; assert once it has settled rather than on first paint.
    const toast = await within(document.body).findByText("Invalid email or password.", {}, { timeout: 8_000 });
    await waitFor(() => expect(toast).toBeVisible(), { timeout: 3_000 });
  },
};

export const SignsIn: Story = {
  name: "Known account signs in",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Sign in" });
    await userEvent.type(canvas.getByLabelText(/^email$/i), "committee@acme.test");
    await userEvent.type(canvas.getByLabelText(/^password$/i), "any");
    await userEvent.click(canvas.getByRole("button", { name: "Sign In" }));
    const marker = await within(document.body).findByTestId("navigated-to", {}, { timeout: 8_000 });
    await expect(marker).toHaveAttribute("data-pathname", "/");
  },
};
