const Client = require("../models/Client");

/**
 * Yangi mijoz yoki ta'minotchi yaratish
 * Body:
 * {
 *   name,
 *   phone,
 *   address,
 *   type: "supplier" | "customer"
 * }
 */
exports.createClient = async (req, res) => {
  try {
    let { name, phone, address, type } = req.body;

    name = name?.trim();
    phone = phone?.trim();
    address = address?.trim();

    if (!name) {
      return res.status(400).json({ success: false, message: "Ism majburiy!" });
    }

    if (!["supplier", "customer"].includes(type)) {
      type = "supplier";
    }

    // Phone bo'lsa — duplicate tekshiruv
    if (phone) {
      const exists = await Client.findOne({ phone });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: `Bu telefon raqam avval ro‘yxatdan o‘tgan (${exists.type})`,
        });
      }
    }

    const client = await Client.create({ name, phone, address, type });

    return res.status(201).json({
      success: true,
      message: `${type === "supplier" ? "Ta'minotchi" : "Mijoz"} yaratildi`,
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
 * Barcha mijoz va ta'minotchilar ro'yxati
 */
exports.getAllClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ created_at: -1 });

    return res.status(200).json({
      success: true,
      total: clients.length,
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
 * Bitta mijozni olish
 */
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: "Mijoz topilmadi" });
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
 * Mijozni yangilash
 */
exports.updateClient = async (req, res) => {
  try {
    const { name, phone, address, type } = req.body;

    // Duplicate phone check
    if (phone) {
      const exists = await Client.findOne({
        phone,
        _id: { $ne: req.params.id },
      });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Bu telefon raqam boshqa mijozga tegishli!",
        });
      }
    }

    const updated = await Client.findByIdAndUpdate(
      req.params.id,
      {
        name: name?.trim(),
        phone: phone?.trim(),
        address: address?.trim(),
        type,
      },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Mijoz topilmadi" });
    }

    return res.status(200).json({
      success: true,
      message: "Mijoz yangilandi",
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
 * Mijozni o'chirish
 */
exports.deleteClient = async (req, res) => {
  try {
    const deleted = await Client.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Mijoz topilmadi",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mijoz muvaffaqiyatli o‘chirildi",
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
