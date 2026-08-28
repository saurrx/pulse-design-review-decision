import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface CountrySelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCountries: string[];
  onConfirm: (countries: string[]) => void;
}

const COUNTRIES_BY_REGION: Record<string, string[]> = {
  "North America": ["US", "CA", "MX"],
  Europe: [
    "GB", "DE", "FR", "ES", "IT", "NL", "SE", "CH", "AT", "BE", "DK",
    "FI", "IE", "NO", "PL", "PT", "CZ", "GR", "HU", "RO",
  ],
  Asia: [
    "CN", "JP", "KR", "IN", "SG", "TW", "HK", "TH", "MY", "ID",
    "PH", "VN", "IL",
  ],
  Oceania: ["AU", "NZ"],
  "South America": ["BR", "AR", "CL", "CO", "PE"],
  Africa: ["ZA", "EG", "NG", "KE", "MA"],
  "Middle East": ["AE", "SA", "QA", "KW", "BH"],
};

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", MX: "Mexico",
  GB: "United Kingdom", DE: "Germany", FR: "France", ES: "Spain",
  IT: "Italy", NL: "Netherlands", SE: "Sweden", CH: "Switzerland",
  AT: "Austria", BE: "Belgium", DK: "Denmark", FI: "Finland",
  IE: "Ireland", NO: "Norway", PL: "Poland", PT: "Portugal",
  CZ: "Czech Republic", GR: "Greece", HU: "Hungary", RO: "Romania",
  CN: "China", JP: "Japan", KR: "South Korea", IN: "India",
  SG: "Singapore", TW: "Taiwan", HK: "Hong Kong", TH: "Thailand",
  MY: "Malaysia", ID: "Indonesia", PH: "Philippines", VN: "Vietnam",
  IL: "Israel", AU: "Australia", NZ: "New Zealand",
  BR: "Brazil", AR: "Argentina", CL: "Chile", CO: "Colombia", PE: "Peru",
  ZA: "South Africa", EG: "Egypt", NG: "Nigeria", KE: "Kenya", MA: "Morocco",
  AE: "UAE", SA: "Saudi Arabia", QA: "Qatar", KW: "Kuwait", BH: "Bahrain",
};

const CountrySelector: React.FC<CountrySelectorProps> = ({
  open,
  onOpenChange,
  selectedCountries,
  onConfirm,
}) => {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string[]>(selectedCountries);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRegions = useMemo(() => {
    if (!searchQuery) return COUNTRIES_BY_REGION;

    const query = searchQuery.toLowerCase();
    const result: Record<string, string[]> = {};

    for (const [region, countries] of Object.entries(COUNTRIES_BY_REGION)) {
      const filtered = countries.filter(
        (code) =>
          code.toLowerCase().includes(query) ||
          COUNTRY_NAMES[code]?.toLowerCase().includes(query),
      );
      if (filtered.length > 0) {
        result[region] = filtered;
      }
    }
    return result;
  }, [searchQuery]);

  const toggleCountry = (code: string) => {
    setSelected((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code],
    );
  };

  const handleConfirm = () => {
    onConfirm(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-lg ${
          theme === "dark" ? "bg-zinc-900 border-zinc-700" : "bg-white"
        }`}
      >
        <DialogHeader>
          <DialogTitle>Select Countries</DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search countries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selected.map((code) => (
              <Badge
                key={code}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-red-100"
                onClick={() => toggleCountry(code)}
              >
                {code} - {COUNTRY_NAMES[code]}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}

        <ScrollArea className="h-[300px] pr-4">
          {Object.entries(filteredRegions).map(([region, countries]) => (
            <div key={region} className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                {region}
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {countries.map((code) => (
                  <label
                    key={code}
                    className={`flex items-center gap-2 p-1.5 rounded text-sm cursor-pointer hover:bg-gray-50 ${
                      theme === "dark" ? "hover:bg-zinc-800" : ""
                    }`}
                  >
                    <Checkbox
                      checked={selected.includes(code)}
                      onCheckedChange={() => toggleCountry(code)}
                    />
                    <span className="text-xs">
                      {code} - {COUNTRY_NAMES[code]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.length === 0}
            className="bg-[#F9B418] text-black hover:bg-[#e5a516]"
          >
            Confirm ({selected.length} selected)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CountrySelector;
