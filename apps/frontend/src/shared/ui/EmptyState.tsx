import { EmptyIllustration, type EmptyKind } from '../illustrations/EmptyIllustration';
import { Button } from './Button';
export function EmptyState({
  title,
  detail,
  action,
  onAction,
  illustration,
}: {
  title: string;
  detail: string;
  action: string;
  onAction: () => void;
  illustration?: EmptyKind;
}) {
  return (
    <div className="wu-empty">
      <div aria-hidden="true">
        <EmptyIllustration
          kind={illustration ?? (/match|filter|search/i.test(title) ? 'search' : 'tasks')}
        />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      <Button variant="primary" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}
