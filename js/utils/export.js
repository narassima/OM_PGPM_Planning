window.exportToPDF = function(title, elementId) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    // Find tables in the current view
    const element = document.getElementById(elementId);
    const tables = element.querySelectorAll('table');
    
    if (tables.length === 0) {
        doc.setFontSize(12);
        doc.text("No tabular data available to export on this page.", 14, 40);
        doc.save(`${title.replace(/\\s+/g, '_')}.pdf`);
        return;
    }

    let startY = 30;
    tables.forEach((table, index) => {
        if(index > 0) startY += 10;
        doc.autoTable({
            html: table,
            startY: startY,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] }
        });
        startY = doc.lastAutoTable.finalY + 10;
    });

    doc.save(`${title.replace(/\\s+/g, '_')}.pdf`);
}

window.exportToExcel = function(title, elementId) {
    const element = document.getElementById(elementId);
    const tables = element.querySelectorAll('table');
    
    if (tables.length === 0) {
        alert("No tabular data available to export on this page.");
        return;
    }

    const wb = XLSX.utils.book_new();
    
    tables.forEach((table, index) => {
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, \`Data_\${index + 1}\`);
    });

    XLSX.writeFile(wb, \`\${title.replace(/\\s+/g, '_')}.xlsx\`);
}
