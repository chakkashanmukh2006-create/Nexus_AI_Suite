// Insure AI Ecosystem - Unified Restructured Controller
const PORTS = {
    retention: 8000,
    anomaly: 8001,
    predictive: 8002,
    decision: 8003
};

window.addEventListener('unhandledrejection', function(event) {
    const errorMsg = document.createElement('div');
    errorMsg.style = 'position:fixed;top:0;left:0;z-index:9999;background:red;color:white;padding:20px;font-size:20px;';
    errorMsg.textContent = 'Unhandled Rejection: ' + (event.reason ? event.reason.stack || event.reason : 'Unknown');
    document.body.appendChild(errorMsg);
});

let tokens = {
    retention: localStorage.getItem('token_8000') || null,
    anomaly: localStorage.getItem('token_8001') || null,
    predictive: localStorage.getItem('token_8002') || null,
    decision: localStorage.getItem('token_8003') || null
};

let serviceStatus = {
    retention: 'offline',
    anomaly: 'offline',
    predictive: 'offline',
    decision: 'offline'
};

let activeTab = 'overview-tab';
let forecastChartInstance = null;
let selectedRetrainPort = 8000;
let trainingPollInterval = null;
let currentRecentService = 'retention';

// Pagination States (10 records per page)
const PAGE_LIMIT = 10;
let pages = {
    retentionLeads: 1,
    retentionCust: 1,
    anomalyLeads: 1,
    anomalyCust: 1,
    predictiveCalls: 1,
    decisionLeads: 1,
    decisionCust: 1,
    
    // Modal-based lists
    modalLeads: 1,
    modalCustomers: 1
};

// Date parser helper to handle timezone offsets cleanly
function parseUTCDate(dateStr, isLocal = false) {
    if (!dateStr) return null;
    let s = dateStr;
    if (isLocal) {
        if (!s.includes('T') && s.includes(' ')) {
            s = s.replace(' ', 'T');
        }
        return new Date(s);
    }
    if (s.includes('T') && !s.endsWith('Z') && !s.includes('+') && !s.slice(10).includes('-')) {
        s += 'Z';
    } else if (!s.includes('T') && s.includes(' ')) {
        s = s.replace(' ', 'T') + 'Z';
    }
    return new Date(s);
}

// DOM Initialization
setTimeout(async () => {
    setupEventListeners();
    await initAuth();
    loadOverviewCounts();
});

// Setup Events
function setupEventListeners() {
    // Clickable hub cards for landing page navigation
    document.querySelectorAll('.clickable-hub-card').forEach(card => {
        card.addEventListener('click', () => {
            const target = card.getAttribute('data-target');
            switchTab(target);
        });
    });

    // Back to hub buttons
    document.querySelectorAll('.back-home-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab('overview-tab');
        });
    });

    // Retrain console port selector
    document.querySelectorAll('.retrain-btn-selector').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.retrain-btn-selector').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRetrainPort = parseInt(btn.getAttribute('data-port'));
            clearTerminal();
            appendToTerminal(`Switched retraining target to Port ${selectedRetrainPort}. Ready.`);
        });
    });

    // Retrain execute button
    document.getElementById('exec-train-btn').addEventListener('click', triggerRetraining);

    // Recently Ingested service selectors
    document.querySelectorAll('.recent-selector-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.recent-selector-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRecentService = btn.getAttribute('data-service');
            loadRecentlyIngested();
        });
    });

    // Pagination Click Listeners
    setupPaginationListeners();

    // Data Upload and Export Form handlers
    setupDataHandlers();

    // CUSTOMER RETENTION VIEW SPECIAL EVENT LISTENERS
    setupRetentionSpecialListeners();
}

// Silent Authentication & Setup (Uses 127.0.0.1 loopback directly)
async function initAuth() {
    const authPromises = Object.entries(PORTS).map(async ([key, port]) => {
        const baseUrl = `http://127.0.0.1:${port}`;
        
        try {
            const healthRes = await fetch(`${baseUrl}/health`);
            if (!healthRes.ok) throw new Error();
            serviceStatus[key] = 'online';
            updateStatusUI(key, 'online');
        } catch (e) {
            serviceStatus[key] = 'offline';
            updateStatusUI(key, 'offline');
            return;
        }

        try {
            const loggedIn = await performLogin(key, port);
            if (!loggedIn) {
                const registered = await performRegistration(key, port);
                if (registered) {
                    await performLogin(key, port);
                }
            }
        } catch (e) {
            console.error(`Auth failed on port ${port}:`, e);
        }
    });

    await Promise.all(authPromises);
    loadRecentlyIngested();
}

// Perform Registration
async function performRegistration(key, port) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin2',
                email: `admin${port}@example.com`,
                password: 'password'
            })
        });
        return res.status === 201 || res.ok;
    } catch(e) {
        return false;
    }
}

// Perform Login
async function performLogin(key, port) {
    try {
        const formData = new URLSearchParams();
        formData.append('username', 'admin2');
        formData.append('password', 'password');
        
        const res = await fetch(`http://127.0.0.1:${port}/login`, {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            tokens[key] = data.access_token;
            localStorage.setItem(`token_${port}`, data.access_token);
            return true;
        }
        return false;
    } catch(e) {
        return false;
    }
}

// Authenticated API Fetch wrapper
async function apiFetch(serviceKey, endpoint, options = {}) {
    const port = PORTS[serviceKey];
    if (!port) throw new Error(`Unknown service: ${serviceKey}`);
    
    if (serviceStatus[serviceKey] === 'offline') {
        throw new Error(`Service ${serviceKey} is offline.`);
    }

    const headers = options.headers || {};
    if (tokens[serviceKey]) {
        headers['Authorization'] = `Bearer ${tokens[serviceKey]}`;
    }
    options.headers = headers;

    const res = await fetch(`http://127.0.0.1:${port}${endpoint}`, options);
    
    if (res.status === 401) {
        const refreshed = await performLogin(serviceKey, port);
        if (refreshed && tokens[serviceKey]) {
            options.headers['Authorization'] = `Bearer ${tokens[serviceKey]}`;
            return fetch(`http://127.0.0.1:${port}${endpoint}`, options);
        }
    }
    
    return res;
}

// UI Status indicators updating
function updateStatusUI(key, status) {
    const el = document.getElementById(`status-${key}`);
    if (el) {
        el.className = `status-badge ${status}`;
        el.querySelector('.status-dot').style.color = status === 'online' ? 'var(--color-accent-decision)' : 'var(--color-accent-anomaly)';
    }
}

// Tab switcher SPA routing
function switchTab(targetTabId) {
    activeTab = targetTabId;
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    const targetEl = document.getElementById(targetTabId);
    targetEl.classList.add('active');

    // Reset pagination to page 1 on tab load
    for (let k in pages) pages[k] = 1;

    loadActiveTab();
}

// Switch panels and execute loads
function loadActiveTab() {
    switch (activeTab) {
        case 'overview-tab':
            loadOverviewCounts();
            break;
        case 'retention-tab':
            loadRetentionDashboardData();
            break;
        case 'anomaly-tab':
            loadAnomalyLeads();
            loadAnomalyCustomers();
            break;
        case 'predictive-tab':
            loadPredictiveData();
            break;
        case 'decision-tab':
            loadDecisionLeads();
            loadDecisionCustomers();
            break;
        case 'retrain-tab':
            clearTerminal();
            appendToTerminal(`Console active. Switched retraining target to Port ${selectedRetrainPort}. Ready.`);
            break;
        case 'data-tab':
            loadRecentlyIngested();
            break;
        case 'insurance-forecast-tab':
            loadDomainForecast('insurance');
            break;
        case 'retail-forecast-tab':
            loadDomainForecast('retail');
            break;
        case 'grocery-forecast-tab':
            loadDomainForecast('grocery');
            break;
        case 'logistics-forecast-tab':
            loadDomainForecast('logistics');
            break;
        case 'maintenance-tab':
            loadDomainForecast('maintenance');
            break;
    }
}

// Switch panels and execute loads
let demandChartInstance = null;

async function loadDemandForecastData() {
    try {
        const res = await apiFetch('predictive', '/product/projection');
        if (res.ok) {
            const data = await res.json();
            const forecast = data.forecast;
            
            // Extract peak values
            let maxLife = 0, maxAuto = 0, maxHome = 0, maxHealth = 0;
            const labels = [];
            const lifeData = [];
            const autoData = [];
            const homeData = [];
            const healthData = [];
            
            forecast.forEach(m => {
                labels.push(m.month);
                lifeData.push(m.Life_Insurance);
                autoData.push(m.Auto_Insurance);
                homeData.push(m.Home_Insurance);
                healthData.push(m.Health_Insurance);
                
                if (m.Life_Insurance > maxLife) maxLife = m.Life_Insurance;
                if (m.Auto_Insurance > maxAuto) maxAuto = m.Auto_Insurance;
                if (m.Home_Insurance > maxHome) maxHome = m.Home_Insurance;
                if (m.Health_Insurance > maxHealth) maxHealth = m.Health_Insurance;
            });
            
            // Set dashboard stats
            document.getElementById('demand-peak-life').textContent = maxLife.toLocaleString();
            document.getElementById('demand-peak-auto').textContent = maxAuto.toLocaleString();
            document.getElementById('demand-peak-home').textContent = maxHome.toLocaleString();
            document.getElementById('demand-peak-health').textContent = maxHealth.toLocaleString();
            
            // Render Chart
            const ctx = document.getElementById('demandForecastChart');
            if (!ctx) return;
            
            if (demandChartInstance) {
                demandChartInstance.destroy();
            }
            
            demandChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Life', data: lifeData, borderColor: '#2196F3', backgroundColor: 'rgba(33, 150, 243, 0.1)', borderWidth: 3, tension: 0.4, fill: true },
                        { label: 'Auto', data: autoData, borderColor: '#9C27B0', backgroundColor: 'rgba(156, 39, 176, 0.1)', borderWidth: 3, tension: 0.4, fill: true },
                        { label: 'Home', data: homeData, borderColor: '#FF9800', backgroundColor: 'rgba(255, 152, 0, 0.1)', borderWidth: 3, tension: 0.4, fill: true },
                        { label: 'Health', data: healthData, borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)', borderWidth: 3, tension: 0.4, fill: true }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { color: 'rgba(255,255,255,0.7)' } }
                    },
                    scales: {
                        x: { 
                            grid: { color: 'rgba(255,255,255,0.05)' }, 
                            ticks: { color: 'rgba(255,255,255,0.5)' },
                            title: { display: true, text: 'Time (Months)', color: 'rgba(255,255,255,0.7)', font: { size: 14 } }
                        },
                        y: { 
                            grid: { color: 'rgba(255,255,255,0.05)' }, 
                            ticks: { color: 'rgba(255,255,255,0.5)' },
                            title: { display: true, text: 'Predicted Customer Volume', color: 'rgba(255,255,255,0.7)', font: { size: 14 } }
                        }
                    },
                    interaction: { mode: 'index', intersect: false }
                }
            });
        }
    } catch(e) {
        console.error("Failed to load demand forecast:", e);
    }
}

