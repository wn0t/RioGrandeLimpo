// --- IMPORTAÇÕES DO FIREBASE (Via CDN para rodar direto no GitHub Pages) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- CONFIGURAÇÕES DE API ---
const firebaseConfig = {
  apiKey: "AIzaSyB5QjUTHARL1AureLXVeVIS296lWkiiptE",
  authDomain: "rio-grande-limpo.firebaseapp.com",
  projectId: "rio-grande-limpo",
  storageBucket: "rio-grande-limpo.firebasestorage.app",
  messagingSenderId: "396480806107",
  appId: "1:396480806107:web:052a71e8e5421f1cece0fe",
  measurementId: "G-Q53T8SZHH6"
};

const IMGBB_API_KEY = "8075bbcc7d168746185128114baf4af9";

// Inicializa os serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ESTADO LOCAL DO APLICATIVO ---
let appData = {
    reports: [],
    points: 0,
    resolvedCount: 0,
    username: 'Cidadão',
    isLoggedIn: false, 
    isAdmin: false
};

let currentTab = 'lixo';
let currentDraft = { type: 'lixo', image: null, lat: null, lng: null, address: '', description: '' };

// --- OBSERVADOR DE TEMPO REAL DO FIREBASE ---
const q = query(collection(db, "reports"), orderBy("timestamp", "desc"));
onSnapshot(q, (snapshot) => {
    appData.reports = [];
    appData.resolvedCount = 0;
    appData.points = 0;
    
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        data.id = docSnap.id; 
        
        if (data.status === 'Coletado' || data.status === 'Concluído') appData.resolvedCount++;
        if (auth.currentUser && data.userId === auth.currentUser.uid) appData.points += 50;
        
        appData.reports.push(data);
    });
    
    if (appData.isLoggedIn) {
        updateUI();
    }
});

// Observador de Login
onAuthStateChanged(auth, (user) => {
    if (user) {
        appData.isLoggedIn = true;
        appData.username = user.email.split('@')[0];
        appData.username = appData.username.charAt(0).toUpperCase() + appData.username.slice(1);
        appData.isAdmin = user.email.toLowerCase() === 'admin@riogrande.rs.gov.br';
        
        navigate('home-view', 'nav-home');
    } else {
        appData.isLoggedIn = false;
        appData.isAdmin = false;
        navigate('login-view');
    }
});

// --- NAVEGAÇÃO ---
const viewsWithNavbar = ['home-view', 'profile-view'];

window.navigate = function(viewId, navItemId = null) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
        view.style.display = 'none';
    });

    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
        targetView.style.display = 'flex';
    }

    const navbar = document.getElementById('global-navbar');
    if (navbar) navbar.style.display = viewsWithNavbar.includes(viewId) ? 'flex' : 'none';

    if (navItemId) {
        document.querySelectorAll('.nav-item-v2').forEach(item => item.classList.remove('active'));
        const activeNav = document.getElementById(navItemId);
        if (activeNav) activeNav.classList.add('active');
    }

    if (viewId === 'home-view' || viewId === 'profile-view') updateUI();
}

// --- AUTENTICAÇÃO ---
window.handleLogin = async function() {
    const inputEl = document.getElementById('login-username');
    const passEl = document.querySelector('#login-view input[type="password"]');
    const btn = document.querySelector('#login-view .login-btn');
    
    let email = inputEl ? inputEl.value.trim() : '';
    let password = passEl ? passEl.value : '';
    
    if (!email || !password) return alert("Preencha e-mail e senha!");
    if (!email.includes('@')) email = `${email.toLowerCase()}@riogrande.rs.gov.br`;

    const originalText = btn.innerText;
    btn.innerText = "Autenticando...";
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert("Erro ao entrar. Verifique seu e-mail e senha ou cadastre-se.");
    } finally {
        btn.innerText = originalText;
    }
}

