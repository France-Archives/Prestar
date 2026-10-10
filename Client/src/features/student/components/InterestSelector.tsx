import type { Interest, UUID } from "@/types";

interface Props {
  interests: Interest[];
  selected: UUID[];
  onChange: (ids: UUID[]) => void;
  max?: number;
}

// Exactly 3 distinct interests are required (UpdateInterestsRequest).
export default function InterestSelector({ interests, selected, onChange, max = 3 }: Props) {
  const toggle = (id: UUID) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  };
  return (
    <div role="group" aria-label="Reading interests" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {interests.map((i) => {
        const on = selected.includes(i.id);
        const locked = !on && selected.length >= max;
        return (
          <button key={i.id} type="button" aria-pressed={on} disabled={locked} className={`btn btn-sm ${on ? "btn-primary" : "btn-ghost"}`} onClick={() => toggle(i.id)}>
            {on ? "✓ " : ""}{i.name}
          </button>
        );
      })}
    </div>
  );
}