import React, { useState, useRef, useMemo, useEffect } from "react";
import { ZoomIn, ZoomOut, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import useUserCookie from "@/hooks/use-auth";
import { useTheme } from "@/hooks/useTheme";
import { useQuery } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from "react-simple-maps";
import { motion } from "framer-motion";

// Add color constants
const COLORS = {
  GRANTED: "rgb(140, 220, 190, 0.1)", // Green-500
  PENDING: "#ffffff99", // Amber-500
  GRANTED_LIGHT: "rgba(34, 197, 94, 0.5)",
  PENDING_LIGHT: "rgba(245, 158, 11, 0.5)",
};

// Fixed marker sizes
const MARKER = {
  DEFAULT_SIZE: 2,
  SELECTED_SIZE: 2.5,
};

// Helper function to calculate marker size
const calculateMarkerSize = (granted: number, pending: number) => {
  const total = granted + pending;
  // Base size is 6, max size is 15
  return Math.min(15, Math.max(6, Math.log(total + 1) * 3 + 6));
};

// Define types for patent data
interface PatentData {
  id: string;
  publication_country: string;
  current_status: string;
  legal_current_status: string;
  title: string;
  // Add other fields as needed
}

// Define country position mapping - using longitude/latitude coordinates
interface CountryPosition {
  id: string;
  country: string;
  position: { x: number; y: number }; // x = longitude, y = latitude
}

// 2-letter publication country -> ISO3 code used by the topojson's iso_code.
const ISO2_TO_ISO3: Record<string, string> = {
  us: "USA", ca: "CAN", mx: "MEX", gb: "GBR", de: "DEU", fr: "FRA", it: "ITA",
  es: "ESP", nl: "NLD", be: "BEL", ch: "CHE", se: "SWE", at: "AUT", pl: "POL",
  no: "NOR", dk: "DNK", fi: "FIN", ie: "IRL", pt: "PRT", gr: "GRC", cz: "CZE",
  cn: "CHN", jp: "JPN", in: "IND", kr: "KOR", sg: "SGP", tw: "TWN", il: "ISR",
  th: "THA", my: "MYS", vn: "VNM", ph: "PHL", id: "IDN", ae: "ARE", sa: "SAU",
  tr: "TUR", au: "AUS", nz: "NZL", br: "BRA", ar: "ARG", cl: "CHL", za: "ZAF",
  ru: "RUS", hk: "HKG",
};

// Neutral-to-navy density keeps the map branded without implying success.
const navyFor = (total: number, max: number) => {
  const t = max > 0 ? total / max : 0;
  const k = 0.25 + 0.75 * t;
  const from = [0xee, 0xee, 0xf5];
  const to = [0x11, 0x10, 0x3c];
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

// Country code mapping to standardize different formats
const COUNTRY_CODE_MAP: Record<string, string> = {
  // Standard 2-letter country codes - North America
  us: "us",
  ca: "ca",
  mx: "mx",

  // Europe
  gb: "gb",
  de: "de",
  fr: "fr",
  it: "it",
  es: "es",
  nl: "nl",
  be: "be",
  ch: "ch",
  se: "se",
  at: "at",
  pl: "pl",
  no: "no",
  dk: "dk",
  fi: "fi",
  ie: "ie",
  pt: "pt",
  gr: "gr",
  cz: "cz",
  ro: "ro",
  hu: "hu",
  lu: "lu",
  ee: "ee",
  lv: "lv",
  lt: "lt",
  si: "si",
  sk: "sk",
  bg: "bg",
  hr: "hr",
  cy: "cy",

  // Asia
  cn: "cn",
  jp: "jp",
  in: "in",
  kr: "kr",
  sg: "sg",
  tw: "tw",
  il: "il",
  hk: "hk",
  th: "th",
  my: "my",
  vn: "vn",
  ph: "ph",
  id: "id",
  ae: "ae",
  sa: "sa",
  tr: "tr",
  qa: "qa",
  kw: "kw",

  // Oceania
  au: "au",
  nz: "nz",

  // Central/South America
  br: "br",
  ar: "ar",
  cl: "cl",
  co: "co",
  pe: "pe",
  uy: "uy",
  ec: "ec",
  ve: "ve",
  pa: "pa",

  // Africa and Middle East
  ru: "ru",
  za: "za",
  eg: "eg",
  ma: "ma",
  ng: "ng",

  // Alternative codes and spelled out names - North America
  usa: "us",
  "united states": "us",
  "u.s.a": "us",
  "u.s": "us",
  america: "us",
  canada: "ca",
  mexico: "mx",
  méxico: "mx",

  // Europe
  "united kingdom": "gb",
  uk: "gb",
  "great britain": "gb",
  england: "gb",
  germany: "de",
  deutschland: "de",
  "bundesrepublik deutschland": "de",
  france: "fr",
  "république française": "fr",
  italy: "it",
  italia: "it",
  "republic of italy": "it",
  spain: "es",
  españa: "es",
  "kingdom of spain": "es",
  netherlands: "nl",
  holland: "nl",
  nederland: "nl",
  belgium: "be",
  belgië: "be",
  belgique: "be",
  switzerland: "ch",
  schweiz: "ch",
  suisse: "ch",
  svizzera: "ch",
  sweden: "se",
  sverige: "se",
  "kingdom of sweden": "se",
  austria: "at",
  österreich: "at",
  "republic of austria": "at",
  poland: "pl",
  polska: "pl",
  "republic of poland": "pl",
  norway: "no",
  norge: "no",
  "kingdom of norway": "no",
  denmark: "dk",
  danmark: "dk",
  "kingdom of denmark": "dk",
  finland: "fi",
  suomi: "fi",
  "republic of finland": "fi",
  ireland: "ie",
  éire: "ie",
  "republic of ireland": "ie",
  portugal: "pt",
  "república portuguesa": "pt",
  greece: "gr",
  ελλάδα: "gr",
  "hellenic republic": "gr",
  "czech republic": "cz",
  česko: "cz",
  czechia: "cz",
  romania: "ro",
  românia: "ro",
  hungary: "hu",
  magyarország: "hu",
  luxembourg: "lu",
  estonia: "ee",
  eesti: "ee",
  latvia: "lv",
  latvija: "lv",
  lithuania: "lt",
  lietuva: "lt",
  slovenia: "si",
  slovenija: "si",
  slovakia: "sk",
  slovensko: "sk",
  bulgaria: "bg",
  българия: "bg",
  croatia: "hr",
  hrvatska: "hr",
  cyprus: "cy",
  κύπρος: "cy",
  kıbrıs: "cy",

  // Asia
  china: "cn",
  "people's republic of china": "cn",
  zhongguo: "cn",
  prc: "cn",
  japan: "jp",
  nippon: "jp",
  nihon: "jp",
  india: "in",
  bharat: "in",
  "republic of india": "in",
  "south korea": "kr",
  korea: "kr",
  "republic of korea": "kr",
  hanguk: "kr",
  singapore: "sg",
  "republic of singapore": "sg",
  taiwan: "tw",
  "republic of china": "tw",
  "chinese taipei": "tw",
  israel: "il",
  "state of israel": "il",
  "isra'il": "il",
  "hong kong": "hk",
  "hong kong sar": "hk",
  hksar: "hk",
  thailand: "th",
  "prathet thai": "th",
  "kingdom of thailand": "th",
  siam: "th",
  malaysia: "my",
  vietnam: "vn",
  "viet nam": "vn",
  "socialist republic of vietnam": "vn",
  philippines: "ph",
  "republic of the philippines": "ph",
  pilipinas: "ph",
  indonesia: "id",
  "republic of indonesia": "id",
  "united arab emirates": "ae",
  uae: "ae",
  emirates: "ae",
  "saudi arabia": "sa",
  ksa: "sa",
  "kingdom of saudi arabia": "sa",
  turkey: "tr",
  türkiye: "tr",
  "republic of turkey": "tr",
  qatar: "qa",
  "state of qatar": "qa",
  kuwait: "kw",
  "state of kuwait": "kw",

  // Oceania
  australia: "au",
  "commonwealth of australia": "au",
  "new zealand": "nz",
  aotearoa: "nz",

  // Central/South America
  brazil: "br",
  brasil: "br",
  "federative republic of brazil": "br",
  argentina: "ar",
  "argentine republic": "ar",
  chile: "cl",
  "republic of chile": "cl",
  colombia: "co",
  "republic of colombia": "co",
  peru: "pe",
  "república del perú": "pe",
  "republic of peru": "pe",
  uruguay: "uy",
  "oriental republic of uruguay": "uy",
  ecuador: "ec",
  "republic of ecuador": "ec",
  venezuela: "ve",
  "bolivarian republic of venezuela": "ve",
  panama: "pa",
  "republic of panama": "pa",

  // Africa and Middle East
  russia: "ru",
  "russian federation": "ru",
  rossiya: "ru",
  "south africa": "za",
  "republic of south africa": "za",
  egypt: "eg",
  "arab republic of egypt": "eg",
  misr: "eg",
  morocco: "ma",
  "kingdom of morocco": "ma",
  "al-maghrib": "ma",
  nigeria: "ng",
  "federal republic of nigeria": "ng",

  // Patent offices
  ep: "epo",
  epo: "epo",
  "european patent office": "epo",
  "european patent": "epo",
  eu: "epo",
  eur: "epo",
  wo: "wipo",
  wipo: "wipo",
  "world intellectual property organization": "wipo",
  pct: "wipo",
  international: "wipo",
  int: "wipo",

  // Other standardization
  euipo: "epo",
  "eu-ipo": "epo",
  "european union intellectual property office": "epo",
  uspto: "us",
  "united states patent and trademark office": "us",
  sipo: "cn",
  cnipa: "cn",
  "china national intellectual property administration": "cn",
  jpo: "jp",
  "japan patent office": "jp",
  kipo: "kr",
  "korean intellectual property office": "kr",
};

const PatentWorldMap = (props: any) => {
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(
    null,
  );
  const { user } = useUserCookie();
  const { theme } = useTheme();

  const { isPatentDialogOpen, setIsPatentDialogOpen } = props;
  const mapHeight = Number(props.height) || 480;
  // DSN-0002 (Workspace Admin dashboard): a title and subtitle that state the
  // total, a jurisdiction list as the text alternative, and country clicks
  // that open the Patent Portfolio for that jurisdiction.
  const v0 = props.v0 as
    | { title: string; subtitle: string; onOpenJurisdiction?: (jurisdiction: string) => void; heading?: "h2" | "h3" }
    | undefined;

  const { isFetching: isFetchingPatents, data: patentData } = useQuery({
    queryKey: ["patents", user?.client_id],
    queryFn: async () => {
      const response = await API_CONFIG.get(`/api/v1/patent/all-stats/client`);

      if (response.status === 200) {
        return response?.data?.data;
      }
    },
    enabled: !!user?.client_id,
    refetchOnMount: true,
  });

  // Country position mapping - using longitude/latitude coordinates for react-simple-maps
  const countryPositions: CountryPosition[] = [
    // North America
    { id: "us", country: "United States", position: { x: -95, y: 39 } }, // Approximate center of USA
    { id: "ca", country: "Canada", position: { x: -106, y: 56 } }, // Approximate center of Canada
    { id: "mx", country: "Mexico", position: { x: -102, y: 23 } }, // Approximate center of Mexico

    // Europe
    { id: "gb", country: "United Kingdom", position: { x: -2, y: 54 } }, // UK
    { id: "ru", country: "Russia", position: { x: 105, y: 61 } }, // Russia (eastern part)

    // Asia & Middle East
    { id: "cn", country: "China", position: { x: 104, y: 35 } }, // China
    { id: "jp", country: "Japan", position: { x: 138, y: 36 } }, // Japan
    { id: "kr", country: "South Korea", position: { x: 127, y: 36 } }, // South Korea
    { id: "tw", country: "Taiwan", position: { x: 121, y: 24 } }, // Taiwan
    { id: "in", country: "India", position: { x: 77, y: 20 } }, // India
    { id: "il", country: "Israel", position: { x: 35, y: 31 } }, // Israel
    { id: "ae", country: "UAE", position: { x: 54, y: 24 } }, // UAE

    // Oceania
    { id: "au", country: "Australia", position: { x: 133, y: -25 } }, // Australia

    // South America
    { id: "br", country: "Brazil", position: { x: -47, y: -15 } }, // Brazil

    // Africa
    { id: "za", country: "South Africa", position: { x: 25, y: -29 } }, // South Africa

    // Additional Asia & Southeast Asia
    { id: "sg", country: "Singapore", position: { x: 103, y: 1 } }, // Singapore
    { id: "my", country: "Malaysia", position: { x: 102, y: 4 } }, // Malaysia
    { id: "tr", country: "Turkey", position: { x: 35, y: 39 } }, // Turkey

    // Additional Americas
    { id: "ar", country: "Argentina", position: { x: -63, y: -38 } }, // Argentina
    { id: "cl", country: "Chile", position: { x: -71, y: -35 } }, // Chile

    // Additional Oceania
    { id: "nz", country: "New Zealand", position: { x: 174, y: -41 } }, // New Zealand

    // Patent offices
    {
      id: "epo",
      country: "European Patent Office",
      position: { x: 11, y: 48 },
    }, // Munich, Germany (EPO headquarters)
    { id: "wipo", country: "WIPO", position: { x: 6, y: 46 } }, // Geneva, Switzerland (WIPO headquarters)
  ];

  // Process patent data to count patents by country
  const countryPatentData = useMemo(() => {
    if (!patentData || !Array.isArray(patentData)) {
      console.log("No patent data available or data is not an array");
      return [];
    }

    // Convert API data to our display format
    return countryPositions.map((country) => {
      // Find matching country data from API response
      const countryStats = patentData.find(
        (stat: any) =>
          COUNTRY_CODE_MAP[stat.publication_country.toLowerCase()] ===
          country.id.toLowerCase(),
      );

      return {
        ...country,
        granted: countryStats?.granted_patents || 0,
        pending: countryStats?.pending_patents || 0,
      };
    });
  }, [patentData]);

  // Filter to only show countries with patents (granted or pending)
  const countriesWithPatents = useMemo(() => {
    return countryPatentData.filter(
      (country) => country.granted > 0 || country.pending > 0,
    );
  }, [countryPatentData]);

  // Choropleth data keyed by the topojson's ISO3 code.
  const countsByIso3 = useMemo(() => {
    const out: Record<string, { granted: number; pending: number; total: number }> = {};
    if (Array.isArray(patentData)) {
      patentData.forEach((stat: any) => {
        const iso3 = ISO2_TO_ISO3[String(stat.publication_country).toLowerCase()];
        if (!iso3) return;
        const cur = out[iso3] || { granted: 0, pending: 0, total: 0 };
        cur.granted += stat.granted_patents || 0;
        cur.pending += stat.pending_patents || 0;
        cur.total = cur.granted + cur.pending;
        out[iso3] = cur;
      });
    }
    return out;
  }, [patentData]);
  const maxCountryTotal = useMemo(
    () => Math.max(1, ...Object.values(countsByIso3).map((c) => c.total)),
    [countsByIso3],
  );
  const minCountryTotal = useMemo(() => {
    const totals = Object.values(countsByIso3)
      .map((country) => country.total)
      .filter((total) => total > 0);
    return totals.length ? Math.min(...totals) : 0;
  }, [countsByIso3]);

  const [zoomLevel, setZoomLevel] = useState(2);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const rootContainerRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    country: any;
  } | null>(null);

  const handleMarkerClick = (countryId: string) => {
    setSelectedCountryId((prevId) => (prevId === countryId ? null : countryId));
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 1.5));
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Close tooltip when clicking on the map background
    // Tooltip clicks are prevented from triggering this with stopPropagation
    if (selectedCountryId && !e.defaultPrevented) {
      setSelectedCountryId(null);
      setTooltipPosition(null);
    }
  };

  // Clear tooltip when selection changes
  useEffect(() => {
    if (!selectedCountryId) {
      setTooltipPosition(null);
    }
  }, [selectedCountryId]);

  // Show loading state while fetching
  if (isFetchingPatents) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] px-6 pt-6 [box-shadow:var(--pulse-shadow-card)] ${
          theme === "dark" ? "card-elevated-dark" : "card-elevated-light"
        }`}
        style={{ height: mapHeight }}
      >
        <div className="flex items-center justify-center h-full">
          <div
            className={
              theme === "dark" ? "text-zinc-400" : "text-photon-gray-600"
            }
          >
            Loading patent data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={rootContainerRef}
      className={`relative border border-[var(--pulse-line)] [box-shadow:var(--pulse-shadow-card)] ${
        isPatentDialogOpen ? "h-full rounded-2xl" : "rounded-2xl"
      } flex flex-col transition-all overflow-hidden group ${
        isPatentDialogOpen
          ? `${
              theme === "dark"
                ? "bg-zinc-900 border-[#cccccc20]"
                : "bg-neutral-50"
            }`
          : `${theme === "dark" ? "card-elevated-dark" : "bg-white"}`
      }`}
      style={isPatentDialogOpen ? undefined : { height: mapHeight }}
    >
      <div className="relative z-10 flex flex-col h-full">
        <div
          className={`flex items-center justify-between pb-2 z-50 rounded-none ${
            isPatentDialogOpen
              ? `${theme === "dark" ? "bg-neutral-900" : "bg-neutral-50"}`
              : `${
                  theme === "dark"
                    ? "bg-neutral-900 group-hover:bg-neutral-900"
                    : "bg-white"
                }`
          } pt-6 px-6`}
        >
          <div>
            {v0?.heading === "h2" ? (
              <h2 className="font-sans text-[16px] font-semibold leading-5 tracking-[-0.015em] text-[var(--pulse-ink)]">{v0.title}</h2>
            ) : (
              <h3
                className={`font-sans text-[15px] font-semibold tracking-[-0.01em] ${
                  theme === "dark" ? "text-white" : "text-neutral-900"
                }`}
              >
                {v0?.title ?? "Patent World Map"}
              </h3>
            )}
            <p
              className={`mt-1 font-sans text-xs label-muted ${
                theme === "dark" ? "text-zinc-400" : "text-neutral-500"
              }`}
            >
              {v0?.subtitle ?? "Global patent distribution by country"}
            </p>
            {v0 && countriesWithPatents.length > 0 && (
              // The text alternative to the map: the same counts as a list, one line until opened.
              <details className="mt-1 font-sans text-xs text-[var(--pulse-ink-muted)]">
                <summary className="cursor-pointer select-none hover:text-[var(--pulse-ink)]">By jurisdiction</summary>
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5" aria-label="Patents by jurisdiction">
                  {[...countriesWithPatents].sort((a: any, b: any) => (b.granted + b.pending) - (a.granted + a.pending)).map((c: any) => (
                    <li key={c.id} className="text-[var(--pulse-ink-secondary)]">{c.country} <span className="font-semibold text-[var(--pulse-ink)]">{c.granted + c.pending}</span></li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <div
            className={`inline-flex overflow-hidden rounded-lg border ${
              theme === "dark"
                ? "border-zinc-700 bg-zinc-800/50"
                : "border-[var(--pulse-line)] bg-white"
            }`}
          >
            <button
              disabled={zoomLevel <= 1.5}
              onClick={handleZoomOut}
              className={`grid h-9 w-9 place-items-center transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                theme === "dark"
                  ? "text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100"
                  : "text-zinc-600 hover:bg-[var(--pulse-surface-subtle)] hover:text-zinc-900"
              }`}
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomIn}
              className={`grid h-9 w-9 place-items-center border-l transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                theme === "dark"
                  ? "border-zinc-700 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100"
                  : "border-[var(--pulse-line)] text-zinc-600 hover:bg-[var(--pulse-surface-subtle)] hover:text-zinc-900"
              }`}
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPatentDialogOpen()}
              aria-label="Expand patent map"
              className={`grid h-9 w-9 place-items-center border-l transition-colors ${
                theme === "dark"
                  ? "border-zinc-700 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100"
                  : "border-[var(--pulse-line)] text-zinc-600 hover:bg-[var(--pulse-surface-subtle)] hover:text-zinc-900"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-maximize2 lucide-maximize-2 w-4 h-4"
              >
                <path d="M15 3h6v6"></path>
                <path d="m21 3-7 7"></path>
                <path d="m3 21 7-7"></path>
                <path d="M9 21H3v-6"></path>
              </svg>
            </button>
          </div>
        </div>
        <div
          className={`-mt-2 z-10 px-6 pb-4 ${
            isPatentDialogOpen
              ? `${theme === "dark" ? "bg-neutral-900" : "bg-neutral-50"}`
              : `${
                  theme === "dark"
                    ? "bg-neutral-900 group-hover:bg-neutral-900"
                    : "bg-white"
                }`
          } pt-4 px-6 rounded-none`}
        >
          <div className="flex items-center gap-3 text-xs">
            <span
              className={`font-medium ${
                theme === "dark" ? "text-zinc-300" : "text-zinc-600"
              }`}
            >
              {minCountryTotal} patent{minCountryTotal === 1 ? "" : "s"}
            </span>
            <div
              className="h-2 w-28 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #EEEEF5 0%, #11103C 100%)",
              }}
            />
            <span
              className={`font-medium ${
                theme === "dark" ? "text-zinc-300" : "text-zinc-600"
              }`}
            >
              {maxCountryTotal} patent{maxCountryTotal === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <div className="relative w-full h-full flex flex-col">
            <div
              className={`flex-1 relative overflow-visible ${
                isPatentDialogOpen &&
                "dark:bg-neutral-900 dark:group-hover:bg-neutral-800/20 bg-neutral-50"
              }`}
              ref={mapContainerRef}
            >
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transition: "transform 0.3s ease-out",
                  overflow: "visible", // Changed to visible to prevent clipping tooltips
                }}
                onClick={handleMapClick}
              >
                {/* SVG map using react-simple-maps - matches Figma structure */}
                <ComposableMap
                  projection="geoEquirectangular"
                  projectionConfig={{
                    scale: 140,
                    center: [0, 10],
                  }}
                  width={800}
                  height={600}
                  style={{ width: "100%", height: "100%" }}
                >
                  <ZoomableGroup>
                    <Geographies geography="/world-india-pov.json">
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const stat =
                            countsByIso3[geo.properties?.iso_code as string];
                          const baseFill = stat
                            ? navyFor(stat.total, maxCountryTotal)
                            : theme === "dark"
                              ? "#27272a"
                              : "#e4e4e7";
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={baseFill}
                              stroke={
                                stat
                                  ? "#11103C"
                                  : theme === "dark"
                                    ? "#18181b"
                                    : "#d4d4d8"
                              }
                              strokeWidth={stat ? 0.8 : 0.5}
                              tabIndex={-1}
                              className="rsm-geography"
                              onClick={() => {
                                if (!stat || !v0?.onOpenJurisdiction) return;
                                const iso2 = Object.entries(ISO2_TO_ISO3).find(([, iso3]) => iso3 === geo.properties?.iso_code)?.[0];
                                v0.onOpenJurisdiction((iso2 ?? String(geo.properties?.iso_code ?? "")).toUpperCase());
                              }}
                              onMouseEnter={(e: React.MouseEvent) => {
                                if (!stat) return;
                                if (
                                  mapContainerRef.current &&
                                  rootContainerRef.current
                                ) {
                                  const mapRect =
                                    mapContainerRef.current.getBoundingClientRect();
                                  const rootRect =
                                    rootContainerRef.current.getBoundingClientRect();
                                  setTooltipPosition({
                                    x:
                                      e.clientX -
                                      mapRect.left +
                                      (mapRect.left - rootRect.left),
                                    y:
                                      e.clientY -
                                      mapRect.top +
                                      (mapRect.top - rootRect.top) -
                                      16,
                                    country: {
                                      id: geo.properties?.iso_code,
                                      country: geo.properties?.name,
                                      ...stat,
                                    },
                                  });
                                }
                              }}
                              onMouseLeave={() => setTooltipPosition(null)}
                              style={{
                                default: { outline: "none" },
                                hover: {
                                  outline: "none",
                                  fill: stat ? "#F9B418" : baseFill,
                                  cursor: stat ? "pointer" : "default",
                                },
                                pressed: { outline: "none" },
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>

                  </ZoomableGroup>
                </ComposableMap>

                {/* Base layer: no data message */}
                {countriesWithPatents.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={v0 ? "text-[13px] text-[var(--pulse-ink-muted)]" : "text-photon-gray-600 text-lg"}>
                      {v0 ? "No patents added yet" : "No patent data available"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tooltip rendered outside map container to appear above header */}
        {tooltipPosition && (
          <div
            className="absolute z-[100] pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${Math.max(10, tooltipPosition.y)}px`,
              transform: 'translate(-50%, -100%)',
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div
              className={`${
                theme === "dark"
                  ? "border-[#cccccc20] bg-[#1b1b1b]"
                  : "border-gray-200 bg-white"
              } patent-tooltip rounded-lg shadow-lg p-2 border pointer-events-auto`}
              style={{
                filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))",
                minWidth: "160px",
              }}
            >
              <div
                className={`${
                  theme === "dark"
                    ? "text-zinc-200"
                    : "text-zinc-900"
                } text-left font-semibold text-xs mb-2`}
              >
                {tooltipPosition.country.country} ·{" "}
                {(tooltipPosition.country.granted || 0) +
                  (tooltipPosition.country.pending || 0)}{" "}
                patent
                {(tooltipPosition.country.granted || 0) +
                  (tooltipPosition.country.pending || 0) ===
                1
                  ? ""
                  : "s"}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span
                    className={`${
                      theme === "dark"
                        ? "text-zinc-200"
                        : "text-zinc-900"
                    } text-xs`}
                  >
                    <span className="font-semibold">
                      {tooltipPosition.country.granted}
                    </span>{" "}
                    granted
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <span
                    className={`${
                      theme === "dark"
                        ? "text-zinc-200"
                        : "text-zinc-900"
                    } text-xs`}
                  >
                    <span className="font-semibold">
                      {tooltipPosition.country.pending}
                    </span>{" "}
                    pending
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PatentWorldMap;
