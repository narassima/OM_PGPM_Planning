let currentMPSData = null;
const baseForecast = [30, 30, 30, 30, 40, 40, 40, 40, 50, 50, 50, 50];
const baseCO = [33, 20, 10, 4, 2, 0, 0, 0, 0, 0, 0, 0];

document.addEventListener('DOMContentLoaded', () => {
    populateComponentSelector();
    setupTabs();
    setupListeners();
    loadComponentState();
});

function populateComponentSelector() {
    const selector = document.getElementById('mps-component-selector');
    if (!selector) return;
    
    const saved = localStorage.getItem('om_custom_bom');
    let bom = saved ? JSON.parse(saved) : null;
    
    selector.innerHTML = '';
    
    if (bom && bom.length > 0) {
        bom.forEach(comp => {
            const opt = document.createElement('option');
            opt.value = comp.id;
            opt.innerText = comp.id;
            selector.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = 'Chair';
        opt.innerText = 'Chair (Default)';
        selector.appendChild(opt);
    }
}

function loadComponentState() {
    const selector = document.getElementById('mps-component-selector');
    if (!selector) return;
    const compName = selector.value;
    
    const saved = localStorage.getItem(`om_mps_${compName}`);
    if (saved) {
        const d = JSON.parse(saved);
        document.getElementById('mps-onhand').value = d.onHand;
        document.getElementById('mps-lotsize').value = d.lotSize;
        document.getElementById('mps-periods').value = d.periods;
        renderGrid(d.f, d.co);
    } else {
        // Reset defaults
        document.getElementById('mps-onhand').value = '64';
        document.getElementById('mps-lotsize').value = '70';
        document.getElementById('mps-periods').value = '8';
        renderGrid(null, null);
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`tab-${e.target.getAttribute('data-tab')}`).classList.add('active');
            
            if (e.target.getAttribute('data-tab') === 'manual') {
                renderManualTable();
            }
        });
    });
}

function setupListeners() {
    if (document.getElementById('mps-component-selector')) {
        document.getElementById('mps-component-selector').addEventListener('change', loadComponentState);
    }
    
    document.getElementById('btn-recalc-mps').addEventListener('click', () => {
        renderGrid();
    });
    
    document.getElementById('btn-verify-manual-mps').addEventListener('click', verifyManualMPS);
    document.getElementById('btn-clear-manual-mps').addEventListener('click', renderManualTable);
}

function renderGrid() {
    const periods = parseInt(document.getElementById('mps-periods').value) || 8;
    const thead = document.getElementById('mps-thead');
    const tbody = document.getElementById('mps-tbody');
    
    let th = '<tr><th>Week</th>';
    for(let i=1; i<=periods; i++) th += `<th>${i}</th>`;
    th += '</tr>';
    thead.innerHTML = th;
    
    // Check if we already have values, else use base
    let existingF = Array.from(document.querySelectorAll('.mps-f')).map(n => n.value);
    let existingCO = Array.from(document.querySelectorAll('.mps-co')).map(n => n.value);
    
    let fRow = '<tr><td>Forecast</td>';
    let coRow = '<tr><td>Customer Orders</td>';
    let pohRow = '<tr style="background: var(--accent-blue-light);"><td>Projected On-Hand</td>';
    let mpsRow = '<tr style="background: var(--accent-green-light);"><td>MPS</td>';
    let atpRow = '<tr style="background: var(--accent-purple-light); font-weight: bold;"><td>ATP</td>';
    
    for(let i=0; i<periods; i++) {
        let fVal = existingF[i] !== undefined ? existingF[i] : baseForecast[i] || 0;
        let coVal = existingCO[i] !== undefined ? existingCO[i] : baseCO[i] || 0;
        
        fRow += `<td><input type="number" class="form-control mps-f" value="${fVal}" onchange="calculateMPS()"></td>`;
        coRow += `<td><input type="number" class="form-control mps-co" value="${coVal}" onchange="calculateMPS()"></td>`;
        
        pohRow += `<td class="mps-poh cell-interactive" onclick="showStep('POH', ${i})"></td>`;
        mpsRow += `<td class="mps-mps cell-interactive" onclick="showStep('MPS', ${i})"></td>`;
        atpRow += `<td class="mps-atp cell-interactive" onclick="showStep('ATP', ${i})"></td>`;
    }
    
    fRow += '</tr>'; coRow += '</tr>'; pohRow += '</tr>'; mpsRow += '</tr>'; atpRow += '</tr>';
    tbody.innerHTML = fRow + coRow + pohRow + mpsRow + atpRow;
    
    calculateMPS();
}

