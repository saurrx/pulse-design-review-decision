import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import DraftWorkspace from '@/components/ideas/DraftWorkspace';
import { useParams } from 'react-router-dom';

const IdeaDraftPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <DashboardLayout>
      <DraftWorkspace ideaId={id} />
    </DashboardLayout>
  );
};

export default IdeaDraftPage;
