/**
 * Theme-aware High-DPI HTML5 Canvas Renderers for Heat, Numerical Heat & Wave Simulators
 */

function getThemeTokens() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        dark,
        bg: dark ? '#0e121b' : '#fcfcfd',
        grid: dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)',
        axis: dark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.32)',
        text: dark ? '#cbd5e1' : '#334155',
        muted: dark ? '#64748b' : '#94a3b8',
        border: dark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.16)',
        waveMain: dark ? '#38bdf8' : '#0284c7',
        waveFill: dark ? 'rgba(56,189,248,0.14)' : 'rgba(2,132,199,0.12)',
        waveRight: dark ? '#a78bfa' : '#7c3aed',
        waveLeft: dark ? '#34d399' : '#059669',
        nodeColor: dark ? '#fb714c' : '#dc2626'
    };
}

// Smooth Violet (cold) -> Red (hot) thermal colormap (no white/yellow washout)
const HEAT_PLOTLY_COLORSCALE = [
    [0.00, '#2e1065'],
    [0.25, '#5b21b6'],
    [0.50, '#9333ea'],
    [0.75, '#db2777'],
    [1.00, '#dc2626']
];

function heatColorRGB(t) {
    const v = Math.max(0, Math.min(1, t));
    const stops = [
        [0.00, [46, 16, 101]],   // Deep Violet (cold)
        [0.25, [91, 33, 182]],   // Royal Violet
        [0.50, [147, 51, 234]],  // Vivid Purple
        [0.75, [219, 39, 119]],  // Magenta-Crimson
        [1.00, [220, 38, 38]]    // Pure Red (hot)
    ];
    for (let i = 0; i < stops.length - 1; i++) {
        const [t0, c0] = stops[i];
        const [t1, c1] = stops[i + 1];
        if (v >= t0 && v <= t1) {
            const f = (v - t0) / (t1 - t0);
            return [
                Math.round(c0[0] + f * (c1[0] - c0[0])),
                Math.round(c0[1] + f * (c1[1] - c0[1])),
                Math.round(c0[2] + f * (c1[2] - c0[2]))
            ];
        }
    }
    return stops[stops.length - 1][1];
}

function drawCrispArrow(ctx, x1, y1, x2, y2, headLen = 6.5) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    // Subtle dark halo for legibility on any color
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.58)';
    ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.9;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    // Arrowhead
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(ang - 0.52), y2 - headLen * Math.sin(ang - 0.52));
    ctx.lineTo(x2 - headLen * Math.cos(ang + 0.52), y2 - headLen * Math.sin(ang + 0.52));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

class HeatCanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.showVectors = true;
    }

    _prep() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(300, Math.round(rect.width));
        const h = Math.max(220, Math.round(rect.height));
        if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
        }
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { w, h, tk: getThemeTokens() };
    }

    render(solver) {
        const { w, h, tk } = this._prep();
        const ctx = this.ctx;
        ctx.fillStyle = tk.bg;
        ctx.fillRect(0, 0, w, h);

        const lo = Math.min(0, solver.uMin);
        const hi = Math.max(1, solver.uMax);
        const span = Math.max(1e-6, hi - lo);

        if (solver.dimension === '1d') {
            this._render1D(ctx, w, h, tk, solver, lo, hi, span);
        } else {
            this._render2D(ctx, w, h, tk, solver, lo, hi, span);
        }
    }

    _render1D(ctx, w, h, tk, solver, lo, hi, span) {
        const padL = 56, padR = 32, padT = 28, padB = 86;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        // Horizontal gridlines
        ctx.strokeStyle = tk.grid;
        ctx.lineWidth = 1;
        for (let k = 0; k <= 4; k++) {
            const y = padT + (k / 4) * plotH;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
            const val = hi - (k / 4) * span;
            ctx.fillStyle = tk.muted;
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.textAlign = 'right';
            ctx.fillText(val.toFixed(2), padL - 8, y + 4);
        }

        // Temperature curve
        ctx.beginPath();
        for (let i = 0; i <= solver.nx; i++) {
            const x = padL + (i / solver.nx) * plotW;
            const norm = (solver.u[i] - lo) / span;
            const y = padT + (1 - norm) * plotH;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = tk.dark ? '#f43f5e' : '#dc2626';
        ctx.lineWidth = 2.6;
        ctx.stroke();

        // Physical 1D Thermal Rod
        const rodY = padT + plotH + 20;
        const rodH = 34;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(padL, rodY, plotW, rodH, 9);
        ctx.clip();
        const segW = plotW / solver.nx + 1;
        for (let i = 0; i < solver.nx; i++) {
            const norm = ((solver.u[i] + solver.u[i + 1]) * 0.5 - lo) / span;
            const [r, g, b] = heatColorRGB(norm);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(padL + (i / solver.nx) * plotW, rodY, segW, rodH);
        }
        ctx.restore();

        // 1D Heat Flux Arrows along the rod centerline (q = -beta * du/dx)
        if (this.showVectors) {
            const nArrows = 10;
            const cy = rodY + rodH / 2;
            for (let k = 0; k < nArrows; k++) {
                const xn = (k + 0.5) / nArrows;
                const { qx } = solver.getFluxAt(xn, 0.5);
                const mag = Math.abs(qx);
                if (mag < 1e-4) continue;
                const dir = Math.sign(qx);
                const halfLen = Math.min(18, Math.max(6, Math.log1p(mag * 70) * 6.5));
                const cx = padL + xn * plotW;
                drawCrispArrow(ctx, cx - dir * halfLen * 0.65, cy, cx + dir * halfLen, cy, 6.2);
            }
        }

        ctx.strokeStyle = tk.border;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.roundRect(padL, rodY, plotW, rodH, 9);
        ctx.stroke();

        // Axis labels
        ctx.fillStyle = tk.text;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('x = 0', padL, rodY + rodH + 17);
        ctx.textAlign = 'center';
        ctx.fillText('1D Thin Rod · White Arrows Show Heat Flux q = −β ∂u/∂x', padL + plotW / 2, rodY + rodH + 17);
        ctx.textAlign = 'right';
        ctx.fillText('x = L', padL + plotW, rodY + rodH + 17);
    }

    _render2D(ctx, w, h, tk, solver, lo, hi, span) {
        const size = Math.min(w - 80, h - 46);
        const x0 = Math.round((w - size) / 2);
        const y0 = Math.round((h - size) / 2) - 4;

        const nx = solver.nx + 1;
        const ny = solver.ny + 1;
        if (!this._off || this._off.width !== nx || this._off.height !== ny) {
            this._off = document.createElement('canvas');
            this._off.width = nx;
            this._off.height = ny;
            this._offCtx = this._off.getContext('2d');
        }
        const img = this._offCtx.createImageData(nx, ny);
        const d = img.data;
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const uVal = solver.u[solver.idx(i, ny - 1 - j)];
                const [r, g, b] = heatColorRGB((uVal - lo) / span);
                const p = (j * nx + i) * 4;
                d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
            }
        }
        this._offCtx.putImageData(img, 0, 0);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x0, y0, size, size, 10);
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this._off, x0, y0, size, size);

        // Clear, high-contrast 2D Heat Flux Vectors
        if (this.showVectors) {
            const steps = 8;
            for (let gy = 1; gy < steps; gy++) {
                for (let gx = 1; gx < steps; gx++) {
                    const xn = gx / steps;
                    const yn = 1 - gy / steps;
                    const { qx, qy } = solver.getFluxAt(xn, yn);
                    const mag = Math.hypot(qx, qy);
                    if (mag < 1e-4) continue;
                    const len = Math.min(24, Math.max(8, Math.log1p(mag * 55) * 8.5));
                    const ang = Math.atan2(-qy, qx);
                    const px = x0 + xn * size;
                    const py = y0 + (gy / steps) * size;
                    const ex = px + Math.cos(ang) * len;
                    const ey = py + Math.sin(ang) * len;
                    drawCrispArrow(ctx, px - Math.cos(ang) * 3, py - Math.sin(ang) * 3, ex, ey, 6.8);
                }
            }
        }
        ctx.restore();

        ctx.strokeStyle = tk.border;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(x0, y0, size, size, 10);
        ctx.stroke();

        ctx.fillStyle = tk.muted;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('2D Plate Domain [0, L] × [0, L] · Arrows show Heat Flux q = −β∇u', w / 2, y0 + size + 18);
    }
}

/**
 * Animated Numerical Heat Simulation Canvas
 * Displays stacked discrete-node thermal rods for Exact, Explicit FTCS,
 * Implicit BTCS, and Crank-Nicolson side-by-side + live finite-difference stencil.
 */
class NumericalHeatCanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    _prep() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(320, Math.round(rect.width));
        const h = Math.max(240, Math.round(rect.height));
        if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
        }
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { w, h, tk: getThemeTokens() };
    }

    render(lab, visibility) {
        const { w, h, tk } = this._prep();
        const ctx = this.ctx;
        ctx.fillStyle = tk.bg;
        ctx.fillRect(0, 0, w, h);

        const rows = [
            { key: 'exact', label: 'Exact Analytical', arr: lab.uExact, color: tk.text, badge: 'Reference' },
            { key: 'ftcs',  label: 'Explicit FTCS',    arr: lab.uFTCS,  color: '#dc2626', badge: lab.lambda <= 0.5 + 1e-9 ? 'Stable' : 'Unstable!' },
            { key: 'btcs',  label: 'Implicit BTCS',    arr: lab.uBTCS,  color: '#0284c7', badge: 'Uncond. Stable' },
            { key: 'cn',    label: 'Crank–Nicolson',   arr: lab.uCN,    color: '#059669', badge: '2nd Order' }
        ].filter(r => visibility[r.key]);

        if (rows.length === 0) return;

        const lo = Math.min(0, lab.T0, lab.TL);
        const hi = Math.max(1, lab.T0, lab.TL);
        const span = Math.max(1e-6, hi - lo);

        const padL = 136, padR = 26, padT = 34, padB = 34;
        const barW = w - padL - padR;
        const rowH = Math.min(48, (h - padT - padB) / rows.length);
        const barH = Math.min(26, rowH - 14);
        const startY = padT + ((h - padT - padB) - rowH * rows.length) / 2;

        // Top step header
        ctx.fillStyle = tk.muted;
        ctx.font = '600 11px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`TIME STEP l = ${lab.stepCount}  |  t = ${lab.time.toFixed(4)}  |  N = ${lab.nx} intervals (Δx = ${lab.dx.toFixed(3)})`, padL, 20);

        const nNodes = lab.nx + 1;
        const cellW = barW / nNodes;
        const focusIdx = Math.floor(nNodes / 2);

        rows.forEach((row, rIdx) => {
            const ry = startY + rIdx * rowH;

            // Scheme label on left
            ctx.fillStyle = row.color;
            ctx.font = '600 12px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(row.label, padL - 12, ry + barH / 2 + 1);

            ctx.fillStyle = tk.muted;
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.fillText(row.badge, padL - 12, ry + barH / 2 + 13);

            // Discrete grid cells along the rod
            for (let i = 0; i < nNodes; i++) {
                const val = row.arr[i];
                const outOfBounds = (val < lo - span * 0.25) || (val > hi + span * 0.25);
                const norm = (val - lo) / span;
                const [r, g, b] = heatColorRGB(norm);

                const cx = padL + i * cellW;
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(cx + 0.5, ry, Math.max(2, cellW - 1), barH);

                // Highlight oscillating/diverged nodes with diagonal warning border
                if (outOfBounds) {
                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 1.8;
                    ctx.strokeRect(cx + 1, ry + 1, Math.max(1, cellW - 2), barH - 2);
                }

                // Subtle node center dot for discrete grid feel
                if (nNodes <= 22) {
                    ctx.fillStyle = 'rgba(255,255,255,0.75)';
                    ctx.beginPath();
                    ctx.arc(cx + cellW / 2, ry + barH / 2, 2.0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Outer rod frame
            ctx.strokeStyle = tk.border;
            ctx.lineWidth = 1.1;
            ctx.strokeRect(padL, ry, barW, barH);

            // Active 3-point stencil bracket on middle node (i-1, i, i+1) for numerical schemes
            if (row.key !== 'exact' && lab.stepCount > 0 && nNodes >= 5) {
                const sx = padL + (focusIdx - 1) * cellW;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.6;
                ctx.strokeRect(sx, ry - 1, cellW * 3, barH + 2);
            }
        });

        // Bottom x-axis markers
        ctx.fillStyle = tk.muted;
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('x₀ = 0', padL, h - 10);
        ctx.textAlign = 'center';
        ctx.fillText('Discrete Grid Nodes (white bracket = active 3-point FD stencil i−1, i, i+1)', padL + barW / 2, h - 10);
        ctx.textAlign = 'right';
        ctx.fillText(`x_${lab.nx} = ${lab.L}`, padL + barW, h - 10);
    }
}

class WaveCanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.showDAlembert = true;
        this.showNodes = true;
    }

    _prep() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(300, Math.round(rect.width));
        const h = Math.max(220, Math.round(rect.height));
        if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
        }
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { w, h, tk: getThemeTokens() };
    }

    render(solver) {
        const { w, h, tk } = this._prep();
        const ctx = this.ctx;
        ctx.fillStyle = tk.bg;
        ctx.fillRect(0, 0, w, h);

        if (solver.dimension === '1d') {
            this._render1D(ctx, w, h, tk, solver);
        } else {
            this._render2DWater(ctx, w, h, tk, solver);
        }
    }

    _render1D(ctx, w, h, tk, solver) {
        const padL = 52, padR = 32, padT = 28, padB = 38;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;
        const midY = padT + plotH / 2;
        const ampScale = plotH * 0.42;

        ctx.strokeStyle = tk.grid;
        ctx.lineWidth = 1;
        [-1, -0.5, 0.5, 1].forEach(val => {
            const y = midY - val * ampScale;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
            ctx.fillStyle = tk.muted;
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.textAlign = 'right';
            ctx.fillText(val.toFixed(1), padL - 8, y + 4);
        });

        ctx.strokeStyle = tk.axis;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(padL, midY); ctx.lineTo(padL + plotW, midY); ctx.stroke();
        ctx.setLineDash([]);

        if (this.showDAlembert && solver.velType === 'zero' && solver.damping === 0) {
            const dal = solver.getDAlembertComponents();
            if (dal) {
                const drawComp = (arr, color) => {
                    ctx.beginPath();
                    for (let i = 0; i <= solver.nx; i++) {
                        const x = padL + (i / solver.nx) * plotW;
                        const y = midY - Math.max(-1.2, Math.min(1.2, arr[i])) * ampScale;
                        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.6;
                    ctx.setLineDash([5, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                };
                drawComp(dal.uR, tk.waveRight);
                drawComp(dal.uL, tk.waveLeft);

                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillStyle = tk.waveRight;
                ctx.fillText('--- ½ f(x − ct) right', padL + 8, padT + 12);
                ctx.fillStyle = tk.waveLeft;
                ctx.fillText('--- ½ f(x + ct) left', padL + 130, padT + 12);
            }
        }

        // Filled wave envelope
        ctx.beginPath();
        ctx.moveTo(padL, midY);
        for (let i = 0; i <= solver.nx; i++) {
            const x = padL + (i / solver.nx) * plotW;
            const y = midY - Math.max(-1.2, Math.min(1.2, solver.uDisplay[i])) * ampScale;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(padL + plotW, midY);
        ctx.closePath();
        ctx.fillStyle = tk.waveFill;
        ctx.fill();

        // Main vibrating string curve
        ctx.beginPath();
        for (let i = 0; i <= solver.nx; i++) {
            const x = padL + (i / solver.nx) * plotW;
            const y = midY - Math.max(-1.2, Math.min(1.2, solver.uDisplay[i])) * ampScale;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = tk.waveMain;
        ctx.lineWidth = 2.8;
        ctx.stroke();

        // Interior standing-wave nodes (only when mode >= 2 on Dirichlet)
        if (this.showNodes && solver.bcType === 'dirichlet' && solver.icType === 'mode' && solver.modeM >= 2) {
            const n = solver.modeM;
            ctx.fillStyle = tk.nodeColor;
            for (let k = 1; k < n; k++) {
                const x = padL + (k / n) * plotW;
                ctx.beginPath();
                ctx.arc(x, midY, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const yLeft = midY - Math.max(-1.2, Math.min(1.2, solver.uDisplay[0])) * ampScale;
        const yRight = midY - Math.max(-1.2, Math.min(1.2, solver.uDisplay[solver.nx])) * ampScale;
        [[padL, yLeft], [padL + plotW, yRight]].forEach(([ex, ey]) => {
            ctx.beginPath();
            ctx.arc(ex, ey, 5.5, 0, Math.PI * 2);
            if (solver.bcType === 'dirichlet') {
                ctx.fillStyle = tk.text;
                ctx.fill();
            } else {
                ctx.fillStyle = tk.bg;
                ctx.fill();
                ctx.strokeStyle = tk.waveMain;
                ctx.lineWidth = 2.2;
                ctx.stroke();
            }
        });

        ctx.fillStyle = tk.muted;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('x = 0', padL, h - 12);
        ctx.textAlign = 'center';
        ctx.fillText(solver.bcType === 'dirichlet' ? 'Fixed Ends: u(0,t) = u(L,t) = 0' : 'Free Ends: uₓ(0,t) = uₓ(L,t) = 0', padL + plotW / 2, h - 12);
        ctx.textAlign = 'right';
        ctx.fillText('x = L', padL + plotW, h - 12);
    }

    /**
     * Realistic Water-Surface Shaded 2D Wave Renderer ("Stone in Water")
     * Computes surface normals from finite-difference gradients (du/dx, du/dy)
     * and applies Blinn-Phong diffuse + specular lighting over deep-to-bright water shades.
     */
    _render2DWater(ctx, w, h, tk, solver) {
        const size = Math.min(w - 80, h - 46);
        const x0 = Math.round((w - size) / 2);
        const y0 = Math.round((h - size) / 2) - 4;
        const nx = solver.nx + 1;
        const ny = solver.ny + 1;

        if (!this._off || this._off.width !== nx || this._off.height !== ny) {
            this._off = document.createElement('canvas');
            this._off.width = nx;
            this._off.height = ny;
            this._offCtx = this._off.getContext('2d');
        }
        const img = this._offCtx.createImageData(nx, ny);
        const d = img.data;

        // Normalized directional light & half-vector for specular water glints
        const lx = -0.48, ly = -0.52, lz = 0.71;
        const hx = -0.26, hy = -0.28, hz = 0.92;
        const slopeGain = 2.6;

        for (let j = 0; j < ny; j++) {
            const sj = ny - 1 - j;
            const jUp = Math.min(ny - 1, sj + 1);
            const jDn = Math.max(0, sj - 1);
            for (let i = 0; i < nx; i++) {
                const iL = Math.max(0, i - 1);
                const iR = Math.min(nx - 1, i + 1);

                const uVal = solver.uDisplay[solver.idx(i, sj)];
                const ux = (solver.uDisplay[solver.idx(iR, sj)] - solver.uDisplay[solver.idx(iL, sj)]) * slopeGain;
                const uy = (solver.uDisplay[solver.idx(i, jUp)] - solver.uDisplay[solver.idx(i, jDn)]) * slopeGain;

                // Surface normal n = normalize(-ux, -uy, 1)
                const invLen = 1 / Math.sqrt(ux * ux + uy * uy + 1);
                const nxv = -ux * invLen;
                const nyv = -uy * invLen;
                const nzv = invLen;

                // Diffuse & specular lighting
                const diff = Math.max(0, nxv * lx + nyv * ly + nzv * lz);
                const specDot = Math.max(0, nxv * hx + nyv * hy + nzv * hz);
                const spec = Math.pow(specDot, 22) * 0.85;

                // Height-based water color: deep navy troughs (-1) -> ocean blue (0) -> sunlit aqua crests (+1)
                const hNorm = Math.max(-1, Math.min(1, uVal * 1.4));
                let r, g, b;
                if (hNorm >= 0) {
                    // Calm water [14, 92, 148] -> Bright crest [125, 222, 245]
                    r = 14 + hNorm * 111;
                    g = 92 + hNorm * 130;
                    b = 148 + hNorm * 97;
                } else {
                    // Calm water [14, 92, 148] -> Deep trough [6, 26, 66]
                    const t = -hNorm;
                    r = 14 - t * 8;
                    g = 92 - t * 66;
                    b = 148 - t * 82;
                }

                const shade = 0.42 + 0.72 * diff;
                const R = Math.min(255, Math.max(0, Math.round(r * shade + spec * 240)));
                const G = Math.min(255, Math.max(0, Math.round(g * shade + spec * 248)));
                const B = Math.min(255, Math.max(0, Math.round(b * shade + spec * 255)));

                const p = (j * nx + i) * 4;
                d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
            }
        }
        this._offCtx.putImageData(img, 0, 0);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x0, y0, size, size, 10);
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this._off, x0, y0, size, size);
        ctx.restore();

        ctx.strokeStyle = tk.border;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(x0, y0, size, size, 10);
        ctx.stroke();

        ctx.fillStyle = tk.muted;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('2D Water-Surface Wave Shading · Bright Lit Ridges = Crests, Deep Shadows = Troughs', w / 2, y0 + size + 18);
    }
}
