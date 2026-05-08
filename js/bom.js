const DEFAULT_BOM = [
    { id: 'Chair', level: 0, qty: 1, parent: null, unitCost: 0, leadTime: 1 },
    { id: 'Seat Assembly', level: 1, qty: 1, parent: 'Chair', unitCost: 15, leadTime: 2 },
    { id: 'Seat Cushion', level: 2, qty: 1, parent: 'Seat Assembly', unitCost: 10, leadTime: 1 },
    { id: 'Seat Frame', level: 2, qty: 1, parent: 'Seat Assembly', unitCost: 5, leadTime: 3 },
    { id: 'Back Assembly', level: 1, qty: 1, parent: 'Chair', unitCost: 20, leadTime: 2 },
    { id: 'Back Cushion', level: 2, qty: 1, parent: 'Back Assembly', unitCost: 12, leadTime: 1 },
    { id: 'Back Frame', level: 2, qty: 1, parent: 'Back Assembly', unitCost: 8, leadTime: 3 },
    { id: 'Legs', level: 1, qty: 4, parent: 'Chair', unitCost: 5, leadTime: 2 },
    { id: 'Rubber Caps', level: 2, qty: 1, parent: 'Legs', unitCost: 1, leadTime: 1 }
];

let bomData = [];
let currentBOMData = {}; // mapped for modal

document.addEventListener('DOMContentLoaded', () => {
    loadBOM();
    setupTabs();
    setupListeners();
    renderBuilder();
    calculateBOM();

    if (typeof initExportDropdown === 'function') {
        initExportDropdown(() => {
            if (!currentBOMData) return null;
            const csvData = [["Component", "Level", "Parent", "Qty per Parent", "Total Qty Needed", "Total Cost"]];
            Object.keys(currentBOMData).forEach(id => {
                const d = currentBOMData[id];
                csvData.push([
                    id, d.level, (d.parent || "-"), d.qtyPerParent, d.totalQty, (d.level === 0 ? "-" : d.totalCost)
                ]);
            });
            return csvData;
        });
    }
});

function loadBOM() {
    const saved = localStorage.getItem('om_custom_bom');
    if (saved) {
        bomData = JSON.parse(saved);
    } else {
        bomData = JSON.parse(JSON.stringify(DEFAULT_BOM));
    }
}

function saveBOM() {
    localStorage.setItem('om_custom_bom', JSON.stringify(bomData));
    renderBuilder();
    calculateBOM();
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
    document.getElementById('bom-demand').addEventListener('input', calculateBOM);
    document.getElementById('btn-add-component').addEventListener('click', addComponent);
    document.getElementById('btn-reset-bom').addEventListener('click', () => {
        bomData = JSON.parse(JSON.stringify(DEFAULT_BOM));
        saveBOM();
    });
}

function renderBuilder() {
    // Populate parent dropdown
    const select = document.getElementById('bom-add-parent');
    select.innerHTML = '<option value="">None (End Item)</option>';
    bomData.forEach(item => {
        select.innerHTML += `<option value="${item.id}">${item.id} (Level ${item.level})</option>`;
    });

    // Populate builder table
    const tbody = document.getElementById('bom-builder-tbody');
    tbody.innerHTML = '';
    bomData.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${item.id}</td>
                <td>${item.parent || '-'}</td>
                <td>${item.qty}</td>
                <td>${item.leadTime} wk</td>
                <td>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="removeComponent(${index})" ${item.level === 0 ? 'disabled title="Cannot remove end item"' : ''}>
                        <i data-lucide="trash-2" style="margin:0; width:14px; height:14px; color:#ef4444;"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    lucide.createIcons();
    renderVisualTree();
}