// Load Row Counts dynamically from all backends (confirming data uploads)
async function loadOverviewCounts() {
    const fetchDashboardStats = async (key) => {
        if (serviceStatus[key] === 'offline') {
            return null;
        }
        try {
            const res = await apiFetch(key, '/dashboard');
            if (res.ok) {
                return await res.json();
            }
        } catch(e) {
            console.error(`Error loading dashboard stats for ${key}:`, e);
        }
        return null;
    };

    // Port 8000: Retention
    try {
        const retStats = await fetchDashboardStats('retention');
        const retLeadsEl = document.getElementById('metric-retention-leads');
        const retCustEl = document.getElementById('metric-retention-cust');
        if (retStats && retStats.stats) {
            if (retLeadsEl) retLeadsEl.textContent = (retStats.stats.total_leads || 0).toLocaleString();
            if (retCustEl) retCustEl.textContent = (retStats.stats.total_customers || 0).toLocaleString();
        } else {
            const offText = serviceStatus.retention === 'offline' ? 'OFFLINE' : '0';
            if (retLeadsEl) retLeadsEl.textContent = offText;
            if (retCustEl) retCustEl.textContent = offText;
        }
    } catch(e) {
        console.error("Error loading Retention stats:", e);
    }

    // Port 8001: Anomaly
    try {
        const anomalyStats = await fetchDashboardStats('anomaly');
        const anLeadsEl = document.getElementById('metric-anomaly-leads');
        const anFraudEl = document.getElementById('metric-anomaly-fraud');
        if (anomalyStats && anomalyStats.stats) {
            if (anLeadsEl) anLeadsEl.textContent = (anomalyStats.stats.total_leads || 0).toLocaleString();
            if (anFraudEl) anFraudEl.textContent = (anomalyStats.stats.total_customers || 0).toLocaleString();
        } else {
            const offText = serviceStatus.anomaly === 'offline' ? 'OFFLINE' : '0';
            if (anLeadsEl) anLeadsEl.textContent = offText;
            if (anFraudEl) anFraudEl.textContent = offText;
        }
    } catch(e) {
        console.error("Error loading Anomaly stats:", e);
    }

    // Port 8002: Predictive
    try {
        const predStats = await fetchDashboardStats('predictive');
        const predCallsEl = document.getElementById('metric-predictive-calls');
        const predLeadsEl = document.getElementById('metric-predictive-leads');
        const predCustEl = document.getElementById('metric-predictive-cust');
        if (predStats && predStats.stats) {
            if (predCallsEl) predCallsEl.textContent = (predStats.stats.total_calls || 0).toLocaleString();
            if (predLeadsEl) predLeadsEl.textContent = (predStats.stats.total_leads || 0).toLocaleString();
            if (predCustEl) predCustEl.textContent = (predStats.stats.total_customers || 0).toLocaleString();
        } else {
            const offText = serviceStatus.predictive === 'offline' ? 'OFFLINE' : '0';
            if (predCallsEl) predCallsEl.textContent = offText;
            if (predLeadsEl) predLeadsEl.textContent = offText;
            if (predCustEl) predCustEl.textContent = offText;
        }
    } catch(e) {
        console.error("Error loading Predictive stats:", e);
    }

    // Port 8003: Decision
    try {
        const decStats = await fetchDashboardStats('decision');
        const decActionsEl = document.getElementById('metric-decision-actions');
        const decRecEl = document.getElementById('metric-decision-rec');
        if (decStats && decStats.stats) {
            if (decActionsEl) decActionsEl.textContent = (decStats.stats.total_leads || 0).toLocaleString();
            if (decRecEl) decRecEl.textContent = (decStats.stats.total_customers || 0).toLocaleString();
        } else {
            const offText = serviceStatus.decision === 'offline' ? 'OFFLINE' : '0';
            if (decActionsEl) decActionsEl.textContent = offText;
            if (decRecEl) decRecEl.textContent = offText;
        }
    } catch(e) {
        console.error("Error loading Decision stats:", e);
    }
}

// List Loaders with Pagination & Boundary checks
async function fetchAndRenderTable(serviceKey, endpoint, pageKey, tbodyId, nextBtnId, prevBtnId, pageSpanId, rowParser) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center"><i class="ph ph-spinner ph-spin"></i> Loading...</td></tr>';
    
    const pageNum = pages[pageKey];
    
    try {
        const res = await apiFetch(serviceKey, `${endpoint}?page=${pageNum}&limit=${PAGE_LIMIT}`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        
        const data = await res.json();
        tbody.innerHTML = '';
        
        const records = data.data || [];
        const total = data.total || 0;
        const totalPages = data.total_pages || 0;

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center">No records available.</td></tr>';
            if (nextBtnId) document.getElementById(nextBtnId).disabled = true;
            if (prevBtnId) document.getElementById(prevBtnId).disabled = true;
            if (pageSpanId) document.getElementById(pageSpanId).textContent = `Page ${pageNum} of 0`;
            return;
        }

        let html = '';
        records.forEach((row, idx) => {
            html += rowParser(row, (pageNum - 1) * PAGE_LIMIT + idx + 1);
        });
        tbody.innerHTML = html;

        // Update pagination buttons
        if (pageSpanId) document.getElementById(pageSpanId).textContent = `Page ${pageNum} of ${totalPages} (Total: ${total})`;
        if (prevBtnId) document.getElementById(prevBtnId).disabled = (pageNum <= 1);
        if (nextBtnId) document.getElementById(nextBtnId).disabled = (pageNum >= totalPages);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--color-accent-anomaly)">Error connecting to port ${PORTS[serviceKey]}: ${e.message}</td></tr>`;
    }
}

