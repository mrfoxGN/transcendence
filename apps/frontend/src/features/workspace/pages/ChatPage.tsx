import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Paperclip, Reply, ArrowLeft, ArrowUp, ChevronRight, Info, PanelLeftOpen, PanelRightClose, PanelRightOpen, Phone, Search, SquarePen, Video, X } from 'lucide-react';
import { workspaceIcons } from '../workspace-icons';
import { Avatar, IconTile, Panel } from '../components';
import { Drawer } from '../WorkspaceControls';
import type { Member } from '../workspace-tasks';
import type { ServerMessage, useWorkspaceChat } from '../workspace-chat';
import './chat.css';

type Draft = { text: string; requestId?: string; reply?: { id: string; preview: string } };

type ChatPageProps = {
  workspaceId: string;
  chat: ReturnType<typeof useWorkspaceChat>;
  selected: string;
  setSelected: (id: string) => void;
  profileId: string;
  profileName: string;
  roster: Member[];
  workspaceArchived?: boolean;
};

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const calendar = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const filters = ['All', 'Unread'] as const;
const sections = ['Details', 'Members', 'Links'] as const;

function dayLabel(date: Date) {
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  today.setDate(today.getDate() - 1);
  return date.toDateString() === today.toDateString() ? 'Yesterday' : calendar.format(date);
}