function addComponent() {
    const id = document.getElementById('bom-add-name').value.trim();
    const parentId = document.getElementById('bom-add-parent').value;
    const qty = parseInt(document.getElementById('bom-add-qty').value) || 1;
    const leadTime = parseInt(document.getElementById('bom-add-lt').value) || 1;
    const unitCost = parseFloat(document.getElementById('bom-add-cost').value) || 0;

    if (!id) return alert("Component Name is required.");
    if (bomData.some(b => b.id.toLowerCase() === id.toLowerCase())) return alert("Component Name already exists.");

    let level = 0;
    if (parentId) {
        const parent = bomData.find(b => b.id === parentId);
        level = parent.level + 1;
    } else {
        // If no parent, it's a new end item. Let's restrict to 1 end item for simplicity in this version
        if (bomData.some(b => b.level === 0)) {
            return alert("An End Item (Level 0) already exists. Please select a parent.");
        }
    }

    bomData.push({ id, level, qty, parent: parentId || null, unitCost, leadTime });
    
    // Sort array so parents always appear before children
    bomData.sort((a, b) => a.level - b.level);
    
    document.getElementById('bom-add-name').value = '';
    document.getElementById('bom-add-cost').value = '0';
    saveBOM();
}

function removeComponent(index) {
    if (bomData[index].level === 0) return;
    const itemId = bomData[index].id;
    // Check if it has children
    const hasChildren = bomData.some(b => b.parent === itemId);
    if (hasChildren) {
        if(!confirm(`Warning: This will also remove all sub-components of ${itemId}. Continue?`)) return;
    }
    
    // Recursive remove
    const removeRecursive = (id) => {
        const children = bomData.filter(b => b.parent === id);
        bomData = bomData.filter(b => b.id !== id);
        children.forEach(c => removeRecursive(c.id));
    };
    
    removeRecursive(itemId);
    saveBOM();
}

function renderVisualTree() {
    const container = document.getElementById('bom-visual-tree');
    container.innerHTML = '';
    
    if (bomData.length === 0) {
        container.innerHTML = "<p style='padding: 24px;'>No components defined.</p>";
        return;
    }

    // Prepare hierarchical data
    const rootItem = bomData.find(b => b.level === 0);
    if (!rootItem) return;

    function buildHierarchy(parentId) {
        const children = bomData.filter(b => b.parent === parentId);
        if (children.length === 0) return null;
        return children.map(c => ({
            name: c.id,
            qty: c.qty,
            lt: c.leadTime,
            cost: c.unitCost,
            children: buildHierarchy(c.id)
        }));
    }

    const treeData = {
        name: rootItem.id,
        qty: rootItem.qty,
        lt: rootItem.leadTime,
        cost: rootItem.unitCost,
        children: buildHierarchy(rootItem.id)
    };

    // D3 Setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const margin = {top: 40, right: 90, bottom: 50, left: 90};

    const svg = d3.select("#bom-visual-tree")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const treeLayout = d3.tree().size([width - margin.left - margin.right, height - margin.top - margin.bottom]);
    const root = d3.hierarchy(treeData);
    treeLayout(root);

    // Draw Links
    svg.selectAll(".link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", "var(--border-color)")
        .attr("stroke-width", 2)
        .attr("d", d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y)
        );

    // Draw Nodes
    const nodes = svg.selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    // Node Box
    nodes.append("rect")
        .attr("x", -60)
        .attr("y", -25)
        .attr("width", 120)
        .attr("height", 50)
        .attr("rx", 8)
        .attr("fill", d => d.depth === 0 ? "var(--accent-blue)" : "var(--primary-bg)")
        .attr("stroke", d => d.depth === 0 ? "var(--accent-blue)" : "var(--border-color)")
        .attr("stroke-width", 2)
        .style("filter", "drop-shadow(0 4px 6px rgba(0,0,0,0.1))");

    // Node Text (Name)
    nodes.append("text")
        .attr("dy", "-5")
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", d => d.depth === 0 ? "#fff" : "var(--text-primary)")
        .text(d => d.data.name);

    // Node Text (Details)
    nodes.append("text")
        .attr("dy", "12")
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", d => d.depth === 0 ? "rgba(255,255,255,0.8)" : "var(--text-secondary)")
        .text(d => `Qty: ${d.data.qty} | LT: ${d.data.lt}w`);
}

