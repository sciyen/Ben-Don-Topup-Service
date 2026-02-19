import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { postBatchBalances, postBatchCheckout } from '../api';
import './AutoCheckout.css';

/**
 * Parses HTML table content from clipboard into checkout rows.
 * Designed for dinbendon.net's HTML table structure.
 *
 * Structure:
 *   - Header row: <tr> with <th> elements
 *   - Data rows: <tr> with <td> elements
 *   - Customer name: td.mergeKey → div.infoContent
 *   - Numeric columns: td.calculated → div.infoContent
 *   - Item notes: td.cell → div.cellContent (variable count per row)
 *
 * Auto-detects the 還剩 column index from header text.
 * Rows with amount=0 are included (shown as invalid in preview for editing).
 */
function parseHtmlTable(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tableRows = doc.querySelectorAll('tr');

    if (tableRows.length <= 1) return null; // Need at least header + 1 data row

    // --- Auto-detect column indices from header row ---
    const headerCells = tableRows[0].querySelectorAll('th, td');
    const headers = Array.from(headerCells).map((h) => h.textContent.replace(/\s+/g, ' ').trim());
    let amountColIndex = headers.findIndex((h) => h.includes('還剩'));
    if (amountColIndex === -1) amountColIndex = 3; // fallback

    // Find where the fixed data columns end and item cells begin.
    // Fixed columns: name, 數量, 已付, 還剩, 總共, 批次 (indices 0–5)
    const ITEM_START_COL = 6;

    const rows = [];

    for (let i = 1; i < tableRows.length; i++) {
        const cells = tableRows[i].querySelectorAll('td');
        if (cells.length === 0) continue;

        // Customer name from first cell (td.mergeKey → div.infoContent)
        const customer = (cells[0]?.textContent || '').trim();
        if (!customer) continue;

        // Amount from 還剩 column
        const amountText = (cells[amountColIndex]?.textContent || '').trim();
        const amount = parseFloat(amountText);

        // Item notes from td.cell elements (columns 6+)
        // These contain item names inside cellContent divs with nested <a><span>
        const noteParts = [];
        for (let j = ITEM_START_COL; j < cells.length; j++) {
            // Get the primary content text, ignoring sub-divs with styling info
            const contentDiv = cells[j].querySelector('.cellContent');
            const text = (contentDiv || cells[j]).textContent.trim();
            if (text) noteParts.push(text);
        }
        const note = noteParts.join(', ');

        // Include rows even with amount=0 (user can edit in preview)
        // NaN amounts become 0
        rows.push({ customer, amount: isNaN(amount) ? 0 : amount, note, id: uuidv4() });
    }

    return rows.length > 0 ? rows : null;
}

/**
 * Fallback parser for plain tab-delimited text.
 * Also auto-detects 還剩 column from header.
 */
function parseTabText(text) {
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length <= 1) return [];

    // Detect amount column from header
    const headerCols = lines[0].split('\t').map((c) => c.trim());
    let amountColIndex = headerCols.findIndex((h) => h.includes('還剩'));
    if (amountColIndex === -1) amountColIndex = 3;

    const ITEM_START_COL = 6;
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');

        const customer = (cols[0] || '').trim();
        if (!customer) continue;

        const amountStr = (cols[amountColIndex] || '').trim();
        const amount = parseFloat(amountStr);

        const noteParts = cols.slice(ITEM_START_COL).map((c) => c.trim()).filter(Boolean);
        const note = noteParts.join(', ');

        rows.push({ customer, amount: isNaN(amount) ? 0 : amount, note, id: uuidv4() });
    }

    return rows;
}

/**
 * Auto Checkout page.
 * Clipboard Paste → Parse → Preview (with balances) → Execute batch.
 */
