import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { PRODUCT_CARD_CLASS, PRODUCT_CARD_DESCRIPTION_CLASS, PRODUCT_CARD_TITLE_CLASS, PRODUCT_SEGMENTED_CONTROL_CLASS, PRODUCT_SEGMENTED_ITEM_CLASS } from "@/components/ui/product-surfaces";

const meta = { title: "Legacy reference/Primitives/Surfaces", component: Card, parameters: { pulse: { layout: "public", route: "/" }, layout: "padded" } } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;
const Pad = ({ children }: { children: React.ReactNode }) => <div style={{ padding: 24, display: "grid", gap: 20, maxWidth: 720 }}>{children}</div>;

export const Cards: Story = { render: () => <Pad><Card><CardHeader><CardTitle>Portfolio</CardTitle><CardDescription>Granted, pending and inactive rights across jurisdictions.</CardDescription></CardHeader><CardContent><p className="text-sm">14 granted · 6 pending · 2 inactive</p></CardContent></Card><section className={PRODUCT_CARD_CLASS}><h3 className={PRODUCT_CARD_TITLE_CLASS}>Product card recipe</h3><p className={PRODUCT_CARD_DESCRIPTION_CLASS}>The shared class constants from product-surfaces.ts.</p></section></Pad> };
export const Badges: Story = { render: () => <Pad><div className="flex gap-2 flex-wrap"><Badge>Default</Badge><Badge variant="secondary">Secondary</Badge><Badge variant="outline">Outline</Badge><Badge variant="destructive">Destructive</Badge></div></Pad> };
export const TabsAndSegments: Story = { name: "Tabs and segmented control", render: () => <Pad><Tabs defaultValue="summary"><TabsList><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="submission">Submission</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList><TabsContent value="summary"><p className="text-sm">The invention in the inventor's words.</p></TabsContent><TabsContent value="submission"><p className="text-sm">The questionnaire.</p></TabsContent><TabsContent value="activity"><p className="text-sm">Decisions and comments.</p></TabsContent></Tabs><div className={PRODUCT_SEGMENTED_CONTROL_CLASS}><button className={PRODUCT_SEGMENTED_ITEM_CLASS} data-state="active">List</button><button className={PRODUCT_SEGMENTED_ITEM_CLASS}>Calendar</button></div></Pad> };
export const SeparatorsAndScroll: Story = { name: "Separator, scroll area, collapsible", render: () => <Pad><div className="text-sm">Above<Separator className="my-3" />Below</div><ScrollArea className="h-32 rounded border border-[var(--pulse-line)] p-3"><div className="grid gap-2 text-sm">{Array.from({ length: 12 }, (_, i) => <div key={i}>Deadline row {i + 1}</div>)}</div></ScrollArea><Collapsible defaultOpen><CollapsibleTrigger asChild><Button variant="outline" size="sm">Attachments</Button></CollapsibleTrigger><CollapsibleContent><p className="mt-2 text-sm">test-rig-results.pdf · 2.1 MB</p></CollapsibleContent></Collapsible></Pad> };
export const CommandPalette: Story = { name: "Command list", render: () => <Pad><Command className="rounded border border-[var(--pulse-line)]"><CommandInput placeholder="Search a colleague" /><CommandList><CommandEmpty>No colleague found.</CommandEmpty><CommandGroup heading="Inventors"><CommandItem>Priya Raman</CommandItem><CommandItem>Daniel Osei</CommandItem><CommandItem>Hana Kobayashi</CommandItem></CommandGroup></CommandList></Command></Pad> };
