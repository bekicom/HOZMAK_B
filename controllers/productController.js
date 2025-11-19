// controllers/productController.js

const Product = require("../models/Product");
const Store = require("../models/Store");
const Client = require("../models/Client");
const mongoose = require("mongoose");

/**
 * Mahsulot yaratish (kirim)
 * Request body:
 * {
 *   product_name, model, stock, purchase_price, purchase_currency,
 *   sell_price, sell_currency, brand_name, storeProduct, count_type,
 *   barcode, special_notes, kimdan_kelgan,
 *   client: { name, phone, address }    // optional
 * }
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
      client,
    } = req.body;

    // basic validation
    if (
      !product_name ||
      !model ||
      stock == null ||
      !purchase_price ||
      !sell_price ||
      !count_type ||
      !barcode
    ) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Majburiy maydonlar to'liq emas." });
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

    // handle client (optional)
    let clientId = null;
    if (client && (client.phone || client.name)) {
      const phone = client.phone ? client.phone.trim() : null;

      // agar phone berilsa, phone orqali topish; agar yo'q bo'lsa, name+address orqali oddiy qidiruv qilamiz
      let foundClient = null;
      if (phone) {
        foundClient = await Client.findOne({ phone }).session(session);
      } else if (client.name) {
        foundClient = await Client.findOne({ name: client.name }).session(
          session
        );
      }

      if (foundClient) {
        clientId = foundClient._id;
      } else {
        const newClient = await Client.create(
          [
            {
              name: client.name || "Noma'lum",
              phone: client.phone || "",
              address: client.address || "",
            },
          ],
          { session }
        );
        clientId = newClient[0]._id;
      }
    }

    // create product
    const productData = {
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
      client_id: clientId,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const newProduct = await Product.create([productData], { session });

    await session.commitTransaction();
    session.endSession();

    // populate client field for response (agar mavjud bo'lsa)
    const populated = await Product.findById(newProduct[0]._id).populate(
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
 * Query parametrlar bo'lishi mumkin: ?limit=50&skip=0&search=xxx
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { limit = 100, skip = 0, search } = req.query;
    const q = {};

    if (search) {
      // oddiy search: product_name, model yoki barcode orqali
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
 * Mahsulotni yangilash
 * Agar request.body.client bo'lsa -> client tekshiruv/yaratish amalga oshiriladi va client_id yangilanadi
 */
exports.updateProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updateBody = { ...req.body };
    const { client } = updateBody;

    // agar client mavjud bo'lsa, uni topish yoki yaratish
    if (client && (client.phone || client.name)) {
      let clientId = null;
      if (client.phone) {
        const existingClient = await Client.findOne({
          phone: client.phone,
        }).session(session);
        if (existingClient) clientId = existingClient._id;
        else {
          const newClient = await Client.create(
            [
              {
                name: client.name || "Noma'lum",
                phone: client.phone || "",
                address: client.address || "",
              },
            ],
            { session }
          );
          clientId = newClient[0]._id;
        }
      } else if (client.name) {
        const existingClient = await Client.findOne({
          name: client.name,
        }).session(session);
        if (existingClient) clientId = existingClient._id;
        else {
          const newClient = await Client.create(
            [
              {
                name: client.name,
                phone: client.phone || "",
                address: client.address || "",
              },
            ],
            { session }
          );
          clientId = newClient[0]._id;
        }
      }

      updateBody.client_id = clientId;
      delete updateBody.client; // olib tashlaymiz, chunki product schema-da client maydoni client_id
    }

    // updated_at yangilash
    updateBody.updated_at = new Date();

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateBody,
      {
        new: true,
        session,
      }
    );

    if (!updatedProduct) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Mahsulot topilmadi" });
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
 * Mahsulotni o‘chirish
 */
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    return res.status(200).json({
      message: "Mahsulot o‘chirildi",
      product: deletedProduct,
    });
  } catch (error) {
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
