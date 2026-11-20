/**
 * Interactive 1D & 2D Heat Equation Solver
 * ∂u/∂t = β∇²u + f(x, y, t)
 * Supports Dirichlet, Neumann (flux), and Robin (Newton cooling) BCs.
 */

class HeatSolver {
    constructor(config = {}) {
        this.beta = config.beta ?? 0.01;
        this.L = 1.0;
        this.dimension = config.dimension ?? '1d';
        this.nx = this.dimension === '1d' ? 180 : 60;
        this.ny = this.dimension === '2d' ? 60 : 1;
        this.dx = this.L / this.nx;
        this.dy = this.dimension === '2d' ? this.L / this.ny : this.dx;

        this.bcType = config.bcType ?? 'dirichlet';
        this.bcParams = Object.assign({}, config.bcParams ?? {});
        this._fillDefaultBC();

        this.icType = config.icType ?? 'sine';
        this.forcingType = config.forcingType ?? 'none';

        this._computeDt();

        this.time = 0;
        this.stepCount = 0;
        this.steady = false;
        this.maxChange = Infinity;
        this.uMin = 0;
        this.uMax = 1;
        this.initialUMax = 1;
        this.initialUMin = 0;

        this._init();
    }

    _fillDefaultBC() {
        const p = this.bcParams;
        if (this.bcType === 'dirichlet' || this.bcType === 'neumann') {
            if (p.left === undefined) p.left = 0;
            if (p.right === undefined) p.right = 0;
            if (p.top === undefined) p.top = 0;
            if (p.bottom === undefined) p.bottom = 0;
        } else if (this.bcType === 'robin') {
            if (p.h === undefined) p.h = 5.0;
            if (p.uAmbient === undefined) p.uAmbient = 0;
        }
    }

    _computeDt() {
        const safety = 0.4;
        if (this.dimension === '1d') {
            this.dt = safety * this.dx * this.dx / (2 * this.beta);
        } else {
            const d = Math.min(this.dx, this.dy);
            this.dt = safety * d * d / (4 * this.beta);
        }
    }

    _init() {
        const size = this.dimension === '1d' ? this.nx + 1 : (this.nx + 1) * (this.ny + 1);
        this.u = new Float64Array(size);
        this.uTmp = new Float64Array(size);
        this._applyIC();
        this._applyBC(this.u);
        this._updateRange();
        this.initialUMax = this.uMax;
        this.initialUMin = this.uMin;
    }

    idx(i, j) {
        return j * (this.nx + 1) + i;
    }

    _applyIC() {
        if (this.dimension === '1d') {
            for (let i = 0; i <= this.nx; i++) this.u[i] = this._ic1D(i * this.dx);
        } else {
            for (let j = 0; j <= this.ny; j++) {
                for (let i = 0; i <= this.nx; i++) {
                    this.u[this.idx(i, j)] = this._ic2D(i * this.dx, j * this.dy);
                }
            }
        }
    }

    _ic1D(x) {
        const L = this.L;
        switch (this.icType) {
            case 'sine': return Math.sin(Math.PI * x / L);
            case 'harmonics': {
                const v = 0.5 * Math.sin(2 * Math.PI * x / L) - 0.7 * Math.sin(5 * Math.PI * x / L);
                return Math.max(0, v + 0.6);
            }
            case 'gaussian': return Math.exp(-60 * (x - L / 2) ** 2);
            case 'step': return x < L / 2 ? 1.0 : 0.0;
            case 'triangle': return x <= L / 2 ? (2 * x / L) : (2 * (L - x) / L);
            default: return Math.sin(Math.PI * x / L);
        }
    }