// ------------------------------------------------------------------ //
// RETENTION VIEW LOADERS (Mirrors Original Insure AI dashboard)
// ------------------------------------------------------------------ //
async function loadRetentionDashboardData() {
    if (serviceStatus.retention === 'offline') {
        ['retention-stat-leads', 'retention-stat-cust', 'retention-stat-last-trained', 'retention-lead-acc', 'retention-cust-acc'].forEach(id => {
            document.getElementById(id).textContent = 'OFFLINE';
        });
        return;
    }

    // 1. Fetch `/dashboard` counts and accuracies
    try {
        const res = await apiFetch('retention', '/dashboard');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('retention-stat-leads').textContent = data.stats.total_leads.toLocaleString();
            document.getElementById('retention-stat-cust').textContent = data.stats.total_customers.toLocaleString();
            
            if (data.recent_training && data.recent_training.length > 0) {
                const d = parseUTCDate(data.recent_training[0].training_datetime, true);
                document.getElementById('retention-stat-last-trained').textContent = d ? (d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})) : 'Never';
            } else {
                document.getElementById('retention-stat-last-trained').textContent = 'Never';
            }

            if (data.stats.latest_lead_accuracy) {
                document.getElementById('retention-lead-acc').textContent = (data.stats.latest_lead_accuracy * 100).toFixed(1) + '%';
            }
            if (data.stats.latest_customer_accuracy) {
                document.getElementById('retention-cust-acc').textContent = (data.stats.latest_customer_accuracy * 100).toFixed(1) + '%';
            }
        }
    } catch(e) {
        console.error("Retention overview fetch error:", e);
    }

    // 2. Load Top 20 Leads (Non-paginated, static top list)
    try {
        const res = await apiFetch('retention', '/leads/top20');
        const tbody = document.getElementById('retention-top20-leads-tbody');
        tbody.innerHTML = '';
        if (res.ok) {
            const leads = await res.json();
            let html = '';
            leads.forEach(row => {
                const score = (row.propensity_ratio * 100).toFixed(1);
                const badge = row.propensity_ratio > 0.7 ? 'badge-high' : 'badge-medium';
                html += `
                    <tr style="cursor: pointer;" onclick="alert('Leads do not have a Customer 360 profile yet as they have no transactional history. Please convert them to a customer first!')" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                        <td><code>${row.lead_id}</code></td>
                        <td><span class="badge ${badge}">${score}%</span></td>
                        <td><i class="ph ph-lightbulb" style="color:var(--color-accent-retention); margin-right:6px"></i>${row.top_reasons[0] || 'N/A'}</td>
                        <td>${row.lead_source || 'N/A'}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html || '<tr><td colspan="4" style="text-align:center">No leads scored yet.</td></tr>';
        }
    } catch(e) {
        console.error(e);
    }

    // 3. Load Top 20 Customers (Non-paginated, static top list)
    try {
        const res = await apiFetch('retention', '/customers/high-risk');
        const tbody = document.getElementById('retention-top20-cust-tbody');
        tbody.innerHTML = '';
        if (res.ok) {
            const cust = await res.json();
            let html = '';
            cust.forEach(row => {
                const score = (row.churn_ratio * 100).toFixed(1);
                const badge = row.churn_ratio > 0.7 ? 'badge-high' : 'badge-low';
                html += `
                    <tr style="cursor: pointer;" onclick="loadCustomer360Profile('${row.customer_id}')" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                        <td><strong>#${row.customer_id}</strong><br><small style="color:var(--text-muted)">${row.name}</small></td>
                        <td><span class="badge ${badge}">${score}% Risk</span></td>
                        <td><i class="ph ph-warning-circle" style="color:var(--color-accent-anomaly); margin-right:6px"></i>${row.top_reasons[0] || 'N/A'}</td>
                        <td>${row.policy_type || 'N/A'}</td>
                        <td>${row.contact_number || 'N/A'}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center">No customers scored yet.</td></tr>';
        }
    } catch(e) {
        console.error(e);
    }
}

// ------------------------------------------------------------------ //
// ANOMALY VIEW LOADERS
// ------------------------------------------------------------------ //
function loadAnomalyLeads() {
    fetchAndRenderTable(
        'anomaly',
        '/leads/predicted/all',
        'anomalyLeads',
        'anomaly-leads-tbody',
        'next-anomaly-leads',
        'prev-anomaly-leads',
        'anomaly-leads-page',
        (row) => {
            const score = row.anomaly_score.toFixed(3);
            const badge = row.is_fraud ? 'badge-high' : 'badge-low';
            return `
                <tr style="cursor: pointer;" onclick="alert('Leads do not have a Customer 360 profile yet as they have no transactional history. Please convert them to a customer first!')" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                    <td><strong>${row.name}</strong></td>
                    <td><span class="badge ${badge}">${row.is_fraud ? 'Fraud Flag' : 'Healthy'}</span></td>
                    <td>${score}</td>
                    <td><i class="ph ph-shield-warning" style="color:var(--color-accent-anomaly); margin-right:6px"></i>${row.top_reasons[0] || 'N/A'}</td>
                    <td>${row.contact_number || 'N/A'}</td>
                </tr>
            `;
        }
    );
}

function loadAnomalyCustomers() {
    fetchAndRenderTable(
        'anomaly',
        '/customers/predicted/all',
        'anomalyCust',
        'anomaly-cust-tbody',
        'next-anomaly-cust',
        'prev-anomaly-cust',
        'anomaly-cust-page',
        (row) => {
            const score = row.anomaly_score.toFixed(3);
            const badge = row.is_fraud ? 'badge-high' : 'badge-low';
            const sentBadge = row.sentiment === 'Positive' ? 'badge-low' : (row.sentiment === 'Negative' ? 'badge-high' : 'badge-medium');
            return `
                <tr style="cursor: pointer;" onclick="document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); loadCustomer360Profile('${row.customer_id}')" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                    <td><strong>#${row.customer_id}</strong><br><small style="color:var(--text-muted)">${row.name}</small></td>
                    <td><span class="badge ${badge}">${row.is_fraud ? 'Anomaly Detected' : 'Healthy'}</span></td>
                    <td>${score}</td>
                    <td><span class="badge ${sentBadge}">${row.sentiment}</span></td>
                    <td>${row.contact_number || 'N/A'}</td>
                </tr>
            `;
        }
    );
}

// ------------------------------------------------------------------ //
// PREDICTIVE AI LOADERS
// ------------------------------------------------------------------ //
async function loadPredictiveData() {
    let totalCalls = 0;
    
    // Load leads/customers counts for header
    try {
        const resStats = await apiFetch('predictive', '/dashboard');
        if (resStats.ok) {
            const data = await resStats.json();
            totalCalls = data.stats.total_calls || 0;
            document.getElementById('predictive-stat-leads').textContent = data.stats.total_leads.toLocaleString();
            document.getElementById('predictive-stat-cust').textContent = data.stats.total_customers.toLocaleString();
        }
    } catch(e) {
        console.error("Predictive header count error:", e);
    }

    try {
        const res = await apiFetch('predictive', '/predictions/forecast?days=30');
        if (res.ok) {
            const data = await res.json();
            renderForecastChart(data.forecast);
        }
    } catch(e) {
        console.error("Prophet Chart load error:", e);
    }

    const tbody = document.getElementById('predictive-logs-tbody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center"><i class="ph ph-spinner ph-spin"></i> Loading call logs...</td></tr>';
    
    const pageNum = pages.predictiveCalls;
    const skipAmount = (pageNum - 1) * PAGE_LIMIT;

    try {
        const res = await apiFetch('predictive', `/call-logs?limit=${skipAmount + PAGE_LIMIT + 1}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        tbody.innerHTML = '';

        const pageRecords = data.slice(skipAmount, skipAmount + PAGE_LIMIT);
        const totalPages = Math.ceil(totalCalls / PAGE_LIMIT) || 1;

        if (pageRecords.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">No call logs available.</td></tr>';
            document.getElementById('next-predictive-calls').disabled = true;
            document.getElementById('prev-predictive-calls').disabled = (pageNum <= 1);
            document.getElementById('predictive-calls-page').textContent = `Page ${pageNum} of ${totalPages} (Total: ${totalCalls})`;
            return;
        }

        let html = '';
        pageRecords.forEach(row => {
            const outcomeBadge = row.outcome === 'conversion' ? 'badge-low' : (row.outcome === 'rejected' ? 'badge-high' : 'badge-medium');
            const date = parseUTCDate(row.call_date);
            const formattedDate = date ? (date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : 'N/A';
            html += `
                <tr style="cursor: pointer;" onclick="document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); loadCustomer360Profile('${row.customer_id}')" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                    <td><strong>${row.agent_id}</strong></td>
                    <td>${formattedDate}</td>
                    <td>${row.call_duration.toFixed(1)}s</td>
                    <td><span class="badge ${outcomeBadge}">${row.outcome}</span></td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        document.getElementById('predictive-calls-page').textContent = `Page ${pageNum} of ${totalPages} (Total: ${totalCalls})`;
        document.getElementById('prev-predictive-calls').disabled = (pageNum <= 1);
        document.getElementById('next-predictive-calls').disabled = (data.length <= skipAmount + PAGE_LIMIT);

    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-accent-anomaly)">Error loading call logs.</td></tr>`;
    }
}

// ------------------------------------------------------------------ //
// DECISION ENGINE LOADERS
// ------------------------------------------------------------------ //
function loadDecisionLeads() {
    fetchAndRenderTable(
        'decision',
        '/leads/predicted/all',
        'decisionLeads',
        'decision-leads-tbody',
        'next-decision-leads',
        'prev-decision-leads',
        'decision-leads-page',
        (row) => {
            const score = (row.propensity_ratio * 100).toFixed(1);
            const badge = row.propensity_ratio > 0.7 ? 'badge-high' : 'badge-medium';
            return `
                <tr style="cursor: pointer;" onclick="alert('Leads do not have a Customer 360 profile yet as they have no transactional history. Please convert them to a customer first!')" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                    <td><strong>${row.name}</strong></td>
                    <td><span class="badge ${badge}">${score}%</span></td>
                    <td style="font-size: 0.85rem; line-height: 1.5; padding: 12px 15px;"><i class="ph-fill ph-chat-centered-text" style="color:var(--color-accent-decision); margin-right:6px; float: left; margin-top: 3px;"></i><div style="margin-left: 25px;">${row.dialogue_prompt || row.top_reasons[0]}</div></td>
                    <td>${row.contact_number || 'N/A'}</td>
                </tr>
            `;
        }
    );
}

function loadDecisionCustomers() {
    fetchAndRenderTable(
        'decision',
        '/customers/predicted/all',
        'decisionCust',
        'decision-cust-tbody',
        'next-decision-cust',
        'prev-decision-cust',
        'decision-cust-page',
        (row) => {
            const score = (row.churn_ratio * 100).toFixed(1);
            const badge = row.churn_ratio > 0.7 ? 'badge-high' : 'badge-medium';
            return `
                <tr style="cursor: pointer;" onclick="document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); loadCustomer360Profile('${row.customer_id}')" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                    <td><strong>#${row.customer_id}</strong><br><small style="color:var(--text-muted)">${row.name}</small></td>
                    <td><span class="badge ${badge}">${score}%</span></td>
                    <td style="font-size: 0.85rem; line-height: 1.5; padding: 12px 15px;"><i class="ph-fill ph-navigation-arrow" style="color:var(--color-accent-anomaly); margin-right:6px; float: left; margin-top: 3px;"></i><div style="margin-left: 25px;">${row.dialogue_prompt || row.top_reasons[0]}</div></td>
                    <td>${row.contact_number || 'N/A'}</td>
                </tr>
            `;
        }
    );
}

// ------------------------------------------------------------------ //
// SPECIAL RETENTION EVENT ACTIONS (ALL LEADS/CUSTOMERS DIRECTORIES & MODALS)
// ------------------------------------------------------------------ //
function setupRetentionSpecialListeners() {
    const toggleModal = (modalId, show = true) => {
        const el = document.getElementById(modalId);
        if (el) {
            if (show) el.classList.add('active');
            else el.classList.remove('active');
        }
    };

    // Open/Close Leads Modal
    document.getElementById('retention-card-leads').addEventListener('click', () => {
        pages.modalLeads = 1;
        toggleModal('modal-all-leads', true);
        loadAllLeadsModal();
    });
    document.getElementById('close-modal-leads').addEventListener('click', () => toggleModal('modal-all-leads', false));

    // Open/Close Customers Modal
    document.getElementById('retention-card-cust').addEventListener('click', () => {
        pages.modalCustomers = 1;
        toggleModal('modal-all-customers', true);
        loadAllCustomersModal();
    });
    document.getElementById('close-modal-customers').addEventListener('click', () => toggleModal('modal-all-customers', false));

    // Open/Close History Modal
    document.getElementById('retention-card-last-trained').addEventListener('click', () => {
        toggleModal('modal-training-history', true);
        loadTrainingHistoryModal();
    });
    document.getElementById('close-modal-training').addEventListener('click', () => toggleModal('modal-training-history', false));

    // Modal Directory Pagination bindings
    document.getElementById('prev-modal-leads').addEventListener('click', () => {
        if (pages.modalLeads > 1) {
            pages.modalLeads--;
            loadAllLeadsModal();
        }
    });
    document.getElementById('next-modal-leads').addEventListener('click', () => {
        pages.modalLeads++;
        loadAllLeadsModal();
    });

    document.getElementById('prev-modal-customers').addEventListener('click', () => {
        if (pages.modalCustomers > 1) {
            pages.modalCustomers--;
            loadAllCustomersModal();
        }
    });
    document.getElementById('next-modal-customers').addEventListener('click', () => {
        pages.modalCustomers++;
        loadAllCustomersModal();
    });

    // Special Retrain trigger inside Retention Dashboard
    document.getElementById('retention-train-btn').addEventListener('click', () => {
        selectedRetrainPort = 8000;
        toggleModal('modal-training-progress', true);
        triggerDashboardRetraining();
    });

    // Special upload bindings for Retention View
    setupRetentionUploadHandlers();
}

// Load paginated list of ALL leads inside directory modal
function loadAllLeadsModal() {
    fetchAndRenderTable(
        'retention',
        '/leads/predicted/all',
        'modalLeads',
        'all-leads-tbody',
        'next-modal-leads',
        'prev-modal-leads',
        'modal-leads-page-indicator',
        (row) => {
            const score = (row.propensity_ratio * 100).toFixed(1);
            const badge = row.propensity_ratio > 0.7 ? 'badge-high' : 'badge-medium';
            return `
                <tr style="cursor: pointer;" onclick="alert('Leads do not have a Customer 360 profile yet as they have no transactional history. Please convert them to a customer first!')" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                    <td><code>${row.lead_id}</code></td>
                    <td><strong>${row.name}</strong></td>
                    <td><span class="badge ${badge}">${score}%</span></td>
                    <td>${row.top_reasons[0] || 'N/A'}</td>
                    <td><span class="badge" style="background:rgba(255,255,255,0.04); color:#fff">${row.lead_source || 'N/A'}</span></td>
                </tr>
            `;
        }
    );
}

// Load paginated list of ALL customers inside directory modal
function loadAllCustomersModal() {
    fetchAndRenderTable(
        'retention',
        '/customers/predicted/all',
        'modalCustomers',
        'all-customers-tbody',
        'next-modal-customers',
        'prev-modal-customers',
        'modal-customers-page-indicator',
        (row) => {
            const score = (row.churn_ratio * 100).toFixed(1);
            const badge = row.churn_ratio > 0.7 ? 'badge-high' : 'badge-low';
            const sentBadge = row.sentiment === 'Positive' ? 'badge-low' : (row.sentiment === 'Negative' ? 'badge-high' : 'badge-medium');
            return `
                <tr style="cursor: pointer;" onclick="document.getElementById('modal-all-customers').classList.remove('active'); loadCustomer360Profile('${row.customer_id}');" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                    <td><code>${row.customer_id}</code></td>
                    <td><strong>${row.name}</strong></td>
                    <td><span class="badge ${badge}">${score}% Risk</span></td>
                    <td>${row.top_reasons[0] || 'N/A'}</td>
                    <td><span class="badge ${sentBadge}">${row.sentiment}</span></td>
                    <td>${row.contact_number || 'N/A'}</td>
                </tr>
            `;
        }
    );
}

// Load training history inside modal log
async function loadTrainingHistoryModal() {
    const tbody = document.getElementById('training-history-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center"><i class="ph ph-spinner ph-spin"></i> Loading history...</td></tr>';
    
    try {
        const res = await apiFetch('retention', '/dashboard/training');
        if (res.ok) {
            const data = await res.json();
            const history = data.training_history || [];
            tbody.innerHTML = '';
            if (history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No model logs compiled.</td></tr>';
                return;
            }
            let html = '';
            history.forEach(row => {
                const dObj = parseUTCDate(row.training_datetime, true);
                const date = dObj ? dObj.toLocaleString() : 'N/A';
                const acc = (row.accuracy * 100).toFixed(1) + '%';
                html += `
                    <tr>
                        <td>${date}</td>
                        <td><span class="badge badge-low" style="text-transform: capitalize;">${row.model_type} Model</span></td>
                        <td><code>${row.model_version}</code></td>
                        <td><strong>${acc}</strong></td>
                        <td><code>${row.algorithm}</code></td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-accent-anomaly)">Error loading logs.</td></tr>';
    }
}

// Special upload/export events in Retention View
function setupRetentionUploadHandlers() {
    const uploadFile = async (inputEl, datasetType) => {
        const file = inputEl.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        
        appendToToastContainer("Uploading to Customer Retention...", "info");
        
        try {
            const res = await apiFetch('retention', `/upload/${datasetType}`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                appendToToastContainer(data.message || "Upload completed successfully!", "success");
                loadRetentionDashboardData();
            } else {
                const err = await res.json();
                appendToToastContainer(err.detail || "Upload error.", "error");
            }
        } catch(e) {
            appendToToastContainer("Connection error during upload.", "error");
        } finally {
            inputEl.value = '';
        }
    };

    // Upload triggers
    document.getElementById('retention-upload-leads-input').addEventListener('change', (e) => uploadFile(e.target, 'leads'));
    document.getElementById('retention-upload-cust-input').addEventListener('change', (e) => uploadFile(e.target, 'customers'));

    // Export triggers
    const triggerExport = async (datasetType) => {
        appendToToastContainer("Starting dataset export...", "info");
        try {
            const res = await apiFetch('retention', `/${datasetType}/export`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `retention_${datasetType}_export.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                appendToToastContainer("Dataset downloaded successfully!", "success");
            } else {
                appendToToastContainer("Export failed.", "error");
            }
        } catch(e) {
            appendToToastContainer("Connection error during export.", "error");
        }
    };

    document.getElementById('retention-export-leads-btn').addEventListener('click', () => triggerExport('leads'));
    document.getElementById('retention-export-cust-btn').addEventListener('click', () => triggerExport('customers'));
}

// Special Retrain modal progress triggers (mirrors previous progress logs)
async function triggerDashboardRetraining() {
    const logsContainer = document.getElementById('modal-training-logs');
    logsContainer.innerHTML = 'Initializing training pipeline on Port 8000...\n';
    
    try {
        const res = await apiFetch('retention', '/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: "Triggered from Retention System Info Panel" })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Retrain init failed");
        }

        const data = await res.json();
        const jobId = data.job_id;
        logsContainer.innerHTML += `Training Job started. ID: ${jobId}\nPolling status...\n`;
        
        if (trainingPollInterval) clearInterval(trainingPollInterval);
        
        trainingPollInterval = setInterval(async () => {
            try {
                const statusRes = await apiFetch('retention', `/train/status/${jobId}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    
                    if (statusData.logs && statusData.logs.length > 0) {
                        logsContainer.innerHTML = '';
                        statusData.logs.forEach(log => {
                            logsContainer.innerHTML += log + '\n';
                        });
                        logsContainer.scrollTop = logsContainer.scrollHeight;
                    }
                    
                    if (statusData.status === 'completed') {
                        clearInterval(trainingPollInterval);
                        logsContainer.innerHTML += `\n[+] COMPLETED! Model re-compiled successfully.\n`;
                        appendToToastContainer("Retraining Completed!", "success");
                        loadRetentionDashboardData();
                        setTimeout(() => {
                            document.getElementById('modal-training-progress').classList.remove('active');
                        }, 2500);
                    } else if (statusData.status === 'failed') {
                        clearInterval(trainingPollInterval);
                        logsContainer.innerHTML += `\n[-] FAILED: ${statusData.message || 'Unknown compilation error'}\n`;
                        appendToToastContainer("Retraining failed.", "error");
                        setTimeout(() => {
                            document.getElementById('modal-training-progress').classList.remove('active');
                        }, 3000);
                    }
                }
            } catch(e) {
                clearInterval(trainingPollInterval);
                logsContainer.innerHTML += `\n[-] Lost connection to backend polling loop.\n`;
                setTimeout(() => {
                    document.getElementById('modal-training-progress').classList.remove('active');
                }, 3000);
            }
        }, 1500);

    } catch(e) {
        logsContainer.innerHTML += `\n[-] Error initiating training: ${e.message}\n`;
        setTimeout(() => {
            document.getElementById('modal-training-progress').classList.remove('active');
        }, 3000);
    }
}

// ------------------------------------------------------------------ //
// CORE PAGINATION BINDINGS
// ------------------------------------------------------------------ //
function setupPaginationListeners() {
    const bindPagination = (prevId, nextId, pageKey, loadFunc) => {
        const prevBtn = document.getElementById(prevId);
        const nextBtn = document.getElementById(nextId);
        if (!prevBtn || !nextBtn) return;
        
        prevBtn.addEventListener('click', () => {
            if (pages[pageKey] > 1) {
                pages[pageKey]--;
                loadFunc();
            }
        });
        nextBtn.addEventListener('click', () => {
            pages[pageKey]++;
            loadFunc();
        });
    };

    bindPagination('prev-anomaly-leads', 'next-anomaly-leads', 'anomalyLeads', loadAnomalyLeads);
    bindPagination('prev-anomaly-cust', 'next-anomaly-cust', 'anomalyCust', loadAnomalyCustomers);
    
    bindPagination('prev-predictive-calls', 'next-predictive-calls', 'predictiveCalls', loadPredictiveData);
    
    bindPagination('prev-decision-leads', 'next-decision-leads', 'decisionLeads', loadDecisionLeads);
    bindPagination('prev-decision-cust', 'next-decision-cust', 'decisionCust', loadDecisionCustomers);
}

// Draw Predictive Forecast Chart.js
function renderForecastChart(forecastData) {
    const canvas = document.getElementById('forecastChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (forecastChartInstance) {
        forecastChartInstance.destroy();
    }

    const labels = forecastData.map(item => item.date);
    const values = forecastData.map(item => item.volume);

    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(192, 132, 252, 0.4)');
    gradient.addColorStop(1, 'rgba(192, 132, 252, 0.01)');

    forecastChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Forecasted Conversion Volume',
                data: values,
                borderColor: '#c084fc',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#c084fc',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#12141c',
                    titleColor: '#ffffff',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#64748b' },
                    title: { display: true, text: 'Time (Days)', color: '#94a3b8', font: { size: 13 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#64748b' },
                    title: { display: true, text: 'Conversion Volume (Leads)', color: '#94a3b8', font: { size: 13 } }
                }
            }
        }
    });
}

// Retrain model triggers (Ecosystem retrain console view)
async function triggerRetraining() {
    const key = Object.keys(PORTS).find(k => PORTS[k] === selectedRetrainPort);
    if (!key || serviceStatus[key] === 'offline') {
        appendToTerminal(`[-] Error: Service on port ${selectedRetrainPort} is offline.`);
        return;
    }

    clearTerminal();
    appendToTerminal(`[+] Initializing retraining on Port ${selectedRetrainPort} (${key.toUpperCase()})...`);
    
    const btn = document.getElementById('exec-train-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Training Model...</span>';

    try {
        const res = await apiFetch(key, '/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: "Triggered from Unified Dashboard Console" })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Training failed");
        }

        const data = await res.json();
        const jobId = data.job_id;
        appendToTerminal(`[+] Training started. Job ID: ${jobId}`);
        
        if (trainingPollInterval) clearInterval(trainingPollInterval);
        
        trainingPollInterval = setInterval(async () => {
            try {
                const statusRes = await apiFetch(key, `/train/status/${jobId}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    
                    if (statusData.logs && statusData.logs.length > 0) {
                        clearTerminal();
                        statusData.logs.forEach(log => appendToTerminal(log));
                    }
                    
                    if (statusData.status === 'completed') {
                        clearInterval(trainingPollInterval);
                        appendToTerminal(`\n[+] Retraining completed successfully! Model files updated.`);
                        appendToToastContainer("Subsystem retrained successfully!", "success");
                        btn.disabled = false;
                        btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i><span>Retrain Model</span>';
                    } else if (statusData.status === 'failed') {
                        clearInterval(trainingPollInterval);
                        appendToTerminal(`\n[-] Retraining process failed: ${statusData.message || 'unknown error'}`);
                        appendToToastContainer("Retraining failed.", "error");
                        btn.disabled = false;
                        btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i><span>Retrain Model</span>';
                    }
                }
            } catch(e) {
                clearInterval(trainingPollInterval);
                appendToTerminal(`\n[-] Log polling disconnected.`);
                btn.disabled = false;
                btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i><span>Retrain Model</span>';
            }
        }, 1500);

    } catch (e) {
        appendToTerminal(`[-] Error: ${e.message}`);
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i><span>Retrain Model</span>';
    }
}

// Load Recently Ingested Data entries to double-check uploads
async function loadRecentlyIngested() {
    const tbody = document.getElementById('recently-ingested-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center"><i class="ph ph-spinner ph-spin"></i> Fetching latest records...</td></tr>';
    
    if (serviceStatus[currentRecentService] === 'offline') {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-accent-anomaly)">Service is currently offline.</td></tr>';
        return;
    }

    try {
        // Fetch both leads and customers in parallel
        let leads = [];
        let customers = [];
        
        try {
            const resLeads = await apiFetch(currentRecentService, `/leads?skip=0&limit=10`);
            if (resLeads.ok) leads = await resLeads.json();
        } catch(e) { console.warn("Leads fetch failed:", e); }

        try {
            const resCust = await apiFetch(currentRecentService, `/customers?skip=0&limit=10`);
            if (resCust.ok) customers = await resCust.json();
        } catch(e) { console.warn("Customers fetch failed:", e); }

        // Format and combine
        let combined = [];
        leads.forEach(l => {
            combined.push({
                id: l.lead_id,
                name: l.full_name,
                details: `${l.occupation || 'N/A'} | Income: $${l.annual_income ? l.annual_income.toLocaleString() : '0'}`,
                date: parseUTCDate(l.created_at, currentRecentService === 'retention'),
                type: 'Lead'
            });
        });

        customers.forEach(c => {
            combined.push({
                id: c.customer_id,
                name: c.name,
                details: `Policy: ${c.policy_type || 'N/A'} | Premium: $${c.premium_amount ? c.premium_amount.toLocaleString() : '0'}`,
                date: parseUTCDate(c.created_at, currentRecentService === 'retention'),
                type: 'Customer'
            });
        });

        // Sort descending (latest first)
        combined.sort((a, b) => {
            const timeA = a.date ? a.date.getTime() : 0;
            const timeB = b.date ? b.date.getTime() : 0;
            return timeB - timeA;
        });

        const top10 = combined.slice(0, 10);

        tbody.innerHTML = '';
        if (top10.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">No records ingested in the database yet.</td></tr>';
            return;
        }

        let html = '';
        top10.forEach(row => {
            const dateStr = row.date ? row.date.toLocaleString() : 'N/A';
            const typeBadge = row.type === 'Lead' ? 'var(--color-accent-retention)' : 'var(--color-accent-decision)';
            html += `
                <tr>
                    <td><code>${row.id}</code></td>
                    <td><strong>${row.name}</strong></td>
                    <td>${row.details}</td>
                    <td>
                        <span class="badge" style="background:rgba(255,255,255,0.04); color:${typeBadge}; border:1px solid var(--border-color); margin-right:8px">${row.type}</span>
                        <span class="badge badge-low" style="background:rgba(255,255,255,0.04); color:#fff; border:1px solid var(--border-color)">${dateStr}</span>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-accent-anomaly)">Error loading database log: ${e.message}</td></tr>`;
    }
}

// Data center uploads and exports
function setupDataHandlers() {
    // Ingest submit
    document.getElementById('upload-submit-btn').addEventListener('click', async () => {
        const fileInput = document.getElementById('dataset-file-input');
        const serviceSelector = document.getElementById('upload-service-select');
        const datasetSelector = document.getElementById('upload-dataset-select');
        
        const file = fileInput.files[0];
        const serviceKey = serviceSelector.value;
        const datasetType = datasetSelector.value;
        
        if (!file) {
            appendToToastContainer("Select a CSV file first.", "warning");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        
        const uploadBtn = document.getElementById('upload-submit-btn');
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Uploading...</span>';
        
        try {
            const res = await apiFetch(serviceKey, `/upload/${datasetType}`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const result = await res.json();
                appendToToastContainer(result.message || "Ingested successfully!", "success");
                fileInput.value = '';
                
                // Instantly refresh Overview counts and Recently Ingested log!
                loadOverviewCounts();
                loadRecentlyIngested();
            } else {
                const err = await res.json();
                appendToToastContainer(err.detail || "Upload error.", "error");
            }
        } catch(e) {
            appendToToastContainer("Upload error: " + e.message, "error");
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="ph ph-upload-simple"></i><span>Upload Dataset</span>';
        }
    });

    // Export submit
    document.getElementById('export-submit-btn').addEventListener('click', async () => {
        const serviceKey = document.getElementById('export-service-select').value;
        const datasetType = document.getElementById('export-dataset-select').value;

        const exportBtn = document.getElementById('export-submit-btn');
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Exporting...</span>';

        try {
            const res = await apiFetch(serviceKey, `/${datasetType}/export`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${serviceKey}_${datasetType}_export.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                appendToToastContainer("Dataset download successfully initiated!", "success");
            } else {
                appendToToastContainer("Export failed.", "error");
            }
        } catch(e) {
            appendToToastContainer("Export error: " + e.message, "error");
                    } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<i class="ph ph-download-simple"></i><span>Export Dataset</span>';
        }
    });

    // BoW NLP Retraining submit
    const bowTrainBtn = document.getElementById('bow-train-btn');
    if (bowTrainBtn) {
        bowTrainBtn.addEventListener('click', async () => {
            const fileInput = document.getElementById('bow-retrain-input');
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                appendToToastContainer("Please select a BoW training dataset (CSV) first.", "warning");
                return;
            }

            const formData = new FormData();
            formData.append("file", fileInput.files[0]);

            bowTrainBtn.disabled = true;
            bowTrainBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Training Model...</span>';

            try {
                // The endpoint is on port 8000 (retention service)
                const res = await apiFetch('retention', '/customer360/retrain_bow', {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    const result = await res.json();
                    appendToToastContainer(result.message || "BoW Model trained successfully!", "success");
                    fileInput.value = '';
                } else {
                    const err = await res.json();
                    appendToToastContainer(err.detail || "Training error.", "error");
                }
            } catch(e) {
                appendToToastContainer("Training error: " + e.message, "error");
            } finally {
                bowTrainBtn.disabled = false;
                bowTrainBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i><span>Train BoW Model</span>';
            }
        });
    }

    // Customer Retention Charts
}

// Console Terminal Utilities
function clearTerminal() {
    document.getElementById('console-output').innerHTML = '';
}

function appendToTerminal(text) {
    const terminal = document.getElementById('console-output');
    terminal.innerHTML += text + '\n';
    terminal.scrollTop = terminal.scrollHeight;
}

// Toast alerts helper
function appendToToastContainer(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ph ph-info';
    if (type === 'success') icon = 'ph ph-check-circle';
    if (type === 'error') icon = 'ph ph-x-circle';
    if (type === 'warning') icon = 'ph ph-warning';

    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// ==========================================
// Customer 360 Logic
// ==========================================
setTimeout(() => {
    const searchInput = document.getElementById('customer-360-search');
    const dropdown = document.getElementById('search-results-dropdown');
    let searchTimeout;

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                dropdown.style.display = 'none';
                return;
            }
            
            searchTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`http://127.0.0.1:${PORTS.retention}/customer360/search/${encodeURIComponent(query)}`);
                    if (response.ok) {
                        const results = await response.json();
                        dropdown.innerHTML = '';
                        if (results.length === 0) {
                            dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-secondary);">No results found.</div>';
                        } else {
                            results.forEach(r => {
                                const div = document.createElement('div');
                                div.style.padding = '10px';
                                div.style.cursor = 'pointer';
                                div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                                let nameDisplay = `<strong>${r.name}</strong>`;
                                if (r.original_name) {
                                    nameDisplay += ` <span style="color:var(--color-accent-decision); font-size:0.75rem; margin-left: 5px;"><i class="ph-fill ph-magic-wand"></i> (Auto-corrected from ${r.original_name})</span>`;
                                }
                                div.innerHTML = `${nameDisplay} <span style="color:var(--text-secondary); font-size:0.85rem">(${r.customer_id}) - ${r.city}</span>`;
                                div.addEventListener('mouseover', () => div.style.background = 'rgba(255,255,255,0.1)');
                                div.addEventListener('mouseout', () => div.style.background = 'transparent');
                                div.addEventListener('click', () => {
                                    dropdown.style.display = 'none';
                                    searchInput.value = '';
                                    loadCustomer360Profile(r.customer_id);
                                });
                                dropdown.appendChild(div);
                            });
                        }
                        dropdown.style.display = 'block';
                    }
                } catch (err) {
                    console.error("Search error", err);
                }
            }, 300);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    const closeBtn = document.getElementById('close-modal-c360');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('modal-customer-360').classList.remove('active');
        });
    }
});

