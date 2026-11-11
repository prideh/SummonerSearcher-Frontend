import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AiAnalysisModal, { type AiContextData } from './AiAnalysisModal';
import { chatWithAi } from '../api/ai';

vi.mock('../api/ai', () => ({
  chatWithAi: vi.fn(),
  submitFeedback: vi.fn(),
}));

const makeContext = (overrides: Partial<AiContextData> = {}): AiContextData => ({
  summonerName: 'pride#persi',
  primaryRole: 'TOP',
  totalGamesAnalyzed: 3,
  timelineStatus: 'NOT_RUN',
  ...overrides,
});

describe('AiAnalysisModal greeting top-anchor and substantive bottom-scroll', () => {
  let scrollIntoViewSpy: ReturnType<typeof vi.fn<Element['scrollIntoView']>>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    scrollIntoViewSpy = vi.fn<Element['scrollIntoView']>();
    Element.prototype.scrollIntoView = scrollIntoViewSpy;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('anchors chat scroll container at top (scrollTop = 0) without scrollIntoView on greeting-only open and timeline state transitions with Show Evidence expanded', () => {
    const { rerender } = render(
      <AiAnalysisModal
        isOpen={true}
        onClose={() => {}}
        summonerName="pride#persi"
        puuid="puuid-pride-persi"
        context={makeContext({ timelineStatus: 'NOT_RUN' })}
        loadingTimeline={true}
      />
    );

    const chatScroll = screen.getByTestId('ai-coach-chat-scroll');
    expect(chatScroll.scrollTop).toBe(0);
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/Hi! I'm your AI Coach\./i)).toBeInTheDocument();

    // Expand Show Evidence drawer and simulate prior non-zero scroll position before greeting settles
    fireEvent.click(screen.getByTestId('ai-coach-evidence-toggle'));
    expect(screen.getByTestId('ai-coach-evidence-drawer')).toBeInTheDocument();
    chatScroll.scrollTop = 148;

    // Transition from loadingTimeline=true -> settled BLOCKED greeting
    rerender(
      <AiAnalysisModal
        isOpen={true}
        onClose={() => {}}
        summonerName="pride#persi"
        puuid="puuid-pride-persi"
        context={makeContext({
          timelineStatus: 'BLOCKED',
          timelineCoverage: {
            status: 'BLOCKED',
            covered: 0,
            requested: 3,
            stopReason: 'DEADLINE_EXCEEDED',
          },
        })}
        loadingTimeline={false}
      />
    );

    expect(chatScroll.scrollTop).toBe(0);
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText(/minute-by-minute timeline checkpoints are temporarily unavailable/i)
    ).toBeInTheDocument();

    // Transition to ANALYZED greeting also preserves top-anchor without bottom scrollIntoView
    chatScroll.scrollTop = 96;
    rerender(
      <AiAnalysisModal
        isOpen={true}
        onClose={() => {}}
        summonerName="pride#persi"
        puuid="puuid-pride-persi"
        context={makeContext({
          timelineStatus: 'ANALYZED',
          timelineCoverage: {
            status: 'COMPLETE',
            covered: 3,
            requested: 3,
            stopReason: null,
          },
        })}
        hasTimelineAnalysis={true}
        loadingTimeline={false}
      />
    );

    expect(chatScroll.scrollTop).toBe(0);
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it('preserves bottom scrollIntoView for substantive user/assistant messages and resets to scrollTop = 0 on Clear Chat', async () => {
    vi.mocked(chatWithAi).mockResolvedValueOnce({
      response: 'Focus on crashing wave 3 cleanly before river crab spawns.',
      interactionId: 'interaction-123',
    });

    render(
      <AiAnalysisModal
        isOpen={true}
        onClose={() => {}}
        summonerName="pride#persi"
        puuid="puuid-pride-persi"
        context={makeContext({ timelineStatus: 'ANALYZED' })}
        hasTimelineAnalysis={true}
        loadingTimeline={false}
      />
    );

    const chatScroll = screen.getByTestId('ai-coach-chat-scroll');
    expect(chatScroll.scrollTop).toBe(0);
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();

    // Send a substantive user message -> bottom scrollIntoView must fire
    fireEvent.change(screen.getByTestId('ai-coach-input'), {
      target: { value: 'How can I improve my early lane?' },
    });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(() => {
      expect(
        screen.getByText('Focus on crashing wave 3 cleanly before river crab spawns.')
      ).toBeInTheDocument();
    });
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });

    // Simulate scrolled chat container, then Clear Chat -> returns to greeting-only top-anchor
    scrollIntoViewSpy.mockClear();
    chatScroll.scrollTop = 220;
    fireEvent.click(screen.getByRole('button', { name: 'Clear Chat' }));

    expect(chatScroll.scrollTop).toBe(0);
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it('calls bottom scrollIntoView when opening with valid saved substantive conversation history', () => {
    localStorage.setItem(
      'chat_history_pride#persi',
      JSON.stringify({
        timestamp: Date.now(),
        messages: [
          { role: 'model', content: "Hi! I'm your AI Coach." },
          { role: 'user', content: 'Review my deaths' },
          {
            role: 'model',
            content: 'Two deaths happened past river without ward coverage.',
            interactionId: 'saved-1',
          },
        ],
        suggestions: ['What about 10m CS?'],
      })
    );

    render(
      <AiAnalysisModal
        isOpen={true}
        onClose={() => {}}
        summonerName="pride#persi"
        puuid="puuid-pride-persi"
        context={makeContext({ timelineStatus: 'ANALYZED' })}
        hasTimelineAnalysis={true}
        loadingTimeline={false}
      />
    );

    expect(
      screen.getByText('Two deaths happened past river without ward coverage.')
    ).toBeInTheDocument();
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});
