
import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import IdeasContent from '@/components/ideas/IdeasContent';
import ReviewQueueWorkspace from '@/components/review/ReviewQueueWorkspace';
import useUserCookie from '@/hooks/use-auth';

const IdeasPage: React.FC = () => {
  const { user } = useUserCookie();
  const isInHouseCounsel =
    user?.role === 'LEGAL_COUNSEL' || user?.role === 'TECH_COMMITTEE';

  return (
    <DashboardLayout>
      {isInHouseCounsel ? (
        <ReviewQueueWorkspace />
      ) : (
        <IdeasContent />
      )}
    </DashboardLayout>
  );
};

export default IdeasPage;
