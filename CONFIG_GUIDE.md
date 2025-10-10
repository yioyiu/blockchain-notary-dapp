# 配置指南

## 快速配置

只需要修改 `config.js` 文件中的以下配置项：

### 1. 合约地址
```javascript
contractAddress: "0xA51f1eF2aa212c6eBDf4cba6Dc9b51ceC2Ff100C", // 替换为你的实际合约地址
```

### 2. 网络配置
```javascript
expectedChainId: 11155111, // Sepolia (主网: 1, Goerli: 5, Sepolia: 11155111)
networkName: "Sepolia", // 显示的网络名称
etherscanBaseUrl: "https://sepolia.etherscan.io", // 区块浏览器地址
```

### 3. 水龙头链接（可选）
```javascript
faucetUrl: "https://faucet.quicknode.com/ethereum/sepolia", // 测试币获取链接
```

## 不同网络配置示例

### 主网 (Ethereum Mainnet)
```javascript
expectedChainId: 1,
networkName: "Ethereum",
etherscanBaseUrl: "https://etherscan.io",
faucetUrl: null, // 主网不需要水龙头
```

### Goerli 测试网
```javascript
expectedChainId: 5,
networkName: "Goerli",
etherscanBaseUrl: "https://goerli.etherscan.io",
faucetUrl: "https://goerlifaucet.com/",
```

### Sepolia 测试网（当前配置）
```javascript
expectedChainId: 11155111,
networkName: "Sepolia",
etherscanBaseUrl: "https://sepolia.etherscan.io",
faucetUrl: "https://faucet.quicknode.com/ethereum/sepolia",
```

## 部署步骤

1. **部署合约**
   - 在 Remix 中部署 `contracts/Notary.sol`
   - 复制生成的合约地址

2. **修改配置**
   - 打开 `config.js`
   - 替换 `contractAddress` 为你的合约地址
   - 确认网络配置正确

3. **测试**
   - 本地打开 `index.html` 测试
   - 或推送到 GitHub Pages 在线测试

## 注意事项

- 合约地址必须是字符串格式（带引号）
- 确保网络配置与你的合约部署网络一致
- 测试网需要先获取测试币才能部署合约
- 主网部署需要真实 ETH 作为 Gas 费
