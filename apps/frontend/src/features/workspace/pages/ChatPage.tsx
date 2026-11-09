import { FileText, Plus, Send } from 'lucide-react';
import { Avatar, FilterChips, Panel, Pill } from '../components';
import type { PageHeading, PageKey, Message, FormHandler } from '../types';
import './chat.css';

type ChatPageProps = {
  pageHeading: PageHeading;
  conversation: string;
  setConversation: (name: string) => void;
  profileName: string;
  messages: Message[];
  messageText: string;
  setMessageText: (text: string) => void;
  sendMessage: FormHandler;
  navigate: (page: PageKey) => void;
};

export function ChatPage({
  pageHeading,
  conversation,
  setConversation,
  profileName,
  messages,
  messageText,
  setMessageText,
  sendMessage,
  navigate,
}: ChatPageProps) {
  const isDirect = conversation !== 'DevUP Team';
  const displayMessages = isDirect ? [
    { initials: 'SK', name: 'Sarah Kim', text: 'I can review the login form this afternoon.', time: '10:21', tone: 'neutral' },
    { initials: 'AM', name: profileName, text: 'Thanks. I’ll send the mobile screenshot when it’s ready.', time: '10:28', tone: 'blue' },
  ] : messages;
  return <>{pageHeading(<button className="wu-button wu-button--primary" type="button" onClick={() => setConversation('Maya Rodriguez')}><Plus size={16} />New message</button>)}
    <div className="wu-chat-layout"><Panel className="wu-conversation-panel"><h2>Conversations</h2><FilterChips items={['All', 'Unread', 'Direct']} active={isDirect ? 'Direct' : 'All'} onChange={value => { if (value === 'Direct') setConversation('Sarah Kim'); else setConversation('DevUP Team'); }} />{[['DevUP Team', 'Mobile review update', 'SN'], ['Sarah Kim', 'I can review it this afternoon.', 'SK'], ['Omar Idrissi', 'Sync is ready to test.', 'OI'], ['Maya Rodriguez', 'Shared a file', 'MR']].map(([name, preview, initials]) => <button className={`wu-conversation${conversation === name ? ' is-selected' : ''}`} key={name} type="button" onClick={() => setConversation(name)}><Avatar initials={initials} tone={initials === 'SK' ? 'violet' : initials === 'MR' ? 'pink' : 'blue'} /><span><strong>{name}</strong><small>{preview}</small></span>{name === 'DevUP Team' && <Pill tone="violet">2</Pill>}</button>)}</Panel>
      <Panel className="wu-chat-thread"><div className="wu-chat-thread-head"><div><h2>{conversation}</h2><p>{isDirect ? 'Direct message · Online' : '5 members'}</p></div>{isDirect && <Pill tone="mint">Online</Pill>}</div><div className="wu-chat-date">Today · Apr 12</div><div className="wu-messages">{displayMessages.map((message, index) => <div className="wu-message" key={`${message.name}-${index}`}><Avatar initials={message.initials} tone={message.initials === 'SK' ? 'violet' : message.initials === 'MR' ? 'pink' : 'mint'} small /><div className={`wu-message-bubble wu-message-bubble--${message.tone}`}><div><strong>{message.name}</strong><time>{message.time}</time></div><p>{message.text}</p>{message.text.includes('DEV-12') && <Pill tone="violet">DEV-12</Pill>}</div></div>)}</div><form className="wu-message-form" onSubmit={sendMessage}><FileText size={16} /><input aria-label="Message" placeholder={`Message ${conversation}…`} value={messageText} onChange={event => setMessageText(event.target.value)} /><button className="wu-button wu-button--primary" type="submit"><Send size={15} />Send</button></form></Panel>
      <Panel className="wu-chat-details"><h2>Details</h2><section><h3>Description</h3><p>{isDirect ? 'A private conversation with Sarah Kim.' : 'Project updates, decisions, and questions for the DevUP team.'}</p></section><section><h3>Members</h3><p>{isDirect ? 'Sarah Kim, Alex Morgan' : 'Alex Morgan, Sarah Kim, Omar Idrissi, Maya Rodriguez, Jamie Chen'}</p></section><section><h3>Shared files</h3><button className="wu-text-button" type="button" onClick={() => navigate('files')}>login-mobile.png · 182 KB</button></section></Panel></div>
  </>;
}
