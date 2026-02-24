import { useState, useEffect } from 'react';
import './InstallPlugin.css';

/**
 * Install Plugin page — instructions for installing the bookmarklet.
 * Fetches the inline plugin code and shows manual installation steps.
 */
function InstallPlugin({ user }) {
    const [pluginCode, setPluginCode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetch('/plugin-inline.js?v=' + Date.now())
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load plugin');
                return res.text();
            })
            .then((code) => setPluginCode(code))
            .catch(() => setPluginCode(null))
            .finally(() => setLoading(false));
    }, []);

    function handleCopy() {
        if (!pluginCode) return;
        navigator.clipboard.writeText(pluginCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    return (
        <div className="install-page">
            <div className="install-card">
                <h2>🔌 Install Bookmarklet Plugin</h2>
                <p className="install-subtitle">
                    Add the checkout plugin to your browser&apos;s bookmarks bar for quick access on dinbendon.net
                </p>

                {/* Step 1 */}
                <div className="install-step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                        <h3>Show your Bookmarks Bar</h3>
                        <p>
                            Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> (Windows/Linux)
                            or <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> (Mac) to toggle
                            the bookmarks bar.
                        </p>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="install-step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                        <h3>Copy the Plugin Code</h3>
                        <p>Click the button below to copy the bookmarklet code:</p>
                        <div className="code-block-wrap">
                            <pre className="code-block">
                                {loading ? 'Loading…' : pluginCode || 'Error loading plugin'}
                            </pre>
                            <button
                                className="btn-copy"
                                onClick={handleCopy}
                                disabled={!pluginCode}
                            >
                                {copied ? '✅ Copied!' : '� Copy Code'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="install-step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                        <h3>Create a New Bookmark</h3>
                        <p>Right-click your bookmarks bar and select <strong>&quot;Add page…&quot;</strong> or <strong>&quot;Add bookmark…&quot;</strong></p>
                        <ul className="install-list">
                            <li>Set the <strong>Name</strong> to: <code>💰 Ben-Don Checkout</code></li>
                            <li>Paste the copied code into the <strong>URL</strong> field</li>
                            <li>Click <strong>Save</strong></li>
                        </ul>
                    </div>
                </div>

                {/* Step 4 */}
                <div className="install-step">
                    <div className="step-number">4</div>
                    <div className="step-content">
                        <h3>Use on dinbendon.net</h3>
                        <p>
                            Go to <strong>dinbendon.net</strong>, open a meal order page,
                            then click the <strong>&quot;💰 Ben-Don Checkout&quot;</strong> bookmark.
                            A control panel will appear — log in and start checking out orders!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default InstallPlugin;
