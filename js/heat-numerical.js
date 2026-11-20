/**
 * 1D Numerical Heat Methods Laboratory (MTH G202 Weeks 6-7)
 * Compares Explicit FTCS, Simple Implicit BTCS, and Crank-Nicolson
 * side-by-side against the Analytical Fourier Exact Solution.
 */

function solveTridiagonal(a, b, c, d) {
    // Thomas algorithm (TDMA) for n x n tridiagonal system
    // a: sub-diagonal (a[0] unused), b: main diagonal, c: super-diagonal, d: RHS
    const n = d.length;
    const cPrime = new Float64Array(n);
    const dPrime = new Float64Array(n);
    const x = new Float64Array(n);

    cPrime[0] = c[0] / b[0];
    dPrime[0] = d[0] / b[0];

    for (let i = 1; i < n; i++) {
        const denom = b[i] - a[i] * cPrime[i - 1];
        cPrime[i] = i < n - 1 ? c[i] / denom : 0;
        dPrime[i] = (d[i] - a[i] * dPrime[i - 1]) / denom;
    }

    x[n - 1] = dPrime[n - 1];
    for (let i = n - 2; i >= 0; i--) {
        x[i] = dPrime[i] - cPrime[i] * x[i + 1];
    }
    return x;
}

class NumericalHeatLab {
    constructor(config = {}) {
        this.L = config.L ?? 1.0;
        this.beta = config.beta ?? 1.0;
        this.nx = config.nx ?? 10; // number of spatial intervals (nx+1 nodes, nx-1 interior)
        this.dt = config.dt ?? 0.01;
        this.icType = config.icType ?? 'sine'; // 'sine' | 'zero_rod' | 'step' | 'triangle'
        this.T0 = config.T0 ?? 0.0;
        this.TL = config.TL ?? 0.0;

        this.reset();
    }

    get dx() {
        return this.L / this.nx;
    }

    get lambda() {
        return (this.beta * this.dt) / (this.dx * this.dx);
    }

    reset() {
        this.stepCount = 0;
        this.time = 0;
        const N = this.nx + 1;
        this.x = new Array(N);
        for (let i = 0; i < N; i++) this.x[i] = i * this.dx;

        this.uFTCS = new Float64Array(N);
        this.uBTCS = new Float64Array(N);
        this.uCN = new Float64Array(N);
        this.uExact = new Float64Array(N);

        for (let i = 0; i < N; i++) {
            let val = this._ic(this.x[i]);
            if (i === 0) val = this.T0;
            if (i === N - 1) val = this.TL;
            this.uFTCS[i] = val;
            this.uBTCS[i] = val;
            this.uCN[i] = val;
            this.uExact[i] = val;
        }

        // Precompute Fourier coefficients for Exact solution of v(x,t) = u(x,t) - phi(x)
        // where phi(x) = T0 + (TL - T0)*(x/L)
        this._computeFourierCoeffs(60);

        this.historySteps = [0];
        this.errFTCS = [0];
        this.errBTCS = [0];
        this.errCN = [0];
        this.ftcsDiverged = false;
    }

    _ic(x) {
        const L = this.L;
        switch (this.icType) {
            case 'sine': return Math.sin(Math.PI * x / L);
            case 'zero_rod': return 0.0;
            case 'step': return x < L / 2 ? 1.0 : 0.0;
            case 'triangle': return x <= L / 2 ? (2 * x / L) : (2 * (L - x) / L);
            default: return Math.sin(Math.PI * x / L);
        }
    }

    _phi(x) {
        return this.T0 + (this.TL - this.T0) * (x / this.L);
    }

    _computeFourierCoeffs(nModes) {
        this.nModes = nModes;
        this.An = new Float64Array(nModes + 1);
        const M = 400; // Simpson / midpoint integration points
        const h = this.L / M;
        for (let n = 1; n <= nModes; n++) {
            let sum = 0;
            for (let k = 0; k < M; k++) {
                const xm = (k + 0.5) * h;
                const v0 = this._ic(xm) - this._phi(xm);
                sum += v0 * Math.sin(n * Math.PI * xm / this.L);
            }
            this.An[n] = (2 / this.L) * sum * h;
        }
    }

