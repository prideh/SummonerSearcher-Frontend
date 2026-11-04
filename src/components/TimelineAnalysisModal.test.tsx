import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAP_COORD_ORIGIN_X,
  MAP_COORD_ORIGIN_Y,
  MAP_COORD_SIZE_X,
  MAP_COORD_SIZE_Y,
  projectToMinimapCanvas,
  PowerSpikeTooltip,
  EventDot,
} from './TimelineAnalysisModal';
import { useDataDragonStore } from '../store/dataDragonStore';
import type { PowerSpikePoint } from '../types/timeline';

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

describe('PowerSpikeTooltip and EventDot (#4)', () => {
  beforeEach(() => {
    useDataDragonStore.setState({
      cdnUrl: 'https://ddragon.leagueoflegends.com/cdn/16.22.1',
      itemMap: {
        '3157': {
          name: "Zhonya's Hourglass",
          description: 'Stasis active',
          plaintext: 'Armor and AP',
          gold: { base: 400, total: 3250, sell: 2275, purchasable: true },
        },
        '3155': {
          name: 'Hexdrinker',
          description: 'Magic shield',
          plaintext: 'AD and MR',
          gold: { base: 350, total: 1300, sell: 910, purchasable: true },
        },
      },
    });
  });

  it('renders playerItems and opponentItems purchased at that minute in PowerSpikeTooltip', () => {
    const point: PowerSpikePoint = {
      minute: 11,
      playerGold: 4200,
      opponentGold: 3800,
      playerGoldLead: 400,
      playerXp: 4900,
      opponentXp: 4600,
      playerCs: 88,
      opponentCs: 79,
      playerItems: [3157],
      opponentItems: [3155, 9999],
      events: [],
    };

    render(<PowerSpikeTooltip active={true} label={11} payload={[{ payload: point }]} />);

    expect(screen.getByText('Minute 11')).toBeInTheDocument();
    expect(screen.getByText('+400g lead')).toBeInTheDocument();
    expect(screen.getByText('You Bought')).toBeInTheDocument();
    expect(screen.getByText("Zhonya's Hourglass")).toBeInTheDocument();
    expect(screen.getByText('Opp Bought')).toBeInTheDocument();
    expect(screen.getByText('Hexdrinker')).toBeInTheDocument();
    expect(screen.getByText('Item 9999')).toBeInTheDocument();
  });

  it('renders ASSIST and OBJECTIVE events in PowerSpikeTooltip and EventDot', () => {
    const point: PowerSpikePoint = {
      minute: 14,
      playerGold: 5500,
      opponentGold: 5100,
      playerGoldLead: 400,
      playerXp: 6200,
      opponentXp: 5900,
      playerCs: 112,
      opponentCs: 104,
      playerItems: [],
      opponentItems: [],
      events: [
        {
          type: 'ASSIST',
          minuteMark: 14,
          secondMark: 12,
          actor: 'Ahri',
          target: 'Zed',
          isPlayer: true,
          isOpponent: false,
          laneType: null,
          monsterType: null,
          position: { x: 7200, y: 7400 },
        },
        {
          type: 'OBJECTIVE',
          minuteMark: 14,
          secondMark: 45,
          actor: 'LeeSin',
          target: 'DRAGON',
          isPlayer: false,
          isOpponent: true,
          laneType: null,
          monsterType: 'DRAGON',
          position: { x: 9866, y: 4414 },
        },
      ],
    };

    render(<PowerSpikeTooltip active={true} label={14} payload={[{ payload: point }]} />);

    expect(screen.getByText('Ahri')).toBeInTheDocument();
    expect(screen.getByText(/assisted on/)).toBeInTheDocument();
    expect(screen.getByText('Zed')).toBeInTheDocument();
    expect(screen.getByText('DRAGON')).toBeInTheDocument();
    expect(screen.getByText(/secured/)).toBeInTheDocument();

    const { container } = render(
      <svg>
        <EventDot cx={100} cy={100} payload={point} dataKey="playerGold" />
        <EventDot cx={120} cy={100} payload={point} dataKey="opponentGold" />
      </svg>
    );
    expect(container.textContent).toContain('🤝');
    expect(container.textContent).toContain('🏰');
  });
});
