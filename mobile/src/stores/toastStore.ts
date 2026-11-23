import { create } from "zustand";

export type ToastType = "success" | "info" | "warning";

interface ToastState {
  toast: {
    id: number;
    message: string;
    type: ToastType;
  } | null;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  showToast: (message: string, type: ToastType = "success") => {
    const id = Date.now();
    set({ toast: { id, message, type } });
  },
  hideToast: () => {
    set({ toast: null });
  },
}));
