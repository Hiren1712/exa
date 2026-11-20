import { PageHeading } from '../components/PageHeading';
import { ChangeEvent, FormEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { profileImageUrl, userApi } from '../api/user';
import { authApi } from '../api/auth';
import type { AuthSessionInfo } from '../api/auth';
import { extractError } from '../api/client';
import { useLanguage } from '../i18n';
import { COLOR_THEMES, ColorTheme } from '../lib/themes';

const passwordStrengthScore = (password: string) => [
  password.length >= 8,
  password.length >= 12,
  /[a-z]/.test(password) && /[A-Z]/.test(password),
  /\d/.test(password),
  /[^a-zA-Z0-9]/.test(password),
].filter(Boolean).length;

const formatSessionDate = (date: string) => new Date(date).toLocaleString();

export default function Settings() {
  const { user, themePreference, setThemePreference, colorTheme, setColorTheme, logout, updateUser } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingImage, setSavingImage] = useState<'avatar' | 'cover' | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, next: false, confirm: false });
  const [sessions, setSessions] = useState<AuthSessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionMigrationRequired, setSessionMigrationRequired] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  useEffect(() => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
    setDateOfBirth(user?.dateOfBirth || '');
  }, [user]);

  useEffect(() => {
    let active = true;
    const loadSessions = async () => {
      setSessionsLoading(true);
      try {
        const result = await authApi.sessions();
        if (active) {
          setSessions(result.sessions);
          setSessionMigrationRequired(!result.currentSessionTracked);
        }
      } catch (error) {
        if (active) {
          toast(t('Không tải được phiên đăng nhập'), extractError(error), 'error');
        }
      } finally {
        if (active) setSessionsLoading(false);
      }
    };
    void loadSessions();
    return () => {
      active = false;
    };
  }, [t, toast]);

  const navigateToSection = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const sectionId = event.currentTarget.hash.slice(1);
    const section = document.getElementById(sectionId);
    if (!section) return;

    window.history.replaceState(null, '', `#${sectionId}`);
    section.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await userApi.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
      });
      updateUser(updated);
      toast(t('Đã cập nhật thông tin'), t('Hồ sơ của bạn đã được lưu'), 'success');
    } catch (err) {
      toast(t('Không lưu được thông tin'), extractError(err), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadImage = async (type: 'avatar' | 'cover', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const maxBytes = type === 'avatar' ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      toast(t('Định dạng ảnh chưa hỗ trợ'), t('Chọn ảnh PNG, JPEG, GIF hoặc WebP'), 'warn');
      return;
    }
    if (file.size > maxBytes) {
      toast(t('Ảnh quá lớn'), `${t(type === 'avatar' ? 'Ảnh đại diện' : 'Ảnh bìa')}: ${maxBytes / (1024 * 1024)} MB`, 'warn');
      return;
    }

    setSavingImage(type);
    try {
      const updated = await userApi.uploadProfileImage(type, file);
      updateUser(updated);
      toast(t('Đã lưu ảnh'), t(type === 'avatar' ? 'Ảnh đại diện đã được đồng bộ với tài khoản' : 'Ảnh bìa đã được đồng bộ với tài khoản'), 'success');
    } catch (err) {
      toast(t('Không lưu được ảnh'), extractError(err), 'error');
    } finally {
      setSavingImage(null);
    }
  };

  const removeImage = async (type: 'avatar' | 'cover') => {
    setSavingImage(type);
    try {
      const updated = await userApi.deleteProfileImage(type);
      updateUser(updated);
      toast(t('Đã xóa ảnh'), t(type === 'avatar' ? 'Ảnh đại diện đã được xóa khỏi hồ sơ' : 'Ảnh bìa đã được xóa khỏi hồ sơ'), 'success');
    } catch (err) {
      toast(t('Không xóa được ảnh'), extractError(err), 'error');
    } finally {
      setSavingImage(null);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast(t('Mật khẩu không khớp'), t('Vui lòng nhập lại mật khẩu xác nhận'), 'warn');
      return;
    }
    if (newPassword.length < 8) {
      toast(t('Mật khẩu quá ngắn'), t('Mật khẩu mới cần ít nhất 8 ký tự'), 'warn');
      return;
    }
    setSavingPassword(true);
    try {
      await userApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast(t('Đã đổi mật khẩu'), t('Mật khẩu mới có hiệu lực ngay'), 'success');
    } catch (err) {
      toast(t('Không đổi được mật khẩu'), extractError(err), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const changeThemePreference = (value: string) => {
    if (value === 'light' || value === 'dark' || value === 'system') {
      setThemePreference(value);
    }
  };

  const changeColorTheme = (value: ColorTheme) => setColorTheme(value);

  const togglePasswordVisibility = (field: keyof typeof visiblePasswords) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  const revokeSession = async (session: AuthSessionInfo) => {
    setRevokingSessionId(session.id);
    try {
      await authApi.revokeSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      toast(t('Đã đăng xuất thiết bị'), session.deviceLabel || t('Phiên đăng nhập đã bị thu hồi'), 'success');
    } catch (error) {
      toast(t('Không thể đăng xuất khỏi thiết bị'), extractError(error), 'error');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const revokeOtherSessions = async () => {
    if (sessionMigrationRequired) return;
    setRevokingOthers(true);
    try {
      const result = await authApi.revokeOtherSessions();
      setSessions((current) => current.filter((session) => session.current));
      toast(
        t('Đã đăng xuất khỏi các thiết bị khác'),
        t('Đã thu hồi {{count}} phiên khác', { count: result.revokedCount }),
        'success',
      );
    } catch (error) {
      toast(t('Không thể đăng xuất khỏi thiết bị'), extractError(error), 'error');
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeading
        icon="exaSettings"
        title={t('Cài đặt')}
        description={t('Quản lý hồ sơ, bảo mật và tùy chọn giao diện')}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          className="profile-cover relative h-32 sm:h-40 bg-cover bg-center"
          style={user?.coverImageUrl ? { backgroundImage: `url("${profileImageUrl(user.coverImageUrl)}")` } : undefined}
        >
          {user?.coverImageUrl && <div className="absolute inset-0 bg-slate-950/10" />}
          <div className="absolute right-4 top-4 flex gap-2">
            <button
              type="button"
              disabled={savingImage !== null}
              onClick={() => coverInput.current?.click()}
              className="flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-semibold text-slate-700 shadow transition hover:bg-white disabled:opacity-60"
            >
              <Icon name="camera" size={16} />
              {savingImage === 'cover' ? t('Đang lưu...') : t('Đổi ảnh bìa')}
            </button>
            {user?.coverImageUrl && (
              <button
                type="button"
                disabled={savingImage !== null}
                aria-label="Xóa ảnh bìa"
                onClick={() => void removeImage('cover')}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-slate-600 shadow transition hover:text-red-500 disabled:opacity-60"
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-5 pb-5">
          <div className="relative -mt-11 h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-bold text-white shadow-lg dark:border-slate-900">
            <div className="flex h-full w-full items-center justify-center">
              {user?.fullName?.trim().charAt(0).toUpperCase() || <Icon name="user" size={32} />}
            </div>
            {user?.avatarUrl && (
              <img
                src={profileImageUrl(user.avatarUrl)}
                alt={t('Ảnh đại diện của {{name}}', { name: user.fullName })}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            )}
            <button
              type="button"
              disabled={savingImage !== null}
              onClick={() => avatarInput.current?.click()}
              aria-label={t('Đổi ảnh đại diện')}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow dark:border-slate-900"
            >
              <Icon name="camera" size={14} />
            </button>
          </div>
          <div className="min-w-0 flex-1 pt-2">
            <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">{user?.fullName}</h2>
            <p className="truncate text-sm text-slate-500">{user?.email}</p>
          </div>
          {user?.avatarUrl && (
            <button
              type="button"
              disabled={savingImage !== null}
              onClick={() => void removeImage('avatar')}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 disabled:opacity-60"
            >
              {t('Xóa ảnh đại diện')}
            </button>
          )}
        </div>
        <input
          ref={avatarInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(event) => void uploadImage('avatar', event)}
        />
        <input
          ref={coverInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(event) => void uploadImage('cover', event)}
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400" />
            <div className="p-5">
              <h2 className="font-bold text-slate-900 dark:text-white">{t('Tài khoản EXA')}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('Thông tin được lưu và đồng bộ trên tài khoản của bạn')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                  {t(user?.role === 'TEACHER' ? 'Giáo viên' : user?.role === 'STUDENT' ? 'Học sinh' : 'Quản trị viên')}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  user?.plan === 'PRO'
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {user?.plan === 'PRO' ? t('Pro') : user?.plan || t('Free')}
                </span>
              </div>
            </div>
          </section>

          <nav
            aria-label={t('Điều hướng cài đặt')}
            className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <a href="#personal-info" onClick={navigateToSection} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">
              <Icon name="user" size={17} className="text-slate-400 group-hover:text-current" />
              {t('Thông tin cá nhân')}
            </a>
            <a href="#appearance" onClick={navigateToSection} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">
              <Icon name="settings" size={17} className="text-slate-400 group-hover:text-current" />
              {t('Giao diện')}
            </a>
            <a href="#security" onClick={navigateToSection} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">
              <Icon name="lock" size={17} className="text-slate-400 group-hover:text-current" />
              {t('Đổi mật khẩu')}
            </a>
            <a href="#session" onClick={navigateToSection} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">
              <Icon name="history" size={17} className="text-slate-400 group-hover:text-current" />
              {t('Phiên đăng nhập')}
            </a>
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          <form id="personal-info" onSubmit={saveProfile} className="scroll-mt-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Icon name="user" size={18} className="text-blue-500" /> {t('Thông tin cá nhân')}
            </h2>
            <Input label={t('Họ và tên')} required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label={t('Số điện thoại')} type="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} />
              <Input label={t('Ngày sinh')} type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
            </div>
            <Input label={t('Email')} value={user?.email || ''} disabled helper={t('Email không thể thay đổi')} />
            <Button type="submit" variant="primary" loading={savingProfile} icon={<Icon name="save" size={16} />}>Lưu thay đổi</Button>
          </form>

          <section id="appearance" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Icon name="settings" size={18} className="text-blue-500" /> {t('Giao diện')}
            </h2>
            <div className="mb-6">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('Bảng màu')}</div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t('Chọn màu sắc phù hợp; màu nhấn sẽ được áp dụng khắp EXA')}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={colorTheme === theme.id}
                    onClick={() => changeColorTheme(theme.id)}
                    className="exa-theme-option flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5"
                  >
                    <span
                      aria-hidden="true"
                      className="h-11 w-11 shrink-0 rounded-xl shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${theme.swatches[0]}, ${theme.swatches[1]} 58%, ${theme.swatches[2]})` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{t(theme.label)}</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t(theme.description)}</span>
                    </span>
                    {colorTheme === theme.id && (
                      <Icon name="check" size={18} className="shrink-0 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('Chế độ màu')}</div>
                <div className="mt-0.5 text-xs text-slate-500">{t('Tùy chọn được lưu trên thiết bị này')}</div>
              </div>
              <select
                aria-label={t('Chế độ màu')}
                value={themePreference}
                onChange={(event) => changeThemePreference(event.target.value)}
                className="exa-field w-full px-3.5 py-2.5 text-sm sm:w-56"
              >
                <option value="light">{t('Sáng')}</option>
                <option value="dark">{t('Tối')}</option>
                <option value="system">{t('Theo hệ thống')}</option>
              </select>
            </div>
            {themePreference === 'system' && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {t('Giao diện sẽ tự đổi theo cài đặt của thiết bị')}
              </p>
            )}
          </section>

          <form id="security" onSubmit={changePassword} className="scroll-mt-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Icon name="lock" size={18} className="text-blue-500" /> {t('Đổi mật khẩu')}
            </h2>
            <Input
              label={t('Mật khẩu hiện tại')}
              type={visiblePasswords.current ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              rightElement={(
                <button
                  type="button"
                  aria-label={t(visiblePasswords.current ? 'Ẩn mật khẩu' : 'Hiện mật khẩu')}
                  onClick={() => togglePasswordVisibility('current')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Icon name={visiblePasswords.current ? 'eyeOff' : 'eye'} size={17} />
                </button>
              )}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label={t('Mật khẩu mới')}
                type={visiblePasswords.next ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                helper={t('Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt để tăng độ mạnh')}
                rightElement={(
                  <button
                    type="button"
                    aria-label={t(visiblePasswords.next ? 'Ẩn mật khẩu' : 'Hiện mật khẩu')}
                    onClick={() => togglePasswordVisibility('next')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Icon name={visiblePasswords.next ? 'eyeOff' : 'eye'} size={17} />
                  </button>
                )}
              />
              <Input
                label={t('Nhập lại mật khẩu mới')}
                type={visiblePasswords.confirm ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                rightElement={(
                  <button
                    type="button"
                    aria-label={t(visiblePasswords.confirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu')}
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Icon name={visiblePasswords.confirm ? 'eyeOff' : 'eye'} size={17} />
                  </button>
                )}
              />
            </div>
            {newPassword && (() => {
              const strength = passwordStrengthScore(newPassword);
              const strengthLabel = strength >= 4 ? 'Mạnh' : strength >= 2 ? 'Trung bình' : 'Yếu';
              const strengthColor = strength >= 4 ? 'bg-emerald-500' : strength >= 2 ? 'bg-amber-500' : 'bg-rose-500';
              return (
                <div aria-live="polite" className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{t('Độ mạnh mật khẩu')}</span>
                    <span className={strength >= 4 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : strength >= 2 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-semibold text-rose-600 dark:text-rose-400'}>
                      {t(strengthLabel)}
                    </span>
                  </div>
                  <div role="progressbar" aria-label={t('Độ mạnh mật khẩu')} aria-valuemin={0} aria-valuemax={5} aria-valuenow={strength} className="grid grid-cols-5 gap-1">
                    {Array.from({ length: 5 }, (_, index) => (
                      <span key={index} className={`h-1.5 rounded-full ${index < strength ? strengthColor : 'bg-slate-200 dark:bg-slate-700'}`} />
                    ))}
                  </div>
                </div>
              );
            })()}
            {confirmPassword && (
              <p aria-live="polite" className={`text-xs ${newPassword === confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {t(newPassword === confirmPassword ? 'Mật khẩu xác nhận khớp' : 'Mật khẩu xác nhận chưa khớp')}
              </p>
            )}
            <Button type="submit" variant="ghost" loading={savingPassword}>Cập nhật mật khẩu</Button>
          </form>

          <section id="session" className="scroll-mt-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">{t('Phiên đăng nhập')}</h2>
                <p className="mt-1 text-xs text-slate-500">{t('Xem và đăng xuất khỏi các thiết bị đang dùng tài khoản của bạn')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!sessionMigrationRequired && sessions.some((session) => !session.current) && (
                  <Button variant="ghost" loading={revokingOthers} onClick={() => void revokeOtherSessions()}>
                    {t('Đăng xuất khỏi thiết bị khác')}
                  </Button>
                )}
                <Button variant="danger" onClick={logout} icon={<Icon name="logout" size={16} />}>
                  {t('Đăng xuất thiết bị này')}
                </Button>
              </div>
            </div>
            {sessionsLoading ? (
              <p role="status" className="text-sm text-slate-500">{t('Đang tải phiên đăng nhập...')}</p>
            ) : sessionMigrationRequired ? (
              <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                {t('Hãy đăng xuất rồi đăng nhập lại để bắt đầu quản lý phiên trên thiết bị này')}
              </p>
            ) : sessions.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                {t('Không có phiên đăng nhập nào')}
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                        <Icon name="history" size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          <span>{session.deviceLabel || t('Thiết bị không xác định')}</span>
                          {session.current && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{t('Thiết bị này')}</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t('Đăng nhập hoặc làm mới gần nhất')}: {formatSessionDate(session.lastSeenAt)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {t('Đăng nhập lúc')}: {formatSessionDate(session.createdAt)}
                        </p>
                      </div>
                    </div>
                    {!session.current && (
                      <Button
                        variant="ghost"
                        disabled={revokingSessionId !== null}
                        loading={revokingSessionId === session.id}
                        onClick={() => void revokeSession(session)}
                      >
                        {t('Đăng xuất thiết bị')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
