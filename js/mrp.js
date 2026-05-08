let bomData = [];
let mrpConfigs = {}; // Store configs (on hand, lot rule) per item
let mrpResults = {}; // Store computed MRP records per item
let currentViewItem = null;

document.addEventListener('DOMContentLoaded', () => {
    loadBOM();
    setupTabs();
    setupListeners();
    renderSetup();
});

function loadBOM() {
    const saved = localStorage.getItem('om_custom_bom');
    if (saved) {
        bomData = JSON.parse(saved);
    } else {
        bomData = []; // Require user to build BOM if empty
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
        });
    });
}

function setupListeners() {
    document.getElementById('btn-explode-mrp').addEventListener('click', explodeMRP);
    document.getElementById('mrp-view-selector').addEventListener('change', (e) => {
        currentViewItem = e.target.value;
        renderGrid();
    });
    document.getElementById('mrp-manual-selector').addEventListener('change', (e) => {
        currentViewItem = e.target.value;
        renderManualTable();
    });
    document.getElementById('btn-verify-manual-mrp').addEventListener('click', verifyManualMRP);
}

function renderSetup() {
    const tbody = document.getElementById('mrp-config-tbody');
    if (bomData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No BOM found. Please go to the BOM module to build your product structure.</td></tr>';
        document.getElementById('btn-explode-mrp').disabled = true;
        return;
    }
    document.getElementById('btn-explode-mrp').disabled = false;

    let html = '';
    bomData.forEach(item => {
        // Initialize config
        mrpConfigs[item.id] = {
            onHand: 0,
            lotRule: 'l4l',
            fixedQty: 50,
            leadTime: item.leadTime // Pulled from BOM
        };
        
        let padding = item.level * 20;
        let icon = item.level === 0 ? 'package' : 'corner-down-right';
        
        html += `
            <tr data-id="${item.id}">
                <td style="padding-left: ${padding}px"><i data-lucide="${icon}" style="width: 16px; height: 16px; margin-right: 8px; vertical-align: middle;"></i>${item.id} (L${item.level})</td>
                <td>${item.leadTime}</td>
                <td>
                    <select class="form-control cfg-rule" style="min-width: 120px;" onchange="updateConfig('${item.id}', 'lotRule', this.value)">
                        <option value="l4l">Lot-for-Lot</option>
                        <option value="fixed">Fixed</option>
                    </select>
                </td>
                <td><input type="number" class="form-control cfg-fixed" value="50" style="width: 80px;" onchange="updateConfig('${item.id}', 'fixedQty', this.value)"></td>
                <td><input type="number" class="form-control cfg-onhand" value="0" style="width: 80px;" onchange="updateConfig('${item.id}', 'onHand', this.value)"></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    
    // Populate selectors immediately
    const selectors = ['mrp-view-selector', 'mrp-manual-selector'];
    selectors.forEach(selId => {
        const sel = document.getElementById(selId);
        if (sel) {
            sel.innerHTML = '';
            bomData.forEach(item => {
                sel.innerHTML += `<option value="${item.id}">${item.id} (L${item.level})</option>`;
            });
        }
    });
    
    lucide.createIcons();
}

function updateConfig(id, key, val) {
    if (key === 'lotRule') mrpConfigs[id][key] = val;
    else mrpConfigs[id][key] = parseInt(val) || 0;
}

function explodeMRP() {
    const demand = parseInt(document.getElementById('mrp-master-demand').value) || 0;
    const duePeriod = parseInt(document.getElementById('mrp-master-period').value) || 8;
    const periods = parseInt(document.getElementById('mrp-periods').value) || 8;
    
    // Reset results
    mrpResults = {};
    bomData.forEach(item => {
        mrpResults[item.id] = {
            gr: new Array(periods).fill(0),
            sr: new Array(periods).fill(0), // Simplified: no SR for now
            poh: new Array(periods).fill(0),
            nr: new Array(periods).fill(0),
            porc: new Array(periods).fill(0),
            porl: new Array(periods).fill('')
        };
    });

    // 1. Set Master Demand for Level 0 items
    const rootItems = bomData.filter(b => b.level === 0);
    rootItems.forEach(root => {
        if (duePeriod - 1 >= 0 && duePeriod - 1 < periods) {
            mrpResults[root.id].gr[duePeriod - 1] = demand;
        }
    });

    // 2. Process Level by Level
    const maxLevel = Math.max(...bomData.map(b => b.level));
    
    for (let lvl = 0; lvl <= maxLevel; lvl++) {
        const itemsAtLevel = bomData.filter(b => b.level === lvl);
        
        itemsAtLevel.forEach(item => {
            const id = item.id;
            const res = mrpResults[id];
            const cfg = mrpConfigs[id];
            
            let currentInv = cfg.onHand;

            for (let i = 0; i < periods; i++) {
                let netReq = res.gr[i] - currentInv - res.sr[i];
                if (netReq > 0) {
                    res.nr[i] = netReq;
                    if (cfg.lotRule === 'l4l') {
                        res.porc[i] = netReq;
                    } else {
                        let multiplier = Math.ceil(netReq / cfg.fixedQty);
                        res.porc[i] = multiplier * cfg.fixedQty;
                    }
                } else {
                    res.nr[i] = 0;
                    res.porc[i] = 0;
                }

                res.poh[i] = currentInv + res.sr[i] + res.porc[i] - res.gr[i];
                currentInv = res.poh[i]; 
                
                if (res.porc[i] > 0) {
                    let releasePeriod = i - cfg.leadTime;
                    if (releasePeriod >= 0) {
                        res.porl[releasePeriod] = res.porc[i];
                        
                        // EXPLOSION: Pass gross requirements down to children
                        const children = bomData.filter(b => b.parent === id);
                        children.forEach(child => {
                            // Add to child's gross requirement in the release period
                            mrpResults[child.id].gr[releasePeriod] += (res.porc[i] * child.qty);
                        });
                        
                    } else {
                        res.porl[0] = `Past(${res.porc[i]})`; 
                    }
                }
            }
        });
    }

    // Populate selectors
    const selectors = ['mrp-view-selector', 'mrp-manual-selector'];
    selectors.forEach(selId => {
        const sel = document.getElementById(selId);
        sel.innerHTML = '';
        bomData.forEach(item => {
            sel.innerHTML += `<option value="${item.id}">${item.id} (L${item.level})</option>`;
        });
    });

    currentViewItem = bomData[0].id; // Select first item
    
    // Switch to Solve tab
    document.querySelectorAll('.tab-btn')[2].click();
    
    alert("BOM Exploded Successfully!");
}

function renderGrid() {
    if (!currentViewItem || !mrpResults[currentViewItem]) return;
    
    const periods = parseInt(document.getElementById('mrp-periods').value) || 8;
    const thead = document.getElementById('mrp-thead');
    const tbody = document.getElementById('mrp-tbody');
    const res = mrpResults[currentViewItem];
    
    let th = '<tr><th>Week</th>';
    for(let i=1; i<=periods; i++) th += `<th>${i}</th>`;
    th += '</tr>';
    thead.innerHTML = th;
    
    let grRow = '<tr><td>Gross Requirements</td>';
    let srRow = '<tr><td>Scheduled Receipts</td>';
    let pohRow = '<tr style="background: var(--accent-blue-light);"><td>Projected On Hand</td>';
    let nrRow = '<tr><td>Net Requirements</td>';
    let porcRow = '<tr style="background: var(--accent-green-light);"><td>Planned Order Receipts</td>';
    let porlRow = '<tr style="background: var(--accent-purple-light); font-weight: bold;"><td>Planned Order Releases</td>';
    
    for(let i=0; i<periods; i++) {
        grRow += `<td class="cell-interactive" onclick="showStep('GR', ${i})">${res.gr[i]}</td>`;
        srRow += `<td>${res.sr[i]}</td>`; // SR is static for now
        pohRow += `<td class="cell-interactive" onclick="showStep('POH', ${i})">${res.poh[i]}</td>`;
        nrRow += `<td class="cell-interactive" onclick="showStep('NR', ${i})">${res.nr[i] > 0 ? res.nr[i] : ''}</td>`;
        porcRow += `<td class="cell-interactive" onclick="showStep('PORC', ${i})">${res.porc[i] > 0 ? res.porc[i] : ''}</td>`;
        porlRow += `<td class="cell-interactive" onclick="showStep('PORL', ${i})">${res.porl[i] !== '' ? res.porl[i] : ''}</td>`;
    }
    
    grRow += '</tr>'; srRow += '</tr>'; pohRow += '</tr>'; nrRow += '</tr>'; porcRow += '</tr>'; porlRow += '</tr>';
    tbody.innerHTML = grRow + srRow + pohRow + nrRow + porcRow + porlRow;
}

function showStep(metric, i) {
    if (!currentViewItem) return;
    const res = mrpResults[currentViewItem];
    const cfg = mrpConfigs[currentViewItem];
    const periods = res.gr.length;
    
    const modal = document.getElementById('stepModal');
    const content = document.getElementById('stepModalContent');
    const pStr = `Week ${i + 1}`;
    
    let html = `<h4>${metric} for ${currentViewItem} in ${pStr}</h4><hr style="margin: 12px 0; border-color: var(--border-color);">`;
    let startInv = i === 0 ? cfg.onHand : res.poh[i-1];

    if (metric === 'GR') {
        const itemObj = bomData.find(b => b.id === currentViewItem);
        if (itemObj.level === 0) {
            html += `<p><strong>Source:</strong> Master Demand entered in Setup.</p>`;
        } else {
            html += `
                <p><strong>Source:</strong> Exploded from Parent Item (${itemObj.parent}).</p>
                <p><strong>Logic:</strong> Any Planned Order Release for the parent in this week is multiplied by the Quantity per Parent (${itemObj.qty}).</p>
                <p><strong>Result:</strong> ${res.gr[i]}</p>
            `;
        }
    } else if (metric === 'NR') {
        html += `
            <p><strong>Formula:</strong> Gross Requirements - Starting Inventory - Scheduled Receipts</p>
            <p><strong>Values:</strong> ${res.gr[i]} - ${startInv} - ${res.sr[i]}</p>
            <p><strong>Calculation:</strong> ${res.gr[i] - startInv - res.sr[i]}</p>
            <p><strong>Result:</strong> ${res.nr[i]} (Floored at 0)</p>
        `;
    } else if (metric === 'PORC') {
        if (res.nr[i] === 0) {
            html += `<p><strong>Logic:</strong> No Net Requirement, so no receipt needed.</p>`;
        } else {
            if (cfg.lotRule === 'l4l') {
                html += `<p><strong>Lot Sizing Rule:</strong> Lot-for-Lot (L4L). Order exactly what is required: ${res.nr[i]}</p>`;
            } else {
                let multiplier = Math.ceil(res.nr[i] / cfg.fixedQty);
                html += `
                    <p><strong>Lot Sizing Rule:</strong> Fixed (${cfg.fixedQty})</p>
                    <p><strong>Calculation:</strong> ceil(${res.nr[i]} / ${cfg.fixedQty}) = ${multiplier} lots.</p>
                    <p><strong>Result:</strong> ${multiplier} × ${cfg.fixedQty} = ${res.porc[i]}</p>
                `;
            }
        }
    } else if (metric === 'POH') {
        html += `
            <p><strong>Formula:</strong> Starting Inv + Scheduled Rec + Planned Order Rec - Gross Req</p>
            <p><strong>Calculation:</strong> ${startInv} + ${res.sr[i]} + ${res.porc[i]} - ${res.gr[i]}</p>
            <p><strong>Result:</strong> ${res.poh[i]}</p>
        `;
    } else if (metric === 'PORL') {
        html += `
            <p><strong>Lead Time:</strong> ${cfg.leadTime} weeks</p>
            <p><strong>Logic:</strong> Planned Order Receipts scheduled for Week ${i + 1 + cfg.leadTime} are released now.</p>
            <p><strong>Result:</strong> ${res.porl[i] !== '' ? res.porl[i] : 'None'}</p>
        `;
    }
    
    content.innerHTML = html;
    modal.classList.add('active');
}

function renderManualTable() {
    if(!currentViewItem || !mrpResults[currentViewItem]) return;
    const res = mrpResults[currentViewItem];
    const periods = res.gr.length;
    
    const thead = document.getElementById('mrp-manual-thead');
    const tbody = document.getElementById('mrp-manual-tbody');
    
    let ths = '<tr><th>Metric / Week</th>';
    for(let i=0; i<periods; i++) ths += `<th>${i+1}</th>`;
    ths += '</tr>';
    thead.innerHTML = ths;
    
    let html = `
        <tr><td><strong>Gross Requirements (Given)</strong></td>${res.gr.map(x=>`<td>${x}</td>`).join('')}</tr>
        <tr><td><strong>Scheduled Receipts (Given)</strong></td>${res.sr.map(x=>`<td>${x}</td>`).join('')}</tr>
        <tr><td><strong>Projected On Hand</strong></td>
    `;
    for(let i=0; i<periods; i++) html += `<td><input type="number" class="form-control man-mrp-poh" style="min-width: 50px; padding: 4px;"></td>`;
    html += `</tr><tr><td><strong>Net Requirements</strong></td>`;
    for(let i=0; i<periods; i++) html += `<td><input type="number" class="form-control man-mrp-nr" style="min-width: 50px; padding: 4px;"></td>`;
    html += `</tr><tr><td><strong>Planned Order Receipts</strong></td>`;
    for(let i=0; i<periods; i++) html += `<td><input type="number" class="form-control man-mrp-porc" style="min-width: 50px; padding: 4px;"></td>`;
    html += `</tr><tr><td><strong>Planned Order Releases</strong></td>`;
    for(let i=0; i<periods; i++) html += `<td><input type="text" class="form-control man-mrp-porl" style="min-width: 50px; padding: 4px;"></td>`;
    html += `</tr>`;
    
    tbody.innerHTML = html;
}

function verifyManualMRP() {
    if(!currentViewItem || !mrpResults[currentViewItem]) return;
    const res = mrpResults[currentViewItem];
    const periods = res.gr.length;
    
    const pInputs = document.querySelectorAll('.man-mrp-poh');
    const nInputs = document.querySelectorAll('.man-mrp-nr');
    const cInputs = document.querySelectorAll('.man-mrp-porc');
    const lInputs = document.querySelectorAll('.man-mrp-porl');
    
    let allCorrect = true;
    
    for(let i=0; i<periods; i++) {
        let pVal = parseInt(pInputs[i].value);
        let nVal = parseInt(nInputs[i].value) || 0;
        let cVal = parseInt(cInputs[i].value) || 0;
        let lValStr = lInputs[i].value.trim();
        let lVal = lValStr === '' ? '' : (isNaN(lValStr) ? lValStr : parseInt(lValStr));
        
        pInputs[i].className = 'form-control man-mrp-poh ' + (pVal === res.poh[i] ? 'input-correct' : 'input-incorrect');
        nInputs[i].className = 'form-control man-mrp-nr ' + (nVal === res.nr[i] ? 'input-correct' : 'input-incorrect');
        cInputs[i].className = 'form-control man-mrp-porc ' + (cVal === res.porc[i] ? 'input-correct' : 'input-incorrect');
        lInputs[i].className = 'form-control man-mrp-porl ' + (lVal === res.porl[i] ? 'input-correct' : 'input-incorrect');
        
        if (pVal !== res.poh[i] || nVal !== res.nr[i] || cVal !== res.porc[i] || lVal !== res.porl[i]) allCorrect = false;
    }
    
    if (allCorrect) alert("Perfect! Your MRP calculations are exactly correct.");
}
