import { useUIStore } from '@/store/uiStore';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap = {
  success: 'bg-sage-100 text-sage-500 border-sage-300',
  error: 'bg-red-50 text-red-500 border-red-200',
  info: 'bg-ink-50 text-ink-500 border-ink-200',
  warning: 'bg-amber-50 text-amber-600 border-amber-200',
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useUIStore();
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-48px)] pointer-events-none">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl2 border shadow-pop animate-slide-up ${colorMap[t.type]}`}
          >
            <Icon className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="flex-1 text-sm font-medium leading-snug pt-0.5">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="opacity-60 hover:opacity-100 transition-opacity shrink-0 -mr-1"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
