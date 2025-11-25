// controllers/productController.js

const Product = require("../models/Product");
const Store = require("../models/Store"); // hozircha ishlatilmasa ham qoldirdim
const Client = require("../models/client");
const mongoose = require("mongoose");

/**
 * Supplier topish yoki yaratish (transaction ichida)
 */
async function resolveSupplier(supplier, session) {
  if (!supplier || (!supplier.phone && !supplier.name)) return null;

  const phone = supplier.phone ? supplier.phone.trim() : null;
  const name = supplier.name ? supplier.name.trim() : null;

  let found = null;

  if (phone) {
    found = await Client.findOne({ phone }).session(session);
  } else if (name) {
    found = await Client.findOne({ name }).session(session);
  }

  if (found) return found;

  const payload = {
    name: name || "Noma'lum",
    phone: phone || undefined,
    address: supplier.address ? supplier.address.trim() : "",
  };

  const newSupplierArr = await Client.create([payload], { session });
  return newSupplierArr[0];
}

/**
 * Supplier qarzini productdan qayta hisoblash
 * (purchase asosida)
 */
function calcSupplierDebt(product) {
  const stock = Number(product.stock || 0);
  const purchasePrice = Number(product.purchase_price || 0);
  const paid = Number(product.paid_amount || 0);

  const totalPurchase = stock * purchasePrice;
  const debt = totalPurchase - paid;

  return debt > 0 ? debt : 0;
}

/**
 * ✅ Mahsulot yaratish + agar supplier bo'lsa qarz yozish
 */
