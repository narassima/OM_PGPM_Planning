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

document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
});

function setupListeners() {
    document.getElementById('btn-start-quiz').addEventListener('click', startQuiz);
    document.getElementById('btn-submit-answer').addEventListener('click', submitAnswer);
    document.getElementById('btn-next-question').addEventListener('click', nextQuestion);
    document.getElementById('btn-restart-quiz').addEventListener('click', () => {
        document.getElementById('quiz-results').style.display = 'none';
        document.getElementById('quiz-setup').style.display = 'block';
    });
}

function startQuiz() {
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

    // Shuffle and slice
    pool = pool.sort(() => 0.5 - Math.random());
    currentQuiz = pool.slice(0, Math.min(count, pool.length));

    if (currentQuiz.length === 0) {
        alert("No questions found for these specific criteria. Try selecting 'All Topics' or 'Mixed' difficulty.");
        return;
    }

    currentQIndex = 0;
    score = 0;

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

    document.getElementById('quiz-explanation').classList.remove('active');
    document.getElementById('btn-submit-answer').style.display = 'block';
    document.getElementById('btn-submit-answer').disabled = true;
    document.getElementById('btn-next-question').style.display = 'none';
}

function selectOption(btn, idx) {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(o => o.classList.remove('selected'));
    btn.classList.add('selected');
    selectedOption = idx;
    document.getElementById('btn-submit-answer').disabled = false;
}

function submitAnswer() {
    if (selectedOption === null) return;
    
    const q = currentQuiz[currentQIndex];
    const options = document.querySelectorAll('.quiz-option');
    
    if (selectedOption === q.correct) {
        options[selectedOption].classList.add('correct');
        score++;
    } else {
        options[selectedOption].classList.add('incorrect');
        options[q.correct].classList.add('correct'); // Show correct one
    }
    
    // Disable all
    options.forEach(o => o.onclick = null);
    
    // Show explanation
    document.getElementById('explanation-text').innerText = q.explanation;
    document.getElementById('quiz-explanation').classList.add('active');
    
    document.getElementById('btn-submit-answer').style.display = 'none';
    
    if (currentQIndex < currentQuiz.length - 1) {
        document.getElementById('btn-next-question').style.display = 'block';
        document.getElementById('btn-next-question').innerText = 'Next Question';
    } else {
        document.getElementById('btn-next-question').style.display = 'block';
        document.getElementById('btn-next-question').innerText = 'Finish Quiz';
    }
}

function nextQuestion() {
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
    
    const pct = Math.round((score / currentQuiz.length) * 100);
    document.getElementById('result-score').innerText = `${pct}%`;
    document.getElementById('result-text').innerText = `You answered ${score} out of ${currentQuiz.length} questions correctly.`;
}
