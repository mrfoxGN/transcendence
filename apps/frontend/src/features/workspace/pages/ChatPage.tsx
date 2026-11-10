import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { ArrowLeft, ArrowUp, ChevronRight, FileText, Info, PanelLeftOpen, PanelRightClose, PanelRightOpen, Paperclip, Phone, Search, SquarePen, ThumbsUp, Users, Video, X } from 'lucide-react';
import { Avatar, IconTile, Panel } from '../components';
import { Drawer } from '../WorkspaceControls';
import { people } from '../previewData';
import type { ChatAttachment, ChatMessage, ChatThread } from '../chatPreview';
import type { PageKey } from '../types';
import { fileSize, type WorkspaceFile } from '../workspace-api';
import './chat.css';

type ChatPageProps = {
  profileName: string;
  threads: ChatThread[];
  setThreads: Dispatch<SetStateAction<ChatThread[]>>;
  files?: WorkspaceFile[];
  navigate: (page: PageKey) => void;
};

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const calendar = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const filters = ['All', 'Unread', 'Mentions'] as const;
const sections = ['Details', 'Members', 'Files', 'Links'] as const;

function dayLabel(date: Date) {
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  today.setDate(today.getDate() - 1);
  return date.toDateString() === today.toDateString() ? 'Yesterday' : calendar.format(date);
}

function Portrait({ name, small }: { name: string; small?: boolean }) {
  const person = people.find(item => item.name === name);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <Avatar initials={person?.initials ?? initials} tone={person?.color ?? 'mint'} small={small} preview={!!person} />;
}

function AttachmentCard({ file, onClick, action = 'Go to Files' }: { file: ChatAttachment; onClick: () => void; action?: string }) {
  return <button type="button" className="wu-chat-file" onClick={onClick} aria-label={action + ': ' + file.name}>
    <IconTile><FileText size={16} /></IconTile>
    <span><strong>{file.name}</strong><small>{file.detail}</small></span>
    <ChevronRight size={15} />
  </button>;
}

