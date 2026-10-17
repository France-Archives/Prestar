import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AllowedDurationDays, BookSummary, UUID } from "@/types";

export interface BorrowListItem {
  book: BookSummary;
  quantity: number;
  requestedDurationDays: AllowedDurationDays;
}

interface BorrowListContextValue {
  items: BorrowListItem[];
  addBook: (book: BookSummary) => boolean;
  updateItem: (bookId: UUID, updates: Partial<Pick<BorrowListItem, "quantity" | "requestedDurationDays">>) => void;
  removeItem: (bookId: UUID) => void;
  clear: () => void;
}

const BorrowListContext = createContext<BorrowListContextValue | null>(null);

export function BorrowListProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<BorrowListItem[]>([]);

  useEffect(() => {
    setItems([]);
  }, [user?.id]);

  const addBook = (book: BookSummary) => {
    if (items.some((item) => item.book.id === book.id)) return false;
    setItems((current) => [...current, { book, quantity: 1, requestedDurationDays: 7 }]);
    return true;
  };

  const updateItem: BorrowListContextValue["updateItem"] = (bookId, updates) => {
    setItems((current) => current.map((item) => item.book.id === bookId ? { ...item, ...updates } : item));
  };

  const removeItem = (bookId: UUID) => setItems((current) => current.filter((item) => item.book.id !== bookId));
  const clear = () => setItems([]);

  return <BorrowListContext.Provider value={{ items, addBook, updateItem, removeItem, clear }}>{children}</BorrowListContext.Provider>;
}

export function useBorrowList(): BorrowListContextValue {
  const value = useContext(BorrowListContext);
  if (!value) throw new Error("useBorrowList must be used within BorrowListProvider.");
  return value;
}