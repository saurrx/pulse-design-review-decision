
import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import IdeaDetailsContent from '@/components/ideas/IdeaDetailsContent';
import { useParams } from 'react-router-dom';

const IdeaDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  
  return (
    <DashboardLayout className="h-screen overflow-hidden">
      <IdeaDetailsContent ideaId={id} />
    </DashboardLayout>
  );
};

export default IdeaDetailsPage;
