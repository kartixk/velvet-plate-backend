const { productSchema, productUpdateSchema, purchaseSchema } = require('../src/validators/productValidator');
const { registerSchema, loginSchema } = require('../src/validators/authValidator');
const { cartItemSchema } = require('../src/validators/cartValidator');

describe('Schema validation (Zod validation layer)', () => {

  describe('Auth Validators', () => {
    test('User missing name is valid, but missing email fails', () => {
      const result = registerSchema.safeParse({ password: '123456', phone: '9876543210' });
      expect(result.success).toBe(false);
      expect(result.error.flatten().fieldErrors).toHaveProperty('email');
    });

    test('User missing phone fails validation', () => {
      const result = registerSchema.safeParse({ email: 'test@example.com', password: '123456' });
      expect(result.success).toBe(false);
      expect(result.error.flatten().fieldErrors).toHaveProperty('phone');
    });

    test('Valid register payload passes', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'securepassword',
        name: 'Valid User',
        phone: '9876543210'
      });
      expect(result.success).toBe(true);
    });

    test('Login missing password fails', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(false);
      expect(result.error.flatten().fieldErrors).toHaveProperty('password');
    });
  });

  describe('Product Validators', () => {
    test('Product negative price fails', () => {
      const p = {
        name: 'Bad Product',
        category: 'Main Course',
        price: -10,
        imageUrl: 'http://example.com/bad.jpg'
      };

      const result = productSchema.safeParse(p);
      expect(result.success).toBe(false);
      expect(result.error.flatten().fieldErrors).toHaveProperty('price');
    });

    test('Product missing imageUrl fails', () => {
      const p = {
        name: 'No Image Product',
        category: 'Desserts',
        price: 50
      };

      const result = productSchema.safeParse(p);
      expect(result.success).toBe(false);
      expect(result.error.flatten().fieldErrors).toHaveProperty('imageUrl');
    });

    test('Product valid data passes', () => {
      const p = {
        name: 'Butter Chicken',
        category: 'Curry',
        price: 320,
        imageUrl: 'http://example.com/butter_chicken.jpg'
      };

      const result = productSchema.safeParse(p);
      expect(result.success).toBe(true);
    });

    test('Purchase schema with quantity less than 1 fails', () => {
      const result = purchaseSchema.safeParse({ quantity: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('Cart Validators', () => {
    test('CartItem missing quantity fails', () => {
      const result = cartItemSchema.safeParse({ productId: '65f123456789012345678901' });
      expect(result.success).toBe(false);
    });

    test('CartItem with valid productId and quantity passes', () => {
      const result = cartItemSchema.safeParse({
        productId: '65f123456789012345678901',
        quantity: 2
      });
      expect(result.success).toBe(true);
    });
  });
});
