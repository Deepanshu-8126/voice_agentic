import React, { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
  analyser: AnalyserNode | null;
  outputAnalyser?: AnalyserNode | null;
  isActive: boolean;
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  mode?: 'orb' | 'wave';
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  analyser,
  outputAnalyser,
  isActive,
  status,
  mode = 'orb'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const dataArray = new Uint8Array(128);
    const outputDataArray = new Uint8Array(128);

    // Particle system for ambient energy
    const particles: Array<{ x: number; y: number; r: number; speedX: number; speedY: number; alpha: number }> = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        r: Math.random() * 2.5 + 1,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8,
        alpha: Math.random() * 0.6 + 0.2
      });
    }

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      let inputLevel = 0;
      if (analyser && isActive) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        inputLevel = sum / dataArray.length / 255;
      }

      let outputLevel = 0;
      if (outputAnalyser && isActive) {
        outputAnalyser.getByteFrequencyData(outputDataArray);
        let sum = 0;
        for (let i = 0; i < outputDataArray.length; i++) {
          sum += outputDataArray[i];
        }
        outputLevel = sum / outputDataArray.length / 255;
      }

      const activeLevel = Math.max(inputLevel * 1.6, outputLevel * 2.4);
      phase += 0.035 + activeLevel * 0.07;

      if (mode === 'orb') {
        const baseRadius = Math.min(width, height) * 0.23;
        const dynamicRadius = baseRadius + activeLevel * 50;

        // 1. Ambient outer aura
        const auraGradient = ctx.createRadialGradient(
          centerX, centerY, baseRadius * 0.3,
          centerX, centerY, dynamicRadius * 2.0
        );

        if (status === 'speaking') {
          // AI Speaking: Neon Violet, Cyan & Electric Blue
          auraGradient.addColorStop(0, 'rgba(168, 85, 247, 0.75)');
          auraGradient.addColorStop(0.4, 'rgba(59, 130, 246, 0.4)');
          auraGradient.addColorStop(0.75, 'rgba(6, 182, 212, 0.2)');
          auraGradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
        } else if (status === 'listening') {
          // User speaking / listening: Emerald, Mint & Cyan
          auraGradient.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
          auraGradient.addColorStop(0.4, 'rgba(6, 182, 212, 0.45)');
          auraGradient.addColorStop(0.75, 'rgba(59, 130, 246, 0.15)');
          auraGradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else if (status === 'processing') {
          // Processing: Amber & Rose Gold
          auraGradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
          auraGradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.3)');
          auraGradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
        } else {
          // Idle ambient pulse
          auraGradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
          auraGradient.addColorStop(0.6, 'rgba(139, 92, 246, 0.15)');
          auraGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        }

        ctx.fillStyle = auraGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, dynamicRadius * 2.0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Ambient Floating Particles
        particles.forEach(p => {
          p.x += p.speedX * (1 + activeLevel * 2);
          p.y += p.speedY * (1 + activeLevel * 2);
          if (Math.hypot(p.x, p.y) > dynamicRadius * 1.5) {
            p.x = (Math.random() - 0.5) * 50;
            p.y = (Math.random() - 0.5) * 50;
          }

          ctx.fillStyle = status === 'speaking'
            ? `rgba(196, 181, 253, ${p.alpha * (0.4 + activeLevel)})`
            : `rgba(110, 231, 183, ${p.alpha * (0.4 + activeLevel)})`;
          ctx.beginPath();
          ctx.arc(centerX + p.x, centerY + p.y, p.r * (1 + activeLevel), 0, Math.PI * 2);
          ctx.fill();
        });

        // 3. Multi-layer Organic Fluid Wave Blobs
        const layers = 5;
        for (let l = 0; l < layers; l++) {
          ctx.beginPath();
          const points = 48;
          for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const waveOffset =
              Math.sin(angle * (3 + l) + phase + l * 0.7) * (10 + activeLevel * 30) +
              Math.cos(angle * 2 - phase * 0.9 + l) * (6 + activeLevel * 18);
            const r = dynamicRadius + waveOffset - l * 7;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();

          const layerGradient = ctx.createLinearGradient(
            centerX - dynamicRadius, centerY - dynamicRadius,
            centerX + dynamicRadius, centerY + dynamicRadius
          );

          if (status === 'speaking') {
            layerGradient.addColorStop(0, `rgba(168, 85, 247, ${0.45 - l * 0.07})`);
            layerGradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.4 - l * 0.06})`);
            layerGradient.addColorStop(1, `rgba(6, 182, 212, ${0.35 - l * 0.05})`);
          } else if (status === 'listening') {
            layerGradient.addColorStop(0, `rgba(16, 185, 129, ${0.5 - l * 0.08})`);
            layerGradient.addColorStop(0.5, `rgba(6, 182, 212, ${0.4 - l * 0.06})`);
            layerGradient.addColorStop(1, `rgba(59, 130, 246, ${0.35 - l * 0.05})`);
          } else {
            layerGradient.addColorStop(0, `rgba(99, 102, 241, ${0.3 - l * 0.05})`);
            layerGradient.addColorStop(1, `rgba(147, 51, 234, ${0.25 - l * 0.04})`);
          }

          ctx.fillStyle = layerGradient;
          ctx.fill();
        }

        // 4. Core glowing glass sphere
        const coreGradient = ctx.createRadialGradient(
          centerX - baseRadius * 0.25, centerY - baseRadius * 0.25, 0,
          centerX, centerY, baseRadius * 0.75
        );
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(0.35, status === 'speaking' ? '#d8b4fe' : '#a7f3d0');
        coreGradient.addColorStop(0.7, status === 'speaking' ? '#8b5cf6' : '#06b6d4');
        coreGradient.addColorStop(1, status === 'speaking' ? '#4f46e5' : '#059669');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.58 + activeLevel * 18, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Spectrum Bars Mode (High Craft Visualizer)
        const barCount = 42;
        const barWidth = 4;
        const gap = (width - barCount * barWidth) / (barCount + 1);

        for (let i = 0; i < barCount; i++) {
          const dataIdx = Math.floor((i / barCount) * dataArray.length);
          const val = (dataArray[dataIdx] || 0) / 255;
          const barHeight = Math.max(8, val * height * 0.7 * (activeLevel + 0.35));

          const x = gap + i * (barWidth + gap);
          const y = centerY - barHeight / 2;

          const barGrad = ctx.createLinearGradient(x, y, x, y + barHeight);
          if (status === 'speaking') {
            barGrad.addColorStop(0, '#c084fc');
            barGrad.addColorStop(1, '#3b82f6');
          } else {
            barGrad.addColorStop(0, '#34d399');
            barGrad.addColorStop(1, '#06b6d4');
          }

          ctx.fillStyle = barGrad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 4);
          ctx.fill();
        }
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser, outputAnalyser, isActive, status, mode]);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="max-w-full max-h-full transition-all duration-300"
      />
    </div>
  );
};
