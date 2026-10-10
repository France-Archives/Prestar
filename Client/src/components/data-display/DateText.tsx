import { formatDate } from "@/utils/formatDate";

export default function DateText({ value, empty = "—" }: { value: string | null | undefined; empty?: string }) {
  return <span>{value ? formatDate(value) : empty}</span>;
}