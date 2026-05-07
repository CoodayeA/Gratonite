import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TextReaction from '../../../../src/components/chat/TextReaction';

const apiGetMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../../src/components/ui/ToastManager', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

describe('TextReaction', () => {
  it('uses hydrated reactions without fetching on mount', () => {
    render(
      <TextReaction
        messageId="message-1"
        channelId="channel-1"
        currentUserId="user-1"
        initialReactions={[
          {
            text: 'same',
            count: 1,
            users: [{ id: 'user-2', username: 'reactor', displayName: 'Reactor' }],
          },
        ]}
      />,
    );

    expect(apiGetMock).not.toHaveBeenCalledWith('/channels/channel-1/messages/message-1/text-reactions');
  });
});
