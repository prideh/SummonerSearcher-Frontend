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
      screen.getByText(/10m\/20m timeline preparation timed out/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/i)).not.toBeInTheDocument();

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

  it('clears starter chips on ---SUGGESTIONS--- [], restores 3 chips on next real coaching turn, and clears prior-turn chips on subsequent ---SUGGESTIONS--- []', async () => {
    vi.mocked(chatWithAi)
      .mockResolvedValueOnce({
        response:
          'I focus exclusively on solo queue coaching rather than travel planning.\n---SUGGESTIONS--- []',
        interactionId: 'offtopic-1',
      })
      .mockResolvedValueOnce({
        response:
          'Across your last 20 detailed matches, your 10:00 lane CS averages 72.9 across 14 laner games.\n---SUGGESTIONS--- ["How is my Pantheon 10-minute CS?", "Which deaths gave up shutdown gold?", "Compare recent to saved matches"]',
        interactionId: 'coaching-2',
      })
      .mockResolvedValueOnce({
        response:
          'I focus exclusively on League of Legends coaching rather than medical advice.\n---SUGGESTIONS--- []',
        interactionId: 'offtopic-3',
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

    // Starter personalized suggestions are visible on open
    const starterBar = screen.getByTestId('ai-coach-suggestions');
    expect(starterBar.querySelectorAll('button').length).toBeGreaterThan(0);

    // 1. Off-topic refusal with ---SUGGESTIONS--- [] clears starter chips completely
    fireEvent.change(screen.getByTestId('ai-coach-input'), {
      target: { value: 'Can you help me plan a three-day holiday in Rome?' },
    });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(() => {
      expect(
        screen.getByText('I focus exclusively on solo queue coaching rather than travel planning.')
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/---SUGGESTIONS---/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-coach-suggestions')).not.toBeInTheDocument();

    // 2. Empty -> real 3: next real coaching turn renders exact 3 follow-up suggestion chips
    fireEvent.change(screen.getByTestId('ai-coach-input'), {
      target: { value: 'What do my 10-minute lane CS numbers show?' },
    });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Across your last 20 detailed matches, your 10:00 lane CS averages 72.9 across 14 laner games.'
        )
      ).toBeInTheDocument();
    });
    const realBar = screen.getByTestId('ai-coach-suggestions');
    const realButtons = Array.from(realBar.querySelectorAll('button')).map((b) => b.textContent);
    expect(realButtons).toEqual([
      'How is my Pantheon 10-minute CS?',
      'Which deaths gave up shutdown gold?',
      'Compare recent to saved matches',
    ]);

    // 3. Prior-turn 3 chips -> ---SUGGESTIONS--- [] clears prior coaching chips too
    fireEvent.change(screen.getByTestId('ai-coach-input'), {
      target: { value: 'How can I heal a sore throat?' },
    });
    fireEvent.click(screen.getByTestId('ai-coach-send-button'));

    await waitFor(() => {
      expect(
        screen.getByText('I focus exclusively on League of Legends coaching rather than medical advice.')
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ai-coach-suggestions')).not.toBeInTheDocument();
  });

  it('preserves starter and prior-turn suggestion chips when ---SUGGESTIONS--- is absent or malformed', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.mocked(chatWithAi)
        .mockResolvedValueOnce({
          response: 'Focus on crashing wave 3 before resetting.',
          interactionId: 'absent-1',
        })
        .mockResolvedValueOnce({
          response:
            'Track enemy defensive cooldowns.\n---SUGGESTIONS--- ["When should I trade on Pantheon?", "Check my unspent gold", "Compare Blue and Red side"]',
          interactionId: 'valid-2',
        })
        .mockResolvedValueOnce({
          response: 'Check minimap jungler last-seen.\n---SUGGESTIONS--- [malformed unquoted]',
          interactionId: 'malformed-3',
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

      const initialChips = Array.from(
        screen.getByTestId('ai-coach-suggestions').querySelectorAll('button')
      ).map((b) => b.textContent);
      expect(initialChips.length).toBeGreaterThan(0);

      // 1. Absent ---SUGGESTIONS--- keeps starter chips
      fireEvent.change(screen.getByTestId('ai-coach-input'), {
        target: { value: 'Quick early wave tip?' },
      });
      fireEvent.click(screen.getByTestId('ai-coach-send-button'));

      await waitFor(() => {
        expect(screen.getByText('Focus on crashing wave 3 before resetting.')).toBeInTheDocument();
      });
      const afterAbsentChips = Array.from(
        screen.getByTestId('ai-coach-suggestions').querySelectorAll('button')
      ).map((b) => b.textContent);
      expect(afterAbsentChips).toEqual(initialChips);

      // 2. Valid 3-item ---SUGGESTIONS--- updates chips
      fireEvent.change(screen.getByTestId('ai-coach-input'), {
        target: { value: 'How about trade windows?' },
      });
      fireEvent.click(screen.getByTestId('ai-coach-send-button'));

      await waitFor(() => {
        expect(screen.getByText('Track enemy defensive cooldowns.')).toBeInTheDocument();
      });
      const validThree = [
        'When should I trade on Pantheon?',
        'Check my unspent gold',
        'Compare Blue and Red side',
      ];
      expect(
        Array.from(screen.getByTestId('ai-coach-suggestions').querySelectorAll('button')).map(
          (b) => b.textContent
        )
      ).toEqual(validThree);

      // 3. Malformed ---SUGGESTIONS--- strips raw delimiter tail and preserves prior 3 chips
      fireEvent.change(screen.getByTestId('ai-coach-input'), {
        target: { value: 'One more reset check?' },
      });
      fireEvent.click(screen.getByTestId('ai-coach-send-button'));

      await waitFor(() => {
        expect(screen.getByText('Check minimap jungler last-seen.')).toBeInTheDocument();
      });
      expect(screen.queryByText(/---SUGGESTIONS---/)).not.toBeInTheDocument();
      expect(
        Array.from(screen.getByTestId('ai-coach-suggestions').querySelectorAll('button')).map(
          (b) => b.textContent
        )
      ).toEqual(validThree);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