function calculateBOM() {
    const demand = parseInt(document.getElementById('bom-demand').value) || 0;
    const tbody = document.getElementById('bom-tbody');
    tbody.innerHTML = '';

    let totals = {};
    let itemData = {};
    let grandTotalCost = 0;
    
    const root = bomData.find(b => b.level === 0);
    if(root) totals[root.id] = demand;

    bomData.forEach(item => {
        let totalQty = 0;
        let parentTotal = 0;
        
        if (item.level === 0) {
            totalQty = demand;
        } else {
            parentTotal = totals[item.parent] || 0;
            totalQty = parentTotal * item.qty;
            totals[item.id] = totalQty;
        }
        
        let itemTotalCost = totalQty * item.unitCost;
        if (item.level > 0) grandTotalCost += itemTotalCost;

        itemData[item.id] = {
            level: item.level,
            parent: item.parent,
            qtyPerParent: item.qty,
            totalQty: totalQty,
            parentTotal: parentTotal,
            unitCost: item.unitCost,
            totalCost: itemTotalCost
        };

        let padding = item.level * 20;
        let icon = item.level === 0 ? 'package' : 'corner-down-right';
        
        tbody.innerHTML += `
            <tr>
                <td style="padding-left: ${padding}px"><i data-lucide="${icon}" style="width: 16px; height: 16px; margin-right: 8px; vertical-align: middle;"></i>${item.id}</td>
                <td>Level ${item.level}</td>
                <td>${item.level === 0 ? '-' : item.qty}</td>
                <td class="cell-interactive" style="font-weight: bold; color: var(--accent-blue);" onclick="showStep('Qty', '${item.id}')">${totalQty.toLocaleString()}</td>
                <td class="cell-interactive" onclick="showStep('Cost', '${item.id}')">${item.level === 0 ? '-' : `$${itemTotalCost.toLocaleString()}`}</td>
            </tr>
        `;
    });
    
    currentBOMData = itemData;
    document.getElementById('bom-total-cost').innerText = `$${grandTotalCost.toLocaleString()}`;
    lucide.createIcons();
}

function showStep(metric, itemId) {
    const d = currentBOMData[itemId];
    if (!d || d.level === 0) return;
    
    const modal = document.getElementById('stepModal');
    const content = document.getElementById('stepModalContent');
    
    let html = `<h4>${metric} Calculation for ${itemId}</h4><hr style="margin: 12px 0; border-color: var(--border-color);">`;
    
    if (metric === 'Qty') {
        html += `
            <p><strong>Parent Item:</strong> ${d.parent}</p>
            <p><strong>Total Parent Quantity Needed:</strong> ${d.parentTotal}</p>
            <p><strong>Quantity per Parent (Multiplier):</strong> ${d.qtyPerParent}</p>
            <p><strong>Formula:</strong> Total Parent Quantity × Multiplier</p>
            <p><strong>Calculation:</strong> ${d.parentTotal} × ${d.qtyPerParent}</p>
            <p><strong>Result:</strong> ${d.totalQty} units</p>
        `;
    } else if (metric === 'Cost') {
        html += `
            <p><strong>Formula:</strong> Total Quantity Required × Unit Cost</p>
            <p><strong>Total Quantity Needed:</strong> ${d.totalQty}</p>
            <p><strong>Unit Cost:</strong> $${d.unitCost}</p>
            <p><strong>Calculation:</strong> ${d.totalQty} × $${d.unitCost}</p>
            <p><strong>Result:</strong> $${d.totalCost.toLocaleString()}</p>
        `;
    }
    
    content.innerHTML = html;
    modal.classList.add('active');
}
