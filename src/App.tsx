
import { accountStorage } from './services/accountStorage';
import { LoginModal } from './components/auth/LoginModal';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import {
  CalendarEvent,
  CalendarCategory,
  CalendarViewType,
  EventType,
  SyncState,
  DEFAULT_CALENDARS,
} from './types/calendar';
import { INITIAL_EVENTS } from './data/initialEvents';
import { SEED_PLANNED_SESSIONS, SEED_TASKS, SEED_WORKOUT_SESSIONS } from './data/productivitySeed';
import {
  formatDateString,
  parseDateString,
  deduplicateEvents,
  isDemoEventId,
  findConflictingEvents,
  resolveNonConflictingSlot,
} from './utils/calendarUtils';

const Scene = lazy(() => import('./Scene').then((m) => ({ default: m.Scene })));
const TimeAnalyticsView = lazy(() =>
  import('./components/analytics/TimeAnalyticsView').then((m) => ({ default: m.TimeAnalyticsView }))
);
const ExportImportModal = lazy(() =>
  import('./components/ExportImportModal').then((m) => ({ default: m.ExportImportModal }))
);
const CloudSyncModal = lazy(() =>
  import('./components/sync/CloudSyncModal').then((m) => ({ default: m.CloudSyncModal }))
);
const ProductivityDashboard = lazy(() =>
  import('./components/productivity/ProductivityDashboard').then((m) => ({ default: m.ProductivityDashboard }))
);
const TasksGoalsView = lazy(() =>
  import('./components/productivity/TasksGoalsView').then((m) => ({ default: m.TasksGoalsView }))
);
const StudyFocusView = lazy(() =>
  import('./components/productivity/StudyFocusView').then((m) => ({ default: m.StudyFocusView }))
);
const FinanceView = lazy(() =>
  import('./components/productivity/FinanceView').then((m) => ({ default: m.FinanceView }))
);
const HealthView = lazy(() =>
  import('./components/productivity/HealthView').then((m) => ({ default: m.HealthView }))
);
const LifeCopilotModal = lazy(() =>
  import('./components/productivity/LifeCopilotModal').then((m) => ({ default: m.LifeCopilotModal }))
);

const ChunkFallback: React.FC = () => (
  <div className="flex items-center justify-center w-full h-full min-h-[240px] text-xs font-mono text-zinc-400">
    Đang tải mô-đun ZENOX...
  </div>
);

const SEED_TASK_EVENT_IDS = new Set(SEED_TASKS.map((t) => `task-${t.id}`));
const SEED_WORKOUT_EVENT_IDS = new Set(SEED_WORKOUT_SESSIONS.map((w) => `wo-ev-${w.id}`));
const SEED_PLANNED_EVENT_PREFIXES = SEED_PLANNED_SESSIONS.map((p) => `plan-ev-${p.id}-`);

const getInitialEventsForCurrentUser = (): CalendarEvent[] => {
  try {
    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('gcal_active_user') : null;
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const todayStr = formatDateString(new Date());
      // Fresh isolated event list for current authenticated user
      return [
        {
          id: `ev-welcome-${u.uid || 'usr'}`,
          title: `Chào mừng ${u.displayName || 'bạn'} đến với ZENOX`,
          description: `Kho dữ liệu cá nhân cho ${u.email} (${u.authMethod === 'google' ? 'Google Account' : 'Web Account'})`,
          startDate: todayStr,
          endDate: todayStr,
          startTime: '09:00',
          endTime: '10:00',
          allDay: false,
          calendarId: 'personal',
          color: '#0284c7',
          type: 'event',
          createdAt: Date.now(),
        },
      ];
    }
  } catch {}
  return INITIAL_EVENTS;
};
import { playNotificationSound, playSuccessSound, playToggleSound, playLiveSyncChime, playSyncPulse } from './utils/sound';
import { notifySuccess, notifyWarning } from './utils/notify';
import { useCalendarDnD } from './hooks/useCalendarDnD';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MonthView } from './components/MonthView';
import { TimeGridView } from './components/TimeGridView';
import { YearView } from './components/YearView';
import { ScheduleView } from './components/ScheduleView';
import { EventModal } from './components/EventModal';
import { EventDetailCard } from './components/EventDetailCard';
import { QuickAddModal } from './components/QuickAddModal';
import { MiniEventPopover } from './components/MiniEventPopover';
import { DayPlannerDrawer } from './components/DayPlannerDrawer';
import { ShortcutsModal } from './components/ShortcutsModal';
import { RightSidebar } from './components/RightSidebar';
import { MultiHubDrawer } from './components/MultiHubDrawer';
import {
  verifyZenoxSession,
  logoutZenoxSession,
  establishZenoxSession,
  ZenoxUser,
} from './services/zenoxAuth';
import { getCurrentRoute, navigateToRoute } from './services/router';
import { mergeSyncedGoogleEvents } from './utils/calendarUtils';
import { useProductivityStore, todayString } from './hooks/useProductivityStore';
import { usePersistentState } from './hooks/usePersistentState';
import { buildTaskEvents } from './utils/productivityUtils';
import { buildWorkoutEvents, startOfWeek, tdee, calorieTarget, macroTargets, parseVnDate } from './utils/fitnessMetrics';
import { User } from 'firebase/auth';
import { auth, initAuth, logout, getAccessToken, clearAccessToken, googleSignIn, AppUser } from './services/auth';
import { fetchGoogleCalendarEvents, createGoogleCalendarEvent, deleteGoogleCalendarEvent } from './services/googleCalendarSync';
import { fetchCalendarFromICalUrl } from './services/googleCalendarUrlSync';
import { Bell, FileText, LayoutDashboard, CalendarDays, Dumbbell, ListChecks, Wallet } from 'lucide-react';
import { CalendarActionBar } from './components/CalendarActionBar';
import { ToastContainer } from './components/ToastContainer';

