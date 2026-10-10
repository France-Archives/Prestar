import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  delayMs?: number;
}

/** Controlled from outside; calls onChange only after the user pauses typing. */
export default function SearchInput({ value, onChange, placeholder = "Search…", label = "Search", delayMs = 300 }: SearchInputProps) {
  const [text, setText] = useState(value);
  const debounced = useDebounce(text, delayMs);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <input
      className="input grow"
      type="search"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
    />
  );
}