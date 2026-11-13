// Integration check: migrations, repo, demo data, insights and backup round-trip on a real SQLite.
import { describe, expect, it } from 'vitest';
import * as repo from '../repo';
import { generateDemoData } from '../../lib/demo';
import * as insights from '../../lib/insights';
import { exportJSON, importJSON, buildCSV } from '../../lib/backup';

describe('db integration', () => {
  it('logs a workout end-to-end', () => {
    repo.addMeasurement('weight', 82.5);
    repo.addMeasurement('weight', 82.1); // same day replaces
    expect(repo.listMeasurements('weight')).toHaveLength(1);
    const w = repo.startWorkout('chest');
    expect(repo.getActiveWorkout()?.id).toBe(w);
    const we = repo.addWorkoutExercise(w, 'bench');
    repo.addSet(we, { weight: 60, reps: 10, restSec: null, isWarmup: true, note: null, durationSec: null, distanceM: null });
    repo.addSet(we, { weight: 100, reps: 5, restSec: 120, isWarmup: false, note: 'easy', durationSec: null, distanceM: null });
    repo.addWorkoutExercise(w, 'curl'); // empty → dropped on finish
    expect(repo.finishWorkout(w)).toBe(true);
    const done = repo.getWorkout(w)!;
    expect(done.exercises).toHaveLength(1);
    expect(done.exercises[0].sets.map((s) => s.isWarmup)).toEqual([true, false]);
    expect(repo.lastSetsFor('bench')).toHaveLength(2);
    expect(repo.exerciseSessions('bench')[0].sets).toHaveLength(2);
    const tpl = repo.saveTemplate({ name: 'Chest', workoutType: 'chest', exercises: [{ exerciseId: 'bench', sets: 5, warmupSets: 2 }] });
    expect(repo.getTemplate(tpl)?.exercises[0].sets).toBe(5);
  });

  it('demo data + insights + backup', () => {
    generateDemoData();
    expect(repo.listMeasurements('weight').length).toBeGreaterThan(100);
    expect(repo.listWorkouts().length).toBeGreaterThan(40);
    const ws = insights.weightSummary();
    expect(ws.current).toBeGreaterThan(70);
    const st = insights.strengthSummary();
    expect(st.index.combined.length).toBeGreaterThan(10);
    insights.volumeSummary();
    insights.consistencySummary();
    insights.hints();
    insights.relativeStrengthFor('bench');
    const dump = exportJSON();
    const csv = buildCSV();
    expect(csv.split('\n').length).toBeGreaterThan(100);
    const counts = [repo.listWorkouts().length, repo.listMeasurements('weight').length];
    importJSON(JSON.parse(JSON.stringify(dump)), 'replace');
    expect([repo.listWorkouts().length, repo.listMeasurements('weight').length]).toEqual(counts);
    importJSON(JSON.parse(JSON.stringify(dump)), 'merge');
    expect(repo.listWorkouts().length).toBe(counts[0]);
    repo.wipeDemo();
    repo.wipeAll();
    expect(repo.listWorkouts()).toHaveLength(0);
  });
});
