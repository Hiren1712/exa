import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { profileImageUrl, userApi } from '../api/user';
import { extractError } from '../api/client';

export default function Settings() {
  const { user, theme, toggleTheme, logout, updateUser } = useAuth();
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
      toast('Đã cập nhật thông tin', 'Hồ sơ của bạn đã được lưu', 'success');
    } catch (err) {
      toast('Không lưu được thông tin', extractError(err), 'error');
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
      toast('Định dạng ảnh chưa hỗ trợ', 'Chọn ảnh PNG, JPEG, GIF hoặc WebP', 'warn');
      return;
    }
    if (file.size > maxBytes) {
      toast('Ảnh quá lớn', `Ảnh ${type === 'avatar' ? 'đại diện' : 'bìa'} tối đa ${maxBytes / (1024 * 1024)} MB`, 'warn');
      return;
    }

    setSavingImage(type);
    try {
      const updated = await userApi.uploadProfileImage(type, file);
      updateUser(updated);
      toast('Đã lưu ảnh', `${type === 'avatar' ? 'Ảnh đại diện' : 'Ảnh bìa'} đã được đồng bộ với tài khoản`, 'success');
    } catch (err) {
      toast('Không lưu được ảnh', extractError(err), 'error');
    } finally {
      setSavingImage(null);
    }
  };

  const removeImage = async (type: 'avatar' | 'cover') => {
    setSavingImage(type);
    try {
      const updated = await userApi.deleteProfileImage(type);
      updateUser(updated);
      toast('Đã xóa ảnh', `${type === 'avatar' ? 'Ảnh đại diện' : 'Ảnh bìa'} đã được xóa khỏi hồ sơ`, 'success');
    } catch (err) {
      toast('Không xóa được ảnh', extractError(err), 'error');
    } finally {
      setSavingImage(null);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast('Mật khẩu không khớp', 'Vui lòng nhập lại mật khẩu xác nhận', 'warn');
      return;
    }
    if (newPassword.length < 8) {
      toast('Mật khẩu quá ngắn', 'Mật khẩu mới cần ít nhất 8 ký tự', 'warn');
      return;
    }
    setSavingPassword(true);
    try {
      await userApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Đã đổi mật khẩu', 'Mật khẩu mới có hiệu lực ngay', 'success');
    } catch (err) {
      toast('Không đổi được mật khẩu', extractError(err), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Cài đặt</h1>
        <p className="text-sm text-slate-500 mt-0.5">Quản lý hồ sơ, bảo mật và tùy chọn giao diện</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div
          className="relative h-36 sm:h-48 bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 bg-cover bg-center"
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
              {savingImage === 'cover' ? 'Đang lưu...' : 'Đổi ảnh bìa'}
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
                alt={`Ảnh đại diện của ${user.fullName}`}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            )}
            <button
              type="button"
              disabled={savingImage !== null}
              onClick={() => avatarInput.current?.click()}
              aria-label="Đổi ảnh đại diện"
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
              Xóa ảnh đại diện
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

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="font-bold text-slate-900 dark:text-white">Tài khoản EXA</h2>
          <p className="mt-1 text-xs text-slate-500">Thông tin được lưu và đồng bộ trên tài khoản của bạn</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-semibold">
              {user?.role === 'TEACHER' ? 'Giáo viên' : user?.role === 'STUDENT' ? 'Học sinh' : 'Quản trị viên'}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              user?.plan === 'PRO' ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {user?.plan === 'PRO' ? 'Pro' : user?.plan || 'Free'}
            </span>
          </div>
        </section>

        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={saveProfile} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Icon name="user" size={18} className="text-blue-500" /> Thông tin cá nhân
            </h2>
            <Input label="Họ và tên" required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Số điện thoại" type="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} />
              <Input label="Ngày sinh" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
            </div>
            <Input label="Email" value={user?.email || ''} disabled helper="Email không thể thay đổi" />
            <Button type="submit" variant="primary" loading={savingProfile} icon={<Icon name="save" size={16} />}>Lưu thay đổi</Button>
          </form>

          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-4">
              <Icon name="settings" size={18} className="text-blue-500" /> Giao diện
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-700 dark:text-slate-300">Chế độ tối</div>
                <div className="text-xs text-slate-500 mt-0.5">Tùy chọn được lưu trên thiết bị này</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={theme === 'dark'}
                aria-label="Bật chế độ tối"
                onClick={toggleTheme}
                className={`relative w-12 h-7 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </section>

          <form onSubmit={changePassword} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Icon name="lock" size={18} className="text-blue-500" /> Đổi mật khẩu
            </h2>
            <Input label="Mật khẩu hiện tại" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Mật khẩu mới" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              <Input label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
            <Button type="submit" variant="ghost" loading={savingPassword}>Cập nhật mật khẩu</Button>
          </form>

          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Phiên đăng nhập</h2>
              <p className="text-xs text-slate-500 mt-1">Đăng xuất khỏi tài khoản EXA trên thiết bị này</p>
            </div>
            <Button variant="danger" onClick={logout} icon={<Icon name="logout" size={16} />}>Đăng xuất</Button>
          </section>
        </div>
      </div>
    </div>
  );
}