exports.createProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

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
      client, // frontend shu nom bilan yuboradi (supplier)
      paid_amount = 0,
    } = req.body;

    // basic validation
    if (
      !product_name ||
      !model ||
      stock == null ||
      purchase_price == null ||
      sell_price == null ||
      !count_type ||
      !barcode
    ) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Majburiy maydonlar to'liq emas." });
    }

    // ✅ STOCK qat'iy validatsiya (min 1)
    const stockNum = Number(stock);
    if (!Number.isFinite(stockNum) || stockNum < 1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Miqdor (stock) kamida 1 bo‘lishi kerak.",
      });
    }

    // check barcode uniqueness
    const existing = await Product.findOne({ barcode }).session(session);
    if (existing) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(409)
        .json({ message: "Bu barcode bilan mahsulot allaqachon mavjud." });
    }

    // handle supplier (optional)
    const supplierDoc = await resolveSupplier(client, session);
    const supplierId = supplierDoc ? supplierDoc._id : null;

    // create product
    const productData = {
      product_name,
      model,
      stock: stockNum,
      purchase_price: Number(purchase_price),
      purchase_currency,
      sell_price: Number(sell_price),
      sell_currency,
      brand_name,
      storeProduct,
      count_type,
      barcode,
      special_notes,
      kimdan_kelgan,
      paid_amount: Number(paid_amount || 0),
      client_id: supplierId,
    };

    const newProductArr = await Product.create([productData], { session });
    const newProduct = newProductArr[0];

    // ✅ agar supplier bo'lsa - supplier qarz tarixiga yozamiz (purchase asosida)
    if (supplierDoc) {
      const debt = calcSupplierDebt(newProduct);

      if (debt > 0) {
        supplierDoc.addSupplierDebt({
          product_id: newProduct._id,
          product_name: newProduct.product_name,
          quantity: newProduct.stock,
          price_per_item: newProduct.purchase_price,
          paid_amount: newProduct.paid_amount,
          currency: newProduct.purchase_currency || "sum",
          note: newProduct.special_notes || "",
        });

        await supplierDoc.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    const populated = await Product.findById(newProduct._id).populate(
      "client_id"
    );

    return res.status(201).json({
      message: "Mahsulot muvaffaqiyatli qo‘shildi",
      product: populated,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("createProduct error:", error);
    return res
      .status(500)
      .json({ message: "Server xatosi", error: error.message });
  }
};

/**
 * Barcha mahsulotlarni olish
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { limit = 100, skip = 0, search } = req.query;
    const q = {};

    if (search) {
      q.$or = [
        { product_name: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(q)
      .populate("client_id")
      .sort({ created_at: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await Product.countDocuments(q);

    return res.status(200).json({ total, count: products.length, products });
  } catch (error) {
    console.error("getAllProducts error:", error);
    return res
      .status(500)
      .json({ message: "Server xatosi", error: error.message });
  }
};

/**
 * ✅ Mahsulotni yangilash (supplier debt deltasi bilan)
 */
exports.updateProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const id = req.params.id;
    const updateBody = { ...req.body };
    const supplierPayload = updateBody.client; // frontend "client" deb yuboradi
    delete updateBody.client;

    const oldProduct = await Product.findById(id).session(session);
    if (!oldProduct) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    const oldSupplierId = oldProduct.client_id?.toString() || null;
    const oldDebt = calcSupplierDebt(oldProduct);

    // barcode o'zgarsa uniqueness tekshiramiz
    if (updateBody.barcode && updateBody.barcode !== oldProduct.barcode) {
      const exists = await Product.findOne({
        barcode: updateBody.barcode,
      }).session(session);
      if (exists) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(409)
          .json({ message: "Bu barcode bilan mahsulot allaqachon mavjud." });
      }
    }

    // ✅ stock yuborilsa min 1 tekshiruv
    if (updateBody.stock !== undefined) {
      const stockNum = Number(updateBody.stock);
      if (!Number.isFinite(stockNum) || stockNum < 1) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Miqdor (stock) kamida 1 bo‘lishi kerak.",
        });
      }
      oldProduct.stock = stockNum;
      delete updateBody.stock;
    }

    // supplier resolve (agar yuborilgan bo‘lsa)
    let newSupplierDoc = null;
    if (supplierPayload && (supplierPayload.phone || supplierPayload.name)) {
      newSupplierDoc = await resolveSupplier(supplierPayload, session);
    }
    const newSupplierId = newSupplierDoc?._id?.toString() || oldSupplierId;

    // qolgan fieldlarni yangilaymiz
    Object.keys(updateBody).forEach((k) => {
      oldProduct[k] = updateBody[k];
    });
    if (newSupplierId) oldProduct.client_id = newSupplierId;

    const updatedProduct = await oldProduct.save({ session });

    const newDebt = calcSupplierDebt(updatedProduct);

    // ✅ supplier qarzini to'g'rilash
    if (oldSupplierId && oldSupplierId !== newSupplierId) {
      // eski supplierdan debtni ayiramiz
      const oldSupplier = await Client.findById(oldSupplierId).session(session);
      if (oldSupplier) {
        oldSupplier.supplier_total_debt = Math.max(
          0,
          Number(oldSupplier.supplier_total_debt || 0) - oldDebt
        );
        await oldSupplier.save({ session });
      }

      // yangi supplierga debt yozamiz
      if (newSupplierDoc && newDebt > 0) {
        newSupplierDoc.addSupplierDebt({
          product_id: updatedProduct._id,
          product_name: updatedProduct.product_name,
          quantity: updatedProduct.stock,
          price_per_item: updatedProduct.purchase_price,
          paid_amount: updatedProduct.paid_amount,
          currency: updatedProduct.purchase_currency || "sum",
          note: updatedProduct.special_notes || "",
        });
        await newSupplierDoc.save({ session });
      }
    } else if (newSupplierId) {
      // bir xil supplier bo‘lsa faqat delta
      const diff = newDebt - oldDebt;
      if (diff !== 0) {
        const sameSupplier = await Client.findById(newSupplierId).session(
          session
        );
        if (sameSupplier) {
          sameSupplier.supplier_total_debt = Math.max(
            0,
            Number(sameSupplier.supplier_total_debt || 0) + diff
          );
          await sameSupplier.save({ session });
        }
      }
    } else if (!oldSupplierId && newSupplierDoc && newDebt > 0) {
      newSupplierDoc.addSupplierDebt({
        product_id: updatedProduct._id,
        product_name: updatedProduct.product_name,
        quantity: updatedProduct.stock,
        price_per_item: updatedProduct.purchase_price,
        paid_amount: updatedProduct.paid_amount,
        currency: updatedProduct.purchase_currency || "sum",
        note: updatedProduct.special_notes || "",
      });
      await newSupplierDoc.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    const populated = await Product.findById(updatedProduct._id).populate(
      "client_id"
    );

    return res.status(200).json({
      message: "Mahsulot yangilandi",
      product: populated,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("updateProduct error:", error);
    return res
      .status(500)
      .json({ message: "Server xatosi", error: error.message });
  }
};

/**
 * ✅ Mahsulotni o‘chirish (supplier debt kamaytirish bilan)
 */
exports.deleteProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const product = await Product.findById(req.params.id).session(session);
    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    const supplierId = product.client_id?.toString();
    const debt = calcSupplierDebt(product);

    await Product.findByIdAndDelete(req.params.id, { session });

    if (supplierId && debt > 0) {
      const supplier = await Client.findById(supplierId).session(session);
      if (supplier) {
        supplier.supplier_total_debt = Math.max(
          0,
          Number(supplier.supplier_total_debt || 0) - debt
        );
        await supplier.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Mahsulot o‘chirildi",
      product,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("deleteProduct error:", error);
    return res
      .status(500)
      .json({ message: "Server xatosi", error: error.message });
  }
};

/**
 * Barcode orqali mahsulot olish
 */
exports.getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    if (!barcode)
      return res.status(400).json({ message: "Barcode berilmadi." });

    const product = await Product.findOne({ barcode }).populate("client_id");

    if (!product) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    return res.status(200).json(product);
  } catch (error) {
    console.error("getProductByBarcode error:", error);
    return res
      .status(500)
      .json({ message: "Server xatosi", error: error.message });
  }
};
