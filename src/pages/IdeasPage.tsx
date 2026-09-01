
import React from 'react';
import IdeasContent from '@/components/ideas/IdeasContent';
import ReviewQueueWorkspace from '@/components/review/ReviewQueueWorkspace';
import useUserCookie from '@/hooks/use-auth';

const IdeasPage: React.FC = () => {
  const { user } = useUserCookie();
  const isInHouseCounsel =
    user?.role === 'LEGAL_COUNSEL' || user?.role === 'TECH_COMMITTEE';

  return (
    <>
      {isInHouseCounsel ? (
        <ReviewQueueWorkspace />
      ) : (
        <IdeasContent />
      )}
    </>
  );
};

export default IdeasPage;
