const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Velvet Plate Restaurant Management API',
    version: '1.0.0',
    description:
      'Comprehensive RESTful API documentation and interactive testing interface for the Velvet Plate Restaurant Management System.\n\n### Authentication Instructions:\n1. Call `POST /api/auth/login` with your credentials.\n2. Copy the returned `token`.\n3. Click the **Authorize** button at the top right and enter: `Bearer <your_token>`.\n4. All protected endpoints can now be executed directly in the UI.',
    contact: {
      name: 'Velvet Plate Engineering',
      email: 'kartikeyaa15@gmail.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local Development Server',
    },
    {
      url: '/',
      description: 'Current Environment Host',
    },
  ],
  tags: [
    { name: 'Health', description: 'System health check and diagnostic monitoring' },
    { name: 'Authentication', description: 'User registration, login session, token auth, and profile management' },
    { name: 'Products', description: 'Restaurant catalog, items, pricing, inventory stock, and availability' },
    { name: 'Cart & Checkout', description: 'Shopping cart operations, quantity adjustments, and fast checkout' },
    { name: 'Orders', description: 'Order life-cycle, status transitions, kitchen fulfillment, and tracking' },
    { name: 'Branches & Stores', description: 'Store onboarding, compliance verification, visibility, and documents' },
    { name: 'Admin', description: 'Administrative controls, manager approvals, and system-wide overrides' },
    { name: 'Reports', description: 'Sales analytics, revenue breakdowns, and performance tracking' },
    { name: 'Support', description: 'Emergency manager-to-admin uplink protocol and escalation' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT bearer token obtained from /api/auth/login.',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
        description: 'HttpOnly cookie authentication.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'fail' },
          message: { type: 'string', example: 'Invalid credentials or request payload' },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['email', 'password', 'phone'],
        properties: {
          email: { type: 'string', format: 'email', example: 'customer@velvetplate.com' },
          password: { type: 'string', minLength: 6, example: 'secret123' },
          name: { type: 'string', example: 'Kartik Sharma' },
          phone: { type: 'string', example: '9876543210' },
          role: { type: 'string', enum: ['CUSTOMER', 'MANAGER', 'ADMIN'], example: 'CUSTOMER' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'customer@velvetplate.com' },
          password: { type: 'string', example: 'secret123' },
        },
      },
      ProductInput: {
        type: 'object',
        required: ['name', 'price', 'category', 'imageUrl'],
        properties: {
          name: { type: 'string', example: 'Paneer Butter Masala' },
          description: { type: 'string', example: 'Rich and creamy cottage cheese curry with butter & spices' },
          price: { type: 'number', example: 280 },
          category: { type: 'string', example: 'Main Course' },
          dietType: { type: 'string', example: 'Veg' },
          isAvailable: { type: 'boolean', example: true },
          quantity: { type: 'integer', example: 50 },
          imageUrl: { type: 'string', format: 'uri', example: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7' },
          branchId: { type: 'string', example: '65f123456789012345678901', nullable: true },
        },
      },
      CartItemInput: {
        type: 'object',
        required: ['quantity'],
        properties: {
          productId: { type: 'string', example: '65f123456789012345678901' },
          sweetId: { type: 'string', example: '65f123456789012345678901' },
          quantity: { type: 'integer', minimum: 1, example: 2 },
        },
      },
      BuyNowInput: {
        type: 'object',
        required: ['quantity'],
        properties: {
          productId: { type: 'string', example: '65f123456789012345678901' },
          sweetId: { type: 'string', example: '65f123456789012345678901' },
          quantity: { type: 'integer', minimum: 1, example: 1 },
          orderType: { type: 'string', enum: ['DINE_IN', 'TAKEAWAY'], example: 'TAKEAWAY' },
        },
      },
      BranchOnboardInput: {
        type: 'object',
        required: ['branchName', 'city', 'state', 'phone'],
        properties: {
          branchName: { type: 'string', example: 'Velvet Plate Central' },
          address: { type: 'string', example: '123 Gourmet Street' },
          city: { type: 'string', example: 'Chennai' },
          state: { type: 'string', example: 'Tamil Nadu' },
          pincode: { type: 'string', example: '600001' },
          phone: { type: 'string', example: '044-12345678' },
          managerName: { type: 'string', example: 'Kartik S' },
          managerPhone: { type: 'string', example: '9876543210' },
          panNumber: { type: 'string', example: 'ABCDE1234F' },
          aadharNumber: { type: 'string', example: '123456789012' },
          fssaiNumber: { type: 'string', example: '10019043002678' },
          gstNumber: { type: 'string', example: '33AAAAA0000A1Z5' },
        },
      },
      SupportUplinkInput: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Urgent compliance verification requested for store document.' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check probe',
        description: 'Returns server operational status.',
        responses: {
          200: {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register new user account',
        description: 'Creates a CUSTOMER, MANAGER, or ADMIN account in the system.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } },
          },
        },
        responses: {
          201: { description: 'Registration successful' },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate and receive token',
        description: 'Verifies email and password, setting HttpOnly cookie and returning bearer token.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } },
          },
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/logout': {
      get: {
        tags: ['Authentication'],
        summary: 'Log out current session',
        description: 'Clears authentication cookies and invalidates session.',
        responses: {
          200: { description: 'Successfully logged out' },
        },
      },
    },
    '/api/auth/profile': {
      put: {
        tags: ['Authentication'],
        summary: 'Update user profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Updated Name' },
                  phone: { type: 'string', example: '9123456780' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'Get all products',
        description: 'Lists all restaurant products with optional filtering by branch.',
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' }, description: 'Filter products by specific branch ID' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by product category' },
        ],
        responses: {
          200: { description: 'List of products' },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create or upsert product',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } },
          },
        },
        responses: {
          201: { description: 'Product created' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/products/{id}': {
      put: {
        tags: ['Products'],
        summary: 'Update product by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } },
          },
        },
        responses: {
          200: { description: 'Product updated' },
          404: { description: 'Product not found' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete product by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Product deleted' },
          404: { description: 'Product not found' },
        },
      },
    },
    '/api/products/{id}/purchase': {
      post: {
        tags: ['Products'],
        summary: 'Direct purchase product',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['quantity'],
                properties: { quantity: { type: 'integer', minimum: 1, example: 1 } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Purchase processed successfully' },
        },
      },
    },
    '/api/products/{id}/restock': {
      post: {
        tags: ['Products'],
        summary: 'Restock product inventory (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  quantity: { type: 'integer', minimum: 1, example: 20 },
                  isAvailable: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Product restocked' },
        },
      },
    },
    '/api/products/{id}/availability': {
      patch: {
        tags: ['Products'],
        summary: 'Toggle product availability',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { isAvailable: { type: 'boolean', example: true } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Availability toggled' },
        },
      },
    },
    '/api/cart': {
      get: {
        tags: ['Cart & Checkout'],
        summary: 'Get current user cart',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current user cart object' },
        },
      },
    },
    '/api/cart/items': {
      post: {
        tags: ['Cart & Checkout'],
        summary: 'Add or update item in cart',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CartItemInput' } },
          },
        },
        responses: {
          200: { description: 'Item added or quantity updated' },
        },
      },
    },
    '/api/cart/items/{sweetId}': {
      put: {
        tags: ['Cart & Checkout'],
        summary: 'Set cart item quantity',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'sweetId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['quantity'],
                properties: { quantity: { type: 'integer', minimum: 1, example: 3 } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Cart item quantity updated' },
        },
      },
      delete: {
        tags: ['Cart & Checkout'],
        summary: 'Remove item from cart',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'sweetId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Item removed from cart' },
        },
      },
    },
    '/api/cart/confirm': {
      post: {
        tags: ['Cart & Checkout'],
        summary: 'Confirm cart and create order',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Order created successfully' },
        },
      },
    },
    '/api/cart/order-type': {
      put: {
        tags: ['Cart & Checkout'],
        summary: 'Set order type (DINE_IN vs TAKEAWAY)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderType'],
                properties: { orderType: { type: 'string', enum: ['DINE_IN', 'TAKEAWAY'], example: 'DINE_IN' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Order type updated' },
        },
      },
    },
    '/api/cart/buy-now': {
      post: {
        tags: ['Cart & Checkout'],
        summary: 'Instant single-item checkout',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/BuyNowInput' } },
          },
        },
        responses: {
          201: { description: 'Instant order placed' },
        },
      },
    },
    '/api/orders': {
      get: {
        tags: ['Orders'],
        summary: 'Get customer order history',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of past orders for current authenticated user' },
        },
      },
    },
    '/api/orders/my-branch-orders': {
      get: {
        tags: ['Orders'],
        summary: 'Get orders assigned to manager branch',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of branch orders' },
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order details by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Order details' },
          404: { description: 'Order not found' },
        },
      },
    },
    '/api/orders/{id}/status': {
      put: {
        tags: ['Orders'],
        summary: 'Update order status (Manager/Kitchen)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
                    example: 'PREPARING',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Order status updated' },
        },
      },
    },
    '/api/orders/{id}/collect': {
      put: {
        tags: ['Orders'],
        summary: 'Mark order as collected by customer',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Order marked collected' },
        },
      },
    },
    '/api/branches': {
      get: {
        tags: ['Branches & Stores'],
        summary: 'Get all branches (Admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of all system branches' },
        },
      },
      post: {
        tags: ['Branches & Stores'],
        summary: 'Create branch (Admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/BranchOnboardInput' } },
          },
        },
        responses: {
          201: { description: 'Branch created' },
        },
      },
    },
    '/api/branches/list/public': {
      get: {
        tags: ['Branches & Stores'],
        summary: 'List verified & visible public branches',
        description: 'Returns available store locations for customers to select.',
        responses: {
          200: { description: 'List of active branches' },
        },
      },
    },
    '/api/branches/my-branch': {
      get: {
        tags: ['Branches & Stores'],
        summary: 'Get managed branch for logged-in manager',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Branch details or null if not onboarded yet' },
        },
      },
    },
    '/api/branches/onboard': {
      post: {
        tags: ['Branches & Stores'],
        summary: 'Submit branch onboarding details (Manager)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/BranchOnboardInput' } },
          },
        },
        responses: {
          200: { description: 'Branch onboarding saved and marked pending review' },
        },
      },
    },
    '/api/branches/upload': {
      post: {
        tags: ['Branches & Stores'],
        summary: 'Upload store verification documents (Manager)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  fssaiDoc: { type: 'string', format: 'binary', description: 'FSSAI Certificate' },
                  gstDoc: { type: 'string', format: 'binary', description: 'GST Certificate' },
                  bankPassbook: { type: 'string', format: 'binary', description: 'Bank Passbook / Cheque' },
                  managerPhoto: { type: 'string', format: 'binary', description: 'Manager Photo' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Documents uploaded and linked to branch' },
        },
      },
    },
    '/api/branches/{id}': {
      get: {
        tags: ['Branches & Stores'],
        summary: 'Get public branch view by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Store view details' },
          404: { description: 'Branch not found' },
        },
      },
      put: {
        tags: ['Branches & Stores'],
        summary: 'Update branch by ID (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/BranchOnboardInput' } },
          },
        },
        responses: {
          200: { description: 'Branch updated' },
        },
      },
      delete: {
        tags: ['Branches & Stores'],
        summary: 'Delete branch by ID (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Branch deleted' },
        },
      },
    },
    '/api/branches/{id}/visibility': {
      put: {
        tags: ['Branches & Stores'],
        summary: 'Toggle branch visibility on frontend menu',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Branch visibility toggled' },
        },
      },
    },
    '/api/branches/{id}/verify': {
      put: {
        tags: ['Branches & Stores'],
        summary: 'Approve or reject branch status (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['storeStatus'],
                properties: {
                  storeStatus: {
                    type: 'string',
                    enum: ['pending', 'under_review', 'verified', 'rejected'],
                    example: 'verified',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Branch status updated' },
        },
      },
    },
    '/api/admin/managers/pending': {
      get: {
        tags: ['Admin'],
        summary: 'List managers awaiting verification',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of unverified managers' },
        },
      },
    },
    '/api/admin/managers/{id}/approve': {
      put: {
        tags: ['Admin'],
        summary: 'Approve manager account',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Manager account approved and verified' },
        },
      },
    },
    '/api/reports/sales': {
      get: {
        tags: ['Reports'],
        summary: 'Get global sales analytics',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Aggregate sales summary and metrics' },
        },
      },
    },
    '/api/reports/branch-sales': {
      get: {
        tags: ['Reports'],
        summary: 'Get sales breakdown by branch',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Branch-specific revenue analytics' },
        },
      },
    },
    '/api/support/uplink': {
      post: {
        tags: ['Support'],
        summary: 'Trigger urgent support uplink to administrators',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SupportUplinkInput' } },
          },
        },
        responses: {
          200: { description: 'Uplink protocol triggered and email dispatched' },
        },
      },
    },
  },
};

