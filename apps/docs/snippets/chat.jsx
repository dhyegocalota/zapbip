export const Chat = ({ messages }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '12px',
      borderRadius: '12px',
      background: '#ECE5DD',
      color: '#111B21',
      fontSize: '14px',
      lineHeight: 1.35,
    }}
  >
    {messages.map((message, position) => (
      <div
        key={position}
        style={{
          alignSelf: message.you ? 'flex-end' : 'flex-start',
          maxWidth: '88%',
          padding: '6px 10px',
          borderRadius: '8px',
          background: message.you ? '#D9FDD3' : '#FFFFFF',
          boxShadow: '0 1px 0.5px rgba(11, 20, 26, 0.13)',
        }}
      >
        {message.name ? <div style={{ fontSize: '12px', fontWeight: 600, color: '#128C7E' }}>{message.name}</div> : null}
        <div>{message.text}</div>
        {message.options ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {message.options.map((option) => (
              <span
                key={option}
                style={{ padding: '2px 10px', borderRadius: '6px', border: '1px solid #128C7E', color: '#128C7E', fontWeight: 600 }}
              >
                {option}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    ))}
  </div>
);
