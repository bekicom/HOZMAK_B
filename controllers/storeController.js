const mongoose = require("mongoose");
const Store = require("../models/Store");
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const Client = require("../models/client");

/**
 * Client topish yoki yaratish (transaction ichida)
 */
async function resolveClient(client, session) {
  if (!client || (!client.phone && !client.name)) return null;

  const phone = client.phone ? client.phone.trim() : null;
  const name = client.name ? client.name.trim() : null;

  let found = null;
  if (phone) found = await Client.findOne({ phone }).session(session);
  else if (name) found = await Client.findOne({ name }).session(session);

  if (found) return found;

  // ✅ YANGI KOD - type majburiy "supplier"
  const payload = {
    name: name || "Noma'lum",
    phone: phone || undefined,
    address: client.address ? client.address.trim() : "",
    type: "supplier", // ✅ Har doim supplier
  };

  const created = await Client.create([payload], { session });
  return created[0];
}
// Dokonga mahsulot qo'shish (ombordan dokonga ko'chirish)
exports.addProductToStore = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let { product_id, quantity } = req.body;
    quantity = Number(quantity || 0);

    if (!product_id || !Number.isFinite(quantity) || quantity < 1) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "product_id va quantity to‘g‘ri berilmadi." });
    }

    const product = await Product.findById(product_id).session(session);
    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    if (product.stock < quantity) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Omborda yetarli mahsulot yo‘q." });
    }

    const storeProduct = await Store.findOne({ product_id }).session(session);
    if (storeProduct) {
      storeProduct.quantity += quantity;
      await storeProduct.save({ session });
    } else {
      const newStoreProduct = new Store({
        product_id: product._id,
        product_name: product.product_name,
        quantity,
      });
      await newStoreProduct.save({ session });
    }

    // ombor stockini kamaytiramiz
    product.stock -= quantity;

    // stock 0 bo‘lib qolishi mumkin, shuning uchun validatorni bypass qilyapmiz
    await product.save({ session, validateBeforeSave: false });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Mahsulot dokonga qo'shildi",
      product,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ error: error.message });
  }
};