async function loadCustomer360Profile(customerId) {
    console.log(`Loading Customer 360 profile for ${customerId}...`);
    
    try {
        // Fetch base profile from Port 8000
        const profileRes = await fetch(`http://127.0.0.1:${PORTS.retention}/customer360/${customerId}`);
        if (!profileRes.ok) throw new Error("Profile not found");
        const profile = await profileRes.json();
        
        // Populate basic UI
        let titleText = `${profile.name} (${profile.customer_id})`;
        if (profile.original_name) {
            titleText += ` <span style="color:var(--color-accent-decision); font-size:0.9rem; margin-left: 10px; font-weight: normal;"><i class="ph-fill ph-magic-wand"></i> Auto-corrected from: ${profile.original_name}</span>`;
        }
        document.getElementById('c360-title-name').innerHTML = titleText;
        document.getElementById('c360-feedback-notes').textContent = `"${profile.feedback_notes || 'No notes provided.'}"`;
        
        const kwContainer = document.getElementById('c360-keywords-container');
        kwContainer.innerHTML = '';
        profile.behavioral_keywords.forEach(kw => {
            const span = document.createElement('span');
            span.style.padding = '4px 8px';
            span.style.background = 'rgba(255,255,255,0.1)';
            span.style.borderRadius = '4px';
            span.style.fontSize = '0.8rem';
            span.textContent = kw;
            kwContainer.appendChild(span);
        });
        
        document.getElementById('c360-score-sentiment').textContent = profile.bow_sentiment_score;
        document.getElementById('c360-score-behavior').textContent = profile.behavioral_keywords.length > 0 ? "Active" : "Passive";
        document.getElementById('c360-score-churn').textContent = `${profile.churn_risk_percent}%`;
        document.getElementById('c360-score-propensity').textContent = `${profile.propensity_percent}%`;
        
        const policiesTbody = document.getElementById('c360-policies-tbody');
        policiesTbody.innerHTML = '';
        let grandTotalSpent = 0;
        profile.policies.forEach(p => {
            const tr = document.createElement('tr');
            const statusColor = p.status === 'Active' ? '#00ff66' : (p.status === 'Expired' ? '#ffcc00' : '#ff3366');
            const totalSpent = p.premium_amount * 5;
            grandTotalSpent += totalSpent;
            tr.innerHTML = `
                <td>${p.policy_type}</td>
                <td style="color:${statusColor}">${p.status}</td>
                <td>${p.start_date.split('-')[0]} - ${p.end_date.split('-')[0]}</td>
                <td>$${p.premium_amount.toFixed(2)}/yr<br><small style="color:#00ff66">LTV: $${totalSpent.toFixed(2)}</small></td>
                <td>${p.claim_history}</td>
            `;
            policiesTbody.appendChild(tr);
        });
        document.getElementById('c360-total-spent').textContent = `$${grandTotalSpent.toFixed(2)}`;
        
        // Fetch 5-step Strategy from Port 8003
        document.getElementById('c360-strategy-objective').textContent = "Compiling strategy...";
        document.getElementById('c360-strategy-steps').innerHTML = '<li><i class="ph ph-spinner ph-spin"></i> Analyzing...</li>';
        
        const strategyRes = await fetch(`http://127.0.0.1:${PORTS.decision}/strategy/prescriptive_workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: profile.customer_id,
                sentiment_score: profile.bow_sentiment_score,
                churn_risk_percent: profile.churn_risk_percent,
                propensity_percent: profile.propensity_percent,
                behavioral_keywords: profile.behavioral_keywords,
                policies: profile.policies.map(p => ({ policy_type: p.policy_type, status: p.status }))
            })
        });
        
        if (strategyRes.ok) {
            const strategy = await strategyRes.json();
            document.getElementById('c360-strategy-objective').textContent = strategy.primary_objective;
            const stepsUl = document.getElementById('c360-strategy-steps');
            stepsUl.innerHTML = '';
            strategy.workflow_steps.forEach((step, idx) => {
                const li = document.createElement('li');
                li.style.background = 'rgba(0,0,0,0.2)';
                li.style.padding = '10px';
                li.style.borderRadius = '6px';
                li.style.borderLeft = '3px solid #64b5f6';
                li.innerHTML = `<strong>Step ${idx+1}:</strong> ${step.replace(/^\\d+\\.\\s*/, '')}`;
                stepsUl.appendChild(li);
            });
        }
        
        // Show modal
        document.getElementById('modal-customer-360').classList.add('active');
        
    } catch (err) {
        console.error(err);
        console.error("Error loading Customer 360 profile", err);
    }
}

// ==========================================
// NEW DOMAIN FORECASTING (Insurance, Grocery, Logistics, Maintenance)
// ==========================================

const chartInstances = {
    insurance: null,
    grocery: null,
    logistics: null,
    maintenance: null
};

async function initMultiDomainOptions() {
    // Retail Options
    try {
        const res = await fetch(`http://127.0.0.1:8002/retail/options`);
        const data = await res.json();
        window.retailOptions = data;
    } catch(e) { console.log(e); }
    
    // Insurance Options
    try {
        const res = await fetch(`http://127.0.0.1:8002/insurance_5model/options`);
        const data = await res.json();
        window.insuranceOptions = data;
    } catch(e) { console.log(e); }
    
    // Grocery Options
    try {
        const res = await fetch(`http://127.0.0.1:8002/grocery/options`);
        const data = await res.json();
        window.groceryOptions = data;
    } catch(e) { console.log(e); }
    
    // Logistics Options
    try {
        const res = await fetch(`http://127.0.0.1:8002/logistics/options`);
        const data = await res.json();
        window.logisticsOptions = data;
    } catch(e) { console.log(e); }

    // Maintenance Options
    try {
        const res = await fetch(`http://127.0.0.1:8002/maintenance/options`);
        const data = await res.json();
        window.maintenanceOptions = data;
    } catch(e) { console.log(e); }
}

async function loadDomainForecast(domain) {
    bindDomainSelects(domain);
    const store = document.getElementById(`${domain}-store-select`)?.value || 'Decathlon';
    const level = document.getElementById(`${domain}-level-select`)?.value || 'store';
    const horizon = document.getElementById(`${domain}-horizon-select`)?.value || '90';
    const nameSelect = document.getElementById(`${domain}-item-select`);
    const name = nameSelect && nameSelect.style.display !== 'none' ? nameSelect.value : '';
    
    const overlay = document.getElementById(`${domain}-loading-overlay`);
    if (overlay) overlay.style.display = 'flex';
    
    try {
        let endpoint = `http://127.0.0.1:8002/${domain}/forecast`;
        if (domain === 'insurance') endpoint = `http://127.0.0.1:8002/insurance_5model/forecast`;
        
        const url = new URL(endpoint);
        url.searchParams.append('store', store);
        url.searchParams.append('level', level);
        url.searchParams.append('horizon_days', horizon);
        if (name) url.searchParams.append('name', name);
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        renderDomainChart(domain, data);
        
        if (data.reasoning) {
            document.getElementById(`${domain}-reasoning-text`).innerHTML = data.reasoning;
        }
        
        if (domain === 'logistics' && data.vessel_recommendations) {
            const panel = document.getElementById('vessel-recommendation-panel');
            if (panel) {
                panel.style.display = 'block';
                document.getElementById('rec-vessel-name').textContent = data.vessel_recommendations.recommended_vessel;
                document.getElementById('rec-imo-number').textContent = `IMO: ${data.vessel_recommendations.imo_number}`;
                document.getElementById('rec-utilization').textContent = data.vessel_recommendations.capacity_utilization;
                document.getElementById('rec-speed').textContent = `Optimal Cruising Speed: ${data.vessel_recommendations.optimal_speed}`;
                document.getElementById('rec-reasoning').textContent = data.vessel_recommendations.reasoning;
            }
        }
    } catch (e) {
        appendToToastContainer('Forecast failed: ' + e.message, 'error');
    } finally {
        document.getElementById(`${domain}-loading-overlay`).style.display = 'none';
    }
}

function renderDomainChart(domain, data) {
    const ctx = document.getElementById(`${domain}ForecastChart`);
    if (!ctx) return;
    
    if (chartInstances[domain]) {
        chartInstances[domain].destroy();
    }
    
    let yLabel = 'Value';
    if (domain === 'maintenance') yLabel = 'Vibration (mm/s)';
    else if (domain === 'logistics') yLabel = 'Freight (Tons)';
    else if (domain === 'retail') yLabel = 'Sales Volume';
    else if (domain === 'grocery') yLabel = 'Units Sold';
    else if (domain === 'insurance') yLabel = 'Policy Renewals';

    chartInstances[domain] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'Historical Data',
                    data: data.history,
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0
                },
                {
                    label: 'Prophet (Seasonality)',
                    data: data.predictions.Prophet,
                    borderColor: '#2196F3',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'XGBoost (Momentum)',
                    data: data.predictions.XGBoost,
                    borderColor: '#4CAF50',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'SARIMA (Autoregression)',
                    data: data.predictions.SARIMA,
                    borderColor: '#FF9800',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Holt-Winters (Trend)',
                    data: data.predictions.HoltWinters,
                    borderColor: '#9C27B0',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'SMA (Baseline)',
                    data: data.predictions.SMA,
                    borderColor: '#F44336',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: 'rgba(255,255,255,0.7)' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.y;
                            if (val === null || val === undefined || isNaN(val)) return null;
                            
                            let lines = [`${context.dataset.label}: ${val.toFixed(2)}`];
                            
                            if (context.dataIndex === 0) return lines; 
                            
                            let prevVal = context.dataset.data[context.dataIndex - 1];
                            if (prevVal === null || prevVal === undefined) {
                                prevVal = context.chart.data.datasets[0].data[context.dataIndex - 1];
                            }
                            
                            if (!prevVal || isNaN(prevVal) || prevVal === 0) return lines;
                            
                            const percentChange = ((val - prevVal) / prevVal) * 100;
                            
                            let reason = "";
                            if (domain === 'maintenance') {
                                if (percentChange > 10) reason = `↳ Why? Severe vibration spike! Escalator motor might be failing.`;
                                else if (percentChange > 3) reason = `↳ Why? Slight increase in friction, likely due to heavy foot traffic.`;
                                else if (percentChange < -10) reason = `↳ Why? Large drop in vibration, indicating recent lubrication or repair.`;
                                else if (percentChange < -3) reason = `↳ Why? Smoother operation than normal, equipment is running well.`;
                                else reason = `↳ Why? Normal operational vibration levels for this escalator.`;
                            } else if (domain === 'logistics') {
                                if (percentChange > 10) reason = `↳ Why? Huge freight surge! Likely a major supply chain shipment arriving.`;
                                else if (percentChange > 3) reason = `↳ Why? Modest increase in shipping volume for the upcoming week.`;
                                else if (percentChange < -10) reason = `↳ Why? Sharp drop in freight, possibly due to port delays or off-season.`;
                                else if (percentChange < -3) reason = `↳ Why? Lighter cargo load than usual along this shipping lane.`;
                                else reason = `↳ Why? Standard, consistent freight volumes being transported.`;
                            } else if (domain === 'insurance') {
                                if (percentChange > 10) reason = `↳ Why? Big jump in renewals! Recent ad campaigns are paying off.`;
                                else if (percentChange > 3) reason = `↳ Why? Steady uptick in policy renewals as expiration dates approach.`;
                                else if (percentChange < -10) reason = `↳ Why? Significant drop. High churn rate detected in this demographic.`;
                                else if (percentChange < -3) reason = `↳ Why? Fewer renewals this period, possibly due to competitor pricing.`;
                                else reason = `↳ Why? Normal, baseline retention rate for this policy.`;
                            } else if (domain === 'grocery') {
                                if (percentChange > 10) reason = `↳ Why? Panic buying or major holiday driving massive grocery sales!`;
                                else if (percentChange > 3) reason = `↳ Why? Weekend grocery restock trends pushing sales up.`;
                                else if (percentChange < -10) reason = `↳ Why? Large drop in perishable sales, risk of food spoilage!`;
                                else if (percentChange < -3) reason = `↳ Why? Slower weekday foot traffic leading to fewer units sold.`;
                                else reason = `↳ Why? Typical, everyday grocery purchasing behavior.`;
                            } else {
                                // Default Retail
                                if (percentChange > 10) reason = `↳ Why? Huge jump! Likely a major holiday or successful promotion.`;
                                else if (percentChange > 3) reason = `↳ Why? Noticeable increase. Demand is picking up nicely.`;
                                else if (percentChange < -10) reason = `↳ Why? Big drop. Probably the end of a busy season or a quiet week.`;
                                else if (percentChange < -3) reason = `↳ Why? Slight decrease, which is totally normal for this time of year.`;
                                else reason = `↳ Why? Things are steady and consistent right now.`;
                            }
                            
                            lines.push(reason);
                            return lines;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    title: { display: true, text: yLabel, color: 'rgba(255,255,255,0.9)' },
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: 'rgba(255,255,255,0.5)' } 
                },
                x: { 
                    title: { display: true, text: 'Forecast Horizon (Date)', color: 'rgba(255,255,255,0.9)' },
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: 'rgba(255,255,255,0.5)' } 
                }
            }
        }
    });
}

