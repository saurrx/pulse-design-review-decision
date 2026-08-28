import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface Attorney {
  id: number;
  name: string;
  email: string;
}

export default function AttorneyOCForm() {
  const [open, setOpen] = useState(false);
  const [ocName, setOcName] = useState("");
  const [attorneys, setAttorneys] = useState<Attorney[]>([
    { id: 1, name: "", email: "" },
    { id: 2, name: "", email: "" },
  ]);

  const addAttorney = () => {
    const newId =
      attorneys.length > 0 ? Math.max(...attorneys.map((a) => a.id)) + 1 : 1;
    setAttorneys([...attorneys, { id: newId, name: "", email: "" }]);
  };

  const removeAttorney = (id: number) => {
    if (attorneys.length > 1) {
      setAttorneys(attorneys.filter((attorney) => attorney.id !== id));
    }
  };

  const handleNameChange = (id: number, value: string) => {
    setAttorneys(
      attorneys.map((attorney) =>
        attorney.id === id ? { ...attorney, name: value } : attorney
      )
    );
  };

  const handleEmailChange = (id: number, value: string) => {
    setAttorneys(
      attorneys.map((attorney) =>
        attorney.id === id ? { ...attorney, email: value } : attorney
      )
    );
  };

  const handleConfirm = () => {
    // Handle form submission here
    setOpen(false);
  };

  return (
    <div className="flex justify-center">
      <Button onClick={() => setOpen(true)}>Open OC Form</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Add new OC</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-6 w-6 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="ocName" className="text-sm font-medium">
                Name of OC
              </label>
              <Input
                name="ocname"
                id="ocName"
                placeholder="Enter name of OC here"
                value={ocName}
                onChange={(e) => setOcName(e.target.value)}
              />
            </div>

            {attorneys.map((attorney, index) => (
              <div key={attorney.id} className="space-y-3">
                <div className="flex items-center">
                  <h3 className="text-sm font-medium text-[#800000]">
                    Attorney {attorney.id}
                  </h3>
                  {attorney.id !== 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttorney(attorney.id)}
                      className="ml-auto h-6 w-6 text-[#800000]"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Separator className="flex-1 mx-2 bg-[#800000]" />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={`name-${attorney.id}`}
                    className="text-sm font-medium"
                  >
                    Name
                  </label>
                  <Input
                    name="email"
                    id={`name-${attorney.id}`}
                    placeholder={`Enter name ${
                      index === 0 ? "of here" : "here"
                    }`}
                    value={attorney.name}
                    onChange={(e) =>
                      handleNameChange(attorney.id, e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={`email-${attorney.id}`}
                    className="text-sm font-medium"
                  >
                    E-mail
                  </label>
                  <Input
                    name="email"
                    id={`email-${attorney.id}`}
                    placeholder={`Enter e-mail ${
                      index === 0 ? "of here" : index === 1 ? "1 here" : "here"
                    }`}
                    value={attorney.email}
                    onChange={(e) =>
                      handleEmailChange(attorney.id, e.target.value)
                    }
                  />
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={addAttorney}
              className="w-full border-[#800000] text-[#800000] hover:bg-[#800000]/10"
            >
              <Plus className="mr-2 h-4 w-4" /> Add new attorney
            </Button>

            <div className="flex justify-end">
              <Button
                onClick={handleConfirm}
                className="bg-gray-500 hover:bg-gray-600 text-white"
              >
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
