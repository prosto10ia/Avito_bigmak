import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createApiClient } from '../api/client';
import { RoadmapNodeCard, MascotProgressHeader } from '../components/ui';
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
export default function Roadmap() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RoadmapNode | null>(null);
  const [feedback, setFeedback] = useState('');
  const query = useQuery({ queryKey: ['roadmap', profile.id, profile.role], queryFn: api.roadmap });
  const verify = useMutation({
    mutationFn: ({
      nodeId,
      artifact_type,
      content,
    }: {
      nodeId: string;
      artifact_type: string;
      content: string;
    }) =>
      artifact_type === 'service_access'
        ? api.executeMcp({
            tool_name: 'request_service_access',
            payload: {
              node_id: nodeId,
              service_name: 'jira',
              project_key: 'AUTO',
              access_level: 'read',
            },
            idempotency_key: `roadmap:${nodeId}`,
          })
        : api.verifyNode(nodeId, { artifact_type, content }),
    onSuccess: () => {
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) =>
      setFeedback(error instanceof Error ? error.message : 'Не удалось проверить шаг'),
  });
  const nodes = (query.data?.nodes ?? []) as RoadmapNode[];
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
                <RoadmapNodeCard key={node.id} node={node} onSelect={setSelected} />
              ))}
            </div>
          </section>
        ) : null;
      })}
      {selected && (
        <NodeVerificationModal
          node={selected}
          onClose={() => setSelected(null)}
          onVerify={(artifact_type, content) =>
            verify.mutate({ nodeId: selected.id, artifact_type, content })
          }
          isLoading={verify.isPending}
          error={feedback}
        />
      )}
    </div>
  );
}
