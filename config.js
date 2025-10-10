// 环境配置文件 - 请根据你的部署情况修改以下配置
const CONFIG = {
    // 网络配置
    expectedChainId: 11155111, // Sepolia testnet (主网: 1, Goerli: 5, Sepolia: 11155111)

    // 合约配置
    contractAddress: "0xA51f1eF2aa212c6eBDf4cba6Dc9b51ceC2Ff100C", // 你的合约地址

    // 区块浏览器配置
    etherscanBaseUrl: "https://sepolia.etherscan.io", // Sepolia (主网: https://etherscan.io, Goerli: https://goerli.etherscan.io)

    // 网络信息
    networkName: "Sepolia", // 显示的网络名称

    // 水龙头链接（可选，用于提示用户获取测试币）
    faucetUrl: "https://faucet.quicknode.com/ethereum/sepolia",

    // 合约 ABI（通常不需要修改）
    abi: [
        {
            "inputs": [{ "internalType": "string", "name": "documentHash", "type": "string" }],
            "name": "notarizeDocument",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{ "internalType": "string", "name": "documentHash", "type": "string" }],
            "name": "verifyDocument",
            "outputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{ "internalType": "string", "name": "documentHash", "type": "string" }],
            "name": "getRecord",
            "outputs": [
                { "internalType": "address", "name": "owner", "type": "address" },
                { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "anonymous": false,
            "inputs": [
                { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
                { "indexed": true, "internalType": "string", "name": "documentHash", "type": "string" },
                { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
            ],
            "name": "DocumentNotarized",
            "type": "event"
        }
    ]
};

// 导出配置（如果在 Node.js 环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
