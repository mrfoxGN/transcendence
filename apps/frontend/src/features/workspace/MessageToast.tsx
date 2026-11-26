import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import './message-toast.css';
import type { MessageNotice } from './workspace-chat';
import type { Member } from './workspace-tasks';

const duration = 6000;

export function MessageToast({
  notice,
  members,
  workspaceName,
  onOpen,
  onDismiss,
}: {
  notice: MessageNotice;
  members: Member[];
  workspaceName: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.visibilityState !== 'visible');
  const remaining = useRef(duration);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const paused = hovered || focused || hidden;
  const member = members.find((item) => item.userId === notice.message.senderId);
  const sender = member?.username ?? 'Workspace member';
  const initials = sender
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const conversation = notice.threadId === 'team' ? workspaceName : 'Direct message';

  useEffect(() => {
    const visibility = () => setHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    remaining.current = duration;
  }, [notice.message.id]);
  useEffect(() => {
    if (paused) return;
    const started = performance.now();
    const timer = window.setTimeout(() => dismiss.current(), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [paused, notice.message.id]);

  return (
    <section
      className="wu-message-toast"
      aria-label="New message notification"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <button
        type="button"
        className="wu-message-toast-open"
        onClick={onOpen}
        aria-label={`Open conversation with ${sender}`}
      >
        <span className="wu-message-toast-avatar" aria-hidden="true">
          {initials}
          {member?.avatarUrl && (
            <img
              src={member.avatarUrl}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
        </span>
        <span className="wu-message-toast-copy">
          <span className="wu-message-toast-heading">
            <strong>{sender}</strong>
            {notice.count > 1 && (
              <span className="wu-message-toast-count">{notice.count} messages</span>
            )}
          </span>
          <small>{conversation}</small>
          <span className="wu-message-toast-preview">{notice.message.content}</span>
        </span>
      </button>
      <button
        type="button"
        className="wu-message-toast-dismiss"
        aria-label="Dismiss message notification"
        onClick={onDismiss}
      >
        <X size={16} aria-hidden="true" />
      </button>
      <span className="wu-message-toast-track" aria-hidden="true">
        <span
          key={notice.message.id}
          className="wu-message-toast-progress"
          style={{ animationPlayState: paused ? 'paused' : 'running' }}
        />
      </span>
      <span className="wu-message-toast-announcement" role="status" aria-atomic="true">
        New {conversation === 'Direct message' ? 'direct message' : 'message in ' + conversation}{' '}
        from {sender}. {notice.count > 1 ? notice.count + ' messages.' : ''}
      </span>
    </section>
  );
}
