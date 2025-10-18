// 配置从外部文件加载
// 注意：config.js 必须在 app.js 之前加载

// 全局变量：存储区块链连接和当前文件哈希
let provider, signer, contract; // 区块链连接相关
let currentHashHex = ""; // 当前文件的哈希值

// 获取页面元素的简化函数
function $(id) {
    return document.getElementById(id); // 根据ID获取页面元素
}

// 设置状态显示的函数
function setStatus(el, message, href) {
    if (!el) return; // 如果元素不存在则退出

    // 如果有链接地址，创建可点击的链接
    if (href) {
        el.innerHTML = `<a href="${href}" target="_blank" rel="noreferrer">${message}</a>`;
    } else {
        // 否则直接显示文本内容
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

// 计算文件SHA-256哈希值的函数
async function computeSHA256Hex(file) {
    // 将文件转换为二进制数据（ArrayBuffer格式）
    const buf = await file.arrayBuffer();

    // 使用浏览器内置的加密API计算SHA-256哈希
    // crypto.subtle.digest 是异步函数，需要await等待
    const hashBuffer = await crypto.subtle.digest('SHA-256', buf);

    // 将哈希结果从ArrayBuffer转换为普通数组
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // 将每个字节转换为十六进制字符串
    // b.toString(16) 转换为16进制，padStart(2,'0') 确保是2位数字
    // join('') 将所有十六进制字符连接成一个字符串
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function toEtherscanTxUrl(txHash) {
    return `${CONFIG.etherscanBaseUrl}/tx/${txHash}`;
}

// 用户点击"计算哈希"按钮时执行的函数
async function onHashClick() {
    // 获取用户选择的文件（files[0]表示第一个文件）
    const file = $("fileInput").files?.[0];

    // 如果没有选择文件，直接退出函数
    if (!file) return;

    // 在界面上显示"计算中..."提示用户正在处理
    setStatus($("hashOutput"), "计算中...");

    // 调用上面的函数计算文件哈希值
    const hex = await computeSHA256Hex(file);

    // 将计算出的哈希值保存到全局变量，供后续存证使用
    currentHashHex = hex;

    // 在界面上显示计算出的哈希值
    setStatus($("hashOutput"), hex);

    // 启用"开始存证"按钮，因为现在有了哈希值可以存证了
    $("btnNotarize").disabled = false;
}

async function onNotarizeClick() {
    if (!contract) throw new Error("请先连接钱包");
    if (!currentHashHex) throw new Error("请先计算文件哈希");
    // 预检：如已存证则不再发送交易
    try {
        const read = new ethers.Contract(CONFIG.contractAddress, CONFIG.abi, provider);
        const [owner] = await read.getRecord(currentHashHex);
        if (owner && owner !== ethers.constants.AddressZero) {
            setStatus($("txStatus"), "该哈希已存证，无需重复上链。");
            return;
        }
    } catch (_) {
        // 忽略只读预检错误，继续后续流程
    }

    setStatus($("txStatus"), "发送交易中...");
    try {
        const tx = await contract.notarizeDocument(currentHashHex);
        setStatus($("txStatus"), `交易已发送：${tx.hash}`, toEtherscanTxUrl(tx.hash));
        const receipt = await tx.wait();
        setStatus($("txStatus"), `已确认 - 区块 ${receipt.blockNumber}`, toEtherscanTxUrl(tx.transactionHash));
    } catch (err) {
        // 友好化常见错误提示
        const msg = (err && err.message) ? err.message : String(err);
        if (msg.includes('ALREADY_NOTARIZED')) {
            setStatus($("txStatus"), "交易失败：该哈希已存证，无需重复上链。");
        } else if (msg.includes('UNPREDICTABLE_GAS_LIMIT')) {
            setStatus($("txStatus"), "交易失败：无法估算 Gas，可能因参数或网络问题。请稍后重试。");
        } else if (msg.toLowerCase().includes('user rejected')) {
            setStatus($("txStatus"), "交易已取消：用户拒绝签名。");
        } else {
            setStatus($("txStatus"), `交易失败：${msg}`);
        }
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

            // 查询存证事件以获取区块号
            try {
                const filter = read.filters.DocumentNotarized(owner, hash);
                const events = await read.queryFilter(filter);

                if (events.length > 0) {
                    const event = events[0];
                    const blockNumber = event.blockNumber;
                    const blockUrl = `${CONFIG.etherscanBaseUrl}/block/${blockNumber}`;
                    setStatus($("verifyResult"), `已存证：${owner} 于 ${date.toLocaleString()}`, blockUrl);
                } else {
                    // 如果找不到事件，仍然显示基本信息
                    setStatus($("verifyResult"), `已存证：${owner} 于 ${date.toLocaleString()}`);
                }
            } catch (eventErr) {
                // 如果查询事件失败，仍然显示基本信息
                setStatus($("verifyResult"), `已存证：${owner} 于 ${date.toLocaleString()}`);
            }
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

    // 当用户选择文件时触发的事件
    $("fileInput").addEventListener('change', () => {
        // 检查是否选择了文件
        // files?.length 表示如果files存在且长度大于0，则启用按钮
        // !($("fileInput").files?.length) 表示没有文件时禁用按钮
        $("btnHash").disabled = !($("fileInput").files?.length);
    });

    // 当用户点击"计算哈希"按钮时触发的事件
    $("btnHash").addEventListener('click', () => onHashClick());
    $("btnNotarize").addEventListener('click', () => onNotarizeClick());
    $("btnVerify").addEventListener('click', () => onVerifyClick());
}

document.addEventListener('DOMContentLoaded', init);


