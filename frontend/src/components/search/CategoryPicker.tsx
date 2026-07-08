import { useEffect, useState } from "react";
import { CATEGORIES } from "./searchConfig";

interface CategoryPickerProps {
  selected: string[];
  onChange: (cats: string[]) => void;
  compact?: boolean;
}

export default function CategoryPicker({ selected, onChange, compact = false }: CategoryPickerProps) {
  const [tempSelected, setTempSelected] = useState(selected);

  const toggle = (id: string) => {
    const next = tempSelected.includes(id)
      ? tempSelected.filter((c) => c !== id)
      : [...tempSelected, id];
    setTempSelected(next);
    if (!compact) {
      onChange(next);
    }
  };

  const allOn = tempSelected.length === CATEGORIES.length;
  const toggleAll = () => {
    const next = allOn ? [] : CATEGORIES.map((c) => c.id);
    setTempSelected(next);
    if (!compact) {
      onChange(next);
    }
  };

  useEffect(() => {
    setTempSelected(selected);
  }, [selected]);

  return (
    <div className={`category-picker${compact ? " category-picker--compact" : ""}`}>
      <div className="category-picker__header">
        <span className="category-picker__title">Filter by Category</span>
        <button className="category-picker__toggle-all" onClick={toggleAll} type="button">
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>

      <div className="category-picker__grid">
        {CATEGORIES.map((cat) => {
          const active = tempSelected.includes(cat.id);
          return (
            <button
              key={cat.id}
              className={`category-picker__chip${active ? " category-picker__chip--active" : ""}`}
              onClick={() => toggle(cat.id)}
              type="button"
              aria-pressed={active}
            >
              {active && <span className="category-picker__chip-check">✓</span>}
              <span className="category-picker__chip-icon">{cat.icon}</span>
              <span className="category-picker__chip-label">{cat.label}</span>
            </button>
          );
        })}
        {compact && (
          <button className="btn btn--primary" onClick={() => onChange(tempSelected)} type="button">
            Apply filter →
          </button>
        )}
      </div>
    </div>
  );
}
