import { CHAIN } from './constants.js';

function errorParts(error) {
  const parts = [], seen = new Set(), queue = [error];
  while (queue.length && parts.length < 20) {
    const part = queue.shift();
    if (!part || typeof part !== 'object' || seen.has(part)) continue;
    seen.add(part); parts.push(part);
    queue.push(part.data, part.originalError, part.error, part.cause);
  }
  return parts;
}

export async function ensureElysiumNetwork(provider) {
  if (!provider?.request) throw new Error('An EVM wallet extension is required to add the network.');
  const selected = () => provider.request({ method: 'eth_chainId' });
  const matches = id => Number.parseInt(id, 16) === CHAIN.chainId;
  if (matches(await selected())) return;
  const switchChain = () => provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.hexId }] });
  try {
    await switchChain();
  } catch (error) {
    const parts = errorParts(error);
    // A rejected or pending request must never trigger another wallet prompt.
    if (parts.some(part => Number(part.code) === 4001)) throw new Error('Network request declined. You can still sign in and complete social and daily quests.');
    if (parts.some(part => Number(part.code) === -32002)) throw new Error('A wallet request is already pending. Open your wallet and finish or cancel it first.');
    const missing = parts.some(part => Number(part.code) === 4902 || /(?:unrecognized|unknown) chain(?: id)?|chain (?:has not been|not) added/i.test(part.message || ''));
    if (!missing) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [{
      chainId: CHAIN.hexId, chainName: CHAIN.chainName, rpcUrls: CHAIN.rpcUrls,
      nativeCurrency: CHAIN.nativeCurrency, blockExplorerUrls: CHAIN.blockExplorerUrls,
    }] });
    // Adding a network does not necessarily select it in every wallet.
    if (!matches(await selected())) await switchChain();
  }
  if (!matches(await selected())) throw new Error('Your wallet is still on another network. Select Kinetiq Elysium Testnet in your wallet and try again.');
}
