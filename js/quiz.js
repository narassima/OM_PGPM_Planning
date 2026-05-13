const QUESTION_BANK = [
    // CAPACITY
    {
        topic: 'capacity',
        type: 'application',
        difficulty: 'easy',
        question: "What is Effective Capacity?",
        options: [
            "The absolute maximum output a facility is designed for.",
            "Design capacity minus allowances for maintenance, setups, and scheduling problems.",
            "The actual output rate achieved by the facility.",
            "The capacity required to meet peak demand."
        ],
        correct: 1,
        explanation: "Effective capacity accounts for realistic planned losses like maintenance and setup times, making it lower than Design Capacity."
    },
    {
        topic: 'capacity',
        type: 'problem',
        difficulty: 'tough',
        question: "If a plant is designed to produce 200 units/day, has a planned maintenance loss of 10%, an unplanned downtime of 5%, and a defect rate of 2%. What is its Effective Capacity (assuming effective capacity here means good output after all losses)?",
        options: ["180 units/day", "171 units/day", "167 units/day", "190 units/day"],
        correct: 2,
        explanation: "200 * (1 - 0.10) * (1 - 0.05) * (1 - 0.02) = 167.58 units. Rounded down to 167 good units."
    },
    // APP
    {
        topic: 'app',
        type: 'application',
        difficulty: 'easy',
        question: "Which APP strategy relies heavily on hiring and firing workers to match the production rate to demand?",
        options: ["Level Strategy", "Chase Strategy", "Mixed Strategy", "Subcontracting Strategy"],
        correct: 1,
        explanation: "The Chase strategy 'chases' the demand by adjusting the workforce size in every period."
    },
    {
        topic: 'app',
        type: 'problem',
        difficulty: 'medium',
        question: "In a Level Strategy with 5 periods of demand (100, 150, 200, 100, 150) and zero initial inventory, what is the required constant production rate per period?",
        options: ["100", "120", "140", "150"],
        correct: 2,
        explanation: "Total demand = 100+150+200+100+150 = 700. Constant rate = 700 / 5 periods = 140 units/period."
    },
    // MRP
    {
        topic: 'mrp',
        type: 'application',
        difficulty: 'medium',
        question: "In MRP, what does 'Net Requirements' represent?",
        options: [
            "Total expected demand for an item.",
            "Open orders scheduled to arrive.",
            "Expected inventory on hand at the beginning of the period.",
            "The actual amount needed in a time period after accounting for on-hand inventory and scheduled receipts."
        ],
        correct: 3,
        explanation: "Net Requirements = Gross Requirements - Projected On Hand - Scheduled Receipts."
    },
    {
        topic: 'mrp',
        type: 'problem',
        difficulty: 'tough',
        question: "If Gross Requirement is 100, Initial On-Hand is 30, Scheduled Receipts are 20, and the Lot Sizing Rule is Fixed(50), what is the Planned Order Receipt?",
        options: ["50", "100", "0", "150"],
        correct: 0,
        explanation: "Net Requirement = 100 - 30 - 20 = 50. Since Lot Rule is Fixed 50, we order ceil(50/50)*50 = 50 units."
    },
    // BOM
    {
        topic: 'bom',
        type: 'application',
        difficulty: 'tough',
        question: "What is Low-Level Coding in a Bill of Materials?",
        options: [
            "Coding components using binary logic.",
            "Restructuring the BOM so multiple occurrences of a component coincide with the lowest level it appears.",
            "Assigning the cheapest cost components to Level 0.",
            "Hiding sub-assemblies from the master schedule."
        ],
        correct: 1,
        explanation: "Low-level coding simplifies MRP calculations by pushing a component down to the lowest level it appears anywhere in the product structure."
    },
    {
        topic: 'bom',
        type: 'problem',
        difficulty: 'medium',
        question: "If End Item X requires 2 of Assembly Y. And Assembly Y requires 3 of Part Z. What is the total quantity of Part Z needed to produce 50 units of End Item X?",
        options: ["100", "150", "300", "50"],
        correct: 2,
        explanation: "Total Y needed = 50 * 2 = 100. Total Z needed = 100 * 3 = 300."
    }
];

let currentQuiz = [];
let currentQIndex = 0;
let score = 0;
let selectedOption = null;
let quizTimer = null;
let timeLeft = 0;
let studentInfo = { name: '', reg: '' };
let answersLogged = []; // Track actual answers for final review

document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
    refreshAdminLog();
});

function setupListeners() {
    document.getElementById('btn-start-quiz').addEventListener('click', startQuiz);
    document.getElementById('btn-submit-answer').addEventListener('click', submitAnswer);
    document.getElementById('btn-next-question').addEventListener('click', nextQuestion);
    document.getElementById('btn-restart-quiz').addEventListener('click', () => {
        document.getElementById('quiz-results').style.display = 'none';
        document.getElementById('quiz-setup').style.display = 'block';
    });
    document.getElementById('btn-download-cert').addEventListener('click', generateCertificate);
}

