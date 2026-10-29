import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../lib/api-client';
import { SOCKET_EVENTS } from '@retrospace/shared';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

interface UseRetroSocketOptions {
  retrospectiveId?: string;
  onCardCreated?: (card: any) => void;
  onCardUpdated?: (card: any) => void;
  onCardMoved?: (data: { id: string; columnId: string; position: number }) => void;
  onCardDeleted?: (data: { id: string }) => void;
  onVoteUpdated?: (data: { feedbackCardId: string; voteCount: number }) => void;
  onCommentAdded?: (comment: any) => void;
  onStatusChanged?: (data: { status: any }) => void;
  onUserJoined?: (data: { userId: string; name: string }) => void;
  onUserLeft?: (data: { userId: string }) => void;
}

export function useRetroSocket({
  retrospectiveId,
  onCardCreated,
  onCardUpdated,
  onCardMoved,
  onCardDeleted,
  onVoteUpdated,
  onCommentAdded,
  onStatusChanged,
  onUserJoined,
  onUserLeft,
}: UseRetroSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!retrospectiveId) return;

    const token = getAccessToken();
    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Join authorized retrospective room
      socket.emit(SOCKET_EVENTS.JOIN_RETRO, { retrospectiveId });
    });

    if (onCardCreated) socket.on(SOCKET_EVENTS.CARD_CREATED, onCardCreated);
    if (onCardUpdated) socket.on(SOCKET_EVENTS.CARD_UPDATED, onCardUpdated);
    if (onCardMoved) socket.on(SOCKET_EVENTS.CARD_MOVED, onCardMoved);
    if (onCardDeleted) socket.on(SOCKET_EVENTS.CARD_DELETED, onCardDeleted);
    if (onVoteUpdated) socket.on(SOCKET_EVENTS.VOTE_UPDATED, onVoteUpdated);
    if (onCommentAdded) socket.on(SOCKET_EVENTS.COMMENT_ADDED, onCommentAdded);
    if (onStatusChanged) socket.on(SOCKET_EVENTS.STATUS_CHANGED, onStatusChanged);
    if (onUserJoined) socket.on(SOCKET_EVENTS.USER_JOINED, onUserJoined);
    if (onUserLeft) socket.on(SOCKET_EVENTS.USER_LEFT, onUserLeft);

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_RETRO, { retrospectiveId });
      socket.disconnect();
    };
  }, [retrospectiveId]);

  return socketRef;
}

