let chartInstance = null;
let currentCapData = null;

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupChart();
    setupListeners();
    calculateCapacity();
    
    // Initialize Export
    if (typeof initExportDropdown === 'function') {
        initExportDropdown(() => {
            if (!currentCapData) return null;
            const d = currentCapData;
            return [
                ["Metric", "Value"],
                ["Shifts per Day", d.shifts],
                ["Hours per Shift", d.hours],
                ["Days per Week", d.days],
                ["Output Rate (Units/Hr)", d.rate],
                ["Design Capacity (Units/Wk)", d.design],
                ["Effective Capacity (Units/Wk)", d.effective.toFixed(0)],
                ["Actual Output (Units/Wk)", d.actual],
                ["Utilization (%)", d.util.toFixed(1)],
                ["Efficiency (%)", d.eff.toFixed(1)]
            ];
        });
    }
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`tab-${e.target.getAttribute('data-tab')}`).classList.add('active');
        });
    });
}

function setupChart() {
    const ctx = document.getElementById('capacityChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Design', 'Effective', 'Actual (Good)'],
            datasets: [{
                label: 'Units per Week',
                data: [0, 0, 0],
                backgroundColor: ['#e2e8f0', '#93c5fd', '#34d399'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

function setupListeners() {
    document.getElementById('btn-calc-cap').addEventListener('click', calculateCapacity);
}

function calculateCapacity() {
    const shifts = parseInt(document.getElementById('cap-shifts').value) || 1;
    const hours = parseInt(document.getElementById('cap-hours').value) || 8;
    const days = parseInt(document.getElementById('cap-days').value) || 5;
    const rate = parseInt(document.getElementById('cap-rate').value) || 50;
    
    const maint = parseFloat(document.getElementById('cap-maint').value) || 0;
    const setup = parseFloat(document.getElementById('cap-setup').value) || 0;
    const downPct = parseFloat(document.getElementById('cap-down').value) || 0;
    const defectPct = parseFloat(document.getElementById('cap-defect').value) || 0;
    
    const actual = parseInt(document.getElementById('cap-actual').value) || 0;

    // 1. Total available hours per week
    const totalHours = shifts * hours * days;
    
    // 2. Design Capacity
    const design = totalHours * rate;
    
    // 3. Effective Hours (Total - Planned Maintenance - Setup)
    const effectiveHours = totalHours - maint - setup;
    
    // 4. Effective Capacity
    // Apply unplanned downtime to effective hours
    const operatingHours = effectiveHours * (1 - (downPct / 100));
    
    // Factor in defects (Yield) to get good effective capacity
    const effective = operatingHours * rate * (1 - (defectPct / 100));

    if (actual > design) {
        alert("Warning: Actual output cannot logically exceed Design capacity without overtime.");
    }

    const util = (actual / design) * 100;
    const eff = (actual / effective) * 100;

    document.getElementById('res-utilization').innerText = util.toFixed(1) + '%';
    document.getElementById('res-efficiency').innerText = eff.toFixed(1) + '%';

    chartInstance.data.datasets[0].data = [design, effective, actual];
    chartInstance.update();
    
    currentCapData = { 
        shifts, hours, days, rate, 
        maint, setup, downPct, defectPct, 
        totalHours, effectiveHours, operatingHours,
        design, effective, actual, util, eff 
    };
}

function showStepModal() {
    if (!currentCapData) return;
    const d = currentCapData;
    const modal = document.getElementById('stepModal');
    const content = document.getElementById('stepModalContent');
    
    let html = `
        <div style="margin-bottom: 16px;">
            <h4 style="color: var(--accent-blue);">1. Design Capacity</h4>
            <p><strong>Formula:</strong> (Shifts × Hours × Days) × Output Rate</p>
            <p><strong>Calculation:</strong> (${d.shifts} × ${d.hours} × ${d.days}) = ${d.totalHours} hrs/week</p>
            <p><strong>Design Capacity:</strong> ${d.totalHours} hrs × ${d.rate} units/hr = <strong>${d.design.toLocaleString()}</strong> units/week</p>
        </div>
        <hr style="border-color: var(--border-color); margin: 16px 0;">
        <div style="margin-bottom: 16px;">
            <h4 style="color: var(--accent-blue);">2. Effective Capacity (OEE Model)</h4>
            <p><strong>A. Planned Deductions:</strong> Subtract Maintenance (${d.maint}h) and Setups (${d.setup}h)</p>
            <p><em>Effective Hours:</em> ${d.totalHours} - ${d.maint} - ${d.setup} = ${d.effectiveHours} hrs</p>
            
            <p><strong>B. Unplanned Downtime:</strong> Apply Downtime (${d.downPct}%)</p>
            <p><em>Operating Hours:</em> ${d.effectiveHours} × (1 - ${d.downPct/100}) = ${d.operatingHours.toFixed(1)} hrs</p>
            
            <p><strong>C. Quality Yield:</strong> Apply Defect Rate (${d.defectPct}%)</p>
            <p><em>Effective Capacity:</em> (${d.operatingHours.toFixed(1)} hrs × ${d.rate} units/hr) × (1 - ${d.defectPct/100})</p>
            <p><strong>Result:</strong> <strong>${d.effective.toLocaleString(undefined, {maximumFractionDigits:0})}</strong> good units/week</p>
        </div>
        <hr style="border-color: var(--border-color); margin: 16px 0;">
        <div style="margin-bottom: 16px;">
            <h4 style="color: var(--accent-blue);">3. Utilization</h4>
            <p><strong>Formula:</strong> (Actual Good Output / Design Capacity) × 100</p>
            <p><strong>Calculation:</strong> (${d.actual} / ${d.design}) × 100</p>
            <p><strong>Result:</strong> <strong>${d.util.toFixed(1)}%</strong></p>
        </div>
        <hr style="border-color: var(--border-color); margin: 16px 0;">
        <div>
            <h4 style="color: var(--accent-blue);">4. Efficiency</h4>
            <p><strong>Formula:</strong> (Actual Good Output / Effective Capacity) × 100</p>
            <p><strong>Calculation:</strong> (${d.actual} / ${d.effective.toFixed(0)}) × 100</p>
            <p><strong>Result:</strong> <strong>${d.eff.toFixed(1)}%</strong></p>
        </div>
    `;
    
    content.innerHTML = html;
    modal.classList.add('active');
}
