const WAVE_BARS = [8, 12, 16, 22, 28, 18, 14, 24, 30, 20, 16, 26, 32, 22, 18, 28, 24, 14, 20];

export default function VoiceWaveform({ status = 'Listening' }: { status?: string }) {
  return (
    <div
      data-testid="streetbot-recording-waveform"
      className="pointer-events-none absolute bottom-2 left-14 right-24 z-30 flex h-9 items-center justify-center gap-1 rounded-full border border-white/10 bg-black/10 px-4 backdrop-blur-sm dark:bg-white/5"
      aria-hidden="true"
    >
      <style>
        {`
          @keyframes streetbot-dictation-wave {
            0%, 100% { transform: scaleY(0.42); opacity: 0.45; }
            50% { transform: scaleY(1); opacity: 1; }
          }
        `}
      </style>
      <span className="sr-only">{status}</span>
      <span className="mr-2 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.85)]" />
      {WAVE_BARS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="block w-1 rounded-full bg-text-secondary dark:bg-white/70"
          style={{
            height,
            animation: 'streetbot-dictation-wave 860ms ease-in-out infinite',
            animationDelay: `${index * 42}ms`,
            transformOrigin: 'center',
          }}
        />
      ))}
    </div>
  );
}
