/** Small stroke icons (original, 24×24). Decorative unless a label is passed. */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { label?: string };

function Icon({ label, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const FamilyIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="2.5" />
    <circle cx="6" cy="17" r="2.5" />
    <circle cx="18" cy="17" r="2.5" />
    <path d="M12 7.5v4M6 14.5V12h12v2.5" />
  </Icon>
);
export const TreeIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="2.5" width="6" height="4" rx="1" />
    <rect x="2.5" y="17.5" width="6" height="4" rx="1" />
    <rect x="15.5" y="17.5" width="6" height="4" rx="1" />
    <rect x="9" y="17.5" width="6" height="4" rx="1" />
    <path d="M12 6.5v11M5.5 17.5V12h13v5.5" />
  </Icon>
);
export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="2.6" />
  </Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.8-4.8" />
  </Icon>
);
export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);
export const UpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
);
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Icon>
);
export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);
export const FitIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Icon>
);
export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v10h12V10" />
  </Icon>
);
export const FilterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />
  </Icon>
);
export const PaletteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.8 0-1 .8-1.7 1.8-1.7h2.2c2 0 3.8-1.6 3.8-4C20.5 6.6 16.7 3.5 12 3.5z" />
    <circle cx="7.6" cy="11" r="1.1" />
    <circle cx="10.4" cy="7.4" r="1.1" />
    <circle cx="15" cy="7.6" r="1.1" />
  </Icon>
);
export const CollapseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4l5 5 5-5M7 20l5-5 5 5" />
  </Icon>
);
export const ExpandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 9l5-5 5 5M7 15l5 5 5-5" />
  </Icon>
);
export const LineageIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="4.5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19.5" r="2" />
    <path d="M12 6.5v3.5M12 14v3.5" />
  </Icon>
);
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Icon>
);
export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);
export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h3l2-2.5h6L17 8h3v11H4Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
export const BirthIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c-1.5 2-1.5 3.5 0 4.5 1.5-1 1.5-2.5 0-4.5Z" />
    <path d="M12 7.5V11M5 21v-7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v7M3 21h18M5 16c2.3 1.3 4.7 1.3 7 0s4.7-1.3 7 0" />
  </Icon>
);
export const PlaceIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
);
export const WorkIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="7.5" width="18" height="12" rx="2" />
    <path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3 13h18" />
  </Icon>
);
export const NoteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h9l4 4v14H6Z" />
    <path d="M15 3v4h4M9 12h7M9 16h5" />
  </Icon>
);
export const MemorialIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21V10h6v11M7 21h10" />
    <path d="M12 10V7M12 7c-1.3-1-1.3-2.5 0-4 1.3 1.5 1.3 3 0 4Z" />
  </Icon>
);
export const PersonIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icon>
);
