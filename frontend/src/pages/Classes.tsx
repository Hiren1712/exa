import { FormEvent, MouseEvent, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Input, Select, Textarea } from '../components/Input';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { classroomApi, Classroom, ClassroomRequest } from '../api/classroom';
import { extractError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { SUBJECTS } from '../lib/utils';

const emptyForm: ClassroomRequest = { name: '', subject: 'Toán', grade: 12, description: '' };

export default function Classes() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
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
      toast('Không tải được lớp học', extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [isTeacher, toast]);

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
    setSaving(true);
    try {
      if (editing) {
        await classroomApi.update(editing.id, form);
        toast('Đã cập nhật lớp', form.name, 'success');
      } else {
        await classroomApi.create(form);
        toast('Đã tạo lớp', form.name, 'success');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast('Không lưu được lớp', extractError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: MouseEvent, classroom: Classroom) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Bạn có chắc muốn lưu trữ lớp "${classroom.name}"?`)) return;
    try {
      await classroomApi.delete(classroom.id);
      setClasses((current) => current.filter((item) => item.id !== classroom.id));
      toast('Đã lưu trữ lớp', classroom.name, 'success');
    } catch (err) {
      toast('Không xóa được lớp', extractError(err), 'error');
    }
  };

  const handleCopy = async (event: MouseEvent, code: string) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      toast('Đã sao chép mã lớp', code, 'success');
    } catch (err) {
      toast('Không sao chép được mã lớp', extractError(err), 'error');
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const joinedClass = await classroomApi.join(joinCode);
      toast('Đã tham gia lớp', joinedClass.name, 'success');
      setJoinCode('');
      await load();
    } catch (err) {
      toast('Không tham gia được lớp', extractError(err), 'error');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {isTeacher ? 'Lớp học của tôi' : 'Lớp học'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isTeacher ? 'Quản lý lớp và học sinh' : 'Các lớp bạn đã tham gia'}
          </p>
        </div>
        {isTeacher ? (
          <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={openCreate}>
            Tạo lớp mới
          </Button>
        ) : (
          <form className="flex gap-2" onSubmit={handleJoin}>
            <Input
              aria-label="Mã lớp"
              placeholder="Nhập mã lớp EXA-..."
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              className="min-w-48"
            />
            <Button variant="primary" loading={joining} type="submit">Tham gia</Button>
          </form>
        )}
      </div>

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
            {isTeacher ? 'Chưa có lớp nào' : 'Bạn chưa tham gia lớp nào'}
          </h4>
          <p className="text-sm text-slate-400 mb-4">
            {isTeacher ? 'Tạo lớp đầu tiên để bắt đầu giao bài' : 'Nhập mã lớp do giáo viên cung cấp để tham gia'}
          </p>
          {isTeacher && (
            <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={openCreate}>
              Tạo lớp mới
            </Button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((classroom) => (
            <Link
              key={classroom.id}
              to={`/classes/${classroom.id}`}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-lg">
                  <Icon name="building" size={22} />
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-semibold">
                  {classroom.subject || 'Chưa phân môn'}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">{classroom.name}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                {classroom.grade && <span>Khối {classroom.grade}</span>}
                {classroom.grade && <span>·</span>}
                <span>{classroom.memberCount ?? 0} học sinh</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-4">
                <Icon name="lock" size={14} className="text-slate-400" />
                <code className="text-xs font-mono font-bold text-blue-600 flex-1">{classroom.code}</code>
                <button
                  type="button"
                  aria-label="Sao chép mã lớp"
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
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-red-500"
                    icon={<Icon name="trash" size={14} />}
                    onClick={(event) => void handleDelete(event, classroom)}
                  >
                    Lưu trữ
                  </Button>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Chỉnh sửa lớp học' : 'Tạo lớp học mới'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={saving}             type="submit"
            form="class-form">
              {editing ? 'Lưu thay đổi' : 'Tạo lớp'}
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
            <Select
              label="Môn học"
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              options={SUBJECTS.map((subject) => ({ value: subject, label: subject }))}
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
