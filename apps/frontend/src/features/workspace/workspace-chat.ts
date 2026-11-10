import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { jsonRequest, workspaceRequest } from './workspace-api';

type Conversation = { id: string; otherUserId: string; lastMessageAt: string | null; otherUsername?: string; unreadCount?: number };
export type ServerMessage = { id: string; senderId: string | null; content: string; createdAt: string; workspaceId?: string; conversationId?: string };
const pageSize = 30;

export function useWorkspaceChat(workspaceId: string, token: string, selected: string, profileId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ServerMessage[]>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [nextPage, setNextPage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const activeThread = useRef(selected);
  activeThread.current = selected;
  const path = (id: string) => id === 'team' ? 'workspaces/' + workspaceId + '/messages' : 'direct-conversations/' + id + '/messages';

  function merge(id: string, incoming: ServerMessage[]) {
    setMessages(current => {
      const byId = new Map((current[id] ?? []).map(message => [message.id, message]));
      for (const message of incoming) byId.set(message.id, message);
      return { ...current, [id]: [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) };
    });
  }

  async function refreshConversations(signal?: AbortSignal) {
    const result: Conversation[] = await (await workspaceRequest('direct-conversations?limit=100', token, { signal })).json();
    if (!signal?.aborted) setConversations(result);
  }

  function markRead(id: string) {
    setUnread(current => ({ ...current, [id]: 0 }));
    if (id !== 'team') void workspaceRequest('direct-conversations/' + id + '/read', token, { method: 'PATCH' })
      .then(() => setConversations(current => current.map(item => item.id === id ? { ...item, unreadCount: 0 } : item)))
      .catch(() => {});
  }

  useEffect(() => {
    const controller = new AbortController();
    void refreshConversations(controller.signal).catch(() => { if (!controller.signal.aborted) setError('Could not load direct conversations.'); });
    return () => controller.abort();
  }, [token, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void workspaceRequest(path(selected) + '?limit=' + pageSize, token, { signal: controller.signal })
      .then(response => response.json() as Promise<ServerMessage[]>)
      .then(items => {
        if (controller.signal.aborted) return;
        merge(selected, items);
        setNextPage(current => ({ ...current, [selected]: items.length === pageSize ? 2 : 0 }));
        markRead(selected);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load messages.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [workspaceId, token, selected, attempt]);

  useEffect(() => {
    if (!profileId) return;
    const controller = new AbortController();
    const socket = io({ auth: { token } });
    function incoming(id: string, message: ServerMessage) {
      merge(id, [message]);
      if (message.senderId !== profileId) {
        if (activeThread.current === id) markRead(id);
        else setUnread(current => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
      }
    }
    socket.on('workspace-chat.ready', () => {
      socket.emit('workspace-chat.join', workspaceId);
      setAttempt(value => value + 1);
    });
    socket.on('workspace-message.created', (message: ServerMessage) => {
      if (message.workspaceId === workspaceId) incoming('team', message);
    });
    socket.on('direct-message.created', (message: ServerMessage) => {
      if (!message.conversationId) return;
      incoming(message.conversationId, message);
      void refreshConversations(controller.signal).catch(() => {});
    });
    return () => { controller.abort(); socket.disconnect(); };
  }, [workspaceId, token, profileId]);

  async function openConversation(userId: string) {
    const result: Conversation = await (await workspaceRequest('direct-conversations/' + userId, token, { method: 'POST' })).json();
    setConversations(current => [{ ...current.find(item => item.id === result.id), ...result }, ...current.filter(item => item.id !== result.id)]);
    return result.id;
  }

  async function send(id: string, content: string) {
    const message: ServerMessage = await (await workspaceRequest(path(id), token, jsonRequest('POST', { content }))).json();
    merge(id, [message]);
  }

  async function loadOlder() {
    const page = nextPage[selected];
    if (!page || loading) return;
    setLoading(true);
    setError('');
    try {
      const items: ServerMessage[] = await (await workspaceRequest(path(selected) + '?limit=' + pageSize + '&page=' + page, token)).json();
      merge(selected, items);
      setNextPage(current => ({ ...current, [selected]: items.length === pageSize ? page + 1 : 0 }));
    } catch {
      setError('Could not load older messages.');
    } finally {
      if (activeThread.current === selected) setLoading(false);
    }
  }

  return { conversations, messages, unread, loading, error, hasOlder: !!nextPage[selected], openConversation, send, loadOlder,
    retry: () => { setError(''); setAttempt(value => value + 1); } };
}
