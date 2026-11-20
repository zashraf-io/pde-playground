/**
 * 1D Vibrating String & 2D Rectangular Membrane Wave Equation Solver
 * ∂²u/∂t² = c²∇²u - 2γ ∂u/∂t
 * Includes exact D'Alembert traveling wave decomposition for 1D undamped waves.
 */

class WaveSolver {
    constructor(config = {}) {
        this.dimension = config.dimension ?? '1d';
        this.L = 1.0;
        this.c = config.c ?? 1.0;
        this.damping = config.damping ?? 0.0;
        this.bcType = config.bcType ?? 'dirichlet'; // 'dirichlet' | 'neumann'
        this.icType = config.icType ?? 'plucked'; // 'plucked' | 'sine' | 'mode' | 'superposition' | 'gaussian' | 'zero'
        this.velType = config.velType ?? 'zero';  // 'zero' | 'impulse' | 'sine_vel'
        this.modeM = config.modeM ?? 2;
        this.modeN = config.modeN ?? 3;

        this.nx = this.dimension === '1d' ? 180 : 60;
        this.ny = this.dimension === '2d' ? 60 : 1;
        this.dx = this.L / this.nx;
        this.dy = this.dimension === '2d' ? this.L / this.ny : this.dx;

        this._computeDt();
        this.reset();
    }

    _computeDt() {
        const cfl = this.dimension === '1d' ? 0.65 : 0.45;
        this.dt = (cfl * this.dx) / Math.max(this.c, 0.1);
    }

    idx(i, j) {
        return j * (this.nx + 1) + i;
    }

    reset() {
        this._computeDt();
        this.time = 0;
        this.stepCount = 0;
        const size = this.dimension === '1d' ? this.nx + 1 : (this.nx + 1) * (this.ny + 1);
        this.uPrev = new Float64Array(size);
        this.uCurr = new Float64Array(size);
        this.uNext = new Float64Array(size);

        // Apply u(x,0) = f(x) and u_t(x,0) = g(x)
        const g = new Float64Array(size);
        if (this.dimension === '1d') {
            for (let i = 0; i <= this.nx; i++) {
                const x = i * this.dx;
                this.uPrev[i] = this._f1D(x);
                g[i] = this._g1D(x);
            }
            this._applyBC(this.uPrev);
            // 2nd-order Taylor startup step u^1
            const r2 = (this.c * this.dt / this.dx) ** 2;
            for (let i = 1; i < this.nx; i++) {
                const lap = this.uPrev[i + 1] - 2 * this.uPrev[i] + this.uPrev[i - 1];
                this.uCurr[i] = this.uPrev[i] + this.dt * g[i] + 0.5 * r2 * lap;
            }
            this._applyBC(this.uCurr);
        } else {
            for (let j = 0; j <= this.ny; j++) {
                for (let i = 0; i <= this.nx; i++) {
                    const k = this.idx(i, j);
                    this.uPrev[k] = this._f2D(i * this.dx, j * this.dy);
                    g[k] = 0;
                }
            }
            this._applyBC(this.uPrev);
            const r2 = (this.c * this.dt / this.dx) ** 2;
            for (let j = 1; j < this.ny; j++) {
                for (let i = 1; i < this.nx; i++) {
                    const k = this.idx(i, j);
                    const lap = this.uPrev[k + 1] + this.uPrev[k - 1]
                              + this.uPrev[k + this.nx + 1] + this.uPrev[k - this.nx - 1]
                              - 4 * this.uPrev[k];
                    this.uCurr[k] = this.uPrev[k] + this.dt * g[k] + 0.5 * r2 * lap;
                }
            }
            this._applyBC(this.uCurr);
        }

        // Start display at t=0 by copying uPrev into a snapshot getter, or stepping cleanly
        this.uDisplay = new Float64Array(this.uPrev);
        this.energyHistory = { t: [], Ek: [], Ep: [], Etot: [] };
        this._recordEnergy();
    }

    _f1D(x) {
        const L = this.L;
        switch (this.icType) {
            case 'plucked': return x <= L / 2 ? (2 * x / L) : (2 * (L - x) / L);
            case 'sine': return Math.sin(Math.PI * x / L);
            case 'mode': return Math.sin(this.modeM * Math.PI * x / L);
            case 'superposition': return 0.7 * Math.sin(Math.PI * x / L) + 0.35 * Math.sin(3 * Math.PI * x / L);
            case 'gaussian': return Math.exp(-160 * (x - L / 2) ** 2);
            case 'zero': return 0;
            default: return Math.sin(Math.PI * x / L);
        }
    }

    _g1D(x) {
        const L = this.L;
        switch (this.velType) {
            case 'impulse': return 4.5 * Math.exp(-180 * (x - L / 2) ** 2);
            case 'sine_vel': return 2.5 * Math.sin(Math.PI * x / L);
            case 'zero':
            default: return 0;
        }
    }

    _f2D(x, y) {
        const L = this.L;
        switch (this.icType) {
            case 'mode':
                return Math.sin(this.modeM * Math.PI * x / L) * Math.sin(this.modeN * Math.PI * y / L);
            case 'gaussian':
                return Math.exp(-90 * ((x - L / 2) ** 2 + (y - L / 2) ** 2));
            case 'superposition':
                return 0.65 * Math.exp(-120 * ((x - 0.35 * L) ** 2 + (y - 0.35 * L) ** 2))
                     - 0.65 * Math.exp(-120 * ((x - 0.65 * L) ** 2 + (y - 0.65 * L) ** 2));
            case 'plucked': {
                const tx = 1 - Math.abs(2 * x / L - 1);
                const ty = 1 - Math.abs(2 * y / L - 1);
                return tx * ty;
            }
            case 'sine':
            default:
                return Math.sin(Math.PI * x / L) * Math.sin(Math.PI * y / L);
        }
    }

