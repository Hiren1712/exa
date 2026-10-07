import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { userApi } from '../api/user';
import { extractError } from '../api/client';

export default function Settings() {
  const { user, theme, toggleTheme, logout, updateUser } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center">
          <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-xl">
            {user?.fullName?.trim().charAt(0).toUpperCase() || <Icon name="user" size={32} />}
          </div>
          <h2 className="font-bold text-slate-900 dark:text-white">{user?.fullName}</h2>
          <p className="text-xs text-slate-500 mt-1">{user?.email}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
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
