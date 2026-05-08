let appChartInstance = null;
let currentAppData = null;
const baseDemand = [200, 250, 300, 280, 200, 150, 200, 250, 300, 280, 200, 150];

document.addEventListener('DOMContentLoaded', () => {
    populateComponentSelector();
    setupTabs();
    setupChart();
    setupListeners();
    loadComponentState();

    if (typeof initExportDropdown === 'function') {
        initExportDropdown(() => {
            if (!currentAppData) return null;
            const d = currentAppData;
            const csvData = [["Period", "Demand", "Reg Prod", "Subcontract", "Inventory", "Hires/Fires", "Total Cost ($)"]];
            for (let i = 0; i < d.periods; i++) {
                csvData.push([
                    `P${i+1}`, d.demand[i], d.production[i], d.subcontract[i], d.inventory[i], 
                    (d.hires[i] > 0 ? `+${d.hires[i]}H` : (d.fires[i] > 0 ? `-${d.fires[i]}F` : "-")),
                    d.costs.total[i]
                ]);
            }
            return csvData;
        });
    }
});

function populateComponentSelector() {
    const selector = document.getElementById('app-component-selector');
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
    const selector = document.getElementById('app-component-selector');
    if (!selector) return;
    const compName = selector.value;
    
    const saved = localStorage.getItem(`om_app_${compName}`);
    if (saved) {
        const d = JSON.parse(saved);
        document.getElementById('app-strategy').value = d.strategy;
        document.getElementById('app-periods').value = d.periods;
        document.getElementById('cost-reg').value = d.costReg;
        document.getElementById('cost-sub').value = d.costSub;
        document.getElementById('cost-hold').value = d.costHold;
        document.getElementById('cost-hire').value = d.costHire;
        document.getElementById('cost-fire').value = d.costFire;
        document.getElementById('app-init-workers').value = d.initWorkers;
        document.getElementById('app-units-worker').value = d.unitsPerWorker;
        document.getElementById('app-init-inv').value = d.initInv;
        
        if (d.strategy === 'custom') {
            document.getElementById('app-custom-strategy-container').style.display = 'block';
            renderCustomConfig(d.production, d.subcontract); // Need to pass to render
        } else {
            document.getElementById('app-custom-strategy-container').style.display = 'none';
        }
    } else {
        // Reset to defaults if no save exists
        document.getElementById('app-strategy').value = 'level';
        document.getElementById('app-periods').value = '6';
        document.getElementById('cost-reg').value = '10';
        document.getElementById('cost-sub').value = '25';
        document.getElementById('cost-hold').value = '2';
        document.getElementById('cost-hire').value = '300';
        document.getElementById('cost-fire').value = '500';
        document.getElementById('app-init-workers').value = '10';
        document.getElementById('app-units-worker').value = '20';
        document.getElementById('app-init-inv').value = '50';
        document.getElementById('app-custom-strategy-container').style.display = 'none';
    }
    
    renderCustomConfig();
    computeAPP();
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

function setupChart() {
    const ctx = document.getElementById('appChart').getContext('2d');
    appChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Demand',
                    data: [],
                    type: 'line',
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    fill: false
                },
                {
                    label: 'Reg Production',
                    data: [],
                    backgroundColor: '#3b82f6'
                },
                {
                    label: 'Subcontract',
                    data: [],
                    backgroundColor: '#f59e0b'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function setupListeners() {
    document.getElementById('btn-compute-app').addEventListener('click', computeAPP);
    
    if (document.getElementById('app-component-selector')) {
        document.getElementById('app-component-selector').addEventListener('change', loadComponentState);
    }

    document.getElementById('app-strategy').addEventListener('change', (e) => {
        const container = document.getElementById('app-custom-strategy-container');
        if (e.target.value === 'custom') {
            container.style.display = 'block';
            renderCustomConfig();
        } else {
            container.style.display = 'none';
        }
        computeAPP();
    });
    
    document.getElementById('app-periods').addEventListener('change', () => {
        renderCustomConfig();
        computeAPP();
    });
    
    document.getElementById('btn-verify-manual-app').addEventListener('click', verifyManualAPP);
    document.getElementById('btn-clear-manual-app').addEventListener('click', renderManualTable);
}

function renderCustomConfig(savedProd = null, savedSub = null) {
    const periods = parseInt(document.getElementById('app-periods').value) || 6;
    const thead = document.getElementById('app-custom-thead');
    const tbody = document.getElementById('app-custom-tbody');
    
    let th = '<tr><th>Metric</th>';
    for(let i=1; i<=periods; i++) th += `<th>P${i}</th>`;
    th += '</tr>';
    thead.innerHTML = th;
    
    let existingReg = savedProd || Array.from(document.querySelectorAll('.app-cust-reg')).map(n => n.value);
    let existingSub = savedSub || Array.from(document.querySelectorAll('.app-cust-sub')).map(n => n.value);
    
    let dRow = '<tr><td>Demand</td>';
    let pRow = '<tr><td>Reg Prod</td>';
    let sRow = '<tr><td>Subcontract</td>';
    
    for(let i=0; i<periods; i++) {
        let dVal = baseDemand[i] || 200;
        let rVal = existingReg[i] !== undefined ? existingReg[i] : dVal;
        let sVal = existingSub[i] !== undefined ? existingSub[i] : 0;
        
        dRow += `<td>${dVal}</td>`;
        pRow += `<td><input type="number" class="form-control app-cust-reg" value="${rVal}" style="width:60px; padding:2px;"></td>`;
        sRow += `<td><input type="number" class="form-control app-cust-sub" value="${sVal}" style="width:60px; padding:2px;"></td>`;
    }
    
    tbody.innerHTML = dRow + '</tr>' + pRow + '</tr>' + sRow + '</tr>';
}

function computeAPP() {
    const strategy = document.getElementById('app-strategy').value;
    const periods = parseInt(document.getElementById('app-periods').value) || 6;
    
    const costReg = parseFloat(document.getElementById('cost-reg').value);
    const costSub = parseFloat(document.getElementById('cost-sub').value);
    const costHold = parseFloat(document.getElementById('cost-hold').value);
    const costHire = parseFloat(document.getElementById('cost-hire').value);
    const costFire = parseFloat(document.getElementById('cost-fire').value);
    
    const initWorkers = parseInt(document.getElementById('app-init-workers').value);
    const unitsPerWorker = parseInt(document.getElementById('app-units-worker').value);
    const initInv = parseInt(document.getElementById('app-init-inv').value);

    let demand = baseDemand.slice(0, periods);
    
    // Arrays for tracking
    let production = new Array(periods).fill(0);
    let subcontract = new Array(periods).fill(0);
    let workers = new Array(periods).fill(0);
    let inventory = new Array(periods).fill(0);
    let hires = new Array(periods).fill(0);
    let fires = new Array(periods).fill(0);
    
    let currentWorkers = initWorkers;
    let currentInv = initInv;

    // Calculate Average Demand for Level
    const totalDemand = demand.reduce((a, b) => a + b, 0);
    const netDemand = totalDemand - initInv;
    const levelProdRate = Math.ceil(netDemand / periods);
    const levelWorkers = Math.ceil(levelProdRate / unitsPerWorker);
    
    if (strategy === 'level') {
        for (let i = 0; i < periods; i++) {
            workers[i] = levelWorkers;
            production[i] = workers[i] * unitsPerWorker;
            subcontract[i] = 0;
            
            hires[i] = (i === 0 && levelWorkers > initWorkers) ? (levelWorkers - initWorkers) : 0;
            fires[i] = (i === 0 && levelWorkers < initWorkers) ? (initWorkers - levelWorkers) : 0;
            
            inventory[i] = currentInv + production[i] - demand[i];
            // If negative, we force subcontract to cover backlog (Level strategy failsafe)
            if (inventory[i] < 0) {
                subcontract[i] = Math.abs(inventory[i]);
                inventory[i] = 0; // Backlog covered by subcontracting
            }
            currentInv = inventory[i];
            currentWorkers = workers[i];
        }
    } else if (strategy === 'chase') {
        for (let i = 0; i < periods; i++) {
            let reqProd = demand[i] - currentInv; // Use up inventory
            if(reqProd < 0) reqProd = 0;
            
            let reqWorkers = Math.ceil(reqProd / unitsPerWorker);
            workers[i] = reqWorkers;
            production[i] = reqWorkers * unitsPerWorker;
            subcontract[i] = 0;
            
            hires[i] = (workers[i] > currentWorkers) ? (workers[i] - currentWorkers) : 0;
            fires[i] = (workers[i] < currentWorkers) ? (currentWorkers - workers[i]) : 0;
            
            inventory[i] = currentInv + production[i] - demand[i];
            currentInv = inventory[i];
            currentWorkers = workers[i];
        }
    } else if (strategy === 'custom') {
        const custReg = Array.from(document.querySelectorAll('.app-cust-reg')).map(n => parseInt(n.value) || 0);
        const custSub = Array.from(document.querySelectorAll('.app-cust-sub')).map(n => parseInt(n.value) || 0);
        
        for (let i = 0; i < periods; i++) {
            production[i] = custReg[i];
            subcontract[i] = custSub[i];
            workers[i] = Math.ceil(production[i] / unitsPerWorker);
            
            hires[i] = (workers[i] > currentWorkers) ? (workers[i] - currentWorkers) : 0;
            fires[i] = (workers[i] < currentWorkers) ? (currentWorkers - workers[i]) : 0;
            
            inventory[i] = currentInv + production[i] + subcontract[i] - demand[i];
            currentInv = inventory[i];
            currentWorkers = workers[i];
        }
    }

    // Calculate Costs
    let costs = {
        reg: production.map(p => p * costReg),
        sub: subcontract.map(s => s * costSub),
        hold: inventory.map(inv => Math.max(0, inv) * costHold), // only hold positive
        hire: hires.map(h => h * costHire),
        fire: fires.map(f => f * costFire),
        total: new Array(periods).fill(0)
    };
    
    let grandTotal = 0;
    for (let i = 0; i < periods; i++) {
        costs.total[i] = costs.reg[i] + costs.sub[i] + costs.hold[i] + costs.hire[i] + costs.fire[i];
        grandTotal += costs.total[i];
    }
    
    currentAppData = {
        strategy, periods, demand, production, subcontract, workers, inventory,
        hires, fires, costs, costReg, costSub, costHold, costHire, costFire, initInv, initWorkers, unitsPerWorker
    };

    const compName = document.getElementById('app-component-selector') ? document.getElementById('app-component-selector').value : 'Chair';
    localStorage.setItem(`om_app_${compName}`, JSON.stringify(currentAppData));

    renderTable();
    updateChart(demand, production, subcontract, periods);
    document.getElementById('app-total-cost').innerText = `$${grandTotal.toLocaleString()}`;
    
    if (document.getElementById('tab-manual').classList.contains('active')) {
        renderManualTable();
    }
}

function renderTable() {
    const d = currentAppData;
    const tbody = document.getElementById('app-tbody');
    tbody.innerHTML = '';
    
    for (let i = 0; i < d.periods; i++) {
        let hrstr = '';
        if(d.hires[i] > 0) hrstr = `<span style="color:var(--accent-blue);">+${d.hires[i]}H</span>`;
        if(d.fires[i] > 0) hrstr = `<span style="color:var(--accent-red);">-${d.fires[i]}F</span>`;
        if(d.hires[i]===0 && d.fires[i]===0) hrstr = '-';
        
        let subStr = d.subcontract[i] > 0 ? `<br><small style="color:var(--accent-purple);">+${d.subcontract[i]} Sub</small>` : '';

        tbody.innerHTML += `
            <tr>
                <td>P${i + 1}</td>
                <td>${d.demand[i]}</td>
                <td>${d.production[i]} ${subStr}</td>
                <td class="cell-interactive" onclick="showStep('Inventory', ${i})">${d.inventory[i]}</td>
                <td>${hrstr}</td>
                <td class="cell-interactive" onclick="showStep('Cost', ${i})">$${d.costs.total[i].toLocaleString()}</td>
            </tr>
        `;
    }
}

function updateChart(demand, prod, sub, periods) {
    let labels = [];
    for(let i=1; i<=periods; i++) labels.push(`P${i}`);
    
    appChartInstance.data.labels = labels;
    appChartInstance.data.datasets[0].data = demand;
    appChartInstance.data.datasets[1].data = prod;
    appChartInstance.data.datasets[2].data = sub;
    appChartInstance.update();
}

function showStep(metric, i) {
    const d = currentAppData;
    const modal = document.getElementById('stepModal');
    const content = document.getElementById('stepModalContent');
    const pStr = `Period ${i + 1}`;
    
    let html = `<h4>${metric} Calculation for ${pStr}</h4><hr style="margin: 12px 0; border-color: var(--border-color);">`;
    
    if (metric === 'Cost') {
        html += `
            <p><strong>Regular Production:</strong> ${d.production[i]} units × $${d.costReg} = $${d.costs.reg[i].toLocaleString()}</p>
        `;
        if (d.subcontract[i] > 0) {
            html += `<p><strong>Subcontracting:</strong> ${d.subcontract[i]} units × $${d.costSub} = $${d.costs.sub[i].toLocaleString()}</p>`;
        }
        html += `
            <p><strong>Inventory Holding:</strong> ${Math.max(0, d.inventory[i])} units × $${d.costHold} = $${d.costs.hold[i].toLocaleString()}</p>
            <p><strong>Hiring:</strong> ${d.hires[i]} workers × $${d.costHire} = $${d.costs.hire[i].toLocaleString()}</p>
            <p><strong>Firing:</strong> ${d.fires[i]} workers × $${d.costFire} = $${d.costs.fire[i].toLocaleString()}</p>
            <hr style="margin: 8px 0; border-color: var(--border-color);">
            <p><strong>Total Cost:</strong> $${d.costs.total[i].toLocaleString()}</p>
        `;
    } else if (metric === 'Inventory') {
        let startInv = i === 0 ? d.initInv : d.inventory[i-1];
        html += `
            <p><strong>Formula:</strong> Starting Inventory + Production + Subcontracting - Demand</p>
            <p><strong>Starting Inventory:</strong> ${startInv}</p>
            <p><strong>Production:</strong> ${d.production[i]}</p>
            <p><strong>Subcontracting:</strong> ${d.subcontract[i]}</p>
            <p><strong>Demand:</strong> ${d.demand[i]}</p>
            <p><strong>Calculation:</strong> ${startInv} + ${d.production[i]} + ${d.subcontract[i]} - ${d.demand[i]}</p>
            <p><strong>Ending Inventory:</strong> ${d.inventory[i]} ${d.inventory[i] < 0 ? '(Backlog)' : ''}</p>
        `;
    }
    
    content.innerHTML = html;
    modal.classList.add('active');
}

function renderManualTable() {
    if(!currentAppData) return;
    const d = currentAppData;
    
    // Populate summary
    const summaryDiv = document.getElementById('app-manual-inputs-summary');
    if(summaryDiv) {
        summaryDiv.innerHTML = `
            <div class="grid-3" style="font-size: 0.9rem;">
                <div><strong>Strategy:</strong> <span style="color: var(--accent-blue); text-transform: capitalize;">${d.strategy}</span></div>
                <div><strong>Initial Inventory:</strong> ${d.initInv}</div>
                <div><strong>Initial Workers:</strong> ${d.initWorkers}</div>
                <div><strong>Reg Cost:</strong> $${d.costReg}</div>
                <div><strong>Subcontract Cost:</strong> $${d.costSub}</div>
                <div><strong>Holding Cost:</strong> $${d.costHold}</div>
                <div><strong>Hiring Cost:</strong> $${d.costHire}</div>
                <div><strong>Firing Cost:</strong> $${d.costFire}</div>
                <div><strong>Units/Worker:</strong> ${d.unitsPerWorker}</div>
            </div>
        `;
    }

    const thead = document.getElementById('app-manual-thead');
    const tbody = document.getElementById('app-manual-tbody');
    
    let ths = '<th>Metric / Period</th>';
    for(let i=0; i<d.periods; i++) ths += `<th>P${i+1}</th>`;
    thead.innerHTML = ths;
    
    let dRow = `<tr><td><strong>Demand</strong></td>${d.demand.map(x=>`<td>${x}</td>`).join('')}</tr>`;
    
    let pRow = `<tr><td><strong>Production (Reg)</strong></td>`;
    let sRow = `<tr><td><strong>Subcontract</strong></td>`;
    let iRow = `<tr><td><strong>Inventory</strong></td>`;
    let cRow = `<tr><td><strong>Total Cost ($)</strong></td>`;
    
    for(let i=0; i<d.periods; i++) {
        pRow += `<td><input type="number" class="form-control man-app-prod" style="width:70px; padding:4px;"></td>`;
        sRow += `<td><input type="number" class="form-control man-app-sub" style="width:70px; padding:4px;"></td>`;
        iRow += `<td><input type="number" class="form-control man-app-inv" style="width:70px; padding:4px;"></td>`;
        cRow += `<td><input type="number" class="form-control man-app-cost" style="width:70px; padding:4px;"></td>`;
    }
    
    tbody.innerHTML = dRow + pRow + '</tr>' + sRow + '</tr>' + iRow + '</tr>' + cRow + '</tr>';
}

function verifyManualAPP() {
    if(!currentAppData) return;
    const d = currentAppData;
    
    const pInputs = document.querySelectorAll('.man-app-prod');
    const sInputs = document.querySelectorAll('.man-app-sub');
    const iInputs = document.querySelectorAll('.man-app-inv');
    const cInputs = document.querySelectorAll('.man-app-cost');
    
    let allCorrect = true;
    
    for(let i=0; i<d.periods; i++) {
        let pVal = parseInt(pInputs[i].value);
        let sVal = parseInt(sInputs[i].value) || 0;
        let iVal = parseInt(iInputs[i].value);
        let cVal = parseInt(cInputs[i].value);
        
        pInputs[i].className = 'form-control man-app-prod ' + (pVal === d.production[i] ? 'input-correct' : 'input-incorrect');
        sInputs[i].className = 'form-control man-app-sub ' + (sVal === d.subcontract[i] ? 'input-correct' : 'input-incorrect');
        iInputs[i].className = 'form-control man-app-inv ' + (iVal === d.inventory[i] ? 'input-correct' : 'input-incorrect');
        cInputs[i].className = 'form-control man-app-cost ' + (cVal === d.costs.total[i] ? 'input-correct' : 'input-incorrect');
        
        if (pVal !== d.production[i] || sVal !== d.subcontract[i] || iVal !== d.inventory[i] || cVal !== d.costs.total[i]) allCorrect = false;
    }
    
    if (allCorrect) alert("Outstanding! Your manual APP calculations match the system perfectly.");
}
