import {
  Activity, BarChart3, Bell, BookOpen, BookOpenCheck, CalendarDays,
  Camera, Check, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  Clock3, Copy, Crown, Download, Eye, EyeOff,
  FileInput, FileText, Flag, GraduationCap, History, Home,
  Layers3, LayoutDashboard, LayoutGrid, LibraryBig, LineChart, List,
  ListFilter, LockKeyhole, LogIn, LogOut, Menu, MessageCircle,
  Moon, Paperclip, PenTool, Pencil, Play, Plus,
  Radar, RefreshCw, Save, ScanEye, School, Search,
  Send, Settings2, ShieldCheck, Sparkles, Sun, Target,
  Trash2, TrendingUp, TriangleAlert, Trophy, Upload, UserRound,
  Users, WandSparkles, Wifi, X, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

const icons: Record<string, LucideIcon> = {
  logo: BookOpenCheck,
  exaDashboard: LayoutDashboard,
  exaExam: ClipboardList,
  exaQuestions: LibraryBig,
  exaClassroom: School,
  exaImport: FileInput,
  exaReports: LineChart,
  exaGrading: ClipboardCheck,
  exaProctor: ScanEye,
  exaAi: Sparkles,
  exaSettings: Settings2,
  exaHome: Home,
  grid: LayoutGrid,
  file: FileText,
  layers: Layers3,
  building: School,
  chart: BarChart3,
  shield: ShieldCheck,
  settings: Settings2,
  home: Home,
  clock: Clock3,
  book: BookOpen,
  plus: Plus,
  x: X,
  trash: Trash2,
  check: Check,
  search: Search,
  download: Download,
  upload: Upload,
  send: Send,
  eye: Eye,
  eyeOff: EyeOff,
  login: LogIn,
  edit: Pencil,
  copy: Copy,
  refresh: RefreshCw,
  save: Save,
  logout: LogOut,
  bell: Bell,
  menu: Menu,
  moon: Moon,
  sun: Sun,
  users: Users,
  user: UserRound,
  graduationCap: GraduationCap,
  play: Play,
  alert: TriangleAlert,
  lock: LockKeyhole,
  trophy: Trophy,
  zap: Zap,
  sparkle: Sparkles,
  trend: TrendingUp,
  activity: Activity,
  camera: Camera,
  list: List,
  target: Target,
  fileText: FileText,
  penTool: PenTool,
  wand: WandSparkles,
  crown: Crown,
  paperclip: Paperclip,
  chevronL: ChevronLeft,
  chevronR: ChevronRight,
  flag: Flag,
  radar: Radar,
  wifi: Wifi,
  filter: ListFilter,
  calendar: CalendarDays,
  message: MessageCircle,
  history: History,
};

export function Icon({ name, size = 20, className = '' }: IconProps) {
  if (name === 'google') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.05 5.05 0 0 1-2.2 3.31v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.28-1.93-6.15-4.53H2.17v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.17a11 11 0 0 0 0 9.88z" />
        <path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.53 10.53 0 0 0 12 1a11 11 0 0 0-9.83 6.06l3.68 2.84C6.72 7.3 9.14 5.37 12 5.37z" />
      </svg>
    );
  }
  const Glyph = icons[name] ?? FileText;
  return <Glyph aria-hidden="true" focusable="false" size={size} strokeWidth={1.8} className={className} />;
}