const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #FF5A00; }
    .swagger-ui .topbar .topbar-wrapper img { content: url('https://placehold.co/40x40/FF5A00/FFFFFF?text=VP'); border-radius: 8px; }
    .swagger-ui .topbar .topbar-wrapper span { color: #f8fafc; font-weight: 800; font-size: 1.25rem; }
    .swagger-ui .info .title { color: #0f172a; font-weight: 800; }
    .swagger-ui .btn.authorize { background-color: #FF5A00; border-color: #FF5A00; color: #fff; font-weight: 700; border-radius: 8px; }
    .swagger-ui .btn.authorize svg { fill: #fff; }
    .swagger-ui .opblock.opblock-post { border-color: #10b981; }
    .swagger-ui .opblock.opblock-get { border-color: #3b82f6; }
    .swagger-ui .opblock.opblock-put { border-color: #f59e0b; }
    .swagger-ui .opblock.opblock-delete { border-color: #ef4444; }
  `,
  customSiteTitle: 'Velvet Plate API Docs & Testing Suite',
  customfavIcon: 'https://placehold.co/32x32/FF5A00/FFFFFF?text=V',
};

const setupSwagger = (app) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const enableSwagger = process.env.ENABLE_SWAGGER === 'true';

  // In production, disable Swagger routes by default unless explicitly opted in
  if (isProduction && !enableSwagger) {
    app.use(['/api-docs', '/api-docs.json'], (req, res) => {
      res.status(404).json({ error: "Documentation not found" });
    });
    return;
  }

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition, swaggerOptions));

  // Serve raw OpenAPI JSON schema for Postman / Insomnia
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDefinition);
  });
};

module.exports = {
  setupSwagger,
  swaggerDefinition,
};
