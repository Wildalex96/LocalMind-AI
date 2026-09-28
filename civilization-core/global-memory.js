class GlobalMemory {
  constructor() {
    this.items = [];
  }

  store(item) {
    this.items.push({
      data: item,
      timestamp: new Date().toISOString()
    });
  }

  search(query) {
    const q = String(query).toLowerCase();
    return this.items.filter(item =>
      JSON.stringify(item).toLowerCase().includes(q)
    );
  }

  stats() {
    return {
      entries: this.items.length
    };
  }
}

module.exports = { GlobalMemory };
