import Button from "@/components/common/Button";
import { InputField } from "@/components/forms/FormField";

interface Props {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}

export default function ReportsFilters({ from, to, onChange }: Props) {
  return (
    <div className="toolbar" style={{ alignItems: "flex-end" }}>
      <InputField label="From" type="date" value={from} onChange={(e) => onChange({ from: e.target.value, to })} />
      <InputField label="To" type="date" value={to} onChange={(e) => onChange({ from, to: e.target.value })} />
      <Button variant="ghost" onClick={() => onChange({ from: "", to: "" })} disabled={!from && !to}>
        Clear dates
      </Button>
    </div>
  );
}