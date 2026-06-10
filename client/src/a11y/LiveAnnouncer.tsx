import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { AnnounceOptions } from '~/common';
import AnnouncerContext from '~/Providers/AnnouncerContext';
import { useLocalize } from '~/hooks';
import Announcer from './Announcer';

interface LiveAnnouncerProps {
  children: React.ReactNode;
}

const RICH_RESULTS_FENCE =
  /```(?:streetbot-service-results|streetbot-agent-results|street-profile-results|street-profile-message-draft)\s*[\s\S]*?```/gi;
const RICH_RESULTS_INLINE =
  /\b(?:streetbot-service-results|streetbot-agent-results|street-profile-results|street-profile-message-draft)\s*\{[\s\S]*$/i;
const ACTION_REQUEST_FENCE = /```(?:streetbot-action-request|local-action-request)\s*[\s\S]*?```/gi;
const ACTION_REQUEST_INLINE = /\b(?:streetbot-action-request|local-action-request)\s*\{[\s\S]*$/i;

const sanitizeAnnouncement = (message: string): string =>
  message
    .replace(RICH_RESULTS_FENCE, '')
    .replace(RICH_RESULTS_INLINE, '')
    .replace(ACTION_REQUEST_FENCE, 'Action ready for confirmation.')
    .replace(ACTION_REQUEST_INLINE, 'Action ready for confirmation.');

const LiveAnnouncer: React.FC<LiveAnnouncerProps> = ({ children }) => {
  const [statusMessage, setStatusMessage] = useState('');
  const [logMessage, setLogMessage] = useState('');

  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const localize = useLocalize();

  const events: Record<string, string | undefined> = useMemo(
    () => ({
      start: localize('com_a11y_start'),
      end: localize('com_a11y_end'),
      composing: localize('com_a11y_ai_composing'),
    }),
    [localize],
  );

  const announceStatus = useCallback((message: string) => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }

    setStatusMessage(message);

    statusTimeoutRef.current = setTimeout(() => {
      setStatusMessage('');
    }, 1000);
  }, []);

  const announceLog = useCallback((message: string) => {
    setLogMessage(message);
  }, []);

  const announcePolite = useCallback(
    ({ message, isStatus = false }: AnnounceOptions) => {
      const finalMessage = sanitizeAnnouncement(events[message] ?? message).replace(/[*`_]/g, '');

      if (isStatus) {
        announceStatus(finalMessage);
      } else {
        announceLog(finalMessage);
      }
    },
    [events, announceStatus, announceLog],
  );

  const announceAssertive = announcePolite;

  const contextValue = {
    announcePolite,
    announceAssertive,
  };

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AnnouncerContext.Provider value={contextValue}>
      {children}
      <Announcer statusMessage={statusMessage} logMessage={logMessage} />
    </AnnouncerContext.Provider>
  );
};

export default LiveAnnouncer;
