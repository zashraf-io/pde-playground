/**
 * PDE Playground — Main Application Controller
 */

(function () {
    'use strict';

    /* ======================================================================
       STATE
       ====================================================================== */
    let currentView = 'home';
    let heatSubTab = 'interactive';
    let isDark = false;

    // Interactive Heat
    let heatSolver = null;
    let heatRenderer = null;
    let heatPlaying = false;
    let heatSpeed = 3;
    let heatRaf = null;
    let heatLastPlotTs = 0;
    let heatHistoryT = [];
    let heatHistoryU = [];

    // Animated Numerical Heat Simulation
    let numLab = null;
    let numRenderer = null;
    let numTimer = null;
    let numPlaying = false;
    let numIntervalMs = 350;

    // Wave Simulator
    let waveSolver = null;
    let waveRenderer = null;
    let wavePlaying = false;
    let waveSpeed = 2;
    let waveRaf = null;
    let waveLastPlotTs = 0;
    let waveHistoryT = [];
    let waveHistoryU = [];

    // Graphs Gallery
    let graphsRendered = false;
    let activeModalGraph = null;

    // Per-plot user zoom tracking & reset revisions
    const plotZoomed = {
        'heat-plot-1': false,
        'heat-plot-2': false,
        'wave-plot-1': false,
        'wave-plot-2': false
    };
    const plotBound = {};
    let heatUiRev = 1;
    let waveUiRev = 1;
    let plotDataRev = 1;

    function bindPlotZoomListener(id) {
        if (plotBound[id]) return;
        const el = document.getElementById(id);
        if (!el || typeof el.on !== 'function') return;
        plotBound[id] = true;
        el.on('plotly_relayout', (ev) => {
            if (!ev) return;
            if (ev['xaxis.autorange'] === true || ev['yaxis.autorange'] === true) {
                plotZoomed[id] = false;
            } else if (ev['xaxis.range[0]'] !== undefined || ev['yaxis.range[0]'] !== undefined) {
                plotZoomed[id] = true;
            }
        });
    }

    /* ======================================================================
       UTILITIES
       ====================================================================== */
    function showToast(msg) {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 2400);
    }

    function renderKaTeX() {
        if (typeof katex === 'undefined') return;
        document.querySelectorAll('.katex-inline').forEach(el => {
            const tex = el.getAttribute('data-tex');
            if (tex) {
                try {
                    katex.render(tex, el, { throwOnError: false, displayMode: false });
                } catch (_) {}
            }
        });
    }

    function refreshIcons() {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    function downloadTextFile(filename, content) {
        const blob = new Blob([content], { type: 'text/x-python;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`Downloaded ${filename}`);
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => showToast('Python code copied to clipboard')).catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showToast('Python code copied to clipboard'); } catch (_) {}
        document.body.removeChild(ta);
    }

    function downsample1D(arr, maxPts = 64) {
        if (arr.length <= maxPts) return arr;
        const step = (arr.length - 1) / (maxPts - 1);
        const out = new Array(maxPts);
        for (let i = 0; i < maxPts; i++) out[i] = arr[Math.round(i * step)];
        return out;
    }

    function downsample2D(grid, maxPts = 31) {
        const ny = grid.length;
        const nx = grid[0].length;
        if (ny <= maxPts && nx <= maxPts) return grid;
        const stepY = (ny - 1) / (maxPts - 1);
        const stepX = (nx - 1) / (maxPts - 1);
        const out = new Array(maxPts);
        for (let j = 0; j < maxPts; j++) {
            const srcRow = grid[Math.round(j * stepY)];
            const row = new Array(maxPts);
            for (let i = 0; i < maxPts; i++) row[i] = srcRow[Math.round(i * stepX)];
            out[j] = row;
        }
        return out;
    }

    function safePlotlyResize(ids) {
        if (typeof Plotly === 'undefined') return;
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.data) {
                try { Plotly.Plots.resize(el); } catch (_) {}
            }
        });
    }

    /* ======================================================================
       NAVIGATION & THEME
       ====================================================================== */
    function setView(viewName) {
        if (currentView === 'heat' && viewName !== 'heat') {
            stopHeatLoop();
            stopNumAuto();
        }
        if (currentView === 'wave' && viewName !== 'wave') {
            stopWaveLoop();
        }

        currentView = viewName;
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`view-${viewName}`);
        if (target) target.classList.add('active');

        document.querySelectorAll('.nav-pill').forEach(p => {
            p.classList.toggle('active', p.dataset.nav === viewName);
        });

        window.scrollTo({ top: 0, behavior: 'instant' });

        requestAnimationFrame(() => {
            if (viewName === 'heat') {
                if (heatSubTab === 'interactive') {
                    if (heatSolver && heatRenderer) {
                        heatRenderer.render(heatSolver);
                        updateHeatPlots(true);
                        safePlotlyResize(['heat-plot-1', 'heat-plot-2']);
                    }
                } else {
                    renderNumericalLab();
                    safePlotlyResize(['num-plot-compare', 'num-plot-error']);
                }
            } else if (viewName === 'wave') {
                if (waveSolver && waveRenderer) {
                    waveRenderer.render(waveSolver);
                    updateWavePlots(true);
                    safePlotlyResize(['wave-plot-1', 'wave-plot-2']);
                }
            } else if (viewName === 'graphs') {
                if (!graphsRendered) {
                    buildGraphsGallery();
                    graphsRendered = true;
                } else {
                    rerenderVisibleGraphs();
                }
            }
        });
    }

    function toggleTheme() {
        isDark = !isDark;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        try { localStorage.setItem('pde_studio_theme', isDark ? 'dark' : 'light'); } catch (_) {}
        document.getElementById('theme-label').textContent = isDark ? 'Light' : 'Dark';
        document.getElementById('theme-icon').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        refreshIcons();

        if (heatSolver && heatRenderer && currentView === 'heat' && heatSubTab === 'interactive') {
            heatRenderer.render(heatSolver);
            updateHeatPlots(true);
        }
        if (currentView === 'heat' && heatSubTab === 'numerical') {
            renderNumericalLab();
        }
        if (waveSolver && waveRenderer && currentView === 'wave') {
            waveRenderer.render(waveSolver);
            updateWavePlots(true);
        }
        if (graphsRendered && currentView === 'graphs') {
            rerenderVisibleGraphs();
        }
    }

    /* ======================================================================
       HEAT STUDIO — INTERACTIVE PHYSICS
       ====================================================================== */
    const HEAT_PRESETS = {
        dirichlet_zero: { dim: '1d', beta: 0.01, bcType: 'dirichlet', icType: 'sine', forcing: 'none', bcParams: { left: 0, right: 0 } },
        neumann_insulated: { dim: '1d', beta: 0.015, bcType: 'neumann', icType: 'step', forcing: 'none', bcParams: { left: 0, right: 0 } },
        robin_cooling: { dim: '1d', beta: 0.02, bcType: 'robin', icType: 'gaussian', forcing: 'none', bcParams: { h: 5.0, uAmbient: 0.0 } },
        lecture_harmonics: { dim: '1d', beta: 0.02, bcType: 'dirichlet', icType: 'harmonics', forcing: 'none', bcParams: { left: 0, right: 0 } },
        heat_source: { dim: '1d', beta: 0.01, bcType: 'dirichlet', icType: 'sine', forcing: 'center', bcParams: { left: 0, right: 0 } },
        plate_2d: { dim: '2d', beta: 0.01, bcType: 'dirichlet', icType: 'gaussian', forcing: 'none', bcParams: { left: 0, right: 0, top: 0, bottom: 0 } }
    };

    function getHeatDim() {
        const active = document.querySelector('#heat-dim-toggle .toggle-btn.active');
        return active ? active.dataset.value : '1d';
    }

    function buildHeatBCInputs(defaults = {}) {
        const bcType = document.getElementById('heat-bc-select').value;
        const dim = getHeatDim();
        const box = document.getElementById('heat-bc-params');
        if (bcType === 'robin') {
            box.innerHTML = `
                <div class="bc-mini-field"><label for="h-bc-h">Convection h</label><input class="num-input" id="h-bc-h" type="number" step="0.5" value="${defaults.h ?? 5}"></div>
                <div class="bc-mini-field"><label for="h-bc-uamb">Ambient T∞</label><input class="num-input" id="h-bc-uamb" type="number" step="0.1" value="${defaults.uAmbient ?? 0}"></div>`;
        } else {
            const lbl = bcType === 'dirichlet' ? 'T' : 'Flux';
            let html = `
                <div class="bc-mini-field"><label for="h-bc-left">Left ${lbl}</label><input class="num-input" id="h-bc-left" type="number" step="0.2" value="${defaults.left ?? 0}"></div>
                <div class="bc-mini-field"><label for="h-bc-right">Right ${lbl}</label><input class="num-input" id="h-bc-right" type="number" step="0.2" value="${defaults.right ?? 0}"></div>`;
            if (dim === '2d') {
                html += `
                <div class="bc-mini-field"><label for="h-bc-top">Top ${lbl}</label><input class="num-input" id="h-bc-top" type="number" step="0.2" value="${defaults.top ?? 0}"></div>
                <div class="bc-mini-field"><label for="h-bc-bottom">Bottom ${lbl}</label><input class="num-input" id="h-bc-bottom" type="number" step="0.2" value="${defaults.bottom ?? 0}"></div>`;
            }
            box.innerHTML = html;
        }
        box.querySelectorAll('input').forEach(inp => inp.addEventListener('change', resetHeatSim));
    }

    function readHeatBCParams() {
        const bcType = document.getElementById('heat-bc-select').value;
        if (bcType === 'robin') {
            return {
                h: parseFloat(document.getElementById('h-bc-h')?.value ?? 5) || 0,
                uAmbient: parseFloat(document.getElementById('h-bc-uamb')?.value ?? 0) || 0
            };
        }
        return {
            left: parseFloat(document.getElementById('h-bc-left')?.value ?? 0) || 0,
            right: parseFloat(document.getElementById('h-bc-right')?.value ?? 0) || 0,
            top: parseFloat(document.getElementById('h-bc-top')?.value ?? 0) || 0,
            bottom: parseFloat(document.getElementById('h-bc-bottom')?.value ?? 0) || 0
        };
    }

    function resetHeatSim() {
        stopHeatLoop();
        const dim = getHeatDim();
        const beta = Math.pow(10, parseFloat(document.getElementById('heat-beta-slider').value));
        document.getElementById('heat-beta-val').textContent = beta.toFixed(4);

        const bcType = document.getElementById('heat-bc-select').value;
        const icType = document.getElementById('heat-ic-select').value;
        const forcingType = document.getElementById('heat-forcing-select').value;

        heatSolver = new HeatSolver({
            dimension: dim, beta, bcType, bcParams: readHeatBCParams(), icType, forcingType
        });

        heatUiRev++;
        plotZoomed['heat-plot-1'] = false;
        plotZoomed['heat-plot-2'] = false;
        heatHistoryT = [0];
        heatHistoryU = [downsample1D(heatSolver.get1DProfile(), 64)];
        heatLastPlotTs = 0;

        if (heatRenderer) {
            heatRenderer.showVectors = document.getElementById('heat-chk-vectors').checked;
        }

        document.getElementById('heat-stage-title').textContent = dim === '1d' ? '1D Thin Rod Thermal Diffusion' : '2D Square Plate Diffusion';
        document.getElementById('heat-plot1-title').textContent = dim === '1d' ? 'Spatial Profile u(x, t)' : 'Centerline Slice u(x, L/2, t)';
        document.getElementById('heat-plot2-title').textContent = dim === '1d' ? 'Spacetime Heatmap u(x, t)' : '3D Temperature Surface u(x, y, t)';
        document.getElementById('heat-plot2-sub').textContent = dim === '1d' ? 'Violet (cold) → Red (hot)' : 'Interactive 3D view';

        const eqEl = document.getElementById('heat-eq-display');
        const eqTex = dim === '1d'
            ? (forcingType === 'none' ? '\\frac{\\partial u}{\\partial t} = \\beta \\frac{\\partial^2 u}{\\partial x^2}' : '\\frac{\\partial u}{\\partial t} = \\beta \\frac{\\partial^2 u}{\\partial x^2} + f(x)')
            : (forcingType === 'none' ? '\\frac{\\partial u}{\\partial t} = \\beta \\nabla^2 u' : '\\frac{\\partial u}{\\partial t} = \\beta \\nabla^2 u + f(x,y)');
        eqEl.setAttribute('data-tex', eqTex);
        renderKaTeX();

        document.getElementById('heat-steady-banner').classList.remove('visible');
        updateHeatStats();
        if (heatRenderer && currentView === 'heat') {
            heatRenderer.render(heatSolver);
            updateHeatPlots(true);
        }
    }

    function updateHeatStats() {
        if (!heatSolver) return;
        document.getElementById('heat-stat-t').textContent = `${heatSolver.time.toFixed(3)} s`;
        document.getElementById('heat-stat-steps').textContent = heatSolver.stepCount.toLocaleString();
        document.getElementById('heat-stat-dt').textContent = Number.isFinite(heatSolver.maxChange) ? heatSolver.maxChange.toExponential(1) : '—';
        document.getElementById('heat-min-lbl').textContent = Math.min(0, heatSolver.uMin).toFixed(2);
        document.getElementById('heat-max-lbl').textContent = Math.max(1, heatSolver.uMax).toFixed(2);
        if (heatSolver.steady) {
            document.getElementById('heat-steady-banner').classList.add('visible');
            stopHeatLoop();
        }
    }

    function updateHeatPlots(force = false) {
        if (!heatSolver || typeof Plotly === 'undefined') return;
        const now = performance.now();
        if (!force && now - heatLastPlotTs < 140) return;
        heatLastPlotTs = now;

        const xFull = heatSolver.getXArray();
        const prof = heatSolver.get1DProfile();
        const lo = Math.min(-0.05, heatSolver.uMin - 0.05);
        const hi = Math.max(1.05, heatSolver.uMax + 0.08);

        Plotly.react('heat-plot-1', [{
            x: xFull, y: prof, type: 'scatter', mode: 'lines',
            line: { color: '#dc2626', width: 2.5 },
            fill: 'tozeroy',
            fillcolor: isDark ? 'rgba(220,38,38,0.14)' : 'rgba(220,38,38,0.10)'
        }], plotlyBaseLayout(isDark, {
            datarevision: ++plotDataRev,
            uirevision: `heat1-${heatUiRev}`,
            xaxis: Object.assign({ title: 'x / L', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }, plotZoomed['heat-plot-1'] ? {} : { range: [0, 1] }),
            yaxis: Object.assign({ title: 'Temperature u', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }, plotZoomed['heat-plot-1'] ? {} : { range: [lo, hi] }),
            showlegend: false
        }), PLOTLY_INTERACTIVE_CONFIG);

        bindPlotZoomListener('heat-plot-1');
        if (heatSolver.dimension === '1d') {
            const xSmall = downsample1D(xFull, 64);
            const t0 = heatHistoryT[0] ?? 0;
            const t1 = heatHistoryT[heatHistoryT.length - 1] ?? 0;
            const layoutH2 = plotlyBaseLayout(isDark, {
                datarevision: ++plotDataRev,
                uirevision: `heat2-${heatUiRev}`,
                xaxis: Object.assign({ title: 'x / L' }, plotZoomed['heat-plot-2'] ? {} : { range: [0, 1] }),
                yaxis: Object.assign({ title: 'Time t (s)' }, plotZoomed['heat-plot-2'] ? {} : { range: [t0, Math.max(t1, t0 + 0.05)] })
            });
            Plotly.react('heat-plot-2', [{
                type: 'heatmap',
                x: xSmall,
                y: heatHistoryT.slice(),
                z: heatHistoryU.slice(),
                colorscale: HEAT_PLOTLY_COLORSCALE,
                showscale: false
            }], layoutH2, PLOTLY_INTERACTIVE_CONFIG);
            bindPlotZoomListener('heat-plot-2');
        } else {
            const xSmall = downsample1D(xFull, 31);
            const zSmall = downsample2D(heatSolver.get2DGrid(), 31);
            Plotly.react('heat-plot-2', [{
                type: 'surface', x: xSmall, y: xSmall, z: zSmall,
                colorscale: HEAT_PLOTLY_COLORSCALE, showscale: false
            }], {
                datarevision: ++plotDataRev,
                uirevision: `heat2d-${heatUiRev}`,
                paper_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 0, r: 0, t: 6, b: 6 },
                font: { family: 'Inter, sans-serif', size: 10.5, color: isDark ? '#cbd5e1' : '#334155' },
                scene: {
                    xaxis: { title: 'x' }, yaxis: { title: 'y' },
                    zaxis: { title: 'u', range: [lo, hi] },
                    camera: { eye: { x: 1.45, y: -1.45, z: 1.0 } }
                }
            }, PLOTLY_INTERACTIVE_CONFIG);
        }
    }

    function heatLoop() {
        if (!heatPlaying) return;
        const subSteps = heatSolver.dimension === '1d' ? heatSpeed * 6 : heatSpeed * 2;
        heatSolver.step(subSteps);
        heatRenderer.render(heatSolver);
        updateHeatStats();

        const now = performance.now();
        if (now - heatLastPlotTs >= 140) {
            if (heatSolver.dimension === '1d') {
                heatHistoryT.push(heatSolver.time);
                heatHistoryU.push(downsample1D(heatSolver.get1DProfile(), 64));
                if (heatHistoryT.length > 75) { heatHistoryT.shift(); heatHistoryU.shift(); }
            }
            updateHeatPlots(true);
        }
        if (heatPlaying) heatRaf = requestAnimationFrame(heatLoop);
    }

    function stopHeatLoop() {
        heatPlaying = false;
        if (heatRaf) cancelAnimationFrame(heatRaf);
        const btn = document.getElementById('heat-play-btn');
        if (btn) {
            btn.innerHTML = '<i data-lucide="play"></i><span>Play</span>';
            refreshIcons();
        }
    }

    function toggleHeatPlay() {
        if (heatPlaying) {
            stopHeatLoop();
        } else {
            if (heatSolver.steady) resetHeatSim();
            heatPlaying = true;
            const btn = document.getElementById('heat-play-btn');
            btn.innerHTML = '<i data-lucide="pause"></i><span>Pause</span>';
            refreshIcons();
            heatRaf = requestAnimationFrame(heatLoop);
        }
    }

    /* ======================================================================
       HEAT STUDIO — ANIMATED NUMERICAL SIMULATION
       ====================================================================== */
    const NUM_PRESETS = {
        q6_unstable:    { L: 1.0, beta: 1.0,   nx: 10, dt: 0.01,    icType: 'sine',     T0: 0,   TL: 0 },
        q6_stable:      { L: 1.0, beta: 1.0,   nx: 10, dt: 0.0025,  icType: 'sine',     T0: 0,   TL: 0 },
        w6_instability: { L: 1.0, beta: 1.0,   nx: 10, dt: 0.00735, icType: 'sine',     T0: 0,   TL: 0 },
        w7_rod:         { L: 10,  beta: 0.835, nx: 5,  dt: 0.1,     icType: 'zero_rod', T0: 100, TL: 50 },
        step_diff:      { L: 1.0, beta: 1.0,   nx: 16, dt: 0.00156, icType: 'step',     T0: 1.0, TL: 0.0 }
    };

    function getNumVisibility() {
        return {
            exact: document.getElementById('chk-exact').checked,
            ftcs:  document.getElementById('chk-ftcs').checked,
            btcs:  document.getElementById('chk-btcs').checked,
            cn:    document.getElementById('chk-cn').checked
        };
    }

    function initNumericalLab(cfg) {
        stopNumAuto();
        numLab = new NumericalHeatLab(cfg);

        const nxSlider = document.getElementById('num-nx-slider');
        const dtSlider = document.getElementById('num-dt-slider');
        const betaSlider = document.getElementById('num-beta-slider');

        nxSlider.value = numLab.nx;
        dtSlider.max = cfg.L > 2 ? 1.5 : 0.03;
        dtSlider.min = cfg.L > 2 ? 0.05 : 0.001;
        dtSlider.step = cfg.L > 2 ? 0.05 : 0.0005;
        dtSlider.value = numLab.dt;
        betaSlider.value = numLab.beta;

        renderNumericalLab();
    }

    function updateNumParamsFromSliders() {
        stopNumAuto();
        const nx = parseInt(document.getElementById('num-nx-slider').value, 10);
        const dt = parseFloat(document.getElementById('num-dt-slider').value);
        const beta = parseFloat(document.getElementById('num-beta-slider').value);
        numLab = new NumericalHeatLab({
            L: numLab.L, beta, nx, dt, icType: numLab.icType, T0: numLab.T0, TL: numLab.TL
        });
        renderNumericalLab();
    }

    function renderNumericalLab() {
        if (!numLab) return;
        const lam = numLab.lambda;
        const stable = lam <= 0.5 + 1e-9;
        const vis = getNumVisibility();

        document.getElementById('num-nx-val').textContent = `${numLab.nx} (Δx = ${numLab.dx.toFixed(3)})`;
        document.getElementById('num-dt-val').textContent = numLab.dt.toFixed(4);
        document.getElementById('num-beta-val').textContent = numLab.beta.toFixed(2);

        const card = document.getElementById('num-stability-card');
        card.className = `stability-card ${stable ? 'stable' : 'unstable'}`;
        document.getElementById('num-lambda-text').textContent = `λ = ${lam.toFixed(4)}`;
        document.getElementById('num-stability-badge').textContent = stable ? 'All Schemes Stable' : 'FTCS Unstable';
        document.getElementById('num-stability-desc').textContent = stable
            ? 'λ ≤ 0.5 satisfies the 1D Explicit FTCS stability criterion.'
            : 'λ > 0.5 violates Explicit FTCS stability — watch FTCS oscillate while BTCS & Crank–Nicolson stay smooth.';

        document.getElementById('num-main-title').textContent =
            `Time-Step Comparison — Step l = ${numLab.stepCount} (t = ${numLab.time.toFixed(4)})`;

        // Render live animated discrete-node rod canvas
        if (numRenderer) {
            numRenderer.render(numLab, vis);
        }

        if (typeof Plotly !== 'undefined') {
            const traces = [];
            if (vis.exact) {
                const fine = numLab.getFineExactCurve(120);
                traces.push({
                    x: fine.x, y: fine.y, name: 'Exact Analytical', mode: 'lines',
                    line: { color: isDark ? '#f1f5f9' : '#0f172a', width: 2.8 }
                });
            }
            if (vis.ftcs) {
                traces.push({
                    x: numLab.x, y: Array.from(numLab.uFTCS), name: 'Explicit FTCS',
                    mode: 'lines+markers', line: { color: '#dc2626', width: 2, dash: 'dot' },
                    marker: { size: 7, symbol: 'x' }
                });
            }
            if (vis.btcs) {
                traces.push({
                    x: numLab.x, y: Array.from(numLab.uBTCS), name: 'Implicit BTCS',
                    mode: 'lines+markers', line: { color: '#0284c7', width: 2, dash: 'dash' },
                    marker: { size: 6, symbol: 'square-open' }
                });
            }
            if (vis.cn) {
                traces.push({
                    x: numLab.x, y: Array.from(numLab.uCN), name: 'Crank–Nicolson',
                    mode: 'lines+markers', line: { color: '#059669', width: 2.2 },
                    marker: { size: 6, symbol: 'circle' }
                });
            }

            const baseHi = Math.max(1.15, numLab.T0 * 1.15, numLab.TL * 1.15);
            const ftcsPeak = Math.max(...Array.from(numLab.uFTCS).map(Math.abs));
            const yRange = ftcsPeak > baseHi * 4 ? [-baseHi * 2.5, baseHi * 2.5] : undefined;

            Plotly.react('num-plot-compare', traces, plotlyBaseLayout(isDark, {
                datarevision: ++plotDataRev,
                xaxis: { title: `Position x (0 to ${numLab.L})`, gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'Temperature T(x, t)', range: yRange, gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);

            const stepsCopy = numLab.historySteps.slice();
            const errTraces = [
                { x: stepsCopy, y: numLab.errFTCS.slice(), name: 'FTCS Error', mode: 'lines+markers', line: { color: '#dc2626', width: 2 }, marker: { size: 4 } },
                { x: stepsCopy, y: numLab.errBTCS.slice(), name: 'BTCS Error', mode: 'lines+markers', line: { color: '#0284c7', width: 2 }, marker: { size: 4 } },
                { x: stepsCopy, y: numLab.errCN.slice(),   name: 'CN Error',   mode: 'lines+markers', line: { color: '#059669', width: 2 }, marker: { size: 4 } }
            ];
            Plotly.react('num-plot-error', errTraces, plotlyBaseLayout(isDark, {
                datarevision: ++plotDataRev,
                xaxis: { title: 'Time Step l', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                yaxis: { title: 'Max |Error|', type: numLab.stepCount > 1 ? 'log' : 'linear', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }
            }), PLOTLY_INTERACTIVE_CONFIG);
        }

        const tbody = document.getElementById('num-node-tbody');
        const rows = [];
        for (let i = 0; i <= numLab.nx; i++) {
            const fmt = v => Math.abs(v) > 999 ? v.toExponential(2) : v.toFixed(4);
            rows.push(`<tr>
                <td>${numLab.x[i].toFixed(2)}</td>
                <td>${fmt(numLab.uExact[i])}</td>
                <td style="color:var(--status-err);">${fmt(numLab.uFTCS[i])}</td>
                <td style="color:var(--accent-wave);">${fmt(numLab.uBTCS[i])}</td>
                <td style="color:var(--status-ok);">${fmt(numLab.uCN[i])}</td>
            </tr>`);
        }
        tbody.innerHTML = rows.join('');
    }

    function stopNumAuto() {
        numPlaying = false;
        clearInterval(numTimer);
        const btn = document.getElementById('num-play-btn');
        if (btn) {
            btn.innerHTML = '<i data-lucide="play"></i><span>Play Simulation</span>';
            refreshIcons();
        }
    }

    function startNumInterval() {
        clearInterval(numTimer);
        numTimer = setInterval(() => {
            numLab.step(1);
            renderNumericalLab();
            if (numLab.stepCount >= 120) stopNumAuto();
        }, numIntervalMs);
    }

    function toggleNumAuto() {
        if (numPlaying) {
            stopNumAuto();
        } else {
            numPlaying = true;
            const btn = document.getElementById('num-play-btn');
            btn.innerHTML = '<i data-lucide="pause"></i><span>Pause</span>';
            refreshIcons();
            startNumInterval();
        }
    }

    /* ======================================================================
       WAVE EQUATION STUDIO (OPTIMIZED + FIXED ENERGY PLOT + SMART NODE OPTION)
       ====================================================================== */
    const WAVE_PRESETS = {
        plucked:   { dim: '1d', c: 1.0, damp: 0,    bc: 'dirichlet', ic: 'plucked',  vel: 'zero',    m: 1, n: 1, dal: true },
        mode1:     { dim: '1d', c: 1.0, damp: 0,    bc: 'dirichlet', ic: 'sine',     vel: 'zero',    m: 1, n: 1, dal: false },
        mode3:     { dim: '1d', c: 1.0, damp: 0,    bc: 'dirichlet', ic: 'mode',     vel: 'zero',    m: 3, n: 1, dal: false },
        dalembert: { dim: '1d', c: 1.0, damp: 0,    bc: 'dirichlet', ic: 'gaussian', vel: 'zero',    m: 1, n: 1, dal: true },
        struck:    { dim: '1d', c: 1.0, damp: 0,    bc: 'dirichlet', ic: 'zero',     vel: 'impulse', m: 1, n: 1, dal: false },
        mem_drop:  { dim: '2d', c: 1.0, damp: 0.03, bc: 'dirichlet', ic: 'gaussian', vel: 'zero',    m: 2, n: 2, dal: false },
        mem_mode:  { dim: '2d', c: 1.0, damp: 0,    bc: 'dirichlet', ic: 'mode',     vel: 'zero',    m: 2, n: 3, dal: false }
    };

    function getWaveDim() {
        const active = document.querySelector('#wave-dim-toggle .toggle-btn.active');
        return active ? active.dataset.value : '1d';
    }

    function syncWaveControlVisibility() {
        const dim = getWaveDim();
        const ic = document.getElementById('wave-ic-select').value;
        const bc = document.getElementById('wave-bc-select').value;
        const vel = document.getElementById('wave-vel-select').value;
        const damp = parseFloat(document.getElementById('wave-damp-slider').value);
        const modeM = parseInt(document.getElementById('wave-mode-m').value, 10) || 1;

        document.getElementById('wave-mode-controls').style.display = ic === 'mode' ? 'grid' : 'none';
        document.getElementById('wave-mode-n-wrap').style.display = dim === '2d' ? 'block' : 'none';
        document.getElementById('wave-vel-group').style.display = dim === '1d' ? 'flex' : 'none';

        // Show interior node dots toggle ONLY when interior standing nodes actually exist
        const hasInteriorNodes = (dim === '1d' && bc === 'dirichlet' && ic === 'mode' && modeM >= 2);
        const hasDAlembert = (dim === '1d' && vel === 'zero' && damp === 0);

        document.getElementById('wave-nodes-row').style.display = hasInteriorNodes ? 'flex' : 'none';
        document.getElementById('wave-dalembert-row').style.display = hasDAlembert ? 'flex' : 'none';
        document.getElementById('wave-overlays-section').style.display = (hasInteriorNodes || hasDAlembert) ? 'flex' : 'none';
    }

    function resetWaveSim() {
        stopWaveLoop();
        syncWaveControlVisibility();
        const dim = getWaveDim();
        const c = parseFloat(document.getElementById('wave-c-slider').value);
        const damping = parseFloat(document.getElementById('wave-damp-slider').value);
        const bcType = document.getElementById('wave-bc-select').value;
        const icType = document.getElementById('wave-ic-select').value;
        const velType = document.getElementById('wave-vel-select').value;
        const modeM = Math.max(1, Math.min(6, parseInt(document.getElementById('wave-mode-m').value, 10) || 2));
        const modeN = Math.max(1, Math.min(6, parseInt(document.getElementById('wave-mode-n').value, 10) || 3));

        document.getElementById('wave-c-val').textContent = c.toFixed(2);
        document.getElementById('wave-damp-val').textContent = damping.toFixed(2);

        waveSolver = new WaveSolver({ dimension: dim, c, damping, bcType, icType, velType, modeM, modeN });
        waveUiRev++;
        plotZoomed['wave-plot-1'] = false;
        plotZoomed['wave-plot-2'] = false;
        waveHistoryT = [0];
        waveHistoryU = [downsample1D(waveSolver.get1DProfile(), 64)];
        waveLastPlotTs = 0;

        if (waveRenderer) {
            waveRenderer.showDAlembert = document.getElementById('wave-chk-dalembert').checked;
            waveRenderer.showNodes = document.getElementById('wave-chk-nodes').checked;
        }

        document.getElementById('wave-stage-title').textContent = dim === '1d' ? '1D Vibrating String' : '2D Water-Surface Wave Ripples';
        document.getElementById('wave-plot1-title').textContent = dim === '1d' ? 'Spacetime Characteristics u(x, t)' : 'Centerline Slice u(x, L/2, t)';
        document.getElementById('wave-plot1-sub').textContent = dim === '1d' ? 'Diagonal wave rays x ± ct' : 'Live 1D cross-section';
        document.getElementById('wave-plot2-title').textContent = dim === '1d' ? 'Mechanical Energy Conservation' : '3D Wave Surface u(x, y, t)';
        document.getElementById('wave-plot2-sub').textContent = dim === '1d' ? 'Kinetic, Potential & Total' : 'Interactive 3D view';
        document.getElementById('wave-legend-info').textContent = dim === '1d'
            ? `Fundamental freq f₁ = c/(2L) = ${(c / 2).toFixed(2)} Hz`
            : `2D Mode freq f_${modeM},${modeN} = ${(0.5 * c * Math.hypot(modeM, modeN)).toFixed(2)} Hz`;

        const eqEl = document.getElementById('wave-eq-display');
        eqEl.setAttribute('data-tex', dim === '1d' ? '\\frac{\\partial^2 u}{\\partial t^2} = c^2\\frac{\\partial^2 u}{\\partial x^2}' : '\\frac{\\partial^2 u}{\\partial t^2} = c^2\\nabla^2 u');
        eqEl.textContent = dim === '1d' ? '∂²u/∂t² = c² ∂²u/∂x²' : '∂²u/∂t² = c² ∇²u';
        renderKaTeX();

        updateWaveStats();
        if (waveRenderer && currentView === 'wave') {
            waveRenderer.render(waveSolver);
            updateWavePlots(true);
            requestAnimationFrame(() => safePlotlyResize(['wave-plot-1', 'wave-plot-2']));
        }
    }

    function updateWaveStats() {
        if (!waveSolver) return;
        document.getElementById('wave-stat-t').textContent = `${waveSolver.time.toFixed(3)} s`;
        document.getElementById('wave-stat-steps').textContent = waveSolver.stepCount.toLocaleString();
        document.getElementById('wave-stat-cfl').textContent = (waveSolver.c * waveSolver.dt / waveSolver.dx).toFixed(2);
    }

    function updateWavePlots(force = false) {
        if (!waveSolver || typeof Plotly === 'undefined') return;
        const now = performance.now();
        if (!force && now - waveLastPlotTs < 150) return;
        waveLastPlotTs = now;

        const xFull = waveSolver.getXArray();

        if (waveSolver.dimension === '1d') {
            const xSmall = downsample1D(xFull, 64);
            const wt0 = waveHistoryT[0] ?? 0;
            const wt1 = waveHistoryT[waveHistoryT.length - 1] ?? 0;
            const ySpan = Math.max(wt1, wt0 + 0.05);
            const layoutW1 = plotlyBaseLayout(isDark, {
                datarevision: ++plotDataRev,
                uirevision: `wave1-${waveUiRev}`,
                xaxis: Object.assign({ title: 'x / L' }, plotZoomed['wave-plot-1'] ? {} : { range: [0, 1] }),
                yaxis: Object.assign({ title: 'Time t (s)' }, plotZoomed['wave-plot-1'] ? {} : { range: [wt0, ySpan] })
            });
            Plotly.react('wave-plot-1', [{
                type: 'heatmap',
                x: xSmall, y: waveHistoryT.slice(), z: waveHistoryU.slice(),
                colorscale: 'RdBu', reversescale: true, zmid: 0, showscale: false
            }], layoutW1, PLOTLY_INTERACTIVE_CONFIG);
            bindPlotZoomListener('wave-plot-1');

            const eh = waveSolver.energyHistory;
            const etCopy = eh.t.slice();
            const modeStr = etCopy.length < 3 ? 'lines+markers' : 'lines';
            const maxE = Math.max(0.1, ...eh.Etot) * 1.18;
            const et0 = etCopy[0] ?? 0;
            const et1 = etCopy[etCopy.length - 1] ?? 0;
            const layoutW2 = plotlyBaseLayout(isDark, {
                datarevision: ++plotDataRev,
                uirevision: `wave2-${waveUiRev}`,
                xaxis: Object.assign(
                    { title: 'Time t (s)', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                    plotZoomed['wave-plot-2'] ? {} : { range: [et0, Math.max(et1, et0 + 0.05)] }
                ),
                yaxis: Object.assign(
                    { title: 'Energy', gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' },
                    plotZoomed['wave-plot-2'] ? {} : { range: [0, maxE] }
                )
            });
            Plotly.react('wave-plot-2', [
                { x: etCopy, y: eh.Ek.slice(),   name: 'Kinetic',   mode: modeStr, line: { color: '#0284c7', width: 2 }, marker: { size: 6 } },
                { x: etCopy, y: eh.Ep.slice(),   name: 'Potential', mode: modeStr, line: { color: '#7c3aed', width: 2 }, marker: { size: 6 } },
                { x: etCopy, y: eh.Etot.slice(), name: 'Total E',   mode: modeStr, line: { color: isDark ? '#f1f5f9' : '#0f172a', width: 2.3, dash: 'dot' }, marker: { size: 6 } }
            ], layoutW2, PLOTLY_INTERACTIVE_CONFIG);
            bindPlotZoomListener('wave-plot-2');
        } else {
            Plotly.react('wave-plot-1', [{
                x: xFull, y: waveSolver.get1DProfile(), type: 'scatter', mode: 'lines',
                line: { color: isDark ? '#38bdf8' : '#0284c7', width: 2.4 }
            }], plotlyBaseLayout(isDark, {
                datarevision: ++plotDataRev,
                uirevision: `wave2d1-${waveUiRev}`,
                xaxis: { title: 'x / L', range: [0, 1] },
                yaxis: { title: 'Displacement u', range: [-1.1, 1.1] },
                showlegend: false
            }), PLOTLY_INTERACTIVE_CONFIG);

            const xSmall = downsample1D(xFull, 29);
            const zSmall = downsample2D(waveSolver.get2DGrid(), 29);
            Plotly.react('wave-plot-2', [{
                type: 'surface', x: xSmall, y: xSmall, z: zSmall,
                colorscale: 'Blues', reversescale: false, cmin: -1, cmax: 1, showscale: false
            }], {
                datarevision: ++plotDataRev,
                uirevision: `wave2d2-${waveUiRev}`,
                paper_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 0, r: 0, t: 6, b: 6 },
                font: { family: 'Inter, sans-serif', size: 10.5, color: isDark ? '#cbd5e1' : '#334155' },
                scene: {
                    xaxis: { title: 'x' }, yaxis: { title: 'y' },
                    zaxis: { title: 'u', range: [-1.1, 1.1] },
                    camera: { eye: { x: 1.45, y: 1.45, z: 1.0 } }
                }
            }, PLOTLY_INTERACTIVE_CONFIG);
        }
    }

    function waveLoop() {
        if (!wavePlaying) return;
        waveSolver.step(waveSpeed);
        waveRenderer.render(waveSolver);
        updateWaveStats();

        const now = performance.now();
        if (now - waveLastPlotTs >= 150) {
            if (waveSolver.dimension === '1d') {
                waveHistoryT.push(waveSolver.time);
                waveHistoryU.push(downsample1D(waveSolver.get1DProfile(), 64));
                if (waveHistoryT.length > 75) { waveHistoryT.shift(); waveHistoryU.shift(); }
            }
            updateWavePlots(true);
        }
        if (wavePlaying) waveRaf = requestAnimationFrame(waveLoop);
    }

    function stopWaveLoop() {
        wavePlaying = false;
        if (waveRaf) cancelAnimationFrame(waveRaf);
        const btn = document.getElementById('wave-play-btn');
        if (btn) {
            btn.innerHTML = '<i data-lucide="play"></i><span>Play</span>';
            refreshIcons();
        }
    }

    function toggleWavePlay() {
        if (wavePlaying) {
            stopWaveLoop();
        } else {
            wavePlaying = true;
            const btn = document.getElementById('wave-play-btn');
            btn.innerHTML = '<i data-lucide="pause"></i><span>Pause</span>';
            refreshIcons();
            waveRaf = requestAnimationFrame(waveLoop);
        }
    }

    /* ======================================================================
       GRAPHS GALLERY
       ====================================================================== */
    function buildGraphsGallery() {
        const grid = document.getElementById('graphs-gallery-grid');
        grid.innerHTML = GALLERY_GRAPHS.map(g => {
            const tagCls = g.category === 'heat' ? 'heat' : (g.category === 'wave' ? 'wave' : 'heat');
            const tagTxt = g.category === 'heat' ? 'Heat · Parabolic' : (g.category === 'wave' ? 'Wave · Hyperbolic' : 'Fourier & FD');
            return `
            <article class="textbook-card" data-category="${g.category}">
                <div class="textbook-card-head">
                    <div>
                        <div class="tb-meta">
                            <span class="tb-tag ${tagCls}">${tagTxt}</span>
                            <span class="tb-ref">${g.reference}</span>
                        </div>
                        <h3>${g.title}</h3>
                    </div>
                    <div class="tb-actions">
                        <button class="btn btn-sm" data-view-py="${g.id}" title="Preview Python script">
                            <i data-lucide="code-2"></i><span>Code</span>
                        </button>
                        <button class="btn btn-sm btn-primary" data-dl-py="${g.id}" title="Download standalone Python script">
                            <i data-lucide="download"></i><span>.py</span>
                        </button>
                    </div>
                </div>
                <div class="tb-plot" id="tb-plot-${g.id}"></div>
                <p class="tb-caption">${g.caption}</p>
            </article>`;
        }).join('');

        refreshIcons();

        grid.querySelectorAll('[data-dl-py]').forEach(btn => {
            btn.addEventListener('click', () => {
                const g = GALLERY_GRAPHS.find(item => item.id === btn.dataset.dlPy);
                if (g) downloadTextFile(g.filename, g.pythonCode);
            });
        });

        grid.querySelectorAll('[data-view-py]').forEach(btn => {
            btn.addEventListener('click', () => {
                const g = GALLERY_GRAPHS.find(item => item.id === btn.dataset.viewPy);
                if (g) openCodeModal(g);
            });
        });

        rerenderVisibleGraphs();
    }

    function rerenderVisibleGraphs() {
        GALLERY_GRAPHS.forEach(g => {
            const card = document.querySelector(`.textbook-card [id="tb-plot-${g.id}"]`)?.closest('.textbook-card');
            if (card && card.style.display !== 'none') {
                g.render(`tb-plot-${g.id}`, isDark);
            }
        });
    }

    function openCodeModal(graphObj) {
        activeModalGraph = graphObj;
        document.getElementById('modal-title').textContent = graphObj.filename;
        document.getElementById('modal-code-pre').textContent = graphObj.pythonCode;
        document.getElementById('code-modal').classList.add('open');
    }

    function closeCodeModal() {
        document.getElementById('code-modal').classList.remove('open');
    }

    /* ======================================================================
       EVENT WIRING & BOOTSTRAP
       ====================================================================== */
    function bindAll() {
        document.querySelectorAll('[data-nav]').forEach(el => {
            el.addEventListener('click', () => setView(el.dataset.nav));
        });

        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

        // Heat sub-tabs
        document.querySelectorAll('[data-heat-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                heatSubTab = tab.dataset.heatTab;
                document.querySelectorAll('[data-heat-tab]').forEach(t => t.classList.toggle('active', t === tab));
                document.getElementById('heat-pane-interactive').style.display = heatSubTab === 'interactive' ? 'block' : 'none';
                document.getElementById('heat-pane-numerical').style.display = heatSubTab === 'numerical' ? 'block' : 'none';
                requestAnimationFrame(() => {
                    if (heatSubTab === 'numerical') {
                        stopHeatLoop();
                        renderNumericalLab();
                        safePlotlyResize(['num-plot-compare', 'num-plot-error']);
                    } else {
                        stopNumAuto();
                        heatRenderer.render(heatSolver);
                        updateHeatPlots(true);
                        safePlotlyResize(['heat-plot-1', 'heat-plot-2']);
                    }
                });
            });
        });

        // Heat interactive controls
        document.querySelectorAll('[data-heat-preset]').forEach(chip => {
            chip.addEventListener('click', () => {
                const p = HEAT_PRESETS[chip.dataset.heatPreset];
                if (!p) return;
                document.querySelectorAll('[data-heat-preset]').forEach(c => c.classList.toggle('active', c === chip));
                document.querySelectorAll('#heat-dim-toggle .toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.value === p.dim));
                document.getElementById('heat-beta-slider').value = Math.log10(p.beta);
                document.getElementById('heat-bc-select').value = p.bcType;
                document.getElementById('heat-ic-select').value = p.icType;
                document.getElementById('heat-forcing-select').value = p.forcing;
                buildHeatBCInputs(p.bcParams);
                resetHeatSim();
                toggleHeatPlay();
            });
        });

        document.querySelectorAll('#heat-dim-toggle .toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#heat-dim-toggle .toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
                buildHeatBCInputs();
                resetHeatSim();
            });
        });
        document.getElementById('heat-beta-slider').addEventListener('input', resetHeatSim);
        document.getElementById('heat-bc-select').addEventListener('change', () => { buildHeatBCInputs(); resetHeatSim(); });
        document.getElementById('heat-ic-select').addEventListener('change', resetHeatSim);
        document.getElementById('heat-forcing-select').addEventListener('change', resetHeatSim);
        document.getElementById('heat-chk-vectors').addEventListener('change', (e) => {
            heatRenderer.showVectors = e.target.checked;
            heatRenderer.render(heatSolver);
        });
        document.querySelectorAll('#heat-speed-pills .speed-pill').forEach(p => {
            p.addEventListener('click', () => {
                document.querySelectorAll('#heat-speed-pills .speed-pill').forEach(x => x.classList.toggle('active', x === p));
                heatSpeed = parseInt(p.dataset.speed, 10);
            });
        });
        document.getElementById('heat-play-btn').addEventListener('click', toggleHeatPlay);
        document.getElementById('heat-reset-btn').addEventListener('click', resetHeatSim);
        document.getElementById('heat-replay-btn').addEventListener('click', () => { resetHeatSim(); toggleHeatPlay(); });

        // Numerical Heat Simulation controls
        document.querySelectorAll('[data-num-preset]').forEach(chip => {
            chip.addEventListener('click', () => {
                const cfg = NUM_PRESETS[chip.dataset.numPreset];
                if (!cfg) return;
                document.querySelectorAll('[data-num-preset]').forEach(c => c.classList.toggle('active', c === chip));
                initNumericalLab(cfg);
            });
        });
        ['num-nx-slider', 'num-dt-slider', 'num-beta-slider'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateNumParamsFromSliders);
        });
        ['chk-exact', 'chk-ftcs', 'chk-btcs', 'chk-cn'].forEach(id => {
            document.getElementById(id).addEventListener('change', renderNumericalLab);
        });
        document.querySelectorAll('#num-speed-pills .speed-pill').forEach(p => {
            p.addEventListener('click', () => {
                document.querySelectorAll('#num-speed-pills .speed-pill').forEach(x => x.classList.toggle('active', x === p));
                numIntervalMs = parseInt(p.dataset.ms, 10);
                if (numPlaying) startNumInterval();
            });
        });
        document.getElementById('num-step1-btn').addEventListener('click', () => { numLab.step(1); renderNumericalLab(); });
        document.getElementById('num-step5-btn').addEventListener('click', () => { numLab.step(5); renderNumericalLab(); });
        document.getElementById('num-reset-btn').addEventListener('click', () => { stopNumAuto(); numLab.reset(); renderNumericalLab(); });
        document.getElementById('num-play-btn').addEventListener('click', toggleNumAuto);

        // Wave Simulator controls
        document.querySelectorAll('[data-wave-preset]').forEach(chip => {
            chip.addEventListener('click', () => {
                const p = WAVE_PRESETS[chip.dataset.wavePreset];
                if (!p) return;
                document.querySelectorAll('[data-wave-preset]').forEach(c => c.classList.toggle('active', c === chip));
                document.querySelectorAll('#wave-dim-toggle .toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.value === p.dim));
                document.getElementById('wave-c-slider').value = p.c;
                document.getElementById('wave-damp-slider').value = p.damp;
                document.getElementById('wave-bc-select').value = p.bc;
                document.getElementById('wave-ic-select').value = p.ic;
                document.getElementById('wave-vel-select').value = p.vel;
                document.getElementById('wave-mode-m').value = p.m;
                document.getElementById('wave-mode-n').value = p.n;
                document.getElementById('wave-chk-dalembert').checked = p.dal;
                resetWaveSim();
                toggleWavePlay();
            });
        });
        document.querySelectorAll('#wave-dim-toggle .toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#wave-dim-toggle .toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
                resetWaveSim();
            });
        });
        ['wave-c-slider', 'wave-damp-slider', 'wave-bc-select', 'wave-ic-select', 'wave-vel-select', 'wave-mode-m', 'wave-mode-n'].forEach(id => {
            document.getElementById(id).addEventListener('input', resetWaveSim);
        });
        document.getElementById('wave-chk-dalembert').addEventListener('change', (e) => {
            waveRenderer.showDAlembert = e.target.checked;
            waveRenderer.render(waveSolver);
        });
        document.getElementById('wave-chk-nodes').addEventListener('change', (e) => {
            waveRenderer.showNodes = e.target.checked;
            waveRenderer.render(waveSolver);
        });
        document.querySelectorAll('#wave-speed-pills .speed-pill').forEach(p => {
            p.addEventListener('click', () => {
                document.querySelectorAll('#wave-speed-pills .speed-pill').forEach(x => x.classList.toggle('active', x === p));
                waveSpeed = parseInt(p.dataset.speed, 10);
            });
        });
        document.getElementById('wave-play-btn').addEventListener('click', toggleWavePlay);
        document.getElementById('wave-reset-btn').addEventListener('click', resetWaveSim);

        // Graphs Gallery Filter
        document.querySelectorAll('#graphs-filter-tabs .seg-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#graphs-filter-tabs .seg-tab').forEach(t => t.classList.toggle('active', t === tab));
                const filter = tab.dataset.filter;
                document.querySelectorAll('.textbook-card').forEach(card => {
                    card.style.display = (filter === 'all' || card.dataset.category === filter) ? 'flex' : 'none';
                });
                setTimeout(rerenderVisibleGraphs, 30);
            });
        });

        // Code Preview Modal
        document.getElementById('modal-close-btn').addEventListener('click', closeCodeModal);
        document.getElementById('code-modal').addEventListener('click', (e) => {
            if (e.target.id === 'code-modal') closeCodeModal();
        });
        document.getElementById('modal-copy-btn').addEventListener('click', () => {
            if (activeModalGraph) copyText(activeModalGraph.pythonCode);
        });
        document.getElementById('modal-download-btn').addEventListener('click', () => {
            if (activeModalGraph) downloadTextFile(activeModalGraph.filename, activeModalGraph.pythonCode);
        });

        // Resize
        window.addEventListener('resize', () => {
            if (currentView === 'heat' && heatSubTab === 'interactive' && heatRenderer && heatSolver) {
                heatRenderer.render(heatSolver);
            } else if (currentView === 'heat' && heatSubTab === 'numerical' && numRenderer && numLab) {
                numRenderer.render(numLab, getNumVisibility());
            } else if (currentView === 'wave' && waveRenderer && waveSolver) {
                waveRenderer.render(waveSolver);
            }
        });
    }

    window.addEventListener('DOMContentLoaded', () => {
        try {
            if (localStorage.getItem('pde_studio_theme') === 'dark') {
                isDark = true;
                document.documentElement.setAttribute('data-theme', 'dark');
                document.getElementById('theme-label').textContent = 'Light';
                document.getElementById('theme-icon').setAttribute('data-lucide', 'sun');
            }
        } catch (_) {}

        heatRenderer = new HeatCanvasRenderer(document.getElementById('heat-canvas'));
        numRenderer = new NumericalHeatCanvasRenderer(document.getElementById('num-canvas'));
        waveRenderer = new WaveCanvasRenderer(document.getElementById('wave-canvas'));

        buildHeatBCInputs({ left: 0, right: 0 });
        bindAll();
        resetHeatSim();
        initNumericalLab(NUM_PRESETS.q6_unstable);
        resetWaveSim();

        refreshIcons();
        renderKaTeX();
        window.addEventListener('load', renderKaTeX);
    });
})();
