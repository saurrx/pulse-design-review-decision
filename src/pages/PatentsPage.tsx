import React, { useRef, useState } from "react";
import { useTrackOnce } from "@/lib/analytics";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/DashboardChrome";
import PatentsContent from "@/components/patents/PatentsContent";
import PatentDetailsContent from "@/components/patents/PatentDetailsContent";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";

const injectGlobalStyles = () => {
  const styleId = "patent-abstract-styles";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      .abstract-cell {
        height: 70px;
        max-height: 70px;
        overflow-y: auto;
        text-align: left;
        padding: 8px;
        border-radius: var(--pl-radius-xs);
        background-color: #f9fafb;
        display: block;
        line-height: 1.4;
        font-size: 0.875rem;
        border: 1px solid #f0f0f0;
        scrollbar-width: thin;
        scrollbar-color: #ddd transparent;
      }
      
      .abstract-cell::-webkit-scrollbar {
        width: 4px;
      }
      
      .abstract-cell::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .abstract-cell::-webkit-scrollbar-thumb {
        background-color: #ddd;
        border-radius: var(--pl-radius-xs);
      }
      
      .abstract-cell::-webkit-scrollbar-thumb:hover {
        background-color: #bbb;
      }
      
      .patent-table {
        border-collapse: separate;
        border-spacing: 0;
        width: 100%;
      }
      
      .patent-table th {
        font-weight: 600;
        color: #555;
        background-color: #f9fafb;
        border-bottom: 2px solid #eee;
        padding: 10px 12px;
        text-align: center;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      
      .patent-table th.index-column,
      .patent-table td.index-column {
        position: sticky;
        left: 0;
        z-index: 20;
        background-color: #FFFFFF !important;
        box-shadow: 1px 0 0 0 rgba(0, 0, 0, 0.1);
      }
      
      .patent-table th.app-number-column,
      .patent-table td.app-number-column {
        position: sticky;
        left: 50px;
        z-index: 19;
        background-color: #FFFFFF !important;
        box-shadow: 1px 0 0 0 rgba(0, 0, 0, 0.1);
      }
      
      .patent-table tr:hover td.index-column,
      .patent-table tr:hover td.app-number-column {
        background-color: #f0f0f0 !important;
      }
      
      .patent-table td.index-column,
      .patent-table td.app-number-column {
        background-color: #FFFFFF !important;
      }
      
      .patent-table tr {
        transition: background-color 0.15s ease;
      }
      
      .patent-table tr:first-child {
        background-color: transparent;
      }
      
      .patent-table tr:first-child:hover {
        background-color: #f0f0f0;
        cursor: pointer;
      }
      
      .patent-table tr:not(:first-child) {
        background-color: transparent;
      }
      
      .patent-table tr:not(:first-child):hover {
        background-color: transparent;
        cursor: default;
      }
      
      .patent-table td {
        vertical-align: middle;
        text-align: center;
        border-bottom: 1px solid #eee;
        padding: 8px 12px;
        display: table-cell;
        align-items: center;
        justify-content: center;
      }
      
      .patent-table th.inventors-column,
      .patent-table td.inventors-column {
        width: 200px;
        min-width: 200px;
        max-width: 200px;
      }
      
      .patent-table th.family-members-column,
      .patent-table td.family-members-column {
        width: 220px;
        min-width: 220px;
        max-width: 220px;
      }
      
      .patent-table th.event-column,
      .patent-table td.event-column {
        width: 150px;
        min-width: 150px;
        max-width: 150px;
      }
      
      .family-member-item {
        font-size: 0.75rem;
        color: #555;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .event-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.15rem 0.5rem;
        border-radius: var(--pl-radius-xs);
        font-size: 0.75rem;
        font-weight: 500;
        background-color: #e0f2fe;
        color: #0369a1;
      }
      
      .status-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem 0.5rem;
        border-radius: var(--pl-radius-xs);
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.025em;
        text-transform: uppercase;
        min-width: 80px;
      }
      
      .status-badge.granted {
        background-color: #ecfdf5;
        color: #065f46;
      }
      
      .status-badge.pending {
        background-color: #fffbeb;
        color: #92400e;
      }
      
      .status-badge.rejected {
        background-color: #fef2f2;
        color: #b91c1c;
      }
      
      .status-badge.draft {
        background-color: #f3f4f6;
        color: #4b5563;
      }
      
      .patent-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }
      
      .patent-action-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        border-radius: var(--pl-radius-sm);
        background-color: transparent;
        color: #6b7280;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      
      .patent-action-button:hover {
        background-color: #f3f4f6;
        color: #1f2937;
      }
      
      @media (max-width: 768px) {
        .patent-table {
          display: block;
          overflow-x: auto;
          white-space: nowrap;
        }
        
        .patent-table th,
        .patent-table td {
          padding: 8px 10px;
          font-size: 0.875rem;
        }
        
        .status-badge {
          min-width: 70px;
          padding: 0.2rem 0.4rem;
          font-size: 0.75rem;
        }
      }
      
      @media (max-width: 640px) {
        .patent-table th,
        .patent-table td {
          padding: 6px 8px;
          font-size: 0.8125rem;
        }
        
        .status-badge {
          min-width: 60px;
          padding: 0.15rem 0.3rem;
          font-size: 0.65rem;
        }
        
        .abstract-cell {
          height: 60px;
          max-height: 60px;
          padding: 6px;
          font-size: 0.8125rem;
        }
      }
      
      .patent-mobile-card {
        border: 1px solid #eee;
        border-radius: var(--pl-radius-md);
        padding: 12px;
        margin-bottom: 12px;
        background-color: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      
      .patent-mobile-card .patent-title {
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 6px;
        color: #333;
      }
      
      .patent-mobile-card .patent-meta {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .patent-mobile-card .meta-item {
        display: flex;
        flex-direction: column;
      }
      
      .patent-mobile-card .meta-label {
        font-size: 0.75rem;
        color: #6b7280;
        margin-bottom: 2px;
      }
      
      .patent-mobile-card .meta-value {
        font-size: 0.8rem;
        font-weight: 500;
      }
      
      .patent-mobile-card .patent-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      }
      
      .metric-card {
        display: flex;
        flex-direction: column;
        padding: 1rem;
        background-color: white;
        border-radius: var(--pl-radius-md);
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        transition: all 0.2s ease;
        height: 100%;
        animation: fadeIn 0.5s ease forwards;
        opacity: 0;
      }
      
      @keyframes fadeIn {
        0% {
          opacity: 0;
          transform: translateY(10px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .animate-fade-in {
        animation: fadeIn 0.5s ease forwards;
      }
      
      .patent-details-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 12px;
      }
      
      .patent-details-title {
        font-size: 1.2rem;
        margin: 8px 0;
      }
      
      .patent-details-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }
      
      .patent-info-grid {
        grid-template-columns: 1fr 1fr;
      }
      
      .patent-timeline-boxes {
        flex-direction: column;
      }
      
      .patent-document-item {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .abstract-card {
        font-size: 0.8125rem;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }
};

const PatentsPage: React.FC = () => {
  const { patentId } = useParams();
  // One route, two screens: the portfolio list and a single record. They answer
  // different questions ("is anyone browsing patents?" vs "which records get
  // opened?"), so they are two events, each fired only on its own branch.
  useTrackOnce("patents_viewed", {}, !patentId);
  useTrackOnce("patent_opened", { patent_id: patentId }, !!patentId);
  const navigate = useNavigate();
  const [totalPatents, setTotalPatents] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  // PatentsContent owns the filter state, so it builds the export URL +
  // triggers the download. We hold a ref to its latest trigger fn here.
  const exportTriggerRef = useRef<(() => Promise<void> | void) | null>(null);
  const handleExportClick = async () => {
    if (!exportTriggerRef.current) return;
    setIsExporting(true);
    try {
      await exportTriggerRef.current();
    } finally {
      setIsExporting(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const patentStatus = searchParams.get("status");

  React.useEffect(() => {
    injectGlobalStyles();
  }, []);

  return (
    <>
      {/* The page's own header controls, rendered here and portalled into the
          layout's header — which now outlives the navigation. */}
      {!patentId && (
        <PageHeader
          actions={
            <>
              <span className="hidden text-xs font-medium text-[var(--pulse-ink-muted)] md:inline">
                {totalPatents} total patents
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportClick}
                disabled={isExporting || totalPatents === 0}
                className="pulse-filter-control h-9 gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {isExporting ? "Exporting..." : "Export CSV"}
                </span>
              </Button>
            </>
          }
        />
      )}
      {/* min-h-[100dvh-64px] made this page GROW: every filter chip row added
          height, the page passed the viewport, and the whole thing — header
          included — scrolled. /due-dates has always been bounded instead
          (min-h-0 flex-1 + overflow-hidden), so its table takes whatever space
          is left at that moment and scrolls inside itself. Same shape here.
          The detail view keeps the old behaviour: it is a document, and a
          document should scroll. */}
      <div
        className={`pulse-product-page pulse-table-page relative mx-auto flex w-full max-w-[1680px] flex-col px-6 py-6 lg:px-8 ${
          patentId ? "min-h-[calc(100dvh-64px)]" : "min-h-0 flex-1 overflow-hidden"
        }`}
      >
        <div className={`flex min-w-0 w-full flex-col ${patentId ? "" : "min-h-0 flex-1"}`}>
          {patentId ? (
            <PatentDetailsContent patentId={patentId} />
          ) : (
            <PatentsContent
              patentStatus={patentStatus}
              setTotalPatents={setTotalPatents}
              setExportTrigger={(fn) => {
                exportTriggerRef.current = fn;
              }}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default PatentsPage;
