import type { Interest, UUID } from "@/types";
import { Check } from "lucide-react";

interface Props {
  interests: Interest[];
  selected: UUID[];
  onChange: (ids: UUID[]) => void;
  max?: number;
}

export default function InterestSelector({ interests, selected, onChange, max }: Props) {
  const toggle = (id: UUID) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (max === undefined || selected.length < max) onChange([...selected, id]);
  };
  return (
    <div className="interest-selector" role="group" aria-label="Reading interests">
      {interests.map((i) => {
        const on = selected.includes(i.id);
        const locked = max !== undefined && !on && selected.length >= max;
        return (
          <button
            key={i.id}
            type="button"
            aria-pressed={on}
            disabled={locked}
            className={`interest-chip${on ? " is-selected" : ""}`}
            onClick={() => toggle(i.id)}
          >
            <span>{i.name}</span>
            {on && <Check size={16} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}