function bindDomainSelects(domain) {
    const storeSelect = document.getElementById(`${domain}-store-select`);
    const levelSelect = document.getElementById(`${domain}-level-select`);
    const nameSelect = document.getElementById(`${domain}-item-select`);
    const horizonSelect = document.getElementById(`${domain}-horizon-select`);

    if (storeSelect && storeSelect.options.length === 0) {
        storeSelect.innerHTML = "";
        const options = window[`${domain}Options`];
        if (options && options.stores) {
            options.stores.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s;
                opt.textContent = s;
                storeSelect.appendChild(opt);
            });
        }
    }
    
    if (storeSelect && !storeSelect.dataset.bound) {
        storeSelect.addEventListener('change', () => {
            if (levelSelect) levelSelect.value = 'store';
            if (nameSelect) nameSelect.style.display = 'none';
            loadDomainForecast(domain);
        });
        storeSelect.dataset.bound = 'true';
    }
    
    if(!levelSelect) return;

    if (!levelSelect.dataset.bound) {
        levelSelect.addEventListener('change', (e) => {
            const level = e.target.value;
            const options = window[`${domain}Options`];
            
            if (level === 'store') {
                nameSelect.style.display = 'none';
            } else {
                nameSelect.style.display = 'block';
                nameSelect.innerHTML = '';
                
                let list = [];
                if (level === 'category') list = options.categories || [];
                if (level === 'product') list = options.products || [];
                
                // For maintenance, the equipment names are prefixed with the store name. Filter out the others.
                if (domain === 'maintenance') {
                    const selectedStore = storeSelect ? storeSelect.value : '';
                    if (selectedStore) {
                        list = list.filter(item => item.startsWith(selectedStore + '_'));
                    }
                }
                
                list.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item;
                    opt.textContent = item;
                    nameSelect.appendChild(opt);
                });
            }
            loadDomainForecast(domain);
        });
        levelSelect.dataset.bound = 'true';
    }
    
    if (!nameSelect.dataset.bound) {
        nameSelect.addEventListener('change', () => loadDomainForecast(domain));
        nameSelect.dataset.bound = 'true';
    }
    if (horizonSelect && !horizonSelect.dataset.bound) {
        horizonSelect.addEventListener('change', () => loadDomainForecast(domain));
        horizonSelect.dataset.bound = 'true';
    }
}



