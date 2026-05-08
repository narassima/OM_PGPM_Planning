/**
 * Global Export Utility for Production Planner
 * Handles CSV, Excel, and PDF exports
 */

function exportToCSV(data, filename) {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Check if data is an array of objects or an array of arrays
    if (Array.isArray(data[0])) {
        data.forEach(row => {
            csvContent += row.join(",") + "\n";
        });
    } else {
        // Headers
        const headers = Object.keys(data[0]);
        csvContent += headers.join(",") + "\n";
        
        // Rows
        data.forEach(obj => {
            csvContent += headers.map(h => obj[h]).join(",") + "\n";
        });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToExcel(data, filename) {
    // Simple HTML table conversion for Excel compatibility
    let html = '<table>';
    
    if (Array.isArray(data[0])) {
        data.forEach(row => {
            html += '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
        });
    } else {
        const headers = Object.keys(data[0]);
        html += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
        data.forEach(obj => {
            html += '<tr>' + headers.map(h => `<td>${obj[h]}</td>`).join('') + '</tr>';
        });
    }
    html += '</table>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename + ".xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToPDF() {
    window.print();
}

/**
 * Injects the Export Dropdown into the header
 */
function initExportDropdown(exportCallback) {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown';
    dropdown.innerHTML = `
        <button class="btn btn-secondary dropdown-toggle">
            <i data-lucide="download"></i> Download <i data-lucide="chevron-down"></i>
        </button>
        <div class="dropdown-menu">
            <a href="#" data-format="csv"><i data-lucide="file-text"></i> Export CSV</a>
            <a href="#" data-format="excel"><i data-lucide="table"></i> Export Excel</a>
            <a href="#" data-format="pdf"><i data-lucide="file-type"></i> Print PDF</a>
        </div>
    `;

    headerActions.prepend(dropdown);
    lucide.createIcons();

    // Toggle dropdown
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');
    
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });

    document.addEventListener('click', () => menu.classList.remove('show'));

    // Handle clicks
    menu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const format = e.currentTarget.getAttribute('data-format');
            if (format === 'pdf') {
                exportToPDF();
            } else {
                const data = exportCallback();
                if (!data) return;
                
                const filename = document.title.split(' - ')[1] || 'Export';
                if (format === 'csv') exportToCSV(data, filename);
                if (format === 'excel') exportToExcel(data, filename);
            }
        });
    });
}
