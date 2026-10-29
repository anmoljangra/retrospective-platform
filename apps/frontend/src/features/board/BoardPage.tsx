import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { CardCommentsModal } from './CardCommentsModal';
import { ConvertToActionModal } from './ConvertToActionModal';
import { useRetroSocket } from '../../hooks/useRetroSocket';
import { RetrospectiveStatus, TeamRole, TenantRole } from '@retrospace/shared';
import {
  Columns3,
  ThumbsUp,
  MessageSquare,
  CheckSquare,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  EyeOff,
  ArrowLeft,
  Loader2,
  AlertCircle,
  X,
  Edit2,
} from 'lucide-react';

interface ColumnItem {
  id: string;
  title: string;
  description: string;
  color: string;
  position: number;
}

interface CardItem {
  id: string;
  columnId: string;
  content: string;
  position: number;
  author: { id: string; name: string } | null;
  isAuthor: boolean;
  voteCount: number;
  hasVoted: boolean;
  commentCount: number;
  createdAt: string;
}

interface BoardData {
  retrospective: {
    id: string;
    teamId: string;
    title: string;
    description: string;
    status: RetrospectiveStatus;
    template: string;
    isAnonymous: boolean;
    votingLimit: number;
  };
  columns: ColumnItem[];
  cards: CardItem[];
  voting: {
    limit: number;
    votesCast: number;
    remainingVotes: number;
  };
}

