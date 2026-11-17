import { useId } from 'react';
import './github-activity.css';

export interface GithubCommitStats {
  days: number;
  timezone: string;
  total: number;
  items: {
    date: string;
    commits: number;
  }[];
}

interface GithubCommitActivityProps {
  stats?: GithubCommitStats;
  error?: string;
  onRetry: () => void;
}

const CHART_TOP = 18;
const CHART_BOTTOM = 78;
const CHART_START = 34;
const CHART_END = 666;

export function GithubCommitActivity({
  stats,
  error,
  onRetry,
}: GithubCommitActivityProps) {
  const gradientId = useId();
  const items = stats?.items ?? [];

  const maximum = Math.max(1, ...items.map(item => item.commits));

  const points = items.map((item, index) => {
    const x =
      CHART_START +
      (index * (CHART_END - CHART_START)) /
        Math.max(1, items.length - 1);

    const y =
      CHART_BOTTOM -
      (item.commits / maximum) * (CHART_BOTTOM - CHART_TOP);

    return {
      ...item,
      x,
      y,
      day: new Date(`${item.date}T00:00:00Z`)
        .toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: 'UTC',
        }),
    };
  });

  const linePath = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;

    return (
      `${path} C ${middle} ${previous.y}, ` +
      `${middle} ${point.y}, ${point.x} ${point.y}`
    );
  }, '');

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${CHART_BOTTOM} ` +
      `L ${points[0].x} ${CHART_BOTTOM} Z`
    : '';

  return (
    <section
      className="wu-github-activity"
      aria-label="GitHub commit activity"
    >
      <div className="wu-github-activity__heading">
        <div>
          <h3>Repository Activity</h3>
          <p>Commits over the last 7 days</p>
        </div>

        {stats && (
          <div className="wu-github-activity__total">
            <strong>{stats.total}</strong>
            <span>commits</span>
          </div>
        )}
      </div>

      {error ? (
        <div role="alert" className="wu-github-activity__state">
          <p>Could not load commit activity: {error}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : !stats ? (
        <p role="status" className="wu-github-activity__state">
          Loading activity…
        </p>
      ) : !points.length ? (
        <p className="wu-github-activity__state">
          No activity data available.
        </p>
      ) : (
        <>
          <svg
            className="wu-github-activity__chart"
            viewBox="0 0 700 118"
            role="img"
            aria-label="Daily commits over the last seven days"
          >
            <title>GitHub commit activity</title>
            <desc>
              {items
                .map(item => `${item.date}: ${item.commits} commits`)
                .join(', ')}
            </desc>

            <defs>
              <linearGradient
                id={gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--wu-blue)"
                  stopOpacity="0.25"
                />
                <stop
                  offset="100%"
                  stopColor="var(--wu-blue)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <path
              d={areaPath}
              fill={`url(#${gradientId})`}
            />

            <path
              d={linePath}
              className="wu-github-activity__line"
            />

            {points.map(point => (
              <g key={point.date}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  className="wu-github-activity__point"
                >
                  <title>
                    {point.date}: {point.commits} commits
                  </title>
                </circle>

                <text
                  x={point.x}
                  y="106"
                  textAnchor="middle"
                  className="wu-github-activity__label"
                >
                  {point.day}
                </text>
              </g>
            ))}
          </svg>

          <p className="wu-github-activity__footnote">
            Based on synchronized default-branch commits · UTC
          </p>
        </>
      )}
    </section>
  );
}
