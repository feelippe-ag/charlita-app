/**
 * CHARLITA 2.0 - Lógica de Aplicación
 * Sistema con persistencia de API Key, Parent Gate y Seguridad Infantil Reforzada.
 */

// ============================================
// 1. CONFIGURACIÓN Y ESTADO
// ============================================
const SESSION_TIME_LIMIT = 15 * 60 * 1000; // 15 Minutos de límite
let timeLeft = SESSION_TIME_LIMIT;
let timerRunning = false;
let savedApiKey = localStorage.getItem('charlita_api_key') || '';
let chatHistory = [];

// Elementos del DOM
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const sleepScreen = document.getElementById('sleep-screen');
const apiKeyInput = document.getElementById('api-key-input');
const saveBtn = document.getElementById('save-config-btn');
const settingsTrigger = document.getElementById('settings-trigger');
const parentGate = document.getElementById('parent-gate-modal');
const gateAnswerInput = document.getElementById('gate-answer');
const mathProblemText = document.getElementById('math-problem');
const verifyGateBtn = document.getElementById('verify-gate');
const cancelGateBtn = document.getElementById('cancel-gate');

const actionBtn = document.getElementById('action-btn');
const btnEmoji = document.getElementById('btn-emoji');
const infoMsg = document.getElementById('info-msg');
const charlitaBody = document.getElementById('charlita-body');
const mouthZone = document.getElementById('mouth-zone');
const energyFill = document.getElementById('energy-fill');

// ============================================
// 2. PROMPT DE SEGURIDAD (Cerebro de Charlita)
// ============================================
const SYSTEM_PROMPT = `Eres Charlita, una mascota virtual dulce, amable y mágica para niños de 3 a 5 años. 
Tu única misión es conversar de forma segura, breve y alegre para ayudar al desarrollo del lenguaje del niño.

REGLAS DE ORO DE SEGURIDAD Y COMPORTAMIENTO:
1. SEGURIDAD INFANTIL: Nunca hables de temas violentos, tristes, complejos o inapropiados para preescolares. 
2. TEMAS PERMITIDOS: Animales, colores, juguetes, comida rica, familia, la escuela, el clima, nubes, sol, luna y cuentos.
3. ESTILO DE RESPUESTA: Responde con UNA o DOS frases muy cortas. Usa palabras simples y amorosas.
4. FORMATO: Solo texto plano. NO uses emojis, asteriscos (*), negritas (#) ni listas. Esto será leído por voz sintética.
5. INTERACCIÓN: Siempre termina con UNA pregunta muy fácil (Ej: ¿De qué color es tu juguete?).
6. CASO EXTRAÑO: Si el niño dice algo confuso, responde con ternura: "¡Uy! Mis orejitas de algodón no entendieron, ¿me lo repites más clarito?".
7. SIEMPRE celebra los logros del niño (Ej: "¡Qué bien hablas!", "¡Qué divertido!").`;

// ============================================
// 3. LÓGICA DE INICIO Y PERSISTENCIA
// ============================================

// Verificar inicio
window.addEventListener('load', () => {
    if (savedApiKey) {
        showScreen('game');
        startSession();
    } else {
        showScreen('setup');
    }
});

function showScreen(screen) {
    setupScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    sleepScreen.classList.add('hidden');
    
    if (screen === 'setup') setupScreen.classList.remove('hidden');
    if (screen === 'game') gameScreen.classList.remove('hidden');
    if (screen === 'sleep') sleepScreen.classList.remove('hidden');
}

saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key.length < 20) {
        alert("Por favor, ingresa una llave de API válida de Google Gemini.");
        return;
    }
    savedApiKey = key;
    localStorage.setItem('charlita_api_key', key);
    showScreen('game');
    startSession();
});

// ============================================
// 4. PARENT GATE (SEGURIDAD PARA PADRES)
// ============================================
let currentGateAnswer = 0;

settingsTrigger.addEventListener('click', () => {
    // Generar suma aleatoria
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    currentGateAnswer = a + b;
    mathProblemText.innerText = `¿Cuánto es ${a} + ${b}?`;
    gateAnswerInput.value = '';
    parentGate.classList.remove('hidden');
});

verifyGateBtn.addEventListener('click', () => {
    if (parseInt(gateAnswerInput.value) === currentGateAnswer) {
        parentGate.classList.add('hidden');
        showScreen('setup'); // Ir a configurar clave
    } else {
        alert("Respuesta incorrecta. Solo los adultos pueden entrar aquí.");
        parentGate.classList.add('hidden');
    }
});

