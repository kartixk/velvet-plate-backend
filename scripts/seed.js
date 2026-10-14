require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");
const Sweet = require("../src/models/Sweet");

async function seed() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/sweet-shop";
  await mongoose.connect(MONGO_URI, { family: 4 });

  await User.deleteMany({});
  await Sweet.deleteMany({});

  const pass = await bcrypt.hash("admin123", 10);
  await User.create({
    email: "admin@example.com",
    password: pass,
    name: "Admin",
    role: "ADMIN"
  });

  await Sweet.create({
    name: "Ladoo",
    category: "Indian",
    price: 10,
    quantity: 20,
    imageUrl: "https://placehold.co/400"
  });

  console.log("Seed complete");
  process.exit(0);
}

seed();
