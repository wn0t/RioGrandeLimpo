// --- ESTADO DO APLICATIVO ---
let appData = null;

// Tenta carregar os dados. Se houver algum erro grave no cache antigo, ele ignora.
try {
    appData = JSON.parse(localStorage.getItem('naturezaLimpaData'));
} catch (error) {
    appData = null;
}

if (!appData || !appData.reports || appData.reports.length === 0) {
    appData = {
        reports: [
            {
                id: 2,
                image: 'https://www.olitoraneo.com.br/arquivos/noticias/21150/acumulo-de-lixo-domiciliar-causa-transtornos-nas-ruas-do-rio-grande.jpeg',
                address: 'Avenida Pelotas',
                description: 'Acúmulo de lixo domiciliar causando transtornos na calçada.',
                status: 'Em Andamento',
                date: new Date().toLocaleDateString('pt-BR'),
                time: 'Agora mesmo'
            },
            {
                id: 1,
                image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYtQh1AL8TvrxrTmht57L4kqXXBzHx7jhQ8g&',
                address: 'Praia do Cassino',
                description: 'Lixo espalhado pela areia da praia.',
                status: 'Coletado',
                date: new Date(Date.now() - 172800000).toLocaleDateString('pt-BR'),
                time: 'Há 2 dias'
            }
        ],
        points: 50,
        resolvedCount: 1,
        username: 'Michael',
        isLoggedIn: false, 
        isAdmin: false
    };
    localStorage.setItem('naturezaLimpaData', JSON.stringify(appData));
}

if (!appData.reports) appData.reports = [];

let currentDraft = { image: null, lat: null, lng: null, address: '', description: '' };

// --- NAVEGAÇÃO E LOGIN ---
const viewsWithNavbar = ['home-view', 'profile-view'];

function navigate(viewId, navItemId = null) {
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
    if (navbar) {
        navbar.style.display = viewsWithNavbar.includes(viewId) ? 'flex' : 'none';
    }

    if (navItemId) {
        document.querySelectorAll('.nav-item-v2').forEach(item => item.classList.remove('active'));
        const activeNav = document.getElementById(navItemId);
        if (activeNav) activeNav.classList.add('active');
    }

    if (viewId === 'home-view' || viewId === 'profile-view') {
        updateUI();
    }
}

function handleLogin() {
    const inputEl = document.getElementById('login-username');
    let inputValue = inputEl ? inputEl.value.trim() : 'Cidadão';
    
    let isAdmin = false;

    // Detecta se é o e-mail fictício de administrador
    if (inputValue.toLowerCase() === 'admin@riogrande.rs.gov.br' || inputValue.toLowerCase() === 'admin') {
        isAdmin = true;
        inputValue = 'Administrador (Prefeitura)';
    } else {
        if (inputValue.includes('@')) {
            inputValue = inputValue.split('@')[0];
            inputValue = inputValue.charAt(0).toUpperCase() + inputValue.slice(1);
        }
    }
    
    if (inputValue === '') inputValue = 'Cidadão';

    appData.username = inputValue;
    appData.isLoggedIn = true; 
    appData.isAdmin = isAdmin;
    
    localStorage.setItem('naturezaLimpaData', JSON.stringify(appData));
    navigate('home-view', 'nav-home'); // Correção do ícone de casinha
}

function logout() {
    appData.isLoggedIn = false;
    localStorage.setItem('naturezaLimpaData', JSON.stringify(appData));
    navigate('login-view');
}

// --- CÂMERA, COMPRESSÃO DE IMAGEM E GPS ---
function openCamera() { 
    if(appData.isAdmin) return;
    const camInput = document.getElementById('camera-input');
    if (camInput) camInput.click(); 
}

function openGallery() { 
    if(appData.isAdmin) return;
    const galInput = document.getElementById('gallery-input');
    if (galInput) galInput.click(); 
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
const galInp = document.getElementById('gallery-input');
if(camInp) camInp.addEventListener('change', handleImageSelection);
if(galInp) galInp.addEventListener('change', handleImageSelection);

async function getRealAddress(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const data = await response.json();
        if (data.address) {
            return data.address.road || "Área Urbana";
        }
        return "Local não identificado";
    } catch (error) {
        return `Coordenadas obtidas`;
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
                currentDraft.lat = position.coords.latitude.toFixed(4);
                currentDraft.lng = position.coords.longitude.toFixed(4);
                const realAddress = await getRealAddress(currentDraft.lat, currentDraft.lng);
                currentDraft.address = realAddress;
                if (coordsText) coordsText.innerText = realAddress;
            },
            (error) => { if (coordsText) coordsText.innerText = "GPS bloqueado ou negado."; },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
        if (coordsText) coordsText.innerText = "GPS não suportado.";
    }
}

// --- ENVIAR DENÚNCIA ---
function submitReport() {
    const descInput = document.getElementById('review-desc');
    currentDraft.description = descInput ? descInput.value : "Sem descrição";
    if (!currentDraft.description.trim()) currentDraft.description = "Sem descrição";

    const newReport = {
        id: Date.now(),
        image: currentDraft.image,
        address: currentDraft.address || "Área Urbana",
        description: currentDraft.description,
        status: 'Em Andamento',
        date: new Date().toLocaleDateString('pt-BR'),
        time: 'Agora mesmo'
    };

    appData.reports.unshift(newReport);
    appData.points = (appData.points || 0) + 50; 
    localStorage.setItem('naturezaLimpaData', JSON.stringify(appData));

    if (descInput) descInput.value = '';
    if (camInp) camInp.value = '';
    if (galInp) galInp.value = '';
    
    navigate('success-view');
}