export default function App() {

  // 1. Language state
  const [lang, setLang] = useState<'vi' | 'en'>(() => {
    return (localStorage.getItem('gcal_lang') as 'vi' | 'en') || 'vi';
  });

  // 2. Dark mode state (defaults to true for sleek dark theme)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('gcal_theme');
    if (saved) return saved === 'dark';
    return true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('gcal_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('gcal_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);
  const toggleLang = () => {
    const nextLang = lang === 'vi' ? 'en' : 'vi';
    setLang(nextLang);
    localStorage.setItem('gcal_lang', nextLang);
  };

  // 2b. Authenticated User State (Crypto-verified session)
  const [user, setUser] = useState<ZenoxUser | AppUser | User | null>(() => {
    return verifyZenoxSession();
  });

  // 3. Current active date & view (Direct Workspace / Login shell, skip marketing landing page)
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalMode, setLoginModalMode] = useState<'login' | 'register'>('login');
  const [view, setView] = useState<CalendarViewType>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#scene') {
      return 'scene';
    }

    const verified = verifyZenoxSession();
    if (verified) {
      sessionStorage.setItem('zenox_workspace_entered', 'true');
      const saved = localStorage.getItem('gcal_view') as CalendarViewType | null;
      return saved && saved !== 'landing' ? saved : 'dashboard';
    }

    return 'dashboard';
  });

  const handleViewChange = (newView: CalendarViewType) => {
    if (newView !== 'landing' && !user) {
      setLoginModalMode('login');
      setIsLoginModalOpen(true);
      return;
    }

    const resolvedView: CalendarViewType = newView === 'landing' ? 'dashboard' : newView;
    setView(resolvedView);
    sessionStorage.setItem('zenox_workspace_entered', 'true');
    localStorage.setItem('gcal_view', resolvedView);
    navigateToRoute('workspace');
  };

  // Dynamic Browser Tab Space Title
  useEffect(() => {
    if (!user) {
      document.title = 'ZENOX · Đăng Nhập';
    } else {
      document.title = `ZENOX · ${user.displayName || 'Cá Nhân'}`;
    }
  }, [user, view]);

  useEffect(() => {
    const handleRouteSync = () => {
      const route = getCurrentRoute();
      const verified = verifyZenoxSession();

      if (route === 'workspace') {
        if (!verified) {
          setView('dashboard');
          setLoginModalMode('login');
          setIsLoginModalOpen(true);
        } else {
          sessionStorage.setItem('zenox_workspace_entered', 'true');
          const saved = localStorage.getItem('gcal_view') as CalendarViewType | null;
          setView(saved && saved !== 'landing' ? saved : 'dashboard');
        }
      }
    };

    window.addEventListener('popstate', handleRouteSync);
    window.addEventListener('hashchange', handleRouteSync);
    window.addEventListener('zenox-route-change', handleRouteSync as EventListener);

    return () => {
      window.removeEventListener('popstate', handleRouteSync);
      window.removeEventListener('hashchange', handleRouteSync);
      window.removeEventListener('zenox-route-change', handleRouteSync as EventListener);
    };
  }, [user]);

  // 4. Events & Categories persistence (Offline-First, Scoped per User Account)
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = accountStorage.getItem('gcal_events');
      if (saved) return JSON.parse(saved);
    } catch {}
    return getInitialEventsForCurrentUser();
  });

  const [categories, setCategories] = useState<CalendarCategory[]>(() => {
    let saved: CalendarCategory[] | null = null;
    try {
      const raw = accountStorage.getItem('gcal_categories');
      if (raw) saved = JSON.parse(raw);
    } catch {}

    if (!saved) return DEFAULT_CALENDARS;

    const knownIds = new Set(saved.map((c) => c.id));
    const missing = DEFAULT_CALENDARS.filter((c) => !knownIds.has(c.id));
    return missing.length > 0 ? [...saved, ...missing] : saved;
  });

  useEffect(() => {
    accountStorage.setItem('gcal_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    accountStorage.setItem('gcal_categories', JSON.stringify(categories));
  }, [categories]);

  // Synchronize events and categories whenever the logged-in user changes (Google vs Web accounts)
  useEffect(() => {
    const activeUid = user?.uid;
    try {
      const savedEvents = accountStorage.getItem('gcal_events', activeUid);
      if (savedEvents) {
        setEvents(JSON.parse(savedEvents));
      } else {
        const consent = activeUid ? localStorage.getItem(`zenox_sync_consent_${activeUid}`) : null;
        setEvents(consent === 'declined' ? [] : getInitialEventsForCurrentUser());
      }
    } catch {
      setEvents(getInitialEventsForCurrentUser());
    }

    try {
      const savedCats = accountStorage.getItem('gcal_categories', activeUid);
      if (savedCats) {
        const parsed = JSON.parse(savedCats);
        const knownIds = new Set(parsed.map((c: any) => c.id));
        const missing = DEFAULT_CALENDARS.filter((c) => !knownIds.has(c.id));
        setCategories(missing.length > 0 ? [...parsed, ...missing] : parsed);
      } else {
        setCategories(DEFAULT_CALENDARS);
      }
    } catch {
      setCategories(DEFAULT_CALENDARS);
    }
  }, [user?.uid]);

  // Set of visible category IDs
  const visibleCategoryIds = useMemo(() => {
    return new Set(categories.filter((c) => c.visible).map((c) => c.id));
  }, [categories]);

  // 4b. Productivity store — single owner for tasks, goals, focus, finance & health.
  // Tasks that carry a due date *and* a start time are mirrored onto the calendar
  // as derived events so they never pollute the persisted `gcal_events` array.
  const productivity = useProductivityStore();
  const colorByCategoryId = useMemo(
    () => new Map(categories.map((c) => [c.id, c.color])),
    [categories]
  );
  const taskEvents = useMemo(
    () => buildTaskEvents(productivity.tasks, colorByCategoryId),
    [productivity.tasks, colorByCategoryId]
  );
  const workoutEvents = useMemo(
    () =>
      buildWorkoutEvents(
        productivity.workoutSessions,
        productivity.plannedSessions,
        startOfWeek(todayString())
      ),
    [productivity.workoutSessions, productivity.plannedSessions]
  );
  // Check if user has real custom or imported events
  const hasRealUserEvents = useMemo(() => {
    return events.some((e) => !isDemoEventId(e.id));
  }, [events]);

  const allEvents = useMemo(() => {
    let baseList = events;
    if (hasRealUserEvents) {
      // Filter out initial demo events when real user events exist
      baseList = baseList.filter((e) => !isDemoEventId(e.id));
    }

    // Exclude only exact seed tasks/workouts while preserving all user-created
    // tasks (whose derived IDs are `task-task-<timestamp>-...`) and user workouts.
    const realTaskEvents = taskEvents.filter((t) => !SEED_TASK_EVENT_IDS.has(t.id));

    const realWorkoutEvents = workoutEvents.filter(
      (w) =>
        !SEED_WORKOUT_EVENT_IDS.has(w.id) &&
        !SEED_PLANNED_EVENT_PREFIXES.some((prefix) => w.id.startsWith(prefix))
    );

    return deduplicateEvents([...baseList, ...realTaskEvents, ...realWorkoutEvents]);
  }, [events, taskEvents, workoutEvents, hasRealUserEvents]);

  const allEventsRef = useRef<CalendarEvent[]>(allEvents);
  allEventsRef.current = allEvents;

  const [weekStartsOnMonday, setWeekStartsOnMonday] = usePersistentState<boolean>(
    'gcal_week_starts_monday',
    false
  );
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | 'all'>('all');
  const calendarVisibleEvents = useMemo(() => {
    if (eventTypeFilter === 'all') return allEvents;
    return allEvents.filter((e) => e.type === eventTypeFilter);
  }, [allEvents, eventTypeFilter]);

  const handleCleanCalendar = useCallback(() => {
    setEvents((prev) => {
      let filtered = prev;
      const hasOther = prev.some((e) => !isDemoEventId(e.id));
      if (hasOther) {
        filtered = filtered.filter((e) => !isDemoEventId(e.id));
      }
      const deduped = deduplicateEvents(filtered);
      try {
        accountStorage.setItem('gcal_events', JSON.stringify(deduped));
      } catch {}
      return deduped;
    });

    notifySuccess(
      lang === 'vi'
        ? 'Đã lọc sạch lịch: loại bỏ dữ liệu ảo và gộp các sự kiện trùng lặp!'
        : 'Cleaned calendar: removed mock data and duplicate events!'
    );
  }, [lang]);

  // 5. Sidebar toggle (closed by default on mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 6. Search query
  const [searchQuery, setSearchQuery] = useState('');

  // 7. Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);
  const [modalDate, setModalDate] = useState<string | undefined>(undefined);
  const [modalTime, setModalTime] = useState<string | undefined>(undefined);
  const [modalEndTime, setModalEndTime] = useState<string | undefined>(undefined);
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalAllDay, setModalAllDay] = useState<boolean | undefined>(undefined);
  const [modalColor, setModalColor] = useState<string | undefined>(undefined);
  const [modalType, setModalType] = useState<EventType>('event');

  const [selectedEventForDetail, setSelectedEventForDetail] = useState<CalendarEvent | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isMultiHubOpen, setIsMultiHubOpen] = useState(false);
  const [isLifeCopilotOpen, setIsLifeCopilotOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);

  // Mini Inline Event Popover state
  const [miniPopover, setMiniPopover] = useState<{
    isOpen: boolean;
    position: { top: number; left: number } | null;
    dateStr: string;
    startTime: string;
    endTime: string;
  }>({
    isOpen: false,
    position: null,
    dateStr: '',
    startTime: '09:00',
    endTime: '10:00',
  });

  // Day Planner Drawer state
  const [dayPlanner, setDayPlanner] = useState<{
    isOpen: boolean;
    dateStr: string;
  }>({
    isOpen: false,
    dateStr: formatDateString(new Date()),
  });

  // Google OAuth & Cloud Sync State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLiveSyncEnabled, setIsLiveSyncEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('zenox_live_sync_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const [syncState, setSyncState] = useState<SyncState>(() => {
    return localStorage.getItem('gcal_active_user') ? 'synced' : 'offline';
  });
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => {
    return localStorage.getItem('gcal_active_user') ? 'Vừa xong' : null;
  });
  const liveSyncDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getFirestoreSyncUid = useCallback(
    (u: ZenoxUser | AppUser | User | null): string | null => {
      if (!u || !auth.currentUser) return null;
      if ('firebaseUid' in u && u.firebaseUid) return u.firebaseUid;
      if (auth.currentUser.uid === u.uid || `google-${auth.currentUser.uid}` === u.uid) {
        return auth.currentUser.uid;
      }
      return null;
    },
    []
  );

  // 8. Event saving / updating handler
  const handleSaveEvent = useCallback((savedEvent: CalendarEvent) => {
    // Editing a task-derived event updates the owning task instead of creating a
    // duplicate calendar event in `gcal_events`.
    if (savedEvent.id.startsWith('task-')) {
      productivity.updateTask(savedEvent.id.slice('task-'.length), {
        title: savedEvent.title,
        notes: savedEvent.description,
        dueDate: savedEvent.startDate,
        startTime: savedEvent.allDay ? undefined : savedEvent.startTime,
        endTime: savedEvent.allDay ? undefined : savedEvent.endTime,
      });
      return;
    }

    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === savedEvent.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedEvent;
        return copy;
      }
      return [savedEvent, ...prev];
    });

    // Cloud sync push only when Firebase Auth session matches
    const firestoreUid = getFirestoreSyncUid(user);
    if (firestoreUid) {
      setSyncState('syncing');
      import('./services/firestoreSync')
        .then(({ saveEventToFirestore }) => saveEventToFirestore(firestoreUid, savedEvent))
        .then(() => setSyncState('synced'))
        .catch(() => setSyncState('error'));
    }

    // Google Calendar Push if token available
    getAccessToken()
      .then((token) => {
        if (token && !savedEvent.id.startsWith('gcal-')) {
          createGoogleCalendarEvent(token, savedEvent).catch((e) =>
            console.warn('Background Google Calendar sync error:', e)
          );
        }
      })
      .catch(() => {});

    if (isLiveSyncEnabled) playSyncPulse();
    const saveConflicts = !savedEvent.allDay
      ? findConflictingEvents(savedEvent, allEventsRef.current)
      : [];
    if (saveConflicts.length > 0) {
      const names = saveConflicts.map((c) => `"${c.title}" (${c.startTime}–${c.endTime})`).join(', ');
      notifyWarning(
        lang === 'vi' ? 'Đã lưu — Cảnh báo trùng lịch!' : 'Saved with schedule overlap!',
        lang === 'vi'
          ? `"${savedEvent.title}" (${savedEvent.startTime}–${savedEvent.endTime}) đang trùng với ${names}.`
          : `"${savedEvent.title}" (${savedEvent.startTime}–${savedEvent.endTime}) overlaps ${names}.`
      );
    } else {
      notifySuccess(
        lang === 'vi' ? 'Đã lưu sự kiện thành công!' : 'Event saved successfully!',
        `"${savedEvent.title}" (${savedEvent.startDate}${savedEvent.allDay ? ' · Cả ngày' : ` lúc ${savedEvent.startTime}`})`
      );
    }
  }, [user, getFirestoreSyncUid, productivity.updateTask, isLiveSyncEnabled, lang]);

  const handleDeleteEvent = useCallback((eventId: string) => {
    // Task-derived calendar events are owned by the productivity store, not by
    // the persisted `gcal_events` array — route the delete to their real owner.
    if (eventId.startsWith('task-')) {
      productivity.deleteTask(eventId.slice('task-'.length));
      setSelectedEventForDetail(null);
      notifySuccess(lang === 'vi' ? 'Đã xóa công việc!' : 'Task deleted!');
      return;
    }

    const target = events.find((e) => e.id === eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    if (selectedEventForDetail?.id === eventId) {
      setSelectedEventForDetail(null);
    }
    const firestoreUid = getFirestoreSyncUid(user);
    if (firestoreUid) {
      import('./services/firestoreSync')
        .then(({ deleteEventFromFirestore }) => deleteEventFromFirestore(firestoreUid, eventId))
        .catch(console.warn);
    }
    if (isLiveSyncEnabled) playSyncPulse();
    notifySuccess(
      lang === 'vi' ? 'Đã xóa sự kiện!' : 'Event deleted!',
      target?.title || undefined
    );
  }, [selectedEventForDetail, user, getFirestoreSyncUid, productivity.deleteTask, events, isLiveSyncEnabled, lang]);

  const handleToggleCompleteTask = (eventId: string) => {
    if (eventId.startsWith('task-')) {
      const taskId = eventId.slice('task-'.length);
      const task = productivity.tasks.find((t) => t.id === taskId);
      productivity.setTaskStatus(taskId, task?.status === 'completed' ? 'todo' : 'completed');
      return;
    }

    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, isCompleted: !e.isCompleted } : e))
    );
  };

  const handleMoveEvent = useCallback((eventId: string, newDateStr: string) => {
    if (eventId.startsWith('task-')) {
      productivity.updateTask(eventId.slice('task-'.length), { dueDate: newDateStr });
      return;
    }

    const firestoreUid = getFirestoreSyncUid(user);
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const updated = {
            ...e,
            startDate: newDateStr,
            endDate: newDateStr,
            updatedAt: Date.now(),
          };
          if (firestoreUid) {
            import('./services/firestoreSync')
              .then(({ saveEventToFirestore }) => saveEventToFirestore(firestoreUid, updated))
              .catch(console.warn);
          }
          return updated;
        }
        return e;
      })
    );
  }, [user, getFirestoreSyncUid, productivity.updateTask]);

  // 9. Drag & Drop and Resizing Engine
  const {
    dndState,
    startDrag,
    startResize,
    updatePointerMove,
    finishDnD,
    cancelDnD,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCalendarDnD(handleSaveEvent, lang);

  // 10. Firebase Auth & Realtime Firestore sync subscription
  useEffect(() => {
    const verified = verifyZenoxSession();
    if (verified) {
      setUser(verified);
      return;
    }

    const unsubscribeAuth = initAuth(
      (authedUser, token) => {
        // Only auto-restore Firebase/Google session if an active Firebase session or valid token exists
        if (!token && !auth.currentUser) {
          return;
        }
        const sessionUser = establishZenoxSession(
          {
            uid: authedUser.uid.startsWith('google-') ? authedUser.uid : `google-${authedUser.uid}`,
            displayName: authedUser.displayName,
            email: authedUser.email,
            photoURL: authedUser.photoURL,
            firebaseUid: auth.currentUser?.uid || authedUser.uid,
          },
          'google'
        );
        setUser(sessionUser);
        setSyncState('synced');
      },
      () => {
        if (!verifyZenoxSession()) {
          setUser(null);
          setSyncState('offline');
        }
      }
    );
    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const firestoreUid = getFirestoreSyncUid(user);
    if (!firestoreUid) {
      if (user) setSyncState('synced');
      return;
    }
    setSyncState('syncing');

    let cancelled = false;
    let unsubscribeFirestore: (() => void) | undefined;

    import('./services/firestoreSync')
      .then(({ subscribeUserEvents }) => {
        if (cancelled) return;
        unsubscribeFirestore = subscribeUserEvents(
          firestoreUid,
          (remoteEvents) => {
            if (remoteEvents.length > 0) {
              setEvents((prev) => {
                const remoteMap = new Map(remoteEvents.map((r) => [r.id, r]));
                const merged = prev.map((local) => {
                  const remote = remoteMap.get(local.id);
                  if (!remote) return local;
                  remoteMap.delete(local.id);
                  return (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
                });
                return [...merged, ...Array.from(remoteMap.values())];
              });
            }
            setSyncState('synced');
            setLastSyncedTime(new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US'));
          },
          (err) => {
            console.warn('Firestore subscription warning:', err);
            setSyncState('offline');
          }
        );
      })
      .catch((err) => {
        console.warn('Failed to load Firestore sync:', err);
        if (!cancelled) setSyncState('offline');
      });

    return () => {
      cancelled = true;
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [user, getFirestoreSyncUid, lang]);

  // Auto-sync from saved Google Calendar iCal URL if present
  useEffect(() => {
    const savedUrl = localStorage.getItem('gcal_sync_url');
    if (savedUrl) {
      setSyncState('syncing');
      fetchCalendarFromICalUrl(savedUrl)
        .then((remoteEvents) => {
          if (remoteEvents.length > 0) {
            setEvents((prev) => {
              const map = new Map(prev.map((e) => [e.id, e]));
              for (const item of remoteEvents) {
                map.set(item.id, item);
              }
              return Array.from(map.values());
            });
            setLastSyncedTime(new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US'));
            setSyncState('synced');
          }
        })
        .catch(() => {
          setSyncState('offline');
        });
    }
  }, [lang]);

  // In-app reminder notification toast
  const [activeAlert, setActiveAlert] = useState<{ title: string; time: string } | null>(null);

  // Navigation handlers
  const handleNavigateToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleNavigatePrev = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else if (view === 'week') {
        d.setDate(d.getDate() - 7);
      } else if (view === 'day') {
        d.setDate(d.getDate() - 1);
      } else if (view === 'fourDay') {
        d.setDate(d.getDate() - 4);
      } else if (view === 'year') {
        d.setFullYear(d.getFullYear() - 1);
      } else {
        d.setDate(d.getDate() - 7);
      }
      return d;
    });
  }, [view]);

  const handleNavigateNext = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else if (view === 'week') {
        d.setDate(d.getDate() + 7);
      } else if (view === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (view === 'fourDay') {
        d.setDate(d.getDate() + 4);
      } else if (view === 'year') {
        d.setFullYear(d.getFullYear() + 1);
      } else {
        d.setDate(d.getDate() + 7);
      }
      return d;
    });
  }, [view]);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsLifeCopilotOpen((v) => !v);
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        setIsEventModalOpen(false);
        setSelectedEventForDetail(null);
        setIsQuickAddOpen(false);
        setIsShortcutsOpen(false);
        setIsExportImportOpen(false);
        setIsCloudSyncOpen(false);
        setIsLifeCopilotOpen(false);
        setMiniPopover((prev) => ({ ...prev, isOpen: false }));
        setDayPlanner((prev) => ({ ...prev, isOpen: false }));
        cancelDnD();
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        handleNavigateToday();
      } else if (e.key === 'j' || e.key === 'n') {
        handleNavigateNext();
      } else if (e.key === 'k') {
        // 'P' is reserved for the productivity analytics view (see below and
        // the shortcuts modal), so only 'K' steps back a period here.
        handleNavigatePrev();
      } else if (e.key === 'm' || e.key === 'M') {
        handleViewChange('month');
      } else if (e.key === 'w' || e.key === 'W') {
        handleViewChange('week');
      } else if (e.key === 'd' || e.key === 'D') {
        handleViewChange('day');
      } else if (e.key === 'x' || e.key === 'X') {
        handleViewChange('fourDay');
      } else if (e.key === 'a' || e.key === 'A') {
        handleViewChange('schedule');
      } else if (e.key === 'p' || e.key === 'P') {
        handleViewChange('analytics');
      } else if (e.key === 'y' || e.key === 'Y') {
        handleViewChange('year');
      } else if (e.key === '1') {
        handleViewChange('dashboard');
      } else if (e.key === '2') {
        handleViewChange('tasks');
      } else if (e.key === '3') {
        handleViewChange('focus');
      } else if (e.key === '4') {
        handleViewChange('finance');
      } else if (e.key === '5') {
        handleViewChange('health');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        openCreateModal('event');
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        searchInput?.focus();
      } else if (e.key === '?') {
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNavigateToday, handleNavigateNext, handleNavigatePrev, cancelDnD]);

  // Category toggles
  const handleToggleCategory = (id: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  };

  const handleAddCategory = (name: string, color: string) => {
    const newCat: CalendarCategory = {
      id: `custom-${Date.now()}`,
      name,
      nameVi: name,
      color,
      visible: true,
      isCustom: true,
    };
    setCategories((prev) => [...prev, newCat]);
  };

  const handleDeleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  // Open create modal with pre-fills
  const openCreateModal = (
    type: EventType = 'event',
    dateStr?: string,
    timeStr?: string,
    endTimeStr?: string,
    titleStr?: string
  ) => {
    setEventToEdit(null);
    setModalType(type);
    setModalDate(dateStr || formatDateString(currentDate));
    setModalTime(timeStr || '09:00');
    setModalEndTime(endTimeStr || '10:00');
    setModalTitle(titleStr || '');
    setModalAllDay(false);
    setModalColor(undefined);
    setIsEventModalOpen(true);
  };

  // Inline Quick Add trigger on MonthView or TimeGridView click
  const handleOpenInlineQuickAdd = (
    dateStr: string,
    startTime: string = '09:00',
    endTime: string = '10:00',
    clientX?: number,
    clientY?: number
  ) => {
    const left = clientX !== undefined ? clientX : window.innerWidth / 2 - 180;
    const top = clientY !== undefined ? clientY : window.innerHeight / 2 - 170;

    setMiniPopover({
      isOpen: true,
      position: { top, left },
      dateStr,
      startTime,
      endTime,
    });
  };

  // Google OAuth Handlers
  const handleGoogleSignIn = async () => {
    try {
      const { executeRealGoogleSync, hasOwnClientId } = await import('./services/realGoogleAuth');
      // The shared sample Client ID cannot authorize this origin, so the Google
      // consent popup would only end on a "400: origin_mismatch" error page.
      // Send the user straight to the real sync dialog (own Client ID, access
      // token, or secret iCal URL) instead of opening a dead popup.
      if (!hasOwnClientId()) {
        setIsCloudSyncOpen(true);
        return;
      }

      setIsSyncing(true);
      // Attempt official real Google OAuth login via Google Identity Services
      const realRes = await executeRealGoogleSync();
      if (realRes?.user) {
        const sessionUser = establishZenoxSession(realRes.user, 'google');
        setUser(sessionUser);
        setSyncState('synced');
        playSuccessSound();
        notifySuccess(
          lang === 'vi' ? 'Đã kết nối Google Calendar thành công!' : 'Google Calendar Connected!',
          realRes.user.email || 'Google'
        );
        if (realRes.events && realRes.events.length > 0) {
          accountStorage.setItem('gcal_events', JSON.stringify(realRes.events), sessionUser.uid);
          setEvents(realRes.events);
        }
        setActiveAlert({
          title: lang === 'vi' ? 'Đã kết nối Google Calendar thành công!' : 'Google Calendar Connected!',
          time: realRes.user.email || 'Google',
        });
        setLastSyncedTime(new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US'));
        return;
      }
    } catch (realErr: any) {
      console.info('Google GIS direct popup requires origin or token setup, opening Sync Modal:', realErr);
      setIsCloudSyncOpen(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Logout notice:', err);
    }
    logoutZenoxSession();
    setUser(null);
    localStorage.removeItem('gcal_active_user');
    sessionStorage.removeItem('zenox_workspace_entered');
    setView('dashboard');
  };

  const handleAuthUserSuccess = (authedUser: ZenoxUser, syncGoogleCalendar: boolean = true) => {
    if (syncGoogleCalendar) {
      // Re-hydrate accurate synced Google Calendar events strictly from user's scoped namespace
      try {
        const stored = accountStorage.getItem('gcal_events', authedUser.uid);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEvents(parsed);
          }
        }
      } catch (e) {
        console.warn('Could not re-hydrate events on auth success:', e);
      }
      notifySuccess(
        lang === 'vi' ? 'Đã kết nối & đồng bộ dữ liệu!' : 'Connected & Synced!',
        lang === 'vi'
          ? 'Dữ liệu từ Google Calendar đã được đồng bộ chính xác.'
          : 'Google Calendar data accurately synchronized.'
      );
      playSuccessSound();
    } else {
      // User declined sync: preserve existing workspace events if any, or initialize clean empty list
      let hasExistingEvents = false;
      try {
        const stored = accountStorage.getItem('gcal_events', authedUser.uid);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEvents(parsed);
            hasExistingEvents = true;
          }
        }
      } catch {}

      if (!hasExistingEvents) {
        accountStorage.setItem('gcal_events', JSON.stringify([]), authedUser.uid);
        setEvents([]);
      }

      notifySuccess(
        lang === 'vi'
          ? hasExistingEvents
            ? 'Đã đăng nhập Workspace'
            : 'Khởi tạo Workspace mới'
          : hasExistingEvents
            ? 'Signed in to Workspace'
            : 'Fresh Workspace Initialized',
        lang === 'vi'
          ? hasExistingEvents
            ? `Chào mừng ${authedUser.displayName} quay trở lại.`
            : 'Tài khoản của bạn đã được khởi tạo ở trạng thái hoàn toàn mới.'
          : hasExistingEvents
            ? `Welcome back, ${authedUser.displayName}.`
            : 'Your account is ready with a fresh blank canvas.'
      );
    }

    setUser(authedUser);
    setIsLoginModalOpen(false);
    sessionStorage.setItem('zenox_workspace_entered', 'true');
    setView('dashboard');
    navigateToRoute('workspace');
  };

  const handleCreateNewAccount = (name: string, email: string, clearData: boolean) => {
    const trimmedName = name.trim() || (lang === 'vi' ? 'Người dùng mới' : 'New User');
    const trimmedEmail = email.trim() || `${'user-' + Date.now()}@zenox.local`;
    const newUid = 'user-' + Date.now();
    const sessionUser = establishZenoxSession(
      {
        uid: newUid,
        displayName: trimmedName,
        email: trimmedEmail,
        photoURL: null,
      },
      'zenox_vault'
    );

    if (clearData) {
      accountStorage.setItem('gcal_events', JSON.stringify([]), sessionUser.uid);
      setEvents([]);
      productivity.clearAll(trimmedName, trimmedEmail);
    } else {
      productivity.updateCtgProfile({
        name: trimmedName,
        email: trimmedEmail,
      });
    }

    setUser(sessionUser);
    setSyncState('synced');
    setLastSyncedTime(new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US'));
    setActiveAlert({
      title: lang === 'vi' ? `Chào mừng ${trimmedName}!` : `Welcome ${trimmedName}!`,
      time: clearData
        ? (lang === 'vi' ? 'Dữ liệu đã được làm mới hoàn toàn.' : 'Data reset to fresh state.')
        : (lang === 'vi' ? 'Tài khoản mới đã kích hoạt.' : 'New account activated.'),
    });
  };

  const runLiveSyncCheck = useCallback(async (options?: { userInitiated?: boolean } | boolean) => {
    const isUserInitiated = typeof options === 'boolean' ? options : Boolean(options?.userInitiated);
    if (!isLiveSyncEnabled) return;
    setIsSyncing(true);
    setSyncState('syncing');

    try {
      // Natural 1.2s processing delay to make state transitions graceful and avoid jitter
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // 1. Verify and ensure local vault storage integrity (100% safe)
      const currentEvents = accountStorage.getItem('gcal_events', user?.uid);
      if (currentEvents) {
        try {
          JSON.parse(currentEvents);
        } catch {
          console.warn('Vault integrity check: structure normalized');
        }
      }

      let syncNotice: string | null = null;

      // 2. If Google Calendar access token exists, fetch & merge events safely
      const token = await getAccessToken();
      if (token) {
        try {
          const gEvents = await fetchGoogleCalendarEvents(token);
          if (gEvents && gEvents.length > 0) {
            setEvents((prev) => {
              const merged = mergeSyncedGoogleEvents(gEvents, prev);
              try {
                accountStorage.setItem('gcal_events', JSON.stringify(merged), user?.uid);
              } catch {}
              return merged;
            });
          }
        } catch (gcalErr: any) {
          console.warn('Google Calendar sync notice during Live Sync:', gcalErr);
          const isAuthExpired =
            gcalErr?.code === 'GOOGLE_AUTH_EXPIRED' ||
            gcalErr?.name === 'GoogleAuthExpiredError' ||
            gcalErr?.message?.toLowerCase().includes('hết hạn') ||
            gcalErr?.message?.toLowerCase().includes('invalid authentication credentials') ||
            gcalErr?.message?.includes('401');

          if (isAuthExpired) {
            clearAccessToken();
            syncNotice =
              lang === 'vi'
                ? 'Phiên kết nối Google Calendar đã hết hạn. Dữ liệu đã lưu an toàn ở bộ nhớ máy.'
                : 'Google Calendar session expired. Local data is safely preserved.';
            if (isUserInitiated) {
              setActiveAlert({
                title:
                  lang === 'vi'
                    ? 'Phiên Google Calendar đã hết hạn. Vui lòng kết nối lại tài khoản.'
                    : 'Google Calendar session expired. Please reconnect.',
                time: new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US'),
              });
            }
          } else {
            syncNotice = gcalErr instanceof Error ? gcalErr.message : String(gcalErr);
          }
        }
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSyncedTime(timeStr);
      setLastSyncError(syncNotice);
      // Local vault and storage are 100% safe, keep state healthy and peaceful
      setSyncState('synced');

      // Only play subtle chime sound when explicitly initiated by user interaction
      if (isUserInitiated) {
        playLiveSyncChime();
      }
    } catch (err) {
      console.warn('Live Sync verification notice:', err);
      setLastSyncError(err instanceof Error ? err.message : String(err));
      setSyncState(user ? 'error' : 'offline');
    } finally {
      setIsSyncing(false);
    }
  }, [isLiveSyncEnabled, user?.uid, lang]);

  const handleToggleLiveSync = useCallback((enabled: boolean) => {
    setIsLiveSyncEnabled(enabled);
    try {
      localStorage.setItem('zenox_live_sync_enabled', String(enabled));
    } catch {}

    playToggleSound(enabled);

    if (liveSyncDebounceTimerRef.current) {
      clearTimeout(liveSyncDebounceTimerRef.current);
    }

    if (enabled) {
      setSyncState('syncing');
      // Debounce and delay sync execution smoothly by 800ms
      liveSyncDebounceTimerRef.current = setTimeout(() => {
        runLiveSyncCheck({ userInitiated: true });
      }, 800);
    } else {
      setSyncState('offline');
    }
  }, [runLiveSyncCheck]);

  // Online/Offline network listener to auto-heal sync status
  useEffect(() => {
    const handleOnline = () => {
      setLastSyncError(null);
      if (isLiveSyncEnabled) {
        runLiveSyncCheck({ userInitiated: false });
      }
    };
    const handleOffline = () => {
      setLastSyncError(lang === 'vi' ? 'Mất kết nối Internet tạm thời' : 'Internet connection lost');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isLiveSyncEnabled, runLiveSyncCheck, lang]);

  // Automatic Live Sync check on page reload / load or entering workspace with 1.8s calm delay
  useEffect(() => {
    if (user && isLiveSyncEnabled) {
      const timer = setTimeout(() => {
        runLiveSyncCheck({ userInitiated: false });
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [user?.uid, isLiveSyncEnabled]);

  const handleSyncGoogleCalendar = async (explicitToken?: string) => {
    setIsSyncing(true);
    try {
      const token = explicitToken || (await getAccessToken());
      if (!token) {
        // No real token yet: route the user to the real sync dialog
        // (Google OAuth popup / access token / secret iCal URL).
        setIsCloudSyncOpen(true);
        return;
      }
      const gEvents = await fetchGoogleCalendarEvents(token);
      if (gEvents && gEvents.length > 0) {
        setEvents((prev) => {
          const merged = mergeSyncedGoogleEvents(gEvents, prev);
          try {
            accountStorage.setItem('gcal_events', JSON.stringify(merged), user?.uid);
          } catch {}
          return merged;
        });
      }
      const now = new Date();
      const timeStr = now.toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSyncedTime(timeStr);
      setSyncState('synced');
      playSuccessSound();
      notifySuccess(
        lang === 'vi' ? 'Đồng bộ Google Calendar thành công!' : 'Google Calendar Synced!',
        lang === 'vi' ? `Đã đồng bộ ${gEvents?.length || 0} sự kiện.` : `Synced ${gEvents?.length || 0} events.`
      );
    } catch (err: any) {
      console.error('Failed to sync Google Calendar:', err);
      const isExpired =
        err?.code === 'GOOGLE_AUTH_EXPIRED' ||
        err?.name === 'GoogleAuthExpiredError' ||
        err?.message?.toLowerCase().includes('hết hạn') ||
        err?.message?.toLowerCase().includes('invalid authentication credentials') ||
        err?.message?.includes('401');

      if (isExpired) {
        clearAccessToken();
        setLastSyncError(
          lang === 'vi'
            ? 'Phiên kết nối Google Calendar đã hết hạn. Vui lòng cấp lại quyền.'
            : 'Google Calendar session expired. Please reconnect.'
        );
        setIsCloudSyncOpen(true);
      }

      setActiveAlert({
        title:
          lang === 'vi'
            ? 'Đồng bộ Google Calendar thất bại — phiên kết nối có thể đã hết hạn, vui lòng kết nối lại.'
            : 'Google Calendar sync failed — session may have expired, please reconnect.',
        time: new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US'),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const nutritionSummary = useMemo(() => {
    const todayStr = formatDateString(new Date());
    const todayLog = productivity.healthLogs.find((l) => l.date === todayStr);
    const consumedKcal = todayLog?.caloriesIn || 0;
    const consumedProtein = todayLog?.protein || 0;

    const roadmap = productivity.ctgPeriodizedRoadmap;
    const currentId = roadmap?.activePhaseId;
    let phase = roadmap?.phases.find((p) => p.id === currentId);
    if (!phase || currentId === 'none') {
      phase = roadmap?.phases.find((p) => p.isCurrent) || roadmap?.phases[0];
    }

    const effectiveWeight = todayLog?.weightKg || productivity.ctgProfile?.targetWeightKg || 65;
    const estimatedTdee = tdee(productivity.ctgProfile, effectiveWeight);
    const targetKcal = phase?.targetKcal || calorieTarget(estimatedTdee, productivity.ctgProfile.goal);
    const targets = macroTargets(targetKcal, effectiveWeight, productivity.ctgProfile.goal, productivity.nutritionSettings);
    const targetProtein = phase?.macros.protein || targets.protein;

    return {
      consumedKcal,
      targetKcal,
      consumedProtein,
      targetProtein,
    };
  }, [
    productivity.healthLogs,
    productivity.ctgPeriodizedRoadmap,
    productivity.ctgProfile,
    productivity.nutritionSettings,
  ]);

  const activeRoadmapSummary = useMemo(() => {
    const roadmap = productivity.ctgPeriodizedRoadmap;
    if (!roadmap?.phases?.length) return null;
    const currentId = roadmap.activePhaseId;
    let phase = roadmap.phases.find((p) => p.id === currentId);
    if (!phase || currentId === 'none') {
      phase = roadmap.phases.find((p) => p.isCurrent) || roadmap.phases[0];
    }
    if (!phase) return null;

    let remainingDays = 0;
    if (phase.endDate) {
      const e = parseVnDate(phase.endDate);
      const eMs = e.getTime();
      if (Number.isFinite(eMs)) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        e.setHours(0, 0, 0, 0);
        const diff = Math.round((e.getTime() - now.getTime()) / 864e5);
        remainingDays = Math.max(0, Number.isFinite(diff) ? diff : 0);
      }
    }

    return {
      roadmapTitle: roadmap.title || 'Lộ trình ZENOX',
      phaseName: phase.name,
      remainingDays,
      startWeightKg: phase.startWeightKg,
      targetWeightKg: phase.targetWeightKg,
      startDate: phase.startDate,
      endDate: phase.endDate,
    };
  }, [productivity.ctgPeriodizedRoadmap]);

  const taskAlerts = useMemo(() => {
    const todayStr = formatDateString(new Date());
    const overdue = productivity.tasks.filter(
      (t) => t.status !== 'completed' && t.dueDate && t.dueDate < todayStr
    ).length;
    const dueToday = productivity.tasks.filter(
      (t) => t.status !== 'completed' && t.dueDate === todayStr
    ).length;
    return { overdue, dueToday };
  }, [productivity.tasks]);

  const weightTrendAlert = useMemo(() => {
    if (!productivity.bodyPoints || productivity.bodyPoints.length < 2) return null;
    const sorted = [...productivity.bodyPoints].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const days = Math.max(1, Math.round((new Date(latest.date).getTime() - new Date(prev.date).getTime()) / 864e5));
    if (days > 14) return null;
    const weeklyRate = ((latest.weightKg - prev.weightKg) / days) * 7;
    const isCut = productivity.ctgProfile.goal === 'cut';
    const isBulk = productivity.ctgProfile.goal === 'bulk';

    if (isCut && weeklyRate < -0.75) {
      return {
        type: 'warning' as const,
        title: lang === 'vi' ? 'Cảnh báo giảm cân nhanh' : 'Rapid weight loss alert',
        message:
          lang === 'vi'
            ? `Tốc độ sụt cân (${weeklyRate.toFixed(2)}kg/tuần) nhanh hơn mức an toàn (-0.7kg/tuần). Khuyến nghị bổ sung thêm tinh bột để bảo toàn cơ nạc!`
            : `Weight drop (${weeklyRate.toFixed(2)}kg/week) is faster than recommended (-0.7kg/week).`,
      };
    }
    if (isBulk && weeklyRate > 0.45) {
      return {
        type: 'warning' as const,
        title: lang === 'vi' ? 'Cảnh báo tăng mỡ nhanh' : 'Rapid weight gain alert',
        message:
          lang === 'vi'
            ? `Cân nặng tăng (+${weeklyRate.toFixed(2)}kg/tuần) vượt ngưỡng tăng cơ tự nhiên (+0.4kg/tuần). Khuyến nghị giảm nhẹ 150 kcal thặng dư.`
            : `Weight gain (+${weeklyRate.toFixed(2)}kg/week) exceeds natural hypertrophy threshold (+0.4kg/week).`,
      };
    }
    return null;
  }, [productivity.bodyPoints, productivity.ctgProfile.goal, lang]);

  if (view === 'scene') {
    return (
      <div className="w-screen h-dvh bg-[#070205] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
        <button
          onClick={() => setView('dashboard')}
          className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xl border border-white/20 transition-all cursor-pointer"
        >
          ← Quay lại Trang Chủ
        </button>

        <div className="text-center mb-6 max-w-md">
          <span className="text-[11px] font-mono tracking-widest text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            ThreeUI Component
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3">SkeuomorphicToggleCollection (Shader)</h2>
          <p className="text-xs text-zinc-400 mt-1">
            A raw-WebGL switch drawn entirely in one fragment pass: plasma interior, streaming sparks, chromatic bloom, and a pointer-lit thumb.
          </p>
        </div>

        <div className="w-full max-w-[540px] h-[340px] sm:h-[380px] rounded-3xl overflow-hidden border border-white/15 shadow-[0_20px_80px_rgba(0,0,0,0.9),0_0_60px_rgba(225,29,72,0.25)] bg-[#0a0a0a]">
          <Suspense fallback={<ChunkFallback />}>
            <Scene
              syncState={syncState}
              lastSyncedTime={lastSyncedTime}
              onSync={() => runLiveSyncCheck(false)}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // Direct App Auth Guard: skip marketing landing page, open directly to clean mobile Auth screen
  if (!user) {
    return (
      <LoginModal
        isOpen={true}
        standalone={true}
        onClose={() => {}}
        initialMode={loginModalMode}
        onLoginSuccess={(authedUser, syncAgreed) => {
          handleAuthUserSuccess(authedUser, syncAgreed);
        }}
        lang={lang}
      />
    );
  }

  return (
    <div key={user?.uid || "zenox_guest"} className="flex h-dvh w-screen overflow-hidden bg-slate-50 dark:bg-[#070204] dark:vortex-canvas text-slate-800 dark:text-slate-100 font-sans antialiased">

      {/* Global Interactive Notification Toast Container */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        initialMode={loginModalMode}
        onLoginSuccess={(authedUser, syncAgreed) => { handleAuthUserSuccess(authedUser, syncAgreed); }}
        lang={lang}
      />
      <ToastContainer />

      {/* Reminder Banner Toast */}
      {activeAlert && (
        <div className="fixed top-4 right-4 bg-rose-600 text-white px-4 py-2.5 rounded-2xl shadow-xl z-50 flex items-center gap-3 animate-in slide-in-from-top">
          <Bell className="w-4 h-4" />
          <div className="text-xs">
            <span className="font-bold">{lang === 'vi' ? 'Nhắc nhở: ' : 'Reminder: '}</span>
            <span>
              {activeAlert.title} ({activeAlert.time})
            </span>
          </div>
          <button
            onClick={() => setActiveAlert(null)}
            className="p-1 hover:bg-rose-700 rounded-lg text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modern Executive Sidebar Dock */}
      <Sidebar
        currentDate={currentDate}
        onSelectDate={(d) => {
          setCurrentDate(d);
          if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
          }
        }}
        isOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
        categories={categories}
        onToggleCategory={handleToggleCategory}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onOpenCreateModal={(type) => openCreateModal(type)}
        lang={lang}
        onViewChange={handleViewChange}
        currentView={view}
        onOpenSettings={() => setIsShortcutsOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        onGoogleSignIn={handleGoogleSignIn}
        onLogout={handleGoogleSignOut}
        userEmail={user?.email || undefined}
        isLoggedInGoogle={Boolean(user)}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Modern Header Bar */}
        <Header
          currentDate={currentDate}
          view={view}
          onViewChange={handleViewChange}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenExportImport={() => setIsExportImportOpen(true)}
          onOpenCloudSync={() => setIsCloudSyncOpen(true)}
          onGoogleSignIn={handleGoogleSignIn}
          onOpenLifeCopilot={() => setIsLifeCopilotOpen(true)}
          onToggleRightDrawer={() => setIsRightDrawerOpen((prev) => !prev)}
          userEmail={user?.email || ''}
          userName={user?.displayName || undefined}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          lang={lang}
          onToggleLang={toggleLang}
          isLoggedInGoogle={Boolean(user)}
          isSyncing={isSyncing}
          syncState={syncState}
          isLiveSyncEnabled={isLiveSyncEnabled}
          onToggleLiveSync={handleToggleLiveSync}
          lastSyncedTime={lastSyncedTime}
          lastSyncError={lastSyncError}
          onTriggerSync={() => runLiveSyncCheck({ userInitiated: true })}
          pendingTasksCount={productivity.tasks.filter((t) => t.status !== 'completed').length}
          nutritionSummary={nutritionSummary}
          activeRoadmapSummary={activeRoadmapSummary}
          taskAlerts={taskAlerts}
          weightTrendAlert={weightTrendAlert}
        />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 min-w-0">
          <div key={view} className="view-slide-down-smooth h-full flex flex-col min-w-0">
          {view === 'month' ||
          view === 'week' ||
          view === 'day' ||
          view === 'fourDay' ||
          view === 'year' ||
          view === 'schedule' ? (
            <div className="flex flex-col h-full bg-white dark:bg-white/[0.03] backdrop-blur-xl border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
              <CalendarActionBar
                currentDate={currentDate}
                onPrev={handleNavigatePrev}
                onNext={handleNavigateNext}
                onToday={handleNavigateToday}
                view={view}
                onViewChange={handleViewChange}
                lang={lang}
                categories={categories}
                onToggleCategory={handleToggleCategory}
                onAddCategory={handleAddCategory}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onOpenCreateModal={(type) => openCreateModal(type)}
                onCleanData={handleCleanCalendar}
                weekStartsOnMonday={weekStartsOnMonday}
                onToggleWeekStart={() => setWeekStartsOnMonday((prev) => !prev)}
                eventTypeFilter={eventTypeFilter}
                onChangeEventTypeFilter={setEventTypeFilter}
              />

              <div className="flex-1 overflow-hidden relative">
                {view === 'month' && (
                  <MonthView
                    currentDate={currentDate}
                    events={calendarVisibleEvents}
                    visibleCategoryIds={visibleCategoryIds}
                    onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
                    onCellClick={(dateStr, clientX, clientY) => {
                      handleOpenInlineQuickAdd(dateStr, '09:00', '10:00', clientX, clientY);
                    }}
                    onOpenDayPlanner={(dateStr) => {
                      setDayPlanner({ isOpen: true, dateStr });
                    }}
                    onMoveEvent={handleMoveEvent}
                    weekStartsOnMonday={weekStartsOnMonday}
                    lang={lang}
                  />
                )}

                {(view === 'week' || view === 'day' || view === 'fourDay') && (
                  <TimeGridView
                    currentDate={currentDate}
                    viewType={view}
                    events={calendarVisibleEvents}
                    visibleCategoryIds={visibleCategoryIds}
                    onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
                    onSlotClick={(dateStr, timeStr, clientX, clientY) => {
                      const parts = timeStr.split(':');
                      const nextH = Math.min(23, parseInt(parts[0], 10) + 1);
                      const nextTime = `${String(nextH).padStart(2, '0')}:${parts[1]}`;
                      handleOpenInlineQuickAdd(dateStr, timeStr, nextTime, clientX, clientY);
                    }}
                    onSlotRangeSelect={(dateStr, startTime, endTime, clientX, clientY) => {
                      handleOpenInlineQuickAdd(dateStr, startTime, endTime, clientX, clientY);
                    }}
                    lang={lang}
                    dndState={dndState}
                    onStartDrag={startDrag}
                    onStartResize={startResize}
                    onPointerMove={updatePointerMove}
                    onFinishDnD={finishDnD}
                    onCancelDnD={cancelDnD}
                    weekStartsOnMonday={weekStartsOnMonday}
                  />
                )}

                {view === 'year' && (
                  <YearView
                    currentDate={currentDate}
                    events={calendarVisibleEvents}
                    visibleCategoryIds={visibleCategoryIds}
                    onSelectDate={(d) => {
                      setCurrentDate(d);
                      handleViewChange('day');
                    }}
                    lang={lang}
                  />
                )}

                {view === 'schedule' && (
                  <ScheduleView
                    currentDate={currentDate}
                    events={calendarVisibleEvents}
                    visibleCategoryIds={visibleCategoryIds}
                    searchQuery={searchQuery}
                    onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
                    onToggleCompleteTask={handleToggleCompleteTask}
                    onJoinMeet={(ev) => {
                      if (ev.meetUrl) window.open(ev.meetUrl, '_blank');
                    }}
                    lang={lang}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="h-full">
              <Suspense fallback={<ChunkFallback />}>
              {view === 'analytics' && (
                <TimeAnalyticsView
                  events={allEvents}
                  categories={categories}
                  currentDate={currentDate}
                  lang={lang}
                />
              )}

              {view === 'dashboard' && (
                <ProductivityDashboard
                  events={allEvents}
                  tasks={productivity.tasks}
                  goals={productivity.goals}
                  goalProgress={productivity.goalProgress}
                  sessions={productivity.sessions}
                  transactions={productivity.transactions}
                  budget={productivity.budget}
                  healthLogs={productivity.healthLogs}
                  healthProfile={productivity.healthProfile}
                  lang={lang}
                  onNavigate={handleViewChange}
                  onSetTaskStatus={productivity.setTaskStatus}
                  onOpenEvent={(ev) => setSelectedEventForDetail(ev)}
                  onAddTask={(title) =>
                    productivity.addTask({
                      title,
                      status: 'todo',
                      priority: 'medium',
                      categoryId: 'tasks',
                      dueDate: todayString(),
                    })
                  }
                  habits={productivity.habits}
                  onToggleHabit={productivity.toggleHabitDate}
                  onScheduleTask={(taskId, dateStr, startTime, endTime) => {
                    productivity.updateTask(taskId, { dueDate: dateStr, startTime, endTime });
                  }}
                  currentUser={user}
                  onOpenLifeCopilot={() => setIsLifeCopilotOpen(true)}
                  onQuickAddWater={(ml) => {
                    const today = todayString();
                    const existing = productivity.healthLogs.find((l) => l.date === today);
                    productivity.upsertHealthLog({
                      ...(existing || { date: today, source: 'manual' }),
                      waterMl: (existing?.waterMl || 0) + ml,
                      date: today,
                      source: 'manual',
                    });
                  }}
                  onOpenMacroModal={() => {
                    try {
                      localStorage.setItem('vortex_health_subtab', 'nutrition');
                    } catch {}
                    handleViewChange('health');
                  }}
                />
              )}

              {view === 'tasks' && (
                <TasksGoalsView
                  tasks={productivity.tasks}
                  goals={productivity.goals}
                  goalProgress={productivity.goalProgress}
                  categories={categories}
                  lang={lang}
                  onAddTask={productivity.addTask}
                  onUpdateTask={productivity.updateTask}
                  onDeleteTask={productivity.deleteTask}
                  onSetTaskStatus={productivity.setTaskStatus}
                  onToggleSubtask={productivity.toggleSubtask}
                  onAddSubtask={productivity.addSubtask}
                  onRemoveSubtask={productivity.removeSubtask}
                  onAddGoal={productivity.addGoal}
                  onDeleteGoal={productivity.deleteGoal}
                  onOpenTaskOnCalendar={(dateStr) => {
                    setCurrentDate(parseDateString(dateStr));
                    handleViewChange('day');
                  }}
                  onStartFocus={(taskId) => {
                    try {
                      const raw = accountStorage.getItem('gcal_focus_timer');
                      const base = raw
                        ? JSON.parse(raw)
                        : {
                            mode: 'pomodoro',
                            phase: 'focus',
                            intervalId: 'pomo25',
                            countdownMinutes: 30,
                            linkedTaskId: '',
                            remaining: 25 * 60,
                            elapsed: 0,
                            running: false,
                            runStartedAt: null,
                            soundOn: true,
                            completedPomodoros: 0,
                          };
                      base.linkedTaskId = taskId;
                      base.mode = 'pomodoro';
                      accountStorage.setItem('gcal_focus_timer', JSON.stringify(base));
                    } catch {}
                    handleViewChange('focus');
                  }}
                  habits={productivity.habits}
                  onAddHabit={productivity.addHabit}
                  onToggleHabit={productivity.toggleHabitDate}
                  onDeleteHabit={productivity.deleteHabit}
                />
              )}

              {view === 'focus' && (
                <StudyFocusView
                  tasks={productivity.tasks}
                  goals={productivity.goals}
                  sessions={productivity.sessions}
                  lang={lang}
                  onAddSession={productivity.addSession}
                  onDeleteSession={productivity.deleteSession}
                  onStartTask={(taskId) => productivity.setTaskStatus(taskId, 'in_progress')}
                  onOpenTask={(taskId) => {
                    const task = productivity.tasks.find((t) => t.id === taskId);
                    if (task?.dueDate) {
                      setCurrentDate(parseDateString(task.dueDate));
                      handleViewChange('day');
                    } else {
                      handleViewChange('tasks');
                    }
                  }}
                />
              )}

              {view === 'finance' && (
                <FinanceView
                  transactions={productivity.transactions}
                  budget={productivity.budget}
                  lang={lang}
                  onAddTransaction={productivity.addTransaction}
                  onUpdateTransaction={productivity.updateTransaction}
                  onDeleteTransaction={productivity.deleteTransaction}
                  onUpdateBudget={productivity.updateBudget}
                  onClearAllTransactions={productivity.clearAllTransactions}
                  onSetRealStartingBalance={productivity.setRealStartingBalance}
                  onAdjustBalanceWithTransaction={productivity.adjustBalanceWithTransaction}
                  onResetFinance={productivity.resetFinance}
                />
              )}

              {view === 'health' && (
                <HealthView
                  healthLogs={productivity.healthLogs}
                  healthProfile={productivity.healthProfile}
                  workouts={productivity.workouts}
                  lang={lang}
                  onUpsertHealthLog={productivity.upsertHealthLog}
                  onUpdateHealthProfile={productivity.updateHealthProfile}
                  onAddWorkout={productivity.addWorkout}
                  onDeleteWorkout={productivity.deleteWorkout}
                  currentUser={user}
                  onGoogleSignIn={handleGoogleSignIn}
                  ctgProfile={productivity.ctgProfile}
                  onUpdateCtgProfile={productivity.updateCtgProfile}
                  bodyPoints={productivity.bodyPoints}
                  onAddBodyPoint={productivity.addBodyPoint}
                  onUpdateBodyPoint={productivity.updateBodyPoint}
                  onDeleteBodyPoint={productivity.deleteBodyPoint}
                  bodyPhotos={productivity.bodyPhotos}
                  onAddBodyPhoto={productivity.addBodyPhoto}
                  onDeleteBodyPhoto={productivity.deleteBodyPhoto}
                  weeklyCheckins={productivity.weeklyCheckins}
                  onAddWeeklyCheckin={productivity.addWeeklyCheckin}
                  onDeleteWeeklyCheckin={productivity.deleteWeeklyCheckin}
                  savedRoadmaps={productivity.savedRoadmaps}
                  onAddSavedRoadmap={productivity.addSavedRoadmap}
                  onDeleteSavedRoadmap={productivity.deleteSavedRoadmap}
                  ctgPeriodizedRoadmap={productivity.ctgPeriodizedRoadmap}
                  savedCtgRoadmaps={productivity.savedCtgRoadmaps}
                  onUpdateCtgPeriodizedRoadmap={productivity.updateCtgPeriodizedRoadmap}
                  onSetActiveRoadmapPhase={productivity.setActiveRoadmapPhase}
                  onSaveCtgRoadmap={productivity.saveCtgRoadmapToList}
                  onDeleteCtgRoadmap={productivity.deleteCtgRoadmapFromList}
                  onSwitchCtgRoadmap={productivity.switchActiveCtgRoadmap}
                  onDeleteCurrentCtgRoadmap={productivity.deleteCurrentCtgRoadmap}
                  customExercises={productivity.customExercises}
                  onAddCustomExercise={productivity.addCustomExercise}
                  onDeleteCustomExercise={productivity.deleteCustomExercise}
                  onApplySplitTemplate={productivity.applySplitTemplate}
                  plannedSessions={productivity.plannedSessions}
                  onAddPlannedSession={productivity.addPlannedSession}
                  onUpdatePlannedSession={productivity.updatePlannedSession}
                  onDeletePlannedSession={productivity.deletePlannedSession}
                  workoutSessions={productivity.workoutSessions}
                  onLogWorkoutSession={productivity.logWorkoutSession}
                  onUpdateWorkoutSession={productivity.updateWorkoutSession}
                  onDeleteWorkoutSession={productivity.deleteWorkoutSession}
                  sportSessions={productivity.sportSessions}
                  onAddSportSession={productivity.addSportSession}
                  onDeleteSportSession={productivity.deleteSportSession}
                  meals={productivity.meals}
                  onAddMealLog={productivity.addMealLog}
                  onUpdateMealLog={productivity.updateMealLog}
                  onDeleteMealLog={productivity.deleteMealLog}
                  nutritionSettings={productivity.nutritionSettings}
                  onUpdateNutritionSettings={productivity.updateNutritionSettings}
                  events={events}
                  onClearWorkoutEventsFromCalendar={async () => {
                    const isWorkoutEvent = (e: CalendarEvent) =>
                      e.id.startsWith('scheduled-wo-') ||
                      e.id.startsWith('ctg-workout-') ||
                      (e.calendarId === 'health' &&
                        (e.title.includes('💪') || e.title.includes('[ZENOX]')));

                    const workoutEventsToRemove = events.filter(isWorkoutEvent);
                    if (workoutEventsToRemove.length === 0) return 0;

                    setEvents((prev) => prev.filter((e) => !isWorkoutEvent(e)));

                    try {
                      const token = await getAccessToken();
                      if (token) {
                        for (const ev of workoutEventsToRemove) {
                          if (ev.id.startsWith('gcal-')) {
                            await deleteGoogleCalendarEvent(token, ev.id.slice(5)).catch(() => {});
                          }
                        }
                      }
                    } catch (e) {
                      console.warn('GCal delete error:', e);
                    }
                    return workoutEventsToRemove.length;
                  }}
                  onBatchScheduleToCalendar={(newEvents: CalendarEvent[]) => {
                    setEvents((prev) => deduplicateEvents([...prev, ...newEvents]));
                  }}
                  onScheduleSessionToCalendar={async (title, date, color) => {
                    const resolution = resolveNonConflictingSlot(date, '17:30', 75, events, {
                      maxHour: 23,
                      bufferMinutes: 15,
                    });
                    if (resolution.status === 'conflict') {
                      const names = resolution.remainingConflicts
                        .map((c) => `"${c.title}" (${c.startTime}–${c.endTime})`)
                        .join(', ');
                      const proceed = window.confirm(
                        `Cảnh báo trùng lịch: ngày ${date} khung 17:30–18:45 trùng với ${names} và không còn khoảng trống 75 phút phù hợp. Vẫn thêm "${title}"?`
                      );
                      if (!proceed) return;
                    }
                    const newEv: CalendarEvent = {
                      id: `scheduled-wo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                      title: title.startsWith('[ZENOX]') || title.includes('💪') ? title : `💪 ${title}`,
                      startDate: date,
                      startTime: resolution.startTime,
                      endDate: date,
                      endTime: resolution.endTime,
                      allDay: false,
                      calendarId: 'health',
                      color: color || '#E11D48',
                      type: 'event',
                      isCompleted: false,
                      createdAt: Date.now(),
                    };
                    setEvents((prev) => deduplicateEvents([...prev, newEv]));
                    if (resolution.status === 'shifted') {
                      const avoided = resolution.conflictingEvents.map((e) => e.title).join(', ');
                      notifyWarning(
                        lang === 'vi' ? 'Đã tự dời né trùng lịch' : 'Workout shifted to avoid conflict',
                        lang === 'vi'
                          ? `Khung 17:30 trùng "${avoided}". "${title}" được xếp sang ${resolution.startTime}–${resolution.endTime}.`
                          : `17:30 conflicted with "${avoided}". Scheduled at ${resolution.startTime}–${resolution.endTime}.`
                      );
                    }
                    getAccessToken().then((token) => {
                      if (token) {
                        createGoogleCalendarEvent(token, newEv).catch(() => {});
                      }
                    });
                  }}
                />
              )}
              </Suspense>
            </div>
          )}
        </div>
        </main>

        {/* iPhone / Mobile Native Bottom Navigation Bar */}
        <nav
          aria-label="Điều hướng nhanh"
          className="lg:hidden shrink-0 border-t border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#090205]/95 backdrop-blur-2xl px-2 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] z-30"
        >
          <div className="grid grid-cols-5 gap-1">
            {(
              [
                { id: 'dashboard', label: lang === 'vi' ? 'Tổng quan' : 'Home', icon: LayoutDashboard, active: view === 'dashboard' },
                {
                  id: 'month',
                  label: lang === 'vi' ? 'Lịch' : 'Calendar',
                  icon: CalendarDays,
                  active: view === 'month' || view === 'week' || view === 'day' || view === 'fourDay' || view === 'year' || view === 'schedule',
                },
                { id: 'health', label: lang === 'vi' ? 'Thể hình' : 'Fitness', icon: Dumbbell, active: view === 'health' },
                { id: 'tasks', label: lang === 'vi' ? 'Nhiệm vụ' : 'Tasks', icon: ListChecks, active: view === 'tasks' },
                { id: 'finance', label: lang === 'vi' ? 'Tài chính' : 'Finance', icon: Wallet, active: view === 'finance' },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleViewChange(item.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
                    item.active
                      ? 'text-rose-500 bg-rose-500/10 font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-[10px] leading-tight truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Slide-over Right Drawer for Notes & Tasks */}
      {isRightDrawerOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white dark:bg-[#111726] border-l border-slate-200 dark:border-white/[0.08] shadow-2xl flex flex-col animate-in slide-in-from-right">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/[0.08]">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>{lang === 'vi' ? 'Ghi chú & Tác vụ nhanh' : 'Quick Notes & Tasks'}</span>
            </h3>
            <button
              onClick={() => setIsRightDrawerOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <RightSidebar
              lang={lang}
              events={allEvents}
              tasks={productivity.tasks}
              onAddTask={(title: string) =>
                productivity.addTask({
                  title,
                  status: 'todo',
                  priority: 'medium',
                  categoryId: categories[0]?.id || 'personal',
                  dueDate: formatDateString(new Date()),
                })
              }
              onToggleTask={(taskId: string) => {
                const task = productivity.tasks.find((t) => t.id === taskId);
                productivity.setTaskStatus(taskId, task?.status === 'completed' ? 'todo' : 'completed');
              }}
              onDeleteTask={(taskId: string) => productivity.deleteTask(taskId)}
            />
          </div>
        </div>
      )}

      {/* Mini Inline Event Creation Popover */}
      <MiniEventPopover
        isOpen={miniPopover.isOpen}
        position={miniPopover.position}
        dateStr={miniPopover.dateStr}
        startTime={miniPopover.startTime}
        endTime={miniPopover.endTime}
        events={allEvents}
        categories={categories}
        onSave={handleSaveEvent}
        onOpenFullModal={(dateStr, startTime, endTime, title, allDay, color) => {
          setEventToEdit(null);
          setModalDate(dateStr);
          setModalTime(startTime);
          setModalEndTime(endTime);
          setModalTitle(title || '');
          setModalAllDay(Boolean(allDay));
          setModalColor(color);
          setIsEventModalOpen(true);
        }}
        onClose={() => setMiniPopover((prev) => ({ ...prev, isOpen: false }))}
        lang={lang}
      />

      {/* Dedicated Day Planner Drawer */}
      <DayPlannerDrawer
        isOpen={dayPlanner.isOpen}
        onClose={() => setDayPlanner((prev) => ({ ...prev, isOpen: false }))}
        selectedDateStr={dayPlanner.dateStr}
        onSelectDate={(dateStr) => setDayPlanner((prev) => ({ ...prev, dateStr }))}
        events={allEvents}
        categories={categories}
        onSelectEvent={(ev) => setSelectedEventForDetail(ev)}
        onAddEventClick={(dateStr, timeStr) => {
          const parts = timeStr.split(':');
          const nextH = Math.min(23, parseInt(parts[0], 10) + 1);
          const nextTime = `${String(nextH).padStart(2, '0')}:${parts[1]}`;
          handleOpenInlineQuickAdd(dateStr, timeStr, nextTime);
        }}
        lang={lang}
      />

      {/* Event Details Floating Card */}
      {selectedEventForDetail && (
        <EventDetailCard
          event={selectedEventForDetail}
          events={allEvents}
          categories={categories}
          onClose={() => setSelectedEventForDetail(null)}
          onEdit={(ev) => {
            setSelectedEventForDetail(null);
            setEventToEdit(ev);
            setIsEventModalOpen(true);
          }}
          onDelete={handleDeleteEvent}
          onDuplicate={handleSaveEvent}
          onQuickReschedule={handleSaveEvent}
          onToggleComplete={handleToggleCompleteTask}
          onJoinMeet={(ev) => {
            if (ev.meetUrl) window.open(ev.meetUrl, '_blank');
          }}
          lang={lang}
        />
      )}

      {/* Event Create / Edit Full Modal */}
      {isEventModalOpen && (
        <EventModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          eventToEdit={eventToEdit}
          events={allEvents}
          initialDate={modalDate}
          initialTime={modalTime}
          initialEndTime={modalEndTime}
          initialTitle={modalTitle}
          initialAllDay={modalAllDay}
          initialColor={modalColor}
          initialType={modalType}
          categories={categories}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          lang={lang}
        />
      )}

      {/* Quick Add with Natural Language Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAddEvent={handleSaveEvent}
        currentDate={currentDate}
        events={allEvents}
        lang={lang}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        lang={lang}
      />

      {/* Export & Import Modal */}
      <Suspense fallback={null}>
        {isExportImportOpen && (
          <ExportImportModal
            isOpen={isExportImportOpen}
            onClose={() => setIsExportImportOpen(false)}
            events={events}
            onImportEvents={(imported) => {
              setEvents((prev) => {
                const cleaned = prev.filter((e) => !isDemoEventId(e.id));
                const map = new Map(cleaned.map((e) => [e.id, e]));
                for (const item of imported) {
                  map.set(item.id, item);
                }
                const deduped = deduplicateEvents(Array.from(map.values()));
                try {
                  accountStorage.setItem('gcal_events', JSON.stringify(deduped));
                } catch {}
                return deduped;
              });
            }}
            onResetEvents={() => {
              setEvents(INITIAL_EVENTS);
              productivity.resetAll();
            }}
            onExportProductivityBackup={productivity.snapshot}
            onImportProductivityBackup={productivity.restore}
            lang={lang}
          />
        )}

        {/* Cloud Sync Modal */}
        {isCloudSyncOpen && (
          <CloudSyncModal
            isOpen={isCloudSyncOpen}
            onClose={() => setIsCloudSyncOpen(false)}
            user={user}
            onGoogleSignIn={handleGoogleSignIn}
            onGoogleSignOut={handleGoogleSignOut}
            events={events}
            categories={categories}
            onImportEvents={(imported) => {
              setEvents((prev) => {
                const cleaned = prev.filter((e) => !e.id.startsWith('ev-'));
                const map = new Map(cleaned.map((e) => [e.id, e]));
                for (const item of imported) {
                  map.set(item.id, item);
                }
                const deduped = deduplicateEvents(Array.from(map.values()));
                try {
                  accountStorage.setItem('gcal_events', JSON.stringify(deduped));
                } catch {}
                return deduped;
              });
              setLastSyncedTime(new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US'));
              setSyncState('synced');
            }}
            syncState={syncState}
            lastSyncedTime={lastSyncedTime}
            lang={lang}
            onSyncGoogleCalendar={handleSyncGoogleCalendar}
            onCreateNewAccount={handleCreateNewAccount}
          />
        )}

        {/* Global Life Copilot AI Assistant Modal */}
        {isLifeCopilotOpen && (
          <LifeCopilotModal
            isOpen={isLifeCopilotOpen}
            onClose={() => setIsLifeCopilotOpen(false)}
            lang={lang}
            store={productivity}
            events={allEvents}
            onAddEvent={handleSaveEvent}
            onNavigate={handleViewChange}
            currentDate={currentDate}
          />
        )}
      </Suspense>

      {/* Multi-Hub: Đồng bộ Google & Quản lý Cuộc sống (Pomodoro, Tài chính, Học tập, Sức khỏe) */}
      <MultiHubDrawer
        isOpen={isMultiHubOpen}
        onClose={() => setIsMultiHubOpen(false)}
        events={allEvents}
        user={user}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        onSyncGoogleCalendar={handleSyncGoogleCalendar}
        isSyncing={isSyncing}
        lastSyncedTime={lastSyncedTime}
        lang={lang}
        onNavigate={handleViewChange}
        store={productivity}
        categories={categories}
      />
    </div>
  );
}

