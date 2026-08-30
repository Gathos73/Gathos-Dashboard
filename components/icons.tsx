import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function IconFrame({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      {...props}
    >
      {children}
    </svg>
  );
}

const strokeProps = {
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
};

export function AnalyticsIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" {...strokeProps} />
      <path d="m3 7 6-4 6 6 6-5" {...strokeProps} />
    </IconFrame>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="8" cy="15" r="4" {...strokeProps} />
      <path d="m11 12 8-8m-2 2 2 2m-5 1 2 2" {...strokeProps} />
    </IconFrame>
  );
}

export function PlaygroundIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" {...strokeProps} />
      <circle cx="12" cy="12" r="3.5" {...strokeProps} />
    </IconFrame>
  );
}

export function CardIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect height="15" rx="2.5" width="20" x="2" y="5" {...strokeProps} />
      <path d="M2 10h20M6 15h4" {...strokeProps} />
    </IconFrame>
  );
}

export function VoiceIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect height="12" rx="3" width="6" x="9" y="2" {...strokeProps} />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8" {...strokeProps} />
    </IconFrame>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z" {...strokeProps} />
      <path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22V4.5Z" {...strokeProps} />
    </IconFrame>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="8" r="4" {...strokeProps} />
      <path d="M4 21a8 8 0 0 1 16 0" {...strokeProps} />
    </IconFrame>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" {...strokeProps} />
    </IconFrame>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m6 6 12 12M18 6 6 18" {...strokeProps} />
    </IconFrame>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 10 5 5 5-5" {...strokeProps} />
    </IconFrame>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m9 6 6 6-6 6" {...strokeProps} />
    </IconFrame>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 5v14M5 12h14" {...strokeProps} />
    </IconFrame>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect height="13" rx="2" width="13" x="8" y="8" {...strokeProps} />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" {...strokeProps} />
    </IconFrame>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m5 12 4 4L19 6" {...strokeProps} />
    </IconFrame>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14m-9-3h6l1 3H8l1-3Z" {...strokeProps} />
    </IconFrame>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m5-4 4-4-4-4m4 4H9" {...strokeProps} />
    </IconFrame>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M7 17 17 7M8 7h9v9" {...strokeProps} />
    </IconFrame>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m12 2 1.25 4.75L18 8l-4.75 1.25L12 14l-1.25-4.75L6 8l4.75-1.25L12 2Z" {...strokeProps} />
      <path d="m19 14 .65 2.35L22 17l-2.35.65L19 20l-.65-2.35L16 17l2.35-.65L19 14ZM5 14l.65 2.35L8 17l-2.35.65L5 20l-.65-2.35L2 17l2.35-.65L5 14Z" {...strokeProps} />
    </IconFrame>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect height="18" rx="2.5" width="20" x="2" y="3" {...strokeProps} />
      <circle cx="8" cy="9" r="2" {...strokeProps} />
      <path d="m3 18 5-5 4 4 3-3 6 6" {...strokeProps} />
    </IconFrame>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect height="14" rx="2.5" width="14" x="2" y="5" {...strokeProps} />
      <path d="m16 10 5-3v10l-5-3v-4Z" {...strokeProps} />
    </IconFrame>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 16V3m0 0L7 8m5-5 5 5M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" {...strokeProps} />
    </IconFrame>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m8 5 11 7-11 7V5Z" fill="currentColor" />
    </IconFrame>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="11" cy="11" r="7" {...strokeProps} />
      <path d="m20 20-4-4" {...strokeProps} />
    </IconFrame>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect height="16" rx="2" width="20" x="2" y="4" {...strokeProps} />
      <path d="m6 9 3 3-3 3m6 0h5" {...strokeProps} />
    </IconFrame>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M14 4h6v6m0-6-9 9M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" {...strokeProps} />
    </IconFrame>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M20 7v5h-5M4 17v-5h5" {...strokeProps} />
      <path d="M6.1 8a7 7 0 0 1 11.7-1L20 12M4 12l2.2 5a7 7 0 0 0 11.7-1" {...strokeProps} />
    </IconFrame>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" {...strokeProps} />
      <path d="M12 9v4m0 4h.01" {...strokeProps} />
    </IconFrame>
  );
}
