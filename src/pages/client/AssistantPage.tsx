import { MessageSquareText } from "lucide-react";

const AssistantPage = () => {
  return (
    <>
      <div className="flex min-h-full flex-col bg-[#f7f7f5]">
        <div className="flex flex-1 items-start justify-center p-6">
          <section className="w-full max-w-2xl rounded-md border border-neutral-200 bg-white px-8 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-[#fff6df] text-[#9c6b00]">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="mt-5 inline-flex rounded-xs border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
              Coming soon
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-neutral-950">
              Patent intelligence, without losing the source
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
              This space is reserved for an evidence-linked assistant. It will
              cite the disclosure, draft, or filing record behind every answer.
            </p>
          </section>
        </div>
      </div>
    </>
  );
};

export default AssistantPage;
