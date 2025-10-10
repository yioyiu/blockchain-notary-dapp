
# 链上存证小助手 — 完整实现链路与使用指南

本文件汇总整个系统的架构设计、文件职责、实现细节、部署与使用流程、安全与常见问题，便于一文读懂并落地使用。

## 一、系统概览
- **目标**：对任意数字文件计算 SHA-256 哈希并上链存证，随后可通过哈希验证存证者与时间。
- **架构**：浏览器前端 + MetaMask + 以太坊测试网合约（Goerli）。
- **数据边界**：文件不出本地，仅将哈希上链，保护隐私。

## 二、目录结构与文件职责
- `index.html`：前端页面结构与基础交互入口（连接钱包/计算哈希/发起存证/验证存证）。
- `app.js`：前端业务逻辑（MetaMask/ethers.js 交互、Web Crypto 计算哈希、交易发送与查询）。
- `style.css`：界面样式（暗色主题、卡片布局、移动端适配）。
- `contracts/Notary.sol`：Solidity 合约（哈希 → 存证者地址与时间的映射，事件、查询接口）。
- `README.MD`：项目实现思路与分阶段计划（已优化）。

## 三、合约实现（contracts/Notary.sol）

### 合约名：`Notary`

### 关键数据结构：
- `mapping(string => Record) records`：键为文档哈希（字符串，建议十六进制小写），值为存证 `owner` 与 `timestamp`。
- `struct Record { address owner; uint256 timestamp; }`

### 关键接口：
- `notarizeDocument(string documentHash)`：若该哈希尚未存证，则记录调用者与时间；触发 `DocumentNotarized` 事件。
- `verifyDocument(string documentHash) returns (address owner)`：返回存证者地址，无记录时为 `address(0)`。
- `getRecord(string documentHash) returns (address owner, uint256 timestamp)`：返回存证者与时间戳。

### 事件：
- `event DocumentNotarized(address indexed owner, string indexed documentHash, uint256 timestamp);`

### 边界校验：
- 空哈希拒绝：`require(bytes(documentHash).length > 0, "EMPTY_HASH");`
- 重复存证拒绝：`require(records[documentHash].owner == address(0), "ALREADY_NOTARIZED");`

### 实现要点：
- 选择 `string` 作为键值，便于直接使用前端十六进制哈希字符串，无需在链上转换类型。
- 读操作 `verifyDocument/getRecord` 为 `view`，不耗费 Gas；写操作 `notarizeDocument` 需要发起交易并消耗 Gas（测试网可忽略成本）。

## 四、前端页面（index.html）

### 页面结构：
- **顶部**：`连接钱包` 按钮，与网络信息栏。
- **模块 1**：选择文件并计算哈希（`file` 输入 + `计算哈希` 按钮 + 展示区域）。
- **模块 2**：上链存证（`开始存证` 按钮 + 交易状态/链接展示）。
- **模块 3**：验证存证（哈希输入 + `验证` 按钮 + 验证结果展示）。
- **说明卡片**：强调隐私与网络要求（Goerli）。

### 实现要点：
- 通过 `<script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>` 引入 Ethers v5 UMD 版本。
- 页面底部引入 `app.js` 绑定按钮事件并执行逻辑。

## 五、前端逻辑（app.js）

### 常量配置 `CONFIG`：
- `expectedChainId`：默认 `5`（Goerli）。
- `contractAddress`：部署完成后替换为你的合约地址。
- `abi`：包含 `notarizeDocument`、`verifyDocument`、`getRecord` 以及 `DocumentNotarized` 事件定义。

### 钱包连接：
- 检测 `window.ethereum`，请求账户授权。
- 用 `ethers.providers.Web3Provider` 创建 Provider，并用 `getSigner()` 获取 Signer。
- 校验网络 `chainId` 是否与 `expectedChainId` 一致。
- 以 `signer` 实例化合约（写操作），以 `provider` 实例化合约（读操作）。

### 哈希计算（Web Crypto API）：
- `file.arrayBuffer()` → `crypto.subtle.digest('SHA-256', buffer)` → 转为十六进制字符串（小写）。

### 存证流程：
- 合约写函数 `notarizeDocument(hash)` 发起交易。
- 展示交易哈希，等待确认 `tx.wait()`，展示区块号并提供 Etherscan 链接。

### 验证流程：
- 读函数 `getRecord(hash)` 返回 `owner` 与 `timestamp`。
- 若 `owner != 0x000…000`，展示"已存证 + 地址 + 本地化时间"；否则提示"未找到记录"。

### UI 交互与状态：
- 按钮启用/禁用与状态消息更新；错误信息捕获后展示在对应区域。

