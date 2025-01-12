// Global state and constants
let currentPage = 1;
let currentSort = 'createdAt';
let ethPriceUSD = 0;
const errorElement = document.getElementById('errorMessage');
let refreshInterval;

// Theme handling
const themeToggle = document.getElementById('themeToggle');
let isDarkMode = localStorage.getItem('theme') === 'dark';

// Function to update theme
function updateTheme(darkMode) {
    isDarkMode = darkMode;
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

// Initial theme setup
updateTheme(isDarkMode);

// Theme toggle click handler
themeToggle.addEventListener('click', () => {
    updateTheme(!isDarkMode);
});

// Fetch ETH price
async function fetchEthPrice() {
    try {
        const response = await fetch('https://creator.bid/api/eth');
        if (!response.ok) throw new Error('Failed to fetch ETH price');
        const data = await response.json();
        ethPriceUSD = parseFloat(data.price) / 100000000; // Convert to USD
    } catch (error) {
        console.error('Error fetching ETH price:', error);
    }
}


// Format number function with USD calculation
function formatNumber(value, isETH = false) {
    if (!value) return '$0';
    
    // Add 0. prefix if value doesn't contain decimal point
    if (typeof value === 'string' && !value.includes('.')) {
        value = '0.' + value;
    }
    
    const num = parseFloat(value);

    // For ETH values (marketCap and volume)
    if (isETH) {
        const ethValue = num >= 1e18 ? num / 1e18 : num;
        const usdValue = ethValue * ethPriceUSD;

        // Format USD
        if (usdValue >= 1e9) {
            return '$' + (usdValue / 1e9).toFixed(1) + 'B';
        } else if (usdValue >= 1e6) {
            return '$' + (usdValue / 1e6).toFixed(1) + 'M';
        } else if (usdValue >= 1e3) {
            return '$' + (usdValue / 1e3).toFixed(1) + 'K';
        }
        return '$' + usdValue.toFixed(2);
    }

    // For non-ETH values
    if (num >= 1e6) {
        return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
        return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

// Create loading skeleton
function createSkeleton() {
    return `
        <div class="skeleton" style="width: 60%;"></div>
        <div class="skeleton" style="width: 80%;"></div>
        <div class="skeleton" style="width: 70%;"></div>
    `;
}

// API Functions
async function fetchAgentDetails(id) {
    try {
        const response = await fetch(`https://creator.bid/api/agents/${id}`);
        if (!response.ok) throw new Error('Failed to fetch agent details');
        return await response.json();
    } catch (error) {
        console.error(`Error fetching details for agent ${id}:`, error);
        return null;
    }
}

async function fetchAgents() {
    const sortDirection = document.getElementById('sortDirection').value;
    const limit = document.getElementById('itemsPerPage').value;
    errorElement.style.display = 'none';

    try {
        const response = await fetch(
            `https://creator.bid/api/agents?type=user&limit=${limit}&page=${currentPage}&sortBy=${currentSort}&sortDirection=${sortDirection}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch agents');
        const data = await response.json();
        await renderAgents(data);
        renderPagination(data.numTotalAgents, limit);
    } catch (error) {
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
    } 
}

// Rendering Functions
async function renderAgents(data) {
    const grid = document.getElementById('agentsGrid');
    grid.innerHTML = '';

    for (const agent of data.agents) {
        const card = document.createElement('div');
        card.className = 'agent-card';
        
        // Initial card content
        card.innerHTML = `
            <img src="${agent.profilePicture}" alt="${agent.name}" class="agent-image">
            <div class="agent-name">${agent.name}</div>
            <div class="agent-symbol">${agent.symbol || 'No Symbol'}</div>
            <div class="agent-stats">
                <div class="stat">
                    <span>Market Cap</span>
                    <span class="value">${formatNumber(agent.marketCap, true)}</span>
                </div>
                <div class="stat">
                    <span>Volume</span>
                    <span class="value">${formatNumber(agent.cumulativeETHVolume, true)}</span>
                </div>
            </div>
            <div id="details-${agent._id}" class="agent-details">
                ${createSkeleton()}
            </div>
        `;

        grid.appendChild(card);

        // Fetch and render detailed information
        const details = await fetchAgentDetails(agent._id);
        if (details) {
            const detailsElement = document.getElementById(`details-${agent._id}`);
            if (detailsElement) {
                const socials = details.socials
                    .filter(social => social.value || social.isConnected)
                    .map(social => {
                        const icon = social.id === 'twitter' ? 'fab fa-twitter' :
                                   social.id === 'website' ? 'fas fa-globe' :
                                   social.id === 'telegram' ? 'fab fa-telegram' :
                                   social.id === 'discord' ? 'fab fa-discord' : 'fas fa-link';
                        
                        const href = social.id === 'twitter' 
                            ? `https://twitter.com/${social.username}`
                            : social.value;
                        
                        return `
                            <a href="${href}" class="social-link" target="_blank">
                                <i class="${icon}"></i>
                                ${social.id}
                            </a>
                        `;
                    }).join('');

                const twitterInfo = details.owner?.twitter ? `
                    <div class="twitter-info">
                        <img src="${details.owner.twitter.profileImageUrl}" alt="${details.owner.twitter.name}" class="twitter-avatar">
                        <a href="https://twitter.com/${details.owner.twitter.username}" target="_blank" class="twitter-link">
                            @${details.owner.twitter.username}
                        </a>
                        ${details.owner.twitter.verifiedType !== 'none' ? '<i class="fas fa-check-circle"></i>' : ''}
                    </div>
                ` : '';

                detailsElement.innerHTML = `
                    <div class="owner-info">
                        <strong>Owner</strong>
                        <div class="info-grid">
                            <div class="info-item">
                                <small>Wallet</small>
                                <a href="https://debank.com/profile/${details.owner?.wallets?.[0]}" 
                                   target="_blank" 
                                   class="address-link">
                                    ${details.owner?.wallets?.[0]?.substring(0, 8)}...
                                </a>
                            </div>
                            <div class="info-item">
                                <small>Treasury</small>
                                <a href="https://app.safe.global/balances?safe=base:${details.agentKey?.treasury}" 
                                   target="_blank" 
                                   class="address-link">
                                    ${details.agentKey?.treasury?.substring(0, 8)}...
                                </a>
                            </div>
                        </div>
                        ${twitterInfo}
                    </div>
                    ${socials ? `<div class="social-links">${socials}</div>` : ''}
                    <div class="treasury-info">
                        <div class="info-grid">
                            <div class="info-item">
                                <small>Total Subscribed</small>
                                <div class="value">${formatNumber(details.agentKey?.details?.totalSubscribed, true)}</div>
                            </div>
                            <div class="info-item">
                                <small>Subscribers</small>
                                <div class="value">${details.agentKey?.details?.totalSubscribers || 0}</div>
                            </div>
                        </div>
                    </div>
                    <div class="trade-actions">
                        <a href="https://creator.bid/agents/${agent._id}" 
                           target="_blank" 
                           class="trade-btn buy">
                            <span class="btn-content">
                                <i class="fas fa-arrow-trend-up"></i>
                                Buy
                            </span>
                            <span class="btn-backdrop"></span>
                        </a>
                        <a href="https://creator.bid/agents/${agent._id}" 
                           target="_blank" 
                           class="trade-btn sell">
                            <span class="btn-content">
                                <i class="fas fa-arrow-trend-down"></i>
                                Sell
                            </span>
                            <span class="btn-backdrop"></span>
                        </a>
                    </div>
                `;
            }
        }
    }
}

