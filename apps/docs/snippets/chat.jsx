export const Chat = ({ messages, contact = 'zapbip', frame }) => {
  const teal = '#128C7E';
  const header = '#075E54';
  const senderInk = '#0B6B60';
  const signal = '#25D366';
  const bezel = '#0E1F1A';
  const phoneFrame = 'phone';
  const isPhone = frame === phoneFrame;
  const ink = '#111B21';
  const wallpaper = '#ECE5DD';
  const white = '#FFFFFF';
  const sent = '#D9FDD3';
  const mutedInk = '#54656F';
  const readTick = '#53BDEB';
  const noticeBackground = '#FFEECD';
  const thumbnailFrom = '#CFE9E4';
  const thumbnailTo = '#9FD3C7';
  const shadow = '0 1px 0.5px rgba(11, 20, 26, 0.13)';

  const renderTail = (message) => (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        [message.you ? 'insetInlineEnd' : 'insetInlineStart']: '-6px',
        width: 0,
        height: 0,
        borderTop: '8px solid transparent',
        [message.you ? 'borderInlineStart' : 'borderInlineEnd']: `8px solid ${message.you ? sent : white}`,
      }}
    />
  );

  const renderHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: header, color: white }}>
      <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>
        ‹
      </span>
      <span
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: white,
          color: senderInk,
          fontWeight: 700,
        }}
      >
        {isPhone ? (
          <svg aria-hidden="true" width="20" height="20" viewBox="14 14 36 36" fill="none">
            <path
              d="M32 14c-10 0-18 7.6-18 17 0 3.600 1.200 6.900 3.200 9.600L15 50l9.800-2.700c2.200 1.100 4.600 1.700 7.200 1.700 10 0 18-7.600 18-17s-8-17-18-17z"
              fill={senderInk}
            />
            <circle cx="25" cy="31" r="2.600" fill={signal} />
            <circle cx="32" cy="31" r="2.600" fill={signal} />
            <circle cx="39" cy="31" r="2.600" fill={signal} />
          </svg>
        ) : (
          contact.charAt(0).toLowerCase()
        )}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600, fontSize: '15px', lineHeight: 1.2 }}>{contact}</span>
        <span style={{ fontSize: '11px', opacity: 0.8 }}>online</span>
      </span>
    </div>
  );

  const renderThumbnail = (media) => (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '220px',
        maxWidth: '100%',
        height: '130px',
        marginBottom: '4px',
        borderRadius: '6px',
        background: `linear-gradient(135deg, ${thumbnailFrom}, ${thumbnailTo})`,
      }}
    >
      {media.kind === 'video' ? (
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(17, 27, 33, 0.55)',
            color: white,
          }}
        >
          ▶
        </span>
      ) : (
        <svg aria-hidden="true" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="34" cy="14" r="5" fill={white} />
          <path d="M4 40 17 20l9 12 6-8 12 16z" fill={white} opacity="0.85" />
        </svg>
      )}
      {media.label ? (
        <span style={{ position: 'absolute', insetInlineStart: '8px', bottom: '6px', fontSize: '12px', color: ink }}>{media.label}</span>
      ) : null}
    </div>
  );

  const renderAudio = (media) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px', marginBottom: '2px' }}>
      <span
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: teal,
          color: white,
        }}
      >
        {media.kind === 'voice' ? '🎤' : '♪'}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
        <span style={{ height: '3px', borderRadius: '2px', background: mutedInk, opacity: 0.35 }} />
        <span style={{ fontSize: '12px', color: mutedInk }}>{media.label}</span>
      </span>
    </div>
  );

  const renderDocument = (media) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: '200px',
        marginBottom: '4px',
        padding: '8px',
        borderRadius: '6px',
        background: wallpaper,
      }}
    >
      <svg aria-hidden="true" width="28" height="34" viewBox="0 0 28 34" fill="none">
        <path d="M2 0h16l10 10v22a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z" fill={teal} />
        <path d="M18 0l10 10H20a2 2 0 0 1-2-2z" fill={white} opacity="0.5" />
      </svg>
      <span style={{ fontWeight: 600, wordBreak: 'break-all' }}>{media.label}</span>
    </div>
  );

  const renderLocation = (media) => (
    <div style={{ marginBottom: '4px', minWidth: '220px' }}>
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100px',
          borderRadius: '6px',
          background: `linear-gradient(90deg, ${thumbnailFrom} 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(${thumbnailFrom} 1px, transparent 1px) 0 0 / 24px 24px, ${wallpaper}`,
          fontSize: '28px',
        }}
      >
        📍
      </div>
      <div style={{ marginTop: '4px', fontWeight: 600 }}>{media.label}</div>
    </div>
  );

  const renderContact = (media) => (
    <div style={{ marginBottom: '4px', minWidth: '200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: wallpaper,
            color: mutedInk,
          }}
        >
          👤
        </span>
        <span style={{ fontWeight: 600 }}>{media.label}</span>
      </div>
      <div
        style={{
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: `1px solid ${wallpaper}`,
          textAlign: 'center',
          color: senderInk,
          fontWeight: 600,
        }}
      >
        {media.action}
      </div>
    </div>
  );

  const renderSticker = () => (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '104px',
        height: '104px',
        borderRadius: '16px',
        background: wallpaper,
        fontSize: '56px',
      }}
    >
      🙂
    </div>
  );

  const mediaRenderers = {
    image: renderThumbnail,
    video: renderThumbnail,
    audio: renderAudio,
    voice: renderAudio,
    document: renderDocument,
    location: renderLocation,
    contact: renderContact,
    sticker: renderSticker,
  };

  const renderMedia = (media) => {
    if (!Object.hasOwn(mediaRenderers, media.kind)) return renderDocument(media);
    return mediaRenderers[media.kind](media);
  };

  const renderQuote = (quote) => (
    <div
      style={{
        marginBottom: '4px',
        padding: '4px 8px',
        borderRadius: '6px',
        borderInlineStart: `3px solid ${teal}`,
        background: 'rgba(17, 27, 33, 0.06)',
        fontSize: '13px',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: senderInk }}>{quote.name}</div>
      <div>{quote.text}</div>
    </div>
  );

  const renderFooter = (message) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '3px', fontSize: '11px', color: mutedInk, lineHeight: 1 }}>
      {message.time ? <span>{message.time}</span> : null}
      {message.you ? (
        <span aria-hidden="true" style={{ color: message.unread ? mutedInk : readTick, fontWeight: 700 }}>
          ✓✓
        </span>
      ) : null}
    </div>
  );

  const renderButtons = (buttons) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
      {buttons.map((button) => (
        <span
          key={button}
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            background: white,
            boxShadow: shadow,
            color: senderInk,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {button}
        </span>
      ))}
    </div>
  );

  const renderList = (list) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
      <span
        style={{
          padding: '8px 10px',
          borderRadius: '8px',
          background: white,
          boxShadow: shadow,
          color: senderInk,
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        <span aria-hidden="true">☰</span> {list.title}
      </span>
      <div style={{ borderRadius: '8px', background: white, boxShadow: shadow, overflow: 'hidden' }}>
        {list.rows.map((row, position) => (
          <div
            key={row}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderTop: position === 0 ? 'none' : `1px solid ${wallpaper}`,
            }}
          >
            <span>{row}</span>
            <span
              aria-hidden="true"
              style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${mutedInk}`, opacity: 0.5 }}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderNotice = (message) => (
    <div
      style={{
        alignSelf: 'center',
        maxWidth: '90%',
        padding: '5px 12px',
        borderRadius: '8px',
        background: noticeBackground,
        boxShadow: shadow,
        textAlign: 'center',
        fontSize: '12.5px',
      }}
    >
      <div style={{ fontWeight: 600, color: senderInk }}>zapbip</div>
      <div>{message.text}</div>
      {message.time ? <div style={{ fontSize: '11px', color: mutedInk }}>{message.time}</div> : null}
    </div>
  );

  const renderTyping = (position) => (
    <div
      key={position}
      aria-hidden="true"
      className="zapbip-typing"
      style={{
        alignSelf: 'flex-start',
        display: 'flex',
        gap: '4px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: white,
        boxShadow: shadow,
      }}
    >
      {[0, 1, 2].map((dot) => (
        <span key={dot} style={{ width: '6px', height: '6px', borderRadius: '50%', background: mutedInk }} />
      ))}
    </div>
  );

  const renderMessage = (message, position) => {
    if (message.typing) return renderTyping(position);
    if (message.notice)
      return (
        <div key={position} style={{ display: 'flex', flexDirection: 'column' }}>
          {renderNotice(message)}
        </div>
      );
    const previous = messages[position - 1];
    const startsRun = position === 0 || previous.notice || Boolean(previous.you) !== Boolean(message.you);
    const isSticker = message.media && message.media.kind === 'sticker';
    return (
      <div
        key={position}
        style={{
          alignSelf: message.you ? 'flex-end' : 'flex-start',
          maxWidth: '84%',
          marginTop: startsRun && position > 0 ? '6px' : 0,
          marginBottom: message.reaction ? '10px' : 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'relative',
            padding: '5px 8px 4px',
            borderRadius: '8px',
            borderStartStartRadius: !message.you && startsRun ? 0 : '8px',
            borderStartEndRadius: message.you && startsRun ? 0 : '8px',
            background: message.you ? sent : white,
            boxShadow: shadow,
          }}
        >
          {startsRun ? renderTail(message) : null}
          {message.name ? <div style={{ fontSize: '12px', fontWeight: 600, color: senderInk }}>{message.name}</div> : null}
          {message.quote ? renderQuote(message.quote) : null}
          {message.media ? renderMedia(message.media) : null}
          {message.text ? <div>{message.text}</div> : null}
          {renderFooter(message)}
        </div>
        {message.options ? renderButtons(message.options) : null}
        {message.list ? renderList(message.list) : null}
        {message.reaction ? (
          <span
            style={{
              position: 'absolute',
              bottom: '-10px',
              [message.you ? 'insetInlineEnd' : 'insetInlineStart']: '8px',
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

  const renderStatusBar = () => (
    <div
      aria-hidden="true"
      style={{ padding: '8px 20px 0', background: header, color: white, fontSize: '12px', fontWeight: 600, lineHeight: 1 }}
    >
      9:41
    </div>
  );

  const conversation = (
    <div
      role="group"
      aria-label={`WhatsApp: ${contact}`}
      style={{
        width: '100%',
        maxWidth: isPhone ? '100%' : '360px',
        margin: '0 auto',
        borderRadius: isPhone ? '34px' : '20px',
        overflow: 'hidden',
        border: isPhone ? 'none' : '1px solid rgba(17, 27, 33, 0.15)',
        background: wallpaper,
        color: ink,
        fontSize: '14px',
        lineHeight: 1.35,
        boxShadow: isPhone ? 'none' : '0 4px 14px rgba(11, 20, 26, 0.12)',
      }}
    >
      {isPhone ? renderStatusBar() : null}
      {renderHeader()}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '12px 14px' }}>{messages.map(renderMessage)}</div>
    </div>
  );

  if (!isPhone) return conversation;
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '340px',
        margin: '0 auto',
        padding: '10px',
        borderRadius: '44px',
        background: bezel,
        boxShadow: '0 24px 48px rgba(11, 20, 26, 0.28)',
      }}
    >
      {conversation}
    </div>
  );
};
