import type { CategorySummary } from "@/types";

interface CategoryFilterProps {
  categories: CategorySummary[];
  value: string;
  onChange: (categoryId: string) => void;
}

export default function CategoryFilter({ categories, value, onChange }: CategoryFilterProps) {
  return (
    <select
      className="select"
      style={{ width: "auto" }}
      aria-label="Category"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      <option value="">All categories</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}
