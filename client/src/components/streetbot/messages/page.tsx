export default function MessagesPage() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <iframe
        src="/social/dm?embed=true"
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