window.handleRegister = async function() {
    const emailEl = document.getElementById('reg-email');
    const passEl = document.getElementById('reg-password');
    const btn = document.querySelector('#register-view .login-btn');

    let email = emailEl.value.trim();
    let password = passEl.value;

    if (!email || !password) return alert("Preencha todos os campos!");
    if (password.length < 6) return alert("A senha deve ter pelo menos 6 caracteres.");
    
    // Trava de segurança: Ninguém pode criar a conta do admin pelo app
    if (email.toLowerCase() === 'admin@riogrande.rs.gov.br') {
        return alert("Não é permitido registrar este e-mail através do aplicativo.");
    }

    const originalText = btn.innerText;
    btn.innerText = "Criando conta...";
    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        if(error.code === 'auth/email-already-in-use') {
            alert("Este e-mail já está cadastrado! Tente fazer login.");
        } else {
            alert("Erro ao criar conta: " + error.message);
        }
    } finally {
        btn.innerText = originalText;
    }
}

window.logout = function() {
    signOut(auth);
}

// --- CONTROLE DE ABAS E DENÚNCIAS ---
window.switchTab = function(tab) {
    currentTab = tab;
    document.getElementById('tab-lixo').classList.remove('active');
    document.getElementById('tab-animal').classList.remove('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    const btnText = document.getElementById('report-btn-text');
    if (btnText) btnText.innerText = tab === 'lixo' ? 'Denunciar Lixo Agora' : 'Reportar Animal Morto';
    
    updateUI();
}

window.startReport = function() {
    if(appData.isAdmin) return;
    currentDraft.type = currentTab;
    openCamera();
}

// --- CÂMERA E GPS ---
window.openCamera = function() { 
    if(appData.isAdmin) return;
    const camInput = document.getElementById('camera-input');
    if (camInput) camInput.click(); 
}

function handleImageSelection(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            currentDraft.image = canvas.toDataURL('image/jpeg', 0.7);
            fetchLocationAndProceed();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

const camInp = document.getElementById('camera-input');
if(camInp) camInp.addEventListener('change', handleImageSelection);

async function getRealAddress(lat, lng) {
    try {
        // Adicionamos accept-language=pt-br para garantir os nomes corretos
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-br`);
        const data = await response.json();
        
        if (data && data.address) {
            // Busca a rua, avenida ou via de pedestre
            const rua = data.address.road || data.address.pedestrian || data.address.path || "Via não identificada";
            
            // Busca o número (se a API conseguir identificar a casa/lote exato)
            const numero = data.address.house_number ? `, ${data.address.house_number}` : "";
            
            // Busca o bairro para dar mais contexto à prefeitura
            const bairro = data.address.suburb || data.address.city_district || data.address.neighbourhood ? ` - ${data.address.suburb || data.address.city_district || data.address.neighbourhood}` : "";
            
            return `${rua}${numero}${bairro}`;
        }
        return "Área Urbana";
    } catch (error) { 
        return "Coordenadas obtidas"; 
    }
}

function fetchLocationAndProceed() {
    const coordsText = document.getElementById('review-coords');
    if (coordsText) coordsText.innerText = "Buscando localização exata...";
    currentDraft.address = "Área Urbana";
    
    const reviewImage = document.getElementById('review-image');
    if (reviewImage) reviewImage.style.backgroundImage = `url(${currentDraft.image})`;
    
    navigate('review-view');

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                // Removemos o toFixed(4) para passar a precisão máxima do celular para a API
                currentDraft.lat = position.coords.latitude;
                currentDraft.lng = position.coords.longitude;
                
                currentDraft.address = await getRealAddress(currentDraft.lat, currentDraft.lng);
                
                if (coordsText) coordsText.innerText = currentDraft.address;
            },
            () => { if (coordsText) coordsText.innerText = "GPS bloqueado."; },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }
}

// --- ENVIAR DENÚNCIA PARA NUVEM ---
window.submitReport = async function() {
    const btn = document.querySelector('#review-view .btn');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Enviando e processando...";
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.7";

    try {
        const descInput = document.getElementById('review-desc');
        currentDraft.description = descInput ? descInput.value : "Sem descrição";

        // 1. Envia a foto pro ImgBB
        const base64Data = currentDraft.image.split(',')[1];
        const formData = new FormData();
        formData.append("image", base64Data);

        const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });
        const imgbbData = await imgbbRes.json();
        const imageUrl = imgbbData.data.url;

        // 2. Salva os dados no banco do Firebase
        await addDoc(collection(db, "reports"), {
            type: currentDraft.type || 'lixo',
            image: imageUrl,
            address: currentDraft.address || "Área Urbana",
            description: currentDraft.description,
            status: 'Em Andamento',
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            userId: auth.currentUser ? auth.currentUser.uid : 'anonimo'
        });

        if (descInput) descInput.value = '';
        currentDraft.image = null;
        navigate('success-view');

    } catch (error) {
        alert("Falha de rede ao enviar denúncia. Tente novamente.");
        console.error(error);
    } finally {
        btn.innerText = originalText;
        btn.style.pointerEvents = "auto";
        btn.style.opacity = "1";
    }
}

window.updateReportStatus = async function(reportId, newStatus) {
    try {
        const timeText = newStatus === 'Coletado' ? 'Resolvido agora' : 'Atualizado agora';
        await updateDoc(doc(db, "reports", reportId), {
            status: newStatus,
            time: timeText
        });
        navigate('home-view', 'nav-home');
    } catch(e) {
        alert("Erro ao atualizar status.");
    }
}

window.showReportDetails = function(reportId) {
    const report = appData.reports.find(r => r.id === reportId);
    if (!report) return;

    const detImg = document.getElementById('detail-image');
    const detStat = document.getElementById('detail-status');
    const detCoords = document.getElementById('detail-coords');
    const detDesc = document.getElementById('detail-desc');
    const detDate = document.getElementById('detail-date');

    if (detImg) detImg.style.backgroundImage = `url('${report.image}')`;
    if (detStat) detStat.innerText = report.status || "Desconhecido";
    if (detCoords) detCoords.innerText = report.address || "Local não informado";
    if (detDesc) detDesc.innerText = report.description || "Sem detalhes.";
    if (detDate) detDate.innerText = report.date || "";

    const adminBox = document.getElementById('admin-details-actions');
    if (adminBox) {
        if (appData.isAdmin) {
            adminBox.style.display = 'flex';
            adminBox.innerHTML = `
                <button class="btn btn-admin-done" onclick="updateReportStatus('${report.id}', 'Coletado')">✓ Marcar como Limpo</button>
                <button class="btn btn-admin-progress" onclick="updateReportStatus('${report.id}', 'Em Andamento')">⚡ Reabrir / Em Andamento</button>
            `;
        } else {
            adminBox.style.display = 'none';
        }
    }

    navigate('details-view');
}

// --- RENDERIZAÇÃO DA UI (MÚLTIPLOS PERFIS) ---
function updateUI() {
    const homeName = document.getElementById('home-username-display');
    const profName = document.getElementById('profile-username-display');
    const impactCount = document.getElementById('impact-count');
    const listContainer = document.getElementById('reports-list');
    
    // Elementos visuais que mudam dependendo de quem é o usuário
    const greetingBox = document.querySelector('.greeting-text');
    const impactCard = document.querySelector('.impact-card-v2');
    const homeReportBtn = document.getElementById('home-report-btn');
    const navFabBtn = document.getElementById('nav-fab-btn');

    if (appData.isAdmin) {
        // VISÃO ADMINISTRADOR
        if (greetingBox) greetingBox.innerText = "Painel de Controle,";
        if (homeName) homeName.innerText = "Prefeitura";
        if (profName) profName.innerText = "Prefeitura Municipal";
        if (impactCard) impactCard.style.display = 'none'; 
        if (homeReportBtn) homeReportBtn.style.display = 'none';
        if (navFabBtn) { navFabBtn.style.visibility = 'hidden'; navFabBtn.style.pointerEvents = 'none'; }
    } else {
        // VISÃO CIDADÃO
        if (greetingBox) greetingBox.innerText = "Bom Dia,";
        if (homeName) homeName.innerText = appData.username || 'Cidadão';
        if (profName) profName.innerText = appData.username || 'Cidadão';
        if (impactCount) impactCount.innerText = appData.resolvedCount || 0;
        
        if (impactCard) impactCard.style.display = 'block';
        if (homeReportBtn) homeReportBtn.style.display = 'flex';
        if (navFabBtn) { navFabBtn.style.visibility = 'visible'; navFabBtn.style.pointerEvents = 'auto'; }
    }

    if (!listContainer) return;
    listContainer.innerHTML = '';

    const filteredReports = appData.reports.filter(r => r.type === currentTab || (!r.type && currentTab === 'lixo'));

    if (filteredReports.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#64748b; font-size:15px; margin-top:32px;">Nenhum registro encontrado nesta categoria.</p>';
        return;
    }

    filteredReports.forEach(report => {
        const isDone = (report.status === 'Coletado' || report.status === 'Concluído');
        const badgeClass = isDone ? 'done' : 'progress';
        const checkIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        const clockIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
        
        listContainer.insertAdjacentHTML('beforeend', `
            <div class="report-card" onclick="showReportDetails('${report.id}')">
                <div class="report-img-v2" style="background-image: url('${report.image || ''}');"></div>
                <div class="report-info-v2">
                    <div class="report-header-row">
                        <span class="badge ${badgeClass}">${isDone ? checkIcon : clockIcon} ${report.status || "Em Andamento"}</span>
                        <span class="report-time">${report.time || report.date}</span>
                    </div>
                    <h4>${(report.address || "Local não informado").split(',')[0]}</h4>
                    <p style="display:flex; align-items:center; gap:4px; font-size:12px;">Área Urbana</p>
                </div>
            </div>
        `);
    });
}

// Utilitários de UI
window.showNotification = function() {
    alert(appData.isAdmin ? "🔔 SISTEMA: Denúncias ativas sincronizadas." : "🔔 SUCESSO: Tudo sincronizado na nuvem!");
}

window.openDevModal = function() { document.getElementById('dev-modal').style.display = 'flex'; }
window.closeDevModal = function() { document.getElementById('dev-modal').style.display = 'none'; }
window.openColetaModal = function() { document.getElementById('coleta-modal').style.display = 'flex'; }
window.closeColetaModal = function() { document.getElementById('coleta-modal').style.display = 'none'; }

// ==========================================
// --- MÓDULO DE COLETA SELETIVA (MANTIDO)---
// ==========================================
const coletaData = [
    { dia: 'Segunda-feira', turno: 'Manhã (7h30 às 11h30)', bairros: ['Centro Comercial', 'Rua Cristóvão Colombo', 'Povo Novo', 'Sítio Santa Cruz'] },
    { dia: 'Segunda-feira', turno: 'Tarde (13h30 às 17h30)', bairros: ['Barra', 'Cohab IV', 'Castelo Branco', 'Centro Secundário', 'Rua Benjamin Constant até Alm. Barroso'] },
    { dia: 'Terça-feira', turno: 'Manhã (7h30 às 11h30)', bairros: ['Centro Comercial', 'Rua Cristóvão Colombo', 'BGV', 'Vila Militar', 'Santa Tereza', 'Navegantes', 'Lar Gaúcho', 'Salgado Filho', 'Mangueira'] },
    { dia: 'Terça-feira', turno: 'Tarde (13h30 às 17h30)', bairros: ['Cassino', 'ABC Loteamento Otero', 'Vila São Jorge', 'Parque Universitário', 'Humaitá', 'Aeroporto', 'Vila Maria José', 'Marluz'] },
    { dia: 'Quarta-feira', turno: 'Manhã (7h30 às 11h30)', bairros: ['Centro Comercial', 'Rua Cristóvão Colombo', 'Miguel de Castro Moreira', 'Lagoa', 'Cohab II', 'Cidade Nova'] },
    { dia: 'Quarta-feira', turno: 'Tarde (13h30 às 17h30)', bairros: ['Frederico Ernesto Buchholz', 'Rural', 'Municipal', 'Hidráulica', 'Bernadeth', 'Parque Coelho', 'Vila Dias', 'Vila São Paulo'] },
    { dia: 'Quinta-feira', turno: 'Manhã (7h30 às 11h30)', bairros: ['Centro Comercial', 'Rua Cristóvão Colombo', 'São Miguel', 'São João', 'Profilurb', 'Vila Recreio', 'Vila Braz', 'Junção', 'América'] },
    { dia: 'Quinta-feira', turno: 'Tarde (13h30 às 17h30)', bairros: ['Santa Rosa', 'Central Park', 'Jardim do Sol', 'Parque Marinha'] },
    { dia: 'Sexta-feira', turno: 'Manhã (7h30 às 11h30)', bairros: ['Centro Comercial', 'Rua Cristóvão Colombo', 'Cassino', 'Av. Rio Grande até Jorge do Campos'] },
    { dia: 'Sexta-feira', turno: 'Tarde (13h30 às 17h30)', bairros: ['Querência', 'Parque Cassino', 'Parque Guanabara', 'Av. Rio Grande até Luiz Leivas Otero'] },
    { dia: 'Sábado', turno: 'Manhã (7h30 às 11h30)', bairros: ['Parque São Pedro', 'Senandes', 'Greenvilage', 'Boa Vista I e II', 'Vila Alfa', 'Bolacha', 'Cassino', 'Horto'] }
];

setTimeout(() => {
    const select = document.getElementById('bairro-select');
    if (!select) return;
    let todosBairros = new Set();
    coletaData.forEach(item => item.bairros.forEach(b => todosBairros.add(b)));
    Array.from(todosBairros).sort((a, b) => a.localeCompare(b)).forEach(bairro => {
        let opt = document.createElement('option');
        opt.value = opt.textContent = bairro;
        select.appendChild(opt);
    });
}, 300);

window.filterColeta = function() {
    const val = document.getElementById('bairro-select').value;
    const resultsDiv = document.getElementById('coleta-results');
    resultsDiv.innerHTML = '';
    let found = false;

    if (val === 'todos') {
        found = true;
        [...new Set(coletaData.map(d => d.dia))].forEach(dia => {
            let html = `<div style="margin-bottom: 24px;"><h4 style="color: var(--primary-dark); font-size: 18px; margin-bottom: 12px; font-weight: 800;">${dia}</h4>`;
            coletaData.filter(d => d.dia === dia).forEach(turno => {
                html += `<div style="background: var(--white); padding: 16px; border-radius: 16px; margin-bottom: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px rgba(0,0,0,0.02);"><strong style="font-size: 14px; color: var(--text-main); display: block; margin-bottom: 8px;">${turno.turno}</strong><p style="font-size: 14px; color: var(--text-muted); line-height: 1.5;">${turno.bairros.join(', ')}</p></div>`;
            });
            resultsDiv.innerHTML += html + `</div>`;
        });
    } else {
        coletaData.forEach(item => {
            if (item.bairros.includes(val)) {
                found = true;
                resultsDiv.innerHTML += `<div style="background: var(--primary-light); padding: 20px; border-radius: 16px; margin-bottom: 12px; border: 1px solid rgba(16, 185, 129, 0.3);"><h4 style="color: var(--primary-dark); font-size: 18px; margin-bottom: 8px; font-weight: 800;">${item.dia}</h4><strong style="font-size: 15px; color: var(--primary-dark); display: block;">${item.turno}</strong></div>`;
            }
        });
    }
    if (!found) resultsDiv.innerHTML = `<p style="font-size: 14px; color: var(--text-muted); text-align: center; margin-top: 32px;">Nenhum horário encontrado para este bairro.</p>`;
}
