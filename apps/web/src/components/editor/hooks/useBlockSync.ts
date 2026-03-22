/**
 * useBlockSync.ts — Socket sync for real-time block operations.
 * Emits block changes to peers via socket events.
 */
import { useCallback } from 'react';
import { emitOrQueue } from '../../../lib/socket';
import type { Block } from '@gratonite/types/api';

export function useBlockSync(channelId: string) {
  const emitBlockInsert = useCallback((block: Block, afterBlockId?: string) => {
    emitOrQueue('DOCUMENT_BLOCK_INSERT', { channelId, block, afterBlockId });
  }, [channelId]);

  const emitBlockUpdate = useCallback((blockId: string, changes: any) => {
    emitOrQueue('DOCUMENT_BLOCK_UPDATE', { channelId, blockId, changes });
  }, [channelId]);

  const emitBlockDelete = useCallback((blockId: string) => {
    emitOrQueue('DOCUMENT_BLOCK_DELETE', { channelId, blockId });
  }, [channelId]);

  const emitBlockMove = useCallback((blockId: string, afterBlockId?: string) => {
    emitOrQueue('DOCUMENT_BLOCK_MOVE', { channelId, blockId, afterBlockId });
  }, [channelId]);

  const emitCursorUpdate = useCallback((blockId: string, offset: number) => {
    emitOrQueue('DOCUMENT_CURSOR_UPDATE', { channelId, blockId, offset });
  }, [channelId]);

  return {
    emitBlockInsert,
    emitBlockUpdate,
    emitBlockDelete,
    emitBlockMove,
    emitCursorUpdate,
  };
}
