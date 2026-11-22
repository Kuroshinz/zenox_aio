import React, { useState } from 'react';
import {
  ExternalLink,
  LayoutDashboard,
  Compass,
  Calendar as CalendarIcon,
  CheckSquare,
  Timer,
  HeartPulse,
  Wallet,
  BarChart3,
  Sparkles,
  Settings,
  LogOut,
  LogIn,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Check,
  CalendarCheck2,
  Apple,
} from 'lucide-react';
import { CalendarCategory, CalendarViewType, EventType } from '../types/calendar';
import { formatDateString, getMonthDays } from '../utils/calendarUtils';

interface SidebarProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  categories: CalendarCategory[];
  onToggleCategory: (id: string) => void;
  onAddCategory: (name: string, color: string) => void;
  onDeleteCategory: (id: string) => void;
  onOpenCreateModal: (type?: EventType) => void;
  lang: 'vi' | 'en';
  onViewChange?: (view: CalendarViewType) => void;
  currentView?: CalendarViewType;
  onOpenGeminiMacro?: () => void;
  onOpenSettings?: () => void;
  onOpenCloudSync?: () => void;
  onGoogleSignIn?: () => Promise<void>;
  onLogout?: () => void;
  userEmail?: string;
  isLoggedInGoogle?: boolean;
}

