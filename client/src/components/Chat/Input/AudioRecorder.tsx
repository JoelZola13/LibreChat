import { useCallback, useRef } from 'react';
import { MicOff } from 'lucide-react';
import { useToastContext, TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { globalAudioId } from '~/common';
import { isStreetBot } from '~/config/appVariant';
import { cn } from '~/utils';
import useStreetBotRealtimeVoice from '~/hooks/Input/useStreetBotRealtimeVoice';
import VoiceWaveform from './VoiceWaveform';

const isExternalSTT = (speechToTextEndpoint: string) => speechToTextEndpoint === 'external';
export default function AudioRecorder({
  disabled,
  ask,
  methods,
  textAreaRef,
  isSubmitting,
}: {
  disabled: boolean;
  ask: (data: { text: string }) => void;
  methods: ReturnType<typeof useChatFormContext>;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  isSubmitting: boolean;
}) {
  const { setValue, reset, getValues } = methods;
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const realtimeVoice = useStreetBotRealtimeVoice({
    onError: (message) => {
      showToast({
        message,
        status: 'warning',
      });
    },
  });

  const existingTextRef = useRef<string>('');

  const onTranscriptionComplete = useCallback(
    (text: string) => {
      if (isSubmitting) {
        showToast({
          message: localize('com_ui_speech_while_submitting'),
          status: 'error',
        });
        return;
      }
      if (text) {
        const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | null;
        if (globalAudio) {
          console.log('Unmuting global audio');
          globalAudio.muted = false;
        }
        /** For external STT, append existing text to the transcription */
        const finalText =
          isExternalSTT(speechToTextEndpoint) && existingTextRef.current
            ? `${existingTextRef.current} ${text}`
            : text;
        ask({ text: finalText });
        reset({ text: '' });
        existingTextRef.current = '';
      }
    },
    [ask, reset, showToast, localize, isSubmitting, speechToTextEndpoint],
  );

  const setText = useCallback(
    (text: string) => {
      let newText = text;
      if (isExternalSTT(speechToTextEndpoint)) {
        /** For external STT, the text comes as a complete transcription, so append to existing */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      } else {
        /** For browser STT, the transcript is cumulative, so we only need to prepend the existing text once */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      }
      setValue('text', newText, {
        shouldValidate: true,
      });
    },
    [setValue, speechToTextEndpoint],
  );

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    setText,
    onTranscriptionComplete,
  );

  if (!textAreaRef.current) {
    return null;
  }

  const handleStartRecording = async () => {
    existingTextRef.current = getValues('text') || '';
    if (isStreetBot && realtimeVoice.isSupported) {
      const started = await realtimeVoice.start();
      if (started) {
        return;
      }
    }

    startRecording();
  };

  const handleStopRecording = async () => {
    if (realtimeVoice.isActive) {
      realtimeVoice.stop();
      return;
    }

    stopRecording();
    /** For browser STT, clear the reference since text was already being updated */
    if (!isExternalSTT(speechToTextEndpoint)) {
      existingTextRef.current = '';
    }
  };

  const renderIcon = () => {
    if (isListening === true || realtimeVoice.isActive) {
      return <MicOff className="stroke-red-500" />;
    }
    if (isLoading === true || realtimeVoice.isConnecting) {
      return <Spinner className="stroke-text-secondary" />;
    }
    return <ListeningIcon className="stroke-text-secondary" />;
  };

  const isVoiceActive = isListening === true || realtimeVoice.isActive;
  const isVoiceLoading = isLoading === true || realtimeVoice.isConnecting;

  return (
    <>
      {isVoiceActive && (
        <>
          <VoiceWaveform
            status={realtimeVoice.isSpeaking ? 'StreetBot is speaking' : 'Listening'}
          />
          <span className="sr-only" aria-live="polite">
            {localize('com_ui_use_micrphone')}
          </span>
        </>
      )}
      <TooltipAnchor
        description={localize('com_ui_use_micrphone')}
        render={
          <button
            id="audio-recorder"
            type="button"
            aria-label={localize('com_ui_use_micrphone')}
            onClick={isVoiceActive ? handleStopRecording : handleStartRecording}
            disabled={disabled}
            className={cn(
              'relative z-20 flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover',
              isVoiceActive &&
                'bg-red-500/10 ring-1 ring-red-500/40 hover:bg-red-500/15 dark:bg-red-500/15',
            )}
            title={localize('com_ui_use_micrphone')}
            aria-busy={isVoiceLoading}
            aria-pressed={isVoiceActive}
          >
            {renderIcon()}
          </button>
        }
      />
    </>
  );
}
