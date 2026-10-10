import Button from "@/components/common/Button";
import type { CategorySummary } from "@/types";
import BookSearch from "./BookSearch";
import CategoryFilter from "./CategoryFilter";

export interface BookFilterValues {
  search: string;
  categoryId: string;
  availability: "" | "AVAILABLE" | "UNAVAILABLE";
}

interface BookFiltersProps {
  values: BookFilterValues;
  categories: CategorySummary[];
  onChange: (next: BookFilterValues) => void;
}

export default function BookFilters({ values, categories, onChange }: BookFiltersProps) {
  const dirty = Boolean(values.search || values.categoryId || values.availability);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="toolbar" style={{ margin: 0 }}>
        <BookSearch value={values.search} onChange={(search) => onChange({ ...values, search })} />
        <select
          className="select"
          style={{ width: "auto" }}
          aria-label="Availability"
          value={values.availability}
          onChange={(e) => onChange({ ...values, availability: e.target.value as BookFilterValues["availability"] })}
        >
          <option value="">All availability</option>
          <option value="AVAILABLE">Available now</option>
          <option value="UNAVAILABLE">Not available</option>
        </select>
        <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => onChange({ search: "", categoryId: "", availability: "" })}>
          Clear filters
        </Button>
      </div>
      <CategoryFilter categories={categories} value={values.categoryId} onChange={(categoryId) => onChange({ ...values, categoryId })} />
    </div>
  );
}