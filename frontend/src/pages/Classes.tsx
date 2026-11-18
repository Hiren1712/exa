import { PageHeading } from '../components/PageHeading';
import { FormEvent, MouseEvent, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Input, Select, Textarea } from '../components/Input';
import { SubjectInput } from '../components/SubjectInput';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { classroomApi, Classroom, ClassroomRequest } from '../api/classroom';
import { extractError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../i18n';

const emptyForm: ClassroomRequest = { name: '', subject: 'Toán', grade: 12, description: '' };

export default function Classes() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState<ClassroomRequest>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClasses(isTeacher ? await classroomApi.list() : await classroomApi.listMine());
    } catch (err) {
      toast(t('Không tải được lớp học'), extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [isTeacher, t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) setJoinCode(code.toUpperCase());
  }, [searchParams]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (event: MouseEvent, classroom: Classroom) => {
    event.preventDefault();
    event.stopPropagation();
    setEditing(classroom);
    setForm({
      name: classroom.name,
      subject: classroom.subject || 'Toán',
      grade: classroom.grade || 12,
      description: classroom.description || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.subject?.trim()) {
      toast(t('Thiếu môn học'), t('Vui lòng nhập môn học cho lớp'), 'warn');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await classroomApi.update(editing.id, { ...form, subject: form.subject?.trim() });
        toast(t('Đã cập nhật lớp'), form.name, 'success');
      } else {
        await classroomApi.create({ ...form, subject: form.subject?.trim() });
        toast(t('Đã tạo lớp'), form.name, 'success');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast(t('Không lưu được lớp'), extractError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: MouseEvent, classroom: Classroom) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(t('Bạn có chắc muốn lưu trữ lớp "{{name}}"?', { name: classroom.name }))) return;
    try {
      await classroomApi.delete(classroom.id);
      setClasses((current) => current.filter((item) => item.id !== classroom.id));
      toast(t('Đã lưu trữ lớp'), classroom.name, 'success');
    } catch (err) {
      toast(t('Không xóa được lớp'), extractError(err), 'error');
    }
  };

  const handleCopy = async (event: MouseEvent, code: string) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      toast(t('Đã sao chép mã lớp'), code, 'success');
    } catch (err) {
      toast(t('Không sao chép được mã lớp'), extractError(err), 'error');
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const joinedClass = await classroomApi.join(joinCode);
      toast(t('Đã tham gia lớp'), joinedClass.name, 'success');
      setJoinCode('');
      await load();
    } catch (err) {
      toast(t('Không tham gia được lớp'), extractError(err), 'error');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        icon="exaClassroom"
        title={t(isTeacher ? 'Lớp học của tôi' : 'Lớp học')}
        description={t(isTeacher ? 'Quản lý lớp và học sinh' : 'Các lớp bạn đã tham gia')}
      >
        {isTeacher ? (
          <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={openCreate}>
            {t('Tạo lớp mới')}
          </Button>
        ) : (
          <form className="flex gap-2" onSubmit={handleJoin}>
            <Input
              aria-label={t('Mã lớp')}
              placeholder={t('Nhập mã lớp EXA-...')}
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              className="min-w-0"
            />
            <Button variant="primary" loading={joining} type="submit">{t('Tham gia')}</Button>
          </form>
        )}
      </PageHeading>

      {loading ? (
        <div className="p-10 text-center">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mx-auto mb-3 text-blue-500">
            <Icon name="building" size={28} />
          </div>
          <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t(isTeacher ? 'Chưa có lớp nào' : 'Bạn chưa tham gia lớp nào')}
          </h4>
          <p className="text-sm text-slate-400 mb-4">
            {t(isTeacher ? 'Tạo lớp đầu tiên để bắt đầu giao bài' : 'Nhập mã lớp do giáo viên cung cấp để tham gia')}
          </p>
          {isTeacher && (
            <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={openCreate}>
              {t('Tạo lớp mới')}
            </Button>
          )}
        </div>
      ) : (
        <div className="workspace-card-grid">
          {classes.map((classroom) => (
            <article key={classroom.id} className="class-card" data-color={classroom.id % 4}>
              <Link to={`/classes/${classroom.id}`} className="class-cover">
                <Icon name="exaClassroom" size={26} />
                <span>{classroom.subject || t('Chưa phân môn')}</span>
                <h2>{classroom.name}</h2>
              </Link>
              <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                {classroom.grade && <span>{t('Khối {{grade}}', { grade: classroom.grade })}</span>}
                {classroom.grade && <span>·</span>}
                <span>{t('{{count}} học sinh', { count: classroom.memberCount ?? 0 })}</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-4">
                <Icon name="lock" size={14} className="text-slate-400" />
                <code className="text-xs font-mono font-bold text-blue-600 flex-1">{classroom.code}</code>
                <button
                  type="button"
                  aria-label={t('Sao chép mã lớp')}
                  onClick={(event) => void handleCopy(event, classroom.code)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-blue-500 transition-colors"
                >
                  <Icon name="copy" size={12} />
                </button>
              </div>
              {isTeacher && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    icon={<Icon name="edit" size={14} />}
                    onClick={(event) => openEdit(event, classroom)}
                  >
                    Sửa
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    icon={<Icon name="trash" size={14} />}
                    onClick={(event) => void handleDelete(event, classroom)}
                  >
                    Lưu trữ
                  </Button>
                </div>
              )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t(editing ? 'Chỉnh sửa lớp học' : 'Tạo lớp học mới')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('Hủy')}</Button>
            <Button variant="primary" loading={saving}             type="submit"
            form="class-form">
              {t(editing ? 'Lưu thay đổi' : 'Tạo lớp')}
            </Button>
          </>
        }
      >
        <form id="class-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="Tên lớp"
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ví dụ: 12A1"
          />
          <div className="grid grid-cols-2 gap-4">
            <SubjectInput
              value={form.subject || ''}
              onChange={(subject) => setForm({ ...form, subject })}
              required
            />
            <Select
              label="Khối"
              value={form.grade}
              onChange={(event) => setForm({ ...form, grade: Number(event.target.value) })}
              options={[6, 7, 8, 9, 10, 11, 12].map((grade) => ({
                value: grade,
                label: `Khối ${grade}`,
              }))}
            />
          </div>
          <Textarea
            label="Mô tả (tùy chọn)"
            maxLength={2000}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Thông tin giới thiệu lớp"
          />
        </form>
      </Modal>
    </div>
  );
}
