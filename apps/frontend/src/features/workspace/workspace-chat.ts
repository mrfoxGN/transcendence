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
  const [olderCursor, setOlderCursor] = useState<Record<string, string | undefined>>({});
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const historyFrontier = useRef<Record<string, string | undefined>>({});
  const olderRequest = useRef<AbortController | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
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
    setError('');
    async function catchUp(id: string) {
      let cursor = historyFrontier.current[id];
      const isInitial = !cursor;
      do {
        const suffix = cursor ? '&after=' + encodeURIComponent(cursor) : '';
        const items: ServerMessage[] = await (await workspaceRequest(path(id) + '?limit=' + pageSize + suffix, token, {
          signal: controller.signal,
        })).json();
        if (controller.signal.aborted) return;
        merge(id, items);
        if (isInitial) {
          setOlderCursor(current => ({ ...current, [id]: items.length === pageSize ? items[0].id : undefined }));
        }
        const latest = items.at(-1);
        if (latest) {
          cursor = latest.id;
          historyFrontier.current[id] = cursor;
        }
        if (isInitial || items.length < pageSize) break;
      } while (!controller.signal.aborted);
      if (cursor) markRead(id, cursor);
    }
    void catchUp(selected)
      .catch(() => { if (!controller.signal.aborted) setError('Could not load messages.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [workspaceId, token, selected, attempt]);

  useEffect(() => {
    if (!token || !profileId) return;
    setConnection('connecting');
    const socket = io({ auth: { token } });
    const poll = () => { if (activeThread.current && document.visibilityState === 'visible') setAttempt(value => value + 1); };
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
      refreshUnread();
      if (activeThread.current) joinAndSync(socket);
      else setConnection('connected');
    });
    function reconnecting() {
      socketReady.current = false;
      setConnection('reconnecting');
    }
    socket.on('disconnect', reconnecting);
    socket.on('connect_error', reconnecting);
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
      poll();
    }, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnReturn);
      window.clearInterval(timer);
      socketRef.current = null;
      socketReady.current = false;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [workspaceId, token, profileId]);

  function joinAndSync(socket: ReturnType<typeof io>) {
    socket.timeout(5_000).emit('workspace-chat.join', workspaceId, (error: Error | null, joined: boolean) => {
      if (socketRef.current !== socket || !socket.connected || !activeThread.current) return;
      setConnection(!error && joined ? 'connected' : 'reconnecting');
      setAttempt(value => value + 1);
    });
  }

  const chatOpen = selected !== null;
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socketReady.current) return;
    if (chatOpen) joinAndSync(socket);
    else socket.emit('workspace-chat.leave', workspaceId);
  }, [chatOpen, workspaceId]);

  async function openConversation(userId: string) {
    const result: Conversation = await (await workspaceRequest('direct-conversations/' + userId, token, { method: 'POST' })).json();
    setConversations(current => [{ ...current.find(item => item.id === result.id), ...result }, ...current.filter(item => item.id !== result.id)]);
    return result.id;
  }

  async function send(id: string, content: string, requestId: string) {
    const message: ServerMessage = await (await workspaceRequest(path(id), token, jsonRequest('POST', { content, requestId }))).json();
    merge(id, [message]);
  }

  useEffect(() => {
    setLoadingOlder(false);
    return () => { olderRequest.current?.abort(); olderRequest.current = null; };
  }, [selected, token, workspaceId]);

  async function loadOlder() {
    if (!selected) return;
    const cursor = olderCursor[selected];
    if (!cursor || loading || olderRequest.current) return;
    const controller = new AbortController();
    olderRequest.current = controller;
    setLoadingOlder(true);
    setError('');
    try {
      const items: ServerMessage[] = await (await workspaceRequest(
        path(selected) + '?limit=' + pageSize + '&before=' + encodeURIComponent(cursor), token, { signal: controller.signal },
      )).json();
      if (controller.signal.aborted) return;
      merge(selected, items);
      setOlderCursor(current => ({ ...current, [selected]: items.length === pageSize ? items[0].id : undefined }));
    } catch {
      if (!controller.signal.aborted) setError('Could not load older messages.');
    } finally {
      if (olderRequest.current === controller) {
        olderRequest.current = null;
        setLoadingOlder(false);
      }
    }
  }

  return { conversations, messages, workspaceUnread, unreadTotal: workspaceUnread + directUnread, loading, loadingOlder, error, connection, hasOlder: !!(selected && olderCursor[selected]), openConversation, send, loadOlder,
    retry: () => { setError(''); setAttempt(value => value + 1); },
    reconnect: () => {
      const socket = socketRef.current;
      if (socket && socketReady.current) joinAndSync(socket);
      else socket?.connect();
    } };
}
