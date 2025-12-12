
import React, { useRef, useEffect } from 'react';
import { ThemeColor } from '../types';

interface FractalPineProps {
    progress: number; // 0.0 to 1.0
    width?: number;
    height?: number;
    theme?: ThemeColor;
    showTree?: boolean;
    showParticles?: boolean;
}

const THEME_PALETTES: Record<ThemeColor, { trunk: string; leaf: string; particle: string[] }> = {
    pine: {
        trunk: '#4A3728',
        leaf: '#2E8B57',
        // 核心：高亮琥珀色 (#fbbf24) | 光晕：鲜艳荧光绿 (#4ade80)
        particle: ['#fbbf24', '#4ade80']
    },
    ocean: {
        trunk: '#1e293b',
        leaf: '#0ea5e9',
        // 气泡：深蔚蓝 (#0284c7) | 亮青色 (#38bdf8)
        particle: ['#0284c7', '#38bdf8', 'rgba(255,255,255,0.9)']
    },
    sunset: {
        trunk: '#5c2b29',
        leaf: '#fb7185',
        particle: ['#fbcfe8', '#f9a8d4', '#fda4af']
    },
    lavender: {
        trunk: '#2e1065',
        leaf: '#8b5cf6',
        particle: ['#e9d5ff', '#d8b4fe', '#c4b5fd']
    },
    graphite: {
        trunk: '#171717',
        leaf: '#64748b',
        particle: ['#94a3b8', '#cbd5e1', '#64748b']
    },
};

type ParticleType = 'firefly' | 'bubble' | 'sakura' | 'code' | 'butterfly';

class Particle {
    x: number;
    y: number;
    size: number;
    speedY: number;
    speedX: number;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
    width: number;
    height: number;
    phase: number;
    type: ParticleType;
    color: string;
    colors: string[];
    char: string;

    constructor(width: number, height: number, type: ParticleType, colors: string[]) {
        this.width = width;
        this.height = height;
        this.type = type;
        this.colors = colors;
        this.color = colors[0];

        this.x = 0;
        this.y = 0;
        this.phase = 0;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.opacity = 0;
        this.size = 0;
        this.speedX = 0;
        this.speedY = 0;
        this.char = '';

        this.reset(true);
    }

    reset(initial: boolean = false) {
        this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
        this.phase = Math.random() * 100;

        if (!initial) {
            if (this.type === 'bubble' || this.type === 'butterfly' || this.type === 'firefly') {
                this.y = this.height + 20;
            } else {
                this.y = -20;
            }
            this.x = Math.random() * this.width;
            this.opacity = 0;
        } else {
            this.x = Math.random() * this.width;
            this.y = Math.random() * this.height;
            this.opacity = Math.random();
        }

        switch (this.type) {
            case 'bubble':
                this.size = Math.random() * 4 + 2;
                this.speedY = Math.random() * 1.5 + 0.5;
                this.speedX = 0;
                break;

            case 'sakura':
                this.size = Math.random() * 5 + 3;
                this.speedY = Math.random() * 1.0 + 0.5;
                this.speedX = Math.random() * 1.0 - 0.5;
                this.rotationSpeed = (Math.random() - 0.5) * 0.05;
                this.rotation = Math.random() * Math.PI * 2;
                break;

            case 'butterfly':
                this.size = Math.random() * 5 + 4;
                this.speedY = Math.random() * 0.8 + 0.3;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.rotation = Math.random() * 0.5 - 0.25;
                break;

            case 'code':
                this.size = Math.random() * 10 + 8;
                this.speedY = Math.random() * 2 + 1.5;
                this.speedX = 0;
                const chars = ['0', '1', '+', 'x', '<', '>'];
                this.char = chars[Math.floor(Math.random() * chars.length)];
                break;

            case 'firefly':
            default:
                this.size = Math.random() * 1.5 + 1.0;
                this.speedY = Math.random() * 0.3 + 0.1;
                this.speedX = (Math.random() - 0.5) * 0.4;
                break;
        }
    }

