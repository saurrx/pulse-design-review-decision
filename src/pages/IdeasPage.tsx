
import React from 'react';
import IdeasContent from '@/components/ideas/IdeasContent';
import ReviewQueueWorkspace, { type ReviewQueueStoryState } from '@/components/review/ReviewQueueWorkspace';
import useUserCookie from '@/hooks/use-auth';

const IdeasPage: React.FC = () => {
  const { user } = useUserCookie();
  const isInHouseCounsel =
    user?.role === 'LEGAL_COUNSEL' || user?.role === 'TECH_COMMITTEE';
  const previewState = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('reviewStory') as ReviewQueueStoryState | null
    : null;

  return (
    <>
      {isInHouseCounsel ? (
        <ReviewQueueWorkspace storyState={previewState || undefined} />
      ) : (
        <IdeasContent />
      )}
    </>
  );
};

export default IdeasPage;