// Wire up events for new tabs
(async () => {
    setTimeout(async () => {
        await initMultiDomainOptions();
        
        bindDomainSelects('retail');
        bindDomainSelects('insurance');
        bindDomainSelects('grocery');
        bindDomainSelects('logistics');
        bindDomainSelects('maintenance');
        
        const runMaintBtn = document.getElementById('run-maintenance-btn');
        if (runMaintBtn) runMaintBtn.addEventListener('click', runMaintenanceScan);
        
        // Tab click listeners to trigger loads
        document.querySelectorAll('.hub-card[data-target]').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.getAttribute('data-target');
                if (target === 'insurance-forecast-tab') loadDomainForecast('insurance');
                if (target === 'grocery-forecast-tab') loadDomainForecast('grocery');
                if (target === 'logistics-forecast-tab') loadDomainForecast('logistics');
                if (target === 'maintenance-tab') loadDomainForecast('maintenance');
            });
        });
    }, 1000);
})();

window.simulateDomainTraining = async function(domain) {
    const terminal = document.getElementById(`${domain}-training-terminal`);
    if (!terminal) return;
    
    // Show terminal, hide chart temporarily
    terminal.style.display = "block";
    terminal.innerHTML = `<div class="terminal-cursor">Initializing 5-Model Ensemble Pipeline for ${domain}...</div>`;
    
    const logs = [
        `[System] Fetching latest historical datasets for ${domain}... DONE`,
        `[System] Preprocessing missing values and standardizing time index... DONE`,
        `[Prophet] Fitting yearly and weekly seasonality matrices...`,
        `[Prophet] Model converged. Seasonality components extracted.`,
        `[XGBoost] Generating lag features and rolling averages...`,
        `[XGBoost] Tuning hyperparameters (n_estimators=50, max_depth=5)... DONE`,
        `[XGBoost] Fitting gradient booster to historical residuals... DONE`,
        `[SARIMA] Calculating autoregressive and moving average terms (p,d,q)...`,
        `[SARIMA] Optimized AIC. Model fitted successfully.`,
        `[Holt-Winters] Smoothing exponential trends... DONE`,
        `[SMA] Calculating baseline simple moving average... DONE`,
        `[Ensemble] Validating outputs across 5 dimensions...`,
        `[System] Retraining sequence completed in ${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 9)}s.`,
        `[System] Reloading live forecast dashboard...`
    ];
    
    let delay = 300;
    for (let i = 0; i < logs.length; i++) {
        await new Promise(resolve => setTimeout(resolve, delay));
        terminal.innerHTML += `<div>> ${logs[i]}</div>`;
        terminal.scrollTop = terminal.scrollHeight;
        delay = Math.floor(Math.random() * 300) + 100; // random delay between logs
    }
    
    await new Promise(resolve => setTimeout(resolve, 800));
    terminal.style.display = "none";
    
    // Refresh the forecast
    loadDomainForecast(domain);
}

// Bind retrain buttons and simulated upload inputs
const bindRetrainButtons = () => {
    ['retail', 'insurance', 'grocery', 'logistics', 'maintenance'].forEach(domain => {
        const btn = document.getElementById(`btn-retrain-${domain}`);
        if (btn && !btn.dataset.bound) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.simulateDomainTraining(domain);
            });
            btn.dataset.bound = "true";
        }

        const uploadInput = document.getElementById(`upload-${domain}-dataset`);
        if (uploadInput && !uploadInput.dataset.bound) {
            uploadInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const fileName = e.target.files[0].name;
                    appendToToastContainer(`Dataset '${fileName}' uploaded successfully. Ready for retraining.`, "success");
                    e.target.value = ""; // Reset input
                }
            });
            uploadInput.dataset.bound = "true";
        }
    });
};

// Attempt binding immediately and also loop just in case
bindRetrainButtons();
setInterval(bindRetrainButtons, 1000);
