import { describe, expect, it } from 'vitest';

import { getBundledContent } from '../content';
import { createEmptyBoard, getProgress } from './mandalart';
import { boardFromTemplate } from './template';

const NOW = 1759000000000;

describe('boardFromTemplate', () => {
  it('템플릿 글로 73칸을 채우고 id·createdAt 은 지켜요', () => {
    const template = getBundledContent().templates[0];
    const board = createEmptyBoard(NOW);
    board.goal = '지워질 글';
    const next = boardFromTemplate(board, template, NOW + 5);
    expect(next.id).toBe(board.id);
    expect(next.createdAt).toBe(NOW);
    expect(next.updatedAt).toBe(NOW + 5);
    expect(next.templateId).toBe(template.id);
    expect(next.goal).toBe(template.goal);
    expect(next.subs[7].actions[7]).toBe(template.subs[7].actions[7]);
    expect(getProgress(next).filled).toBe(73);
  });
});
