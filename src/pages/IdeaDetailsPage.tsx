
import React from 'react';
import { MainClass } from '@/components/DashboardChrome';
import IdeaDetailsContent from '@/components/ideas/IdeaDetailsContent';
import { useParams } from 'react-router-dom';

const IdeaDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  
  return (
    <>
      {/* This workspace owns its own scrolling. */}
      <MainClass className="h-screen overflow-hidden" />
      <IdeaDetailsContent ideaId={id} />
    </>
  );
};

export default IdeaDetailsPage;
