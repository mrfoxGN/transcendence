import { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ClipboardCopy,
  GitBranch,
  GitCommitHorizontal,
  LockKeyhole,
} from 'lucide-react';

import './github-branches.css';

type Branch = {
  name: string;
  sha: string;
  protected: boolean;
  lastCommittedAt?: string | null;
};

type BranchFilter = 'all' | 'protected' | 'default';

interface GithubBranchesProps {
  branches: Branch[];
  defaultBranch: string;
  repositoryUrl: string;
}

const PAGE_SIZE = 10;

function branchUrl(repositoryUrl: string, name: string) {
  return (
    `${repositoryUrl.replace(/\/$/, '')}/tree/` +
    name.split('/').map(encodeURIComponent).join('/')
  );
}

export function GithubBranches({
  branches,
  defaultBranch,
  repositoryUrl,
}: GithubBranchesProps) {
  const [filter, setFilter] = useState<BranchFilter>('all');
  const [page, setPage] = useState(1);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');

  const protectedCount = branches.filter(
    branch => branch.protected
  ).length;

  const sorted = [...branches].sort((a, b) => {
    if (a.name === defaultBranch) return -1;
    if (b.name === defaultBranch) return 1;

    return a.name.localeCompare(b.name);
  });

  const filtered = sorted.filter(branch => {
    if (filter === 'protected') return branch.protected;
    if (filter === 'default') return branch.name === defaultBranch;

    return true;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;

  const visible = filtered.slice(
    start,
    start + PAGE_SIZE
  );

  function changeFilter(value: BranchFilter) {
    setFilter(value);
    setPage(1);
  }

  async function copySha(sha: string) {
    try {
      await navigator.clipboard.writeText(sha);
      setCopiedSha(sha);
      setCopyError('');
    } catch {
      setCopiedSha(null);
      setCopyError('Unable to copy the commit SHA.');
    }
  }

  return (
    <section className="wu-gbranches">
      <header className="wu-gbranches__header">
        <div className="wu-gbranches__heading">
          <span className="wu-gbranches__heading-icon">
            <GitBranch size={25} aria-hidden="true" />
          </span>

          <div>
            <h2>Branches</h2>
            <p>
              Explore your repository branches and their
              latest commits.
            </p>
          </div>
        </div>

        <div
          className="wu-gbranches__filters"
          role="group"
          aria-label="Filter branches"
        >
          <button
            type="button"
            className={
              'wu-gbranches__filter ' +
              (filter === 'all' ? 'is-active' : '')
            }
            aria-pressed={filter === 'all'}
            onClick={() => changeFilter('all')}
          >
            <GitBranch size={16} aria-hidden="true" />
            <strong>{branches.length}</strong>
            Branches
          </button>

          <button
            type="button"
            className={
              'wu-gbranches__filter ' +
              (filter === 'protected' ? 'is-active' : '')
            }
            aria-pressed={filter === 'protected'}
            onClick={() => changeFilter('protected')}
          >
            <LockKeyhole size={16} aria-hidden="true" />
            <strong>{protectedCount}</strong>
            Protected
          </button>

          <button
            type="button"
            className={
              'wu-gbranches__filter ' +
              (filter === 'default' ? 'is-active' : '')
            }
            aria-pressed={filter === 'default'}
            onClick={() => changeFilter('default')}
          >
            <strong>{defaultBranch}</strong>
            Default
          </button>
        </div>
      </header>

      {copyError && (
        <p className="wu-gbranches__error" role="alert">
          {copyError}
        </p>
      )}

      <div className="wu-gbranches__table-wrap">
        <table className="wu-gbranches__table">
          <thead>
            <tr>
              <th scope="col">Branch</th>
              <th scope="col">Latest commit</th>
              <th scope="col">Protection</th>
              <th scope="col">Action</th>
            </tr>
          </thead>

          <tbody>
            {visible.map(branch => {
              const isDefault =
                branch.name === defaultBranch;

              return (
                <tr
                  key={branch.name}
                  className={
                    isDefault
                      ? 'wu-gbranches__row--default'
                      : ''
                  }
                >
                  <td>
                    <div className="wu-gbranches__branch">
                      <GitBranch
                        size={17}
                        aria-hidden="true"
                      />

                      <strong title={branch.name}>
                        {branch.name}
                      </strong>

                      {isDefault && (
                        <span className="wu-gbranches__default">
                          Default
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="wu-gbranches__sha"
                      onClick={() => void copySha(branch.sha)}
                      title="Copy full commit SHA"
                      aria-label={`Copy SHA for ${branch.name}`}
                    >
                      <GitCommitHorizontal
                        size={14}
                        aria-hidden="true"
                      />

                      <code>
                        {branch.sha.slice(0, 7)}
                      </code>

                      {copiedSha === branch.sha ? (
                        <Check size={13} aria-hidden="true" />
                      ) : (
                        <ClipboardCopy
                          size={13}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </td>

                  <td>
                    {branch.protected ? (
                      <span className="wu-gbranches__protected">
                        <LockKeyhole
                          size={14}
                          aria-hidden="true"
                        />
                        Protected
                      </span>
                    ) : (
                      <span className="wu-gbranches__unprotected">
                        Not protected
                      </span>
                    )}
                  </td>

                  <td>
                    <a
                      className="wu-gbranches__view"
                      href={branchUrl(repositoryUrl, branch.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${branch.name} on GitHub`}
                    >
                      View on GitHub
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="wu-gbranches__empty">
            <LockKeyhole
              size={24}
              aria-hidden="true"
            />

            <strong>No branches found</strong>

            <p>
              No branches match the selected filter.
            </p>

            <button
              type="button"
              onClick={() => changeFilter('all')}
            >
              Show all branches
            </button>
          </div>
        )}
      </div>

      <footer className="wu-gbranches__footer">
        <span>
          {filtered.length === 0
            ? 'Showing 0 branches'
            : `Showing ${start + 1}–${Math.min(
                start + PAGE_SIZE,
                filtered.length
              )} of ${filtered.length} branches`}
        </span>

        {totalPages > 1 && (
          <nav
            className="wu-gbranches__pagination"
            aria-label="Branch pages"
          >
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>

            {Array.from(
              { length: totalPages },
              (_, index) => index + 1
            ).map(number => (
              <button
                type="button"
                key={number}
                className={
                  currentPage === number
                    ? 'is-active'
                    : ''
                }
                aria-current={
                  currentPage === number
                    ? 'page'
                    : undefined
                }
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </footer>

    </section>
  );
}