    _applyBC(arr) {
        if (this.dimension === '1d') {
            if (this.bcType === 'dirichlet') {
                arr[0] = 0;
                arr[this.nx] = 0;
            } else {
                arr[0] = arr[1];
                arr[this.nx] = arr[this.nx - 1];
            }
        } else {
            const nx = this.nx, ny = this.ny;
            if (this.bcType === 'dirichlet') {
                for (let j = 0; j <= ny; j++) {
                    arr[this.idx(0, j)] = 0;
                    arr[this.idx(nx, j)] = 0;
                }
                for (let i = 0; i <= nx; i++) {
                    arr[this.idx(i, 0)] = 0;
                    arr[this.idx(i, ny)] = 0;
                }
            } else {
                for (let j = 0; j <= ny; j++) {
                    arr[this.idx(0, j)] = arr[this.idx(1, j)];
                    arr[this.idx(nx, j)] = arr[this.idx(nx - 1, j)];
                }
                for (let i = 0; i <= nx; i++) {
                    arr[this.idx(i, 0)] = arr[this.idx(i, 1)];
                    arr[this.idx(i, ny)] = arr[this.idx(i, ny - 1)];
                }
            }
        }
    }

    step(nSteps = 1) {
        const r2 = (this.c * this.dt / this.dx) ** 2;
        const damp = this.damping * this.dt;
        const denom = 1 + damp;

        for (let s = 0; s < nSteps; s++) {
            if (this.stepCount === 0) {
                this.uDisplay.set(this.uCurr);
                this.time += this.dt;
                this.stepCount++;
                continue;
            }

            if (this.dimension === '1d') {
                for (let i = 1; i < this.nx; i++) {
                    const lap = this.uCurr[i + 1] - 2 * this.uCurr[i] + this.uCurr[i - 1];
                    this.uNext[i] = (2 * this.uCurr[i] - (1 - damp) * this.uPrev[i] + r2 * lap) / denom;
                }
            } else {
                const nx = this.nx, ny = this.ny;
                for (let j = 1; j < ny; j++) {
                    for (let i = 1; i < nx; i++) {
                        const k = this.idx(i, j);
                        const lap = this.uCurr[k + 1] + this.uCurr[k - 1]
                                  + this.uCurr[k + nx + 1] + this.uCurr[k - nx - 1]
                                  - 4 * this.uCurr[k];
                        this.uNext[k] = (2 * this.uCurr[k] - (1 - damp) * this.uPrev[k] + r2 * lap) / denom;
                    }
                }
            }
            this._applyBC(this.uNext);

            const tmp = this.uPrev;
            this.uPrev = this.uCurr;
            this.uCurr = this.uNext;
            this.uNext = tmp;
            this.uDisplay.set(this.uCurr);
            this.time += this.dt;
            this.stepCount++;
        }
        this._recordEnergy();
    }

    _recordEnergy() {
        if (this.dimension !== '1d') return;
        let Ek = 0, Ep = 0;
        for (let i = 1; i < this.nx; i++) {
            const ut = this.stepCount === 0 ? this._g1D(i * this.dx) : (this.uCurr[i] - this.uPrev[i]) / this.dt;
            const ux = (this.uDisplay[i + 1] - this.uDisplay[i - 1]) / (2 * this.dx);
            Ek += 0.5 * ut * ut * this.dx;
            Ep += 0.5 * this.c * this.c * ux * ux * this.dx;
        }
        const h = this.energyHistory;
        h.t.push(this.time);
        h.Ek.push(Ek);
        h.Ep.push(Ep);
        h.Etot.push(Ek + Ep);
        if (h.t.length > 300) {
            h.t.shift(); h.Ek.shift(); h.Ep.shift(); h.Etot.shift();
        }
    }

    // Odd (Dirichlet) or Even (Neumann) 2L-periodic extension for D'Alembert waves
    _extendedF(s) {
        const L = this.L;
        const P = 2 * L;
        let m = ((s % P) + P) % P;
        if (m <= L) return this._f1D(m);
        const mirrored = P - m;
        return this.bcType === 'dirichlet' ? -this._f1D(mirrored) : this._f1D(mirrored);
    }

    getDAlembertComponents() {
        if (this.dimension !== '1d') return null;
        const uR = new Float64Array(this.nx + 1);
        const uL = new Float64Array(this.nx + 1);
        const ct = this.c * this.time;
        for (let i = 0; i <= this.nx; i++) {
            const x = i * this.dx;
            uR[i] = 0.5 * this._extendedF(x - ct);
            uL[i] = 0.5 * this._extendedF(x + ct);
        }
        return { uR, uL };
    }

    getXArray() {
        const arr = new Array(this.nx + 1);
        for (let i = 0; i <= this.nx; i++) arr[i] = i * this.dx;
        return arr;
    }

    get1DProfile() {
        if (this.dimension === '1d') return Array.from(this.uDisplay);
        const midJ = Math.floor(this.ny / 2);
        const out = new Array(this.nx + 1);
        for (let i = 0; i <= this.nx; i++) out[i] = this.uDisplay[this.idx(i, midJ)];
        return out;
    }

    get2DGrid() {
        const grid = [];
        for (let j = 0; j <= this.ny; j++) {
            const row = new Array(this.nx + 1);
            for (let i = 0; i <= this.nx; i++) row[i] = this.uDisplay[this.idx(i, j)];
            grid.push(row);
        }
        return grid;
    }
}