function AutoCheckout({ user, onNavigate }) {
    // Phases: 'paste', 'preview', 'result'
    const [phase, setPhase] = useState('paste');
    const [rows, setRows] = useState([]); // parsed rows with id
    const [balances, setBalances] = useState({}); // { customer: balance }
    const [loading, setLoading] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [message, setMessage] = useState(null);
    const [pastePreview, setPastePreview] = useState(''); // raw text preview of what was pasted

    /**
     * Read structured HTML from clipboard and parse.
     * Uses the Clipboard API to access text/html content, which preserves
     * table cell structure from web sources.
     */
    const handlePasteFromClipboard = useCallback(async () => {
        setMessage(null);

        try {
            // Try the modern Clipboard API (requires HTTPS or localhost)
            const clipboardItems = await navigator.clipboard.read();
            let parsed = null;
            let rawText = '';

            for (const item of clipboardItems) {
                // Prefer HTML for structural parsing
                if (item.types.includes('text/html')) {
                    const htmlBlob = await item.getType('text/html');
                    const html = await htmlBlob.text();
                    parsed = parseHtmlTable(html);
                }

                // Also grab plain text for preview display
                if (item.types.includes('text/plain')) {
                    const textBlob = await item.getType('text/plain');
                    rawText = await textBlob.text();
                }
            }

            // Fallback: if HTML parsing found no rows, try tab-delimited text
            if (!parsed || parsed.length === 0) {
                parsed = parseTabText(rawText);
            }

            if (!parsed || parsed.length === 0) {
                setMessage({ type: 'error', text: 'No valid rows found in clipboard. Copy a table from the source website first.' });
                return;
            }

            setPastePreview(rawText);
            setRows(parsed);
            setLoading(true);

            // Batch-fetch balances for all unique customers
            const uniqueCustomers = [...new Set(parsed.map((r) => r.customer))];
            const bals = await postBatchBalances(uniqueCustomers, user.token);
            setBalances(bals);
            setPhase('preview');
        } catch (err) {
            // Clipboard API may fail if permission denied or not supported
            if (err.name === 'NotAllowedError') {
                setMessage({
                    type: 'error',
                    text: 'Clipboard access denied. Please allow clipboard permission in your browser, or use the manual paste area below.',
                });
            } else {
                setMessage({ type: 'error', text: `Failed to read clipboard: ${err.message}` });
            }
        } finally {
            setLoading(false);
        }
    }, [user.token]);

    /**
     * Fallback: handle paste event on a hidden contentEditable div or textarea.
     * Used when Clipboard API is not available.
     */
    const handleManualPaste = useCallback(async (e) => {
        e.preventDefault();
        setMessage(null);

        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');

        let parsed = null;

        // Try HTML first
        if (html) {
            parsed = parseHtmlTable(html);
        }

        // Fallback to tab-delimited text
        if (!parsed || parsed.length === 0) {
            parsed = parseTabText(text);
        }

        if (!parsed || parsed.length === 0) {
            setMessage({ type: 'error', text: 'No valid rows found. Check the data format.' });
            return;
        }

        setPastePreview(text);
        setRows(parsed);
        setLoading(true);

        try {
            const uniqueCustomers = [...new Set(parsed.map((r) => r.customer))];
            const bals = await postBatchBalances(uniqueCustomers, user.token);
            setBalances(bals);
            setPhase('preview');
        } catch (err) {
            setMessage({ type: 'error', text: `Failed to fetch balances: ${err.message}` });
        } finally {
            setLoading(false);
        }
    }, [user.token]);

    /**
     * Compute cumulative "after checkout" balances.
     * Handles duplicate customers within the batch.
     */
    const computeAfterBalances = useCallback(() => {
        const cumulative = {};
        return rows.map((row) => {
            const key = row.customer;
            const currentBal = balances[key] || 0;
            const alreadyDeducted = cumulative[key] || 0;
            const afterBal = currentBal - alreadyDeducted - row.amount;
            cumulative[key] = (cumulative[key] || 0) + row.amount;

            // Invalid if: amount <= 0, or insufficient balance
            const valid = row.amount > 0 && afterBal >= 0;
            return { ...row, currentBalance: currentBal - alreadyDeducted, afterBalance: afterBal, valid };
        });
    }, [rows, balances]);

    const enrichedRows = phase === 'preview' ? computeAfterBalances() : [];
    const validCount = enrichedRows.filter((r) => r.valid).length;
    const invalidCount = enrichedRows.filter((r) => !r.valid).length;

    /**
     * Update a row field (inline editing).
     */
    const updateRow = (id, field, value) => {
        setRows((prev) =>
            prev.map((r) =>
                r.id === id
                    ? { ...r, [field]: field === 'amount' ? (parseFloat(value) || 0) : value }
                    : r
            )
        );
    };

    /**
     * Remove a row from the batch.
     */
    const removeRow = (id) => {
        setRows((prev) => prev.filter((r) => r.id !== id));
    };

    /**
     * Execute the batch checkout.
     */
    const handleExecute = useCallback(async () => {
        if (validCount === 0) return;

        setExecuting(true);
        setMessage(null);

        try {
            // Send ALL rows — backend will skip invalid ones
            const submitRows = rows.map(({ customer, amount, note }) => ({ customer, amount, note }));
            const result = await postBatchCheckout(submitRows, uuidv4(), user.token);

            const parts = [`✅ ${result.transactionCount} transactions recorded`];
            if (result.skippedCount > 0) {
                parts.push(`(${result.skippedCount} skipped)`);
            }

            setMessage({ type: 'success', text: parts.join(' ') });
            setPhase('result');

            setRows([]);
            setBalances({});
            setPastePreview('');
        } catch (err) {
            setMessage({ type: 'error', text: `❌ ${err.message}` });
        } finally {
            setExecuting(false);
        }
    }, [rows, validCount, user.token]);

    /**
     * Reset to paste phase.
     */
    const handleClear = () => {
        setPhase('paste');
        setRows([]);
        setBalances({});
        setMessage(null);
        setPastePreview('');
    };

    /**
     * Format amount for display.
     */
    const fmt = (n) =>
        new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

    return (
        <div className="checkout-page">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <span className="header-icon">🧾</span>
                    <h1>Auto Checkout</h1>
                </div>
                <div className="header-right">
                    <button className="btn-nav" onClick={() => onNavigate('dashboard')}>
                        ← Dashboard
                    </button>
                    <div className="user-info">
                        {user.picture && <img src={user.picture} alt="" className="user-avatar" />}
                        <span className="user-name">{user.name}</span>
                    </div>
                </div>
            </header>

            <main className="checkout-main">
                {message && (
                    <div className={`alert alert-${message.type}`}>{message.text}</div>
                )}

                {/* Phase: Paste */}
                {phase === 'paste' && (
                    <section className="card paste-card">
                        <h2>📋 Paste Checkout Data</h2>
                        <p className="paste-hint">
                            Copy a table from the source website, then click the button below or paste directly into the area.
                            Column 0 = Customer, Column 3 (還剩) = Amount, Columns 6+ = Note.
                        </p>

                        {/* Primary: Clipboard API button */}
                        <button
                            className="btn-clipboard"
                            onClick={handlePasteFromClipboard}
                            disabled={loading}
                        >
                            {loading ? '⏳ Loading balances…' : '📎 Read from Clipboard'}
                        </button>

                        <div className="paste-divider">
                            <span>or paste directly here (Ctrl+V)</span>
                        </div>

                        {/* Fallback: paste area that captures paste event with HTML data */}
                        <div
                            className="paste-area"
                            contentEditable
                            onPaste={handleManualPaste}
                            suppressContentEditableWarning
                            data-placeholder="Click here and press Ctrl+V to paste table data…"
                        />

                        {pastePreview && (
                            <div className="paste-preview-label">
                                Last pasted: {pastePreview.split('\n').length} lines detected
                            </div>
                        )}
                    </section>
                )}

                {/* Phase: Preview */}
                {phase === 'preview' && (
                    <section className="card preview-card">
                        <div className="preview-header">
                            <h2>📊 Preview ({enrichedRows.length} rows)</h2>
                            <div className="preview-actions">
                                <button className="btn-back" onClick={handleClear}>
                                    ↩ Clear & Re-paste
                                </button>
                                <button
                                    className="btn-execute"
                                    onClick={handleExecute}
                                    disabled={validCount === 0 || executing || enrichedRows.length === 0}
                                >
                                    {executing ? '⏳ Executing…' : `⚡ Execute (${validCount} valid)`}
                                </button>
                            </div>
                        </div>

                        {invalidCount > 0 && (
                            <div className="alert alert-error">
                                ⚠️ {invalidCount} row(s) will be skipped (amount = 0 or insufficient balance).
                                Only the {validCount} valid row(s) will be checked out.
                            </div>
                        )}

                        <div className="preview-table-wrap">
                            <table className="preview-table">
                                <thead>
                                    <tr>
                                        <th className="col-status"></th>
                                        <th>Customer</th>
                                        <th>Amount</th>
                                        <th>Note</th>
                                        <th>Balance</th>
                                        <th>After</th>
                                        <th className="col-action"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enrichedRows.map((row) => (
                                        <tr key={row.id} className={row.valid ? '' : 'row-invalid'}>
                                            <td className="col-status">
                                                {row.valid ? (
                                                    <span className="status-ok">✓</span>
                                                ) : (
                                                    <span className="status-fail">✗</span>
                                                )}
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={row.customer}
                                                    onChange={(e) => updateRow(row.id, 'customer', e.target.value)}
                                                    className="cell-input"
                                                    disabled={executing}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={row.amount}
                                                    onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                                                    className="cell-input cell-amount"
                                                    min="0.01"
                                                    step="0.01"
                                                    disabled={executing}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={row.note}
                                                    onChange={(e) => updateRow(row.id, 'note', e.target.value)}
                                                    className="cell-input"
                                                    disabled={executing}
                                                />
                                            </td>
                                            <td className="cell-balance">{fmt(row.currentBalance)}</td>
                                            <td className={`cell-balance ${row.afterBalance < 0 ? 'balance-negative' : ''}`}>
                                                {fmt(row.afterBalance)}
                                            </td>
                                            <td className="col-action">
                                                <button
                                                    className="btn-remove"
                                                    onClick={() => removeRow(row.id)}
                                                    title="Remove row"
                                                    disabled={executing}
                                                >
                                                    ×
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="preview-summary">
                            <span>Total: <strong>{fmt(enrichedRows.reduce((s, r) => s + r.amount, 0))}</strong></span>
                            <span>Rows: <strong>{enrichedRows.length}</strong></span>
                            <span>
                                Invalid: <strong className={enrichedRows.filter((r) => !r.valid).length > 0 ? 'text-red' : ''}>
                                    {enrichedRows.filter((r) => !r.valid).length}
                                </strong>
                            </span>
                        </div>
                    </section>
                )}

                {/* Phase: Result */}
                {phase === 'result' && (
                    <section className="card result-card">
                        <div className="result-icon">🎉</div>
                        <h2>Batch Checkout Complete</h2>
                        <button className="btn-parse" onClick={handleClear}>
                            Start New Checkout
                        </button>
                    </section>
                )}
            </main>
        </div>
    );
}

export default AutoCheckout;
