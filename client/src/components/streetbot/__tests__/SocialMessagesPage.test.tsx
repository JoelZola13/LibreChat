import {
  buildIframeSrc,
  getMessagesDiagnosticsSeverity,
  MESSAGES_DIAGNOSTICS_ENDPOINT,
} from '~/components/streetbot/messages/SocialMessagesPage';

describe('SocialMessagesPage iframe routing', () => {
  it('defaults to the embedded DM directory', () => {
    expect(buildIframeSrc('')).toBe('/social/dm?embed=true');
  });

  it('preserves DM permalink targets for the embedded Social app', () => {
    expect(buildIframeSrc('?channel=dm-dm-channel-123&message=message-abc')).toBe(
      '/social/dm/dm-channel-123?embed=true&message=message-abc',
    );
  });

  it('preserves channel permalink targets for the embedded Social app', () => {
    expect(buildIframeSrc('?channel=channel-channel-random&message=e2e-message-link')).toBe(
      '/social/channels/channel-random?embed=true&message=e2e-message-link',
    );
  });

  it('accepts the short msg alias used by older copied links', () => {
    expect(buildIframeSrc('?channel=channel-general&msg=legacy-message-link')).toBe(
      '/social/channels/general?embed=true&message=legacy-message-link',
    );
  });

  it('uses the Social diagnostics endpoint for teammate setup checks', () => {
    expect(MESSAGES_DIAGNOSTICS_ENDPOINT).toBe('/social/api/setup/diagnostics');
  });

  it('surfaces unreachable Social diagnostics as an error', () => {
    expect(
      getMessagesDiagnosticsSeverity({
        phase: 'unreachable',
        error: 'LibreChat could not reach diagnostics',
      }),
    ).toBe('error');
  });

  it('passes through warning diagnostics from Social', () => {
    expect(
      getMessagesDiagnosticsSeverity({
        phase: 'ready',
        diagnostics: {
          service: 'street-voices-social',
          generatedAt: '2026-05-04T12:00:00.000Z',
          status: 'warning',
          checks: [],
        },
      }),
    ).toBe('warning');
  });
});
