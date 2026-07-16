/**
 * Unit tests for the Conversation Service.
 *
 * Tests:
 * - Create/list/get conversations per user
 * - Append messages with role, content, and tool call data
 * - Auto-update title/destination from tool calls
 * - Share token generation and lookup
 * - Delete conversation (soft delete)
 *
 * Strategy: Mock the database layer and infra services to isolate
 * ConversationService logic. Verify correct SQL calls and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';


const {
  mockQuery,
  mockQueryOne,
  mockQueryRows,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockQueryOne: vi.fn(),
  mockQueryRows: vi.fn(),
}));


vi.mock('../../db/index.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
}));

vi.mock('../../infra/index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  NotFoundError: class NotFoundError extends Error {
    public readonly statusCode = 404;
    public readonly code = 'NOT_FOUND';
    constructor(message = 'Resource not found') {
      super(message);
      Object.setPrototypeOf(this, new.target.prototype);
    }
  },
  ValidationError: class ValidationError extends Error {
    public readonly statusCode = 400;
    public readonly code = 'VALIDATION_ERROR';
    constructor(message: string) {
      super(message);
      Object.setPrototypeOf(this, new.target.prototype);
    }
  },
}));

import { createConversationService } from './conversation.service.js';
import type { ConversationService, Conversation, ConversationMessage, ConversationListItem } from './conversation.service.js';


const TEST_USER_ID = 'user-123';
const TEST_CONVERSATION_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEST_MESSAGE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TEST_SHARE_TOKEN = 'abcdef1234567890abcdef1234567890';


function sampleConversation(overrides: Record<string, unknown> = {}): Conversation {
  return {
    id: TEST_CONVERSATION_ID,
    user_id: TEST_USER_ID,
    package_id: null,
    title: 'New Trip',
    destination: null,
    status: 'active',
    share_token: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function sampleMessage(overrides: Record<string, unknown> = {}): ConversationMessage {
  return {
    id: TEST_MESSAGE_ID,
    conversation_id: TEST_CONVERSATION_ID,
    role: 'user',
    content: 'Hello',
    tool_calls: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}


describe('Conversation Service — Unit Tests', () => {
  let service: ConversationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createConversationService();
  });


  describe('createConversation', () => {
    it('should create a conversation with default title', async () => {
      mockQueryOne.mockResolvedValueOnce(sampleConversation());

      const result = await service.createConversation(TEST_USER_ID);

      expect(result.id).toBe(TEST_CONVERSATION_ID);
      expect(result.title).toBe('New Trip');
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO conversations'),
        [TEST_USER_ID, 'New Trip'],
      );
    });

    it('should create a conversation with custom title', async () => {
      const title = 'Bali Trip';
      mockQueryOne.mockResolvedValueOnce(sampleConversation({ title }));

      const result = await service.createConversation(TEST_USER_ID, { title });

      expect(result.title).toBe(title);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO conversations'),
        [TEST_USER_ID, title],
      );
    });

    it('should return a conversation with all required fields', async () => {
      const conv = sampleConversation({
        id: TEST_CONVERSATION_ID,
        user_id: TEST_USER_ID,
        title: 'Paris Vacation',
        status: 'active',
      });
      mockQueryOne.mockResolvedValueOnce(conv);

      const result = await service.createConversation(TEST_USER_ID, { title: 'Paris Vacation' });

      expect(result.id).toBeDefined();
      expect(result.user_id).toBe(TEST_USER_ID);
      expect(result.title).toBe('Paris Vacation');
      expect(result.status).toBe('active');
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });
  });


  describe('listConversations', () => {
    it('should list conversations for a user, excluding deleted', async () => {
      const items: ConversationListItem[] = [
        { id: '1', title: 'Bali Trip', destination: 'Bali', status: 'active', updated_at: new Date().toISOString(), last_message: 'Hello', message_count: 5 },
        { id: '2', title: 'Paris Trip', destination: 'Paris', status: 'active', updated_at: new Date().toISOString(), last_message: null, message_count: 2 },
      ];
      mockQueryRows.mockResolvedValueOnce(items);

      const result = await service.listConversations(TEST_USER_ID);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Bali Trip');
      expect(mockQueryRows).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [TEST_USER_ID, 20],
      );
    });

    it('should return empty array when user has no conversations', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.listConversations(TEST_USER_ID);

      expect(result).toHaveLength(0);
    });

    it('should respect the limit parameter', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      await service.listConversations(TEST_USER_ID, 5);

      expect(mockQueryRows).toHaveBeenCalledWith(
        expect.any(String),
        [TEST_USER_ID, 5],
      );
    });

    it('should exclude deleted conversations', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      await service.listConversations(TEST_USER_ID);

      expect(mockQueryRows).toHaveBeenCalledWith(
        expect.stringMatching(/status.*!=.*deleted|status.*<>.*deleted/i),
        expect.any(Array),
      );
    });
  });


  describe('getConversation', () => {
    it('should return a conversation by ID', async () => {
      const conv = sampleConversation();
      mockQueryOne.mockResolvedValueOnce(conv);

      const result = await service.getConversation(TEST_CONVERSATION_ID);

      expect(result).toEqual(conv);
    });

    it('should throw NotFoundError when conversation does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.getConversation('nonexistent'))
        .rejects.toThrow(/not found/i);
    });
  });


  describe('getMessages', () => {
    it('should return messages for a conversation in ascending order', async () => {
      const messages = [
        sampleMessage({ id: '1', content: 'Hi', created_at: '2025-01-01T00:00:00.000Z' }),
        sampleMessage({ id: '2', content: 'Hello', created_at: '2025-01-01T00:01:00.000Z' }),
      ];
      mockQueryRows.mockResolvedValueOnce(messages);

      const result = await service.getMessages(TEST_CONVERSATION_ID);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hi');
      expect(result[1].content).toBe('Hello');
      expect(mockQueryRows).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at ASC'),
        [TEST_CONVERSATION_ID, 100],
      );
    });

    it('should return empty array when conversation has no messages', async () => {
      mockQueryRows.mockResolvedValueOnce([]);

      const result = await service.getMessages(TEST_CONVERSATION_ID);

      expect(result).toHaveLength(0);
    });
  });


  describe('appendMessage', () => {
    it('should append a user message with no tool calls', async () => {
      mockQueryOne.mockResolvedValueOnce(sampleMessage({ role: 'user', content: 'Plan a trip' }));
      mockQuery.mockResolvedValueOnce({ rows: [] }); // auto-update destination query

      const result = await service.appendMessage(TEST_CONVERSATION_ID, {
        role: 'user',
        content: 'Plan a trip',
      });

      expect(result.role).toBe('user');
      expect(result.content).toBe('Plan a trip');
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO conversation_messages'),
        [TEST_CONVERSATION_ID, 'user', 'Plan a trip', '[]'],
      );
    });

    it('should append an assistant message with tool calls', async () => {
      const toolCalls = [{ name: 'show_itinerary', arguments: { destination: 'Bali' } }];
      mockQueryOne.mockResolvedValueOnce(sampleMessage({
        role: 'assistant',
        content: 'Here is your itinerary',
        tool_calls: toolCalls,
      }));
      mockQuery.mockResolvedValueOnce({ rows: [] }); // auto-update destination

      const result = await service.appendMessage(TEST_CONVERSATION_ID, {
        role: 'assistant',
        content: 'Here is your itinerary',
        tool_calls: toolCalls,
      });

      expect(result.role).toBe('assistant');
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.any(String),
        [TEST_CONVERSATION_ID, 'assistant', 'Here is your itinerary', expect.any(String)],
      );
    });

    it('should auto-update title and destination from show_itinerary tool call', async () => {
      const toolCalls = [{ name: 'show_itinerary', arguments: { destination: 'Bali' } }];
      mockQueryOne.mockResolvedValueOnce(sampleMessage({
        role: 'assistant',
        content: 'Bali itinerary',
        tool_calls: toolCalls,
      }));

      // The auto-update destination query
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.appendMessage(TEST_CONVERSATION_ID, {
        role: 'assistant',
        content: 'Bali itinerary',
        tool_calls: toolCalls,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations SET destination'),
        ['Bali', 'Bali Trip', TEST_CONVERSATION_ID],
      );
    });

    it('should not auto-update destination for non-itinerary tool calls', async () => {
      const toolCalls = [{ name: 'show_budget_breakdown', arguments: { destination: 'Paris' } }];
      mockQueryOne.mockResolvedValueOnce(sampleMessage({
        role: 'assistant',
        content: 'Budget breakdown',
        tool_calls: toolCalls,
      }));

      // No auto-update query should fire
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.appendMessage(TEST_CONVERSATION_ID, {
        role: 'assistant',
        content: 'Budget breakdown',
        tool_calls: toolCalls,
      });

      // The only query should be for the conversation_messages INSERT
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should handle empty tool_calls array', async () => {
      mockQueryOne.mockResolvedValueOnce(sampleMessage());

      const result = await service.appendMessage(TEST_CONVERSATION_ID, {
        role: 'user',
        content: 'Hello',
        tool_calls: [],
      });

      expect(result).toBeDefined();
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO conversation_messages'),
        [TEST_CONVERSATION_ID, 'user', 'Hello', '[]'],
      );
    });
  });


  describe('updateTitle / updateDestination', () => {
    it('should update conversation title', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.updateTitle(TEST_CONVERSATION_ID, 'My Bali Trip');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations SET title'),
        ['My Bali Trip', TEST_CONVERSATION_ID],
      );
    });

    it('should update conversation destination', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.updateDestination(TEST_CONVERSATION_ID, 'Bali');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations SET destination'),
        ['Bali', TEST_CONVERSATION_ID],
      );
    });
  });


  describe('linkPackage', () => {
    it('should link a package to a conversation', async () => {
      const packageId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.linkPackage(TEST_CONVERSATION_ID, packageId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations SET package_id'),
        [packageId, TEST_CONVERSATION_ID],
      );
    });
  });


  describe('generateShareToken / getConversationByShareToken', () => {
    it('should generate a 32-character hex share token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const token = await service.generateShareToken(TEST_CONVERSATION_ID);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(32); // 16 random bytes = 32 hex chars
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations SET share_token'),
        [token, TEST_CONVERSATION_ID],
      );
    });

    it('should retrieve a conversation by share token', async () => {
      const conv = sampleConversation({ share_token: TEST_SHARE_TOKEN });
      mockQueryOne.mockResolvedValueOnce(conv);

      const result = await service.getConversationByShareToken(TEST_SHARE_TOKEN);

      expect(result).toEqual(conv);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE share_token'),
        [TEST_SHARE_TOKEN],
      );
    });

    it('should throw NotFoundError for an invalid share token', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.getConversationByShareToken('invalid-token'))
        .rejects.toThrow(/not found/i);
    });
  });


  describe('deleteConversation', () => {
    it('should soft-delete a conversation by setting status to deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.deleteConversation(TEST_CONVERSATION_ID);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'deleted'"),
        [TEST_CONVERSATION_ID],
      );
    });

    it('should update updated_at on soft delete', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.deleteConversation(TEST_CONVERSATION_ID);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('updated_at'),
        expect.any(Array),
      );
    });
  });
});