function calculateMPS() {
    const onHand = parseInt(document.getElementById('mps-onhand').value) || 0;
    const lotSize = parseInt(document.getElementById('mps-lotsize').value) || 70;
    const periods = parseInt(document.getElementById('mps-periods').value) || 8;
    
    let fNodes = document.querySelectorAll('.mps-f');
    let coNodes = document.querySelectorAll('.mps-co');
    
    let f = Array.from(fNodes).map(n => parseInt(n.value) || 0);
    let co = Array.from(coNodes).map(n => parseInt(n.value) || 0);
    
    let poh = new Array(periods).fill(0);
    let mps = new Array(periods).fill(0);
    let atp = new Array(periods).fill('');

    for (let i = 0; i < periods; i++) {
        let req = Math.max(f[i], co[i]);
        let startInv = (i === 0) ? onHand : poh[i - 1];

        if (startInv < req) {
            mps[i] = lotSize;
        } else {
            mps[i] = 0;
        }

        poh[i] = startInv + mps[i] - req;
    }

    // ATP logic
    for (let i = 0; i < periods; i++) {
        if (i === 0 || mps[i] > 0) {
            let available = (i === 0) ? (onHand + mps[0]) : mps[i];
            let consumed = co[i];
            let lookaheadStr = `CO(${i+1})`;
            
            let j = i + 1;
            while (j < periods && mps[j] === 0) {
                consumed += co[j];
                lookaheadStr += ` + CO(${j+1})`;
                j++;
            }
            
            atp[i] = available - consumed;
        }
    }
    
    currentMPSData = { periods, onHand, lotSize, f, co, poh, mps, atp };

    const compName = document.getElementById('mps-component-selector') ? document.getElementById('mps-component-selector').value : 'Chair';
    localStorage.setItem(`om_mps_${compName}`, JSON.stringify(currentMPSData));

    const pohNodes = document.querySelectorAll('.mps-poh');
    const mpsNodes = document.querySelectorAll('.mps-mps');
    const atpNodes = document.querySelectorAll('.mps-atp');
    
    for (let i = 0; i < periods; i++) {
        pohNodes[i].innerText = poh[i];
        mpsNodes[i].innerText = mps[i] > 0 ? mps[i] : '';
        atpNodes[i].innerText = atp[i] !== '' ? atp[i] : '';
    }
}

function showStep(metric, i) {
    const d = currentMPSData;
    const modal = document.getElementById('stepModal');
    const content = document.getElementById('stepModalContent');
    const pStr = `Week ${i + 1}`;
    
    let html = `<h4>${metric} Calculation for ${pStr}</h4><hr style="margin: 12px 0; border-color: var(--border-color);">`;
    
    if (metric === 'POH') {
        let start = i === 0 ? d.onHand : d.poh[i-1];
        let req = Math.max(d.f[i], d.co[i]);
        let reason = d.f[i] > d.co[i] ? `Forecast (${d.f[i]}) > CO (${d.co[i]})` : `CO (${d.co[i]}) >= Forecast (${d.f[i]})`;
        
        html += `
            <p><strong>Formula:</strong> Starting Inventory + MPS - Max(Forecast, Customer Orders)</p>
            <p><strong>Starting Inventory:</strong> ${start}</p>
            <p><strong>Requirement:</strong> ${req} (because ${reason})</p>
            <p><strong>MPS:</strong> ${d.mps[i]}</p>
            <p><strong>Calculation:</strong> ${start} + ${d.mps[i]} - ${req}</p>
            <p><strong>Result:</strong> ${d.poh[i]}</p>
        `;
    } else if (metric === 'MPS') {
        let start = i === 0 ? d.onHand : d.poh[i-1];
        let req = Math.max(d.f[i], d.co[i]);
        if (start < req) {
            html += `
                <p><strong>Logic:</strong> Starting inventory (${start}) is less than the requirement (${req}).</p>
                <p><strong>Action:</strong> Trigger production of Lot Size = ${d.lotSize}.</p>
            `;
        } else {
            html += `
                <p><strong>Logic:</strong> Starting inventory (${start}) is sufficient to cover the requirement (${req}).</p>
                <p><strong>Action:</strong> No production needed (MPS = 0).</p>
            `;
        }
    } else if (metric === 'ATP') {
        if (i > 0 && d.mps[i] === 0) {
            html += `<p><strong>Logic:</strong> ATP is only calculated in Week 1 and any week where MPS is scheduled. Since MPS is 0 here, ATP is left blank.</p>`;
        } else {
            let available = i === 0 ? (d.onHand + d.mps[0]) : d.mps[i];
            let consumed = d.co[i];
            let lookStr = `${d.co[i]}`;
            
            let j = i + 1;
            while (j < d.periods && d.mps[j] === 0) {
                consumed += d.co[j];
                lookStr += ` + ${d.co[j]}`;
                j++;
            }
            
            html += `
                <p><strong>Formula:</strong> Available - Sum of Customer Orders before next MPS</p>
                <p><strong>Available:</strong> ${i === 0 ? `On-Hand (${d.onHand}) + MPS (${d.mps[0]}) = ${available}` : `MPS (${available})`}</p>
                <p><strong>Customer Orders (Look-ahead):</strong> ${lookStr} = ${consumed}</p>
                <p><strong>Calculation:</strong> ${available} - ${consumed}</p>
                <p><strong>Result:</strong> ${d.atp[i]}</p>
            `;
        }
    }
    
    content.innerHTML = html;
    modal.classList.add('active');
}

