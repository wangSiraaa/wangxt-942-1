import type { Room } from '@/types';
import { BedDouble, Maximize, Users, ChevronRight } from 'lucide-react';
import { fmt } from '@/utils/price';

interface Props {
  room: Room;
  onClick?: () => void;
  extra?: React.ReactNode;
}

export default function RoomCard({ room, onClick, extra }: Props) {
  return (
    <div
      onClick={onClick}
      className={`card-hover overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="aspect-[16/10] overflow-hidden bg-ink-100">
        <img
          src={room.image}
          alt={room.name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-display text-lg text-ink-600 leading-tight">{room.name}</h3>
          <span className="chip bg-clay-50 text-clay-500 shrink-0">{room.type}</span>
        </div>
        <div className="flex flex-wrap gap-3 mb-3 text-xs text-ink-300">
          <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{room.bedType}</span>
          <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{room.area}㎡</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />最多 {room.maxGuests} 人</span>
        </div>
        {room.description && (
          <p className="text-xs text-ink-300 line-clamp-2 mb-3 leading-relaxed">{room.description}</p>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-ink-100">
          <div>
            <span className="text-xs text-ink-300">平日价</span>
            <span className="ml-2 font-display text-xl text-clay-500">{fmt(room.basePriceWeekday)}</span>
            <span className="text-xs text-ink-300">/晚起</span>
          </div>
          {onClick && <ChevronRight className="w-5 h-5 text-ink-200" />}
        </div>
        {extra}
      </div>
    </div>
  );
}