### Etherscan 构造：
- Goerli 交易链接：`https://goerli.etherscan.io/tx/${txHash}`。

## 六、样式（style.css）
- **暗色主题** + 渐进式增强：卡片、圆角、边框、阴影、响应式布局。
- **组件**：按钮（基础/主按钮/成功）、输入框、等宽字体输出区域、状态提示。
- **移动端**：在小屏下自动拉伸输入框宽度，保证可用性。

## 七、从零到部署 — 全流程

### 1) 部署合约（Remix + MetaMask）
- 打开 `contracts/Notary.sol` 代码，复制到 Remix 新文件中。
- 选择编译器 `0.8.20`（或兼容 0.8.x）。
- 在 Remix "Deploy & Run" 面板选择 `Injected Provider - MetaMask`，切换到 Goerli。
- 部署 `Notary`，复制生成的合约地址（形如 `0x...`）。
- 可在 Etherscan-Goerli 验证合约源码（可选）。

### 2) 配置前端
- 打开 `app.js`，将 `CONFIG.contractAddress` 替换为你的合约地址。
- 如使用其他网络（如 Sepolia），同时更新：
  - `expectedChainId`（Sepolia 为 11155111）。
  - Etherscan URL 构造（`https://sepolia.etherscan.io/tx/`）。

### 3) 本地运行与测试
- 直接双击打开 `index.html` 或用任意静态服务器（如 VSCode Live Server / `npx serve`）。
- 点击"连接钱包"，授权并确认网络。
- 选择文件 → 计算哈希 → 开始存证。
- 在"验证存证"模块输入哈希，验证记录返回结果。

### 4) 在线部署
- 将仓库推送到 GitHub。
- 在 Vercel 选择 `New Project` → 关联仓库 → 部署（静态站点，零构建配置）。

## 八、安全与使用建议
- **仅存储哈希**：文件数据不出本地；请提示用户保留原始文件以备举证。
- **输入规范**：
  - 建议统一为小写十六进制哈希字符串，避免大小写导致的不同键值。
  - 在前端增加基本校验（长度、字符集）可进一步提升健壮性。
- **错误处理**：
  - 用户拒绝交易、网络切换失败、余额不足等需友好提示。
- **主网成本**：
  - 测试网免费；主网上线需考虑 Gas 成本与更完善的 UI 引导。

## 九、常见问题（FAQ）

### Q：为什么验证不到记录？
**A**：确认使用的是"同一个哈希"（小写十六进制）、"同一条链"（Goerli）与"同一合约地址"。

### Q：能否存多次？
**A**：相同哈希不可重复存证；若要覆盖，需设计新的合约逻辑（不推荐）。

### Q：为何选择字符串作为键？
**A**：避免在链上做 bytes/hex 转换，前端以字符串传入，简化交互。

### Q：如何获取 Goerli 测试 ETH？
**A**：使用官方水龙头 https://goerlifaucet.com/ 或 https://faucet.quicknode.com/ethereum/goerli

### Q：合约部署失败怎么办？
**A**：检查 MetaMask 网络设置、账户余额、编译器版本，确保选择正确的网络。

## 十、关键配置清单
- `app.js` → `CONFIG.contractAddress`：部署后必须替换。
- `app.js` → `CONFIG.expectedChainId`：默认 5（Goerli），按需调整。
- `app.js` → Etherscan 域名：按网络切换（Goerli/Sepolia/主网）。

## 十一、扩展与演进方向
- **接入 IPFS**：将文件元数据（如文件名、大小、MIME）存 IPFS，链上仅存哈希与 IPFS CID。
- **批量存证**：前端多文件哈希计算 + 合约批量写入（注意 Gas）。
- **历史记录**：监听 `DocumentNotarized` 事件或新增映射存取列表，做前端展示页。
- **多链支持**：抽象网络配置，支持 Goerli、Sepolia、Polygon PoS 等。
- **权限管理**：添加管理员功能，支持撤销存证等高级操作。

## 十二、技术栈总结
| 组件 | 技术选择 | 作用 |
|------|----------|------|
| 区块链平台 | Ethereum Goerli Testnet | 免费测试环境 |
| 智能合约语言 | Solidity ^0.8.20 | 以太坊标准 |
| 合约开发环境 | Remix IDE | 浏览器内开发 |
| 前端框架 | 纯 HTML + JavaScript | 简单直接 |
| 区块链交互库 | Ethers.js v5 | 现代友好的 API |
| 钱包连接 | MetaMask | 行业标准 |
| 文件哈希计算 | Web Crypto API | 浏览器原生 |
| 前端部署 | Vercel | 免费快速部署 |

— 完 —
