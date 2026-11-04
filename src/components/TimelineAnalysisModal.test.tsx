import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TimelineAnalysisModal, {
  MAP_COORD_ORIGIN_X,
  MAP_COORD_ORIGIN_Y,
  MAP_COORD_SIZE_X,
  MAP_COORD_SIZE_Y,
  projectToMinimapCanvas,
  PowerSpikeTooltip,
  EventDot,
  findHoveredHeatmapEvents,
  formatHeatmapEventTime,
  type HeatmapLayer,
} from './TimelineAnalysisModal';
import { useDataDragonStore } from '../store/dataDragonStore';
import type { PowerSpikePoint, TimelineAnalysisDto, MatchEventEntry } from '../types/timeline';

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

describe('Heatmap hover tooltips (#7)', () => {
  const sampleEvents: MatchEventEntry[] = [
    {
      type: 'KILL',
      minuteMark: 8,
      secondMark: 42,
      actor: 'Ahri',
      target: 'Zed',
      isPlayer: true,
      isOpponent: false,
      laneType: 'MID_LANE',
      monsterType: null,
      position: { x: 7425, y: 7425 }, // exact center of 14850x14850 -> (256, 256) on 512x512
    },
    {
      type: 'WARD_PLACED',
      minuteMark: 12,
      secondMark: 5,
      actor: 'Ahri',
      target: null,
      isPlayer: true,
      isOpponent: false,
      laneType: null,
      monsterType: null,
      position: { x: 3712.5, y: 11137.5 }, // (128, 128) on 512x512
    },
  ];

  it('formats event timestamps as MM:SS and hit-tests events within radius', () => {
    expect(formatHeatmapEventTime(8, 42)).toBe('08:42');
    expect(formatHeatmapEventTime(12, 5)).toBe('12:05');

    const allLayers = new Set<HeatmapLayer>(['positions', 'kills', 'deaths', 'assists', 'wards']);
    const hitKill = findHoveredHeatmapEvents(sampleEvents, 260, 252, 512, 512, allLayers, 15);
    expect(hitKill).toHaveLength(1);
    expect(hitKill[0].actor).toBe('Ahri');
    expect(hitKill[0].target).toBe('Zed');

    // Out of radius
    const miss = findHoveredHeatmapEvents(sampleEvents, 10, 10, 512, 512, allLayers, 15);
    expect(miss).toHaveLength(0);

    // Filtered out when timelineMinute is before the event
    const beforeEvent = findHoveredHeatmapEvents(sampleEvents, 256, 256, 512, 512, allLayers, 5);
    expect(beforeEvent).toHaveLength(0);

    // Filtered out when layer is toggled off
    const noKillLayer = new Set<HeatmapLayer>(['positions', 'deaths', 'assists', 'wards']);
    const layerOff = findHoveredHeatmapEvents(sampleEvents, 256, 256, 512, 512, noKillLayer, 15);
    expect(layerOff).toHaveLength(0);
  });

  it('displays floating tooltip with timestamp, actor/target, and champion icons on canvas hover', () => {
    const analysis: TimelineAnalysisDto = {
      heatmapPositions: [],
      killPositions: [{ x: 7425, y: 7425, matchId: 'NA1_1', minute: 8 }],
      deathPositions: [],
      assistPositions: [],
      wardPositions: [{ x: 3712.5, y: 11137.5, matchId: 'NA1_1', minute: 12 }],
      buildOrders: [],
      skillOrders: [],
      powerSpikeTimelines: [
        {
          matchId: 'NA1_1',
          playerChampion: 'Ahri',
          opponentChampion: 'Zed',
          win: true,
          points: [
            {
              minute: 0,
              playerGold: 500,
              opponentGold: 500,
              playerGoldLead: 0,
              playerXp: 0,
              opponentXp: 0,
              playerCs: 0,
              opponentCs: 0,
              playerItems: [],
              opponentItems: [],
              events: [],
            },
            {
              minute: 15,
              playerGold: 5500,
              opponentGold: 5000,
              playerGoldLead: 500,
              playerXp: 6000,
              opponentXp: 5700,
              playerCs: 110,
              opponentCs: 100,
              playerItems: [],
              opponentItems: [],
              events: [],
            },
          ],
        },
      ],
      eventTimelines: [
        {
          matchId: 'NA1_1',
          playerChampion: 'Ahri',
          opponentChampion: 'Zed',
          win: true,
          events: sampleEvents,
        },
      ],
      aggregateSummary: {
        gamesAnalyzed: 1,
        killsTotal: 1,
        deathsTotal: 0,
        assistsTotal: 0,
        wardsPlacedTotal: 1,
        avgFirstDeathMinute: 0,
        mostDangerousZone: 'Mid Lane',
        avgGoldLeadAt10: 250,
        avgGoldLeadAt15: 500,
      },
    };

    render(
      <TimelineAnalysisModal
        isOpen={true}
        onClose={vi.fn()}
        analysis={analysis}
        summonerName="Faker"
        onOpenAiCoach={vi.fn()}
      />
    );

    const canvas = screen.getByTestId('heatmap-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 512,
      height: 512,
      right: 512,
      bottom: 512,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseMove(canvas, { clientX: 256, clientY: 256 });

    const tooltip = screen.getByTestId('heatmap-hover-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('08:42 -');
    expect(tooltip).toHaveTextContent('Ahri killed Zed');
    expect(screen.getByAltText('Ahri')).toBeInTheDocument();
    expect(screen.getByAltText('Zed')).toBeInTheDocument();

    fireEvent.mouseLeave(canvas);
    expect(screen.queryByTestId('heatmap-hover-tooltip')).not.toBeInTheDocument();
  });
});

describe('Player Heatmap render state and minimap resilience (#11)', () => {
  beforeEach(() => {
    useDataDragonStore.setState({
      cdnUrl: 'https://ddragon.leagueoflegends.com/cdn/16.22.1',
      itemMap: {},
    });
  });

  it('draws heatmapPositions onto the canvas immediately on open without sticking on the loading spinner', () => {
    const arcSpy = vi.fn();
    const fillSpy = vi.fn();
    const clearRectSpy = vi.fn();
    const beginPathSpy = vi.fn();
    const fillTextSpy = vi.fn();

    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        clearRect: clearRectSpy,
        beginPath: beginPathSpy,
        arc: arcSpy,
        fill: fillSpy,
        fillText: fillTextSpy,
        fillStyle: '',
        font: '',
        textAlign: 'center',
        textBaseline: 'middle',
      } as unknown as RenderingContext);

    const analysis: TimelineAnalysisDto = {
      heatmapPositions: [
        { x: 1200, y: 1400, matchId: 'EUW1_101', minute: 3 },
        { x: 7425, y: 7425, matchId: 'EUW1_101', minute: 10 },
        { x: 11200, y: 10800, matchId: 'EUW1_101', minute: 18 },
      ],
      killPositions: [{ x: 7425, y: 7425, matchId: 'EUW1_101', minute: 10 }],
      deathPositions: [],
      assistPositions: [],
      wardPositions: [],
      buildOrders: [],
      skillOrders: [],
      powerSpikeTimelines: [
        {
          matchId: 'EUW1_101',
          playerChampion: 'Orianna',
          opponentChampion: 'Syndndra',
          win: true,
          points: [
            {
              minute: 0,
              playerGold: 500,
              opponentGold: 500,
              playerGoldLead: 0,
              playerXp: 0,
              opponentXp: 0,
              playerCs: 0,
              opponentCs: 0,
              playerItems: [],
              opponentItems: [],
              events: [],
            },
            {
              minute: 20,
              playerGold: 7800,
              opponentGold: 7100,
              playerGoldLead: 700,
              playerXp: 9200,
              opponentXp: 8700,
              playerCs: 168,
              opponentCs: 152,
              playerItems: [],
              opponentItems: [],
              events: [],
            },
          ],
        },
      ],
      eventTimelines: [],
      aggregateSummary: {
        gamesAnalyzed: 1,
        killsTotal: 1,
        deathsTotal: 0,
        assistsTotal: 0,
        wardsPlacedTotal: 0,
        avgFirstDeathMinute: 0,
        mostDangerousZone: 'Mid Lane',
        avgGoldLeadAt10: 300,
        avgGoldLeadAt15: 550,
      },
    };

    render(
      <TimelineAnalysisModal
        isOpen={true}
        onClose={vi.fn()}
        analysis={analysis}
        summonerName="Caps"
        onOpenAiCoach={vi.fn()}
      />
    );

    // Loading spinner must not block the heatmap when analysis payload is present
    expect(screen.queryByTestId('heatmap-loading-spinner')).not.toBeInTheDocument();

    // All 3 heatmapPositions for match EUW1_101 should be drawn immediately on the canvas
    expect(arcSpy).toHaveBeenCalledTimes(3);
    expect(fillSpy).toHaveBeenCalledTimes(3);
    expect(fillTextSpy).toHaveBeenCalledWith('⚔️', 256, 256);

    // Minimap img does not force anonymous CORS and falls back to DDragon Map 11 on error
    const minimapImg = screen.getByAltText('League of Legends Minimap') as HTMLImageElement;
    expect(minimapImg).not.toHaveAttribute('crossOrigin');
    fireEvent.error(minimapImg);
    expect(minimapImg.getAttribute('src')).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.22.1/img/map/map11.png'
    );
    expect(screen.queryByTestId('heatmap-loading-spinner')).not.toBeInTheDocument();

    getContextSpy.mockRestore();
  });
});


