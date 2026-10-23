/** Minimal line icon set for Madfu Business (1.6px stroke, 20px grid). */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true
});

export const IconBuilding = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3.5 17V4.5a1 1 0 011-1h7a1 1 0 011 1V17M12.5 8h3a1 1 0 011 1v8M2 17h16M6.5 6.5h3M6.5 9.5h3M6.5 12.5h3" /></svg>
);
export const IconPerson = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="10" cy="6.5" r="3" /><path d="M4 16.5c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" /></svg>
);
export const IconMail = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="2.5" y="4.5" width="15" height="11" rx="1.5" /><path d="M3 5.5l7 5 7-5" /></svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>
);
export const IconCheckCircle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="10" cy="10" r="7.5" /><path d="M6.8 10.2l2.2 2.2 4.3-4.6" /></svg>
);
export const IconAlert = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="10" cy="10" r="7.5" /><path d="M10 6v4.5M10 13.5v.2" /></svg>
);
export const IconInfo = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="10" cy="10" r="7.5" /><path d="M10 9v4.5M10 6.3v.2" /></svg>
);
export const IconX = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 5l10 10M15 5L5 15" /></svg>
);
export const IconClock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="10" cy="10" r="7.5" /><path d="M10 5.5V10l3 2" /></svg>
);
export const IconShield = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 2.5l6 2.2v4.6c0 3.8-2.6 6.8-6 8.2-3.4-1.4-6-4.4-6-8.2V4.7l6-2.2z" /><path d="M7.3 10l1.9 1.9 3.6-3.8" /></svg>
);
export const IconBank = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M2.5 7.5L10 3l7.5 4.5M4 8.5v6M8 8.5v6M12 8.5v6M16 8.5v6M2.5 17h15" /></svg>
);
export const IconDoc = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 2.5h6.5L15.5 6.5V17a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5V3a.5.5 0 01.5-.5z" /><path d="M11.5 2.5V6.5h4M7.5 10h5M7.5 13h5" /></svg>
);
export const IconGlobe = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="10" cy="10" r="7.5" /><path d="M2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5z" /></svg>
);
export const IconStore = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 8l1.2-4.5h11.6L17 8M3 8h14M3 8c0 1.4 1.1 2.2 2.3 2.2S7.7 9.4 7.7 8c0 1.4 1.1 2.2 2.3 2.2s2.3-.8 2.3-2.2c0 1.4 1.1 2.2 2.4 2.2S17 9.4 17 8M4.5 10.2V17h11v-6.8M8.5 17v-4h3v4" /></svg>
);
export const IconBoth = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="2.5" y="4" width="9" height="7" rx="1" /><path d="M5 14h4M7 11v3" /><path d="M13.5 8.5h4v8.5h-4zM15.5 15h0" /></svg>
);
export const IconArrowRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 10h12M11 5l5 5-5 5" /></svg>
);
export const IconArrowLeft = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M16 10H4M9 5l-5 5 5 5" /></svg>
);
export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="4" y="8.5" width="12" height="8.5" rx="1.5" /><path d="M6.5 8.5V6a3.5 3.5 0 017 0v2.5" /></svg>
);
export const IconPhone = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="5.5" y="2" width="9" height="16" rx="2" /><path d="M9 15h2" /></svg>
);
export const IconPen = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12.5 4l3.5 3.5L7 16.5H3.5V13L12.5 4z" /></svg>
);
export const IconHelp = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="10" cy="10" r="7.5" /><path d="M7.8 7.8a2.3 2.3 0 114 1.6c-.8.6-1.8 1-1.8 2.1M10 14.2v.1" /></svg>
);
export const IconRefresh = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M16 10a6 6 0 11-1.8-4.3M16 3.5v3.2h-3.2" /></svg>
);
export const IconExit = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M8 3.5H4.5a1 1 0 00-1 1v11a1 1 0 001 1H8M12.5 6.5L16 10l-3.5 3.5M16 10H7.5" /></svg>
);
export const IconPin = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 17.5s5.5-5 5.5-9.3a5.5 5.5 0 00-11 0c0 4.3 5.5 9.3 5.5 9.3z" /><circle cx="10" cy="8.2" r="2" /></svg>
);
export const IconUpload = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 13.5v2a1 1 0 001 1h11a1 1 0 001-1v-2" /></svg>
);
export const IconPercent = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M15 5L5 15" /><circle cx="6" cy="6" r="2" /><circle cx="14" cy="14" r="2" /></svg>
);
export const IconSpark = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M4.7 4.7l2.1 2.1M13.2 13.2l2.1 2.1M4.7 15.3l2.1-2.1M13.2 6.8l2.1-2.1" /></svg>
);
