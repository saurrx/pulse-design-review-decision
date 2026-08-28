
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FilesTab: React.FC = () => {
  const files = [
    { name: 'Patent Application.pdf', type: 'PDF', size: '2.4 MB', date: '2023-04-15', owner: 'John Smith' },
    { name: 'Technical Documentation.docx', type: 'DOCX', size: '1.8 MB', date: '2023-04-12', owner: 'Sarah Johnson' },
    { name: 'Market Analysis.xlsx', type: 'XLSX', size: '3.2 MB', date: '2023-04-10', owner: 'Michael Brown' },
    { name: 'Product Specifications.pdf', type: 'PDF', size: '4.5 MB', date: '2023-04-08', owner: 'Emily Davis' },
    { name: 'Contract Agreement.pdf', type: 'PDF', size: '1.2 MB', date: '2023-04-05', owner: 'John Smith' },
  ];

  return (
    <Card className="border-photon-gray-200">
      <CardHeader className="bg-photon-gray-100/50 border-b border-b-photon-gray-200">
        <CardTitle className="flex items-center text-photon-primary">
          <FileText className="mr-2 h-5 w-5" />
          Client Files
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-photon-gray-50">
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file, index) => (
                <TableRow key={index} className="hover:bg-photon-gray-50/50">
                  <TableCell className="font-medium">{file.name}</TableCell>
                  <TableCell>{file.type}</TableCell>
                  <TableCell>{file.size}</TableCell>
                  <TableCell>{file.date}</TableCell>
                  <TableCell>{file.owner}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default FilesTab;
