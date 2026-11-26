import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Calendar,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  loginZenoxAccount,
  registerZenoxAccount,
  loginWithGoogleAccount,
  syncGoogleCalendarData,
  getAccountSyncConsent,
  setAccountSyncConsent,
  ZenoxUser,
} from '../../services/zenoxAuth';
import { accountStorage } from '../../services/accountStorage';
import { notifySuccess } from '../../utils/notify';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: ZenoxUser, syncGoogleCalendar?: boolean) => void;
  lang?: 'vi' | 'en';
  initialMode?: 'login' | 'register';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  lang = 'vi',
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Isolated loading & consent states
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false);
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<ZenoxUser | null>(null);
  const [isAskingSyncConsent, setIsAskingSyncConsent] = useState(false);

  // Keep mode aligned with prop and clear transient auth state on open/close
  useEffect(() => {
    setMode(initialMode);
    setErrorMessage(null);
    setIsSubmittingForm(false);
    setIsSubmittingGoogle(false);
    setIsSubmittingConsent(false);
    setPendingUser(null);
    setIsAskingSyncConsent(false);
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const isAnySubmitting = isSubmittingForm || isSubmittingGoogle || isSubmittingConsent;

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', barClass: '', textClass: '' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) {
      return {
        score: 1,
        label: lang === 'vi' ? 'Yếu' : 'Weak',
        barClass: 'bg-rose-500',
        textClass: 'text-rose-400',
      };
    }
    if (score <= 3) {
      return {
        score: 2,
        label: lang === 'vi' ? 'Khá' : 'Moderate',
        barClass: 'bg-amber-500',
        textClass: 'text-amber-400',
      };
    }
    return {
      score: 3,
      label: lang === 'vi' ? 'Mạnh' : 'Strong',
      barClass: 'bg-emerald-500',
      textClass: 'text-emerald-400',
    };
  };

  const strength = getPasswordStrength(regPassword);

  const proceedWithAuthenticatedUser = async (user: ZenoxUser) => {
    const existingConsent = getAccountSyncConsent(user.uid, user.email);
    if (existingConsent) {
      const isAgreed = existingConsent === 'agreed';
      if (isAgreed && typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('gcal_real_access_token');
        if (token) {
          await syncGoogleCalendarData(token, user.uid);
        }
      }
      onLoginSuccess(user, isAgreed);
      return;
    }

    setPendingUser(user);
    setIsAskingSyncConsent(true);
  };

  const handleConsentChoice = async (agree: boolean) => {
    if (!pendingUser || isSubmittingConsent) return;
    setIsSubmittingConsent(true);
    setErrorMessage(null);

    try {
      setAccountSyncConsent(pendingUser.uid, pendingUser.email, agree ? 'agreed' : 'declined');

      if (agree) {
        const token =
          typeof localStorage !== 'undefined' ? localStorage.getItem('gcal_real_access_token') : null;
        if (token) {
          await syncGoogleCalendarData(token, pendingUser.uid);
        }
        onLoginSuccess(pendingUser, true);
      } else {
        accountStorage.setItem('gcal_events', JSON.stringify([]), pendingUser.uid);
        onLoginSuccess(pendingUser, false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || (lang === 'vi' ? 'Không thể hoàn tất thiết lập.' : 'Setup failed.'));
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  const handleGoogleSignInClick = async () => {
    if (isAnySubmitting) return;
    setErrorMessage(null);
    setIsSubmittingGoogle(true);

    try {
      const res = await loginWithGoogleAccount();
      if (res.success && res.user) {
        await proceedWithAuthenticatedUser(res.user);
      } else {
        setErrorMessage(res.error || (lang === 'vi' ? 'Đăng nhập Google thất bại.' : 'Google login failed.'));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || (lang === 'vi' ? 'Lỗi kết nối xác thực Google.' : 'Google authentication error.'));
    } finally {
      setIsSubmittingGoogle(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnySubmitting) return;
    setErrorMessage(null);
    setIsSubmittingForm(true);

    try {
      const res = await loginZenoxAccount(loginEmail, loginPassword, rememberMe);
      if (res.success && res.user) {
        await proceedWithAuthenticatedUser(res.user);
      } else {
        setErrorMessage(res.error || (lang === 'vi' ? 'Đăng nhập thất bại.' : 'Login failed.'));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || (lang === 'vi' ? 'Lỗi hệ thống xác thực.' : 'Authentication error.'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnySubmitting) return;
    setErrorMessage(null);

    if (regPassword !== regConfirmPassword) {
      setErrorMessage(lang === 'vi' ? 'Mật khẩu xác nhận không khớp.' : 'Passwords do not match.');
      return;
    }

    setIsSubmittingForm(true);

    try {
      const res = await registerZenoxAccount(regName, regEmail, regPassword);
      if (res.success && res.user) {
        await proceedWithAuthenticatedUser(res.user);
      } else {
        setErrorMessage(res.error || (lang === 'vi' ? 'Đăng ký thất bại.' : 'Registration failed.'));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || (lang === 'vi' ? 'Lỗi hệ thống đăng ký.' : 'Registration error.'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 shadow-2xl flex flex-col text-zinc-100 max-h-[92vh] overflow-y-auto">
        {!isAskingSyncConsent && (
          <button
            type="button"
            onClick={onClose}
            disabled={isAnySubmitting}
            className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
            title={lang === 'vi' ? 'Đóng' : 'Close'}
            aria-label={lang === 'vi' ? 'Đóng' : 'Close'}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}

        {isAskingSyncConsent && pendingUser ? (
          <div className="w-full py-2 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-amber-400" strokeWidth={1.5} />
            </div>

            <span className="text-xs font-mono text-zinc-400 mb-1">
              {lang === 'vi' ? 'Thiết lập đồng bộ lịch' : 'Calendar sync preference'}
            </span>

            <h3 className="text-lg font-semibold text-zinc-100 mb-2">
              {lang === 'vi' ? 'Đồng bộ dữ liệu Google Calendar' : 'Sync Google Calendar data'}
            </h3>

            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mb-6">
              {lang === 'vi' ? (
                <>
                  Tài khoản <strong className="text-zinc-100 font-medium">{pendingUser.displayName}</strong> đã sẵn sàng. Bạn có muốn nhập các sự kiện từ Google Calendar vào không gian làm việc này không?
                </>
              ) : (
                <>
                  Account <strong className="text-zinc-100 font-medium">{pendingUser.displayName}</strong> is ready. Would you like to import events from Google Calendar into this workspace?
                </>
              )}
            </p>

            {errorMessage && (
              <div className="w-full mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" strokeWidth={1.5} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="w-full space-y-2.5">
              <button
                type="button"
                disabled={isSubmittingConsent}
                onClick={() => handleConsentChoice(true)}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSubmittingConsent ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
                )}
                <span>
                  {isSubmittingConsent
                    ? lang === 'vi'
                      ? 'Đang đồng bộ...'
                      : 'Syncing...'
                    : lang === 'vi'
                      ? 'Đồng ý đồng bộ dữ liệu lịch'
                      : 'Sync Google Calendar events'}
                </span>
              </button>

              <button
                type="button"
                disabled={isSubmittingConsent}
                onClick={() => handleConsentChoice(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                <XCircle className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                <span>
                  {lang === 'vi' ? 'Không đồng ý (Bắt đầu với lịch trống)' : 'Skip sync (Start with blank calendar)'}
                </span>
              </button>
            </div>

            <p className="mt-4 text-[11px] text-zinc-500">
              {lang === 'vi'
                ? 'Bạn có thể thay đổi hoặc đồng bộ lại bất kỳ lúc nào trong phần cài đặt.'
                : 'You can change or re-sync anytime in settings.'}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-5 w-full">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] font-mono mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
                <span>ZENOX Vault</span>
              </div>

              <div className="my-1 flex justify-center items-center">
                <img
                  src="/zenox-logo.png"
                  alt="ZENOX"
                  className="h-8 w-auto object-contain"
                />
              </div>

              <p className="text-xs text-zinc-400 mt-1.5">
                {mode === 'login'
                  ? lang === 'vi'
                    ? 'Đăng nhập để vào không gian cá nhân của bạn'
                    : 'Sign in to access your personal workspace'
                  : lang === 'vi'
                    ? 'Tạo tài khoản cá nhân mới trên ZENOX'
                    : 'Create your personal ZENOX account'}
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="w-full mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" strokeWidth={1.5} />
                  <span className="leading-relaxed flex-1">{errorMessage}</span>
                </div>
                {errorMessage.includes('Authorized Domains') && (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(window.location.hostname);
                          notifySuccess(
                            lang === 'vi' ? 'Đã sao chép tên miền' : 'Domain copied',
                            window.location.hostname
                          );
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono text-zinc-200 transition-colors cursor-pointer border border-zinc-700"
                    >
                      {lang === 'vi' ? 'Sao chép tên miền' : 'Copy domain'} ({typeof window !== 'undefined' ? window.location.hostname : ''})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setErrorMessage(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-[11px] text-zinc-950 font-semibold transition-colors cursor-pointer"
                    >
                      {lang === 'vi' ? 'Tạo tài khoản Web' : 'Create Web account'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="w-full space-y-4">
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={isAnySubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-100 text-xs font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmittingGoogle ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" strokeWidth={1.5} />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>
                  {isSubmittingGoogle
                    ? lang === 'vi'
                      ? 'Đang xác thực Google...'
                      : 'Authenticating Google...'
                    : lang === 'vi'
                      ? 'Đăng nhập bằng tài khoản Google'
                      : 'Sign in with Google'}
                </span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-0.5">
                <div className="h-px bg-zinc-800 flex-1" />
                <span className="text-[11px] text-zinc-500">
                  {lang === 'vi' ? 'Hoặc tài khoản trên trình duyệt' : 'Or local browser account'}
                </span>
                <div className="h-px bg-zinc-800 flex-1" />
              </div>

              {/* Mode Tabs */}
              <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  {lang === 'vi' ? 'Đăng nhập' : 'Sign in'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  {lang === 'vi' ? 'Đăng ký' : 'Register'}
                </button>
              </div>

              {/* Login Form */}
              {mode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="w-full space-y-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder={lang === 'vi' ? 'Email tài khoản' : 'Account email'}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                    />
                  </div>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder={lang === 'vi' ? 'Mật khẩu' : 'Password'}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute inset-y-0 right-3.5 flex items-center text-zinc-500 hover:text-zinc-200 cursor-pointer"
                      title={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                      ) : (
                        <Eye className="w-4 h-4" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-200 text-xs">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded bg-zinc-900 border-zinc-700 accent-amber-500 cursor-pointer w-3.5 h-3.5"
                      />
                      <span>{lang === 'vi' ? 'Ghi nhớ 30 ngày' : 'Remember for 30 days'}</span>
                    </label>
                    <span className="text-[11px] text-zinc-500">
                      {lang === 'vi' ? 'Lưu cục bộ trên máy' : 'Stored locally'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isAnySubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmittingForm ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                    ) : null}
                    <span>
                      {isSubmittingForm
                        ? lang === 'vi'
                          ? 'Đang xác thực...'
                          : 'Authenticating...'
                        : lang === 'vi'
                          ? 'Đăng nhập Workspace'
                          : 'Sign in to Workspace'}
                    </span>
                    {!isSubmittingForm && <ArrowRight className="w-4 h-4" strokeWidth={1.75} />}
                  </button>
                </form>
              )}

              {/* Register Form */}
              {mode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="w-full space-y-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
                      <User className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder={lang === 'vi' ? 'Họ và tên' : 'Full name'}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder={lang === 'vi' ? 'Email tài khoản mới' : 'New account email'}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                    />
                  </div>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder={lang === 'vi' ? 'Mật khẩu (tối thiểu 6 ký tự)' : 'Password (min 6 characters)'}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-3.5 flex items-center text-zinc-500 hover:text-zinc-200 cursor-pointer"
                      title={showRegPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showRegPassword ? (
                        <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                      ) : (
                        <Eye className="w-4 h-4" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>

                  {regPassword && (
                    <div className="space-y-1 px-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">
                          {lang === 'vi' ? 'Độ mạnh mật khẩu' : 'Password strength'}
                        </span>
                        <span className={`font-medium ${strength.textClass}`}>{strength.label}</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden flex gap-0.5">
                        <div className={`h-full flex-1 transition-colors ${strength.score >= 1 ? strength.barClass : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 transition-colors ${strength.score >= 2 ? strength.barClass : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 transition-colors ${strength.score >= 3 ? strength.barClass : 'bg-transparent'}`} />
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-500">
                      <KeyRound className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder={lang === 'vi' ? 'Xác nhận lại mật khẩu' : 'Confirm password'}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    {regConfirmPassword && regConfirmPassword === regPassword && (
                      <span className="absolute inset-y-0 right-3.5 flex items-center text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isAnySubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmittingForm ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                    ) : null}
                    <span>
                      {isSubmittingForm
                        ? lang === 'vi'
                          ? 'Đang khởi tạo...'
                          : 'Creating...'
                        : lang === 'vi'
                          ? 'Khởi tạo tài khoản'
                          : 'Create account'}
                    </span>
                    {!isSubmittingForm && <ArrowRight className="w-4 h-4" strokeWidth={1.75} />}
                  </button>
                </form>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-zinc-800/80 w-full flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>ZENOX Development</span>
              <span>SHA-256 Local Vault</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
