import { formatPeso } from "@/utils/formatCurrency";

export default function Money({ value }: { value: number }) {
  return <span className="tabular-nums">{formatPeso(value)}</span>;
}