import { describe, it, expect } from 'vitest';
import {
  MAP_COORD_ORIGIN_X,
  MAP_COORD_ORIGIN_Y,
  MAP_COORD_SIZE_X,
  MAP_COORD_SIZE_Y,
  projectToMinimapCanvas,
} from './TimelineAnalysisModal';

describe('TimelineAnalysisModal minimap projection', () => {
  const CANVAS_SIZE = 512;

  it('uses calibrated Map11 MinimapBackground bounds (origin 0,0 and size 14850x14850)', () => {
    expect(MAP_COORD_ORIGIN_X).toBe(0);
    expect(MAP_COORD_ORIGIN_Y).toBe(0);
    expect(MAP_COORD_SIZE_X).toBe(14850);
    expect(MAP_COORD_SIZE_Y).toBe(14850);
  });

  it('maps world origin (0, 0) to bottom-left and (14850, 14850) to top-right', () => {
    expect(projectToMinimapCanvas(0, 0, CANVAS_SIZE, CANVAS_SIZE)).toEqual({
      cx: 0,
      cy: 512,
    });
    expect(projectToMinimapCanvas(14850, 14850, CANVAS_SIZE, CANVAS_SIZE)).toEqual({
      cx: 512,
      cy: 0,
    });
  });

  it('places Blue and Red fountain shrines 4-10px inside their respective corners on 512x512', () => {
    // Turret_OrderTurretShrine (105, 134) and Turret_ChaosTurretShrine (14576, 14693)
    const blueShrine = projectToMinimapCanvas(105, 134, CANVAS_SIZE, CANVAS_SIZE);
    const redShrine = projectToMinimapCanvas(14576, 14693, CANVAS_SIZE, CANVAS_SIZE);

    expect(blueShrine.cx).toBeCloseTo((105 / 14850) * 512, 5);
    expect(512 - blueShrine.cy).toBeCloseTo((134 / 14850) * 512, 5);

    expect(512 - redShrine.cx).toBeCloseTo(((14850 - 14576) / 14850) * 512, 5);
    expect(redShrine.cy).toBeCloseTo(((14850 - 14693) / 14850) * 512, 5);
  });

  it('projects outer lane turrets to symmetric top-left and bottom-right lane positions', () => {
    // BLUE_TOP_LANE_OUTER_TURRET (981, 10441) and BLUE_BOT_LANE_OUTER_TURRET (10504, 1029)
    const topOuter = projectToMinimapCanvas(981, 10441, CANVAS_SIZE, CANVAS_SIZE);
    const botOuter = projectToMinimapCanvas(10504, 1029, CANVAS_SIZE, CANVAS_SIZE);

    // Top outer turret is near left edge (low cx) and upper half (low cy)
    expect(topOuter.cx).toBeLessThan(40);
    expect(topOuter.cy).toBeLessThan(160);

    // Bot outer turret is in right half (high cx) and near bottom edge (high cy)
    expect(botOuter.cx).toBeGreaterThan(350);
    expect(botOuter.cy).toBeGreaterThan(470);
  });
});