interface NavItemConfig {
  id: CalendarViewType;
  icon: React.ElementType;
  labelVi: string;
  labelEn: string;
  badge?: string;
  badgeType?: 'ai' | 'standard';
  theme: {
    activeBg: string;
    activeBorder: string;
    activeGlow: string;
    leftSaber: string;
    iconActiveBg: string;
    iconActiveBorder: string;
    iconActiveText: string;
    iconActiveShadow: string;
    iconHoverBg: string;
    iconHoverBorder: string;
    iconHoverText: string;
    beaconPing: string;
    beaconDot: string;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentDate,
  onSelectDate,
  isOpen,
  onCloseMobile,
  categories,
  onToggleCategory,
  onAddCategory,
  onDeleteCategory,
  onOpenCreateModal,
  lang,
  onViewChange,
  currentView = 'dashboard',
  onOpenGeminiMacro,
  onOpenSettings,
  onOpenCloudSync,
  onGoogleSignIn,
  onLogout,
  userEmail,
  isLoggedInGoogle = false,
}) => {
  const [showCalendarCategories, setShowCalendarCategories] = useState(true);
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [miniYear, setMiniYear] = useState<number>(currentDate.getFullYear());
  const [miniMonth, setMiniMonth] = useState<number>(currentDate.getMonth());

  const isCalendarActive =
    currentView === 'month' ||
    currentView === 'week' ||
    currentView === 'day' ||
    currentView === 'fourDay' ||
    currentView === 'year' ||
    currentView === 'schedule';

  const navItems: NavItemConfig[] = [
    {
      id: 'dashboard',
      icon: LayoutDashboard,
      labelVi: 'Tổng quan',
      labelEn: 'Dashboard',
      theme: {
        activeBg: 'bg-gradient-to-r from-rose-950/70 via-rose-900/30 to-rose-950/10',
        activeBorder: 'border-rose-500/40',
        activeGlow: 'shadow-[0_4px_24px_rgba(244,63,94,0.25),inset_0_1px_1px_rgba(255,255,255,0.12)]',
        leftSaber: 'bg-gradient-to-b from-rose-400 via-rose-500 to-rose-600 shadow-[0_0_14px_rgba(244,63,94,0.95),0_0_4px_#fff]',
        iconActiveBg: 'bg-rose-500/20',
        iconActiveBorder: 'border-rose-400/40',
        iconActiveText: 'text-rose-300',
        iconActiveShadow: 'shadow-[0_0_14px_rgba(244,63,94,0.45)]',
        iconHoverBg: 'group-hover:bg-rose-500/10',
        iconHoverBorder: 'group-hover:border-rose-500/30',
        iconHoverText: 'group-hover:text-rose-400',
        beaconPing: 'bg-rose-400',
        beaconDot: 'bg-rose-400 shadow-[0_0_8px_#f43f5e]',
      },
    },
    {
      id: 'month',
      icon: CalendarIcon,
      labelVi: 'Lịch trình',
      labelEn: 'Calendar',
      theme: {
        activeBg: 'bg-gradient-to-r from-sky-950/70 via-sky-900/30 to-sky-950/10',
        activeBorder: 'border-sky-500/40',
        activeGlow: 'shadow-[0_4px_24px_rgba(56,189,248,0.25),inset_0_1px_1px_rgba(255,255,255,0.12)]',
        leftSaber: 'bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 shadow-[0_0_14px_rgba(56,189,248,0.95),0_0_4px_#fff]',
        iconActiveBg: 'bg-sky-500/20',
        iconActiveBorder: 'border-sky-400/40',
        iconActiveText: 'text-sky-300',
        iconActiveShadow: 'shadow-[0_0_14px_rgba(56,189,248,0.45)]',
        iconHoverBg: 'group-hover:bg-sky-500/10',
        iconHoverBorder: 'group-hover:border-sky-500/30',
        iconHoverText: 'group-hover:text-sky-400',
        beaconPing: 'bg-sky-400',
        beaconDot: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
      },
    },
    {
      id: 'tasks',
      icon: CheckSquare,
      labelVi: 'Công việc & Mục tiêu',
      labelEn: 'Tasks & Goals',
      theme: {
        activeBg: 'bg-gradient-to-r from-purple-950/70 via-purple-900/30 to-purple-950/10',
        activeBorder: 'border-purple-500/40',
        activeGlow: 'shadow-[0_4px_24px_rgba(168,85,247,0.25),inset_0_1px_1px_rgba(255,255,255,0.12)]',
        leftSaber: 'bg-gradient-to-b from-purple-400 via-purple-500 to-violet-600 shadow-[0_0_14px_rgba(168,85,247,0.95),0_0_4px_#fff]',
        iconActiveBg: 'bg-purple-500/20',
        iconActiveBorder: 'border-purple-400/40',
        iconActiveText: 'text-purple-300',
        iconActiveShadow: 'shadow-[0_0_14px_rgba(168,85,247,0.45)]',
        iconHoverBg: 'group-hover:bg-purple-500/10',
        iconHoverBorder: 'group-hover:border-purple-500/30',
        iconHoverText: 'group-hover:text-purple-400',
        beaconPing: 'bg-purple-400',
        beaconDot: 'bg-purple-400 shadow-[0_0_8px_#a855f7]',
      },
    },
    {
      id: 'focus',
      icon: Timer,
      labelVi: 'Đồng hồ tập trung',
      labelEn: 'Focus & Timer',
      theme: {
        activeBg: 'bg-gradient-to-r from-amber-950/70 via-amber-900/30 to-amber-950/10',
        activeBorder: 'border-amber-500/40',
        activeGlow: 'shadow-[0_4px_24px_rgba(245,158,11,0.25),inset_0_1px_1px_rgba(255,255,255,0.12)]',
        leftSaber: 'bg-gradient-to-b from-amber-400 via-amber-500 to-orange-600 shadow-[0_0_14px_rgba(245,158,11,0.95),0_0_4px_#fff]',
        iconActiveBg: 'bg-amber-500/20',
        iconActiveBorder: 'border-amber-400/40',
        iconActiveText: 'text-amber-300',
        iconActiveShadow: 'shadow-[0_0_14px_rgba(245,158,11,0.45)]',
        iconHoverBg: 'group-hover:bg-amber-500/10',
        iconHoverBorder: 'group-hover:border-amber-500/30',
        iconHoverText: 'group-hover:text-amber-400',
        beaconPing: 'bg-amber-400',
        beaconDot: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
      },
    },
    {
      id: 'health',
      icon: HeartPulse,
      labelVi: 'Sức khỏe & Macro',
      labelEn: 'Health & Macro',
      badge: 'Fitness AI',
      badgeType: 'ai',
      theme: {
        activeBg: 'bg-gradient-to-r from-emerald-950/70 via-emerald-900/30 to-emerald-950/10',
        activeBorder: 'border-emerald-500/40',
        activeGlow: 'shadow-[0_4px_24px_rgba(16,185,129,0.25),inset_0_1px_1px_rgba(255,255,255,0.12)]',
        leftSaber: 'bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-600 shadow-[0_0_14px_rgba(16,185,129,0.95),0_0_4px_#fff]',
        iconActiveBg: 'bg-emerald-500/20',
        iconActiveBorder: 'border-emerald-400/40',
        iconActiveText: 'text-emerald-300',
        iconActiveShadow: 'shadow-[0_0_14px_rgba(16,185,129,0.45)]',
        iconHoverBg: 'group-hover:bg-emerald-500/10',
        iconHoverBorder: 'group-hover:border-emerald-500/30',
        iconHoverText: 'group-hover:text-emerald-400',
        beaconPing: 'bg-emerald-400',
        beaconDot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
      },
    },
    {
      id: 'finance',
      icon: Wallet,
      labelVi: 'Quản lý Tài chính',
      labelEn: 'Finance',
      theme: {
        activeBg: 'bg-gradient-to-r from-teal-950/70 via-teal-900/30 to-teal-950/10',
        activeBorder: 'border-teal-500/40',
        activeGlow: 'shadow-[0_4px_24px_rgba(20,184,166,0.25),inset_0_1px_1px_rgba(255,255,255,0.12)]',
        leftSaber: 'bg-gradient-to-b from-teal-400 via-teal-500 to-emerald-600 shadow-[0_0_14px_rgba(20,184,166,0.95),0_0_4px_#fff]',
        iconActiveBg: 'bg-teal-500/20',
        iconActiveBorder: 'border-teal-400/40',
        iconActiveText: 'text-teal-300',
        iconActiveShadow: 'shadow-[0_0_14px_rgba(20,184,166,0.45)]',
        iconHoverBg: 'group-hover:bg-teal-500/10',
        iconHoverBorder: 'group-hover:border-teal-500/30',
        iconHoverText: 'group-hover:text-teal-400',
        beaconPing: 'bg-teal-400',
        beaconDot: 'bg-teal-400 shadow-[0_0_8px_#14b8a6]',
      },
    },
    {
      id: 'analytics',
      icon: BarChart3,
      labelVi: 'Báo cáo & Phân tích',
      labelEn: 'Analytics',
      theme: {
        activeBg: 'bg-gradient-to-r from-indigo-950/70 via-indigo-900/30 to-indigo-950/10',
        activeBorder: 'border-indigo-500/40',
        activeGlow: 'shadow-[0_4px_24px_rgba(99,102,241,0.25),inset_0_1px_1px_rgba(255,255,255,0.12)]',
        leftSaber: 'bg-gradient-to-b from-indigo-400 via-indigo-500 to-blue-600 shadow-[0_0_14px_rgba(99,102,241,0.95),0_0_4px_#fff]',
        iconActiveBg: 'bg-indigo-500/20',
        iconActiveBorder: 'border-indigo-400/40',
        iconActiveText: 'text-indigo-300',
        iconActiveShadow: 'shadow-[0_0_14px_rgba(99,102,241,0.45)]',
        iconHoverBg: 'group-hover:bg-indigo-500/10',
        iconHoverBorder: 'group-hover:border-indigo-500/30',
        iconHoverText: 'group-hover:text-indigo-400',
        beaconPing: 'bg-indigo-400',
        beaconDot: 'bg-indigo-400 shadow-[0_0_8px_#6366f1]',
      },
    },
  ];

  const handlePrevMiniMonth = () => {
    if (miniMonth === 0) {
      setMiniMonth(11);
      setMiniYear(miniYear - 1);
    } else {
      setMiniMonth(miniMonth - 1);
    }
  };

  const handleNextMiniMonth = () => {
    if (miniMonth === 11) {
      setMiniMonth(0);
      setMiniYear(miniYear + 1);
    } else {
      setMiniMonth(miniMonth + 1);
    }
  };

  const miniMonthDays = getMonthDays(miniYear, miniMonth, false);
  const selectedDateStr = formatDateString(currentDate);

  const monthNamesVi = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside className="fixed lg:static top-0 bottom-0 left-0 w-72 bg-[#080205] backdrop-blur-2xl border-r border-white/[0.08] z-40 flex flex-col justify-between p-4 sm:p-5 shrink-0 select-none shadow-2xl lg:shadow-none transition-all overflow-y-auto">
        {/* Top: Brand Header & Primary Navigation */}
        <div className="space-y-6">
          {/* Brand header */}
          <div className="space-y-2.5 px-1">
            <div className="flex items-center justify-between">
              <div
                onClick={() => onViewChange && onViewChange('landing')}
                className="flex items-center cursor-pointer group py-1 transition-transform duration-200 hover:scale-[1.02]"
                title="ZENOX - Quay về Trang chủ"
              >
                <img
                  src="/zenox-logo.png"
                  alt="ZENOX"
                  className="h-7 w-auto object-contain filter drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.07] text-[10px] font-mono text-zinc-400 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
                  <span className="text-zinc-300 font-semibold tracking-wider text-[9px]">CORE</span>
                </div>

                <button
                  onClick={onCloseMobile}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 lg:hidden cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Primary Navigation List */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.id === 'month' ? isCalendarActive : currentView === item.id;
              const { theme } = item;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (onViewChange) {
                      onViewChange(item.id);
                    }
                    if (window.innerWidth < 1024) {
                      onCloseMobile();
                    }
                  }}
                  className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ease-out cursor-pointer group active:scale-[0.98] ${
                    isActive
                      ? `${theme.activeBg} ${theme.activeBorder} ${theme.activeGlow} text-white font-semibold translate-x-1 border`
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/[0.07] hover:translate-x-1 font-medium'
                  }`}
                >
                  {/* Left Neon Saber Accent for Active Tab */}
                  {isActive && (
                    <div
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full animate-neon-saber ${theme.leftSaber}`}
                    />
                  )}

                  <div className="flex items-center gap-3 min-w-0">
                    {/* Icon Pod Container with individual theme aura */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ease-out border ${
                        isActive
                          ? `${theme.iconActiveBg} ${theme.iconActiveBorder} ${theme.iconActiveText} ${theme.iconActiveShadow} scale-105`
                          : `bg-white/[0.03] border-white/[0.05] text-slate-400 ${theme.iconHoverBg} ${theme.iconHoverBorder} ${theme.iconHoverText} group-hover:scale-105 group-hover:shadow-[0_0_12px_rgba(255,255,255,0.06)]`
                      }`}
                    >
                      <Icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                    </div>

                    <span className="truncate tracking-tight">
                      {lang === 'vi' ? item.labelVi : item.labelEn}
                    </span>
                  </div>

                  {/* Right side: Badge or Indicator */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && item.badgeType === 'ai' ? (
                      <span className="relative inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide overflow-hidden bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 border border-emerald-400/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] group-hover:border-emerald-300/60 group-hover:shadow-[0_0_16px_rgba(16,185,129,0.5)] transition-all">
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-cyber-sheen pointer-events-none" />
                        <Sparkles className="w-2.5 h-2.5 text-emerald-300 animate-pulse" />
                        <span>{item.badge}</span>
                      </span>
                    ) : item.badge ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 border border-white/10 shrink-0">
                        {item.badge}
                      </span>
                    ) : null}

                    {/* Active Beacon Pulse or Inactive Hover Chevron */}
                    {isActive ? (
                      <div className="relative flex items-center justify-center w-2.5 h-2.5 mr-0.5 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.beaconPing}`} />
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${theme.beaconDot}`} />
                      </div>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-out shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Calendar Categories Sub-list when calendar view is active */}
          {isCalendarActive && (
            <div className="pt-2 border-t border-white/[0.08] space-y-2">
              <div
                onClick={() => setShowCalendarCategories(!showCalendarCategories)}
                className="flex items-center justify-between px-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-300 cursor-pointer"
              >
                <span>{lang === 'vi' ? 'Lịch của tôi' : 'My Calendars'}</span>
                {showCalendarCategories ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </div>

              {showCalendarCategories && (
                <div className="space-y-1 max-h-36 overflow-y-auto px-1">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onToggleCategory(c.id)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
                    >
                      <div
                        className="w-3.5 h-3.5 rounded flex items-center justify-center transition-colors border"
                        style={{
                          backgroundColor: c.visible ? c.color : 'transparent',
                          borderColor: c.color,
                        }}
                      >
                        {c.visible && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </div>
                      <span className="truncate">{lang === 'vi' ? c.nameVi : c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom: Settings & Logout */}
        <div className="space-y-1.5 pt-3 border-t border-white/[0.08]">
          {isLoggedInGoogle && userEmail && (
            <div className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-white/[0.04] to-white/[0.02] border border-white/[0.08] hover:border-white/15 flex items-center gap-2.5 mb-2 transition-all duration-300 group shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
              <div className="relative">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 flex items-center justify-center text-[11px] font-bold text-white shadow-[0_0_12px_rgba(244,63,94,0.45)] group-hover:scale-105 transition-transform duration-200 shrink-0">
                  {userEmail[0].toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#080205] shadow-[0_0_6px_#10b981]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-slate-200 truncate font-mono" title={userEmail}>
                  {userEmail}
                </div>
                <div className="text-[9px] text-emerald-400/90 font-mono flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active Session</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => onOpenSettings && onOpenSettings()}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] hover:translate-x-1 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.05] group-hover:border-white/10 group-hover:bg-white/[0.08] flex items-center justify-center text-slate-400 group-hover:text-white transition-all">
                <Settings className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform duration-300" />
              </div>
              <span>{lang === 'vi' ? 'Cài đặt' : 'Settings'}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </button>

          <button
            onClick={() => {
              if (onLogout) {
                onLogout();
              } else if (onOpenCloudSync) {
                onOpenCloudSync();
              }
            }}
            title={lang === 'vi' ? 'Đăng xuất khỏi hệ thống' : 'Logout from workspace'}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 hover:translate-x-1 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.05] group-hover:border-rose-500/30 group-hover:bg-rose-500/15 flex items-center justify-center text-slate-400 group-hover:text-rose-400 transition-all">
                <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform duration-200" />
              </div>
              <span>{lang === 'vi' ? 'Đăng xuất' : 'Logout'}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-rose-500/50 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </button>

          {/* Dev Attribution */}
          <div className="pt-2 px-1 text-center select-none">
            <div className="text-[10px] font-mono font-semibold text-rose-400/90 tracking-wider flex items-center justify-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_#f43f5e]" />
              <span>Dev By Zenox Development</span>
            </div>
            <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
              ZENOX OS Core · Vault Encrypted
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
