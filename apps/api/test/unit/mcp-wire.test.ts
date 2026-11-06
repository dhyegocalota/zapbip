import { MediaSourceKind, MessageKind } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { toWireMessage } from '../../src/mcp/wire';
import { buildEnvelope } from '../support/builders';

const STORED_LINK = 'https://zapbip.test/m/acc_1/med_1?exp=1&sig=2';

describe('MCP wire media status', () => {
  const imageFields = { mimeType: 'image/jpeg', sizeBytes: 10, filename: null, caption: 'foto' };

  it('serialises an unavailable media source as no media with an unavailable status', () => {
    const wire = toWireMessage({
      message: {
        ...buildEnvelope({ messageId: 'msg_1' }),
        kind: MessageKind.Image,
        source: { kind: MediaSourceKind.Unavailable },
        ...imageFields,
      },
      link: null,
    });
    expect(wire).toMatchObject({ media_id: null, url: null, media_status: MediaSourceKind.Unavailable, caption: 'foto' });
  });

  it('serialises a stored media source with no status', () => {
    const wire = toWireMessage({
      message: {
        ...buildEnvelope({ messageId: 'msg_1' }),
        kind: MessageKind.Image,
        source: { kind: MediaSourceKind.Stored, mediaId: 'med_1' },
        ...imageFields,
      },
      link: STORED_LINK,
    });
    expect(wire).toMatchObject({ media_id: 'med_1', url: STORED_LINK, media_status: null });
  });

  it('serialises a message with no media with no status', () => {
    const wire = toWireMessage({ message: { ...buildEnvelope({ messageId: 'msg_1' }), kind: MessageKind.Text, text: 'oi' }, link: null });
    expect(wire).toMatchObject({ media_status: null });
  });
});
