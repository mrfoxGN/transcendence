import { Avatar } from './Avatar';
export function AvatarGroup({
  people,
  label = 'Contributors',
}: {
  people: { name: string; initials: string; tone?: string; preview?: boolean }[];
  label?: string;
}) {
  if (!people.length) return null;
  return (
    <div
      className="wu-avatar-group"
      role="img"
      aria-label={label + ': ' + people.map((person) => person.name).join(', ')}
    >
      {people.slice(0, 4).map((person) => (
        <span key={person.name} title={person.name}>
          <Avatar {...person} small />
        </span>
      ))}
      {people.length > 4 && (
        <span className="wu-avatar-overflow" aria-hidden="true">
          +{people.length - 4}
        </span>
      )}
    </div>
  );
}