// Dokondan mahsulot olish
exports.getStoreProducts = async (req, res) => {
  try {
    const storeProducts = await Store.find().populate("product_id");
    res.status(200).json(storeProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Dokondan mahsulotni o'chirish
exports.removeProductFromStore = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const store = await Store.findById(id).session(session);
    if (!store) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Dokondagi mahsulot topilmadi" });
    }

    await Store.findByIdAndDelete(id, { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ message: "Mahsulot dokondan o'chirildi" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};

// Dokondan mahsulot sotish
exports.sellProductFromStore = async (req, res) => {
  try {
    let { product_id, quantity } = req.body;
    quantity = Number(quantity || 0);

    if (!product_id || !Number.isFinite(quantity) || quantity < 1) {
      return res
        .status(400)
        .json({ message: "product_id yoki quantity noto‘g‘ri." });
    }

    const storeProduct = await Store.findOne({ product_id });
    if (!storeProduct) {
      return res.status(404).json({ message: "Mahsulot dokonda topilmadi" });
    }

    if (storeProduct.quantity < quantity) {
      return res.status(400).json({ message: "Dokonda yetarli mahsulot yo'q" });
    }

    storeProduct.quantity -= quantity;
    await storeProduct.save();

    return res
      .status(200)
      .json({ message: "Mahsulot dokondan sotildi", storeProduct });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Qaytarish (vazvrat)
exports.vazvratTovar = async (req, res) => {
  try {
    let { quantity, product_id, sale_id } = req.body;
    quantity = Number(quantity || 0);

    if (!sale_id || !product_id || !Number.isFinite(quantity) || quantity < 1) {
      return res
        .status(400)
        .json({ message: "Ma’lumotlar noto‘g‘ri berilgan." });
    }

    const sale = await Sale.findById(sale_id);
    if (!sale) {
      return res.status(404).json({ message: "Sotuv topilmadi" });
    }

    const skladProduct = await Product.findById(product_id);
    if (!skladProduct) {
      return res.status(404).json({ message: "Mahsulot omborda topilmadi" });
    }

    const storeProduct = await Store.findOne({ product_id });
    if (!storeProduct) {
      // ✅ BUG FIX: oldin save qilinmay qolgan edi
      const sp = new Store({
        product_id: skladProduct._id,
        product_name: skladProduct.product_name,
        quantity,
      });
      await sp.save();
    } else {
      storeProduct.quantity += quantity;
      await storeProduct.save();
    }

    if (quantity >= sale.quantity) {
      await Sale.findByIdAndDelete(sale_id);
    } else {
      sale.quantity -= quantity;
      await sale.save();
    }

    return res.status(200).json({ message: "Mahsulot qaytarildi" });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Serverda xatolik" });
  }
};

/**
 * ✅ Dokonga yangi mahsulot yaratib qo‘shish
 * Endi stock=0 qilmaymiz — real stock bilan yaratamiz.
 * Store.quantity ham o‘sha stock bo‘ladi.
 */
exports.createProductToStore = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const b = req.body;

    const stockNum = Number(b.stock);
    if (!Number.isFinite(stockNum) || stockNum < 1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Miqdor (stock) kamida 1 bo‘lishi kerak.",
      });
    }

    if (
      !b.product_name ||
      !b.model ||
      b.purchase_price == null ||
      b.sell_price == null ||
      !b.count_type ||
      !b.barcode
    ) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Majburiy maydonlar to'liq emas." });
    }

    // barcode uniqueness
    const exists = await Product.findOne({ barcode: b.barcode }).session(
      session
    );
    if (exists) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(409)
        .json({ message: "Bu barcode bilan mahsulot allaqachon mavjud." });
    }

    const clientDoc = await resolveClient(b.client, session);
    const clientId = clientDoc ? clientDoc._id : null;

    const newProductArr = await Product.create(
      [
        {
          product_name: b.product_name,
          model: b.model,
          stock: stockNum, // ✅ real stock
          purchase_price: Number(b.purchase_price),
          purchase_currency: b.purchase_currency,
          sell_price: Number(b.sell_price),
          sell_currency: b.sell_currency,
          brand_name: b.brand_name,
          storeProduct: true,
          count_type: b.count_type,
          barcode: b.barcode,
          special_notes: b.special_notes || "",
          kimdan_kelgan: b.kimdan_kelgan || "",
          paid_amount: Number(b.paid_amount || 0),
          client_id: clientId,
        },
      ],
      { session }
    );

    const newProduct = newProductArr[0];

    const newStoreProduct = new Store({
      product_id: newProduct._id,
      product_name: newProduct.product_name,
      quantity: stockNum,
    });
    await newStoreProduct.save({ session });

    // ✅ agar client bo‘lsa qarz yozamiz (customer side)
    // ✅ agar client bo'lsa qarz yozamiz (SUPPLIER side)
    if (clientDoc && clientDoc.type === "supplier") {
      clientDoc.addSupplierDebt({
        // ✅ supplier debt bo'lishi kerak
        product_id: newProduct._id,
        product_name: newProduct.product_name,
        quantity: newProduct.stock,
        price_per_item: newProduct.purchase_price, // ✅ PURCHASE price
        paid_amount: newProduct.paid_amount,
        currency: newProduct.purchase_currency || "sum", // ✅ purchase currency
        note: newProduct.special_notes || "",
      });
      await clientDoc.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Mahsulot do'konga qo'shildi",
      product: newProduct,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.log(err.message);
    return res.status(500).json({ message: "Serverda xatolik" });
  }
};

exports.updateStoreProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let { quantity } = req.body;
    quantity = Number(quantity || 0);

    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ message: "quantity noto‘g‘ri." });
    }

    const storeProduct = await Store.findById(id);
    if (!storeProduct) {
      return res.status(404).json({ message: "Mahsulot dokonda topilmadi" });
    }

    storeProduct.quantity = quantity;
    await storeProduct.save();

    res
      .status(200)
      .json({ message: "Mahsulot qiymati o'zgartirildi", storeProduct });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Serverda xatolik" });
  }
};
