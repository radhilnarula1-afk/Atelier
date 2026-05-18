import React from "react";

interface AtelierLogoProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  showFrame?: boolean;
}

export default function AtelierLogo({ 
  width = 180, 
  height = 120, 
  className = "", 
  showFrame = true 
}: AtelierLogoProps) {
  return (
    <svg 
      viewBox="0 0 300 200" 
      width={width} 
      height={height} 
      className={`text-foreground fill-none stroke-current ${className}`}
      style={{ strokeWidth: 1 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ─── COAT HANGER ICON ─── */}
      {/* Hook curve */}
      <path 
        d="M 150,42 C 150,26 163,26 163,33 C 163,43 148,40 148,48" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        stroke="currentColor"
      />
      {/* Hanger bottom triangle */}
      <path 
        d="M 148,48 L 115,70 C 112,72 114,74 118,74 L 182,74 C 186,74 188,72 185,70 Z" 
        strokeWidth="1.5" 
        strokeLinejoin="round" 
        stroke="currentColor"
      />

      {/* ─── RECTANGULAR FRAME ─── */}
      {showFrame && (
        <>
          {/* Top-Left Border segment */}
          <line x1="20" y1="52" x2="105" y2="52" stroke="currentColor" strokeWidth="1.2" />
          {/* Top-Right Border segment */}
          <line x1="195" y1="52" x2="280" y2="52" stroke="currentColor" strokeWidth="1.2" />
          {/* Left vertical border */}
          <line x1="20" y1="52" x2="20" y2="180" stroke="currentColor" strokeWidth="1.2" />
          {/* Right vertical border */}
          <line x1="280" y1="52" x2="280" y2="180" stroke="currentColor" strokeWidth="1.2" />
          {/* Bottom horizontal border */}
          <line x1="20" y1="180" x2="280" y2="180" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}

      {/* ─── ATELIER serif font ─── */}
      <text 
        x="150" 
        y="120" 
        textAnchor="middle" 
        style={{ 
          fontFamily: "'Fraunces', Georgia, serif", 
          fontSize: "38px", 
          fontWeight: 400,
          letterSpacing: "0.15em",
          fill: "currentColor",
          stroke: "none"
        }}
      >
        ATELIER
      </text>

      {/* ─── DIVISION LINE ─── */}
      <line x1="55" y1="140" x2="245" y2="140" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />

      {/* ─── AI COUTURE sans-serif font ─── */}
      <text 
        x="150" 
        y="161" 
        textAnchor="middle" 
        style={{ 
          fontFamily: "'Inter', system-ui, sans-serif", 
          fontSize: "10px", 
          fontWeight: 500,
          letterSpacing: "0.45em",
          fill: "currentColor",
          stroke: "none"
        }}
      >
        AI COUTURE
      </text>
    </svg>
  );
}
