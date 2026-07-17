'use client';

import { useEffect, useRef } from 'react';
import { useRobotStore, type ToastKind } from '@/store/robotStore';

const TOAST_LIFETIME_MS = 2600;

const KIND_STYLES: Record<ToastKind, string> = {
    info: 'border-cyan-500 text-cyan-300',
    success: 'border-green-500 text-green-300',
    warn: 'border-red-500 text-red-300',
};

/** Transient event chips, top-center. Each toast auto-dismisses after ~2.6s. */
export function Toasts() {
    const toasts = useRobotStore((s) => s.toasts);
    const dismissToast = useRobotStore((s) => s.dismissToast);
    const scheduled = useRef(new Set<number>());

    useEffect(() => {
        for (const t of toasts) {
            if (scheduled.current.has(t.id)) continue;
            scheduled.current.add(t.id);
            setTimeout(() => dismissToast(t.id), TOAST_LIFETIME_MS);
        }
    }, [toasts, dismissToast]);

    return (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-20">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={`bg-slate-900/90 backdrop-blur border-l-2 px-3 py-1 text-[10px] font-mono tracking-wider shadow-lg ${KIND_STYLES[t.kind]}`}
                >
                    {t.text}
                </div>
            ))}
        </div>
    );
}
