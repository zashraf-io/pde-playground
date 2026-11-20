/**
 * Curated PDE Graphs Gallery (Heat, Wave, Fourier & Finite Difference)
 * Each entry renders an interactive Plotly graph AND provides a standalone,
 * runnable Python (NumPy + Matplotlib) script downloadable as a .py file.
 */

const PLOTLY_INTERACTIVE_CONFIG = {
    responsive: true,
    displayModeBar: 'hover',
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'zoomIn2d', 'zoomOut2d', 'hoverClosestCartesian', 'hoverCompareCartesian']
};

function plotlyBaseLayout(isDark, extra = {}) {
    return Object.assign({
        uirevision: 'keep',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            family: 'Inter, sans-serif',
            size: 11.5,
            color: isDark ? '#cbd5e1' : '#334155'
        },
        margin: { l: 48, r: 18, t: 22, b: 42 },
        xaxis: {
            gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
            zerolinecolor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.18)'
        },
        yaxis: {
            gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
            zerolinecolor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.18)'
        },
        legend: {
            orientation: 'h',
            y: 1.13,
            x: 0,
            font: { size: 10.5 }
        }
    }, extra);
}

const HEAT_CURVE_PALETTE = ['#dc2626', '#db2777', '#a21caf', '#6d28d9', '#3b0764'];

