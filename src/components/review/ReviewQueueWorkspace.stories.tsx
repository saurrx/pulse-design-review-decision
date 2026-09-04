import React from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReviewQueueWorkspace, { type ReviewQueueStoryState } from "./ReviewQueueWorkspace";

const states: ReviewQueueStoryState[] = ["typical", "not-evaluated", "long-title", "already-decided", "empty-queue", "error", "no-attachments-not-recommended", "long-summary"];
const Story = ({ state }: { state: ReviewQueueStoryState }) => <QueryClientProvider client={new QueryClient()}><MemoryRouter><div className="flex h-screen"><ReviewQueueWorkspace storyState={state}/></div></MemoryRouter></QueryClientProvider>;

export default { title: "Workspace admin/Review queue", component: ReviewQueueWorkspace, parameters: { layout: "fullscreen" } };
export const Typical = () => <Story state={states[0]}/>;
export const NotEvaluated = () => <Story state={states[1]}/>;
export const LongTitle = () => <Story state={states[2]}/>;
export const AlreadyDecided = () => <Story state={states[3]}/>;
export const EmptyQueue = () => <Story state={states[4]}/>;
export const Error = () => <Story state={states[5]}/>;
export const NoAttachmentsNotRecommended = () => <Story state={states[6]}/>;
export const LongSummary = () => <Story state={states[7]}/>;
