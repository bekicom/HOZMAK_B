const Supplier = require("../models/Supplier");

// Barcha yetkazib beruvchilarni olish
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ status: "active" }).sort({
      createdAt: -1,
    });
    if (!suppliers || suppliers.length === 0) {
      return res
        .status(404)
        .json({ message: "Yetkazib beruvchilar topilmadi." });
    }
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: "Server xatosi." });
  }
};

// Yangi yetkazib beruvchi qo'shish
exports.createSupplier = async (req, res) => {
  const {
    name,
    company_name,
    phone,
    address,
    contact_person,
    email,
    description,
  } = req.body;

  // Validatsiya
  if (!name || !company_name || !phone || !address) {
    return res.status(400).json({
      message:
        "Yetkazib beruvchi nomi, firma nomi, telefon va manzil kiritilishi shart.",
    });
  }

  try {
    const newSupplier = new Supplier({
      name,
      company_name,
      phone,
      address,
      contact_person,
      email,
      description,
    });

    await newSupplier.save();
    res.status(201).json({
      message: "Yetkazib beruvchi muvaffaqiyatli qo'shildi.",
      supplier: newSupplier,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Bu telefon raqam bilan yetkazib beruvchi allaqachon mavjud.",
      });
    }
    res.status(500).json({ message: "Server xatosi." });
  }
};

// Yetkazib beruvchini yangilash
exports.updateSupplier = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    company_name,
    phone,
    address,
    contact_person,
    email,
    description,
  } = req.body;

  try {
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      id,
      {
        name,
        company_name,
        phone,
        address,
        contact_person,
        email,
        description,
      },
      { new: true, runValidators: true }
    );

    if (!updatedSupplier) {
      return res.status(404).json({ message: "Yetkazib beruvchi topilmadi." });
    }

    res.json({
      message: "Yetkazib beruvchi muvaffaqiyatli yangilandi.",
      supplier: updatedSupplier,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Bu telefon raqam bilan yetkazib beruvchi allaqachon mavjud.",
      });
    }
    res.status(500).json({ message: "Server xatosi." });
  }
};

// Yetkazib beruvchini o'chirish (soft delete)
exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedSupplier = await Supplier.findByIdAndUpdate(
      id,
      { status: "inactive" },
      { new: true }
    );

    if (!deletedSupplier) {
      return res.status(404).json({ message: "Yetkazib beruvchi topilmadi." });
    }

    res.json({ message: "Yetkazib beruvchi muvaffaqiyatli o'chirildi." });
  } catch (error) {
    res.status(500).json({ message: "Server xatosi." });
  }
};

// ID bo'yicha bitta yetkazib beruvchini olish
exports.getSupplierById = async (req, res) => {
  const { id } = req.params;

  try {
    const supplier = await Supplier.findOne({ _id: id, status: "active" });

    if (!supplier) {
      return res.status(404).json({ message: "Yetkazib beruvchi topilmadi." });
    }

    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: "Server xatosi." });
  }
};
