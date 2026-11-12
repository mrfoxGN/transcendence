import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { jsonRequest, workspaceRequest } from './workspace-api';

type Conversation = { id: string; otherUserId: string; lastMessageAt: string | null; otherUsername?: string; unreadCount?: number };
export type ServerMessage = { id: string; senderId: string | null; content: string; createdAt: string; workspaceId?: string; conversationId?: string };
const pageSize = 30;

export function useWorkspaceChat(workspaceId: string, token: string | null, selected: string | null, profileId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ServerMessage[]>>({});
  const [workspaceUnread, setWorkspaceUnread] = useState(0);
  const [directUnread, setDirectUnread] = useState(0);
  const [unreadAttempt, setUnreadAttempt] = useState(0);
  const [nextPage, setNextPage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const activeThread = useRef(selected);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const socketReady = useRef(false);
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

  function refreshUnread() {
    setUnreadAttempt(value => value + 1);
  }

  function markRead(id: string, messageId: string) {
    if (activeThread.current !== id || document.visibilityState !== 'visible') return;
    const readPath = path(id) + '/' + encodeURIComponent(messageId) + '/read';
    void workspaceRequest(id === 'team' ? readPath : 'direct-conversations/' + id + '/read', token, { method: 'PATCH' })
      .finally(refreshUnread)
      .catch(() => {});
  }

  useEffect(() => {
    if (!token || !profileId) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    void workspaceRequest(path('team') + '/unread-count', token, options)
      .then(response => response.json() as Promise<{ count: number }>)
      .then(({ count }) => { if (!controller.signal.aborted) setWorkspaceUnread(count); })
      .catch(() => {});
    void workspaceRequest('direct-conversations/unread-count', token, options)
      .then(response => response.json() as Promise<{ count: number }>)
      .then(({ count }) => { if (!controller.signal.aborted) setDirectUnread(count); })
      .catch(() => {});
    return () => controller.abort();
  }, [workspaceId, token, profileId, unreadAttempt]);

  useEffect(() => {
    if (!token || !selected) return;
    const controller = new AbortController();
    void refreshConversations(controller.signal).catch(() => { if (!controller.signal.aborted) setError('Could not load direct conversations.'); });
    return () => controller.abort();
  }, [token, selected, attempt, unreadAttempt]);

  useEffect(() => {
    if (!token || !selected) return;
    const controller = new AbortController();
    setLoading(true);
    void workspaceRequest(path(selected) + '?limit=' + pageSize, token, { signal: controller.signal })
      .then(response => response.json() as Promise<ServerMessage[]>)
      .then(items => {
        if (controller.signal.aborted) return;
        merge(selected, items);
        setNextPage(current => ({ ...current, [selected]: items.length === pageSize ? 2 : 0 }));
        const latest = items.at(-1);
        if (latest) markRead(selected, latest.id);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load messages.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [workspaceId, token, selected, attempt]);

  useEffect(() => {
    if (!token || !profileId) return;
    const socket = io({ auth: { token } });
    socketRef.current = socket;
    function incoming(id: string, message: ServerMessage) {
      if (activeThread.current) merge(id, [message]);
      if (message.senderId !== profileId && activeThread.current === id && document.visibilityState === 'visible') {
        markRead(id, message.id);
      } else refreshUnread();
    }
    socket.on('workspace-chat.ready', () => {
      socketReady.current = true;
      socket.emit('workspace-chat.watch', workspaceId);
      if (activeThread.current) socket.emit('workspace-chat.join', workspaceId);
      refreshUnread();
      setAttempt(value => value + 1);
    });
    socket.on('disconnect', () => { socketReady.current = false; });
    socket.on('workspace-message.created', (message: ServerMessage) => {
      if (message.workspaceId === workspaceId) incoming('team', message);
    });
    socket.on('direct-message.created', (message: ServerMessage) => {
      if (!message.conversationId) return;
      incoming(message.conversationId, message);
    });
    socket.on('workspace-chat.read', (updatedWorkspaceId: string) => {
      if (updatedWorkspaceId === workspaceId) refreshUnread();
    });
    socket.on('workspace-chat.unread-changed', (updatedWorkspaceId: string) => {
      if (updatedWorkspaceId === workspaceId) refreshUnread();
    });
    socket.on('direct-chat.read', refreshUnread);
    function refreshOnReturn() {
      if (document.visibilityState !== 'visible') return;
      refreshUnread();
      setAttempt(value => value + 1);
    }
    document.addEventListener('visibilitychange', refreshOnReturn);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshUnread();
    }, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnReturn);
      window.clearInterval(timer);
      socketRef.current = null;
      socketReady.current = false;
      socket.disconnect();
    };
  }, [workspaceId, token, profileId]);

  const chatOpen = selected !== null;
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socketReady.current) socket.emit(chatOpen ? 'workspace-chat.join' : 'workspace-chat.leave', workspaceId);
  }, [chatOpen, workspaceId]);

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
    if (!selected) return;
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

  return { conversations, messages, workspaceUnread, unreadTotal: workspaceUnread + directUnread, loading, error, hasOlder: !!(selected && nextPage[selected]), openConversation, send, loadOlder,
    retry: () => { setError(''); setAttempt(value => value + 1); } };
}
