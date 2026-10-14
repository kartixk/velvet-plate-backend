/**
 * Idempotent demo seed (Prisma, not mongoose).
 * Creates: 1 ADMIN, 1 verified MANAGER owning 1 verified+visible branch with 6 menu items, 1 CUSTOMER.
 *
 * Usage (same env vars as the backend, plus the three DEMO_*_PASSWORD vars):
 *   node scripts/seed-demo.js
 *
 * Re-running updates the same records instead of duplicating them.
 * Only emails are printed, never passwords.
 */
require("../src/config/env"); // fail-fast env validation
const prisma = require("../src/prismaClient");
const { hashPassword } = require("../src/services/auth"); // same bcrypt settings as the app

const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || "admin@velvetplate.com";
const MANAGER_EMAIL = process.env.DEMO_MANAGER_EMAIL || "manager@velvetplate.com";
const CUSTOMER_EMAIL = process.env.DEMO_CUSTOMER_EMAIL || "customer@velvetplate.com";
const BRANCH_NAME = process.env.DEMO_BRANCH_NAME || "Velvet Plate Central Kitchen";

const MENU = [
  { name: "Paneer Butter Masala", price: 240, category: "Main Course", dietType: "Veg", description: "Cottage cheese in a creamy tomato gravy." },
  { name: "Chicken Biryani", price: 280, category: "Main Course", dietType: "Non-Veg", description: "Fragrant basmati rice layered with spiced chicken." },
  { name: "Garlic Naan", price: 60, category: "Breads", dietType: "Veg", description: "Tandoor-baked bread with garlic butter." },
  { name: "Veg Spring Rolls", price: 140, category: "Starters", dietType: "Veg", description: "Crisp rolls stuffed with vegetables." },
  { name: "Gulab Jamun", price: 90, category: "Desserts", dietType: "Veg", description: "Warm milk dumplings in sugar syrup." },
  { name: "Masala Chai", price: 40, category: "Beverages", dietType: "Veg", description: "Spiced milk tea." },
];

function getPassword(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value || value.length < 6) {
    console.error(`Missing or too short password for: ${name} (min 6 characters)`);
    process.exit(1);
  }
  return value;
}

async function upsertUser({ email, password, name, phone, role }) {
  const hashed = await hashPassword(password);
  return prisma.user.upsert({
    where: { email },
    update: { password: hashed, name, phone, role, isVerified: true },
    create: { email, password: hashed, name, phone, role, isVerified: true },
  });
}

async function main() {
  const adminPassword = getPassword("DEMO_ADMIN_PASSWORD", "Admin@123456");
  const managerPassword = getPassword("DEMO_MANAGER_PASSWORD", "Manager@123456");
  const customerPassword = getPassword("DEMO_CUSTOMER_PASSWORD", "Customer@123456");

  const admin = await upsertUser({ email: ADMIN_EMAIL, password: adminPassword, name: "Admin User", phone: "9876543210", role: "ADMIN" });
  const manager = await upsertUser({ email: MANAGER_EMAIL, password: managerPassword, name: "Branch Manager", phone: "9876543211", role: "MANAGER" });
  const customer = await upsertUser({ email: CUSTOMER_EMAIL, password: customerPassword, name: "Customer User", phone: "9876543212", role: "CUSTOMER" });

  // Obviously fake KYC data
  const branchData = {
    name: BRANCH_NAME,
    branchName: "Demo Kitchen",
    location: "Demo City",
    address: "1 Demo Street",
    city: "Demo City",
    state: "Demo State",
    pincode: "000000",
    phone: "0000000002",
    managerName: "Demo Manager",
    managerPhone: "0000000002",
    managerAddress: "1 Demo Street",
    managerCity: "Demo City",
    managerState: "Demo State",
    managerPincode: "000000",
    panNumber: "DEMO00000D",
    aadharNumber: "000000000000",
    gstNumber: "00DEMO0000D0Z0",
    fssaiLicense: "00000000000000",
    bankAccountName: "Demo Kitchen",
    bankAccountNumber: "000000000000",
    bankIfscCode: "DEMO0000000",
    openTime: "09:00",
    closeTime: "22:00",
    storeStatus: "verified",
    isVisible: true,
  };

  const branch = await prisma.branch.upsert({
    where: { managerId: manager.id },
    update: branchData,
    create: { ...branchData, manager: { connect: { id: manager.id } } },
  });

  for (const item of MENU) {
    const existing = await prisma.product.findFirst({ where: { name: item.name, branchId: branch.id } });
    const data = {
      ...item,
      isAvailable: true,
      imageUrl: `https://placehold.co/600x400?text=${encodeURIComponent(item.name)}`,
      branchId: branch.id,
    };
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
    } else {
      await prisma.product.create({ data });
    }
  }

  console.log("Demo data ready.");
  console.log(`  ADMIN    : ${admin.email}`);
  console.log(`  MANAGER  : ${manager.email}  (branch: ${branch.name})`);
  console.log(`  CUSTOMER : ${customer.email}`);
  console.log(`  Menu items: ${MENU.length}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
