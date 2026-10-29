import { eq, and, asc, count, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  feedbackCards,
  retrospectiveColumns,
  retrospectives,
  votes,
  comments,
  users,
} from '../../db/schema.js';
import { createId } from '../../utils/id.js';
import {
  RetrospectiveStatus,
  type CreateFeedbackInput,
  type UpdateFeedbackInput,
  type CreateCommentInput,
} from '@retrospace/shared';

export class BoardService {
  async getBoardData(tenantId: string, retrospectiveId: string, currentUserId: string) {
    // 1. Get retrospective
    const [retro] = await db
      .select()
      .from(retrospectives)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!retro) {
      const error = new Error('Retrospective not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    // 2. Get columns
    const columnsList = await db
      .select()
      .from(retrospectiveColumns)
      .where(
        and(
          eq(retrospectiveColumns.retrospectiveId, retrospectiveId),
          eq(retrospectiveColumns.tenantId, tenantId)
        )
      )
      .orderBy(asc(retrospectiveColumns.position));

    // 3. Get all feedback cards for this retrospective
    const cardsList = await db
      .select({
        id: feedbackCards.id,
        tenantId: feedbackCards.tenantId,
        retrospectiveId: feedbackCards.retrospectiveId,
        columnId: feedbackCards.columnId,
        authorId: feedbackCards.authorId,
        authorName: users.name,
        content: feedbackCards.content,
        position: feedbackCards.position,
        createdAt: feedbackCards.createdAt,
        updatedAt: feedbackCards.updatedAt,
      })
      .from(feedbackCards)
      .leftJoin(users, eq(feedbackCards.authorId, users.id))
      .where(
        and(
          eq(feedbackCards.retrospectiveId, retrospectiveId),
          eq(feedbackCards.tenantId, tenantId)
        )
      )
      .orderBy(asc(feedbackCards.position));

    // 4. Get votes for this retrospective
    const retroVotes = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.retrospectiveId, retrospectiveId),
          eq(votes.tenantId, tenantId)
        )
      );

    // 5. Get comments count per card
    const allComments = await db
      .select({
        id: comments.id,
        feedbackCardId: comments.feedbackCardId,
      })
      .from(comments)
      .where(eq(comments.tenantId, tenantId));

    // Calculate user's total votes cast
    const userVotesCast = retroVotes.filter((v) => v.userId === currentUserId).length;
    const remainingVotes = Math.max(0, retro.votingLimit - userVotesCast);

    // Process cards: apply anonymous feedback privacy masking & vote/comment metadata
    const cards = cardsList.map((card) => {
      const cardVotes = retroVotes.filter((v) => v.feedbackCardId === card.id);
      const cardCommentsCount = allComments.filter((c) => c.feedbackCardId === card.id).length;
      const hasVoted = cardVotes.some((v) => v.userId === currentUserId);

      // ANONYMITY PRIVACY ENFORCEMENT: Strip author info if retrospective is anonymous
      const isAnon = retro.isAnonymous;

      return {
        id: card.id,
        columnId: card.columnId,
        content: card.content,
        position: card.position,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        author: isAnon
          ? null
          : card.authorId
          ? { id: card.authorId, name: card.authorName || 'Teammate' }
          : null,
        isAuthor: !isAnon && card.authorId === currentUserId,
        voteCount: cardVotes.length,
        hasVoted,
        commentCount: cardCommentsCount,
      };
    });

    return {
      retrospective: retro,
      columns: columnsList,
      cards,
      voting: {
        limit: retro.votingLimit,
        votesCast: userVotesCast,
        remainingVotes,
      },
    };
  }

  async createCard(
    tenantId: string,
    retrospectiveId: string,
    userId: string,
    input: CreateFeedbackInput
  ) {
    const [retro] = await db
      .select()
      .from(retrospectives)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!retro) {
      const error = new Error('Retrospective not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (retro.status === RetrospectiveStatus.COMPLETED) {
      const error = new Error('Cannot add cards to a completed retrospective');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    // Verify column exists in retro
    const [col] = await db
      .select({ id: retrospectiveColumns.id })
      .from(retrospectiveColumns)
      .where(
        and(
          eq(retrospectiveColumns.id, input.columnId),
          eq(retrospectiveColumns.retrospectiveId, retrospectiveId),
          eq(retrospectiveColumns.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!col) {
      const error = new Error('Column not found in retrospective');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    // Determine position: append at bottom of column
    const [maxPos] = await db
      .select({ pos: feedbackCards.position })
      .from(feedbackCards)
      .where(
        and(
          eq(feedbackCards.columnId, input.columnId),
          eq(feedbackCards.tenantId, tenantId)
        )
      )
      .orderBy(desc(feedbackCards.position))
      .limit(1);

    const position = (maxPos?.pos !== undefined ? maxPos.pos : -1) + 1;

    // If anonymous, authorId is set in database for internal DB relation but NEVER returned in responses
    const [newCard] = await db
      .insert(feedbackCards)
      .values({
        id: createId('crd'),
        tenantId,
        retrospectiveId,
        columnId: input.columnId,
        authorId: userId,
        content: input.content.trim(),
        position,
      })
      .returning();

    return {
      ...newCard,
      author: retro.isAnonymous ? null : { id: userId },
      voteCount: 0,
      hasVoted: false,
      commentCount: 0,
    };
  }

  async updateCard(
    tenantId: string,
    retrospectiveId: string,
    cardId: string,
    userId: string,
    isFacilitatorOrAdmin: boolean,
    input: UpdateFeedbackInput
  ) {
    const [card] = await db
      .select()
      .from(feedbackCards)
      .where(
        and(
          eq(feedbackCards.id, cardId),
          eq(feedbackCards.retrospectiveId, retrospectiveId),
          eq(feedbackCards.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!card) {
      const error = new Error('Card not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    // Authorship check: author or facilitator/admin can update
    if (card.authorId !== userId && !isFacilitatorOrAdmin) {
      const error = new Error('You do not have permission to edit this feedback card');
      (error as unknown as { statusCode: number }).statusCode = 403;
      throw error;
    }

    const updates: Partial<{
      content: string;
      columnId: string;
      position: number;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (input.content) updates.content = input.content.trim();
    if (input.columnId) updates.columnId = input.columnId;
    if (input.position !== undefined) updates.position = input.position;

    const [updated] = await db
      .update(feedbackCards)
      .set(updates)
      .where(
        and(
          eq(feedbackCards.id, cardId),
          eq(feedbackCards.tenantId, tenantId)
        )
      )
      .returning();

    return updated;
  }

  async moveCard(
    tenantId: string,
    retrospectiveId: string,
    cardId: string,
    columnId: string,
    position: number
  ) {
    const [card] = await db
      .select()
      .from(feedbackCards)
      .where(
        and(
          eq(feedbackCards.id, cardId),
          eq(feedbackCards.retrospectiveId, retrospectiveId),
          eq(feedbackCards.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!card) {
      const error = new Error('Card not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    const [updated] = await db
      .update(feedbackCards)
      .set({
        columnId,
        position,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feedbackCards.id, cardId),
          eq(feedbackCards.tenantId, tenantId)
        )
      )
      .returning();

    return updated;
  }

  async deleteCard(
    tenantId: string,
    retrospectiveId: string,
    cardId: string,
    userId: string,
    isFacilitatorOrAdmin: boolean
  ) {
    const [card] = await db
      .select()
      .from(feedbackCards)
      .where(
        and(
          eq(feedbackCards.id, cardId),
          eq(feedbackCards.retrospectiveId, retrospectiveId),
          eq(feedbackCards.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!card) {
      const error = new Error('Card not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (card.authorId !== userId && !isFacilitatorOrAdmin) {
      const error = new Error('You do not have permission to delete this feedback card');
      (error as unknown as { statusCode: number }).statusCode = 403;
      throw error;
    }

    await db
      .delete(feedbackCards)
      .where(
        and(
          eq(feedbackCards.id, cardId),
          eq(feedbackCards.tenantId, tenantId)
        )
      );
  }

  // Voting
  async toggleVote(
    tenantId: string,
    retrospectiveId: string,
    feedbackCardId: string,
    userId: string
  ) {
    const [retro] = await db
      .select()
      .from(retrospectives)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!retro) {
      const error = new Error('Retrospective not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (retro.status !== RetrospectiveStatus.ACTIVE) {
      const error = new Error('Voting is only permitted during an ACTIVE session');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    // Check if user has already voted for this card
    const [existingVote] = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.feedbackCardId, feedbackCardId),
          eq(votes.userId, userId),
          eq(votes.tenantId, tenantId)
        )
      )
      .limit(1);

    if (existingVote) {
      // Remove vote
      await db
        .delete(votes)
        .where(eq(votes.id, existingVote.id));

      const [updatedCount] = await db
        .select({ value: count() })
        .from(votes)
        .where(eq(votes.feedbackCardId, feedbackCardId));

      return {
        feedbackCardId,
        hasVoted: false,
        voteCount: updatedCount?.value || 0,
      };
    } else {
      // Enforce voting limit
      const [userVotes] = await db
        .select({ value: count() })
        .from(votes)
        .where(
          and(
            eq(votes.retrospectiveId, retrospectiveId),
            eq(votes.userId, userId),
            eq(votes.tenantId, tenantId)
          )
        );

      if ((userVotes?.value || 0) >= retro.votingLimit) {
        const error = new Error(
          `You have reached your limit of ${retro.votingLimit} votes for this retrospective`
        );
        (error as unknown as { statusCode: number }).statusCode = 400;
        throw error;
      }

      // Insert vote
      await db.insert(votes).values({
        id: createId('vot'),
        tenantId,
        retrospectiveId,
        feedbackCardId,
        userId,
      });

      const [updatedCount] = await db
        .select({ value: count() })
        .from(votes)
        .where(eq(votes.feedbackCardId, feedbackCardId));

      return {
        feedbackCardId,
        hasVoted: true,
        voteCount: updatedCount?.value || 0,
      };
    }
  }

  // Comments
  async listComments(tenantId: string, feedbackCardId: string) {
    return db
      .select({
        id: comments.id,
        feedbackCardId: comments.feedbackCardId,
        authorId: comments.authorId,
        authorName: users.name,
        content: comments.content,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(
        and(
          eq(comments.feedbackCardId, feedbackCardId),
          eq(comments.tenantId, tenantId)
        )
      )
      .orderBy(asc(comments.createdAt));
  }

  async addComment(
    tenantId: string,
    feedbackCardId: string,
    userId: string,
    input: CreateCommentInput
  ) {
    const [card] = await db
      .select({ id: feedbackCards.id, retrospectiveId: feedbackCards.retrospectiveId })
      .from(feedbackCards)
      .where(
        and(
          eq(feedbackCards.id, feedbackCardId),
          eq(feedbackCards.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!card) {
      const error = new Error('Feedback card not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    const [newComment] = await db
      .insert(comments)
      .values({
        id: createId('com'),
        tenantId,
        feedbackCardId,
        authorId: userId,
        content: input.content.trim(),
      })
      .returning();

    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      ...newComment,
      authorName: user?.name || 'Teammate',
      retrospectiveId: card.retrospectiveId,
    };
  }

  async deleteComment(
    tenantId: string,
    commentId: string,
    userId: string,
    isFacilitatorOrAdmin: boolean
  ) {
    const [comment] = await db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!comment) {
      const error = new Error('Comment not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (comment.authorId !== userId && !isFacilitatorOrAdmin) {
      const error = new Error('You do not have permission to delete this comment');
      (error as unknown as { statusCode: number }).statusCode = 403;
      throw error;
    }

    await db
      .delete(comments)
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.tenantId, tenantId)
        )
      );

    return {
      id: commentId,
      feedbackCardId: comment.feedbackCardId,
    };
  }
}

export const boardService = new BoardService();
