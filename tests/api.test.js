/**
 * Standalone API Test Runner for Node.js built-in test runner
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const app = require('../src/app');

// Mini helper to test Express routes without external dependencies
function mockRequest(method, url, body = null, headers = {}) {
  return new Promise((resolve) => {
    const http = require('http');
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const parsedUrl = new URL(url, `http://127.0.0.1:${port}`);
      const options = {
        hostname: '127.0.0.1',
        port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          server.close();
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(rawData) });
          } catch {
            resolve({ statusCode: res.statusCode, rawBody: rawData });
          }
        });
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

test('GET /api/health returns healthy QAR market status', async () => {
  const res = await mockRequest('GET', '/api/health');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.currency, 'QAR');
  assert.equal(res.body.market, 'Qatar');
});

test('GET /api/products returns product catalog', async () => {
  const res = await mockRequest('GET', '/api/products');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length > 0);
});

test('GET /api/categories returns active categories', async () => {
  const res = await mockRequest('GET', '/api/categories');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
});

test('POST /api/auth/login authenticates customer credentials', async () => {
  const res = await mockRequest('POST', '/api/auth/login', {
    email: 'hamad@qatarfreshveg.qa',
    password: 'Customer@123456',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.token);
});

test('guest orders receive a session that can fetch their live order history', async () => {
  const products = await mockRequest('GET', '/api/products');
  const order = await mockRequest('POST', '/api/orders', {
    items: [{ productId: products.body.data[0]._id, quantity: 10 }],
    addressSnapshot: {
      fullName: 'Guest Order Test',
      phoneNumber: '+974 5000 1234',
      zone: 'Zone 66',
      street: 'Street 850',
      building: 'Villa 14',
    },
  });

  assert.equal(order.statusCode, 201);
  assert.equal(order.body.data.orderStatus, 'Pending');
  assert.ok(order.body.trackingToken);

  const history = await mockRequest('GET', '/api/orders/my', null, {
    Authorization: `Bearer ${order.body.trackingToken}`,
  });
  assert.equal(history.statusCode, 200);
  assert.ok(history.body.data.some((item) => item._id === order.body.data._id));
});

test('only admins can update order status', async () => {
  const deliveryLogin = await mockRequest('POST', '/api/auth/admin/login', {
    email: 'delivery@qatarfreshveg.qa',
    password: 'Delivery@123456',
  });
  assert.equal(deliveryLogin.statusCode, 200);

  const deliveryUpdate = await mockRequest(
    'PATCH',
    '/api/orders/64e000000000000000000001/status',
    { status: 'Confirmed' },
    { Authorization: `Bearer ${deliveryLogin.body.data.token}` }
  );
  assert.equal(deliveryUpdate.statusCode, 403);

  const adminLogin = await mockRequest('POST', '/api/auth/admin/login', {
    email: 'admin@qatarfreshveg.qa',
    password: 'Admin@123456',
  });
  assert.equal(adminLogin.statusCode, 200);

  const adminUpdate = await mockRequest(
    'PATCH',
    '/api/orders/64e000000000000000000001/status',
    { status: 'Confirmed' },
    { Authorization: `Bearer ${adminLogin.body.data.token}` }
  );
  assert.equal(adminUpdate.statusCode, 200);
  assert.equal(adminUpdate.body.data.orderStatus, 'Confirmed');
});
