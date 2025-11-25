const Client = require("../models/client");

/**
 * Yangi supplier (ta'minotchi) yaratish
 * Body:
 * {
 *   name,
 *   phone?,
 *   address?
 * }
 */
exports.createClient = async (req, res) => {
  try {
    let { name, phone, address } = req.body;

    name = name?.trim();
    phone = phone?.trim();
    address = address?.trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Ism majburiy!",
      });
    }

    // Phone bo'lsa — duplicate tekshiruv
    if (phone) {
      const exists = await Client.findOne({ phone });
      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Bu telefon raqam avval ro‘yxatdan o‘tgan!",
        });
      }
    }

    const client = await Client.create({
      name,
      phone: phone || undefined,
      address: address || "",
    });

    return res.status(201).json({
      success: true,
      message: "Supplier yaratildi",
      client,
    });
  } catch (e) {
    console.error("createClient error:", e);
    return res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: e.message,
    });
  }
};

/**
 * Barcha supplierlar ro'yxati
 * Query optional: ?search=ali&limit=50&skip=0
 */
exports.getAllClients = async (req, res) => {
  try {
    const { search, limit = 200, skip = 0 } = req.query;

    const q = {};

    if (search) {
      q.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
      ];
    }

    const clients = await Client.find(q)
      .sort({ created_at: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await Client.countDocuments(q);

    return res.status(200).json({
      success: true,
      total,
      count: clients.length,
      clients,
    });
  } catch (e) {
    console.error("getAllClients error:", e);
    return res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: e.message,
    });
  }
};

/**
 * Bitta supplierni olish
 */
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Supplier topilmadi",
      });
    }

    return res.status(200).json({ success: true, client });
  } catch (e) {
    console.error("getClientById error:", e);
    return res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: e.message,
    });
  }
};

/**
 * Supplierni yangilash
 * Body:
 * {
 *   name?,
 *   phone?,
 *   address?
 * }
 */
exports.updateClient = async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    // Duplicate phone check
    if (phone) {
      const exists = await Client.findOne({
        phone: phone.trim(),
        _id: { $ne: req.params.id },
      });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Bu telefon raqam boshqa supplierga tegishli!",
        });
      }
    }

    const updateBody = {};
    if (name !== undefined) updateBody.name = name.trim();
    if (phone !== undefined) updateBody.phone = phone.trim() || undefined;
    if (address !== undefined) updateBody.address = address.trim();

    const updated = await Client.findByIdAndUpdate(req.params.id, updateBody, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Supplier topilmadi",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Supplier yangilandi",
      client: updated,
    });
  } catch (e) {
    console.error("updateClient error:", e);
    return res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: e.message,
    });
  }
};

/**
 * Supplierni o'chirish
 */
exports.deleteClient = async (req, res) => {
  try {
    const deleted = await Client.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Supplier topilmadi",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Supplier muvaffaqiyatli o‘chirildi",
      client: deleted,
    });
  } catch (e) {
    console.error("deleteClient error:", e);
    return res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: e.message,
    });
  }
};

/**
 * ✅ Supplierga yangi qarz yozish
 * POST /clients/:id/debt
 * Body:
 * {
 *   product_id?,       // ixtiyoriy
 *   product_name,
 *   quantity,
 *   price_per_item,
 *   paid_amount?,      // default 0
 *   currency?,         // "usd"|"sum"
 *   note?
 * }
 */
exports.addDebt = async (req, res) => {
  try {
    const {
      product_id,
      product_name,
      quantity,
      price_per_item,
      paid_amount = 0,
      currency = "sum",
      note = "",
    } = req.body;

    if (!product_name || !quantity || price_per_item == null) {
      return res.status(400).json({
        success: false,
        message: "product_name, quantity, price_per_item majburiy.",
      });
    }

    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Supplier topilmadi",
      });
    }

    const entry = client.addSupplierDebt({
      product_id,
      product_name,
      quantity,
      price_per_item,
      paid_amount,
      currency,
      note,
    });

    await client.save();

    return res.status(201).json({
      success: true,
      message: "Supplierga qarz yozildi",
      debt_entry: entry,
      client,
    });
  } catch (e) {
    console.error("addDebt error:", e);
    return res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: e.message,
    });
  }
};

/**
 * ✅ Supplier qarzidan to'lov qilish (biz supplierga to'laymiz)
 * POST /clients/:id/pay
 * Body:
 * {
 *   amount
 * }
 */
exports.payDebt = async (req, res) => {
  try {
    const { amount } = req.body;

    const pay = Number(amount || 0);
    if (!pay || pay <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount noto‘g‘ri",
      });
    }

    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Supplier topilmadi",
      });
    }

    client.paySupplierDebt(pay);
    await client.save();

    return res.status(200).json({
      success: true,
      message: "To‘lov qabul qilindi, supplier qarzi yangilandi",
      client,
    });
  } catch (e) {
    console.error("payDebt error:", e);
    return res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: e.message,
    });
  }
};
