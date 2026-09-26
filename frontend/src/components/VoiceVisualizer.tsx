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

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Get mic frequency or output frequency
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

      const activeLevel = Math.max(inputLevel * 1.5, outputLevel * 2.2);
      phase += 0.04 + activeLevel * 0.08;

      if (mode === 'orb') {
        // Render 3D-like Glowing Organic AI Orb
        const baseRadius = Math.min(width, height) * 0.22;
        const dynamicRadius = baseRadius + activeLevel * 45;

        // Outer glow
        const glowGradient = ctx.createRadialGradient(
          centerX, centerY, baseRadius * 0.5,
          centerX, centerY, dynamicRadius * 1.8
        );

        if (status === 'speaking') {
          // AI Speaking: Purple/Blue/Cyan glow
          glowGradient.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
          glowGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.4)');
          glowGradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
        } else if (status === 'listening') {
          // User speaking / listening: Emerald/Teal/Blue glow
          glowGradient.addColorStop(0, 'rgba(52, 211, 153, 0.85)');
          glowGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.45)');
          glowGradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else if (status === 'processing') {
          // Processing: Amber/Orange glow
          glowGradient.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
          glowGradient.addColorStop(0.6, 'rgba(245, 158, 11, 0.3)');
          glowGradient.addColorStop(1, 'rgba(217, 119, 6, 0)');
        } else {
          // Idle glow
          glowGradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
          glowGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        }

        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, dynamicRadius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Multi-layered pulsating organic waves
        const layers = 4;
        for (let l = 0; l < layers; l++) {
          ctx.beginPath();
          const points = 36;
          for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const waveOffset =
              Math.sin(angle * (3 + l) + phase + l) * (8 + activeLevel * 25) +
              Math.cos(angle * 2 - phase * 0.8) * (4 + activeLevel * 15);
            const r = dynamicRadius + waveOffset - l * 8;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();

          const layerGradient = ctx.createLinearGradient(
            centerX - dynamicRadius, centerY - dynamicRadius,
            centerX + dynamicRadius, centerY + dynamicRadius
          );

          if (status === 'speaking') {
            layerGradient.addColorStop(0, `rgba(147, 51, 234, ${0.4 - l * 0.08})`);
            layerGradient.addColorStop(1, `rgba(59, 130, 246, ${0.5 - l * 0.08})`);
          } else if (status === 'listening') {
            layerGradient.addColorStop(0, `rgba(16, 185, 129, ${0.4 - l * 0.08})`);
            layerGradient.addColorStop(1, `rgba(14, 165, 233, ${0.5 - l * 0.08})`);
          } else {
            layerGradient.addColorStop(0, `rgba(79, 70, 229, ${0.3 - l * 0.05})`);
            layerGradient.addColorStop(1, `rgba(147, 51, 234, ${0.3 - l * 0.05})`);
          }

          ctx.fillStyle = layerGradient;
          ctx.fill();
        }

        // Inner glowing core
        const coreGradient = ctx.createRadialGradient(
          centerX - 10, centerY - 10, 0,
          centerX, centerY, baseRadius * 0.7
        );
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(0.4, status === 'speaking' ? '#c084fc' : '#6ee7b7');
        coreGradient.addColorStop(1, status === 'speaking' ? '#6366f1' : '#0284c7');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.55 + activeLevel * 15, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Waveform / Spectrum Bars Mode
        const barWidth = width / 48;
        ctx.fillStyle = status === 'speaking' ? '#a855f7' : '#10b981';

        for (let i = 0; i < 48; i++) {
          const index = Math.floor((i / 48) * dataArray.length);
          const val = (dataArray[index] || 0) / 255;
          const barHeight = Math.max(6, val * height * 0.75 * (activeLevel + 0.3));

          const x = i * (barWidth + 2);
          const y = centerY - barHeight / 2;

          ctx.fillRect(x, y, barWidth, barHeight);
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
        width={360}
        height={360}
        className="max-w-full max-h-full transition-all duration-300"
      />
    </div>
  );
};
