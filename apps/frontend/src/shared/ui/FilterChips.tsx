export function FilterChips({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="wu-chips" role="group" aria-label="Filter items">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          className={`wu-chip${active === item ? ' is-active' : ''}`}
          aria-pressed={active === item}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