function renderManualTable() {
    if(!currentMPSData) return;
    const d = currentMPSData;
    const thead = document.getElementById('mps-manual-thead');
    const tbody = document.getElementById('mps-manual-tbody');
    
    let ths = '<tr><th>Metric / Week</th>';
    for(let i=0; i<d.periods; i++) ths += `<th>${i+1}</th>`;
    ths += '</tr>';
    thead.innerHTML = ths;
    
    let html = `
        <tr><td><strong>Forecast</strong></td>${d.f.map(x=>`<td>${x}</td>`).join('')}</tr>
        <tr><td><strong>Customer Orders</strong></td>${d.co.map(x=>`<td>${x}</td>`).join('')}</tr>
        <tr><td><strong>Projected On-Hand</strong></td>
    `;
    for(let i=0; i<d.periods; i++) html += `<td><input type="number" class="form-control man-mps-poh" style="min-width: 60px;"></td>`;
    html += `</tr><tr><td><strong>MPS</strong></td>`;
    for(let i=0; i<d.periods; i++) html += `<td><input type="number" class="form-control man-mps-mps" style="min-width: 60px;"></td>`;
    html += `</tr><tr><td><strong>ATP (Leave blank if none)</strong></td>`;
    for(let i=0; i<d.periods; i++) html += `<td><input type="number" class="form-control man-mps-atp" style="min-width: 60px;"></td>`;
    html += `</tr>`;
    
    tbody.innerHTML = html;
}

function verifyManualMPS() {
    if(!currentMPSData) return;
    const d = currentMPSData;
    
    const pInputs = document.querySelectorAll('.man-mps-poh');
    const mInputs = document.querySelectorAll('.man-mps-mps');
    const aInputs = document.querySelectorAll('.man-mps-atp');
    
    let allCorrect = true;
    
    for(let i=0; i<d.periods; i++) {
        let pVal = parseInt(pInputs[i].value);
        let mVal = parseInt(mInputs[i].value) || 0;
        let aVal = aInputs[i].value.trim() === '' ? '' : parseInt(aInputs[i].value);
        
        let expectedMPS = d.mps[i];
        let expectedATP = d.atp[i];
        
        pInputs[i].className = 'form-control man-mps-poh ' + (pVal === d.poh[i] ? 'input-correct' : 'input-incorrect');
        mInputs[i].className = 'form-control man-mps-mps ' + (mVal === expectedMPS ? 'input-correct' : 'input-incorrect');
        aInputs[i].className = 'form-control man-mps-atp ' + (aVal === expectedATP ? 'input-correct' : 'input-incorrect');
        
        if (pVal !== d.poh[i] || mVal !== expectedMPS || aVal !== expectedATP) allCorrect = false;
    }
    
    if (allCorrect) alert("Excellent! Your Master Production Schedule is perfectly accurate.");
}