function renderPagination(total, limit) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    const totalPages = Math.ceil(total / limit);
    
    const prevButton = document.createElement('button');
    prevButton.textContent = '← Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            fetchAgents();
        }
    };
    pagination.appendChild(prevButton);

    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    pagination.appendChild(pageInfo);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next →';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchAgents();
        }
    };
    pagination.appendChild(nextButton);
}

// Tab handling
document.getElementById('sortTabs').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab')) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        e.target.classList.add('active');
        currentSort = e.target.dataset.sort;
        currentPage = 1;
        fetchAgents();
    }
});

// Event listeners for filters
document.getElementById('sortDirection').addEventListener('change', () => {
    currentPage = 1;
    fetchAgents();
});

document.getElementById('itemsPerPage').addEventListener('change', () => {
    currentPage = 1;
    fetchAgents();
});

// Copy to clipboard functionality
document.addEventListener('click', async (e) => {
    if (e.target.closest('.copy-btn')) {
        const btn = e.target.closest('.copy-btn');
        const textToCopy = btn.dataset.clipboard;
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            
            // Add copied class for animation
            btn.classList.add('copied');
            
            // Reset after animation
            setTimeout(() => {
                btn.classList.remove('copied');
            }, 2000);
            
            // Show success tooltip
            const tooltip = btn.querySelector('.tooltip');
            if (tooltip) {
                tooltip.textContent = 'Copied!';
                setTimeout(() => {
                    tooltip.textContent = 'Copy to clipboard';
                }, 2000);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
            // Show error tooltip
            const tooltip = btn.querySelector('.tooltip');
            if (tooltip) {
                tooltip.textContent = 'Failed to copy';
                setTimeout(() => {
                    tooltip.textContent = 'Copy to clipboard';
                }, 2000);
            }
        }
    }
});

// Initial setup
async function initialize() {
    await fetchEthPrice();
    await fetchAgents();
    
    // Set up auto-refresh every 10 seconds
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(async () => {
        await fetchEthPrice();
        await fetchAgents();
    }, 30000);
}

// Start the application
initialize();
