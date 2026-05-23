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
      container.removeChild(canvas);
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
      container.removeChild(canvas);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      container.removeChild(canvas);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      container.removeChild(canvas);
      return;
    }

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      container.removeChild(canvas);
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
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
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

const orbBaseStyle = {
  position: 'absolute',
  borderRadius: '9999px',
  pointerEvents: 'none',
  mixBlendMode: 'screen',
  transform: 'translateZ(0)',
  backfaceVisibility: 'hidden',
} satisfies CSSProperties;

const cyanOrbStyle = {
  ...orbBaseStyle,
  left: '-16vw',
  top: '46vh',
  width: '52vw',
  height: '52vw',
  opacity: 0.94,
  filter: 'blur(118px)',
  background:
    'radial-gradient(circle at 50% 50%, rgba(70, 230, 255, 0.34) 0%, rgba(39, 173, 214, 0.24) 24%, rgba(14, 96, 146, 0.12) 48%, rgba(6, 39, 70, 0.04) 66%, transparent 80%)',
  animation: 'sv-orb-float-cyan 14s ease-in-out infinite alternate',
} satisfies CSSProperties;

const violetOrbStyle = {
  ...orbBaseStyle,
  left: '18vw',
  top: '-16vh',
  width: '56vw',
  height: '56vw',
  opacity: 0.98,
  filter: 'blur(126px)',
  background:
    'radial-gradient(circle at 50% 50%, rgba(125, 103, 255, 0.34) 0%, rgba(103, 78, 232, 0.24) 28%, rgba(72, 53, 170, 0.12) 50%, rgba(29, 18, 74, 0.04) 70%, transparent 82%)',
  animation: 'sv-orb-float-violet 17s ease-in-out infinite alternate',
} satisfies CSSProperties;

const roseOrbStyle = {
  ...orbBaseStyle,
  right: '-12vw',
  top: '26vh',
  width: '48vw',
  height: '48vw',
  opacity: 0.88,
  filter: 'blur(122px)',
  background:
    'radial-gradient(circle at 50% 50%, rgba(244, 104, 188, 0.24) 0%, rgba(214, 66, 154, 0.18) 26%, rgba(124, 35, 88, 0.1) 48%, rgba(58, 14, 40, 0.04) 68%, transparent 80%)',
  animation: 'sv-orb-float-rose 15s ease-in-out infinite alternate',
} satisfies CSSProperties;

const goldOrbStyle = {
  ...orbBaseStyle,
  left: '46vw',
  top: '62vh',
  width: '26vw',
  height: '26vw',
  opacity: 0.62,
  filter: 'blur(96px)',
  background:
    'radial-gradient(circle at 50% 50%, rgba(255, 224, 90, 0.26) 0%, rgba(225, 184, 34, 0.14) 28%, rgba(96, 77, 12, 0.06) 54%, transparent 76%)',
  animation: 'sv-orb-float-gold 13s ease-in-out infinite alternate',
} satisfies CSSProperties;

function SbpBackgroundOrbs() {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const isHomePage =
    pathname === '/home' ||
    (typeof window !== 'undefined' && window.location.pathname === '/home');

  return (
    <>
      {isDark && <style>{backgroundKeyframes}</style>}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          background:
            isDark && isHomePage
              ? 'linear-gradient(180deg, #090a0f 0%, #0d1017 30%, #111520 62%, #131723 100%)'
              : isDark
                ? '#171923'
                : 'var(--sb-color-background)',
        }}
      >
        {isDark && !isHomePage ? (
          <>
            <div className="sv-sbp-orb-field">
              <div className="sv-sbp-orb" style={cyanOrbStyle} />
              <div className="sv-sbp-orb" style={violetOrbStyle} />
              <div className="sv-sbp-orb" style={roseOrbStyle} />
              <div className="sv-sbp-orb" style={goldOrbStyle} />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 50% 48%, rgba(255,255,255,0.014), transparent 62%)',
              }}
            />
          </>
        ) : null}
      </div>
    </>
  );
}

export default memo(SbpBackgroundOrbs);