export function ChatPage({ profileName, threads, setThreads, files, navigate }: ChatPageProps) {
  const [selected, setSelected] = useState('team');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const [section, setSection] = useState<(typeof sections)[number]>('Details');
  const [drafts, setDrafts] = useState<Record<string, { text: string; attachment?: ChatAttachment }>>({});
  const [drawer, setDrawer] = useState<'details' | 'files' | 'new'>();
  const [showList, setShowList] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [callNotice, setCallNotice] = useState<'Voice' | 'Video'>();
  const messageList = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const thread = threads.find(item => item.id === selected) ?? threads[0];
  const draft = drafts[thread.id] ?? { text: '' };
  const owner = { name: profileName, role: 'You' };
  const teammates = people.filter(person => person.initials !== 'AM' && person.status === 'Active' && person.name !== profileName);
  const members = [owner, ...teammates.filter(person => !thread.member || person.name === thread.member)];
  const attachments = [...new Map(thread.messages.flatMap(message => message.attachment ? [[message.attachment.id, message.attachment] as const] : [])).values()];
  const links = [...new Set(thread.messages.flatMap(message => message.text.match(/https?:\/\/[^\s<>"']+/g) ?? []))];
  const unreadCount = threads.filter(item => item.unread > 0).length;
  const mentionCount = threads.filter(item => item.messages.some(message => message.mention)).length;
  const search = query.trim().toLowerCase();
  const visibleThreads = threads.filter(item =>
    (filter !== 'Unread' || item.unread > 0) &&
    (filter !== 'Mentions' || item.messages.some(message => message.mention)) &&
    (!search || item.title.toLowerCase().includes(search) || item.messages.some(message => message.text.toLowerCase().includes(search)))
  );

  useEffect(() => {
    const list = messageList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [thread.id, thread.messages.length]);

  useEffect(() => {
    const input = composer.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }, [draft.text, thread.id]);

  function selectThread(id: string) {
    setSelected(id);
    setCallNotice(undefined);
    setSection('Details');
    setShowList(false);
    setThreads(current => current.map(item => item.id === id && item.unread ? { ...item, unread: 0 } : item));
  }

  function startConversation(name: string) {
    const existing = threads.find(item => item.member === name);
    const id = existing?.id ?? 'direct-' + name;
    if (!existing) {
      setThreads(current => [...current, { id, title: name, member: name, unread: 0, messages: [] }]);
      setFilter('All');
      setQuery('');
    }
    selectThread(id);
    setDrawer(undefined);
  }

  function updateMessages(update: (messages: ChatMessage[]) => ChatMessage[]) {
    setThreads(current => current.map(item => item.id === thread.id ? { ...item, messages: update(item.messages) } : item));
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.text.trim();
    if (!body && !draft.attachment) return;
    const sentAt = new Date().toISOString();
    updateMessages(messages => [...messages, {
      id: `sent-${messages.length}`, author: profileName, own: true, sentAt,
      text: body, attachment: draft.attachment,
    }]);
    setDrafts(current => ({ ...current, [thread.id]: { text: '' } }));
    composer.current?.focus();
  }

  const openFiles = () => navigate('files');
  const details = <>
    <div className="wu-chat-tabs" role="group" aria-label="Conversation details">
      {sections.map(item => <button key={item} type="button" aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}
    </div>
    {section === 'Details' && <section className="wu-chat-description">
      <h3>Description</h3><p>{thread.member ? 'Private conversation with ' + thread.member + '.' : 'General discussion for DevUP. Share project updates, ask questions, and keep the team in the loop.'}</p>
    </section>}
    {(section === 'Details' || section === 'Members') && <section>
      <h3>Members ({members.length})</h3>
      <ul className="wu-chat-members">
        {members.map(member => <li key={member.name}><Portrait name={member.name} small /><span><strong>{member.name}</strong><small>{member.role}</small></span></li>)}
      </ul>
    </section>}
    {(section === 'Details' || section === 'Files') && <section>
      <div className="wu-chat-section-head"><h3>Shared files ({attachments.length})</h3>{section === 'Details' && attachments.length > 3 && <button type="button" className="wu-text-button" onClick={() => setSection('Files')}>View all</button>}</div>
      {attachments.length ? attachments.slice(0, section === 'Details' ? 3 : undefined).map(file => <AttachmentCard key={file.id} file={file} onClick={openFiles} />) : <p>No files shared yet.</p>}
    </section>}
    {section === 'Links' && <section><h3>Shared links</h3>
      {links.length ? <ul className="wu-chat-links">{links.map(link => <li key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ul> : <p>No links shared yet.</p>}
    </section>}
  </>;

  return <>
    <div className={`wu-chat-layout${showList ? ' is-list-open' : ''}${detailsCollapsed ? ' is-details-collapsed' : ''}`}>
      <Panel className="wu-conversation-panel">
        <div className="wu-chat-search-row">
          <button type="button" className="wu-icon-button wu-chat-list-close" aria-label="Hide conversations" title="Hide conversations" onClick={() => setShowList(false)}><ArrowLeft size={19} /></button>
          <label className="wu-chat-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={event => setQuery(event.target.value)} /></label>
        </div>
        <div className="wu-chat-tabs" role="group" aria-label="Filter conversations">
          {filters.map(item => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>
            {item}{item === 'Unread' && !!unreadCount && <span>{unreadCount}</span>}{item === 'Mentions' && !!mentionCount && <span>{mentionCount}</span>}
          </button>)}
        </div>
        <div className="wu-chat-conversations" aria-label="Conversations" tabIndex={0}>
          {visibleThreads.map(item => {
            const latest = item.messages.at(-1);
            return <button type="button" key={item.id} className="wu-conversation" aria-current={item.id === thread.id ? 'true' : undefined} onClick={() => selectThread(item.id)}>
              {item.member ? <Portrait name={item.member} /> : <IconTile><Users size={18} /></IconTile>}
              <span className="wu-conversation-copy"><strong>{item.title}</strong><small>{latest ? (latest.own ? 'You: ' : !item.member ? latest.author.split(' ')[0] + ': ' : '') + (latest.text || latest.attachment?.name || '') : 'No messages yet'}</small></span>
              <span className="wu-conversation-meta">{latest && <time dateTime={latest.sentAt}>{clock.format(new Date(latest.sentAt))}</time>}{!!item.unread && <span className="wu-chat-unread" aria-label={item.unread + ' unread'}>{item.unread}</span>}</span>
            </button>;
          })}
          {!visibleThreads.length && <p className="wu-chat-empty">{search ? 'No conversations match your search.' : 'No ' + filter.toLowerCase() + ' conversations.'}</p>}
        </div>
        <footer className="wu-chat-list-footer">
          <button className="wu-button wu-button--primary" type="button" onClick={() => setDrawer('new')}><SquarePen size={17} />New message</button>
        </footer>
      </Panel>

      <Panel className="wu-chat-thread">
        <header className="wu-chat-thread-head">
          <button type="button" className="wu-icon-button wu-chat-back" aria-label="Show conversations" onClick={() => setShowList(true)}><PanelLeftOpen size={19} /></button>
          {thread.member ? <Portrait name={thread.member} /> : <IconTile><Users size={18} /></IconTile>}
          <div className="wu-chat-heading"><h2>{thread.title}</h2><p>{thread.member ? 'Direct message' : members.length + ' members · General discussion'}</p></div>
          <button type="button" className="wu-icon-button" aria-label="Voice call" title="Voice call" onClick={() => setCallNotice('Voice')}><Phone size={18} /></button>
          <button type="button" className="wu-icon-button" aria-label="Video call" title="Video call" onClick={() => setCallNotice('Video')}><Video size={19} /></button>
          <button type="button" className="wu-button wu-button--secondary wu-chat-details-toggle"
            aria-controls="chat-details" aria-expanded={!detailsCollapsed} onClick={() => setDetailsCollapsed(value => !value)}>
            {detailsCollapsed ? <PanelRightOpen size={17} aria-hidden="true" /> : <PanelRightClose size={17} aria-hidden="true" />}
            {detailsCollapsed ? 'Show details' : 'Hide details'}
          </button>
          <button type="button" className="wu-icon-button wu-chat-info" aria-label="Show conversation details" title="Show conversation details" onClick={() => setDrawer('details')}><Info size={19} /></button>
        </header>
        {callNotice && <div className="wu-chat-call-notice"><span role="status">{callNotice} calling is unavailable in this workspace.</span>
          <button type="button" className="wu-icon-button" aria-label="Dismiss calling notice" onClick={() => setCallNotice(undefined)}><X size={16} /></button>
        </div>}
        <div ref={messageList} className="wu-messages" role="log" aria-label={thread.title + ' messages'} tabIndex={0}>
          {!thread.messages.length && <p className="wu-chat-empty">Start the conversation with {thread.title}.</p>}
          {thread.messages.map((message, index) => {
            const date = new Date(message.sentAt);
            const newDay = index === 0 || date.toDateString() !== new Date(thread.messages[index - 1].sentAt).toDateString();
            return <div key={message.id}>
              {newDay && <div className="wu-chat-date"><span>{dayLabel(date)}</span></div>}
              <article className={`wu-message${message.own ? ' is-own' : ''}`}>
                <Portrait name={message.own ? profileName : message.author} small />
                <div className="wu-message-content">
                  <div className="wu-message-meta"><strong>{message.own ? 'You' : message.author}</strong><time dateTime={message.sentAt}>{clock.format(date)}</time></div>
                  <div className="wu-message-bubble">
                    {message.text && <p>{message.text}</p>}
                    {message.attachment && <AttachmentCard file={message.attachment} onClick={openFiles} />}
                  </div>
                  {!message.own && <button type="button" className="wu-chat-reaction" aria-label="Like message" aria-pressed={!!message.liked}
                    onClick={() => updateMessages(messages => messages.map(item => item.id === message.id ? { ...item, liked: !item.liked } : item))}>
                    <ThumbsUp size={12} />{(message.likes ?? 0) + Number(!!message.liked) || null}
                  </button>}
                </div>
              </article>
            </div>;
          })}
        </div>
        <form className="wu-message-form" onSubmit={submitMessage}>
          {draft.attachment && <div className="wu-chat-draft-file"><FileText size={15} /><span>{draft.attachment.name}</span><button type="button" className="wu-icon-button" aria-label="Remove attachment" onClick={() => setDrafts(current => ({ ...current, [thread.id]: { text: draft.text } }))}><X size={15} /></button></div>}
          <div className="wu-chat-composer">
            <button type="button" className="wu-icon-button" aria-label="Attach a workspace file" title="Attach a workspace file" onClick={() => setDrawer('files')}><Paperclip size={19} /></button>
            <textarea ref={composer} rows={1} aria-label="Message" placeholder={`Message ${thread.title}…`} value={draft.text}
              onChange={event => setDrafts(current => ({ ...current, [thread.id]: { ...draft, text: event.target.value } }))}
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <button type="submit" className="wu-button wu-button--primary wu-chat-square" aria-label="Send message" title="Send message" disabled={!draft.text.trim() && !draft.attachment}><ArrowUp size={20} /></button>
          </div>
        </form>
      </Panel>
      <section className="wu-panel wu-chat-details" id="chat-details" aria-label="Conversation details">{details}</section>
    </div>
    {drawer && <Drawer title={drawer === 'details' ? 'Conversation details' : drawer === 'files' ? 'Attach a workspace file' : 'New message'} onClose={() => setDrawer(undefined)}>
      {drawer === 'details' && <div className="wu-chat-details-body">{details}</div>}
      {drawer === 'new' && <div className="wu-chat-picker">{teammates.map(person => <button key={person.name} className="wu-conversation" type="button" onClick={() => startConversation(person.name)}><Portrait name={person.name} /><span className="wu-conversation-copy"><strong>{person.name}</strong><small>{person.role}</small></span><ChevronRight size={16} /></button>)}</div>}
      {drawer === 'files' && <div className="wu-chat-picker">
        {files?.length ? files.map(file => <AttachmentCard key={file.id} file={{ id: file.id, name: file.displayName, detail: fileSize(file.sizeBytes) }} action="Attach" onClick={() => {
          setDrafts(current => ({ ...current, [thread.id]: { ...draft, attachment: { id: file.id, name: file.displayName, detail: fileSize(file.sizeBytes) } } }));
          setDrawer(undefined);
        }} />) : <p className="wu-chat-empty">No workspace files available to attach.</p>}
      </div>}
    </Drawer>}
  </>;
}