function updateReportStatus(reportId, newStatus) {
    const report = appData.reports.find(r => r.id === reportId);
    if (!report) return;

    report.status = newStatus;
    
    if (newStatus === 'Coletado') {
        report.time = 'Resolvido agora';
        appData.resolvedCount = (appData.resolvedCount || 0) + 1;
    } else {
        report.time = 'Atualizado agora';
    }

    localStorage.setItem('naturezaLimpaData', JSON.stringify(appData));
    
    showReportDetails(reportId);
    updateUI();
}

function showReportDetails(reportId) {
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
                <button class="btn btn-admin-done" onclick="updateReportStatus(${report.id}, 'Coletado')">✓ Marcar como Limpo</button>
                <button class="btn btn-admin-progress" onclick="updateReportStatus(${report.id}, 'Em Andamento')">⚡ Reabrir / Em Andamento</button>
            `;
        } else {
            adminBox.style.display = 'none';
        }
    }

    navigate('details-view');
}

// --- RENDERIZAR TELA COM TRAVAS DE SEGURANÇA ---
function updateUI() {
    const homeName = document.getElementById('home-username-display');
    const profName = document.getElementById('profile-username-display');
    const impactCount = document.getElementById('impact-count');
    const profPoints = document.getElementById('profile-points');
    const profResolved = document.getElementById('profile-resolved');
    const listContainer = document.getElementById('reports-list');

    if (homeName) homeName.innerText = appData.username || 'Cidadão';
    if (profName) profName.innerText = appData.username || 'Cidadão';
    if (impactCount) impactCount.innerText = appData.resolvedCount || 0;
    if (profPoints) profPoints.innerText = appData.points || 0;
    if (profResolved) profResolved.innerText = appData.resolvedCount || 0;
    
    // Esconder botões de denúncia se for administrador
    const homeReportBtn = document.getElementById('home-report-btn');
    const navFabBtn = document.getElementById('nav-fab-btn');
    
    if (appData.isAdmin) {
        if (homeReportBtn) homeReportBtn.style.display = 'none';
        if (navFabBtn) {
            navFabBtn.style.visibility = 'hidden'; 
            navFabBtn.style.pointerEvents = 'none';
        }
    } else {
        if (homeReportBtn) homeReportBtn.style.display = 'flex';
        if (navFabBtn) {
            navFabBtn.style.visibility = 'visible';
            navFabBtn.style.pointerEvents = 'auto';
        }
    }

    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!appData.reports || appData.reports.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#64748b; font-size:15px; margin-top:32px;">Nenhuma denúncia recente.</p>';
        return;
    }

    appData.reports.forEach(report => {
        if (!report) return;

        const isDone = (report.status === 'Coletado' || report.status === 'Concluído');
        const badgeClass = isDone ? 'done' : 'progress';
        const checkIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        const clockIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
        const badgeIcon = isDone ? checkIcon : clockIcon;

        const safeAddress = report.address || "Local não informado";
        const shortAddress = safeAddress.split(',')[0];
        
        const displayTime = report.time || report.date || "Sem data";
        const safeImage = report.image || "";

        const itemHtml = `
            <div class="report-card" onclick="showReportDetails(${report.id})">
                <div class="report-img-v2" style="background-image: url('${safeImage}');"></div>
                <div class="report-info-v2">
                    <div class="report-header-row">
                        <span class="badge ${badgeClass}">${badgeIcon} ${report.status || "Em Andamento"}</span>
                        <span class="report-time">${displayTime}</span>
                    </div>
                    <h4>${shortAddress}</h4>
                    <p style="display:flex; align-items:center; gap:4px; font-size:12px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> Área Urbana</p>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
}

function clearData() {
    if(confirm("Apagar todas as denúncias? Isso resetará o app com os exemplos padrão.")) {
        localStorage.removeItem('naturezaLimpaData');
        appData = null;
        navigate('login-view');
        setTimeout(() => window.location.reload(), 100);
    }
}

function showNotification() {
    if (appData && appData.isAdmin) {
        alert("🔔 SISTEMA: Existem novas denúncias de lixo na sua cidade aguardando a equipe de coleta.");
    } else {
        alert("🔔 SUCESSO: A prefeitura limpou recentemente um local que havia sido reportado pela comunidade. Continue ajudando!");
    }
}

// --- MODAL DE DESENVOLVEDORES ---
function openDevModal() {
    const modal = document.getElementById('dev-modal');
    if (modal) modal.style.display = 'flex';
}

function closeDevModal() {
    const modal = document.getElementById('dev-modal');
    if (modal) modal.style.display = 'none';
}

// Iniciação
if (appData && appData.isLoggedIn) {
    navigate('home-view', 'nav-home'); // Correção do ícone de casinha
} else {
    navigate('login-view');
}