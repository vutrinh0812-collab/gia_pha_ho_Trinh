import { create } from 'zustand';

export type AdminActionKind = 'menu' | 'edit' | 'addChild' | 'addSpouse' | 'addFather' | 'reorder' | 'delete';

export interface AdminAction {
  kind: AdminActionKind;
  personId: string;
}

interface AdminUiState {
  action: AdminAction | null;
  open(kind: AdminActionKind, personId: string): void;
  close(): void;
}

/** Which admin panel is open (menu, form, reorder, delete) and for whom. */
export const useAdminUi = create<AdminUiState>((set) => ({
  action: null,
  open: (kind, personId) => set({ action: { kind, personId } }),
  close: () => set({ action: null }),
}));