function startQuiz() {
    const name = document.getElementById('student-name').value.trim();
    const reg = document.getElementById('student-reg').value.trim();

    if (!name || !reg) {
        alert("Please enter both Name and Registration Number to start the certified evaluation.");
        return;
    }

    studentInfo = { name, reg };
    const topic = document.getElementById('quiz-topic').value;
    const type = document.getElementById('quiz-type').value;
    const diff = document.getElementById('quiz-diff').value;
    const count = parseInt(document.getElementById('quiz-count').value);

    // Filter bank
    let pool = QUESTION_BANK.filter(q => {
        let tMatch = topic === 'all' || q.topic === topic;
        let pMatch = type === 'mixed' || q.type === type;
        let dMatch = diff === 'mixed' || q.difficulty === diff;
        return tMatch && pMatch && dMatch;
    });

    pool = pool.sort(() => 0.5 - Math.random());
    currentQuiz = pool.slice(0, Math.min(count, pool.length));

    if (currentQuiz.length === 0) {
        alert("No questions found. Try broader criteria.");
        return;
    }

    currentQIndex = 0;
    score = 0;
    answersLogged = [];

    document.getElementById('quiz-setup').style.display = 'none';
    document.getElementById('quiz-active').style.display = 'block';
    document.getElementById('q-total').innerText = currentQuiz.length;
    
    loadQuestion();
}

function loadQuestion() {
    const q = currentQuiz[currentQIndex];
    selectedOption = null;
    
    document.getElementById('q-current').innerText = currentQIndex + 1;
    document.getElementById('q-topic-badge').innerText = q.topic.toUpperCase();
    document.getElementById('question-text').innerText = q.question;
    
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.innerText = opt;
        btn.onclick = () => selectOption(btn, idx);
        container.appendChild(btn);
    });

    // Reset UI
    document.getElementById('quiz-explanation').classList.remove('active');
    document.getElementById('btn-submit-answer').style.display = 'block';
    document.getElementById('btn-submit-answer').disabled = true;
    document.getElementById('btn-next-question').style.display = 'none';

    // Start Timer
    startTimer(q.type === 'problem' ? 60 : 30);
}

function startTimer(seconds) {
    if (quizTimer) clearInterval(quizTimer);
    timeLeft = seconds;
    const totalTime = seconds;
    const bar = document.getElementById('timer-bar');
    const text = document.getElementById('time-left');
    
    updateTimerUI(totalTime);
    
    quizTimer = setInterval(() => {
        timeLeft--;
        updateTimerUI(totalTime);
        if (timeLeft <= 0) {
            clearInterval(quizTimer);
            handleTimeUp();
        }
    }, 1000);
}

function updateTimerUI(total) {
    const bar = document.getElementById('timer-bar');
    const text = document.getElementById('time-left');
    text.innerText = timeLeft;
    const pct = (timeLeft / total) * 100;
    bar.style.width = pct + '%';
    bar.style.background = timeLeft < 10 ? '#ef4444' : '#0a66c2';
}

function handleTimeUp() {
    // Force submit with whatever is selected or nothing
    submitAnswer(true);
}

function selectOption(btn, idx) {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(o => o.classList.remove('selected'));
    btn.classList.add('selected');
    selectedOption = idx;
    document.getElementById('btn-submit-answer').disabled = false;
}

function submitAnswer(wasAuto = false) {
    if (quizTimer) clearInterval(quizTimer);
    
    const q = currentQuiz[currentQIndex];
    const isCorrect = (selectedOption === q.correct);
    
    if (isCorrect) score++;
    
    // Log for final review
    answersLogged.push({
        question: q.question,
        selected: selectedOption !== null ? q.options[selectedOption] : "No Answer",
        correct: q.options[q.correct],
        isCorrect: isCorrect,
        explanation: q.explanation
    });

    // Provide visual feedback (but don't show correct answer yet as per user request if preferred)
    // Actually user said "The correct answer need not be shown to students after every question"
    // So we just show "Answer Submitted"
    
    const container = document.getElementById('options-container');
    container.style.opacity = '0.6';
    container.style.pointerEvents = 'none';
    
    document.getElementById('btn-submit-answer').style.display = 'none';
    
    if (wasAuto) {
        setTimeout(() => { nextQuestion(); }, 800);
    } else {
        document.getElementById('btn-next-question').style.display = 'block';
        document.getElementById('btn-next-question').innerText = (currentQIndex < currentQuiz.length - 1) ? 'Next Question' : 'View Results';
    }
}

