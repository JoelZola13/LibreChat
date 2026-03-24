export default function MessagesPage() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <iframe
        src="http://localhost:3000/messages"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        title="Messages"
      />
    </div>
  );
}
