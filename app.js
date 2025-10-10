// 配置从外部文件加载
// 注意：config.js 必须在 app.js 之前加载

let provider, signer, contract;
let currentHashHex = "";

function $(id) { return document.getElementById(id); }

function setStatus(el, message, href) {
    if (!el) return;
    if (href) {
        el.innerHTML = `<a href="${href}" target="_blank" rel="noreferrer">${message}</a>`;
    } else {
        el.textContent = message;
    }
}

function getPreferredEip1193Provider() {
    const eth = window.ethereum;
    if (!eth) return null;
    // If multiple providers are injected, pick MetaMask explicitly
    if (Array.isArray(eth.providers) && eth.providers.length) {
        const metaMask = eth.providers.find(p => p && p.isMetaMask);
        if (metaMask) return metaMask;
        // fallback to the first provider
        return eth.providers[0];
    }
    // Single provider injected
    return eth;
}

async function connectWallet() {
    const eth = getPreferredEip1193Provider();
    if (!eth) throw new Error("未检测到以太坊钱包，请安装 MetaMask");
    // Prefer MetaMask account request if available
    await eth.request({ method: 'eth_requestAccounts' });
    provider = new ethers.providers.Web3Provider(eth, 'any');
    // Ensure network is Sepolia; attempt auto-switch/add if needed
    await ensureOnExpectedNetwork(eth);
    signer = provider.getSigner();

    const network = await provider.getNetwork();
    $("networkInfo").textContent = `网络: ${network.name} (chainId=${network.chainId})`;
    if (CONFIG.expectedChainId && network.chainId !== CONFIG.expectedChainId) {
        throw new Error(`请切换到 ${CONFIG.networkName} (chainId=${CONFIG.expectedChainId})`);
    }

    contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.abi, signer);
    $("btnConnect").textContent = "已连接";
}

async function ensureOnExpectedNetwork(eth) {
    try {
        const currentHex = await eth.request({ method: 'eth_chainId' });
        const expectedHex = '0x' + CONFIG.expectedChainId.toString(16);
        if (CONFIG.expectedChainId && currentHex !== expectedHex) {
            // Try switch first
            try {
                await eth.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: expectedHex }]
                });
            } catch (switchErr) {
                // Unrecognized chain in wallet → add then switch
                if (switchErr && switchErr.code === 4902) {
                    try {
                        await eth.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: expectedHex,
                                chainName: CONFIG.networkName + ' test network',
                                nativeCurrency: { name: CONFIG.networkName + 'ETH', symbol: 'ETH', decimals: 18 },
                                rpcUrls: [CONFIG.etherscanBaseUrl.replace('etherscan.io', 'rpc.sepolia.org')],
                                blockExplorerUrls: [CONFIG.etherscanBaseUrl]
                            }]
                        });
                    } catch (addErr) {
                        throw new Error(`请在钱包中添加/切换到 ${CONFIG.networkName} 网络后重试`);
                    }
                } else {
                    throw new Error(`请在钱包中切换到 ${CONFIG.networkName} 网络后重试`);
                }
            }
        }
    } catch (e) {
        // Best-effort; surface a friendly message while not blocking the rest if user proceeds
        throw e;
    }
}

async function computeSHA256Hex(file) {
    const buf = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function toEtherscanTxUrl(txHash) {
    return `${CONFIG.etherscanBaseUrl}/tx/${txHash}`;
}

async function onHashClick() {
    const file = $("fileInput").files?.[0];
    if (!file) return;
    setStatus($("hashOutput"), "计算中...");
    const hex = await computeSHA256Hex(file);
    currentHashHex = hex;
    setStatus($("hashOutput"), hex);
    $("btnNotarize").disabled = false;
}

async function onNotarizeClick() {
    if (!contract) throw new Error("请先连接钱包");
    if (!currentHashHex) throw new Error("请先计算文件哈希");
    setStatus($("txStatus"), "发送交易中...");
    try {
        const tx = await contract.notarizeDocument(currentHashHex);
        setStatus($("txStatus"), `交易已发送：${tx.hash}`, toEtherscanTxUrl(tx.hash));
        const receipt = await tx.wait();
        setStatus($("txStatus"), `已确认 - 区块 ${receipt.blockNumber}`, toEtherscanTxUrl(tx.transactionHash));
    } catch (err) {
        setStatus($("txStatus"), `交易失败：${err.message || err}`);
    }
}

async function onVerifyClick() {
    if (!provider) throw new Error("请先连接钱包");
    const hash = $("verifyHash").value.trim();
    if (!hash) return setStatus($("verifyResult"), "请输入哈希");
    try {
        const read = new ethers.Contract(CONFIG.contractAddress, CONFIG.abi, provider);
        const [owner, timestamp] = await read.getRecord(hash);
        if (owner && owner !== ethers.constants.AddressZero) {
            const date = new Date(Number(timestamp) * 1000);
            setStatus($("verifyResult"), `已存证：${owner} 于 ${date.toLocaleString()}`);
        } else {
            setStatus($("verifyResult"), "未找到该文件的存证记录");
        }
    } catch (err) {
        setStatus($("verifyResult"), `查询失败：${err.message || err}`);
    }
}

function init() {
    $("btnConnect").addEventListener('click', async () => {
        try {
            await connectWallet();
            $("btnHash").disabled = false;
        } catch (e) { alert(e.message || e); }
    });

    $("fileInput").addEventListener('change', () => {
        $("btnHash").disabled = !($("fileInput").files?.length);
    });

    $("btnHash").addEventListener('click', () => onHashClick());
    $("btnNotarize").addEventListener('click', () => onNotarizeClick());
    $("btnVerify").addEventListener('click', () => onVerifyClick());
}

document.addEventListener('DOMContentLoaded', init);


