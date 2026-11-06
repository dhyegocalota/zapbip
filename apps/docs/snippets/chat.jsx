export const Chat = ({ messages }) => {
  const teal = '#128C7E';
  const ink = '#111B21';
  const paper = '#ECE5DD';
  const white = '#FFFFFF';
  const sent = '#D9FDD3';
  const shadow = '0 1px 0.5px rgba(11, 20, 26, 0.13)';
  const mediaIcons = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    voice: '🎤',
    document: '📄',
    sticker: '🙂',
    location: '📍',
    contact: '👤',
  };

  const renderQuote = (quote) => (
    <div
      style={{
        marginBottom: '4px',
        padding: '4px 8px',
        borderRadius: '6px',
        borderLeft: `3px solid ${teal}`,
        background: paper,
        fontSize: '13px',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: teal }}>{quote.name}</div>
      <div>{quote.text}</div>
    </div>
  );

  const renderMedia = (media) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px',
        padding: media.kind === 'sticker' ? '16px 24px' : '10px 12px',
        borderRadius: '6px',
        background: paper,
      }}
    >
      <span style={{ fontSize: media.kind === 'sticker' ? '32px' : '20px' }}>{mediaIcons[media.kind]}</span>
      {media.label ? <span style={{ fontWeight: 600 }}>{media.label}</span> : null}
    </div>
  );

  const renderButtons = (buttons) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
      {buttons.map((button) => (
        <span key={button} style={{ padding: '2px 10px', borderRadius: '6px', border: `1px solid ${teal}`, color: teal, fontWeight: 600 }}>
          {button}
        </span>
      ))}
    </div>
  );

  const renderList = (list) => (
    <div style={{ marginTop: '6px', borderRadius: '6px', border: `1px solid ${teal}`, overflow: 'hidden' }}>
      <div style={{ padding: '2px 10px', color: teal, fontWeight: 600, textAlign: 'center' }}>☰ {list.title}</div>
      {list.rows.map((row) => (
        <div key={row} style={{ padding: '4px 10px', borderTop: `1px solid ${paper}` }}>
          {row}
        </div>
      ))}
    </div>
  );

  const renderNotice = (message) => (
    <div
      style={{
        alignSelf: 'center',
        maxWidth: '88%',
        padding: '4px 12px',
        borderRadius: '8px',
        background: white,
        boxShadow: shadow,
        textAlign: 'center',
        fontSize: '13px',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: teal }}>zapbip</div>
      <div>{message.text}</div>
      {message.time ? <div style={{ fontSize: '11px', opacity: 0.6 }}>{message.time}</div> : null}
    </div>
  );

  const renderMessage = (message, position) => {
    if (message.notice)
      return (
        <div key={position} style={{ display: 'flex', flexDirection: 'column' }}>
          {renderNotice(message)}
        </div>
      );
    return (
      <div
        key={position}
        style={{
          alignSelf: message.you ? 'flex-end' : 'flex-start',
          maxWidth: '88%',
          marginBottom: message.reaction ? '8px' : 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            background: message.you ? sent : white,
            boxShadow: shadow,
          }}
        >
          {message.name ? <div style={{ fontSize: '12px', fontWeight: 600, color: teal }}>{message.name}</div> : null}
          {message.quote ? renderQuote(message.quote) : null}
          {message.media ? renderMedia(message.media) : null}
          {message.text ? <div>{message.text}</div> : null}
          {message.options ? renderButtons(message.options) : null}
          {message.list ? renderList(message.list) : null}
          {message.time ? <div style={{ textAlign: 'right', fontSize: '11px', opacity: 0.6 }}>{message.time}</div> : null}
        </div>
        {message.reaction ? (
          <span
            style={{
              position: 'absolute',
              bottom: '-10px',
              [message.you ? 'right' : 'left']: '8px',
              padding: '0 5px',
              borderRadius: '10px',
              background: white,
              boxShadow: shadow,
              fontSize: '13px',
            }}
          >
            {message.reaction}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '12px',
        borderRadius: '12px',
        background: paper,
        color: ink,
        fontSize: '14px',
        lineHeight: 1.35,
      }}
    >
      {messages.map(renderMessage)}
    </div>
  );
};
