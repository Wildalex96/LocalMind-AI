const crypto = require('crypto');

class LiveTradeGate {
  constructor({ permissionManager, adapter } = {}) {
    this.permissionManager = permissionManager;
    this.adapter = adapter || { placeOrder: async () => { throw new Error('No live exchange adapter configured'); } };
    this.pending = new Map();
  }

  createSignal(order) {
    if (!order || !order.symbol || !['BUY', 'SELL'].includes(order.side)) throw new Error('Invalid trade signal');
    const id = crypto.randomUUID();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const signal = { id, ...order, createdAt: new Date().toISOString(), expiresAt, status: 'awaiting_confirmation' };
    this.pending.set(id, signal);
    return signal;
  }

  listPending() {
    const now = Date.now();
    for (const [id, signal] of this.pending) if (signal.expiresAt <= now && signal.status === 'awaiting_confirmation') { signal.status = 'expired'; this.pending.set(id, signal); }
    return [...this.pending.values()].filter(s => s.status === 'awaiting_confirmation');
  }

  async confirm(id) {
    const signal = this.pending.get(id);
    if (!signal || signal.status !== 'awaiting_confirmation') throw new Error('Signal is unavailable or expired');
    if (signal.expiresAt <= Date.now()) { signal.status = 'expired'; throw new Error('Signal expired'); }
    if (!this.permissionManager) throw new Error('Permission Manager is required');
    const permission = await this.permissionManager.request('tradeExecution', { operation: 'liveTrade', signal });
    if (!permission.approved) { signal.status = 'denied'; return signal; }
    signal.status = 'executing';
    try {
      const result = await this.adapter.placeOrder(signal);
      signal.status = 'executed';
      signal.result = result;
      signal.executedAt = new Date().toISOString();
      return signal;
    } catch (error) {
      signal.status = 'failed';
      signal.error = error.message;
      throw error;
    }
  }

  reject(id) {
    const signal = this.pending.get(id);
    if (!signal) throw new Error('Signal not found');
    signal.status = 'rejected';
    return signal;
  }
}

module.exports = { LiveTradeGate };
