import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureElysiumNetwork } from '../src/wallet.js';
import { CHAIN } from '../src/constants.js';

function wallet({ error, autoSwitch = false, already = false, unchanged = false, addError } = {}) {
  let chain = already ? CHAIN.hexId : '0x1', attempts = 0;
  const calls = [];
  return { calls, async request(request) {
    calls.push(request);
    if (request.method === 'eth_chainId') return chain;
    if (request.method === 'wallet_switchEthereumChain') {
      if (++attempts === 1 && error) throw error;
      if (!unchanged) chain = CHAIN.hexId;
    }
    if (request.method === 'wallet_addEthereumChain') {
      if (addError) throw addError;
      if (autoSwitch) chain = CHAIN.hexId;
    }
  }};
}
test('already selected network does not prompt', async () => {
  const provider=wallet({already:true}); await ensureElysiumNetwork(provider);
  assert.deepEqual(provider.calls.map(c=>c.method),['eth_chainId']);
});
test('known chain switches without attempting to add it', async () => {
  const provider=wallet(); await ensureElysiumNetwork(provider);
  assert.equal(provider.calls.filter(c=>c.method==='wallet_switchEthereumChain').length,1);
  assert.equal(provider.calls.some(c=>c.method==='wallet_addEthereumChain'),false);
});
for (const error of [{code:4902},{code:'4902'},{code:-32603,data:{originalError:{code:4902}}},{message:'Unrecognized chain ID "0x185d9". Try adding the chain first.'}]) {
  test('missing chain error adds the configured chain, then selects it: '+JSON.stringify(error), async () => {
    const provider=wallet({error});await ensureElysiumNetwork(provider);
    const add=provider.calls.find(c=>c.method==='wallet_addEthereumChain');
    assert.equal(add.params[0].chainId,CHAIN.hexId);
    assert.deepEqual(add.params[0].rpcUrls,CHAIN.rpcUrls);
    assert.equal(provider.calls.filter(c=>c.method==='wallet_switchEthereumChain').length,2);
  });
}
test('auto-selected added chain does not prompt to switch a second time', async () => {
  const provider=wallet({error:{code:4902},autoSwitch:true});await ensureElysiumNetwork(provider);
  assert.equal(provider.calls.filter(c=>c.method==='wallet_switchEthereumChain').length,1);
});
for (const code of [4001,-32002,-32603]) {
  test('declined, pending, or unrelated errors never trigger network addition: '+code, async () => {
    const provider=wallet({error:{code}});await assert.rejects(ensureElysiumNetwork(provider));
    assert.equal(provider.calls.some(c=>c.method==='wallet_addEthereumChain'),false);
  });
}
test('network addition rejection stops without another prompt', async () => {
  const provider=wallet({error:{code:4902},addError:{code:4001}});
  await assert.rejects(ensureElysiumNetwork(provider));
  assert.equal(provider.calls.filter(c=>c.method==='wallet_switchEthereumChain').length,1);
});
test('a wallet reporting success without changing network is not accepted', async () => {
  await assert.rejects(ensureElysiumNetwork(wallet({unchanged:true})),/still on another network/);
});
