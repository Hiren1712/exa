import { PageHeading } from '../components/PageHeading';
import { ChangeEvent, FormEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { profileImageUrl, userApi } from '../api/user';
import { extractError } from '../api/client';
import { useLanguage } from '../i18n';

export default function Settings() {
  const { user, theme, toggleTheme, logout, updateUser } = useAuth();
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

  useEffect(() => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
    setDateOfBirth(user?.dateOfBirth || '');
  }, [user]);

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
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-4">
              <Icon name="settings" size={18} className="text-blue-500" /> {t('Giao diện')}
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-700 dark:text-slate-300">{t('Chế độ tối')}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t('Tùy chọn được lưu trên thiết bị này')}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={theme === 'dark'}
                aria-label={t('Bật chế độ tối')}
                onClick={toggleTheme}
                className={`relative w-12 h-7 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </section>

          <form id="security" onSubmit={changePassword} className="scroll-mt-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Icon name="lock" size={18} className="text-blue-500" /> {t('Đổi mật khẩu')}
            </h2>
            <Input label={t('Mật khẩu hiện tại')} type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label={t('Mật khẩu mới')} type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              <Input label={t('Nhập lại mật khẩu mới')} type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
            <Button type="submit" variant="ghost" loading={savingPassword}>Cập nhật mật khẩu</Button>
          </form>

          <section id="session" className="scroll-mt-24 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">{t('Phiên đăng nhập')}</h2>
              <p className="text-xs text-slate-500 mt-1">{t('Đăng xuất khỏi tài khoản EXA trên thiết bị này')}</p>
            </div>
            <Button variant="danger" onClick={logout} icon={<Icon name="logout" size={16} />}>{t('Đăng xuất')}</Button>
          </section>
        </div>
      </div>
    </div>
  );
}
