import { useState } from 'react';
import { Plus, Pencil, Trash2, Percent } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useUIStore } from '@/store/uiStore';
import Modal from '@/components/common/Modal';
import type { HolidayPrice, DiscountRule } from '@/types';

type Tab = 'base' | 'holiday' | 'discount';

export default function HostPricing() {
  const { rooms, holidays, discounts, addHoliday, updateHoliday, deleteHoliday, addDiscount, updateDiscount, deleteDiscount } = useRoomStore();
  const showToast = useUIStore((s) => s.showToast);
  const [tab, setTab] = useState<Tab>('base');
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]?.id || '');
  const [holidayModal, setHolidayModal] = useState(false);
  const [discountModal, setDiscountModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayPrice | null>(null);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRule | null>(null);

  const [holidayForm, setHolidayForm] = useState<Omit<HolidayPrice, 'id'>>({
    roomId: selectedRoom, name: '', startDate: '', endDate: '', price: 0,
  });
  const [discountForm, setDiscountForm] = useState<Omit<DiscountRule, 'id'>>({
    roomId: selectedRoom, minNights: 3, discountRate: 0.95,
  });

  const currentRoom = rooms.find((r) => r.id === selectedRoom);
  const roomHolidays = holidays.filter((h) => h.roomId === selectedRoom);
  const roomDiscounts = discounts.filter((d) => d.roomId === selectedRoom).sort((a, b) => a.minNights - b.minNights);

  const switchRoom = (id: string) => {
    setSelectedRoom(id);
    setHolidayForm((f) => ({ ...f, roomId: id }));
    setDiscountForm((f) => ({ ...f, roomId: id }));
  };

  const openHoliday = (h?: HolidayPrice) => {
    setEditingHoliday(h || null);
    if (h) setHolidayForm({ roomId: h.roomId, name: h.name, startDate: h.startDate, endDate: h.endDate, price: h.price });
    else setHolidayForm({ roomId: selectedRoom, name: '', startDate: '', endDate: '', price: 0 });
    setHolidayModal(true);
  };

  const saveHoliday = () => {
    if (!holidayForm.name || !holidayForm.startDate || !holidayForm.endDate || holidayForm.price <= 0) {
      return showToast({ type: 'error', message: '请完整填写节假日信息' });
    }
    if (editingHoliday) {
      updateHoliday(editingHoliday.id, holidayForm);
      showToast({ type: 'success', message: '节假日价格已更新' });
    } else {
      addHoliday(holidayForm);
      showToast({ type: 'success', message: '节假日价格已创建' });
    }
    setHolidayModal(false);
  };

  const openDiscount = (d?: DiscountRule) => {
    setEditingDiscount(d || null);
    if (d) setDiscountForm({ roomId: d.roomId, minNights: d.minNights, discountRate: d.discountRate });
    else setDiscountForm({ roomId: selectedRoom, minNights: 3, discountRate: 0.95 });
    setDiscountModal(true);
  };

  const saveDiscount = () => {
    if (discountForm.minNights < 2 || discountForm.discountRate <= 0 || discountForm.discountRate > 1) {
      return showToast({ type: 'error', message: '折扣参数不合法' });
    }
    if (editingDiscount) {
      updateDiscount(editingDiscount.id, discountForm);
      showToast({ type: 'success', message: '连住折扣已更新' });
    } else {
      addDiscount(discountForm);
      showToast({ type: 'success', message: '连住折扣已创建' });
    }
    setDiscountModal(false);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title mb-2">价格策略</h1>
        <p className="text-ink-300">为每个房间设置平日/周末基础价、节假日特殊价与连住折扣</p>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-thin">
        {rooms.map((r) => (
          <button
            key={r.id}
            onClick={() => switchRoom(r.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedRoom === r.id
                ? 'bg-gradient-to-br from-clay-300 to-clay-400 text-white shadow-soft'
                : 'bg-white text-ink-400 hover:text-ink-600 hover:bg-ink-50 border border-ink-100'
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        {([
          ['base', '基础价格'],
          ['holiday', '节假日价格'],
          ['discount', '连住折扣'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === key
                ? 'bg-ink-600 text-white shadow-sm'
                : 'bg-white text-ink-400 hover:text-ink-600 border border-ink-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {currentRoom && tab === 'base' && (
        <div className="card p-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="label">平日价格 (¥/晚)</label>
              <input
                type="number"
                className="input font-display text-xl text-clay-500"
                value={currentRoom.basePriceWeekday}
                onChange={(e) => useRoomStore.getState().updateRoom(currentRoom.id, { basePriceWeekday: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">周末价格 (¥/晚)</label>
              <input
                type="number"
                className="input font-display text-xl text-clay-500"
                value={currentRoom.basePriceWeekend}
                onChange={(e) => useRoomStore.getState().updateRoom(currentRoom.id, { basePriceWeekend: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="mt-5 text-xs text-ink-300 leading-relaxed">
            基础价格为默认房价，周五、周六自动使用周末价。节假日价格优先级高于基础价格。
          </p>
        </div>
      )}

      {tab === 'holiday' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-ink-300">{roomHolidays.length} 条节假日定价规则</p>
            <button onClick={() => openHoliday()} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" /> 新增节假日
            </button>
          </div>
          {roomHolidays.length === 0 ? (
            <div className="card p-10 text-center text-ink-300 text-sm">暂无节假日价格</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roomHolidays.map((h) => (
                <div key={h.id} className="card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-ink-600">{h.name}</div>
                      <div className="text-xs text-ink-300 mt-0.5">{h.startDate} 至 {h.endDate}</div>
                    </div>
                    <div className="font-display text-2xl text-clay-500">¥{h.price}</div>
                  </div>
                  <div className="flex items-center justify-end gap-1 pt-3 border-t border-ink-100">
                    <button onClick={() => openHoliday(h)} className="btn-ghost btn-sm">
                      <Pencil className="w-3.5 h-3.5" /> 编辑
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`删除「${h.name}」？`)) {
                          deleteHoliday(h.id);
                          showToast({ type: 'info', message: '已删除' });
                        }
                      }}
                      className="btn-ghost btn-sm text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'discount' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-ink-300">{roomDiscounts.length} 条连住折扣规则</p>
            <button onClick={() => openDiscount()} className="btn-primary btn-sm">
              <Percent className="w-4 h-4" /> 新增折扣
            </button>
          </div>
          {roomDiscounts.length === 0 ? (
            <div className="card p-10 text-center text-ink-300 text-sm">暂无连住折扣，住客将按原价结算</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream-50 text-ink-400 text-xs uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-semibold">最少连住</th>
                    <th className="text-left px-5 py-3 font-semibold">折扣率</th>
                    <th className="text-left px-5 py-3 font-semibold">说明</th>
                    <th className="text-right px-5 py-3 font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {roomDiscounts.map((d) => (
                    <tr key={d.id} className="border-t border-ink-100">
                      <td className="px-5 py-3.5 font-medium text-ink-600">{d.minNights} 晚及以上</td>
                      <td className="px-5 py-3.5">
                        <span className="chip bg-clay-50 text-clay-500 font-display text-sm">
                          {Math.round(d.discountRate * 100)}%
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-300 text-xs">原价 × {Math.round(d.discountRate * 100)}% = 实付</td>
                      <td className="px-5 py-3.5 text-right flex items-center justify-end gap-1">
                        <button onClick={() => openDiscount(d)} className="btn-ghost btn-sm">
                          <Pencil className="w-3.5 h-3.5" /> 编辑
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('删除该折扣规则？')) {
                              deleteDiscount(d.id);
                              showToast({ type: 'info', message: '已删除' });
                            }
                          }}
                          className="btn-ghost btn-sm text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> 删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={holidayModal}
        onClose={() => setHolidayModal(false)}
        title={editingHoliday ? '编辑节假日价格' : '新增节假日价格'}
        footer={
          <>
            <button onClick={() => setHolidayModal(false)} className="btn-ghost">取消</button>
            <button onClick={saveHoliday} className="btn-primary">{editingHoliday ? '保存' : '创建'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">名称</label>
            <input className="input" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} placeholder="如：暑期旺季、春节" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">开始日期</label>
              <input type="date" className="input" value={holidayForm.startDate} onChange={(e) => setHolidayForm({ ...holidayForm, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">结束日期</label>
              <input type="date" className="input" value={holidayForm.endDate} onChange={(e) => setHolidayForm({ ...holidayForm, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">价格 (¥/晚)</label>
            <input type="number" className="input" value={holidayForm.price || ''} onChange={(e) => setHolidayForm({ ...holidayForm, price: Number(e.target.value) })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={discountModal}
        onClose={() => setDiscountModal(false)}
        title={editingDiscount ? '编辑连住折扣' : '新增连住折扣'}
        footer={
          <>
            <button onClick={() => setDiscountModal(false)} className="btn-ghost">取消</button>
            <button onClick={saveDiscount} className="btn-primary">{editingDiscount ? '保存' : '创建'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">最少连住 (晚)</label>
            <input type="number" min={2} className="input" value={discountForm.minNights} onChange={(e) => setDiscountForm({ ...discountForm, minNights: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">折扣率 (0-1，如 0.95 即 95 折)</label>
            <input type="number" step={0.01} min={0} max={1} className="input" value={discountForm.discountRate} onChange={(e) => setDiscountForm({ ...discountForm, discountRate: Number(e.target.value) })} />
            <p className="text-xs text-ink-300 mt-2">示例：0.95 = 95折，0.88 = 88折</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