    exactAt(x, t) {
        if (t <= 0) {
            if (Math.abs(x) < 1e-12) return this.T0;
            if (Math.abs(x - this.L) < 1e-12) return this.TL;
            return this._ic(x);
        }
        if (this.icType === 'sine' && this.T0 === 0 && this.TL === 0) {
            return Math.exp(-this.beta * Math.pow(Math.PI / this.L, 2) * t) * Math.sin(Math.PI * x / this.L);
        }
        let s = this._phi(x);
        for (let n = 1; n <= this.nModes; n++) {
            const k = n * Math.PI / this.L;
            const decay = Math.exp(-this.beta * k * k * t);
            if (decay < 1e-14) break;
            s += this.An[n] * decay * Math.sin(k * x);
        }
        return s;
    }

    getFineExactCurve(numPts = 120) {
        const xs = new Array(numPts + 1);
        const ys = new Array(numPts + 1);
        for (let i = 0; i <= numPts; i++) {
            const xi = (i / numPts) * this.L;
            xs[i] = xi;
            ys[i] = this.exactAt(xi, this.time);
        }
        return { x: xs, y: ys };
    }

    step(nSteps = 1) {
        const m = this.nx - 1; // interior nodes
        if (m < 1) return;
        const lam = this.lambda;

        // Pre-build tridiagonal diagonals for BTCS and CN
        const aB = new Float64Array(m), bB = new Float64Array(m), cB = new Float64Array(m);
        const aC = new Float64Array(m), bC = new Float64Array(m), cC = new Float64Array(m);
        for (let i = 0; i < m; i++) {
            aB[i] = -lam; bB[i] = 1 + 2 * lam; cB[i] = -lam;
            aC[i] = -lam; bC[i] = 2 * (1 + lam); cC[i] = -lam;
        }
        aB[0] = 0; cB[m - 1] = 0;
        aC[0] = 0; cC[m - 1] = 0;

        for (let s = 0; s < nSteps; s++) {
            // 1. Explicit FTCS
            const nextFTCS = new Float64Array(this.nx + 1);
            nextFTCS[0] = this.T0;
            nextFTCS[this.nx] = this.TL;
            for (let i = 1; i < this.nx; i++) {
                let v = lam * this.uFTCS[i - 1] + (1 - 2 * lam) * this.uFTCS[i] + lam * this.uFTCS[i + 1];
                if (!Number.isFinite(v) || Math.abs(v) > 5000) {
                    v = Math.sign(v || 1) * 5000;
                    this.ftcsDiverged = true;
                }
                nextFTCS[i] = v;
            }
            this.uFTCS = nextFTCS;

            // 2. Simple Implicit BTCS
            const rhsB = new Float64Array(m);
            for (let i = 0; i < m; i++) rhsB[i] = this.uBTCS[i + 1];
            rhsB[0] += lam * this.T0;
            rhsB[m - 1] += lam * this.TL;
            const solB = solveTridiagonal(aB, bB, cB, rhsB);
            this.uBTCS[0] = this.T0;
            this.uBTCS[this.nx] = this.TL;
            for (let i = 0; i < m; i++) this.uBTCS[i + 1] = solB[i];

            // 3. Crank-Nicolson
            const rhsC = new Float64Array(m);
            for (let i = 0; i < m; i++) {
                const idx = i + 1;
                rhsC[i] = lam * this.uCN[idx - 1] + 2 * (1 - lam) * this.uCN[idx] + lam * this.uCN[idx + 1];
            }
            rhsC[0] += lam * this.T0;
            rhsC[m - 1] += lam * this.TL;
            const solC = solveTridiagonal(aC, bC, cC, rhsC);
            this.uCN[0] = this.T0;
            this.uCN[this.nx] = this.TL;
            for (let i = 0; i < m; i++) this.uCN[i + 1] = solC[i];

            // Advance time and evaluate exact
            this.stepCount++;
            this.time = this.stepCount * this.dt;

            let eF = 0, eB = 0, eC = 0;
            for (let i = 0; i <= this.nx; i++) {
                const ex = this.exactAt(this.x[i], this.time);
                this.uExact[i] = ex;
                eF = Math.max(eF, Math.abs(this.uFTCS[i] - ex));
                eB = Math.max(eB, Math.abs(this.uBTCS[i] - ex));
                eC = Math.max(eC, Math.abs(this.uCN[i] - ex));
            }
            this.historySteps.push(this.stepCount);
            this.errFTCS.push(eF);
            this.errBTCS.push(eB);
            this.errCN.push(eC);
            if (this.historySteps.length > 200) {
                this.historySteps.shift();
                this.errFTCS.shift();
                this.errBTCS.shift();
                this.errCN.shift();
            }
        }
    }
}
