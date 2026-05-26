import { create } from 'zustand';
import { todayISO } from './format';

interface DateStore {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  goToday: () => void;
}

export const useDateStore = create<DateStore>((set) => ({
  selectedDate: todayISO(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  goToday: () => set({ selectedDate: todayISO() }),
}));
