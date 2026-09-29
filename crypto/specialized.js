const engine = require('./crypto-engine');

async function aggregate({ symbol='BTCUSDT', coin='bitcoin', protocol, address, chainid='1', network='eth-mainnet' }={}) {
  const result = { market: null, coin: null, defi: null, wallet: null, alchemy: null, warnings: [] };
  try { result.market = await engine.market(symbol, '1d', 365); } catch (e) { result.warnings.push(`market: ${e.message}`); }
  try { result.coin = await engine.coin(coin); } catch (e) { result.warnings.push(`coingecko: ${e.message}`); }
  try { result.defi = await engine.defillama(protocol); } catch (e) { result.warnings.push(`defillama: ${e.message}`); }
  if (address) {
    try { result.wallet = await engine.etherscan(address, chainid); } catch (e) { result.warnings.push(`etherscan: ${e.message}`); }
    try { result.alchemy = await engine.alchemy(address, network); } catch (e) { result.warnings.push(`alchemy: ${e.message}`); }
  }
  return result;
}

module.exports = { aggregate, paperTrade: engine.paperTrade };
