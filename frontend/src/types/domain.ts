import { z } from 'zod';

export const RoleSchema = z.enum(['intern', 'buddy', 'manager']);
export type Role = z.infer<typeof RoleSchema>;
export const PeriodSchema = z.enum([
  'week_1',
  'week_2',
  'month_1',
  'month_2',
  'month_3',
  'equator',
]);
export type Period = z.infer<typeof PeriodSchema>;
export const NodeTypeSchema = z.enum(['guide', 'service_action', 'quiz']);
export const NodeStatusSchema = z.enum(['locked', 'active', 'waiting_approval', 'done']);

export const UserProfileSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  role: RoleSchema,
  job_title: z.string(),
  team: z.string(),
  cluster: z.string(),
  mentor_name: z.string(),
  manager_name: z.string(),
  xp: z.number(),
  level: z.number(),
  mascot_stage: z.enum(['egg', 'chick', 'wingman', 'legend']),
  streak_days: z.number(),
  pulse_completed_today: z.boolean(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const RoadmapNodeSchema = z.object({
  id: z.string(),
  period: PeriodSchema,
  title: z.string(),
  description: z.string(),
  node_type: NodeTypeSchema,
  xp_reward: z.number(),
  order_index: z.number(),
  status: NodeStatusSchema,
  verification_config: z.record(z.any()),
  verified_artifact: z.string().nullable().optional(),
  verification_feedback: z.string().nullable().optional(),
});
export type RoadmapNode = z.infer<typeof RoadmapNodeSchema>;

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  event_type: z.enum(['one_on_one', 'deadline', 'team_sync', 'equator_defense']),
  starts_at: z.string(),
  duration_min: z.number(),
  agenda: z.string().nullable().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export const SourceCitationSchema = z.object({
  id: z.string(),
  doc_title: z.string(),
  source_url: z.string(),
  source_scope: z.enum(['playbook_global', 'cluster_specific']),
  version_date: z.string(),
});
export type SourceCitation = z.infer<typeof SourceCitationSchema>;
export const ConflictWarningSchema = z.object({
  topic_key: z.string(),
  summary: z.string(),
  playbook_claim: z.string(),
  cluster_claim: z.string(),
  recommended_source_url: z.string(),
});
export type ConflictWarning = z.infer<typeof ConflictWarningSchema>;
export const EscalationSuggestionSchema = z.object({
  target_role: z.enum(['buddy', 'manager', 'hr_bp']),
  target_name: z.string(),
  mattermost_handle: z.string(),
  draft_message: z.string(),
});
export const ProposedMCPActionSchema = z.object({
  tool_name: z.enum([
    'create_absence_request',
    'request_service_access',
    'schedule_calendar_meeting',
    'verify_onboarding_task',
  ]),
  title: z.string(),
  summary: z.string(),
  payload: z.record(z.any()),
  idempotency_key: z.string(),
});
export type ProposedMCPAction = z.infer<typeof ProposedMCPActionSchema>;
export const ChatMessageResponseSchema = z.object({
  reply: z.string(),
  sources: z.array(SourceCitationSchema),
  conflict_warning: ConflictWarningSchema.nullable(),
  escalation: z.any().nullable(),
  proposed_mcp_action: ProposedMCPActionSchema.nullable(),
});
export type ChatMessageResponse = z.infer<typeof ChatMessageResponseSchema>;

export const DashboardResponseSchema = z.object({
  profile: UserProfileSchema,
  timeline: z
    .object({
      date: z.string(),
      day: z.number(),
      week: z.number(),
      label: z.string(),
    })
    .optional(),
  mascot: z
    .object({
      xp: z.number(),
      level: z.number(),
      mascot_stage: z.enum(['egg', 'chick', 'wingman', 'legend']),
      streak_days: z.number(),
    })
    .optional(),
  active_nodes: z.array(RoadmapNodeSchema).max(3),
  upcoming_events: z.array(CalendarEventSchema).max(2),
  pulse: z.object({ completed_today: z.boolean(), mood_score: z.number().nullable().optional() }),
});
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
