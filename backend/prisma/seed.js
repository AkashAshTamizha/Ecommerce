const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ---- Super Admin ----
  const adminPassword = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ecomxc.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@ecomxc.com',
      passwordHash: adminPassword,
      role: 'SUPER_ADMIN',
      emailVerified: true,
    },
  });
  
  console.log(`✅ Super Admin: admin@ecomxc.com / Admin@12345`);

  // ---- Categories ----
  const categoryNames = ['Electronics', 'Mobiles', 'Laptops', 'Audio', 'Accessories'];
  const categories = {};
  for (const name of categoryNames) {
    categories[name] = await prisma.category.upsert({
      where: { slug: name.toLowerCase() },
      update: {},
      create: { name, slug: name.toLowerCase() },
    });
  }
  console.log(`✅ ${categoryNames.length} categories created`);

  // ---- Brands ----
  const brandNames = ['Apple', 'Samsung', 'Sony', 'Dell', 'HP'];
  const brands = {};
  for (const name of brandNames) {
    brands[name] = await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`✅ ${brandNames.length} brands created`);

  // ---- Sample Seller ----
  const sellerPassword = await bcrypt.hash('Seller@12345', 12);
  const sellerUser = await prisma.user.upsert({
    where: { email: 'seller@ecomxc.com' },
    update: {},
    create: {
      name: 'Tech Store Owner',
      email: 'seller@ecomxc.com',
      passwordHash: sellerPassword,
      role: 'SELLER',
      emailVerified: true,
    },
  });

  const seller = await prisma.seller.upsert({
    where: { userId: sellerUser.id },
    update: {},
    create: {
      userId: sellerUser.id,
      storeName: 'Tech Store',
      status: 'APPROVED',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
    },
  });
  console.log(`✅ Sample Seller: seller@ecomxc.com / Seller@12345`);

  // ---- Sample Accountant ----
  const accountantPassword = await bcrypt.hash('Accountant@12345', 12);
  await prisma.user.upsert({
    where: { email: 'accountant@ecomxc.com' },
    update: {},
    create: {
      name: 'Priya Accountant',
      email: 'accountant@ecomxc.com',
      passwordHash: accountantPassword,
      role: 'ACCOUNTANT',
      emailVerified: true,
    },
  });
  console.log(`✅ Sample Accountant: accountant@ecomxc.com / Accountant@12345`);

  // ---- Sample Stock Manager ----
  const stockManagerPassword = await bcrypt.hash('Stock@12345', 12);
  await prisma.user.upsert({
    where: { email: 'stock@ecomxc.com' },
    update: {},
    create: {
      name: 'Ravi Stock Manager',
      email: 'stock@ecomxc.com',
      passwordHash: stockManagerPassword,
      role: 'STOCK_MANAGER',
      emailVerified: true,
    },
  });
  console.log(`✅ Sample Stock Manager: stock@ecomxc.com / Stock@12345`);

  // ---- Sample Delivery Agent ----
  const deliveryPassword = await bcrypt.hash('Delivery@12345', 12);
  const deliveryAgent = await prisma.user.upsert({
    where: { email: 'delivery@ecomxc.com' },
    update: {},
    create: {
      name: 'Arjun Delivery Agent',
      email: 'delivery@ecomxc.com',
      phone: '+91-9000011122',
      passwordHash: deliveryPassword,
      role: 'DELIVERY_AGENT',
      emailVerified: true,
    },
  });
  console.log(`✅ Sample Delivery Agent: delivery@ecomxc.com / Delivery@12345`);

  // ---- Sample Customer + Address ----
  const customerPassword = await bcrypt.hash('Customer@12345', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@ecomxc.com' },
    update: {},
    create: {
      name: 'Jane Doe',
      email: 'customer@ecomxc.com',
      phone: '+91-9123456780',
      passwordHash: customerPassword,
      role: 'CUSTOMER',
      emailVerified: true,
    },
  });

  const existingAddress = await prisma.address.findFirst({ where: { userId: customer.id, label: 'Home' } });
  const customerAddress = existingAddress || await prisma.address.create({
    data: {
      userId: customer.id,
      label: 'Home',
      fullName: 'Jane Doe',
      phone: '+91-9123456780',
      addressLine: '123 Main Street, Apt 4B',
      city: 'New York',
      state: 'New York',
      country: 'USA',
      pincode: '10001',
      isDefault: true,
    },
  });
  console.log(`✅ Sample Customer: customer@ecomxc.com / Customer@12345`);

  // ---- Sample Warehouse ----
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN-WH' },
    update: {},
    create: {
      sellerId: seller.id,
      name: 'Main Warehouse',
      code: 'MAIN-WH',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
    },
  });
  console.log(`✅ Warehouse created: ${warehouse.name}`);

  // ---- Sample Product with stock ----
  const product = await prisma.product.upsert({
    where: { sku: 'IP15-128-BLK' },
    update: {},
    create: {
      name: 'Apple iPhone 15 (128GB) - Black',
      sku: 'IP15-128-BLK',
      slug: 'apple-iphone-15-128gb-black',
      shortDesc: 'Latest iPhone 15 with A16 Bionic chip, 48MP camera and USB-C.',
      fullDesc: 'The iPhone 15 features a dynamic island, 48MP main camera, and the powerful A16 Bionic chip.',
      categoryId: categories['Mobiles'].id,
      brandId: brands['Apple'].id,
      sellerId: seller.id,
      mrp: 79900,
      sellingPrice: 71910,
      costPrice: 65000,
      taxPct: 18,
      minStockLevel: 5,
      maxStockLevel: 120,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
    },
  });

  const existingInventory = await prisma.inventory.findFirst({
    where: { productId: product.id, variantId: null, warehouseId: warehouse.id },
  });
  if (existingInventory) {
    await prisma.inventory.update({
      where: { id: existingInventory.id },
      data: { quantityOnHand: 45, reorderPoint: 5, reorderQty: 50 },
    });
  } else {
    await prisma.inventory.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantityOnHand: 45,
        reorderPoint: 5,
        reorderQty: 50,
      },
    });
  }
  console.log(`✅ Sample product with stock: ${product.name}`);

  // ---- Sample Vendor + Purchase Order ----
  const vendor = await prisma.vendor.upsert({
    where: { email: 'orders@globalsupplyco.com' },
    update: {},
    create: {
      name: 'Global Supply Co.',
      contactPerson: 'Anil Mehta',
      email: 'orders@globalsupplyco.com',
      phone: '+91-9876543210',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      gstNumber: '27ABCDE1234F1Z5',
    },
  });

  const existingPO = await prisma.purchaseOrder.findFirst({ where: { poNumber: 'PO-SEED0001' } });
  if (!existingPO) {
    await prisma.purchaseOrder.create({
      data: {
        poNumber: 'PO-SEED0001',
        vendorId: vendor.id,
        warehouseId: warehouse.id,
        status: 'ORDERED',
        subtotal: 650000,
        totalAmount: 650000,
        createdById: admin.id,
        items: {
          create: [{ productId: product.id, quantityOrdered: 10, unitCost: 65000 }],
        },
      },
    });
  }
  console.log(`✅ Sample vendor and purchase order created`);

  // ---- Sample Order + Shipment (demonstrates the storefront -> delivery flow) ----
  const existingOrder = await prisma.order.findFirst({ where: { orderNumber: 'ORD-SEED0001' } });
  let sampleOrder = existingOrder;
  if (!sampleOrder) {
    sampleOrder = await prisma.order.create({
      data: {
        orderNumber: 'ORD-SEED0001',
        customerId: customer.id,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        subtotal: 71910,
        tax: 0,
        shippingFee: 0,
        totalAmount: 71910,
        addressId: customerAddress.id,
        shippingAddress: {
          label: customerAddress.label, fullName: customerAddress.fullName, phone: customerAddress.phone,
          addressLine: customerAddress.addressLine, city: customerAddress.city, state: customerAddress.state,
          country: customerAddress.country, pincode: customerAddress.pincode,
        },
        items: { create: [{ productId: product.id, quantity: 1, price: 71910 }] },
      },
    });
  }

  const existingShipment = await prisma.shipment.findFirst({ where: { orderId: sampleOrder.id } });
  if (!existingShipment) {
    const shipment = await prisma.shipment.create({
      data: {
        shipmentNumber: 'SHP-SEED0001',
        orderId: sampleOrder.id,
        warehouseId: warehouse.id,
        status: 'PACKED',
        courierName: 'BlueDart Express',
        trackingNumber: 'BD123456789IN',
        deliveryAgentId: deliveryAgent.id,
        shippingAddress: sampleOrder.shippingAddress,
        estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        events: {
          create: [
            { status: 'CREATED', note: 'Package created and awaiting packing.' },
            { status: 'PACKED', note: 'Package packed and ready for pickup.' },
          ],
        },
      },
    });
    console.log(`✅ Sample order + shipment created: ${sampleOrder.orderNumber} / ${shipment.shipmentNumber}`);
  }

  // ---- Default system settings ----
  await prisma.systemSetting.upsert({
    where: { key: 'storeName' },
    update: {},
    create: { key: 'storeName', value: 'EcomXC' },
  });
  console.log(`✅ Default settings seeded`);

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