export function BoardPage() {
  const { retrospectiveId } = useParams<{ retrospectiveId: string }>();
  const { activeTenant, user } = useAuth();

  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New card inputs per column: { [columnId]: content }
  const [newCardTexts, setNewCardTexts] = useState<Record<string, string>>({});
  const [addingToCol, setAddingToCol] = useState<string | null>(null);

  // Selected card for comments modal
  const [activeCommentCard, setActiveCommentCard] = useState<CardItem | null>(null);

  // Selected card for action item modal
  const [activeActionCard, setActiveActionCard] = useState<CardItem | null>(null);

  const isOwnerOrAdmin =
    activeTenant?.role === TenantRole.OWNER || activeTenant?.role === TenantRole.ADMIN;

  const loadBoard = async () => {
    if (!activeTenant || !retrospectiveId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient<BoardData>(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/board`
      );
      setBoardData(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load board');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [activeTenant?.tenantId, retrospectiveId]);

  // Real-time live collaboration synchronization
  useRetroSocket({
    retrospectiveId,
    onCardCreated: (newCard) => {
      setBoardData((prev) => {
        if (!prev || prev.cards.some((c) => c.id === newCard.id)) return prev;
        return {
          ...prev,
          cards: [...prev.cards, newCard],
        };
      });
    },
    onCardMoved: (data) => {
      setBoardData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === data.id
              ? { ...c, columnId: data.columnId, position: data.position }
              : c
          ),
        };
      });
    },
    onCardDeleted: (data) => {
      setBoardData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.filter((c) => c.id !== data.id),
        };
      });
    },
    onVoteUpdated: (data) => {
      setBoardData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === data.feedbackCardId
              ? { ...c, voteCount: data.voteCount }
              : c
          ),
        };
      });
    },
    onStatusChanged: (data) => {
      setBoardData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          retrospective: {
            ...prev.retrospective,
            status: data.status,
          },
        };
      });
    },
  });

  // Handle Drag and Drop
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || !boardData || !activeTenant) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Save previous state for rollback
    const previousCards = [...boardData.cards];

    // Optimistically update card position
    const updatedCards = boardData.cards.map((c) => {
      if (c.id === draggableId) {
        return {
          ...c,
          columnId: destination.droppableId,
          position: destination.index,
        };
      }
      return c;
    });

    setBoardData({
      ...boardData,
      cards: updatedCards,
    });

    try {
      await apiClient(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/cards/${draggableId}/move`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            columnId: destination.droppableId,
            position: destination.index,
          }),
        }
      );
    } catch (err: unknown) {
      // Rollback on failure
      setBoardData({
        ...boardData,
        cards: previousCards,
      });
      alert('Failed to save card position. Moving back.');
    }
  };

  // Add Card
  const handleAddCard = async (columnId: string) => {
    const content = (newCardTexts[columnId] || '').trim();
    if (!content || !activeTenant || !retrospectiveId || !boardData) return;

    try {
      const newCard = await apiClient<CardItem>(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/cards`,
        {
          method: 'POST',
          body: JSON.stringify({ columnId, content }),
        }
      );

      setBoardData({
        ...boardData,
        cards: [...boardData.cards, newCard],
      });

      setNewCardTexts({ ...newCardTexts, [columnId]: '' });
      setAddingToCol(null);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to add card');
    }
  };

  // Toggle Vote
  const handleToggleVote = async (cardId: string) => {
    if (!activeTenant || !retrospectiveId || !boardData) return;

    const targetCard = boardData.cards.find((c) => c.id === cardId);
    if (!targetCard) return;

    // Optimistic vote update
    const previousCards = [...boardData.cards];
    const previousVoting = { ...boardData.voting };

    const wasVoted = targetCard.hasVoted;
    const nextVoteCount = wasVoted ? targetCard.voteCount - 1 : targetCard.voteCount + 1;
    const nextVotesCast = wasVoted
      ? boardData.voting.votesCast - 1
      : boardData.voting.votesCast + 1;

    setBoardData({
      ...boardData,
      voting: {
        ...boardData.voting,
        votesCast: nextVotesCast,
        remainingVotes: boardData.voting.limit - nextVotesCast,
      },
      cards: boardData.cards.map((c) =>
        c.id === cardId ? { ...c, hasVoted: !wasVoted, voteCount: nextVoteCount } : c
      ),
    });

    try {
      const res = await apiClient<{
        hasVoted: boolean;
        voteCount: number;
      }>(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/cards/${cardId}/vote`,
        { method: 'POST' }
      );

      // Re-align with server response
      setBoardData((prev) =>
        prev
          ? {
              ...prev,
              cards: prev.cards.map((c) =>
                c.id === cardId
                  ? { ...c, hasVoted: res.hasVoted, voteCount: res.voteCount }
                  : c
              ),
            }
          : null
      );
    } catch (err: unknown) {
      // Rollback on limit reached or failure
      setBoardData({
        ...boardData,
        cards: previousCards,
        voting: previousVoting,
      });
      alert((err as Error).message || 'Voting failed');
    }
  };

  // Delete Card
  const handleDeleteCard = async (cardId: string) => {
    if (!activeTenant || !retrospectiveId || !boardData) return;
    if (!confirm('Are you sure you want to delete this feedback card?')) return;

    try {
      await apiClient(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/cards/${cardId}`,
        { method: 'DELETE' }
      );

      setBoardData({
        ...boardData,
        cards: boardData.cards.filter((c) => c.id !== cardId),
      });
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to delete card');
    }
  };

  // Start Session
  const handleStartSession = async () => {
    if (!activeTenant || !retrospectiveId || !boardData) return;
    try {
      const updated = await apiClient<{ status: RetrospectiveStatus }>(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/start`,
        { method: 'POST' }
      );
      setBoardData({
        ...boardData,
        retrospective: {
          ...boardData.retrospective,
          status: updated.status,
        },
      });
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to start retrospective');
    }
  };

  // Complete Session
  const handleCompleteSession = async () => {
    if (!activeTenant || !retrospectiveId || !boardData) return;
    if (!confirm('Complete this retrospective? No further cards or votes can be added.')) return;

    try {
      const updated = await apiClient<{ status: RetrospectiveStatus }>(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/complete`,
        { method: 'POST' }
      );
      setBoardData({
        ...boardData,
        retrospective: {
          ...boardData.retrospective,
          status: updated.status,
        },
      });
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to complete retrospective');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm">Loading retrospective board...</p>
      </div>
    );
  }

  if (error || !boardData) {
    return (
      <div className="p-8 text-center text-red-400 max-w-md mx-auto">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">{error || 'Board not found'}</p>
        <Link to="/retrospectives" className="text-xs text-indigo-400 hover:underline mt-4 inline-block">
          &larr; Back to Retrospectives
        </Link>
      </div>
    );
  }

  const { retrospective, columns, cards, voting } = boardData;
  const isDraft = retrospective.status === RetrospectiveStatus.DRAFT;
  const isActive = retrospective.status === RetrospectiveStatus.ACTIVE;
  const isCompleted = retrospective.status === RetrospectiveStatus.COMPLETED;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Comments Modal */}
      {activeCommentCard && (
        <CardCommentsModal
          retrospectiveId={retrospective.id}
          cardId={activeCommentCard.id}
          cardContent={activeCommentCard.content}
          isOpen={true}
          onClose={() => setActiveCommentCard(null)}
          onCommentCountChange={(newCount) => {
            setBoardData({
              ...boardData,
              cards: boardData.cards.map((c) =>
                c.id === activeCommentCard.id ? { ...c, commentCount: newCount } : c
              ),
            });
          }}
        />
      )}

      {/* Convert to Action Modal */}
      {activeActionCard && (
        <ConvertToActionModal
          retrospectiveId={retrospective.id}
          cardId={activeActionCard.id}
          initialContent={activeActionCard.content}
          isOpen={true}
          onClose={() => setActiveActionCard(null)}
        />
      )}

      {/* Board Top Header */}
      <div className="border-b border-slate-800 pb-4 mb-4 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <Link to="/retrospectives" className="hover:text-white transition-colors">
              Retrospectives
            </Link>
            <span>/</span>
            <span className="text-white font-medium truncate max-w-xs">{retrospective.title}</span>
          </div>

          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-extrabold text-white tracking-tight">{retrospective.title}</h1>
            <span
              className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                isActive
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : isCompleted
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              <span>{retrospective.status}</span>
            </span>

            {retrospective.isAnonymous && (
              <span className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                <EyeOff className="w-3 h-3 text-slate-400" />
                <span>Anonymous Mode</span>
              </span>
            )}
          </div>
        </div>

        {/* Voting & Controls Bar */}
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          {/* Voting limit pill */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center space-x-2">
            <ThumbsUp className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Votes:</span>
            <span className="font-bold text-white">
              {voting.remainingVotes} / {voting.limit} left
            </span>
          </div>

          {/* Session transitions */}
          {isDraft && (
            <button
              onClick={handleStartSession}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Session</span>
            </button>
          )}

          {isActive && (
            <button
              onClick={handleCompleteSession}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg shadow transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Complete Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board Area */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex gap-5 h-full min-w-max items-start">
            {columns.map((column) => {
              const columnCards = cards
                .filter((c) => c.columnId === column.id)
                .sort((a, b) => a.position - b.position);

              return (
                <div
                  key={column.id}
                  className="w-80 shrink-0 bg-slate-900/70 border border-slate-800/80 rounded-2xl flex flex-col max-h-full shadow-sm"
                >
                  {/* Column Header */}
                  <div className="p-4 border-b border-slate-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: column.color }}
                        />
                        <h2 className="text-sm font-bold text-white">{column.title}</h2>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                        {columnCards.length}
                      </span>
                    </div>
                    {column.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {column.description}
                      </p>
                    )}
                  </div>

                  {/* Cards Droppable Container */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px] transition-colors rounded-b-2xl ${
                          snapshot.isDraggingOver ? 'bg-indigo-950/20' : ''
                        }`}
                      >
                        {columnCards.map((card, index) => (
                          <Draggable
                            key={card.id}
                            draggableId={card.id}
                            index={index}
                            isDragDisabled={isCompleted}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`p-4 rounded-xl border bg-slate-950 text-xs text-slate-100 shadow-md group transition-all ${
                                  dragSnapshot.isDragging
                                    ? 'border-indigo-500 shadow-2xl scale-[1.02]'
                                    : 'border-slate-800/80 hover:border-slate-700'
                                }`}
                              >
                                <p className="whitespace-pre-wrap leading-relaxed mb-3">
                                  {card.content}
                                </p>

                                {/* Card Footer: Author & Action Buttons */}
                                <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="truncate max-w-[100px]">
                                    {card.author ? card.author.name : 'Anonymous'}
                                  </span>

                                  <div className="flex items-center space-x-1.5">
                                    {/* Vote Button */}
                                    <button
                                      onClick={() => handleToggleVote(card.id)}
                                      disabled={!isActive}
                                      title={card.hasVoted ? 'Remove vote' : 'Vote for card'}
                                      className={`inline-flex items-center space-x-1 px-2 py-1 rounded-md font-medium transition-colors ${
                                        card.hasVoted
                                          ? 'bg-indigo-600 text-white shadow'
                                          : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                                      }`}
                                    >
                                      <ThumbsUp className="w-3 h-3" />
                                      <span>{card.voteCount}</span>
                                    </button>

                                    {/* Comments Button */}
                                    <button
                                      onClick={() => setActiveCommentCard(card)}
                                      title="Card discussion"
                                      className="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      <span>{card.commentCount}</span>
                                    </button>

                                    {/* Convert to Action */}
                                    <button
                                      onClick={() => setActiveActionCard(card)}
                                      title="Convert to action item"
                                      className="p-1 rounded-md bg-slate-900 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                                    >
                                      <CheckSquare className="w-3 h-3" />
                                    </button>

                                    {/* Delete Card */}
                                    {(card.isAuthor || isOwnerOrAdmin) && (
                                      <button
                                        onClick={() => handleDeleteCard(card.id)}
                                        title="Delete card"
                                        className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {/* Add Card Control */}
                  {!isCompleted && (
                    <div className="p-3 border-t border-slate-800/80">
                      {addingToCol === column.id ? (
                        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-150">
                          <textarea
                            rows={3}
                            autoFocus
                            value={newCardTexts[column.id] || ''}
                            onChange={(e) =>
                              setNewCardTexts({
                                ...newCardTexts,
                                [column.id]: e.target.value,
                              })
                            }
                            placeholder="Type feedback here..."
                            className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setAddingToCol(null)}
                              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleAddCard(column.id)}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
                            >
                              Add Card
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingToCol(column.id)}
                          className="w-full py-2 px-3 border border-dashed border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 rounded-xl text-xs text-slate-400 hover:text-white flex items-center justify-center space-x-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Card</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
