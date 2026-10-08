import { query } from '../db/index.js';
import {
  SendMessageRequestSchema,
  UpdateConversationSchema,
} from '../schemas/chat.schema.js';
import { generateChatReply } from '../services/ai/chat.service.js';
import { redactSensitiveInfo } from '../utils/redact.js';

/**
 * POST /api/chat
 * Send a message to PolicyPal Assistant and receive a grounded AI reply
 */
export async function sendMessage(req, res, next) {
  try {
    const parseResult = SendMessageRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid request payload',
          details: parseResult.error.errors,
        },
      });
    }

    const {
      conversation_id: providedConvId,
      message: rawMessage,
      ui_language = 'en',
      input_mode = 'text',
    } = parseResult.data;

    const userId = req.user.id;

    // Redact Aadhaar, PAN, OTP, and bank accounts in memory
    const { text: cleanMessage, redacted: wasRedacted } = redactSensitiveInfo(rawMessage);

    let conversationId = providedConvId;

    let currentStep = 'database write (conversation setup)';
    // Verify existing conversation ownership or create a new one
    if (conversationId) {
      const convCheck = await query(
        `SELECT id FROM chat_conversations WHERE id = $1 AND user_id = $2`,
        [conversationId, userId]
      );
      if (convCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Conversation not found or access denied.',
          },
        });
      }
    } else {
      // First user message truncated to 60 characters for conversation title
      const title = cleanMessage.trim().slice(0, 60) || 'New Inquiry';
      const newConvRes = await query(
        `INSERT INTO chat_conversations (user_id, title, language)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId, title, ui_language]
      );
      conversationId = newConvRes.rows[0].id;
    }

    // Save user message (redacted)
    currentStep = 'database write (user message)';
    await query(
      `INSERT INTO chat_messages (conversation_id, user_id, role, content, detected_language, input_mode)
       VALUES ($1, $2, 'user', $3, $4, $5)`,
      [conversationId, userId, cleanMessage, ui_language, input_mode]
    );

    // Call grounded Gemini AI Chat Service
    currentStep = 'Gemini generation';
    const aiResponse = await generateChatReply({
      userId,
      conversationId,
      userMessage: cleanMessage,
      uiLanguage: ui_language,
      wasRedacted,
    });

    // Save assistant reply
    currentStep = 'database write (assistant message)';
    await query(
      `INSERT INTO chat_messages (conversation_id, user_id, role, content, detected_language, input_mode, actions)
       VALUES ($1, $2, 'assistant', $3, $4, 'text', $5::jsonb)`,
      [
        conversationId,
        userId,
        aiResponse.reply,
        aiResponse.language,
        JSON.stringify(aiResponse.actions || []),
      ]
    );

    // Update conversation timestamp
    currentStep = 'database write (update conversation)';
    await query(
      `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        conversation_id: conversationId,
        reply: aiResponse.reply,
        language: aiResponse.language,
        followups: aiResponse.followups,
        actions: aiResponse.actions,
      },
    });
  } catch (err) {
    const failedStep = err.step || currentStep;
    const status = err.status || (err.code === 'CHAT_UNAVAILABLE' ? 502 : 500);
    console.error(
      `[Chat Controller] Error in chat pipeline | Step: ${failedStep} | Error: ${err.name} | Status: ${status} | Message: ${err.message}`
    );
    if (err.code === 'CHAT_UNAVAILABLE' || err.status === 502) {
      return res.status(502).json({
        success: false,
        error: {
          code: 'CHAT_UNAVAILABLE',
          message: 'PolicyPal Assistant is temporarily unavailable. Please try again in a few moments.',
        },
      });
    }
    next(err);
  }
}

/**
 * GET /api/chat/conversations
 * List conversation history for the authenticated user
 */
export async function getConversations(req, res, next) {
  try {
    const userId = req.user.id;
    const { q, sort_by } = req.query;

    let sql = `
      SELECT id, title, language, archived, created_at, updated_at
      FROM chat_conversations
      WHERE user_id = $1
    `;
    const params = [userId];

    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      sql += ` AND title ILIKE $${params.length}`;
    }

    sql += ` ORDER BY updated_at DESC`;

    const result = await query(sql, params);

    return res.status(200).json({
      success: true,
      data: {
        conversations: result.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/chat/conversations/:id
 * Retrieve a specific conversation with all its messages
 */
export async function getConversationById(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check ownership
    const convRes = await query(
      `SELECT id, title, language, archived, created_at, updated_at
       FROM chat_conversations
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (convRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation not found or access denied.',
        },
      });
    }

    const messagesRes = await query(
      `SELECT id, role, content, detected_language, input_mode, actions, created_at
       FROM chat_messages
       WHERE conversation_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [id, userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        conversation: convRes.rows[0],
        messages: messagesRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/chat/conversations/:id
 * Rename or archive conversation
 */
export async function updateConversation(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const parseResult = UpdateConversationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid parameters',
        },
      });
    }

    const { title, archived } = parseResult.data;

    // Verify ownership
    const existing = await query(
      `SELECT id FROM chat_conversations WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation not found or access denied.',
        },
      });
    }

    const updates = [];
    const params = [id, userId];

    if (title !== undefined) {
      params.push(title);
      updates.push(`title = $${params.length}`);
    }

    if (archived !== undefined) {
      params.push(archived);
      updates.push(`archived = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_UPDATE',
          message: 'No fields to update provided.',
        },
      });
    }

    const updateSql = `
      UPDATE chat_conversations
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, title, language, archived, created_at, updated_at
    `;

    const updatedRes = await query(updateSql, params);

    return res.status(200).json({
      success: true,
      data: {
        conversation: updatedRes.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation and its messages
 */
export async function deleteConversation(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleteRes = await query(
      `DELETE FROM chat_conversations
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation not found or access denied.',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        message: 'Conversation deleted successfully.',
      },
    });
  } catch (err) {
    next(err);
  }
}
