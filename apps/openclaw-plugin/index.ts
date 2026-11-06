import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import { createZapbipPlugin } from './src/channel';
import { CHANNEL_DESCRIPTION, CHANNEL_ID, CHANNEL_LABEL } from './src/constants';

export default defineChannelPluginEntry({
  id: CHANNEL_ID,
  name: CHANNEL_LABEL,
  description: CHANNEL_DESCRIPTION,
  plugin: createZapbipPlugin(),
});
