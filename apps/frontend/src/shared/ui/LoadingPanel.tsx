export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="wu-loading-panel" role="status">
      <span className="wu-visually-hidden">{label}</span>
      <div aria-hidden="true" className="wu-skeleton" />
      <div aria-hidden="true" className="wu-skeleton" />
      <div aria-hidden="true" className="wu-skeleton" />
    </div>
  );
}
