import { memo, type CSSProperties, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '@/app/providers/theme-provider';

type AuroraProps = {
  colorStops: [string, string, string, string] | string[];
  amplitude?: number;
  blend?: number;
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  const value = Number.parseInt(fullHex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function hexToRgbVector(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  const value = Number.parseInt(fullHex, 16);

  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export const backgroundKeyframes = `
  @keyframes sv-home-aurora-field-drift {
    0% {
      transform: translate3d(-3%, 2%, 0) scale(1.01) rotate(-1deg);
    }
    50% {
      transform: translate3d(2%, -2.5%, 0) scale(1.04) rotate(1deg);
    }
    100% {
      transform: translate3d(3%, 1%, 0) scale(1.02) rotate(2deg);
    }
  }

  @keyframes sv-home-aurora-band-a {
    0% {
      transform: translate3d(-6%, 3%, 0) rotate(-20deg) scale(1, 1.02);
      opacity: 0.22;
    }
    50% {
      transform: translate3d(3%, -4%, 0) rotate(-15deg) scale(1.06, 1.1);
      opacity: 0.3;
    }
    100% {
      transform: translate3d(10%, 2%, 0) rotate(-10deg) scale(1.03, 1.08);
      opacity: 0.24;
    }
  }

  @keyframes sv-home-aurora-band-b {
    0% {
      transform: translate3d(6%, 1%, 0) rotate(-8deg) scale(1.01, 1);
      opacity: 0.18;
    }
    50% {
      transform: translate3d(-4%, -5%, 0) rotate(-3deg) scale(1.08, 1.12);
      opacity: 0.26;
    }
    100% {
      transform: translate3d(-10%, 2%, 0) rotate(1deg) scale(1.04, 1.08);
      opacity: 0.2;
    }
  }

  @keyframes sv-home-aurora-band-c {
    0% {
      transform: translate3d(-5%, 2%, 0) rotate(8deg) scale(1);
      opacity: 0.16;
    }
    50% {
      transform: translate3d(3%, -5%, 0) rotate(13deg) scale(1.07, 1.12);
      opacity: 0.24;
    }
    100% {
      transform: translate3d(9%, 2%, 0) rotate(18deg) scale(1.04, 1.08);
      opacity: 0.18;
    }
  }

  @keyframes sv-home-aurora-band-d {
    0% {
      transform: translate3d(-3%, 2%, 0) rotate(4deg) scale(1);
      opacity: 0.1;
    }
    50% {
      transform: translate3d(2%, -3%, 0) rotate(9deg) scale(1.08, 1.14);
      opacity: 0.16;
    }
    100% {
      transform: translate3d(7%, 2%, 0) rotate(14deg) scale(1.04, 1.1);
      opacity: 0.12;
    }
  }

  @keyframes sv-home-aurora-band-e {
    0% {
      transform: translate3d(-4%, 1%, 0) rotate(-2deg) scale(1);
      opacity: 0.12;
    }
    50% {
      transform: translate3d(3%, -3%, 0) rotate(1deg) scale(1.05, 1.08);
      opacity: 0.2;
    }
    100% {
      transform: translate3d(8%, 2%, 0) rotate(4deg) scale(1.03, 1.06);
      opacity: 0.14;
    }
  }

  @keyframes sv-orb-field-drift {
    0% {
      transform: translate3d(-1.5vw, 0.8vh, 0) rotate(0deg) scale(1);
    }
    50% {
      transform: translate3d(1.8vw, -1.2vh, 0) rotate(0.7deg) scale(1.02);
    }
    100% {
      transform: translate3d(-0.9vw, 1.6vh, 0) rotate(-0.6deg) scale(1.01);
    }
  }

  @keyframes sv-orb-float-cyan {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    25% {
      transform: translate3d(5vw, -4vh, 0) scale(1.06);
    }
    50% {
      transform: translate3d(10vw, 2vh, 0) scale(0.98);
    }
    75% {
      transform: translate3d(4vw, 8vh, 0) scale(1.04);
    }
    100% {
      transform: translate3d(-2vw, 1vh, 0) scale(1.01);
    }
  }

  @keyframes sv-orb-float-violet {
    0% {
      transform: translate3d(0, 0, 0) scale(1.02);
    }
    30% {
      transform: translate3d(7vw, 4vh, 0) scale(1.08);
    }
    58% {
      transform: translate3d(12vw, -2vh, 0) scale(1.01);
    }
    100% {
      transform: translate3d(2vw, 7vh, 0) scale(1.05);
    }
  }

  @keyframes sv-orb-float-rose {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    22% {
      transform: translate3d(-5vw, -2vh, 0) scale(1.05);
    }
    50% {
      transform: translate3d(-9vw, 5vh, 0) scale(1.1);
    }
    78% {
      transform: translate3d(-3vw, 10vh, 0) scale(1.02);
    }
    100% {
      transform: translate3d(2vw, 3vh, 0) scale(1.04);
    }
  }

  @keyframes sv-orb-float-gold {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    20% {
      transform: translate3d(3vw, -3vh, 0) scale(1.08);
    }
    48% {
      transform: translate3d(-2vw, -6vh, 0) scale(0.97);
    }
    76% {
      transform: translate3d(-5vw, 2vh, 0) scale(1.06);
    }
    100% {
      transform: translate3d(1vw, 5vh, 0) scale(1.02);
    }
  }

  .sv-home-aurora-field {
    position: absolute;
    inset: 34% -12% -14%;
    pointer-events: none;
    will-change: transform;
    transform: translateZ(0);
  }

  .sv-home-aurora-root {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .sv-home-aurora-layer {
    position: absolute;
    border-radius: 0;
    pointer-events: none;
    mix-blend-mode: screen;
    will-change: transform, opacity;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .sv-sbp-orb-field {
    position: absolute;
    inset: -12%;
    pointer-events: none;
    animation: sv-orb-field-drift 24s ease-in-out infinite alternate;
    will-change: transform;
    transform: translateZ(0);
  }

  .sv-sbp-orb {
    position: absolute;
    border-radius: 9999px;
    pointer-events: none;
    mix-blend-mode: screen;
    will-change: transform, opacity;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  @media (max-width: 900px) {
    .sv-home-aurora-field {
      inset: 42% -18% -16%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sv-home-aurora-field,
    .sv-home-aurora-layer,
    .sv-sbp-orb-field,
    .sv-sbp-orb {
      animation: none !important;
      transform: none !important;
    }
  }
`;

export function Aurora({ colorStops, amplitude = 1, blend = 0.9 }: AuroraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedStops = [...colorStops];

  while (normalizedStops.length < 4) {
    normalizedStops.push(normalizedStops[normalizedStops.length - 1] ?? '#7c86c6');
  }

  const colorSignature = normalizedStops.join('|');

  useEffect(() => {
    const removeCanvas = (container: HTMLDivElement, canvas: HTMLCanvasElement) => {
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });

    if (!gl) {
      removeCanvas(container, canvas);
      return;
    }

    const vertexShaderSource = `
      attribute vec2 aPosition;

      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision highp float;

      uniform float uTime;
      uniform float uAmplitude;
      uniform float uBlend;
      uniform vec2 uResolution;
      uniform vec3 uColorStops[4];

      vec3 permute(vec3 x) {
        return mod(((x * 34.0) + 1.0) * x, 289.0);
      }

      float snoise(vec2 v) {
        const vec4 C = vec4(
          0.211324865405187,
          0.366025403784439,
          -0.577350269189626,
          0.024390243902439
        );

        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);

        vec3 p = permute(
          permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
        );

        vec3 m = max(
          0.5 - vec3(
            dot(x0, x0),
            dot(x12.xy, x12.xy),
            dot(x12.zw, x12.zw)
          ),
          0.0
        );
        m = m * m;
        m = m * m;

        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;

        return 130.0 * dot(m, g);
      }

      vec3 rampColorAt(float factor) {
        vec3 color = uColorStops[3];
        float stopA = 0.42;
        float stopB = 0.78;

        if (factor <= stopA) {
          float t = clamp(factor / stopA, 0.0, 1.0);
          color = mix(uColorStops[0], uColorStops[1], t);
        } else if (factor <= stopB) {
          float t = clamp((factor - stopA) / (stopB - stopA), 0.0, 1.0);
          color = mix(uColorStops[1], uColorStops[2], t);
        } else {
          float t = clamp((factor - stopB) / (1.0 - stopB), 0.0, 1.0);
          color = mix(uColorStops[2], uColorStops[3], t);
        }

        return color;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;
        float factor = clamp(uv.x, 0.0, 1.0);
        vec3 rampColor = rampColorAt(factor);

        float flippedY = 1.0 - uv.y;
        float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
        height = exp(height);
        height = (flippedY * 2.0 - height + 0.2);
        float intensity = 0.72 * height;

        float midPoint = 0.20;
        float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
        auroraAlpha *= smoothstep(0.02, 0.18, flippedY);
        auroraAlpha *= 1.0 - smoothstep(0.56, 0.92, flippedY);

        float goldBias = smoothstep(0.52, 0.0, uv.x);
        vec3 goldBoost = uColorStops[0] * (0.34 * goldBias);
        vec3 auroraColor = (intensity * rampColor + goldBoost * intensity * 0.52) * 1.24;

        gl_FragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
      }
    `;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);

      if (!shader) {
        return null;
      }

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      if (vertexShader) {
        gl.deleteShader(vertexShader);
      }
      if (fragmentShader) {
        gl.deleteShader(fragmentShader);
      }
      removeCanvas(container, canvas);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      removeCanvas(container, canvas);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      removeCanvas(container, canvas);
      return;
    }

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      removeCanvas(container, canvas);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const timeLocation = gl.getUniformLocation(program, 'uTime');
    const amplitudeLocation = gl.getUniformLocation(program, 'uAmplitude');
    const blendLocation = gl.getUniformLocation(program, 'uBlend');
    const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    const colorStopLocation = gl.getUniformLocation(program, 'uColorStops');

    const resize = () => {
      const width = Math.max(1, Math.floor(container.clientWidth * window.devicePixelRatio));
      const height = Math.max(1, Math.floor(container.clientHeight * window.devicePixelRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
    };

    const setColorStops = () => {
      if (!colorStopLocation) {
        return;
      }

      const values = normalizedStops.slice(0, 4).flatMap((stop) => hexToRgbVector(stop));
      gl.uniform3fv(colorStopLocation, new Float32Array(values));
    };

    resize();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameId = 0;

    const renderFrame = (time: number) => {
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      if (timeLocation) {
        gl.uniform1f(timeLocation, reducedMotion ? 0 : time * 0.00055);
      }
      if (amplitudeLocation) {
        gl.uniform1f(amplitudeLocation, amplitude);
      }
      if (blendLocation) {
        gl.uniform1f(blendLocation, blend);
      }
      if (resolutionLocation) {
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      }

      setColorStops();
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reducedMotion) {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame(0);

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      removeCanvas(container, canvas);
    };
  }, [amplitude, blend, colorSignature]);

  const fallbackStyle = {
    position: 'absolute',
    inset: '20% -10% -14%',
    background: [
      `radial-gradient(circle at 6% 82%, ${hexToRgba(normalizedStops[0], 0.44)} 0%, ${hexToRgba(normalizedStops[0], 0.14)} 18%, transparent 34%)`,
      `radial-gradient(circle at 24% 72%, ${hexToRgba(normalizedStops[1], 0.16)} 0%, transparent 38%)`,
      `radial-gradient(circle at 76% 70%, ${hexToRgba(normalizedStops[2], 0.06)} 0%, transparent 40%)`,
      `linear-gradient(118deg, ${hexToRgba(normalizedStops[0], 0.28)} 4%, ${hexToRgba(normalizedStops[1], 0.16)} 30%, ${hexToRgba(normalizedStops[2], 0.08)} 70%, ${hexToRgba(normalizedStops[3], 0.12)} 100%)`,
    ].join(','),
    filter: 'blur(88px)',
    opacity: 0.58,
  } satisfies CSSProperties;

  return (
    <div className="sv-home-aurora-root">
      <div style={fallbackStyle} />
      <div
        ref={containerRef}
        className="sv-home-aurora-canvas"
        style={{
          position: 'absolute',
          inset: 0,
          filter: 'blur(14px) saturate(108%) brightness(1.02)',
          transform: 'scale(1.08)',
          transformOrigin: '50% 72%',
        }}
      />
    </div>
  );
}

function SbpBackgroundOrbs() {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const isHomeStyledRoute =
    pathname === '/c/new' ||
    pathname === '/home' ||
    (typeof window !== 'undefined' &&
      (window.location.pathname === '/c/new' || window.location.pathname === '/home'));

  const renderUniversalHomeBackground = !isHomeStyledRoute;

  return (
    <>
      <style>{backgroundKeyframes}</style>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          background:
            isDark
              ? 'linear-gradient(180deg, rgba(3, 4, 6, 1) 0%, rgba(4, 5, 8, 0.996) 24%, rgba(5, 7, 10, 0.986) 48%, rgba(7, 9, 13, 0.968) 100%)'
              : 'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(254, 254, 255, 0.998) 28%, rgba(251, 252, 253, 0.989) 56%, rgba(246, 248, 250, 0.978) 100%)',
        }}
      >
        {renderUniversalHomeBackground ? (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isDark
                  ? 'linear-gradient(180deg, rgba(3, 4, 6, 0.98) 0%, rgba(3, 4, 6, 0.94) 14%, rgba(3, 4, 6, 0.8) 28%, rgba(3, 4, 6, 0.54) 42%, rgba(3, 4, 6, 0.22) 58%, rgba(3, 4, 6, 0.04) 72%, transparent 82%)'
                  : 'linear-gradient(180deg, rgba(255, 255, 255, 0.992) 0%, rgba(255, 255, 255, 0.965) 14%, rgba(255, 255, 255, 0.82) 28%, rgba(255, 255, 255, 0.54) 42%, rgba(255, 255, 255, 0.22) 58%, rgba(255, 255, 255, 0.04) 72%, transparent 82%)',
              }}
            />
            <div
              className="sv-home-aurora-field"
              style={{
                inset: 'calc(30% - 50px) -12% calc(-24% + 50px) -12%',
                opacity: isDark ? 0.7 : 0.59,
                filter: isDark
                  ? 'saturate(132%) brightness(0.88) contrast(1.03)'
                  : 'saturate(136%) brightness(1.16) contrast(1.03)',
                animation: 'sv-home-aurora-field-drift 24s ease-in-out infinite alternate',
                transformOrigin: '50% 84%',
                WebkitMaskImage:
                  'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.04) 22%, rgba(0, 0, 0, 0.22) 34%, rgba(0, 0, 0, 0.72) 58%, rgba(0, 0, 0, 0.96) 78%, rgba(0, 0, 0, 1) 100%)',
                maskImage:
                  'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.04) 22%, rgba(0, 0, 0, 0.22) 34%, rgba(0, 0, 0, 0.72) 58%, rgba(0, 0, 0, 0.96) 78%, rgba(0, 0, 0, 1) 100%)',
              }}
            >
              <Aurora
                colorStops={['#ffd400', '#00b4d0', '#fe8a8d', '#7c86c6']}
                amplitude={1}
                blend={0.9}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                left: '-10%',
                bottom: 'calc(-18% + 50px)',
                width: '46%',
                height: '52%',
                borderRadius: '999px',
                background: isDark
                  ? 'radial-gradient(circle at 50% 54%, rgba(255, 212, 0, 0.32) 0%, rgba(255, 212, 0, 0.18) 24%, rgba(255, 212, 0, 0.065) 52%, transparent 74%)'
                  : 'radial-gradient(circle at 50% 54%, rgba(255, 212, 0, 0.26) 0%, rgba(255, 212, 0, 0.14) 24%, rgba(255, 212, 0, 0.05) 52%, transparent 74%)',
                filter: 'blur(96px)',
                opacity: isDark ? 0.58 : 0.48,
                animation: 'sv-home-aurora-field-drift 24s ease-in-out infinite alternate-reverse',
                transformOrigin: '24% 86%',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: '-8%',
                bottom: 'calc(-20% + 50px)',
                width: '38%',
                height: '46%',
                borderRadius: '999px',
                background: isDark
                  ? 'radial-gradient(circle at 48% 52%, rgba(124, 134, 198, 0.18) 0%, rgba(124, 134, 198, 0.085) 26%, rgba(124, 134, 198, 0.03) 54%, transparent 74%)'
                  : 'radial-gradient(circle at 48% 52%, rgba(124, 134, 198, 0.17) 0%, rgba(124, 134, 198, 0.08) 26%, rgba(124, 134, 198, 0.03) 54%, transparent 74%)',
                filter: 'blur(104px)',
                opacity: isDark ? 0.44 : 0.34,
                animation: 'sv-home-aurora-field-drift 24s ease-in-out infinite alternate',
                transformOrigin: '74% 84%',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isDark
                  ? 'radial-gradient(circle at 50% 108%, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.014) 24%, transparent 58%), linear-gradient(180deg, rgba(0, 0, 0, 0) 54%, rgba(0, 0, 0, 0.08) 100%)'
                  : 'radial-gradient(circle at 50% 108%, rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0.42) 24%, rgba(255, 255, 255, 0.12) 58%, transparent 76%), linear-gradient(180deg, rgba(255, 255, 255, 0.84) 0%, rgba(255, 255, 255, 0.58) 34%, rgba(255, 255, 255, 0.24) 66%, rgba(255, 255, 255, 0.1) 100%), radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.5) 34%, rgba(255, 255, 255, 0.12) 68%, transparent 86%)',
                opacity: isDark ? 0.9 : 1,
              }}
            />
          </>
        ) : null}
      </div>
    </>
  );
}

export default memo(SbpBackgroundOrbs);
