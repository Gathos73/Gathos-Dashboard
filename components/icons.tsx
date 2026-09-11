import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioWaveform,
  BookOpen,
  Box,
  ChartSpline,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  Headset,
  Image,
  Key,
  LogOut,
  Menu,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  SquareTerminal,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Video,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

export type IconProps = LucideProps;

// Keep dashboard sizing and decorative accessibility defaults consistent.
function createDashboardIcon(Icon: LucideIcon) {
  return function DashboardIcon(props: IconProps) {
    return <Icon aria-hidden="true" size={20} {...props} />;
  };
}

export const AnalyticsIcon = createDashboardIcon(ChartSpline);
export const ArrowLeftIcon = createDashboardIcon(ArrowLeft);
export const ArrowRightIcon = createDashboardIcon(ArrowRight);
export const ArrowUpRightIcon = createDashboardIcon(ArrowUpRight);
export const BookIcon = createDashboardIcon(BookOpen);
export const CardIcon = createDashboardIcon(CreditCard);
export const CheckIcon = createDashboardIcon(Check);
export const ChevronDownIcon = createDashboardIcon(ChevronDown);
export const ChevronRightIcon = createDashboardIcon(ChevronRight);
export const CloseIcon = createDashboardIcon(X);
export const CopyIcon = createDashboardIcon(Copy);
export const ExternalLinkIcon = createDashboardIcon(ExternalLink);
export const ImageIcon = createDashboardIcon(Image);
export const KeyIcon = createDashboardIcon(Key);
export const LogoutIcon = createDashboardIcon(LogOut);
export const MenuIcon = createDashboardIcon(Menu);
export const PlayIcon = createDashboardIcon(Play);
export const PlaygroundIcon = createDashboardIcon(Box);
export const PlusIcon = createDashboardIcon(Plus);
export const RefreshIcon = createDashboardIcon(RefreshCw);
export const SearchIcon = createDashboardIcon(Search);
export const SparklesIcon = createDashboardIcon(Sparkles);
export const SupportIcon = createDashboardIcon(Headset);
export const TerminalIcon = createDashboardIcon(SquareTerminal);
export const TrashIcon = createDashboardIcon(Trash2);
export const UploadIcon = createDashboardIcon(Upload);
export const UserIcon = createDashboardIcon(User);
export const VideoIcon = createDashboardIcon(Video);
export const VoiceIcon = createDashboardIcon(AudioWaveform);
export const WarningIcon = createDashboardIcon(TriangleAlert);