cancelGateBtn.addEventListener('click', () => parentGate.classList.add('hidden'));

// ============================================
// 5. MOTOR DE SESIÓN Y LÍMITE DE PANTALLA
// ============================================
function startSession() {
    if (timerRunning) return;
    timerRunning = true;
    
    speakText("¡Hola! Ya estoy aquí. ¡Toca el botón mágico para que hablemos!");

    const tick = setInterval(() => {
        timeLeft -= 1000;
        const progress = (timeLeft / SESSION_TIME_LIMIT) * 100;
        energyFill.style.width = `${progress}%`;

        if (timeLeft <= 0) {
            clearInterval(tick);
            endSession();
        }
    }, 1000);
}

function endSession() {
    showScreen('sleep');
    speakText("¡Oh! Mis ojitos se están cerrando. Ya jugamos mucho hoy y me dio sueño. ¡Hasta mañana, amiguito! Que descanses.");
}

// ============================================
// 6. MICRÓFONO Y ESCUCHA (RECOGNITION)
// ============================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        setCharState('listening');
        infoMsg.innerText = "¡Te escucho! Háblame...";
        actionBtn.classList.add('recording');
        btnEmoji.innerText = "⭐";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        infoMsg.innerText = "¡Qué bueno! Déjame pensar...";
        getAIResponse(transcript);
    };

    recognition.onerror = () => {
        setCharState('neutral');
        actionBtn.classList.remove('recording');
        btnEmoji.innerText = "🎙️";
        infoMsg.innerText = "¡Toca de nuevo para hablar!";
    };

    recognition.onend = () => {
        setCharState('neutral');
        actionBtn.classList.remove('recording');
        btnEmoji.innerText = "🎙️";
    };
}

actionBtn.addEventListener('click', () => {
    if (timeLeft <= 0 || !recognition) return;
    window.speechSynthesis.cancel();
    try {
        recognition.start();
    } catch(e) {}
});

// ============================================
// 7. HABLA Y ANIMACIONES (SYNTHESIS)
// ============================================
function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Limpieza de caracteres extraños para la voz
    const clean = text.replace(/[*#_~]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    
    // Configuración de voz "infantil/mágica"
    utterance.lang = 'es-AR';
    utterance.pitch = 1.7; // Muy aguda
    utterance.rate = 0.85; // Despacio

    utterance.onstart = () => setCharState('speaking');
    utterance.onend = () => setCharState('neutral');

    // Intentar buscar voz femenina
    const voices = window.speechSynthesis.getVoices();
    const sweetVoice = voices.find(v => v.lang.includes('es') && (v.name.includes('Google') || v.name.includes('Online')));
    if (sweetVoice) utterance.voice = sweetVoice;

    window.speechSynthesis.speak(utterance);
}

function setCharState(state) {
    mouthZone.classList.remove('mouth-speaking', 'mouth-listening');
    charlitaBody.style.transform = "scale(1)";

    if (state === 'speaking') {
        mouthZone.classList.add('mouth-speaking');
    } else if (state === 'listening') {
        mouthZone.classList.add('mouth-listening');
    }
}

// ============================================
// 8. CEREBRO IA (CONEXIÓN GEMINI)
// ============================================
async function getAIResponse(userText) {
    if (!savedApiKey) return;

    chatHistory.push({ role: "user", parts: [{ text: userText }] });

    try {
        // ACTUALIZACIÓN: Usamos el modelo que seleccionaste en tu consola (3.1 Flash Lite)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${savedApiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: chatHistory,
                generationConfig: { temperature: 0.7, maxOutputTokens: 100 }
            })
        });

        const data = await response.json();
        
        if (data.error) {
            // Si hay error de créditos o cuota, lo mostramos
            const errorType = data.error.status || "Error";
            infoMsg.innerText = `¡Uy! Charlita tiene sueño (${errorType}). Avisa a papá.`;
            throw new Error(`${data.error.status}: ${data.error.message}`);
        }

        const aiMsg = data.candidates[0].content.parts[0].text;
        chatHistory.push({ role: "model", parts: [{ text: aiMsg }] });
        
        // Limitar historial para no gastar tokens innecesarios (últimos 6 mensajes)
        if (chatHistory.length > 6) chatHistory = chatHistory.slice(-6);

        speakText(aiMsg);
        infoMsg.innerText = "¡Charlita te responde! (v2.1)";

    } catch (err) {
        console.error(err);
        infoMsg.innerText = "¡Uy! Me distraje. Toca de nuevo el botón.";
    }
}

// Cargar voces de Chrome
if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = window.speechSynthesis.getVoices;
}
