import { Button } from '../../shared/ui';
// These names are retained for existing pages; new code imports shared/ui directly.
export { LoadingPanel, Dialog as Drawer, ActionMenu, AvatarGroup } from '../../shared/ui';
import { documentPageSize } from './workspace-api';
import './workspace-controls.css';
import './workspace-list.css';

export function DocumentPagination({ page, count, onPage, disabled = false }: {
  page: number; count?: number; onPage: (page: number) => void; disabled?: boolean;
}) {
  const hasNext = (count ?? 0) > documentPageSize;
  if (page === 1 && !hasNext) return null;
  return <nav className="wu-document-pagination" aria-label="Document pages">
    <Button variant="secondary" type="button" disabled={disabled || page === 1} onClick={() => onPage(page - 1)}>Previous</Button>
    <span aria-live="polite">Page {page}</span>
    <Button variant="secondary" type="button" disabled={disabled || !hasNext} onClick={() => onPage(page + 1)}>Next</Button>
  </nav>;
}
