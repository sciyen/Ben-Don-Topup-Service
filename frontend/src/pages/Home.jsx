import './Home.css';

/**
 * Home page — introduction and workflow guide for Ben-Don Top-Up system.
 * Explains the ordering, payment, staging, checkout, and refund flows.
 */
function Home() {
    return (
        <div className="home-page">
            {/* Hero Section */}
            <div className="home-hero">
                <h1 className="home-title">
                    <span className="home-emoji">💰</span> Ben-Don Top-Up
                </h1>
                <p className="home-subtitle">
                    A prepaid balance system for <strong>dinbendon.net</strong> group meal orders.
                    Buyers top up their account in advance. When the cashier processes orders,
                    the meal cost is deducted from each buyer's balance automatically.
                </p>
            </div>

            {/* Roles Section */}
            <div className="home-section">
                <h2 className="section-title">👥 Roles</h2>
                <div className="role-cards">
                    <div className="role-card">
                        <div className="role-icon">🛒</div>
                        <h3>Buyer</h3>
                        <p>Orders meals on dinbendon.net. Tops up balance and <em>stages</em> funds before checkout.</p>
                    </div>
                    <div className="role-card">
                        <div className="role-icon">💼</div>
                        <h3>Cashier</h3>
                        <p>Processes orders using the bookmarklet plugin. Deducts from staged balances or collects cash.</p>
                    </div>
                    <div className="role-card">
                        <div className="role-icon">🔑</div>
                        <h3>Admin</h3>
                        <p>Full access — can manage users, top up accounts, and perform all cashier actions.</p>
                    </div>
                </div>
            </div>

            {/* Workflow Overview */}
            <div className="home-section">
                <h2 className="section-title">📋 How It Works</h2>

                {/* Flow Diagram: Overview */}
                <div className="flow-diagram">
                    <div className="flow-title">Order & Payment Overview</div>
                    <div className="flow-steps">
                        <div className="flow-step">
                            <div className="step-num">1</div>
                            <div className="step-content">
                                <strong>Order a Meal</strong>
                                <span>Place your order on dinbendon.net as usual</span>
                            </div>
                        </div>
                        <div className="flow-arrow">→</div>
                        <div className="flow-step">
                            <div className="step-num">2</div>
                            <div className="step-content">
                                <strong>Prepare Payment</strong>
                                <span>Stage balance or prepare cash</span>
                            </div>
                        </div>
                        <div className="flow-arrow">→</div>
                        <div className="flow-step">
                            <div className="step-num">3</div>
                            <div className="step-content">
                                <strong>Cashier Checkout</strong>
                                <span>Cashier processes all orders via plugin</span>
                            </div>
                        </div>
                        <div className="flow-arrow">→</div>
                        <div className="flow-step step-done">
                            <div className="step-num">✓</div>
                            <div className="step-content">
                                <strong>Done!</strong>
                                <span>Balance deducted, order marked paid</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Buyer: With Account */}
            <div className="home-section">
                <h2 className="section-title">🟢 Buyer with Account (Balance Payment)</h2>
                <p className="section-desc">
                    If you have a registered account with a topped-up balance, you need to
                    <strong> stage </strong> the amount you want to authorize for checkout.
                    Staging tells the cashier "I'm ready to pay this amount."
                </p>
                <div className="flow-diagram flow-green">
                    <div className="flow-title">Balance Payment Flow</div>
                    <div className="flow-vertical">
                        <div className="flow-v-step">
                            <div className="fv-icon">📝</div>
                            <div className="fv-text">
                                <strong>1. Register & Top Up</strong>
                                <span>Create an account, ask admin/cashier to top up your balance</span>
                            </div>
                        </div>
                        <div className="flow-v-arrow">↓</div>
                        <div className="flow-v-step">
                            <div className="fv-icon">🍜</div>
                            <div className="fv-text">
                                <strong>2. Place Order</strong>
                                <span>Order your meal on dinbendon.net</span>
                            </div>
                        </div>
                        <div className="flow-v-arrow">↓</div>
                        <div className="flow-v-step highlight-step">
                            <div className="fv-icon">📌</div>
                            <div className="fv-text">
                                <strong>3. Stage Money</strong>
                                <span>Go to <em>My Account</em> → enter the meal amount → click <em>Stage</em></span>
                            </div>
                        </div>
                        <div className="flow-v-arrow">↓</div>
                        <div className="flow-v-step">
                            <div className="fv-icon">💼</div>
                            <div className="fv-text">
                                <strong>4. Cashier Checkout</strong>
                                <span>Cashier sees your staged balance → clicks <em>Checkout</em> → amount deducted</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="info-box">
                    <span className="info-icon">💡</span>
                    <span>
                        <strong>Why staging?</strong> Staging prevents the cashier from spending your balance without
                        your authorization. You control exactly how much can be deducted.
                    </span>
                </div>
            </div>

            {/* Buyer: Without Account (Cash) */}
            <div className="home-section">
                <h2 className="section-title">🟡 Buyer without Account (Cash Payment)</h2>
                <p className="section-desc">
                    No account? No problem. You can pay for your meal in cash.
                    The cashier will handle the transaction through the <em>Shared Deposit</em> virtual account.
                </p>
                <div className="flow-diagram flow-amber">
                    <div className="flow-title">Cash Payment Flow</div>
                    <div className="flow-vertical">
                        <div className="flow-v-step">
                            <div className="fv-icon">🍜</div>
                            <div className="fv-text">
                                <strong>1. Place Order</strong>
                                <span>Order your meal on dinbendon.net as a guest or unregistered user</span>
                            </div>
                        </div>
                        <div className="flow-v-arrow">↓</div>
                        <div className="flow-v-step">
                            <div className="fv-icon">💵</div>
                            <div className="fv-text">
                                <strong>2. Pay Cash</strong>
                                <span>Give cash to the cashier for the meal amount</span>
                            </div>
                        </div>
                        <div className="flow-v-arrow">↓</div>
                        <div className="flow-v-step">
                            <div className="fv-icon">💼</div>
                            <div className="fv-text">
                                <strong>3. Cashier Processes</strong>
                                <span>Cashier clicks <em>Pay in Cash</em> → tops up Shared Deposit → checks out</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cashier Workflow */}
            <div className="home-section">
                <h2 className="section-title">💼 Cashier Checkout Workflow</h2>
                <p className="section-desc">
                    Cashiers use a bookmarklet plugin on dinbendon.net to process all orders at once.
                </p>
                <div className="flow-diagram flow-purple">
                    <div className="flow-title">Cashier Checkout Flow</div>
                    <div className="flow-vertical">
                        <div className="flow-v-step">
                            <div className="fv-icon">🔌</div>
                            <div className="fv-text">
                                <strong>1. Open Plugin</strong>
                                <span>Click the bookmarklet on the dinbendon.net order page</span>
                            </div>
                        </div>
                        <div className="flow-v-arrow">↓</div>
                        <div className="flow-v-step">
                            <div className="fv-icon">🔑</div>
                            <div className="fv-text">
                                <strong>2. Login</strong>
                                <span>Authenticate via the popup login</span>
                            </div>
                        </div>
                        <div className="flow-v-arrow">↓</div>
                        <div className="flow-v-step">
                            <div className="fv-icon">🔄</div>
                            <div className="fv-text">
                                <strong>3. Refresh Balances</strong>
                                <span>Plugin fetches balances and staged amounts for all buyers</span>
                            </div>
                        </div>
                        <div className="flow-v-arrow">↓</div>
                        <div className="flow-v-step">
                            <div className="fv-icon">📊</div>
                            <div className="fv-text">
                                <strong>4. Review Status</strong>
                                <span>
                                    Each row shows: <em className="status-green">Checkout</em> (staged ✓),{' '}
                                    <em className="status-gray">Not Staged</em>, or{' '}
                                    <em className="status-amber">Pay in Cash</em>
                                </span>
                            </div>
                        </div>
                        <div className="flow-v-arrow">↓</div>
                        <div className="flow-v-step">
                            <div className="fv-icon">⚡</div>
                            <div className="fv-text">
                                <strong>5. Checkout All</strong>
                                <span>Click <em>Checkout All</em> to process all eligible rows, or checkout individually</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Refund */}
            <div className="home-section">
                <h2 className="section-title">↩️ Refund & Cancel Workflow</h2>
                <p className="section-desc">
                    Made a mistake? Orders can be cancelled and refunded after checkout.
                </p>
                <div className="flow-diagram flow-red">
                    <div className="flow-title">Refund Flow</div>
                    <div className="refund-grid">
                        <div className="refund-card">
                            <h4>💳 Balance Refund</h4>
                            <p>If the buyer paid from their balance:</p>
                            <ol>
                                <li>Cashier clicks <strong>Cancel & Refund</strong> on the row</li>
                                <li>System tops up the full order amount back to the buyer</li>
                                <li>Row resets to <em>Checkout</em> state</li>
                            </ol>
                        </div>
                        <div className="refund-card">
                            <h4>💵 Cash Refund</h4>
                            <p>If the buyer paid in cash:</p>
                            <ol>
                                <li>Cashier clicks <strong>Cancel & Refund</strong> on the row</li>
                                <li>System withdraws from Shared Deposit</li>
                                <li>A dialog reminds the cashier to <strong>return cash</strong> to the buyer</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Reference */}
            <div className="home-section">
                <h2 className="section-title">📖 Quick Reference</h2>
                <div className="ref-table-wrap">
                    <table className="ref-table">
                        <thead>
                            <tr>
                                <th>Button</th>
                                <th>Meaning</th>
                                <th>Action Required</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><span className="ref-badge ref-green">Checkout $X</span></td>
                                <td>Balance & staged amount sufficient</td>
                                <td>Click to deduct from buyer's balance</td>
                            </tr>
                            <tr>
                                <td><span className="ref-badge ref-gray">Not Staged</span></td>
                                <td>Balance is enough, but buyer hasn't staged</td>
                                <td>Ask buyer to stage on My Account page</td>
                            </tr>
                            <tr>
                                <td><span className="ref-badge ref-red">Insufficient</span></td>
                                <td>Balance is too low</td>
                                <td>Buyer needs to top up first</td>
                            </tr>
                            <tr>
                                <td><span className="ref-badge ref-amber">💵 Pay $X</span></td>
                                <td>No account — cash required</td>
                                <td>Collect cash, then click to process</td>
                            </tr>
                            <tr>
                                <td><span className="ref-badge ref-done">✓ Done</span></td>
                                <td>Successfully checked out</td>
                                <td>No action needed</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Home;
