// Config: replace with your deployed contract address and ABI
const CONFIG = {
    expectedChainId: 5, // Goerli testnet
    contractAddress: "0x0000000000000000000000000000000000000000", // TODO: replace after deploy
    abi: [
        {
            "inputs": [{ "internalType": "string", "name": "documentHash", "type": "string" }],
            "name": "notarizeDocument", "outputs": [], "stateMutability": "nonpayable", "type": "function"
        },
        {
            "inputs": [{ "internalType": "string", "name": "documentHash", "type": "string" }],
            "name": "verifyDocument", "outputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
            "stateMutability": "view", "type": "function"
        },
        {
            "inputs": [{ "internalType": "string", "name": "documentHash", "type": "string" }],
            "name": "getRecord", "outputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "uint256", "name": "timestamp", "type": "uint256" }],
            "stateMutability": "view", "type": "function"
        },
        {
            "anonymous": false, "inputs": [
                { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
                { "indexed": true, "internalType": "string", "name": "documentHash", "type": "string" },
                { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
            ], "name": "DocumentNotarized", "type": "event"
        }
    ]
};

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

async function connectWallet() {
    if (!window.ethereum) throw new Error("请安装 MetaMask");
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
    signer = provider.getSigner();

    const network = await provider.getNetwork();
    $("networkInfo").textContent = `网络: ${network.name} (chainId=${network.chainId})`;
    if (CONFIG.expectedChainId && network.chainId !== CONFIG.expectedChainId) {
        throw new Error(`请切换到 Goerli (chainId=${CONFIG.expectedChainId})`);
    }

    contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.abi, signer);
    $("btnConnect").textContent = "已连接";
}

async function computeSHA256Hex(file) {
    const buf = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function toEtherscanTxUrl(txHash) {
    // Goerli; adjust for other networks as needed
    return `https://goerli.etherscan.io/tx/${txHash}`;
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


