import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

type Tab<Value extends string> = { value: Value; label: ReactNode };
type TabsProps<Value extends string> = {
  items: readonly Tab<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  idPrefix: string;
  label: string;
  className?: string;
};

/** Manual activation: arrows move focus; Enter, Space or click selects a panel. */
export function Tabs<Value extends string>({
  items,
  value,
  onChange,
  idPrefix,
  label,
  className,
}: TabsProps<Value>) {
  const [focused, setFocused] = useState<Value | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((tab) => tab.value === (focused ?? value));
    const next = {
      ArrowLeft: (index + items.length - 1) % items.length,
      ArrowRight: (index + 1) % items.length,
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    buttons.current[next]?.focus();
  }
  return (
    <div
      className={className}
      role="tablist"
      aria-label={label}
      onKeyDown={moveFocus}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
      }}
    >
      {items.map((tab, index) => (
        <button
          key={tab.value}
          id={`${idPrefix}-tab-${tab.value}`}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          aria-controls={`${idPrefix}-panel-${tab.value}`}
          tabIndex={(focused ?? value) === tab.value ? 0 : -1}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          onFocus={() => setFocused(tab.value)}
          onClick={() => onChange(tab.value)}
        >
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
