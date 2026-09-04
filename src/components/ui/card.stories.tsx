import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = { title: "UI/Card", component: Card } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Composed: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader><CardTitle>Patent portfolio</CardTitle><CardDescription>468 patents</CardDescription></CardHeader>
      <CardContent>Content</CardContent>
      <CardFooter>Footer</CardFooter>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    for (const t of ["Patent portfolio", "468 patents", "Content", "Footer"]) await expect(c.getByText(t)).toBeInTheDocument();
  },
};
