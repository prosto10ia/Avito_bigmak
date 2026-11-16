import {
  DashboardResponseSchema,
  RoleSchema,
  UserProfileSchema,
  type Role,
  type UserProfile,
} from '../types/domain';
import { z } from 'zod';

const RoadmapResponseSchema = z.object({
  nodes: z.array(z.any()),
  progress: z
    .object({
      xp: z.number(),
      level: z.number(),
      completed: z.number().optional(),
      mascot_stage: z.string().optional(),
      streak_days: z.number().optional(),
    })
    .optional(),
});
const VerifyNodeResponseSchema = z.object({
  status: z.string(),
  node: z.any().optional(),
  xp_awarded: z.number().optional(),
  total_xp: z.number().optional(),
  ticket_id: z.string().optional(),
  feedback: z.string().optional(),
});
const ChatResponseSchema = z.object({
  reply: z.string(),
  llm_mode: z.enum(['ollama', 'offline']).default('offline'),
  sources: z.array(z.any()).default([]),
  conflict_warning: z.any().nullable().default(null),
  escalation: z.any().nullable().default(null),
  proposed_mcp_action: z.any().nullable().default(null),
});
const CalendarResponseSchema = z.object({
  events: z.array(z.any()).default([]),
  summary: z.string().nullable().optional(),
});
const SummaryResponseSchema = z.object({ summary: z.string(), report: z.string().optional() });
const PulseResponseSchema = z.object({
  status: z.string(),
  xp_awarded: z.number().default(15),
  streak_days: z.number().optional(),
  completed_today: z.boolean().optional(),
});
const McpResponseSchema = z.object({
  status: z.string(),
  external_ticket_id: z.string().optional(),
  ticket_id: z.string().optional(),
  message: z.string().optional(),
  event: z.any().optional(),
});
export type RoadmapResponse = z.infer<typeof RoadmapResponseSchema>;
export type VerifyNodeResponse = z.infer<typeof VerifyNodeResponseSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;
export type PulseResponse = z.infer<typeof PulseResponseSchema>;
export type McpResponse = z.infer<typeof McpResponseSchema>;

export const DEMO_ACCESS_CODE = 'hack-and-change-2026';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function createApiClient(getAuth: () => { userId: string; role: Role }) {
  async function request<T>(
    path: string,
    schema: { parse: (data: unknown) => T },
    init: RequestInit = {},
  ): Promise<T> {
    const auth = getAuth();
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Demo-Access-Code', DEMO_ACCESS_CODE);
    headers.set('X-User-Id', auth.userId);
    headers.set('X-User-Role', auth.role);
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(
        response.status,
        body?.message ?? body?.error ?? 'Не удалось выполнить запрос',
        body?.code,
      );
    return schema.parse(body);
  }
  return {
    dashboard: () => request('/dashboard', DashboardResponseSchema),
    roadmap: () => request('/roadmap', RoadmapResponseSchema),
    verifyNode: (nodeId: string, payload: { artifact_type: string; content: string }) =>
      request(`/roadmap/nodes/${encodeURIComponent(nodeId)}/verify`, VerifyNodeResponseSchema, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    chatMessage: (message: string) =>
      request('/chat/message', ChatResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
    executeMcp: (payload: {
      tool_name: string;
      payload: Record<string, unknown>;
      idempotency_key: string;
    }) =>
      request('/mcp/execute', McpResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ ...payload, confirmed: true }),
      }),
    calendar: () => request('/calendar', CalendarResponseSchema),
    calendarSummary: (kind: 'one_on_one' | 'equator') =>
      request('/calendar/summary', SummaryResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ kind }),
      }),
    submitPulse: (payload: { mood_score: number; blocker_tags: string[]; comment?: string }) =>
      request('/pulse', PulseResponseSchema, { method: 'POST', body: JSON.stringify(payload) }),
    switchRole: (target_role: Role): Promise<UserProfile> =>
      request('/auth/switch-role', UserProfileSchema, {
        method: 'POST',
        body: JSON.stringify({ target_role }),
      }),
  };
}

export const roleLabel = (role: Role) =>
  ({ intern: 'Стажёр', buddy: 'Наставник', manager: 'Руководитель' })[RoleSchema.parse(role)];
