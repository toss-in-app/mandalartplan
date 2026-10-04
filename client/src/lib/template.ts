import type { ContentTemplate } from '../content';
import { clampText, type Board } from './mandalart';

/**
 * 예시 템플릿으로 판의 내용을 채워요. 판 id·createdAt 은 그대로 두고 글만 바꿔요.
 * (기존 글은 모두 덮어써요 — 호출하는 쪽에서 확인 다이얼로그를 띄워요.)
 */
export function boardFromTemplate(board: Board, template: ContentTemplate, now: number): Board {
  return {
    ...board,
    goal: clampText(template.goal),
    subs: template.subs.map((sub) => ({ title: clampText(sub.title), actions: sub.actions.map(clampText) })),
    templateId: template.id,
    updatedAt: now,
  };
}