    update() {
        this.phase += 0.05;

        // Optimization: Pre-calculate commonly used Math values if needed,
        // but modern JS engines optimize Math.sin/cos well.
        // Key optimization here is keeping logic simple.

        switch (this.type) {
            case 'bubble':
                this.y -= this.speedY;
                this.x += Math.sin(this.phase * 0.5) * 0.5;
                if (this.y < this.height * 0.5) this.size += 0.01;
                if (this.y < this.height * 0.2) this.opacity -= 0.02;
                else if (this.opacity < 0.6) this.opacity += 0.02;
                break;

            case 'sakura':
                this.y += this.speedY;
                this.x += Math.sin(this.phase) * 1.2 + this.speedX;
                this.rotation += this.rotationSpeed;
                this.rotation += Math.cos(this.phase) * 0.01;
                if (this.y < this.height * 0.2) this.opacity = Math.min(1, this.opacity + 0.05);
                if (this.y > this.height * 0.9) this.opacity -= 0.02;
                break;

            case 'butterfly':
                this.y -= this.speedY;
                this.x += Math.sin(this.phase) * 0.8 + this.speedX;
                this.rotation = Math.sin(this.phase) * 0.3;
                if (this.y < this.height * 0.8 && this.opacity < 0.8) this.opacity += 0.02;
                if (this.y < this.height * 0.1) this.opacity -= 0.02;
                break;

            case 'code':
                this.y += this.speedY;
                if (Math.random() > 0.99) this.x += (Math.random() - 0.5) * 20;
                if (Math.random() > 0.95) {
                    const chars = ['0', '1', '+', 'x', '<', '>'];
                    this.char = chars[Math.floor(Math.random() * chars.length)];
                }
                if (this.y < this.height * 0.2) this.opacity = Math.min(0.8, this.opacity + 0.1);
                if (this.y > this.height * 0.9) this.opacity -= 0.05;
                break;

            case 'firefly':
            default:
                this.x += (Math.sin(this.phase * 0.3) * 0.3 + Math.cos(this.phase * 0.7) * 0.2) + this.speedX * 0.1;
                this.y -= this.speedY * 0.8;
                this.opacity = 0.4 + (Math.sin(this.phase * 0.5) + 1) * 0.3;
                break;
        }

        // Boundary Check
        const margin = 30;
        if (
            this.y < -margin ||
            this.y > this.height + margin ||
            this.x < -margin ||
            this.x > this.width + margin ||
            this.opacity <= 0
        ) {
            this.reset();
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Optimization: Round coordinates to avoid sub-pixel rendering overhead
        const px = Math.round(this.x);
        const py = Math.round(this.y);

        ctx.save();
        ctx.translate(px, py);

        // Global optimization: Avoid shadowBlur (it's very CPU intensive).
        // Instead, use layered drawing or opacity to simulate glow.

        if (this.type === 'sakura') {
            ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity));
            ctx.fillStyle = this.color;
            ctx.rotate(this.rotation);
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
            // Simulate shadow with a slightly offset fill instead of blur
            ctx.fill();

        } else if (this.type === 'butterfly') {
            ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity));
            ctx.fillStyle = this.color;
            ctx.rotate(this.rotation);
            const flap = Math.abs(Math.sin(this.phase * 3));
            ctx.scale(flap, 1);
            ctx.beginPath();
            ctx.ellipse(-this.size/2, 0, this.size, this.size/1.5, Math.PI/4, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(this.size/2, 0, this.size, this.size/1.5, -Math.PI/4, 0, Math.PI*2);
            ctx.fill();

        } else if (this.type === 'code') {
            ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity));
            ctx.fillStyle = this.color;
            ctx.font = `bold ${Math.round(this.size)}px monospace`;
            ctx.fillText(this.char, 0, 0);

        } else if (this.type === 'bubble') {
            ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity));
            ctx.strokeStyle = this.color;
            // Increased line width for better visibility
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(-this.size*0.3, -this.size*0.3, this.size*0.25, 0, Math.PI * 2);
            ctx.fill();

        } else {
            // ✨ Firefly Optimization (Vivid Version)
            const alpha = Math.max(0, Math.min(1, this.opacity));

            // Outer Glow (Vivid Green)
            ctx.globalAlpha = alpha * 0.4;
            ctx.fillStyle = this.colors[1]; // Greenish
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 4, 0, Math.PI * 2);
            ctx.fill();

            // Inner Core (Bright Amber)
            ctx.globalAlpha = 1; // Keep core solid
            ctx.fillStyle = this.colors[0]; // Yellowish
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

