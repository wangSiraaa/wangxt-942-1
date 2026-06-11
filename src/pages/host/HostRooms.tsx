import { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useUIStore } from '@/store/uiStore';
import Modal from '@/components/common/Modal';
import type { Room } from '@/types';

const emptyRoom: Omit<Room, 'id'> = {
  name: '',
  type: '大床房',
  bedCount: 1,
  bedType: '1.5m 大床',
  area: 25,
  maxGuests: 2,
  facilities: ['独立卫浴', '免费WiFi', '空调'],
  image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=70',
  basePriceWeekday: 388,
  basePriceWeekend: 528,
  description: '',
};

const facilityOptions = ['独立卫浴', '免费WiFi', '空调', '智能电视', '山景阳台', '私家庭院', '浴缸', '茶台茶具', '迷你吧', '儿童用品'];

export default function HostRooms() {
  const { rooms, addRoom, updateRoom, deleteRoom } = useRoomStore();
  const showToast = useUIStore((s) => s.showToast);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState<Omit<Room, 'id'>>(emptyRoom);

  const openNew = () => {
    setEditing(null);
    setForm(emptyRoom);
    setModalOpen(true);
  };

  const openEdit = (r: Room) => {
    setEditing(r);
    const { id: _, ...rest } = r;
    setForm(rest);
    setModalOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) return showToast({ type: 'error', message: '请输入房间名称' });
    if (editing) {
      updateRoom(editing.id, form);
      showToast({ type: 'success', message: `「${form.name}」已更新` });
    } else {
      addRoom(form);
      showToast({ type: 'success', message: `「${form.name}」已创建` });
    }
    setModalOpen(false);
  };

  const toggleFacility = (f: string) => {
    setForm((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(f)
        ? prev.facilities.filter((x) => x !== f)
        : [...prev.facilities, f],
    }));
  };

  const handleDelete = (r: Room) => {
    if (confirm(`确定删除房间「${r.name}」吗？相关价格与折扣配置将一并移除。`)) {
      deleteRoom(r.id);
      showToast({ type: 'info', message: `「${r.name}」已删除` });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title mb-2">房间管理</h1>
          <p className="text-ink-300">共 {rooms.length} 间房，管理房间档案与基础价格</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" /> 新增房间
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rooms.map((r) => (
          <div key={r.id} className="card-hover overflow-hidden">
            <div className="aspect-[16/10] overflow-hidden bg-ink-100 relative group">
              <img src={r.image} alt={r.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(r)} className="w-8 h-8 rounded-lg bg-white/95 flex items-center justify-center text-ink-500 hover:text-clay-500 shadow-sm">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(r)} className="w-8 h-8 rounded-lg bg-white/95 flex items-center justify-center text-ink-500 hover:text-red-500 shadow-sm">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-display text-lg text-ink-600 leading-tight">{r.name}</h3>
                <span className="chip bg-clay-50 text-clay-500 shrink-0">{r.type}</span>
              </div>
              <div className="text-xs text-ink-300 mb-3">
                {r.bedType} · {r.area}㎡ · 最多 {r.maxGuests} 人
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {r.facilities.slice(0, 4).map((f) => (
                  <span key={f} className="chip bg-cream-50 text-ink-400">{f}</span>
                ))}
                {r.facilities.length > 4 && <span className="chip bg-cream-50 text-ink-300">+{r.facilities.length - 4}</span>}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-ink-100">
                <div>
                  <span className="text-xs text-ink-300">平日</span>
                  <span className="ml-1.5 font-display text-lg text-clay-500">¥{r.basePriceWeekday}</span>
                  <span className="mx-2 text-ink-100">|</span>
                  <span className="text-xs text-ink-300">周末</span>
                  <span className="ml-1.5 font-display text-lg text-ink-600">¥{r.basePriceWeekend}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `编辑 · ${editing.name}` : '新增房间'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-ghost">取消</button>
            <button onClick={submit} className="btn-primary">{editing ? '保存修改' : '创建房间'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">房间名称</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：山茶·山景大床房" />
            </div>
            <div>
              <label className="label">房型</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {['大床房', '双床房', '家庭套房', '榻榻米'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">床型</label>
              <input className="input" value={form.bedType} onChange={(e) => setForm({ ...form, bedType: e.target.value })} placeholder="如：1.8m 大床" />
            </div>
            <div>
              <label className="label">面积 (㎡)</label>
              <input type="number" className="input" value={form.area} onChange={(e) => setForm({ ...form, area: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">最多入住</label>
              <input type="number" className="input" value={form.maxGuests} onChange={(e) => setForm({ ...form, maxGuests: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">平日价 (¥)</label>
              <input type="number" className="input" value={form.basePriceWeekday} onChange={(e) => setForm({ ...form, basePriceWeekday: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">周末价 (¥)</label>
              <input type="number" className="input" value={form.basePriceWeekend} onChange={(e) => setForm({ ...form, basePriceWeekend: Number(e.target.value) })} />
            </div>
            <div className="col-span-2">
              <label className="label">封面图 URL</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
                {form.image && <img src={form.image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">房间设施</label>
              <div className="flex flex-wrap gap-2">
                {facilityOptions.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFacility(f)}
                    className={`chip transition-colors ${form.facilities.includes(f) ? 'bg-clay-100 text-clay-500' : 'bg-ink-50 text-ink-400 hover:bg-ink-100'}`}
                  >
                    {form.facilities.includes(f) && <X className="w-3 h-3" />}
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">房间描述</label>
              <textarea className="input min-h-[84px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="描述房间特色..." />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