function nextQuestion() {
    const container = document.getElementById('options-container');
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
    
    currentQIndex++;
    if (currentQIndex < currentQuiz.length) {
        loadQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    document.getElementById('quiz-active').style.display = 'none';
    document.getElementById('quiz-results').style.display = 'block';
    
    document.getElementById('result-student-info').innerText = `${studentInfo.name} | ${studentInfo.reg}`;
    
    const pct = Math.round((score / currentQuiz.length) * 100);
    document.getElementById('result-score').innerText = `${pct}%`;
    document.getElementById('result-text').innerText = `You answered ${score} out of ${currentQuiz.length} questions correctly.`;
    
    saveToAdminLog(pct);
    refreshAdminLog();
}

function saveToAdminLog(pct) {
    const logs = JSON.parse(localStorage.getItem('om_quiz_logs') || '[]');
    const topic = document.getElementById('quiz-topic').value;
    logs.push({
        name: studentInfo.name,
        reg: studentInfo.reg,
        score: pct + '%',
        topic: topic,
        date: new Date().toLocaleString()
    });
    localStorage.setItem('om_quiz_logs', JSON.stringify(logs));
}

function refreshAdminLog() {
    const logs = JSON.parse(localStorage.getItem('om_quiz_logs') || '[]').reverse();
    const tbody = document.getElementById('admin-log-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    logs.slice(0, 50).forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${log.name}</td>
            <td>${log.reg}</td>
            <td style="font-weight:700; color:#0a66c2;">${log.score}</td>
            <td>${log.topic}</td>
            <td>${log.date}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportAdminLog() {
    const logs = JSON.parse(localStorage.getItem('om_quiz_logs') || '[]');
    if (logs.length === 0) return;
    
    let csv = "Name,RegNo,Score,Topic,Date\n";
    logs.forEach(log => {
        csv += `${log.name},${log.reg},${log.score},${log.topic},${log.date}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Admin_Quiz_Log_${new Date().toLocaleDateString()}.csv`;
    a.click();
}

function generateCertificate() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Back to Landscape
    
    const pct = Math.round((score / currentQuiz.length) * 100);
    const date = new Date().toLocaleDateString();
    
    const topic = document.getElementById('quiz-topic').selectedOptions[0].text;
    const type = document.getElementById('quiz-type').selectedOptions[0].text;
    const diff = document.getElementById('quiz-diff').selectedOptions[0].text;
    const count = currentQuiz.length;

    // Watermark - BIGGER and Tiled
    doc.setTextColor(242, 242, 242);
    doc.setFontSize(80); // Increased from 50
    for(let i=0; i<3; i++) {
        doc.text(studentInfo.reg, 148, 60 + (i*60), { align: 'center', angle: 25 });
    }

    // Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(10, 10, 277, 190);

    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("EXAMINATION CERTIFICATE", 148, 30, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(80, 35, 216, 35);

    // Main Details
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    let y = 60;
    const lineSpacing = 15;

    const addField = (label, value) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, 40, y);
        doc.setFont("helvetica", "normal");
        doc.text(`${value}`, 110, y);
        y += lineSpacing;
    };

    addField("Candidate Name", studentInfo.name.toUpperCase());
    addField("Registration ID", studentInfo.reg);
    
    doc.line(40, y-10, 257, y-10);
    y += 5;

    addField("Quiz Topic", topic);
    addField("Question Type", type);
    addField("Difficulty Level", diff);
    addField("Questions Attempted", count);
    
    doc.line(40, y-10, 257, y-10);
    y += 10;

    // Marks Section
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL EVALUATION MARKS", 148, y, { align: 'center' });
    y += 18;
    
    doc.setFontSize(48);
    doc.setTextColor(10, 102, 194);
    doc.text(`${pct}%`, 148, y, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    y += 15;
    doc.text(`You answered ${score} out of ${count} questions correctly.`, 148, y, { align: 'center' });

    // Footer
    const vCode = btoa(`${studentInfo.reg}-${pct}-${date}`).substring(0, 16).toUpperCase();
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`System Verification ID: ${vCode}`, 148, 185, { align: 'center' });
    doc.text(`Exam Date: ${date} | Generated by OpsPlanner Workspace`, 15, 195);

    doc.save(`Evaluation_${studentInfo.reg}.pdf`);
}

function saveToAdminLog(pct) {
    const topic = document.getElementById('quiz-topic').value;
    const dateStr = new Date().toLocaleString();
    
    // 1. Local Storage (Backup)
    const logs = JSON.parse(localStorage.getItem('om_quiz_logs') || '[]');
    logs.push({
        name: studentInfo.name,
        reg: studentInfo.reg,
        score: pct + '%',
        topic: topic,
        date: dateStr
    });
    localStorage.setItem('om_quiz_logs', JSON.stringify(logs));

    // 2. Google Sheets Integration (Real-time Centralized Storage)
    // Replace the URL below with your Google Apps Script Web App URL
    const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbylmvv5q8Wiqdvo_j4GK0CyS9OhbAjqCKQqzu5chAz50VeuoPLZRkcMwvGR92FHsb_-0g/exec";
    
    if (GOOGLE_SHEET_URL !== "https://script.google.com/macros/s/AKfycbylmvv5q8Wiqdvo_j4GK0CyS9OhbAjqCKQqzu5chAz50VeuoPLZRkcMwvGR92FHsb_-0g/exec") {
        fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors', // Important for cross-domain Google Script
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: studentInfo.name,
                reg: studentInfo.reg,
                score: pct + '%',
                topic: topic,
                date: dateStr
            })
        }).then(() => console.log("Marks synced to central server."))
          .catch(err => console.error("Sync error:", err));
    }
}