const FractalPine: React.FC<FractalPineProps> = ({
                                                     progress,
                                                     width = 300,
                                                     height = 300,
                                                     theme = 'pine',
                                                     showTree = true,
                                                     showParticles = true
                                                 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const currentProgressRef = useRef<number>(0);
    const timeRef = useRef<number>(0);
    const particlesRef = useRef<Particle[]>([]);

    // PERFORMANCE OPTIMIZATION:
    // Reduced MAX_DEPTH from 12 to 10.
    // Depth 12 = 4096 branches. Depth 10 = 1024 branches. (4x speedup)
    const MAX_DEPTH = 10;

    const palette = THEME_PALETTES[theme] || THEME_PALETTES.pine;
    const TRUNK_COLOR = palette.trunk;
    const LEAF_COLOR = palette.leaf;
    const PARTICLE_COLORS = palette.particle;

    const BRANCH_ANGLE = 22;
    const TRUNK_SHRINK = 0.8;
    const BRANCH_SHRINK = 0.65;

    const getParticleType = (t: ThemeColor): ParticleType => {
        switch(t) {
            case 'ocean': return 'bubble';
            case 'sunset': return 'sakura';
            case 'lavender': return 'butterfly';
            case 'graphite': return 'code';
            case 'pine': default: return 'firefly';
        }
    };

    useEffect(() => {
        if (!showParticles) {
            particlesRef.current = [];
            return;
        }

        particlesRef.current = [];
        const type = getParticleType((theme || 'pine') as ThemeColor);

        // Adjusted counts for performance
        let count = 50;
        if (type === 'sakura') count = 80; // Enough to look good
        if (type === 'code') count = 60;
        if (type === 'butterfly') count = 30;
        if (type === 'firefly') count = 40;

        for(let i=0; i < count; i++) {
            particlesRef.current.push(new Particle(width, height, type, PARTICLE_COLORS));
        }
    }, [width, height, theme, showParticles]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: true }); // optimize context
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        // Optimization: Cap DPR to 2 to avoid massive canvas on high-res screens
        const effectiveDpr = Math.min(dpr, 2);

        canvas.width = width * effectiveDpr;
        canvas.height = height * effectiveDpr;
        ctx.scale(effectiveDpr, effectiveDpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const degToRad = (deg: number) => (deg * Math.PI) / 180;

        const drawPine = (
            x: number,
            y: number,
            length: number,
            angle: number,
            depth: number,
            branchWidth: number,
            currentTime: number
        ) => {
            // PERFORMANCE OPTIMIZATION: Pruning
            // If the branch is too thin to see, stop drawing.
            if (branchWidth < 0.4 || depth < 0) return;

            ctx.save();
            ctx.translate(x, y);

            const windInfluence = (MAX_DEPTH - depth) * 0.05;
            const windSway = Math.sin(currentTime * 0.002 + (MAX_DEPTH - depth) * 0.5) * windInfluence;
            const finalAngle = depth === MAX_DEPTH ? angle : angle + windSway;

            ctx.rotate(degToRad(finalAngle));

            if (depth > MAX_DEPTH - 3) {
                ctx.strokeStyle = TRUNK_COLOR;
            } else {
                ctx.strokeStyle = LEAF_COLOR;
                if (depth < 3) ctx.globalAlpha = 0.8;
            }

            ctx.lineWidth = branchWidth;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -length);
            ctx.stroke();

            if (depth > 0) {
                ctx.translate(0, -length);

                // Simple sway only for performance
                const wobble = Math.sin(depth * 0.5) * 2;

                drawPine(
                    0, 0,
                    length * TRUNK_SHRINK,
                    wobble,
                    depth - 1,
                    branchWidth * 0.8,
                    currentTime
                );

                if (depth < MAX_DEPTH) {
                    drawPine(
                        0, 0,
                        length * BRANCH_SHRINK,
                        -BRANCH_ANGLE - 10,
                        depth - 1,
                        branchWidth * 0.6,
                        currentTime
                    );
                    drawPine(
                        0, 0,
                        length * BRANCH_SHRINK,
                        BRANCH_ANGLE + 10,
                        depth - 1,
                        branchWidth * 0.6,
                        currentTime
                    );
                }
            }

            ctx.restore();
        };

        const animate = (timestamp: number) => {
            timeRef.current = timestamp;

            const target = Math.min(1, Math.max(0, progress));
            const diff = target - currentProgressRef.current;

            if (Math.abs(diff) < 0.001) {
                currentProgressRef.current = target;
            } else {
                currentProgressRef.current += diff * 0.1;
            }

            ctx.clearRect(0, 0, width, height);

            const displayProgress = currentProgressRef.current;

            if (showTree && displayProgress > 0.01) {
                const maxPossibleHeight = height * 0.85;
                const maxBaseLength = maxPossibleHeight / 3.5;
                const currentBaseLength = maxBaseLength * Math.pow(displayProgress, 0.7);
                const currentDepth = Math.floor(3 + (displayProgress * (MAX_DEPTH - 3)));
                const baseWidth = Math.max(1, currentBaseLength / 6);

                drawPine(
                    width / 2,
                    height,
                    currentBaseLength,
                    0,
                    currentDepth,
                    baseWidth,
                    timeRef.current
                );
            }

            if (showParticles) {
                particlesRef.current.forEach(p => {
                    p.update();
                    p.draw(ctx);
                });
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [progress, width, height, theme, showTree, showParticles]);

    return <canvas ref={canvasRef} className="pointer-events-none" />;
};

export default FractalPine;
