import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { createApiClient } from '../api/client';
import { MascotProgressHeader } from '../components/ui';
import { NodeVerificationModal } from '../components/roadmap/NodeVerificationModal';
import { useAuthStore } from '../store/useAuthStore';
import type { RoadmapNode } from '../types/domain';

const api = createApiClient(() => ({
  userId: useAuthStore.getState().userId,
  role: useAuthStore.getState().role,
}));
const periods = [
  ['week_1', 'Неделя 1'],
  ['week_2', 'Неделя 2'],
  ['month_1', 'Месяц 1'],
  ['month_2', 'Месяц 2'],
  ['month_3', 'Месяц 3'],
  ['equator', 'Экватор'],
] as const;

const statusLabels: Record<RoadmapNode['status'], string> = {
  locked: 'Заблокирован',
  active: 'Доступен сейчас',
  waiting_approval: 'Ожидает проверки',
  done: 'Завершён',
};

function RoadmapJourneyNode({
  node,
  onSelect,
}: {
  node: RoadmapNode;
  onSelect: (node: RoadmapNode) => void;
}) {
  const icon =
    node.status === 'done'
      ? '✓'
      : node.node_type === 'quiz'
        ? '✦'
        : node.node_type === 'service_action'
          ? '↗'
          : '○';
  const dependencyLabel =
    node.status === 'locked'
      ? 'Откроется после предыдущего шага'
      : node.status === 'done'
        ? 'Можно открыть детали выполнения'
        : statusLabels[node.status];

  return (
    <button
      className={`node-card node-${node.status}`}
      onClick={() => onSelect(node)}
      aria-label={`${node.title}, ${statusLabels[node.status]}`}
      aria-haspopup="dialog"
    >
      <span className="node-icon" aria-hidden="true">
        {icon}
      </span>
      <span>
        <strong>{node.title}</strong>
        <small>{node.description}</small>
        <small>{dependencyLabel}</small>
      </span>
      <b>+{node.xp_reward} XP</b>
    </button>
  );
}

export default function Roadmap() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<RoadmapNode | null>(null);
  const [feedback, setFeedback] = useState('');
  const [serviceTicket, setServiceTicket] = useState('');
  const query = useQuery({ queryKey: ['roadmap', profile.id, profile.role], queryFn: api.roadmap });
  const verify = useMutation({
    mutationFn: async ({
      nodeId,
      artifact_type,
      content,
    }: {
      nodeId: string;
      artifact_type: string;
      content: string;
    }) => {
      if (artifact_type !== 'service_access') {
        return api.verifyNode(nodeId, { artifact_type, content });
      }
      const proposal = await api.chatMessage('Запроси доступ к jira');
      const action = proposal.proposed_mcp_action;
      if (
        !action ||
        action.tool_name !== 'request_service_access' ||
        action.payload?.node_id !== nodeId
      ) {
        throw new Error('Не удалось получить подтверждаемую заявку для этого шага');
      }
      return api.executeMcp({
        tool_name: action.tool_name,
        payload: action.payload,
        idempotency_key: action.idempotency_key,
      });
    },
    onSuccess: (response, variables) => {
      if (variables.artifact_type === 'service_access') {
        const externalTicket =
          'external_ticket_id' in response && typeof response.external_ticket_id === 'string'
            ? response.external_ticket_id
            : undefined;
        if (!externalTicket) {
          setFeedback('Сервис не вернул номер заявки; действие не подтверждено.');
          return;
        }
        setServiceTicket(externalTicket);
      } else {
        setSelected(null);
      }
      setFeedback('');
      queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) =>
      setFeedback(error instanceof Error ? error.message : 'Не удалось проверить шаг'),
  });
  const nodes = useMemo(() => (query.data?.nodes ?? []) as RoadmapNode[], [query.data?.nodes]);
  useEffect(() => {
    const requestedNode = searchParams.get('node');
    if (!requestedNode || selected) return;
    const node = nodes.find((item) => item.id === requestedNode);
    if (node) setSelected(node);
  }, [nodes, searchParams, selected]);
  return (
    <div className="page">
      <div className="section-head">
        <div>
          <span className="eyebrow">Маршрут адаптации</span>
          <h2>Дорожная карта</h2>
        </div>
        <span className="muted">6 периодов</span>
      </div>
      <MascotProgressHeader
        xp={query.data?.progress?.xp ?? profile.xp}
        level={query.data?.progress?.level ?? profile.level}
        mascotStage={query.data?.progress?.mascot_stage ?? profile.mascot_stage}
        streakDays={query.data?.progress?.streak_days ?? profile.streak_days}
      />
      {query.isLoading && (
        <div className="empty" role="status">
          Загружаем узлы и зависимости…
        </div>
      )}
      {query.isError && (
        <div className="error" role="alert">
          Не удалось загрузить дорожную карту.
        </div>
      )}
      {!query.isLoading && !query.isError && nodes.length === 0 && (
        <div className="empty">Пока нет узлов. Проверь API демо-среды.</div>
      )}
      {periods.map(([key, label]) => {
        const group = nodes.filter((node) => node.period === key);
        return group.length ? (
          <section className="roadmap-period" key={key}>
            <div className="section-head">
              <h3>{label}</h3>
              <span className="muted">
                {group.filter((node) => node.status === 'done').length}/{group.length}
              </span>
            </div>
            <div className="node-list">
              {group.map((node) => (
                <RoadmapJourneyNode
                  key={node.id}
                  node={node}
                  onSelect={(nextNode) => {
                    setFeedback('');
                    setServiceTicket('');
                    setSelected(nextNode);
                  }}
                />
              ))}
            </div>
          </section>
        ) : null;
      })}
      {selected && (
        <NodeVerificationModal
          key={selected.id}
          node={selected}
          onClose={() => {
            setSelected(null);
            setServiceTicket('');
          }}
          onVerify={(artifact_type, content) =>
            verify.mutate({ nodeId: selected.id, artifact_type, content })
          }
          isLoading={verify.isPending}
          error={feedback}
          resultTicket={serviceTicket || undefined}
        />
      )}
    </div>
  );
}
