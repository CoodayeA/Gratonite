import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScreenShareModal from '../../../../src/components/modals/ScreenShareModal';

const addToastMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/components/ui/ToastManager', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

function setDesktopBridge(getScreenSources: () => Promise<Array<{
  id: string;
  name: string;
  thumbnailDataUrl: string;
  displayId: string;
  appIconDataUrl: string | null;
}>>) {
  window.gratoniteDesktop = {
    isDesktop: true,
    getScreenSources,
  };
}

describe('ScreenShareModal', () => {
  beforeEach(() => {
    addToastMock.mockReset();
  });

  afterEach(() => {
    delete window.gratoniteDesktop;
  });

  it('starts desktop sharing with the selected source', async () => {
    const onStartScreenShare = vi.fn().mockResolvedValue(undefined);

    setDesktopBridge(vi.fn().mockResolvedValue([
      { id: 'screen:1', name: 'Display 1', thumbnailDataUrl: 'data:image/png;base64,abc', displayId: '1', appIconDataUrl: null, type: 'screen' },
      { id: 'window:2', name: 'Code', thumbnailDataUrl: 'data:image/png;base64,def', displayId: '2', appIconDataUrl: null, type: 'window' },
    ]));

    render(
      <ScreenShareModal
        isOpen
        onClose={vi.fn()}
        onStartScreenShare={onStartScreenShare}
      />
    );

    // Switch to Application Window tab to see the "Code" window.
    fireEvent.click(await screen.findByRole('button', { name: /application window/i }));
    fireEvent.click(await screen.findByText('Code'));
    fireEvent.click(screen.getByRole('button', { name: /start sharing/i }));

    await waitFor(() => {
      expect(onStartScreenShare).toHaveBeenCalledWith('window:2');
    });
    // After share starts, header shows "Your Screen" with a Live badge.
    expect(await screen.findByText('Your Screen')).toBeInTheDocument();
  });

  it('clears stale desktop selection when reopened without available sources', async () => {
    const getScreenSources = vi.fn()
      .mockResolvedValueOnce([
        { id: 'screen:1', name: 'Display 1', thumbnailDataUrl: 'data:image/png;base64,abc', displayId: '1', appIconDataUrl: null },
      ])
      .mockResolvedValueOnce([]);

    setDesktopBridge(getScreenSources);

    const { rerender } = render(
      <ScreenShareModal
        isOpen
        onClose={vi.fn()}
        onStartScreenShare={vi.fn()}
      />
    );

    await screen.findAllByText('Display 1');
    expect(screen.getByRole('button', { name: /start sharing/i })).toBeEnabled();

    rerender(
      <ScreenShareModal
        isOpen={false}
        onClose={vi.fn()}
        onStartScreenShare={vi.fn()}
      />
    );

    rerender(
      <ScreenShareModal
        isOpen
        onClose={vi.fn()}
        onStartScreenShare={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(getScreenSources).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start sharing/i })).toBeDisabled();
    });
  });

  it('stops sharing and closes the modal', async () => {
    const onStopScreenShare = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ScreenShareModal
        isOpen
        onClose={onClose}
        onStopScreenShare={onStopScreenShare}
        isLiveKitScreenSharing
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /stop sharing/i }));

    await waitFor(() => {
      expect(onStopScreenShare).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