    _ic2D(x, y) {
        const L = this.L;
        switch (this.icType) {
            case 'sine': return Math.sin(Math.PI * x / L) * Math.sin(Math.PI * y / L);
            case 'harmonics': {
                const v1 = Math.sin(2 * Math.PI * x / L) * Math.sin(2 * Math.PI * y / L);
                const v2 = 0.5 * Math.sin(4 * Math.PI * x / L) * Math.sin(4 * Math.PI * y / L);
                return Math.max(0, 0.5 * (v1 - v2) + 0.5);
            }
            case 'gaussian': return Math.exp(-60 * ((x - L / 2) ** 2 + (y - L / 2) ** 2));
            case 'step': return (x > L * 0.25 && x < L * 0.75 && y > L * 0.25 && y < L * 0.75) ? 1.0 : 0.0;
            case 'triangle': {
                const tx = 1 - Math.abs(2 * x / L - 1);
                const ty = 1 - Math.abs(2 * y / L - 1);
                return tx * ty;
            }
            default: return Math.sin(Math.PI * x / L) * Math.sin(Math.PI * y / L);
        }
    }

    _forcing1D(x) {
        const L = this.L;
        if (this.forcingType === 'center') return 4.0 * Math.exp(-150 * (x - L / 2) ** 2);
        if (this.forcingType === 'uniform') return 0.5;
        return 0;
    }

    _forcing2D(x, y) {
        const L = this.L;
        if (this.forcingType === 'center') return 6.0 * Math.exp(-150 * ((x - L / 2) ** 2 + (y - L / 2) ** 2));
        if (this.forcingType === 'uniform') return 0.6;
        return 0;
    }

    _applyBC(arr) {
        const p = this.bcParams;
        if (this.dimension === '1d') {
            if (this.bcType === 'dirichlet') {
                arr[0] = p.left;
                arr[this.nx] = p.right;
            } else if (this.bcType === 'neumann') {
                arr[0] = arr[1] + p.left * this.dx;
                arr[this.nx] = arr[this.nx - 1] + p.right * this.dx;
            } else if (this.bcType === 'robin') {
                const denom = 1 + p.h * this.dx;
                arr[0] = (arr[1] + p.h * this.dx * p.uAmbient) / denom;
                arr[this.nx] = (arr[this.nx - 1] + p.h * this.dx * p.uAmbient) / denom;
            }
        } else {
            const nx = this.nx, ny = this.ny;
            if (this.bcType === 'dirichlet') {
                for (let j = 0; j <= ny; j++) {
                    arr[this.idx(0, j)] = p.left;
                    arr[this.idx(nx, j)] = p.right;
                }
                for (let i = 0; i <= nx; i++) {
                    arr[this.idx(i, 0)] = p.bottom;
                    arr[this.idx(i, ny)] = p.top;
                }
            } else if (this.bcType === 'neumann') {
                for (let j = 0; j <= ny; j++) {
                    arr[this.idx(0, j)] = arr[this.idx(1, j)] + p.left * this.dx;
                    arr[this.idx(nx, j)] = arr[this.idx(nx - 1, j)] + p.right * this.dx;
                }
                for (let i = 0; i <= nx; i++) {
                    arr[this.idx(i, 0)] = arr[this.idx(i, 1)] + p.bottom * this.dy;
                    arr[this.idx(i, ny)] = arr[this.idx(i, ny - 1)] + p.top * this.dy;
                }
            } else if (this.bcType === 'robin') {
                const denomX = 1 + p.h * this.dx;
                const denomY = 1 + p.h * this.dy;
                for (let j = 0; j <= ny; j++) {
                    arr[this.idx(0, j)] = (arr[this.idx(1, j)] + p.h * this.dx * p.uAmbient) / denomX;
                    arr[this.idx(nx, j)] = (arr[this.idx(nx - 1, j)] + p.h * this.dx * p.uAmbient) / denomX;
                }
                for (let i = 0; i <= nx; i++) {
                    arr[this.idx(i, 0)] = (arr[this.idx(i, 1)] + p.h * this.dy * p.uAmbient) / denomY;
                    arr[this.idx(i, ny)] = (arr[this.idx(i, ny - 1)] + p.h * this.dy * p.uAmbient) / denomY;
                }
            }
        }
    }

