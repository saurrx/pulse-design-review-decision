import React, { useState, useLayoutEffect, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface PatentTooltipProps {
  country: {
    name: string;
    granted: number;
    pending: number;
    id: string;
  };
  position: { x: number; y: number };
  mapRef: React.RefObject<HTMLDivElement>;
  onClose?: () => void;
}

// Create a single global tooltip container with styles
const getTooltipContainer = (): HTMLElement => {
  let container = document.getElementById("patent-tooltip-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "patent-tooltip-container";
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.pointerEvents = "none";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
    
    // Add styles for animations
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes tooltipFadeIn {
        from { 
          opacity: 0; 
          transform: translate(-50%, calc(-100% - 10px));
        }
        to { 
          opacity: 1; 
          transform: translate(-50%, calc(-100% - 20px));
        }
      }
      
      @keyframes tooltipFadeOut {
        from { 
          opacity: 1; 
          transform: translate(-50%, calc(-100% - 20px));
        }
        to { 
          opacity: 0; 
          transform: translate(-50%, calc(-100% - 10px));
        }
      }
      
      .patent-tooltip {
        position: absolute;
        animation: tooltipFadeIn 0.2s ease-out forwards;
        pointer-events: auto;
      }
      
      .patent-tooltip.closing {
        animation: tooltipFadeOut 0.2s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
  }
  return container;
};

const PatentTooltip: React.FC<PatentTooltipProps> = ({ country, position, mapRef, onClose }) => {
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isClosing, setIsClosing] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Handle positioning on mount and position changes
  useLayoutEffect(() => {
    if (mapRef.current && tooltipRef.current) {
      const mapRect = mapRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      // Calculate base position
      let x = mapRect.left + position.x;
      let y = mapRect.top + position.y;
      
      // Define boundaries
      const MARGIN = 20;
      const maxX = window.innerWidth - MARGIN;
      const minX = MARGIN;
      const maxY = window.innerHeight - MARGIN;
      const minY = tooltipRect.height + MARGIN;
      
      // Adjust position to keep tooltip within viewport
      x = Math.min(Math.max(x, minX + tooltipRect.width/2), maxX - tooltipRect.width/2);
      y = Math.min(Math.max(y, minY), maxY);
      
      setTooltipPosition({ x, y });
    }
  }, [position, mapRef]);
  
  // Handle close animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose?.();
    }, 200); // Match animation duration
  };
  
  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Render tooltip through portal
  return createPortal(
    <div
      ref={tooltipRef}
      className={`patent-tooltip ${isClosing ? 'closing' : ''} bg-white rounded-md border border-photon-gray-200 shadow-lg p-3`}
      style={{
        left: `${tooltipPosition.x}px`,
        top: `${tooltipPosition.y}px`,
        minWidth: "200px",
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-gray-900">{country.name}</h3>
        <button 
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 p-1 -m-1 rounded-full"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Granted Patents:</span>
          <span className="font-medium text-green-600">{country.granted}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Pending Patents:</span>
          <span className="font-medium text-yellow-500">{country.pending}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Total:</span>
          <span className="font-medium">{country.granted + country.pending}</span>
        </div>
      </div>
      
      <div className="w-3 h-3 bg-white border-l border-b border-photon-gray-200 absolute left-1/2 -bottom-1.5 -ml-1.5 transform rotate-45"></div>
    </div>,
    getTooltipContainer()
  );
};

export default PatentTooltip;
