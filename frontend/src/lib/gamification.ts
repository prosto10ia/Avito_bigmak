import type { RoadmapNode } from '../types/domain';

export function calculateMascotStage(xp: number) {
  if (xp >= 600) return 'legend';
  if (xp >= 300) return 'wingman';
  if (xp >= 100) return 'chick';
  return 'egg';
}

export function canUnlockNode(node: RoadmapNode, progressMap: Record<string, string>) {
  if (node.status === 'done' || node.status === 'active') return true;
  const dependency = node.verification_config.depends_on_node_id as string | undefined;
  return node.status !== 'locked' || Boolean(dependency && progressMap[dependency] === 'done');
}
