// Frontend API Service for RK Timber App

async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // Try relative endpoint first (works on Vercel, localhost & Vite proxy)
  try {
    const res = await fetch(`/api/${cleanEndpoint}`, options);
    if (res.ok) {
      const data = await res.json();
      return { success: true, ...data };
    } else {
      try {
        const errData = await res.json();
        return { success: false, ...errData };
      } catch (e) {
        // Non-JSON response
      }
    }
  } catch (err) {
    // Only attempt direct Apache localhost URL if running on local environment
    const host = window.location.hostname || '';
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
      try {
        const directUrl = `http://${host}/RK%20APP/api/${cleanEndpoint}`;
        const resDirect = await fetch(directUrl, options);
        if (resDirect.ok) {
          const data = await resDirect.json();
          return { success: true, ...data };
        }
      } catch (directErr) {
        console.warn(`Local fallback to ${cleanEndpoint} failed:`, directErr);
      }
    }
  }

  return { success: false, error: 'Database / API unavailable' };
}

export const apiService = {
  // Wood Species Rates
  async getWoodTypes() {
    const res = await request('wood_types.php');
    if (res.success && Array.isArray(res.data)) {
      return res.data;
    }
    return null;
  },

  async saveWoodType(woodData) {
    return await request('wood_types.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(woodData)
    });
  },

  async deleteWoodType(id) {
    return await request(`wood_types.php?id=${id}`, {
      method: 'DELETE'
    });
  },

  // Orders / Bills
  async getOrders(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await request(`orders.php${query}`);
    if (res.success && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  },

  async getOrderById(id) {
    const res = await request(`orders.php?id=${id}`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  },

  async getDashboardStats() {
    const res = await request('orders.php?stats=1');
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  },

  async saveOrder(orderPayload) {
    return await request('orders.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
  },

  async deleteOrder(id, billNo = '') {
    const params = [];
    if (id && typeof id === 'number' && id < 10000000000) params.push(`id=${id}`);
    if (billNo) params.push(`bill_no=${encodeURIComponent(billNo)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : `?id=${id}`;
    return await request(`orders.php${query}`, {
      method: 'DELETE'
    });
  },

  async updateOrderStatus(orderData) {
    return await request('orders.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orderData, action: 'update_status' })
    });
  },

  // Timber calculations
  async calculate(items) {
    return await request('calculate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
  },

  // Daily Retail & Cash Flow Ledger
  async getDailyRetailList() {
    const res = await request('daily_retail.php');
    if (res.success && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  },

  async getDailyRetailByDate(date) {
    const res = await request(`daily_retail.php?date=${encodeURIComponent(date)}`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  },

  async saveDailyRetail(payload) {
    return await request('daily_retail.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async deleteDailyRetail(id, date = '') {
    const params = [];
    if (id && typeof id === 'number' && id < 10000000000) params.push(`id=${id}`);
    if (date) params.push(`date=${encodeURIComponent(date)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : (id ? `?id=${id}` : `?date=${encodeURIComponent(date)}`);
    return await request(`daily_retail.php${query}`, {
      method: 'DELETE'
    });
  },

  // Upload generated PDF to server
  async uploadPdf(blob, filename) {
    const formData = new FormData();
    formData.append('pdf_file', blob, filename);
    formData.append('filename', filename);
    return await request('upload_pdf.php', {
      method: 'POST',
      body: formData
    });
  },

  // Dashboard monthly analytics
  async getDashboardStats(month = '') {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    const res = await request(`dashboard.php${query}`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }
};

export default apiService;
