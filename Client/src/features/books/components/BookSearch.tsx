import SearchInput from "@/components/forms/SearchInput";

// Searches title, ISBN and author name (spec: ?search=).
export default function BookSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <SearchInput value={value} onChange={onChange} placeholder="Search title, author or ISBN…" label="Search books" />;
}