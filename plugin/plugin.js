/**
 * Ben-Don Top-Up Bookmarklet Plugin
 * Injects checkout UI into dinbendon.net order tables.
 *
 * Usage (bookmarklet):
 *   javascript:void((function(){var s=document.createElement('script');s.src='https://YOUR_DOMAIN/plugin.js?v='+Date.now();document.body.appendChild(s)})())
 *
 * Configuration: set these before deploying.
 */
(function () {
    'use strict';

    // ─── Configuration ───────────────────────────────────
    const CONFIG = {
        API_BASE: 'http://localhost:3001',           // Backend API URL
        AUTH_PAGE: 'http://localhost:5173/auth.html', // Auth popup URL (on our domain)
        GOOGLE_CLIENT_ID: '',                        // Set your Google Client ID here
    };

    // ─── Guard: prevent double injection ─────────────────
    if (window.__BEN_DON_LOADED) {
        // Already loaded — just refresh balances
        if (window.__BEN_DON_REFRESH) window.__BEN_DON_REFRESH();
        return;
    }
    window.__BEN_DON_LOADED = true;

    // ─── State ───────────────────────────────────────────
    let authToken = null;   // Google ID token (in-memory only)
    let userName = null;
    let balances = {};      // { customerName: balance }
    const checkedOutCustomers = new Set(); // track successful checkouts across DOM rebuilds

    // ─── Utils ───────────────────────────────────────────

    function uuid() {
        return crypto.randomUUID?.() ||
            'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
    }

    function fmt(n) {
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
    }

    function decodeJwt(token) {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch { return null; }
    }

    // ─── API helpers ─────────────────────────────────────

    async function apiFetch(path, options = {}) {
        if (!authToken) throw new Error('Not authenticated');

        const res = await fetch(`${CONFIG.API_BASE}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                ...(options.headers || {}),
            },
        });

        const json = await res.json();

        if (res.status === 401) {
            authToken = null;
            userName = null;
            updatePanelState();
            throw new Error('Session expired. Please log in again.');
        }

        if (!res.ok) {
            throw new Error(json.error || `API error ${res.status}`);
        }

        return json;
    }

    async function fetchBatchBalances(customers) {
        return apiFetch('/api/balance/batch', {
            method: 'POST',
            body: JSON.stringify({ customers }),
        });
    }

    async function execSpend(customer, amount, note) {
        return apiFetch('/api/spend', {
            method: 'POST',
            body: JSON.stringify({ customer, amount, note, idempotencyKey: uuid() }),
        });
    }

    async function execBatchCheckout(rows) {
        return apiFetch('/api/checkout/batch', {
            method: 'POST',
            body: JSON.stringify({ rows, idempotencyKey: uuid() }),
        });
    }

    // ─── Auth (popup flow) ───────────────────────────────

    function openLoginPopup() {
        const url = `${CONFIG.AUTH_PAGE}?client_id=${encodeURIComponent(CONFIG.GOOGLE_CLIENT_ID)}`;
        const w = 420, h = 520;
        const left = (screen.width - w) / 2;
        const top = (screen.height - h) / 2;
        window.open(url, 'BenDonAuth', `width=${w},height=${h},left=${left},top=${top}`);
    }

    window.addEventListener('message', function (event) {
        if (event.data?.type === 'BEN_DON_AUTH' && event.data.credential) {
            authToken = event.data.credential;
            const payload = decodeJwt(authToken);
            userName = payload?.name || payload?.email || 'User';
            updatePanelState();
            refreshAllBalances();
        }
    });

    function logout() {
        authToken = null;
        userName = null;
        balances = {};
        updatePanelState();
        clearRowInjections();
    }

    // ─── Inject CSS ──────────────────────────────────────

    function injectStyles() {
        const style = document.createElement('style');
        style.id = 'bendon-styles';
        style.textContent = `
            .bendon-panel {
                position: fixed; top: 10px; right: 10px; z-index: 99999;
                background: rgba(15, 12, 41, 0.95); color: #fff;
                border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;
                padding: 14px 18px; min-width: 240px;
                font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                backdrop-filter: blur(12px);
            }
            .bendon-panel-title {
                font-weight: 700; font-size: 14px; margin-bottom: 8px;
                display: flex; align-items: center; gap: 6px;
            }
            .bendon-panel-status {
                font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 10px;
            }
            .bendon-panel-status.bendon-logged-in { color: #86efac; }
            .bendon-panel-btns {
                display: flex; gap: 6px; flex-wrap: wrap;
            }
            .bendon-btn {
                border: none; border-radius: 8px; padding: 6px 14px; cursor: pointer;
                font-size: 12px; font-weight: 600; font-family: inherit;
                transition: all 0.15s ease;
            }
            .bendon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .bendon-btn-login { background: #6c63ff; color: #fff; }
            .bendon-btn-login:hover:not(:disabled) { background: #5a52e0; }
            .bendon-btn-logout { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
            .bendon-btn-logout:hover:not(:disabled) { background: rgba(255,255,255,0.15); }
            .bendon-btn-refresh { background: #0ea5e9; color: #fff; }
            .bendon-btn-refresh:hover:not(:disabled) { background: #0284c7; }
            .bendon-btn-checkoutall { background: #f59e0b; color: #fff; }
            .bendon-btn-checkoutall:hover:not(:disabled) { background: #d97706; }
            .bendon-panel-msg {
                margin-top: 8px; font-size: 11px; max-width: 220px; word-break: break-word;
            }
            .bendon-msg-error { color: #fca5a5; }
            .bendon-msg-success { color: #86efac; }

            /* Per-row injected cell */
            th.bendon-th, td.bendon-td {
                text-align: center; padding: 4px 8px; vertical-align: middle;
                font-family: 'Segoe UI', system-ui, sans-serif;
            }
            th.bendon-th { font-size: 11px; color: #555; font-weight: 600; }
            .bendon-cell-wrap {
                display: flex; flex-direction: column; align-items: center; gap: 3px;
                font-size: 12px;
            }
            .bendon-balance { font-size: 11px; color: #666; }
            .bendon-balance-ok { color: #16a34a; }
            .bendon-balance-low { color: #dc2626; font-weight: 600; }
            .bendon-row-btn {
                border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer;
                font-size: 11px; font-weight: 600; font-family: inherit;
                transition: all 0.15s ease;
            }
            .bendon-row-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .bendon-row-checkout { background: #22c55e; color: #fff; }
            .bendon-row-checkout:hover:not(:disabled) { background: #16a34a; }
            .bendon-row-done { background: #dcfce7; color: #166534; }
            .bendon-row-fail { background: #fee2e2; color: #991b1b; }
            .bendon-row-msg { font-size: 10px; max-width: 120px; word-break: break-word; }
        `;
        document.head.appendChild(style);
    }

    // ─── Floating Control Panel ──────────────────────────

    let panelEl = null;
    let panelStatusEl = null;
    let panelMsgEl = null;
    let loginBtn = null;
    let logoutBtn = null;
    let refreshBtn = null;
    let checkoutAllBtn = null;

    function createPanel() {
        panelEl = document.createElement('div');
        panelEl.className = 'bendon-panel';
        panelEl.innerHTML = `
            <div class="bendon-panel-title">💰 Ben-Don Top-Up</div>
            <div class="bendon-panel-status" id="bendon-status">Not logged in</div>
            <div class="bendon-panel-btns">
                <button class="bendon-btn bendon-btn-login" id="bendon-login">🔑 Login</button>
                <button class="bendon-btn bendon-btn-logout" id="bendon-logout" style="display:none">Logout</button>
                <button class="bendon-btn bendon-btn-refresh" id="bendon-refresh" style="display:none">🔄 Refresh</button>
                <button class="bendon-btn bendon-btn-checkoutall" id="bendon-checkoutall" style="display:none">⚡ Checkout All</button>
            </div>
            <div class="bendon-panel-msg" id="bendon-msg"></div>
        `;
        document.body.appendChild(panelEl);

        panelStatusEl = document.getElementById('bendon-status');
        panelMsgEl = document.getElementById('bendon-msg');
        loginBtn = document.getElementById('bendon-login');
        logoutBtn = document.getElementById('bendon-logout');
        refreshBtn = document.getElementById('bendon-refresh');
        checkoutAllBtn = document.getElementById('bendon-checkoutall');

        loginBtn.addEventListener('click', openLoginPopup);
        logoutBtn.addEventListener('click', logout);
        refreshBtn.addEventListener('click', function () { refreshAllBalances(); });
        checkoutAllBtn.addEventListener('click', handleCheckoutAll);
    }

    function updatePanelState() {
        if (authToken) {
            panelStatusEl.textContent = `✓ Logged in as ${userName}`;
            panelStatusEl.className = 'bendon-panel-status bendon-logged-in';
            loginBtn.style.display = 'none';
            logoutBtn.style.display = '';
            refreshBtn.style.display = '';
            checkoutAllBtn.style.display = '';
        } else {
            panelStatusEl.textContent = 'Not logged in';
            panelStatusEl.className = 'bendon-panel-status';
            loginBtn.style.display = '';
            logoutBtn.style.display = 'none';
            refreshBtn.style.display = 'none';
            checkoutAllBtn.style.display = 'none';
        }
        panelMsgEl.textContent = '';
        panelMsgEl.className = 'bendon-panel-msg';
    }

    function showPanelMsg(text, type) {
        panelMsgEl.textContent = text;
        panelMsgEl.className = `bendon-panel-msg bendon-msg-${type}`;
    }

    // ─── Table Parsing & Row Injection ───────────────────

    function getTable() {
        return document.querySelector('table.tiles.mergeView');
    }

    function getDataRows() {
        const table = getTable();
        if (!table) return [];
        const rows = table.querySelectorAll('tbody > tr');
        // Skip header row (first tr with th elements)
        return Array.from(rows).filter(function (tr) {
            return tr.querySelector('td.mergeKey');
        });
    }

    function parseRow(tr) {
        const cells = tr.querySelectorAll('td');
        const customer = (tr.querySelector('td.mergeKey .infoContent')?.textContent || '').trim();
        // Use column 3 (還剩, total) as the amount
        const totalCell = cells[3];
        const amount = parseFloat((totalCell?.querySelector('.infoContent')?.textContent || '').trim()) || 0;

        // Items from td.cell elements
        const items = Array.from(tr.querySelectorAll('td.cell .cellContent'))
            .map(function (el) { return el.textContent.trim(); })
            .filter(Boolean)
            .join(', ');

        return { customer, amount, note: items };
    }

    /**
     * Click the "付清 »" link in a row to sync dinbendon's payment status.
     * This triggers dinbendon's own Wicket AJAX handler.
     */
    function clickDinbendonPaid(tr) {
        const paidLink = tr.querySelector('td.textNoWrap a');
        if (paidLink) {
            try { paidLink.click(); } catch (e) { /* best-effort */ }
        }
    }

    function injectHeaderCell() {
        const table = getTable();
        if (!table) return;
        const headerRow = table.querySelector('tbody > tr');
        if (!headerRow || headerRow.querySelector('.bendon-th')) return;

        const th = document.createElement('th');
        th.className = 'bendon-th';
        th.textContent = 'Top-Up';
        headerRow.appendChild(th);
    }

    function injectRowCells() {
        const rows = getDataRows();
        rows.forEach(function (tr) {
            // Skip if already injected
            if (tr.querySelector('.bendon-td')) return;

            const data = parseRow(tr);
            const td = document.createElement('td');
            td.className = 'bendon-td';
            td.dataset.customer = data.customer;
            td.dataset.amount = data.amount;
            td.dataset.note = data.note;

            const wrap = document.createElement('div');
            wrap.className = 'bendon-cell-wrap';

            // Balance display
            const balSpan = document.createElement('span');
            balSpan.className = 'bendon-balance';
            balSpan.textContent = '—';

            // Checkout button
            const btn = document.createElement('button');

            // Restore "Done" state if this customer was already checked out
            if (checkedOutCustomers.has(data.customer)) {
                btn.className = 'bendon-row-btn bendon-row-done';
                btn.textContent = '✓ Done';
                btn.disabled = true;
            } else {
                btn.className = 'bendon-row-btn bendon-row-checkout';
                btn.textContent = `Checkout $${fmt(data.amount)}`;
                btn.disabled = true;
            }

            btn.addEventListener('click', function () {
                handleSingleCheckout(tr, data, btn, balSpan, msgSpan);
            });

            // Message
            const msgSpan = document.createElement('span');
            msgSpan.className = 'bendon-row-msg';

            wrap.appendChild(balSpan);
            wrap.appendChild(btn);
            wrap.appendChild(msgSpan);
            td.appendChild(wrap);
            tr.appendChild(td);
        });
    }

    function updateRowBalances() {
        const rows = getDataRows();
        rows.forEach(function (tr) {
            const td = tr.querySelector('.bendon-td');
            if (!td) return;

            const customer = td.dataset.customer;
            const amount = parseFloat(td.dataset.amount) || 0;
            const bal = balances[customer];
            const balSpan = td.querySelector('.bendon-balance');
            const btn = td.querySelector('.bendon-row-btn');

            if (bal === undefined) {
                balSpan.textContent = '—';
                balSpan.className = 'bendon-balance';
                btn.disabled = true;
                return;
            }

            balSpan.textContent = `Balance: $${fmt(bal)}`;

            // Skip if already checked out
            if (btn.classList.contains('bendon-row-done')) return;

            if (amount <= 0) {
                balSpan.className = 'bendon-balance';
                btn.disabled = true;
                btn.textContent = 'No amount';
            } else if (bal >= amount) {
                balSpan.className = 'bendon-balance bendon-balance-ok';
                btn.disabled = false;
                btn.className = 'bendon-row-btn bendon-row-checkout';
                btn.textContent = `Checkout $${fmt(amount)}`;
            } else {
                balSpan.className = 'bendon-balance bendon-balance-low';
                btn.disabled = true;
                btn.className = 'bendon-row-btn bendon-row-fail';
                btn.textContent = 'Insufficient';
            }
        });
    }

    function clearRowInjections() {
        document.querySelectorAll('.bendon-td, .bendon-th').forEach(function (el) {
            el.remove();
        });
    }

    // ─── Actions ─────────────────────────────────────────

    async function refreshAllBalances() {
        if (!authToken) return;

        showPanelMsg('Fetching balances…', 'success');
        refreshBtn.disabled = true;

        try {
            const rows = getDataRows();
            const customers = [...new Set(rows.map(function (tr) {
                return parseRow(tr).customer;
            }).filter(Boolean))];

            if (customers.length === 0) {
                showPanelMsg('No rows found in table.', 'error');
                return;
            }

            // Inject UI if not yet done
            injectHeaderCell();
            injectRowCells();

            balances = await fetchBatchBalances(customers);
            updateRowBalances();

            showPanelMsg(`✓ ${customers.length} balances loaded`, 'success');
        } catch (err) {
            showPanelMsg(err.message, 'error');
        } finally {
            refreshBtn.disabled = false;
        }
    }

    // Expose for re-injection guard
    window.__BEN_DON_REFRESH = refreshAllBalances;

    async function handleSingleCheckout(tr, data, btn, balSpan, msgSpan) {
        if (!data.customer || data.amount <= 0) return;

        btn.disabled = true;
        btn.textContent = '⏳…';
        msgSpan.textContent = '';

        try {
            await execSpend(data.customer, data.amount, data.note);

            btn.className = 'bendon-row-btn bendon-row-done';
            btn.textContent = '✓ Done';
            msgSpan.textContent = '';
            checkedOutCustomers.add(data.customer);

            // Update local balance
            if (balances[data.customer] !== undefined) {
                balances[data.customer] -= data.amount;
                balSpan.textContent = `Balance: $${fmt(balances[data.customer])}`;
            }

            // Sync dinbendon's UI — click their "付清 »" link
            clickDinbendonPaid(tr);
        } catch (err) {
            btn.className = 'bendon-row-btn bendon-row-fail';
            btn.textContent = 'Failed';
            msgSpan.textContent = err.message;
            msgSpan.style.color = '#dc2626';
            // Re-enable retry after 2 seconds
            setTimeout(function () {
                if (!btn.classList.contains('bendon-row-done')) {
                    btn.className = 'bendon-row-btn bendon-row-checkout';
                    btn.textContent = `Retry $${fmt(data.amount)}`;
                    btn.disabled = false;
                }
            }, 2000);
        }
    }

    async function handleCheckoutAll() {
        if (!authToken) return;

        checkoutAllBtn.disabled = true;
        checkoutAllBtn.textContent = '⏳ Processing…';

        try {
            const tableRows = getDataRows();
            const rows = [];
            const eligibleTrs = [];

            tableRows.forEach(function (tr) {
                const td = tr.querySelector('.bendon-td');
                if (!td) return;

                const btn = td.querySelector('.bendon-row-btn');
                // Skip already done or insufficient
                if (btn?.classList.contains('bendon-row-done')) return;

                const data = parseRow(tr);
                if (data.customer && data.amount > 0) {
                    rows.push({ customer: data.customer, amount: data.amount, note: data.note });
                    eligibleTrs.push(tr);
                }
            });

            if (rows.length === 0) {
                showPanelMsg('No eligible rows to checkout.', 'error');
                return;
            }

            const result = await execBatchCheckout(rows);

            showPanelMsg(
                `✓ ${result.transactionCount} checked out` +
                (result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : ''),
                'success'
            );

            // Mark successfully checked-out rows as done
            // The backend returns which rows were skipped — mark the rest as done
            const skippedIndices = new Set((result.skippedRows || []).map(function (s) { return s.index - 1; }));

            eligibleTrs.forEach(function (tr, i) {
                const btn = tr.querySelector('.bendon-row-btn');
                const msgSpan = tr.querySelector('.bendon-row-msg');
                const balSpan = tr.querySelector('.bendon-balance');

                if (skippedIndices.has(i)) {
                    // Skipped
                    if (btn) {
                        btn.className = 'bendon-row-btn bendon-row-fail';
                        btn.textContent = 'Skipped';
                    }
                    const reason = (result.skippedRows || []).find(function (s) { return s.index - 1 === i; });
                    if (msgSpan && reason) {
                        msgSpan.textContent = reason.reason;
                        msgSpan.style.color = '#dc2626';
                    }
                } else {
                    // Success
                    if (btn) {
                        btn.className = 'bendon-row-btn bendon-row-done';
                        btn.textContent = '✓ Done';
                        btn.disabled = true;
                    }
                    if (msgSpan) msgSpan.textContent = '';

                    // Update local balance
                    const data = parseRow(tr);
                    checkedOutCustomers.add(data.customer);
                    if (balances[data.customer] !== undefined) {
                        balances[data.customer] -= data.amount;
                        if (balSpan) {
                            balSpan.textContent = `Balance: $${fmt(balances[data.customer])}`;
                        }
                    }

                    // Sync dinbendon's UI — click their "付清 »" link
                    clickDinbendonPaid(tr);
                }
            });

        } catch (err) {
            showPanelMsg(err.message, 'error');
        } finally {
            checkoutAllBtn.disabled = false;
            checkoutAllBtn.textContent = '⚡ Checkout All';
        }
    }

    // ─── MutationObserver: re-inject when Wicket AJAX replaces DOM ──

    let mutationObserver = null;

    function startTableObserver() {
        const table = getTable();
        if (!table || mutationObserver) return;

        mutationObserver = new MutationObserver(function (mutations) {
            // Check if our injected cells were removed (Wicket replaces tbody)
            const needsReinject = mutations.some(function (m) {
                return m.type === 'childList' && m.removedNodes.length > 0;
            });

            if (needsReinject && authToken) {
                // Debounce: Wicket may fire multiple mutations
                clearTimeout(startTableObserver._timer);
                startTableObserver._timer = setTimeout(function () {
                    console.log('💰 Table DOM changed — re-injecting Top-Up column');
                    injectHeaderCell();
                    injectRowCells();
                    updateRowBalances();
                }, 200);
            }
        });

        // Observe the table and its parent (Wicket may replace the entire table)
        mutationObserver.observe(table.parentNode || table, {
            childList: true,
            subtree: true,
        });
    }

    // ─── Initialize ──────────────────────────────────────

    function init() {
        injectStyles();
        createPanel();
        updatePanelState();
        startTableObserver();
        console.log('💰 Ben-Don Top-Up bookmarklet loaded');
    }

    // Run on DOM ready or immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
