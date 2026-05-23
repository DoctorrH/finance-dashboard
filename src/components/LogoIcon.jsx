import React from 'react';

export default function LogoIcon({ size = 28, style }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ 
        filter: 'drop-shadow(0px 2px 6px rgba(16, 185, 129, 0.25))',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style 
      }}
    >
      <defs>
        {/* Wallet color gradient */}
        <linearGradient id="walletGrad" x1="2" y1="12" x2="24" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" /> {/* Emerald green */}
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        
        {/* Shiny gold gradient */}
        <linearGradient id="goldGrad" x1="16" y1="3" x2="30" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" /> {/* Golden Amber */}
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        {/* Back gold bar gradient */}
        <linearGradient id="goldBarGrad" x1="8" y1="2" x2="18" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" /> {/* Yellow-100 */}
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
      </defs>

      {/* Background Gold Bar (diagonal) */}
      <path 
        d="M8 5.5 L17 5.5 L15.5 9 L6.5 9 Z" 
        fill="url(#goldBarGrad)" 
        stroke="#0f172a" 
        strokeWidth="1" 
        strokeLinejoin="round"
      />

      {/* Gold Coin peaking from wallet */}
      <circle cx="21" cy="9.5" r="5.5" fill="url(#goldGrad)" stroke="#0f172a" strokeWidth="1" />
      {/* Gold coin inner detailing */}
      <circle cx="21" cy="9.5" r="3.2" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.75" strokeDasharray="1.5 1" />
      {/* Little star on gold coin */}
      <path d="M21 8v3M19.5 9.5h3" stroke="rgba(255,255,255,0.9)" strokeWidth="0.75" strokeLinecap="round" />

      {/* Wallet Cover */}
      <rect 
        x="2" 
        y="11" 
        width="21" 
        height="16" 
        rx="3.5" 
        fill="url(#walletGrad)" 
        stroke="#047857" 
        strokeWidth="1" 
      />

      {/* Wallet flap / strap */}
      <path 
        d="M15 16 C15 14.5 23.5 14.5 23.5 17.5 C23.5 20.5 15 20.5 15 19 Z" 
        fill="#065f46" 
        stroke="#047857" 
        strokeWidth="1" 
      />

      {/* Gold snap button on the wallet flap */}
      <circle cx="20.5" cy="17.5" r="1.8" fill="#fbbf24" stroke="#d97706" strokeWidth="0.75" />
    </svg>
  );
}
