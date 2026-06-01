const crypto = require('crypto');
const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const REALTIME_ENDPOINT = 'https://api.openai.com/v1/realtime/calls';
const DEFAULT_REALTIME_MODEL = process.env.STREETBOT_REALTIME_MODEL || 'gpt-realtime-mini';
const DEFAULT_REALTIME_VOICE = process.env.STREETBOT_REALTIME_VOICE || 'verse';
const DEFAULT_TRANSCRIPTION_MODEL =
  process.env.STREETBOT_REALTIME_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';

function createSafetyIdentifier(user) {
  const value = user?.id || user?._id || user?.email || 'anonymous-streetbot-user';
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function createStreetBotRealtimeSession(model, voice) {
  return {
    type: 'realtime',
    model,
    instructions:
      process.env.STREETBOT_REALTIME_INSTRUCTIONS ||
      [
        'You are Street Bot, the warm voice agent for Street Voices.',
        'Be fast, practical, calm, and conversational.',
        'For general conversation, answer naturally in one or two short spoken paragraphs.',
        'When the user asks for shelters, food, legal help, healthcare, or other local services,',
        'tell them you can help find nearby options and ask for their location if needed.',
        'Do not claim to have called services or verified live availability unless a tool result says so.',
      ].join(' '),
    output_modalities: ['audio'],
    audio: {
      input: {
        transcription: {
          model: DEFAULT_TRANSCRIPTION_MODEL,
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 650,
          create_response: true,
          interrupt_response: true,
        },
        noise_reduction: {
          type: 'near_field',
        },
      },
      output: {
        voice,
      },
    },
  };
}

router.post(
  '/realtime/session',
  express.text({ type: ['application/sdp', 'text/plain'], limit: '1mb' }),
  requireJwtAuth,
  async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).send('StreetBot voice is missing its OpenAI API key.');
    }

    const sdp = typeof req.body === 'string' ? req.body : '';
    if (!sdp.trim()) {
      return res.status(400).send('Missing WebRTC offer SDP.');
    }

    const requestedModel = String(req.get('X-StreetBot-Realtime-Model') || '').trim();
    const requestedVoice = String(req.get('X-StreetBot-Realtime-Voice') || '').trim();
    const model = requestedModel || DEFAULT_REALTIME_MODEL;
    const voice = requestedVoice || DEFAULT_REALTIME_VOICE;
    const formData = new FormData();

    formData.set('sdp', new Blob([sdp], { type: 'application/sdp' }), 'offer.sdp');
    formData.set('session', JSON.stringify(createStreetBotRealtimeSession(model, voice)));

    try {
      const response = await fetch(REALTIME_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'OpenAI-Safety-Identifier': createSafetyIdentifier(req.user),
        },
        body: formData,
      });

      const answer = await response.text();
      if (!response.ok) {
        return res.status(response.status).send(answer || 'StreetBot voice connection failed.');
      }

      return res.type('application/sdp').send(answer);
    } catch (error) {
      return res
        .status(502)
        .send(error instanceof Error ? error.message : 'StreetBot voice connection failed.');
    }
  },
);

module.exports = router;