    step(nSteps = 1) {
        if (this.steady) return;
        let maxDiff = 0;

        for (let s = 0; s < nSteps; s++) {
            maxDiff = 0;
            if (this.dimension === '1d') {
                const r = this.beta * this.dt / (this.dx * this.dx);
                for (let i = 1; i < this.nx; i++) {
                    const lap = this.u[i + 1] - 2 * this.u[i] + this.u[i - 1];
                    const f = this.forcingType !== 'none' ? this._forcing1D(i * this.dx) : 0;
                    const val = this.u[i] + r * lap + this.dt * f;
                    this.uTmp[i] = val;
                    const d = Math.abs(val - this.u[i]);
                    if (d > maxDiff) maxDiff = d;
                }
                this._applyBC(this.uTmp);
                const swap = this.u; this.u = this.uTmp; this.uTmp = swap;
            } else {
                const rx = this.beta * this.dt / (this.dx * this.dx);
                const ry = this.beta * this.dt / (this.dy * this.dy);
                const nx = this.nx, ny = this.ny;
                for (let j = 1; j < ny; j++) {
                    const y = j * this.dy;
                    for (let i = 1; i < nx; i++) {
                        const k = this.idx(i, j);
                        const lapX = this.u[k + 1] - 2 * this.u[k] + this.u[k - 1];
                        const lapY = this.u[k + nx + 1] - 2 * this.u[k] + this.u[k - nx - 1];
                        const f = this.forcingType !== 'none' ? this._forcing2D(i * this.dx, y) : 0;
                        const val = this.u[k] + rx * lapX + ry * lapY + this.dt * f;
                        this.uTmp[k] = val;
                        const d = Math.abs(val - this.u[k]);
                        if (d > maxDiff) maxDiff = d;
                    }
                }
                this._applyBC(this.uTmp);
                const swap = this.u; this.u = this.uTmp; this.uTmp = swap;
            }
            this.time += this.dt;
            this.stepCount++;
        }

        this.maxChange = maxDiff / this.dt;
        this._updateRange();
        if (this.stepCount > 80 && this.maxChange < 1e-4) {
            this.steady = true;
        }
    }

    _updateRange() {
        let mn = Infinity, mx = -Infinity;
        for (let i = 0; i < this.u.length; i++) {
            const v = this.u[i];
            if (v < mn) mn = v;
            if (v > mx) mx = v;
        }
        this.uMin = mn;
        this.uMax = mx;
    }

    getXArray() {
        const arr = new Array(this.nx + 1);
        for (let i = 0; i <= this.nx; i++) arr[i] = i * this.dx;
        return arr;
    }

    get1DProfile() {
        if (this.dimension === '1d') return Array.from(this.u);
        const midJ = Math.floor(this.ny / 2);
        const out = new Array(this.nx + 1);
        for (let i = 0; i <= this.nx; i++) out[i] = this.u[this.idx(i, midJ)];
        return out;
    }

    get2DGrid() {
        const grid = [];
        for (let j = 0; j <= this.ny; j++) {
            const row = new Array(this.nx + 1);
            for (let i = 0; i <= this.nx; i++) row[i] = this.u[this.idx(i, j)];
            grid.push(row);
        }
        return grid;
    }

    getFluxAt(xNorm, yNorm) {
        if (this.dimension === '1d') {
            const i = Math.max(1, Math.min(this.nx - 1, Math.round(xNorm * this.nx)));
            return { qx: -this.beta * (this.u[i + 1] - this.u[i - 1]) / (2 * this.dx), qy: 0 };
        }
        const i = Math.max(1, Math.min(this.nx - 1, Math.round(xNorm * this.nx)));
        const j = Math.max(1, Math.min(this.ny - 1, Math.round(yNorm * this.ny)));
        const qx = -this.beta * (this.u[this.idx(i + 1, j)] - this.u[this.idx(i - 1, j)]) / (2 * this.dx);
        const qy = -this.beta * (this.u[this.idx(i, j + 1)] - this.u[this.idx(i, j - 1)]) / (2 * this.dy);
        return { qx, qy };
    }
}
