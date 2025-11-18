const Product = require("../models/Product");
const Store = require("../models/Store");
const Supplier = require("../models/Supplier"); // ✅ YANGI
const ProductReceipt = require("../models/ProductReceipt"); // ✅ YANGI
const mongoose = require("mongoose");

// Mahsulot yaratish (YANGILANGAN)
exports.createProduct = async (req, res) => {
  try {
    const {
      product_name,
      model,
      stock,
      purchase_price,
      purchase_currency,
      sell_price,
      sell_currency,
      brand_name,
      storeProduct,
      count_type,
      barcode,
      special_notes,
      kimdan_kelgan,
      supplier_id, // ✅ YANGI: Yetkazib beruvchi ID
    } = req.body;

    const newProduct = new Product({
      product_name,
      model,
      stock,
      purchase_price,
      purchase_currency,
      sell_price,
      sell_currency,
      brand_name,
      storeProduct,
      count_type,
      barcode,
      special_notes,
      kimdan_kelgan,
      supplier_id, // ✅ YANGI
    });

    await newProduct.save();
    res.status(201).json({
      message: "Mahsulot muvaffaqiyatli qo'shildi",
      product: newProduct,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ✅ YANGI: Tavar qabul qilish (bir nechta mahsulot bir vaqtda)
exports.createProductReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      supplier_id,
      receipt_date,
      products,
      paid_amount,
      payment_method,
      notes,
    } = req.body;

    // Yetkazib beruvchini tekshirish
    const supplier = await Supplier.findById(supplier_id);
    if (!supplier) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Yetkazib beruvchi topilmadi" });
    }

    // ProductReceipt yaratish
    const productReceipt = new ProductReceipt({
      supplier_id,
      receipt_date: receipt_date || new Date(),
      products,
      paid_amount: paid_amount || 0,
      payment_method: payment_method || "cash",
      notes,
    });

    await productReceipt.save({ session });

    // Har bir mahsulotni Product jadvaliga qo'shish yoki yangilash
    for (const item of products) {
      let product = await Product.findOne({ barcode: item.barcode });

      if (product) {
        // Mahsulot mavjud bo'lsa, stockni yangilash
        product.stock += item.quantity;
        product.purchase_price = item.unit_price;
        product.kimdan_kelgan = supplier.company_name;
        product.supplier_id = supplier_id;
        await product.save({ session });
      } else {
        // Yangi mahsulot yaratish
        product = new Product({
          product_name: item.product_name,
          model: item.model,
          stock: item.quantity,
          purchase_price: item.unit_price,
          currency: item.currency,
          sell_price: item.unit_price * 1.2, // 20% foyda
          brand_name: item.brand_name,
          storeProduct: true,
          count_type: item.count_type,
          barcode: item.barcode,
          kimdan_kelgan: supplier.company_name,
          supplier_id: supplier_id,
        });
        await product.save({ session });
      }

      // Store ga ham qo'shish
      let storeProduct = await Store.findOne({ product_id: product._id });
      if (storeProduct) {
        storeProduct.quantity += item.quantity;
        await storeProduct.save({ session });
      } else {
        storeProduct = new Store({
          product_id: product._id,
          quantity: item.quantity,
        });
        await storeProduct.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Tavarlar muvaffaqiyatli qabul qilindi",
      receipt: productReceipt,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: error.message });
  }
};

// ✅ YANGI: Tavar qabul qilishlar tarixi
exports.getProductReceipts = async (req, res) => {
  try {
    const receipts = await ProductReceipt.find()
      .populate("supplier_id", "name company_name phone")
      .sort({ receipt_date: -1 });

    res.status(200).json(receipts);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ✅ YANGI: Yetkazib beruvchiga to'lov qilish
exports.payToSupplier = async (req, res) => {
  try {
    const { receipt_id, amount, payment_method } = req.body;

    const receipt = await ProductReceipt.findById(receipt_id);
    if (!receipt) {
      return res.status(404).json({ message: "Qabul topilmadi" });
    }

    receipt.paid_amount += amount;
    receipt.payment_method = payment_method;

    // Statusni yangilash
    if (receipt.paid_amount >= receipt.total_amount) {
      receipt.status = "paid";
    } else if (receipt.paid_amount > 0) {
      receipt.status = "partial";
    }

    await receipt.save();

    res.status(200).json({
      message: "To'lov muvaffaqiyatli amalga oshirildi",
      receipt,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Barcha mahsulotlarni olish (YANGILANGAN)
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate(
      "supplier_id",
      "name company_name phone"
    ); // ✅ YANGI: Yetkazib beruvchi ma'lumotlari

    res.status(200).json(products);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Mahsulotni yangilash
exports.updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    res.status(200).json({
      message: "Mahsulot yangilandi",
      product: updatedProduct,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Mahsulotni o'chirish
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    res.status(200).json({
      message: "Mahsulot o'chirildi",
      product: deletedProduct,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Barcode orqali mahsulot olish
exports.getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const product = await Product.findOne({ barcode }).populate(
      "supplier_id",
      "name company_name phone"
    ); // ✅ YANGI

    if (!product) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ✅ YANGI: Yetkazib beruvchi bo'yicha mahsulotlarni olish
exports.getProductsBySupplier = async (req, res) => {
  try {
    const { supplier_id } = req.params;
    const products = await Product.find({ supplier_id }).populate(
      "supplier_id",
      "name company_name phone"
    );

    res.status(200).json(products);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ✅ YANGI: Qarzdor yetkazib beruvchilar ro'yxati
exports.getDebtorSuppliers = async (req, res) => {
  try {
    const debtorReceipts = await ProductReceipt.find({
      status: { $in: ["debt", "partial"] },
    }).populate("supplier_id", "name company_name phone");

    res.status(200).json(debtorReceipts);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
