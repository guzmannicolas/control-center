import { describe, expect, it } from 'vitest';
import {
  CITY_ARCHETYPES,
  CITY_DISTRICTS,
  CITY_JOURNEYS,
  SOFTWARE_ANALOGIES,
} from './analogiesData.ts';
import { PYTHON_LESSONS } from './PythonStudio.tsx';
import { RAG_STAGES } from './RagStudio.tsx';

describe('interactive python studio lessons', () => {
  it('has valid lessons with unique ids and categories', () => {
    const ids = PYTHON_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lesson of PYTHON_LESSONS) {
      expect(lesson.title.length).toBeGreaterThan(5);
      expect(lesson.category.length).toBeGreaterThan(2);
      expect(lesson.steps.length).toBeGreaterThanOrEqual(3);
      expect(lesson.productionTip.length).toBeGreaterThan(15);
    }
  });

  it('has valid quizzes where answers point to existing options', () => {
    for (const lesson of PYTHON_LESSONS) {
      const q = lesson.quiz;
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(q.options[q.answer]).toBeDefined();
      expect(q.explanation.length).toBeGreaterThan(10);
    }
  });

  it('has coherent code lines and stack/heap models for every step', () => {
    for (const lesson of PYTHON_LESSONS) {
      for (const step of lesson.steps) {
        expect(step.codeLine).toBeGreaterThanOrEqual(0);
        expect(step.codeLine).toBeLessThan(lesson.code.length);
        expect(step.stack.length).toBeGreaterThanOrEqual(1);
        expect(step.heap.length).toBeGreaterThanOrEqual(1);
        expect(step.explanation.length).toBeGreaterThan(10);
      }
    }
  });
});

describe('modern rag studio stages', () => {
  it('has all 5 fundamental stages in sequence', () => {
    expect(RAG_STAGES.length).toBe(5);
    const ids = RAG_STAGES.map((s) => s.id);
    expect(ids).toEqual([
      'query-expansion',
      'hybrid-retrieval',
      'reranking',
      'context-assembly',
      'agentic-crag',
    ]);
  });

  it('includes production Python snippets and industry standard tools for each stage', () => {
    for (const stage of RAG_STAGES) {
      expect(stage.industryStandard.length).toBeGreaterThan(10);
      expect(stage.pythonSnippet).toContain('def ');
      expect(stage.description.length).toBeGreaterThan(20);
    }
  });
});

describe('software city real-world analogies studio', () => {
  it('defines all 6 city districts and 100 complete software analogies with unique ids', () => {
    expect(CITY_DISTRICTS.length).toBe(6);
    expect(SOFTWARE_ANALOGIES.length).toBe(100);
    const ids = SOFTWARE_ANALOGIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(SOFTWARE_ANALOGIES.length);
  });

  it('provides complete visual scenes, building names, and before/after comparisons for every concept', () => {
    const validDistrictIds = new Set(CITY_DISTRICTS.map((d) => d.id));
    for (const item of SOFTWARE_ANALOGIES) {
      expect(validDistrictIds.has(item.district)).toBe(true);
      expect(item.term.length).toBeGreaterThan(1);
      expect(item.buildingName.length).toBeGreaterThan(3);
      expect(item.analogy.length).toBeGreaterThan(20);
      expect(item.technicalRole.length).toBeGreaterThan(15);
      expect(item.scene.leftLabel.length).toBeGreaterThan(1);
      expect(item.scene.actionLabel.length).toBeGreaterThan(1);
      expect(item.scene.rightLabel.length).toBeGreaterThan(1);
      expect(item.scene.withoutIt.length).toBeGreaterThan(15);
      expect(item.scene.withIt.length).toBeGreaterThan(15);
    }
  });

  it('defines all 5 urban architectural archetypes and 4 animated city journeys', () => {
    expect(CITY_ARCHETYPES.length).toBe(5);
    for (const arch of CITY_ARCHETYPES) {
      expect(arch.diagramNodes.length).toBe(3);
    }
    expect(CITY_JOURNEYS.length).toBe(4);
    for (const journey of CITY_JOURNEYS) {
      expect(journey.steps.length).toBeGreaterThanOrEqual(4);
    }
  });
});