const GALLERY_GRAPHS = [
    /* ======================== HEAT (5) ======================== */
    {
        id: 'heat_harmonics',
        category: 'heat',
        title: '1D Heat: Fourier Harmonic Damping',
        reference: 'Separation of Variables · Multi-Mode Decay',
        caption: 'High-frequency modes decay exponentially faster (~e⁻ⁿ²βᵗ). Starting from u(x,0) = 3 sin(2x) − 6 sin(5x) with β = 7, the n = 5 mode vanishes almost immediately while n = 2 persists.',
        filename: 'heat_fourier_harmonic_damping.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const x = Array.from({ length: 161 }, (_, i) => (i / 160) * Math.PI);
            const times = [0, 0.005, 0.015, 0.04, 0.09];
            const traces = times.map((t, idx) => ({
                x,
                y: x.map(xi => 3 * Math.exp(-7 * 4 * t) * Math.sin(2 * xi) - 6 * Math.exp(-7 * 25 * t) * Math.sin(5 * xi)),
                type: 'scatter', mode: 'lines', name: `t = ${t}`,
                line: { width: 2.3, color: HEAT_CURVE_PALETTE[idx] }
            }));
            Plotly.newPlot(divId, traces, plotlyBaseLayout(isDark, {
                xaxis: { title: 'x (rad)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'u(x, t)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
1D Heat Equation: Fourier Harmonic Damping
PDE: u_t = 7 u_xx,  0 < x < pi,  u(0,t) = u(pi,t) = 0
IC:  u(x,0) = 3*sin(2x) - 6*sin(5x)
"""
import numpy as np
import matplotlib.pyplot as plt

beta = 7.0
x = np.linspace(0, np.pi, 300)
times = [0.0, 0.005, 0.015, 0.04, 0.09]
colors = ["#dc2626", "#db2777", "#a21caf", "#6d28d9", "#3b0764"]

plt.figure(figsize=(8, 4.8))
for t, col in zip(times, colors):
    u = 3 * np.exp(-beta * 4 * t) * np.sin(2 * x) - 6 * np.exp(-beta * 25 * t) * np.sin(5 * x)
    plt.plot(x, u, color=col, linewidth=2.2, label=f"t = {t:.3f}")

plt.axhline(0, color="gray", linestyle="--", linewidth=0.8)
plt.title(r"1D Heat Harmonic Damping: $u(x,0) = 3\\sin(2x) - 6\\sin(5x)$")
plt.xlabel(r"$x$")
plt.ylabel(r"$u(x, t)$")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'heat_surface_100',
        category: 'heat',
        title: '1D Heat: Constant IC u(x,0) = 100 Decay Surface',
        reference: 'Fixed Zero Ends · 3D Evolution',
        caption: 'Classic 3D temperature surface for a uniformly heated rod (u = 100) with ends held at 0. Sharp boundary discontinuities immediately round into the fundamental sine bell.',
        filename: 'heat_constant_ic_3d_surface.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const nx = 38, nt = 34;
            const x = Array.from({ length: nx }, (_, i) => i / (nx - 1));
            const t = Array.from({ length: nt }, (_, j) => (j / (nt - 1)) * 0.35);
            const z = t.map(tj => x.map(xi => {
                if (tj === 0) return (xi === 0 || xi === 1) ? 0 : 100;
                let s = 0;
                for (let k = 0; k < 25; k++) {
                    const n = 2 * k + 1;
                    s += (400 / (n * Math.PI)) * Math.exp(-Math.pow(n * Math.PI, 2) * tj) * Math.sin(n * Math.PI * xi);
                }
                return s;
            }));
            Plotly.newPlot(divId, [{
                type: 'surface', x, y: t, z,
                colorscale: HEAT_PLOTLY_COLORSCALE, showscale: false
            }], {
                uirevision: 'keep',
                paper_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 0, r: 0, t: 8, b: 8 },
                font: { family: 'Inter, sans-serif', size: 10.5, color: isDark ? '#cbd5e1' : '#334155' },
                scene: {
                    xaxis: { title: 'x/L' }, yaxis: { title: 'βt/L²' }, zaxis: { title: 'u(x,t)' },
                    camera: { eye: { x: 1.55, y: -1.45, z: 0.95 } }
                }
            }, PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
1D Heat Equation 3D Temperature Surface (Violet-to-Red Colormap)
PDE: u_t = beta * u_xx,  0 < x < L,  u(0,t) = u(L,t) = 0,  u(x,0) = 100
"""
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

violet_red = LinearSegmentedColormap.from_list("violet_red", ["#2e1065", "#5b21b6", "#9333ea", "#db2777", "#dc2626"])
L, beta = 1.0, 1.0
x = np.linspace(0, L, 80)
t = np.linspace(0.002, 0.35, 60)
X, T = np.meshgrid(x, t)

U = np.zeros_like(X)
for k in range(30):
    n = 2 * k + 1
    U += (400.0 / (n * np.pi)) * np.exp(-beta * (n * np.pi / L) ** 2 * T) * np.sin(n * np.pi * X / L)

fig = plt.figure(figsize=(8.5, 5.5))
ax = fig.add_subplot(111, projection="3d")
surf = ax.plot_surface(X, T, U, cmap=violet_red, edgecolor="none", alpha=0.95)
ax.set_title(r"1D Heat Surface: $u(x,0) = 100$, Fixed Zero Ends")
ax.set_xlabel(r"$x / L$")
ax.set_ylabel(r"Time $t$")
ax.set_zlabel(r"Temperature $u(x,t)$")
fig.colorbar(surf, shrink=0.6, aspect=14, label="Temperature")
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'heat_triangle_ic',
        category: 'heat',
        title: '1D Heat: Triangular Peak Smoothing',
        reference: 'Fixed Zero Ends · Sharp Corner Decay',
        caption: 'A triangular tent initial temperature on [0, π] with β = 2 instantly rounds its sharp apex as odd harmonics decay at rates 2, 18, 50, ...',
        filename: 'heat_triangular_peak_smoothing.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const x = Array.from({ length: 161 }, (_, i) => (i / 160) * Math.PI);
            const times = [0.0, 0.03, 0.1, 0.25, 0.5];
            const traces = times.map((t, idx) => ({
                x,
                y: x.map(xi => {
                    let s = 0;
                    for (let k = 0; k < 25; k++) {
                        const n = 2 * k + 1;
                        const sign = k % 2 === 0 ? 1 : -1;
                        s += (4 / (Math.PI * n * n)) * sign * Math.exp(-2 * n * n * t) * Math.sin(n * xi);
                    }
                    return s;
                }),
                type: 'scatter', mode: 'lines', name: `t = ${t}`,
                line: { width: 2.3, color: HEAT_CURVE_PALETTE[idx] }
            }));
            Plotly.newPlot(divId, traces, plotlyBaseLayout(isDark, {
                xaxis: { title: 'x (0 to π)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'u(x, t)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
1D Heat Equation: Triangular Peak Smoothing
PDE: u_t = 2 u_xx,  0 < x < pi,  u(0,t) = u(pi,t) = 0
IC:  u(x,0) = x (0 <= x <= pi/2),  pi - x (pi/2 <= x <= pi)
"""
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, np.pi, 320)
times = [0.0, 0.03, 0.10, 0.25, 0.50]
colors = ["#dc2626", "#db2777", "#a21caf", "#6d28d9", "#3b0764"]

plt.figure(figsize=(8, 4.8))
for t, col in zip(times, colors):
    u = np.zeros_like(x)
    for k in range(30):
        n = 2 * k + 1
        u += (4.0 / (np.pi * n ** 2)) * ((-1) ** k) * np.exp(-2.0 * n ** 2 * t) * np.sin(n * x)
    plt.plot(x, u, color=col, linewidth=2.2, label=f"t = {t:.2f}")

plt.title(r"1D Heat Smoothing of a Triangular Peak ($\beta = 2$)")
plt.xlabel(r"$x$")
plt.ylabel(r"$u(x, t)$")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'heat_neumann_step',
        category: 'heat',
        title: '1D Heat: Insulated Rod (Neumann BC) Step Equalization',
        reference: 'Zero-Flux Boundaries · Energy Conservation',
        caption: 'With insulated ends (uₓ = 0), zero heat escapes. A step jump (0 on left half, 1 on right half) smooths via cosine modes and settles to the conserved mean u = 0.5.',
        filename: 'heat_insulated_neumann_step.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const x = Array.from({ length: 161 }, (_, i) => i / 160);
            const times = [0.0005, 0.005, 0.02, 0.06, 0.20];
            const traces = times.map((t, idx) => ({
                x,
                y: x.map(xi => {
                    let s = 0.5;
                    for (let n = 1; n <= 45; n += 2) {
                        const an = -(2 / (n * Math.PI)) * Math.sin(n * Math.PI / 2);
                        s += an * Math.exp(-Math.pow(n * Math.PI, 2) * t) * Math.cos(n * Math.PI * xi);
                    }
                    return s;
                }),
                type: 'scatter', mode: 'lines', name: `t = ${t}`,
                line: { width: 2.3, color: HEAT_CURVE_PALETTE[idx] }
            }));
            Plotly.newPlot(divId, traces, plotlyBaseLayout(isDark, {
                xaxis: { title: 'x / L', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'u(x, t)', range: [-0.08, 1.08], gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
1D Heat Equation with Insulated (Neumann) Boundaries
PDE: u_t = u_xx,  u_x(0,t) = u_x(1,t) = 0,  u(x,0) = 0 (x<0.5), 1 (x>0.5)
"""
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 1, 300)
times = [0.0005, 0.005, 0.02, 0.06, 0.20]
colors = ["#dc2626", "#db2777", "#a21caf", "#6d28d9", "#3b0764"]

plt.figure(figsize=(8, 4.8))
for t, col in zip(times, colors):
    u = np.full_like(x, 0.5)
    for n in range(1, 60, 2):
        an = -(2.0 / (n * np.pi)) * np.sin(n * np.pi / 2.0)
        u += an * np.exp(-((n * np.pi) ** 2) * t) * np.cos(n * np.pi * x)
    plt.plot(x, u, color=col, linewidth=2.2, label=f"t = {t}")

plt.axhline(0.5, color="gray", linestyle="--", linewidth=1, label="Equilibrium u = 0.5")
plt.title("Insulated Rod (Neumann BC): Conservation of Thermal Energy")
plt.xlabel(r"$x / L$")
plt.ylabel(r"$u(x, t)$")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'heat_nonhomog_bc',
        category: 'heat',
        title: '1D Heat: Time-Dependent Boundary u(0,t) = cos(t)',
        reference: 'Non-Homogeneous BVP · Eigenfunction Lifting',
        caption: 'Oscillating left boundary temperature u(0,t) = cos(t) with u(1,t) = 0 solved via linear boundary lifting φ(x,t) = (1−x)cos(t) plus eigenfunction expansion.',
        filename: 'heat_nonhomogeneous_oscillating_bc.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const x = Array.from({ length: 121 }, (_, i) => i / 120);
            const times = [0.0, 0.8, 1.6, 2.4, 3.14];
            const traces = times.map((t, idx) => ({
                x,
                y: x.map(xi => {
                    const phi = (1 - xi) * Math.cos(t);
                    let v = 0;
                    for (let n = 1; n <= 25; n++) {
                        const a = Math.pow(n * Math.PI, 2);
                        const Gn_coeff = 2 / (n * Math.PI);
                        const particular = Gn_coeff * (a * Math.sin(t) - Math.cos(t)) / (a * a + 1);
                        const v0 = -2 / (n * Math.PI);
                        const p0 = Gn_coeff * (-1) / (a * a + 1);
                        const vn = particular + (v0 - p0) * Math.exp(-a * t);
                        v += vn * Math.sin(n * Math.PI * xi);
                    }
                    return phi + v;
                }),
                type: 'scatter', mode: 'lines', name: `t = ${t.toFixed(2)}`,
                line: { width: 2.3, color: HEAT_CURVE_PALETTE[idx] }
            }));
            Plotly.newPlot(divId, traces, plotlyBaseLayout(isDark, {
                xaxis: { title: 'x / L', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'u(x, t)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
Non-Homogeneous 1D Heat Equation with Time-Dependent Boundary
PDE: u_t = u_xx,  0 < x < 1,  u(0,t) = cos(t),  u(1,t) = 0,  u(x,0) = 0
Method: Boundary lifting phi(x,t) = (1 - x)*cos(t) + eigenfunction expansion
"""
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 1, 250)
times = [0.0, 0.8, 1.6, 2.4, np.pi]
colors = ["#dc2626", "#db2777", "#a21caf", "#6d28d9", "#3b0764"]

plt.figure(figsize=(8, 4.8))
for t, col in zip(times, colors):
    phi = (1.0 - x) * np.cos(t)
    v = np.zeros_like(x)
    for n in range(1, 35):
        a = (n * np.pi) ** 2
        g_c = 2.0 / (n * np.pi)
        part = g_c * (a * np.sin(t) - np.cos(t)) / (a ** 2 + 1.0)
        v0 = -2.0 / (n * np.pi)
        p0 = -g_c / (a ** 2 + 1.0)
        vn = part + (v0 - p0) * np.exp(-a * t)
        v += vn * np.sin(n * np.pi * x)
    plt.plot(x, phi + v, color=col, linewidth=2.2, label=f"t = {t:.2f}")

plt.axhline(0, color="gray", linestyle="--", linewidth=0.8)
plt.title(r"Non-Homogeneous Heat Response: $u(0,t) = \cos(t), \ u(1,t) = 0$")
plt.xlabel(r"$x$")
plt.ylabel(r"$u(x, t)$")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
`
    },

    /* ======================== WAVE (5) ======================== */
    {
        id: 'wave_normal_modes',
        category: 'wave',
        title: '1D Wave: Standing Normal Modes (n = 1, 2, 3, 4)',
        reference: 'Fixed String · Harmonics & Nodes',
        caption: 'Fundamental frequency and overtones of a vibrating string fixed at x = 0 and x = L. Each nth mode has (n − 1) interior stationary nodes and angular frequency ωₙ = nπc/L.',
        filename: 'wave_standing_normal_modes.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const x = Array.from({ length: 161 }, (_, i) => i / 160);
            const colors = ['#0284c7', '#4f46e5', '#0d9488', '#7c3aed'];
            const traces = [];
            [1, 2, 3, 4].forEach((n, idx) => {
                const offset = (4 - n) * 2.4;
                traces.push({
                    x, y: x.map(xi => offset + 0.85 * Math.sin(n * Math.PI * xi)),
                    mode: 'lines', name: `n = ${n}`, line: { color: colors[idx], width: 2.3 }
                });
                traces.push({
                    x, y: x.map(xi => offset - 0.85 * Math.sin(n * Math.PI * xi)),
                    mode: 'lines', showlegend: false, line: { color: colors[idx], width: 1.2, dash: 'dot' }
                });
            });
            Plotly.newPlot(divId, traces, plotlyBaseLayout(isDark, {
                xaxis: { title: 'x / L', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'Normal Modes (stacked)', showticklabels: false, gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
1D Wave Equation: First Four Standing Normal Modes
Mode shape: X_n(x) = sin(n * pi * x / L) with interior nodes at x = k*L/n
"""
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 1, 400)
fig, axes = plt.subplots(4, 1, figsize=(8, 6.4), sharex=True)

for n, ax in enumerate(axes, start=1):
    y = np.sin(n * np.pi * x)
    ax.plot(x, y, color="#0284c7", linewidth=2.2, label=rf"$n={n}, \ \omega_{n}={n}\pi c/L$")
    ax.plot(x, -y, color="#0284c7", linewidth=1.2, linestyle="--", alpha=0.55)
    ax.axhline(0, color="gray", linewidth=0.8)
    nodes = [k / n for k in range(1, n)]
    if nodes:
        ax.scatter(nodes, np.zeros(len(nodes)), color="#dc2626", zorder=5, s=36, label="Nodes")
    ax.set_ylim(-1.25, 1.25)
    ax.set_ylabel(f"n = {n}")
    ax.legend(loc="upper right", fontsize=9)
    ax.grid(alpha=0.25)

axes[0].set_title("1D Vibrating String: Standing Waves / Normal Modes")
axes[-1].set_xlabel(r"$x / L$")
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'wave_dalembert',
        category: 'wave',
        title: "1D Wave: D'Alembert Traveling Wave Splitting",
        reference: 'Traveling Waves · Boundary Reflection',
        caption: "D'Alembert's solution u(x,t) = ½[f(x−ct) + f(x+ct)] splits a stationary pulse into two half-amplitude waves moving at ±c that invert upon hitting fixed ends.",
        filename: 'wave_dalembert_traveling_split.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const x = Array.from({ length: 201 }, (_, i) => i / 200);
            const fExt = (s) => {
                let m = ((s % 2) + 2) % 2;
                const sign = m <= 1 ? 1 : -1;
                const xm = m <= 1 ? m : 2 - m;
                return sign * Math.exp(-160 * Math.pow(xm - 0.5, 2));
            };
            const times = [0.0, 0.2, 0.4, 0.65, 0.95];
            const colors = ['#0284c7', '#4338ca', '#7c3aed', '#059669', '#0f766e'];
            const traces = times.map((t, idx) => {
                const offset = (times.length - 1 - idx) * 1.45;
                return {
                    x, y: x.map(xi => offset + 0.5 * (fExt(xi - t) + fExt(xi + t))),
                    mode: 'lines', name: `ct/L = ${t.toFixed(2)}`, line: { color: colors[idx], width: 2.2 }
                };
            });
            Plotly.newPlot(divId, traces, plotlyBaseLayout(isDark, {
                xaxis: { title: 'x / L', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'Time snapshots (stacked)', showticklabels: false, gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
1D Wave Equation: D'Alembert Traveling Wave Splitting & Fixed-End Inversion
u(x, t) = 0.5 * [f_odd(x - c*t) + f_odd(x + c*t)]
"""
import numpy as np
import matplotlib.pyplot as plt

def f_odd(s):
    m = np.mod(s, 2.0)
    sign = np.where(m <= 1.0, 1.0, -1.0)
    xm = np.where(m <= 1.0, m, 2.0 - m)
    return sign * np.exp(-160.0 * (xm - 0.5) ** 2)

x = np.linspace(0, 1, 400)
times = [0.0, 0.20, 0.40, 0.65, 0.95]

fig, axes = plt.subplots(len(times), 1, figsize=(8, 7), sharex=True)
for ax, t in zip(axes, times):
    u_r = 0.5 * f_odd(x - t)
    u_l = 0.5 * f_odd(x + t)
    u = u_r + u_l
    ax.plot(x, u, color="#0284c7", linewidth=2.2, label="u(x,t)")
    ax.plot(x, u_r, "--", color="#7c3aed", linewidth=1.2, alpha=0.7, label="½ f(x−ct)")
    ax.plot(x, u_l, "--", color="#059669", linewidth=1.2, alpha=0.7, label="½ f(x+ct)")
    ax.axhline(0, color="gray", linewidth=0.7)
    ax.set_ylim(-1.15, 1.15)
    ax.set_ylabel(f"ct={t:.2f}")
    ax.grid(alpha=0.25)

axes[0].legend(loc="upper right", ncol=3, fontsize=8.5)
axes[0].set_title("D'Alembert Traveling Wave Decomposition & Fixed-End Inversion")
axes[-1].set_xlabel(r"$x / L$")
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'wave_superposition',
        category: 'wave',
        title: '1D Wave: Superposition Principle (u = u₁ + u₂)',
        reference: 'Linearity · Mode Combination',
        caption: 'Linearity allows decomposing complex string motion into simpler sub-problems: here fundamental mode u₁ = sin(πx) and 3rd harmonic u₂ = 0.45 sin(3πx) combine into u = u₁ + u₂.',
        filename: 'wave_superposition_principle.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const x = Array.from({ length: 161 }, (_, i) => i / 160);
            const u1 = x.map(xi => Math.sin(Math.PI * xi));
            const u2 = x.map(xi => 0.45 * Math.sin(3 * Math.PI * xi));
            const uSum = x.map((_, i) => u1[i] + u2[i]);
            Plotly.newPlot(divId, [
                { x, y: u1, name: 'u₁(x) = sin(πx)', mode: 'lines', line: { color: '#7c3aed', width: 1.8, dash: 'dash' } },
                { x, y: u2, name: 'u₂(x) = 0.45 sin(3πx)', mode: 'lines', line: { color: '#059669', width: 1.8, dash: 'dot' } },
                { x, y: uSum, name: 'Superposition u₁ + u₂', mode: 'lines', line: { color: '#0284c7', width: 2.8 } }
            ], plotlyBaseLayout(isDark, {
                xaxis: { title: 'x / L', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'Displacement u', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
1D Wave Equation: Superposition Principle (u = u1 + u2)
"""
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 1, 350)
u1 = np.sin(np.pi * x)
u2 = 0.45 * np.sin(3 * np.pi * x)
u_total = u1 + u2

plt.figure(figsize=(8, 4.8))
plt.plot(x, u1, "--", color="#7c3aed", linewidth=1.8, label=r"$u_1(x) = \sin(\pi x)$")
plt.plot(x, u2, ":", color="#059669", linewidth=1.8, label=r"$u_2(x) = 0.45\sin(3\pi x)$")
plt.plot(x, u_total, color="#0284c7", linewidth=2.6, label=r"$u(x) = u_1(x) + u_2(x)$")
plt.axhline(0, color="gray", linewidth=0.8)
plt.title("Wave Superposition Principle")
plt.xlabel(r"$x / L$")
plt.ylabel(r"Displacement $u$")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'wave_plucked_string',
        category: 'wave',
        title: '1D Wave: Plucked Triangular String Evolution',
        reference: 'Fourier Sine Series · Trapezoidal States',
        caption: 'String plucked at x = π/2 with zero initial velocity. As corners propagate outward at speed c, the triangular peak flattens into a trapezoid before inverting.',
        filename: 'wave_plucked_string_evolution.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const x = Array.from({ length: 161 }, (_, i) => (i / 160) * Math.PI);
            const phases = [
                { label: 'ct = 0', val: 0 },
                { label: 'ct = π/4', val: Math.PI / 4 },
                { label: 'ct = π/2', val: Math.PI / 2 },
                { label: 'ct = 3π/4', val: 3 * Math.PI / 4 },
                { label: 'ct = π', val: Math.PI }
            ];
            const colors = ['#0284c7', '#4338ca', '#64748b', '#0d9488', '#7c3aed'];
            const traces = phases.map((p, idx) => ({
                x,
                y: x.map(xi => {
                    let s = 0;
                    for (let k = 0; k < 25; k++) {
                        const n = 2 * k + 1;
                        const sign = k % 2 === 0 ? 1 : -1;
                        s += (4 / (Math.PI * n * n)) * sign * Math.sin(n * xi) * Math.cos(n * p.val);
                    }
                    return s;
                }),
                mode: 'lines', name: p.label, line: { width: 2.2, color: colors[idx] }
            }));
            Plotly.newPlot(divId, traces, plotlyBaseLayout(isDark, {
                xaxis: { title: 'x (0 to π)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'u(x, t)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
1D Wave Equation: Plucked Triangular String Evolution
u(x,t) = (4/pi) * sum_{k=0}^inf [(-1)^k / (2k+1)^2] * sin((2k+1)x) * cos((2k+1)c*t)
"""
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, np.pi, 350)
phases = [("ct = 0", 0), (r"ct = $\pi$/4", np.pi/4), (r"ct = $\pi$/2", np.pi/2),
          (r"ct = 3$\pi$/4", 3*np.pi/4), (r"ct = $\pi$", np.pi)]

plt.figure(figsize=(8, 4.8))
for label, ct in phases:
    u = np.zeros_like(x)
    for k in range(30):
        n = 2 * k + 1
        u += (4.0 / (np.pi * n ** 2)) * ((-1) ** k) * np.sin(n * x) * np.cos(n * ct)
    plt.plot(x, u, linewidth=2.2, label=label)

plt.axhline(0, color="gray", linestyle="--", linewidth=0.8)
plt.title("Plucked Triangular String: Half-Period Snapshots")
plt.xlabel(r"$x$")
plt.ylabel(r"$u(x, t)$")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'wave_2d_membrane',
        category: 'wave',
        title: '2D Wave: Rectangular Membrane Mode (m = 2, n = 3)',
        reference: '2D Vibrating Membrane · Nodal Grid',
        caption: 'Eigenfunction u₂,₃(x,y) = sin(2πx) sin(3πy) of a square drumhead with fixed edges, showing alternating crests and troughs separated by orthogonal nodal lines.',
        filename: 'wave_2d_membrane_mode_2_3.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const N = 38;
            const x = Array.from({ length: N }, (_, i) => i / (N - 1));
            const y = x.slice();
            const z = y.map(yi => x.map(xi => Math.sin(2 * Math.PI * xi) * Math.sin(3 * Math.PI * yi)));
            Plotly.newPlot(divId, [{
                type: 'surface', x, y, z,
                colorscale: 'Blues', reversescale: false, showscale: false
            }], {
                uirevision: 'keep',
                paper_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 0, r: 0, t: 8, b: 8 },
                font: { family: 'Inter, sans-serif', size: 10.5, color: isDark ? '#cbd5e1' : '#334155' },
                scene: {
                    xaxis: { title: 'x' }, yaxis: { title: 'y' },
                    zaxis: { title: 'u(x,y)', range: [-1.1, 1.1] },
                    camera: { eye: { x: 1.45, y: 1.45, z: 1.05 } }
                }
            }, PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
2D Wave Equation: Rectangular Membrane Normal Mode (m=2, n=3)
u_{m,n}(x, y) = sin(m * pi * x) * sin(n * pi * y)
"""
import numpy as np
import matplotlib.pyplot as plt

m, n = 2, 3
x = np.linspace(0, 1, 100)
y = np.linspace(0, 1, 100)
X, Y = np.meshgrid(x, y)
U = np.sin(m * np.pi * X) * np.sin(n * np.pi * Y)

fig = plt.figure(figsize=(8.5, 5.5))
ax = fig.add_subplot(111, projection="3d")
surf = ax.plot_surface(X, Y, U, cmap="ocean", edgecolor="none", alpha=0.95)
ax.set_title(rf"2D Rectangular Membrane Mode $(m={m}, n={n})$")
ax.set_xlabel(r"$x$")
ax.set_ylabel(r"$y$")
ax.set_zlabel(r"$u(x, y)$")
fig.colorbar(surf, shrink=0.6, aspect=14, label="Displacement")
plt.tight_layout()
plt.show()
`
    },

    /* ======================== FOURIER & NUMERICAL (3) ======================== */
    {
        id: 'fourier_gibbs',
        category: 'fourier_fd',
        title: 'Fourier Series: Square Wave & Gibbs Phenomenon',
        reference: 'Fourier Analysis · Partial Sums',
        caption: 'Partial sums S_N(x) of a square wave converge pointwise away from jumps but retain a persistent ~9% overshoot (Gibbs phenomenon) right next to the discontinuity.',
        filename: 'fourier_gibbs_phenomenon.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const x = Array.from({ length: 241 }, (_, i) => -Math.PI + (i / 240) * 2 * Math.PI);
            const exact = x.map(xi => xi < 0 ? -1 : (xi > 0 ? 1 : 0));
            const partialSum = (N) => x.map(xi => {
                let s = 0;
                for (let k = 0; k < N; k++) {
                    const n = 2 * k + 1;
                    s += (4 / (n * Math.PI)) * Math.sin(n * xi);
                }
                return s;
            });
            Plotly.newPlot(divId, [
                { x, y: exact, name: 'Square Wave', mode: 'lines', line: { color: isDark ? '#94a3b8' : '#64748b', width: 1.5, dash: 'dash' } },
                { x, y: partialSum(2), name: 'N = 3 terms', mode: 'lines', line: { color: '#7c3aed', width: 1.9 } },
                { x, y: partialSum(6), name: 'N = 11 terms', mode: 'lines', line: { color: '#0284c7', width: 2.0 } },
                { x, y: partialSum(18), name: 'N = 35 terms (Gibbs)', mode: 'lines', line: { color: '#dc2626', width: 2.1 } }
            ], plotlyBaseLayout(isDark, {
                xaxis: { title: 'x (−π to π)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'S_N(x)', range: [-1.35, 1.35], gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
Fourier Series Partial Sums & Gibbs Phenomenon (Square Wave)
f(x) = -1 (-pi < x < 0), +1 (0 < x < pi)
"""
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(-np.pi, np.pi, 600)
square = np.where(x < 0, -1.0, 1.0)

plt.figure(figsize=(8.2, 4.8))
plt.plot(x, square, "k--", linewidth=1.2, alpha=0.6, label="Target Square Wave")
for terms, col in [(2, "#7c3aed"), (6, "#0284c7"), (20, "#dc2626")]:
    s = np.zeros_like(x)
    for k in range(terms):
        n = 2 * k + 1
        s += (4.0 / (n * np.pi)) * np.sin(n * x)
    plt.plot(x, s, color=col, linewidth=2, label=f"Highest harmonic n = {2*terms - 1}")

plt.title("Fourier Series Convergence & Gibbs Overshoot (~9%)")
plt.xlabel(r"$x$")
plt.ylabel(r"$S_N(x)$")
plt.ylim(-1.35, 1.35)
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'fd_rod_intervals',
        category: 'fourier_fd',
        title: 'Finite Difference Heat: 10 cm Rod at 3-Second Intervals',
        reference: 'Explicit FD · Heated Ends Benchmark',
        caption: 'Classic 10 cm thin rod (β = 0.835 cm²/s, Δx = 2 cm, Δt = 0.1 s, λ = 0.0209) initially at 0°C with ends held at 100°C and 50°C, plotted at 3 s intervals.',
        filename: 'fd_heat_rod_3s_intervals.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const nx = 5, dx = 2.0, dt = 0.1, beta = 0.835, lam = beta * dt / (dx * dx);
            const x = [0, 2, 4, 6, 8, 10];
            let T = [100, 0, 0, 0, 0, 50];
            const snaps = {};
            for (let step = 1; step <= 120; step++) {
                const nT = T.slice();
                for (let i = 1; i < nx; i++) nT[i] = T[i] + lam * (T[i + 1] - 2 * T[i] + T[i - 1]);
                T = nT;
                if ([30, 60, 90, 120].includes(step)) snaps[step / 10] = T.slice();
            }
            const times = [3, 6, 9, 12];
            const traces = times.map((t, idx) => ({
                x, y: snaps[t], name: `t = ${t} s`, mode: 'lines+markers',
                line: { width: 2.3, color: HEAT_CURVE_PALETTE[3 - idx] }, marker: { size: 6 }
            }));
            Plotly.newPlot(divId, traces, plotlyBaseLayout(isDark, {
                xaxis: { title: 'Position x (cm)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'Temperature (°C)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
Finite Difference 1D Heat Rod Benchmark at 3-Second Intervals
L = 10 cm, dx = 2 cm, dt = 0.1 s, beta = 0.835 cm^2/s, T(0)=100 C, T(10)=50 C
"""
import numpy as np
import matplotlib.pyplot as plt

L, dx, dt, beta = 10.0, 2.0, 0.1, 0.835
lam = beta * dt / dx ** 2
x = np.arange(0, L + dx, dx)
T = np.array([100.0, 0.0, 0.0, 0.0, 0.0, 50.0])

snapshots = {}
for step in range(1, 121):
    T_new = T.copy()
    T_new[1:-1] = T[1:-1] + lam * (T[2:] - 2 * T[1:-1] + T[:-2])
    T = T_new
    if step in (30, 60, 90, 120):
        snapshots[step * dt] = T.copy()

colors = ["#6d28d9", "#a21caf", "#db2777", "#dc2626"]
plt.figure(figsize=(8, 4.8))
for (t_val, prof), col in zip(snapshots.items(), colors):
    plt.plot(x, prof, "-o", color=col, linewidth=2.2, label=f"t = {t_val:.0f} s")

plt.title(rf"Explicit FD Rod Heating ($\lambda = {lam:.5f}$)")
plt.xlabel("Position x (cm)")
plt.ylabel("Temperature (°C)")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
`
    },
    {
        id: 'heat_numerical_stability',
        category: 'fourier_fd',
        title: 'Numerical Stability: FTCS Blowup (λ = 0.735) vs Crank–Nicolson',
        reference: 'Finite Difference · Stability Limit',
        caption: 'When λ = βΔt/Δx² exceeds 0.5, Explicit FTCS exhibits alternating sawtooth divergence, whereas Crank–Nicolson remains unconditionally smooth and accurate.',
        filename: 'heat_ftcs_instability_vs_cn.py',
        render(divId, isDark) {
            if (typeof Plotly === 'undefined') return;
            const nx = 10, L = 1.0, dx = L / nx, lam = 0.735;
            const x = Array.from({ length: nx + 1 }, (_, i) => i * dx);
            let uF = x.map(xi => Math.sin(Math.PI * xi));
            let uC = uF.slice();
            const m = nx - 1;
            const a = new Float64Array(m).fill(-lam); a[0] = 0;
            const b = new Float64Array(m).fill(2 * (1 + lam));
            const c = new Float64Array(m).fill(-lam); c[m - 1] = 0;

            for (let step = 0; step < 5; step++) {
                const nf = uF.slice();
                for (let i = 1; i < nx; i++) nf[i] = lam * uF[i - 1] + (1 - 2 * lam) * uF[i] + lam * uF[i + 1];
                uF = nf;
                const rhs = new Float64Array(m);
                for (let i = 0; i < m; i++) rhs[i] = lam * uC[i] + 2 * (1 - lam) * uC[i + 1] + lam * uC[i + 2];
                const sol = solveTridiagonal(a, b, c, rhs);
                for (let i = 0; i < m; i++) uC[i + 1] = sol[i];
            }
            const t5 = 5 * lam * dx * dx;
            const uEx = x.map(xi => Math.exp(-Math.PI * Math.PI * t5) * Math.sin(Math.PI * xi));

            Plotly.newPlot(divId, [
                { x, y: uEx, name: 'Exact Analytical', mode: 'lines', line: { color: isDark ? '#f1f5f9' : '#0f172a', width: 2.5 } },
                { x, y: uC, name: 'Crank–Nicolson (Stable)', mode: 'lines+markers', line: { color: '#059669', width: 2 }, marker: { size: 6 } },
                { x, y: uF, name: 'Explicit FTCS (Unstable!)', mode: 'lines+markers', line: { color: '#dc2626', width: 2, dash: 'dot' }, marker: { size: 6, symbol: 'x' } }
            ], plotlyBaseLayout(isDark, {
                xaxis: { title: 'x (step l = 5, λ = 0.735)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'u(x, t)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        },
        pythonCode: `"""
Numerical Heat Equation: Explicit FTCS Instability (lambda = 0.735) vs Crank-Nicolson
"""
import numpy as np
import matplotlib.pyplot as plt

nx = 10
L = 1.0
dx = L / nx
lam = 0.735
dt = lam * dx ** 2
steps = 5

x = np.linspace(0, L, nx + 1)
u_ftcs = np.sin(np.pi * x)
u_cn = u_ftcs.copy()

m = nx - 1
A = np.diag(np.full(m, 2 * (1 + lam))) + np.diag(np.full(m - 1, -lam), 1) + np.diag(np.full(m - 1, -lam), -1)

for _ in range(steps):
    u_new = u_ftcs.copy()
    u_new[1:-1] = lam * u_ftcs[:-2] + (1 - 2 * lam) * u_ftcs[1:-1] + lam * u_ftcs[2:]
    u_ftcs = u_new

    rhs = lam * u_cn[:-2] + 2 * (1 - lam) * u_cn[1:-1] + lam * u_cn[2:]
    u_cn[1:-1] = np.linalg.solve(A, rhs)

t_final = steps * dt
u_exact = np.exp(-np.pi ** 2 * t_final) * np.sin(np.pi * x)

plt.figure(figsize=(8, 4.8))
plt.plot(x, u_exact, "k-", linewidth=2.5, label="Exact Analytical")
plt.plot(x, u_cn, "g-o", linewidth=2, label=f"Crank-Nicolson (λ={lam})")
plt.plot(x, u_ftcs, "r--x", linewidth=2, label=f"Explicit FTCS Unstable (λ={lam})")
plt.title(f"FTCS Instability vs Crank-Nicolson at Step l = {steps} (λ = {lam} > 0.5)")
plt.xlabel(r"$x$")
plt.ylabel(r"$u(x, t)$")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
`
    }
];