function Portrait({ name, small }: { name: string; small?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <Avatar initials={initials} tone="mint" small={small} preview={false} />;
}

export function ChatPage({ workspaceId, chat, selected, setSelected, profileId, profileName, roster, workspaceArchived = false }: ChatPageProps) {
  const [sending, setSending] = useState(false);
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({});
  const [conversationError, setConversationError] = useState('');
  const view = useRef<{ thread: string; atLatest: boolean; anchor?: { id: string; offset: number } } | undefined>(undefined);
  const [showJump, setShowJump] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedTerm, setSearchedTerm] = useState('');
  const [results, setResults] = useState<ServerMessage[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const searchRequest = useRef<AbortController | undefined>(undefined);
  const [attachments, setAttachments] = useState<Record<string, File | undefined>>({});
  const [attachmentError, setAttachmentError] = useState('');
  const [copiedAttachment, setCopiedAttachment] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => searchRequest.current?.abort(), [selected]);
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const [section, setSection] = useState<(typeof sections)[number]>('Details');
  const draftKey = `devup:chat-drafts:${profileId}:${workspaceId}`;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    try { return JSON.parse(sessionStorage.getItem(draftKey) ?? '{}') ?? {}; }
    catch { return {}; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(draftKey, JSON.stringify(drafts)); }
    catch { /* Drafts remain available while this view is open. */ }
  }, [draftKey, drafts]);
  const [drawer, setDrawer] = useState<'details' | 'new'>();
  const [showList, setShowList] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [callNotice, setCallNotice] = useState<'Voice' | 'Video'>();
  const messageList = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const teammateName = (id: string | null) => roster.find(member => member.userId === id)?.username
    ?? chat.conversations.find(item => item.otherUserId === id)?.otherUsername ?? 'DevUP member';
  const threads = [{ id: 'team', title: 'DevUP Team', member: undefined, lastMessageAt: null, unreadCount: chat.workspaceUnread },
    ...chat.conversations.map(item => ({ ...item, title: teammateName(item.otherUserId), member: teammateName(item.otherUserId) }))].map(item => ({
      ...item, unread: item.id === selected ? 0 : item.unreadCount ?? 0,
      messages: (chat.messages[item.id] ?? []).map(message => ({
        id: message.id, text: message.content, sentAt: message.createdAt,
        reply: message.reply, attachmentName: message.attachmentName,
        own: message.senderId === profileId, author: teammateName(message.senderId),
      })),
    }));
  const thread = threads.find(item => item.id === selected) ?? { id: selected, title: 'Direct message', member: 'DevUP member', unread: 0, messages: [] };
  const readOnly = workspaceArchived && thread.id === 'team';
  const draft = drafts[thread.id] ?? { text: '' };
  const sendError = sendErrors[thread.id];
  const file = attachments[thread.id];
  const canSend = !!(draft.text.trim() || file);
  const teammates = roster.filter(member => member.userId !== profileId);
  const direct = chat.conversations.find(item => item.id === thread.id);
  const members = [{ id: profileId, name: profileName, role: 'You' },
    ...teammates.filter(person => !thread.member || person.userId === direct?.otherUserId)
      .map(person => ({ id: person.userId, name: person.username, role: person.isOwner ? 'Workspace owner' : 'Member' }))];
  const links = [...new Set(thread.messages.flatMap(message => message.text.match(/https?:\/\/[^\s<>"']+/g) ?? []))];
  const unreadCount = threads.filter(item => item.unread > 0).length;
  const search = query.trim().toLowerCase();
  const visibleThreads = threads.filter(item =>
    (filter !== 'Unread' || item.unread > 0) &&
    (!search || item.title.toLowerCase().includes(search) || item.messages.some(message => message.text.toLowerCase().includes(search)))
  );

  function recordPosition() {
    const list = messageList.current;
    if (!list) return;
    const top = list.getBoundingClientRect().top;
    const atLatest = list.scrollHeight - list.clientHeight - list.scrollTop < 40;
    const firstVisible = atLatest ? undefined : Array.from(list.querySelectorAll<HTMLElement>('[data-message-id]'))
      .find(row => row.getBoundingClientRect().bottom > top);
    view.current = {
      thread: thread.id, atLatest,
      anchor: firstVisible?.dataset.messageId ? {
        id: firstVisible.dataset.messageId, offset: firstVisible.getBoundingClientRect().top - top,
      } : undefined,
    };
    setShowJump(!atLatest);
  }

  useLayoutEffect(() => {
    const list = messageList.current;
    if (!list) return;
    const previous = view.current;
    if (!previous || previous.thread !== thread.id || previous.atLatest) {
      list.scrollTop = list.scrollHeight;
    } else if (previous.anchor) {
      const row = list.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(previous.anchor.id)}"]`);
      if (row) list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top - previous.anchor.offset;
    }
    recordPosition();
  });

  useEffect(() => {
    const input = composer.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }, [draft.text, thread.id]);

  async function searchHistory(page = 1) {
    const term = page === 1 ? searchTerm.trim() : searchedTerm;
    if (!term) return;
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearching(true);
    setSearchError('');
    if (page === 1) {
      setResults([]);
      setSearchPage(0);
      setHasMoreResults(false);
      setSearchedTerm(term);
    }
    try {
      const matches = await chat.search(thread.id, term, page, controller.signal);
      if (controller.signal.aborted) return;
      setResults(current => page === 1 ? matches : [...new Map([...current, ...matches].map(item => [item.id, item])).values()]);
      setSearchPage(page);
      setHasMoreResults(matches.length === 25);
    } catch {
      if (!controller.signal.aborted) setSearchError('Could not search this conversation. Try again.');
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  async function download(messageId: string, name: string) {
    setAttachmentError('');
    try {
      const blob = await chat.downloadAttachment(thread.id, messageId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setAttachmentError('Could not download this attachment.');
    }
  }

  async function copyAttachmentLink(messageId: string) {
    const url = new URL(location.href);
    url.searchParams.set('page', 'chat');
    url.searchParams.set('attachment', messageId);
    url.hash = thread.id === 'team' ? '' : 'dm-' + thread.id;
    try { await navigator.clipboard.writeText(url.href); setCopiedAttachment(messageId); }
    catch { setAttachmentError('Could not copy the attachment link.'); }
  }

  function selectThread(id: string) {
    searchRequest.current?.abort();
    setSearching(false);
    setSearchOpen(false);
    setResults([]);
    setSearchTerm('');
    setSearchedTerm('');
    setSearchPage(0);
    setHasMoreResults(false);
    setSearchError('');
    setAttachmentError('');
    setSelected(id);
    setCallNotice(undefined);
    setSection('Details');
    setShowList(false);
    const url = new URL(location.href);
    url.searchParams.delete('attachment');
    url.hash = id === 'team' ? '' : 'dm-' + id;
    history.replaceState(history.state, '', url);
  }

  async function startConversation(userId: string) {
    if (sending) return;
    setSending(true);
    setConversationError('');
    try {
      const id = await chat.openConversation(userId);
      setFilter('All');
      setQuery('');
      selectThread(id);
      setDrawer(undefined);
    } catch (error) {
      setConversationError(error instanceof Error ? error.message : 'Could not open the conversation.');
    } finally {
      setSending(false);
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.text.trim();
    if (!canSend || sending) return;
    setSending(true);
    setSendErrors(current => ({ ...current, [thread.id]: '' }));
    try {
      const requestId = draft.requestId ?? crypto.randomUUID();
      setDrafts(current => ({ ...current, [thread.id]: { ...draft, requestId } }));
      await chat.send(thread.id, body, requestId, draft.reply?.id, file);
      setAttachments(current => ({ ...current, [thread.id]: undefined }));
      setDrafts(current => current[thread.id]?.requestId === requestId ? { ...current, [thread.id]: { text: '' } } : current);
      composer.current?.focus();
    } catch (error) {
      setSendErrors(current => ({ ...current, [thread.id]: error instanceof Error ? error.message : 'Could not send the message.' }));
    } finally {
      setSending(false);
    }
  }

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
        {members.map(member => <li key={member.id}><Portrait name={member.name} small /><span><strong>{member.name}</strong><small>{member.role}</small></span></li>)}
      </ul>
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
            {item}{item === 'Unread' && !!unreadCount && <span>{unreadCount}</span>}
          </button>)}
        </div>
        <div className="wu-chat-conversations" aria-label="Conversations" tabIndex={0}>
          {visibleThreads.map(item => {
            const latest = item.messages.at(-1);
            return <button type="button" key={item.id} className="wu-conversation" aria-current={item.id === thread.id ? 'true' : undefined} onClick={() => selectThread(item.id)}>
              {item.member ? <Portrait name={item.member} /> : <IconTile><workspaceIcons.team size={18} /></IconTile>}
              <span className="wu-conversation-copy"><strong>{item.title}</strong><small>{latest ? (latest.own ? 'You: ' : !item.member ? latest.author.split(' ')[0] + ': ' : '') + latest.text : item.lastMessageAt ? 'Open conversation' : 'No messages yet'}</small></span>
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
          {thread.member ? <Portrait name={thread.member} /> : <IconTile><workspaceIcons.team size={18} /></IconTile>}
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
        {attachmentError && <p role="alert">{attachmentError}</p>}
        {new URLSearchParams(location.search).get('attachment') && <button type="button" className="wu-text-button"
          onClick={() => void download(new URLSearchParams(location.search).get('attachment')!, 'Attachment')}>Download linked attachment</button>}
        <div className="wu-chat-tools"><button className="wu-text-button" type="button" aria-expanded={searchOpen}
          onClick={() => setSearchOpen(value => !value)}><Search size={15} /> Search messages</button></div>
        {searchOpen && <section className="wu-chat-search-results" aria-label="Search conversation">
          <form onSubmit={event => { event.preventDefault(); void searchHistory(); }}>
            <input type="search" aria-label="Search this conversation" placeholder="Search this conversation…" value={searchTerm} maxLength={200}
              onChange={event => setSearchTerm(event.target.value)} />
            <button className="wu-text-button" type="submit" disabled={searching || !searchTerm.trim()}>Search</button>
          </form>
          {searching && <p role="status">Searching…</p>}
          {searchError && <p role="alert">{searchError}</p>}
          {!searching && searchPage > 0 && !results.length && <p>No matching messages.</p>}
          {results.map(message => <article key={message.id}>
            <strong>{message.senderId === profileId ? 'You' : teammateName(message.senderId)}</strong>{' '}
            <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
            {message.reply && <blockquote>{message.reply.preview}</blockquote>}
            {message.content && <p>{message.content}</p>}
            {message.attachmentName && <button className="wu-text-button" type="button"
              onClick={() => void download(message.id, message.attachmentName!)}>{message.attachmentName}</button>}
            {!readOnly && <button className="wu-text-button" type="button" disabled={sending}
              onClick={() => { setDrafts(current => ({ ...current, [thread.id]: { ...draft, requestId: undefined, reply: { id: message.id, preview: message.content || message.attachmentName || 'Attachment' } } })); composer.current?.focus(); }}>Reply</button>}
          </article>)}
          {hasMoreResults && <button className="wu-text-button" type="button" disabled={searching} onClick={() => void searchHistory(searchPage + 1)}>More results</button>}
        </section>}
        {chat.connection !== 'connected' && <div className="wu-chat-connection">
          <span role="status">{chat.connection === 'connecting' ? 'Connecting to chat…' : 'Reconnecting to chat…'}</span>
          {chat.connection === 'reconnecting' && <button className="wu-text-button" type="button" onClick={chat.reconnect}>Retry connection</button>}
        </div>}
        <div ref={messageList} onScroll={recordPosition} className="wu-messages" role="log" aria-label={thread.title + ' messages'} tabIndex={0}>
          {chat.error && <p role="alert">{chat.error} <button className="wu-text-button" type="button" onClick={chat.retry}>Try again</button></p>}
          {chat.hasOlder && <button className="wu-text-button" type="button" disabled={chat.loading || chat.loadingOlder} onClick={() => void chat.loadOlder()}>{chat.loadingOlder ? 'Loading older messages…' : 'Load older messages'}</button>}
          {chat.loading && <p role="status">Loading messages…</p>}
          {!chat.loading && !chat.error && !thread.messages.length && <p className="wu-chat-empty">{readOnly ? 'No messages in this conversation.' : 'Start the conversation with ' + thread.title + '.'}</p>}
          {thread.messages.map((message, index) => {
            const date = new Date(message.sentAt);
            const newDay = index === 0 || date.toDateString() !== new Date(thread.messages[index - 1].sentAt).toDateString();
            return <div key={message.id} data-message-id={message.id}>
              {newDay && <div className="wu-chat-date"><span>{dayLabel(date)}</span></div>}
              <article className={`wu-message${message.own ? ' is-own' : ''}`}>
                <Portrait name={message.own ? profileName : message.author} small />
                <div className="wu-message-content">
                  <div className="wu-message-meta"><strong>{message.own ? 'You' : message.author}</strong><time dateTime={message.sentAt}>{clock.format(date)}</time></div>
                  <div className="wu-message-bubble">
                    {message.reply && <blockquote className="wu-chat-quote"><strong>{message.reply.unavailable ? 'Original message' : message.reply.senderId === profileId ? 'You' : teammateName(message.reply.senderId)}</strong><p>{message.reply.preview}</p></blockquote>}
                    {message.text && <p>{message.text}</p>}
                    {message.attachmentName && <div className="wu-chat-attachment"><button className="wu-text-button" type="button" onClick={() => void download(message.id, message.attachmentName!)}><Paperclip size={15} /> {message.attachmentName}</button><button className="wu-text-button" type="button" onClick={() => void copyAttachmentLink(message.id)}>{copiedAttachment === message.id ? 'Link copied' : 'Copy link'}</button></div>}
                  </div>
                  {!readOnly && <button className="wu-text-button wu-chat-reply" type="button" disabled={sending} onClick={() => {
                    setDrafts(current => ({ ...current, [thread.id]: { ...draft, requestId: undefined, reply: { id: message.id, preview: message.text || message.attachmentName || 'Attachment' } } }));
                    composer.current?.focus();
                  }}><Reply size={14} /> Reply</button>}
                </div>
              </article>
            </div>;
          })}
        </div>
        {showJump && <button className="wu-text-button wu-chat-jump" type="button" onClick={() => {
          if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight;
          recordPosition();
        }}>Jump to latest</button>}
        {readOnly ? <p className="wu-chat-archive-note">Team chat is read-only while this workspace is archived.</p> : <form className="wu-message-form" onSubmit={submitMessage}>
          {sendError && <p role="alert">{sendError} <button className="wu-text-button" type="submit" disabled={sending || !canSend}>Retry send</button></p>}
          {draft.reply && <div className="wu-chat-draft-chip"><span>Replying to {draft.reply.preview}</span><button className="wu-icon-button" type="button" aria-label="Remove reply" disabled={sending} onClick={() => setDrafts(current => ({ ...current, [thread.id]: { text: draft.text } }))}><X size={16} /></button></div>}
          {file && <div className="wu-chat-draft-chip"><span>{file.name}</span><button className="wu-icon-button" type="button" aria-label="Remove attachment" disabled={sending} onClick={() => {
            setAttachments(current => ({ ...current, [thread.id]: undefined }));
            setDrafts(current => ({ ...current, [thread.id]: { ...draft, requestId: undefined } }));
          }}><X size={16} /></button></div>}
          <div className="wu-chat-composer">
            <input ref={fileInput} type="file" hidden onChange={event => {
              const attachment = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!attachment) return;
              if (!attachment.size || attachment.size > 5 * 1024 * 1024) { setAttachmentError('Choose a file between 1 byte and 5 MB.'); return; }
              setAttachmentError('');
              setAttachments(current => ({ ...current, [thread.id]: attachment }));
              setDrafts(current => ({ ...current, [thread.id]: { ...draft, requestId: undefined } }));
            }} />
            <button className="wu-icon-button" type="button" aria-label="Attach file" disabled={sending} onClick={() => fileInput.current?.click()}><Paperclip size={19} /></button>
            <textarea ref={composer} rows={1} aria-label="Message" placeholder={thread.id === 'team' ? 'Message the team or mention @username…' : `Message ${thread.title}…`} value={draft.text} disabled={sending}
              onChange={event => setDrafts(current => ({ ...current, [thread.id]: { text: event.target.value, reply: draft.reply } }))}
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <button type="submit" className="wu-button wu-button--primary wu-chat-square" aria-label="Send message" title="Send message" disabled={sending || !canSend}><ArrowUp size={20} /></button>
          </div>
        </form>}
      </Panel>
      <section className="wu-panel wu-chat-details" id="chat-details" aria-label="Conversation details">{details}</section>
    </div>
    {drawer && <Drawer title={drawer === 'details' ? 'Conversation details' : 'New message'} onClose={() => setDrawer(undefined)}>
      {drawer === 'details' && <div className="wu-chat-details-body">{details}</div>}
      {drawer === 'new' && <div className="wu-chat-picker">
        {conversationError && <p role="alert">{conversationError}</p>}
        {!teammates.length && <p className="wu-chat-empty">No other workspace members yet.</p>}
        {teammates.map(person => <button key={person.userId} className="wu-conversation" type="button" disabled={sending} onClick={() => void startConversation(person.userId)}>
          <Portrait name={person.username} /><span className="wu-conversation-copy"><strong>{person.username}</strong></span><ChevronRight size={16} />
        </button>)}
      </div>}
    </Drawer>}
  </>;
}
