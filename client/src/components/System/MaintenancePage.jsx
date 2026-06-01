import { useEffect } from 'react';

export default function MaintenancePage() {
  useEffect(() => {
    document.title = 'StreetBot is being tuned';
  }, []);

  return (
    <main className="sv-maintenance-page" aria-labelledby="sv-maintenance-title">
      <style>
        {`
          .sv-maintenance-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px 20px;
            color: #f4f4f7;
            background:
              radial-gradient(circle at 18% 82%, rgba(139, 165, 18, 0.44), transparent 31%),
              radial-gradient(circle at 48% 84%, rgba(0, 145, 164, 0.36), transparent 33%),
              radial-gradient(circle at 84% 72%, rgba(153, 54, 73, 0.38), transparent 30%),
              linear-gradient(180deg, #010204 0%, #05070a 47%, #101218 100%);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          .sv-maintenance-shell {
            width: min(680px, 100%);
            text-align: center;
          }

          .sv-maintenance-logo {
            width: 132px;
            height: auto;
            margin: 0 auto 18px;
            filter: drop-shadow(0 18px 36px rgba(0, 0, 0, 0.32));
          }

          .sv-maintenance-wordmark {
            width: 176px;
            height: auto;
            margin: 0 auto 28px;
          }

          .sv-maintenance-panel {
            border: 1px solid rgba(255, 255, 255, 0.13);
            border-radius: 24px;
            padding: clamp(28px, 6vw, 46px);
            background: rgba(18, 20, 28, 0.76);
            box-shadow: 0 32px 92px rgba(0, 0, 0, 0.46);
            backdrop-filter: blur(18px);
          }

          .sv-maintenance-eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 18px;
            border-radius: 999px;
            padding: 8px 13px;
            color: #111;
            background: #ffd600;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .sv-maintenance-title {
            margin: 0;
            color: #f7f7fb;
            font-size: clamp(34px, 6vw, 58px);
            line-height: 1;
            font-weight: 850;
          }

          .sv-maintenance-copy {
            max-width: 520px;
            margin: 18px auto 0;
            color: rgba(244, 244, 247, 0.74);
            font-size: clamp(16px, 2.4vw, 20px);
            line-height: 1.58;
            font-weight: 600;
          }

          .sv-maintenance-status {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 30px;
            color: rgba(244, 244, 247, 0.76);
            font-size: 14px;
            font-weight: 700;
          }

          .sv-maintenance-status span {
            border: 1px solid rgba(255, 255, 255, 0.11);
            border-radius: 999px;
            padding: 9px 13px;
            background: rgba(255, 255, 255, 0.07);
          }

          @media (max-width: 520px) {
            .sv-maintenance-page {
              align-items: flex-start;
              padding: 64px 18px 30px;
            }

            .sv-maintenance-logo {
              width: 108px;
            }

            .sv-maintenance-wordmark {
              width: 152px;
            }

            .sv-maintenance-panel {
              border-radius: 20px;
            }
          }
        `}
      </style>
      <section className="sv-maintenance-shell">
        <img
          className="sv-maintenance-logo"
          src="/assets/streetbot-icon-home-light-animated.svg"
          alt=""
          aria-hidden="true"
        />
        <img
          className="sv-maintenance-wordmark"
          src="/assets/streetbot-text-light.svg"
          alt="Street Bot"
        />
        <div className="sv-maintenance-panel">
          <div className="sv-maintenance-eyebrow">Maintenance mode</div>
          <h1 id="sv-maintenance-title" className="sv-maintenance-title">
            StreetBot is getting tuned.
          </h1>
          <p className="sv-maintenance-copy">
            We are polishing the chat experience, service cards, and mobile flow before opening this
            preview again.
          </p>
          <div className="sv-maintenance-status" aria-label="Current work">
            <span>Conversation flow</span>
            <span>Service search</span>
            <span>Mobile polish</span>
          </div>
        </div>
      </section>
    </main>
  );
}
