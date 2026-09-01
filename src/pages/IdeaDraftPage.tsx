import React from 'react';
import DraftWorkspace from '@/components/ideas/DraftWorkspace';
import { useParams } from 'react-router-dom';

const IdeaDraftPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <>
      <DraftWorkspace ideaId={id} />
    </>
  );
};

export default IdeaDraftPage;
